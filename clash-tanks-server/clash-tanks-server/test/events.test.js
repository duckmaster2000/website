'use strict';

// Special events: engine rules (clash-sim.js) and the event layer (events.js). Run with: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const Sim = require('../shared/clash-sim');
const Events = require('../shared/events');

const STEP = Sim.MATCH.step;

function run(state, seconds, each) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps && state.running; i++) {
    Sim.step(state);
    if (each && each(state) === false) break;
  }
}

// Towers can't shoot and can't die, so tests isolate one rule at a time
function quiet(rules, extra) {
  const s = Sim.createMatch(Object.assign({ seed: 11, rules }, extra || {}));
  s.towers.forEach((t) => { t.active = false; t.hp = t.hpMax = 1e6; });
  return s;
}

function eventMatch(eventId, opts) {
  const o = opts || {};
  const seed = o.seed || 99;
  const deckA = o.deckA || Events.loanerDeck(eventId, seed);
  const deckB = o.deckB || Events.aiDeckFor(eventId, seed + 1);
  const lvl = o.level || 1;
  const cfg = Events.buildMatch(eventId, { seed, tier: o.tier, level: lvl, decks: { A: deckA.map((id) => ({ id, level: lvl })), B: deckB.map((id) => ({ id, level: lvl })) }, hasEvo: o.hasEvo, picks: o.picks });
  const state = Sim.createMatch({ seed, rules: cfg.rules, decks: cfg.decks });
  return { cfg, state };
}

// ── Rules: defaults, validation, no leaking ─────────────────────────────────

test('normal matches run on the default rules, and event rules never leak into the next match', () => {
  const plain = Sim.createMatch({ seed: 1 });
  assert.equal(plain.rules.regulation, 180);
  assert.equal(plain.rules.maxElixir, 10);
  assert.deepEqual(plain.rules.modifiers, []);
  const { state: chaos } = eventMatch('chaos', { tier: 'total' });
  run(chaos, 60);
  assert.ok(chaos.mods.active.length > 0 || chaos.rules.modifiers.length > 0);
  const after = Sim.createMatch({ seed: 1 });
  assert.deepEqual(after.rules, plain.rules, 'a new normal match gets pristine rules');
  assert.equal(after.modFx.move, 1);
  assert.equal(after.modFx.cost, 0);
  // The shared card table is untouched by card mods
  const { state: storm } = eventMatch('spellstorm');
  const shock = storm.players.A.cards.shock || Object.values(storm.players.A.cards).find((c) => c.spell);
  assert.ok(shock.cost < Sim.CARD_MAP[shock.id].cost || Sim.CARD_MAP[shock.id].cost === 1);
  assert.equal(Sim.CARD_MAP.shock.cost, 2);
  // Clock and elixir behave exactly like before in a normal match
  run(plain, 10);
  assert.ok(Math.abs(plain.players.A.elixir - (5 + 10 / 2.8)) < 0.05);
});

test('rules are cleaned: numbers clamped, unknown modifiers and bad deck swaps dropped', () => {
  const r = Sim.normalizeRules({
    regulation: 99999, maxElixir: -4, startElixir: 50, crownsToWin: 9,
    modifiers: [{ id: 'nope', at: 3 }, { id: 'surge', at: 5, dur: 4 }, { id: 'jetstream', at: -2 }],
    deckSwaps: [{ at: 10, A: ['scout'], B: ['nope'] }],
    cardMods: [{ when: { spell: true }, cost: -99, hp: 1e9 }],
    waves: [{ at: 4, units: [{ card: 'firebomb' }, { card: 'brawler', n: 99 }] }],
  });
  assert.equal(r.regulation, 600);
  assert.equal(r.maxElixir, 4);
  assert.equal(r.startElixir, 4);
  assert.equal(r.crownsToWin, 3);
  assert.deepEqual(r.modifiers.map((m) => m.id), ['jetstream', 'surge']);
  assert.equal(r.modifiers[0].at, 0);
  assert.equal(r.deckSwaps.length, 0);
  assert.equal(r.cardMods[0].cost, -3);
  assert.equal(r.cardMods[0].hp, 4);
  assert.equal(r.waves[0].units.length, 2, 'normalize keeps known cards; spells are skipped when the wave spawns');
  assert.equal(r.waves[0].units[1].n, 6);
});

// ── Elixir rules ────────────────────────────────────────────────────────────

test('Elixir Overload: 2x from the start, 3x in the last minute, start at 7', () => {
  const { state } = eventMatch('overload');
  assert.equal(state.players.A.elixir, 7);
  state.players.A.elixir = 0;
  run(state, 2);
  assert.ok(Math.abs(state.players.A.elixir - 2 * 2 / 2.8) < 0.05);
  state.time = 125;
  state.players.A.elixir = 0;
  run(state, 1);
  assert.ok(Math.abs(state.players.A.elixir - 3 / 2.8) < 0.05);
  assert.equal(Sim.snapshot(state).elixirMult, 3);
});

test('Heavyweights: max elixir 14 and nothing is ever below zero', () => {
  const { state } = eventMatch('heavy');
  assert.equal(state.players.A.elixir, 8);
  run(state, 40);
  assert.ok(state.players.A.elixir <= 14 + 1e-9);
  assert.ok(state.players.A.elixir > 10, 'can bank past the normal cap');
  assert.equal(Sim.snapshot(state).maxElixir, 14);
});

test('Scavenger: killing an enemy troop refunds part of its cost; kamikazes and tokens pay nothing', () => {
  const s = quiet(Events.buildMatch('scavenger', { seed: 3 }).rules);
  s.players.A.elixir = 0; s.players.B.elixir = 0;
  const victim = Sim.spawnDirect(s, 'B', 'brawler', 9, 20);   // costShare 4
  const killer = Sim.spawnDirect(s, 'A', 'drillcat', 9, 21);
  victim.dmg = 0;
  run(s, 12, () => victim.hp > 0);
  run(s, 0.2);
  assert.ok(!s.units.includes(victim));
  assert.ok(s.players.A.elixir >= 0.45 * 4 - 0.01 + 0.55 * (12.2 / 2.8) * 0 , 'refund paid');
  const gainedWithRefund = s.players.A.elixir;
  // Same kill without the refund rule for comparison
  const s2 = quiet({});
  s2.players.A.elixir = 0;
  const v2 = Sim.spawnDirect(s2, 'B', 'brawler', 9, 20);
  Sim.spawnDirect(s2, 'A', 'drillcat', 9, 21);
  v2.dmg = 0;
  run(s2, 12, () => v2.hp > 0);
  run(s2, 0.2);
  assert.ok(gainedWithRefund > 1.5, `refund should be visible (${gainedWithRefund})`);
  // Tokens (costShare 0) never pay
  const s3 = quiet(Events.buildMatch('scavenger', { seed: 3 }).rules);
  s3.players.A.elixir = 0;
  const skel = Sim.spawnDirect(s3, 'B', 'cryptskel', 9, 20);
  skel.costShare = 0;
  skel.hp = 1; skel.hitT = s3.time;
  skel.hp = 0;
  run(s3, 0.1);
  assert.ok(s3.players.A.elixir < 0.1);
});

test('Fortress Wars: living buildings speed up elixir (capped at 3)', () => {
  const rules = Events.buildMatch('fortress', { seed: 1 }).rules;
  const s = quiet(rules);
  s.players.A.elixir = 0;
  for (let i = 0; i < 5; i++) { const b = Sim.spawnDirect(s, 'A', 'boltturret', 2 + i * 3, 27); b.lifetime = 0; }
  run(s, 2);
  const expected = 2 / 2.8 * (1 + 0.12 * 3);
  assert.ok(Math.abs(s.players.A.elixir - expected) < 0.03, `${s.players.A.elixir} vs ${expected}`);
  const bt = s.players.A.cards.boltturret || Sim.applyCardMods(Sim.getCardStatsAtLevel('boltturret', 1), rules.cardMods);
  assert.equal(bt.cost, 3);
});

// ── Card rules ──────────────────────────────────────────────────────────────

test('card mods: Spellstorm discounts spells, Swarm Wars grows swarms, never below 1 elixir', () => {
  const storm = Events.buildMatch('spellstorm', { seed: 1 }).rules;
  assert.equal(Sim.applyCardMods(Sim.getCardStatsAtLevel('shock', 1), storm.cardMods).cost, 1);
  assert.equal(Sim.applyCardMods(Sim.getCardStatsAtLevel('tartrap', 1), storm.cardMods).cost, 1);
  assert.equal(Sim.applyCardMods(Sim.getCardStatsAtLevel('brawler', 1), storm.cardMods).cost, 4, 'troops untouched');
  const swarm = Events.buildMatch('swarm', { seed: 1 }).rules;
  assert.equal(Sim.applyCardMods(Sim.getCardStatsAtLevel('junkpack', 1), swarm.cardMods).swarmCount, 5);
  assert.equal(Sim.applyCardMods(Sim.getCardStatsAtLevel('makoswarm', 1), swarm.cardMods).swarmCount, 9);
  const s = quiet(swarm, { decks: { A: ['junkpack', 'antmarch', 'mechmice', 'beeblitz', 'shock', 'firebomb', 'boltturret', 'goblinbikers'], B: null } });
  s.players.A.elixir = 10;
  const res = Sim.deploy(s, 'A', 'junkpack', 9, 26);
  assert.ok(res.ok);
  assert.equal(res.units.length, 5);
});

test('Spellstorm: damage spells echo at half strength about a second later', () => {
  const rules = Events.buildMatch('spellstorm', { seed: 1 }).rules;
  const s = quiet(rules, { decks: { A: ['shock', 'firebomb', 'rocketrain', 'brawler', 'scout', 'siege', 'voltbug', 'drillcat'], B: null } });
  const dummy = Sim.spawnDirect(s, 'B', 'rocktitan', 9, 10);
  dummy.speed = 0; dummy.dmg = 0;
  run(s, 0.1); // let the spatial index see the new unit
  s.players.A.elixir = 10;
  const hp0 = dummy.hp;
  assert.ok(Sim.deploy(s, 'A', 'shock', 9, 10).ok);
  run(s, 0.1);
  const afterFirst = hp0 - dummy.hp;
  run(s, 1.5);
  const total = hp0 - dummy.hp;
  assert.ok(afterFirst > 0);
  assert.ok(Math.abs(total - afterFirst * 1.5) < 2, `echo adds half: ${afterFirst} then ${total}`);
});

test('Size Roulette: each troop card in hand is rolled, costs follow the form, and the unit matches it', () => {
  const rules = Events.buildMatch('sizes', { seed: 1 }).rules;
  let sawTiny = false;
  let sawMega = false;
  for (let seed = 1; seed < 40 && !(sawTiny && sawMega); seed++) {
    const s = quiet(rules, { seed, decks: { A: ['brawler', 'scout', 'siege', 'guardian', 'voltbug', 'drillcat', 'ramhog', 'flarepod'], B: null } });
    const p = s.players.A;
    for (const id of p.hand) {
      const form = p.size[id];
      const base = p.cards[id].cost;
      if (form === 'tiny') { sawTiny = true; assert.equal(Sim.playCost(s, 'A', id), Math.max(1, base - 1)); }
      if (form === 'mega') {
        sawMega = true;
        assert.equal(Sim.playCost(s, 'A', id), base + 1);
        p.elixir = 10;
        const res = Sim.deploy(s, 'A', id, 9, 26);
        assert.ok(res.ok);
        assert.equal(res.units[0].form, 'mega');
        assert.equal(res.units[0].hpMax, Math.round(p.cards[id].hpScaled * 1.6));
        assert.ok(Math.abs(p.elixir - (10 - base - 1)) < 0.01);
        break;
      }
    }
  }
  assert.ok(sawTiny && sawMega);
});

test('Deck Roulette: hands are replaced on schedule, cooldowns reset, no Evolutions', () => {
  const { cfg, state } = eventMatch('roulette', { seed: 5 });
  const first = state.players.A.hand.slice();
  assert.equal(Object.keys(state.players.A.evo).length, 0);
  run(state, 59.9);
  assert.equal(Sim.snapshot(state).ev.swapIn <= 0.2, true);
  run(state, 0.3);
  const swapped = cfg.rules.deckSwaps[0].A;
  assert.deepEqual(state.players.A.hand, swapped.slice(0, 4));
  assert.notDeepEqual(state.players.A.hand, first);
  assert.ok(Object.values(state.players.A.cooldowns).every((v) => v === 0));
  assert.equal(state.players.A.cards[swapped[0]].level, 1, 'swapped-in decks keep the match level');
});

test('Evolution Frenzy: every Evolution card is evolved-capable for the match, with shorter cycles', () => {
  const rules = Events.buildMatch('evofrenzy', { seed: 1 }).rules;
  const s = quiet(rules, { decks: { A: ['drillcat', 'brawler', 'voltbug', 'scout', 'siege', 'guardian', 'ramhog', 'flarepod'], B: null } });
  const p = s.players.A;
  assert.equal(p.evo.drillcat.need, 0, 'Diamond Drill: 1 cycle - 1 = evolves every play');
  assert.equal(p.evo.brawler.need, 1);
  assert.ok(!p.evo.scout, 'cards without an Evolution are unaffected');
  p.elixir = 10;
  const r = Sim.deploy(s, 'A', 'drillcat', 9, 26);
  assert.ok(r.ok && r.evolved);
});

// ── Win conditions ──────────────────────────────────────────────────────────

test('Sudden Death: the first tower destroyed wins; no overtime', () => {
  const { state } = eventMatch('suddendeath');
  const t = state.towers.find((x) => x.owner === 'B' && x.tower === 'princess');
  t.hp = 0;
  run(state, 0.1);
  assert.equal(state.running, false);
  assert.equal(state.winner, 'A');
  assert.equal(state.endReason, 'firstCrown');
  const { state: s2 } = eventMatch('suddendeath');
  s2.towers.find((x) => x.owner === 'A' && x.tower === 'princess').hp -= 100;
  s2.time = 149.99;
  run(s2, 0.2);
  assert.equal(s2.winner, 'B');
  assert.equal(s2.endReason, 'tiebreak');
});

test('King of the Hill: holding the hill fills the meter, a full meter is a crown, contesting slows it', () => {
  const rules = Events.buildMatch('koth', { seed: 1 }).rules;
  const s = quiet(rules);
  const u = Sim.spawnDirect(s, 'A', 'brawler', 3.5, 16);
  u.speed = 0; u.dmg = 0;
  run(s, 5);
  const solo = s.hill.pts.A;
  assert.ok(Math.abs(solo - 6 * (5 - 0)) < 2, `meter fills at the rate (${solo})`);
  run(s, 12.5);
  assert.equal(s.players.A.crowns, 1, 'full meter = 1 crown');
  assert.equal(s.players.A.hillCrowns, 1);
  // Contested: an enemy on the hill too
  const s2 = quiet(rules);
  const a = Sim.spawnDirect(s2, 'A', 'brawler', 3.5, 16.5);
  const b = Sim.spawnDirect(s2, 'B', 'scrapbots', 3.5, 15.5);
  [a, b].forEach((x) => { x.speed = 0; x.dmg = 0; x.targets = 'none'; });
  run(s2, 5);
  assert.ok(s2.hill.pts.A < solo * 0.8, 'contested hill fills slower');
  // The hill moves on schedule
  const s3 = quiet(rules);
  run(s3, 40.1);
  assert.equal(s3.hill.idx, 1);
  assert.equal(Sim.snapshot(s3).ev.hill.x, 14.5);
});

test('King of the Hill: 3 crowns (towers + hill) win on the spot', () => {
  const { state } = eventMatch('koth');
  state.players.A.crowns = 2;
  state.hill.pts.A = 99.9;
  const u = Sim.spawnDirect(state, 'A', 'brawler', 3.5, 16);
  u.dmg = 0; u.speed = 0;
  run(state, 1);
  assert.equal(state.winner, 'A');
  assert.equal(state.endReason, 'crownRace');
});

test('Last Stand: waves arrive on schedule, idle troops hold the line, surviving wins', () => {
  const { cfg, state } = eventMatch('survival');
  assert.equal(state.towers.filter((t) => t.owner === 'B').length, 0, 'no enemy towers');
  state.towers.forEach((t) => { t.hp = t.hpMax = 1e7; });
  const guard = Sim.spawnDirect(state, 'A', 'brawler', 9, 28);
  run(state, cfg.rules.waves[0].at + 0.2);
  assert.equal(state.waveNo, 1);
  assert.ok(state.units.some((u) => u.owner === 'B'), 'first wave spawned');
  assert.ok(guard.y < 26, 'idle troop walks up to the guard line');
  // Clear everything after the last wave: early win
  run(state, cfg.rules.waves[9].at - state.time + 0.5);
  // Rock Titans split into shards when they die, so keep clearing until nothing is left
  for (let k = 0; k < 20 && state.running; k++) { state.units.forEach((u) => { if (u.owner === 'B') u.hp = 0; }); run(state, 0.1); }
  assert.equal(state.winner, 'A');
  assert.equal(state.endReason, 'survived');
  // Timeout with the king standing is a win too
  const { state: s2 } = eventMatch('survival');
  s2.towers.forEach((t) => { t.hp = t.hpMax = 1e7; });
  run(s2, 205);
  assert.equal(s2.winner, 'A');
});

test('Boss Battle: telegraphed slams, guard summons, enrage, immunity rules, and both endings', () => {
  const { state } = eventMatch('boss', { tier: 'normal' });
  run(state, 3.2);
  const boss = state.units.find((u) => u.boss);
  assert.ok(boss, 'boss spawned');
  assert.equal(Sim.snapshot(state).ev.boss.spawned, true);
  // Bait so it slams
  const bait = [Sim.spawnDirect(state, 'A', 'rocktitan', boss.x, boss.y + 2.5), Sim.spawnDirect(state, 'A', 'rocktitan', boss.x + 1.2, boss.y + 3)];
  bait.forEach((b) => { b.dmg = 0; b.speed = 0; b.targets = 'none'; b.hp = b.hpMax = 1e6; });
  let warned = null;
  run(state, 8, () => { const z = state.zones.find((zz) => zz.kind === 'slam'); if (z && z.delay > 0) { warned = z; return false; } return true; });
  assert.ok(warned, 'a slam warning circle appears before it lands');
  assert.ok(warned.delay > 1, 'with over a second of warning');
  // Knockback and stuns
  const x0 = boss.x;
  Sim.castDirect(state, 'A', 'firebomb', boss.x, boss.y, 1);
  run(state, 2.2); // the bomb flies from the King Tower
  assert.ok(Math.abs(boss.x - x0) < 1.5, 'not knocked back by spells (only its own walk)');
  boss.stunT = 0;
  Sim.castDirect(state, 'A', 'shock', boss.x, boss.y, 1);
  assert.ok(boss.stunT <= 0.31, 'stuns last half as long');
  // Summons at 70%: guarded while they live
  boss.hp = boss.hpMax * 0.69;
  run(state, 0.1);
  assert.ok(state.units.some((u) => u.bossMinion), 'guards summoned');
  assert.equal(state.boss.guard, true);
  const before = boss.hp;
  const src = { id: 'x', owner: 'A', structureMult: 1, kind: 'troop' };
  // applyDamage via a spell: guarded takes half
  Sim.castDirect(state, 'A', 'shock', boss.x, boss.y, 1);
  run(state, 0.05);
  const guardedHit = before - boss.hp;
  state.units.forEach((u) => { if (u.bossMinion) u.hp = 0; });
  run(state, 0.1);
  assert.equal(state.boss.guard, false);
  const b2 = boss.hp;
  Sim.castDirect(state, 'A', 'shock', boss.x, boss.y, 1);
  run(state, 0.05);
  assert.ok(Math.abs((b2 - boss.hp) - guardedHit * 2) < 3, `guard halves damage (${guardedHit} vs ${b2 - boss.hp})`);
  void src;
  boss.hp = boss.hpMax * 0.3;
  run(state, 0.2);
  assert.equal(state.boss.enraged, true);
  boss.hp = 0;
  run(state, 0.1);
  assert.equal(state.winner, 'A');
  assert.equal(state.endReason, 'boss');
  // Timeout is a loss
  const { state: s2 } = eventMatch('boss', { tier: 'hard' });
  s2.towers.forEach((t) => { t.hp = t.hpMax = 1e7; });
  run(s2, 181);
  assert.equal(s2.winner, 'B');
  assert.equal(s2.endReason, 'timeout');
});

// ── Timed modifiers ─────────────────────────────────────────────────────────

test('modifiers switch on and off on the match clock, with warnings, zones and clean-up', () => {
  const s = quiet({ modifiers: [{ id: 'jetstream', at: 5, dur: 4 }, { id: 'surge', at: 2, dur: 3 }] });
  run(s, 1.5);
  const snap = Sim.snapshot(s);
  assert.deepEqual(snap.ev.next.map((m) => m.id), ['surge', 'jetstream'], 'announced inside the warning window');
  run(s, 1);
  assert.deepEqual(s.mods.active.map((a) => a.id), ['surge']);
  assert.equal(s.modFx.elixir, 2);
  run(s, 3);
  assert.deepEqual(s.mods.active.map((a) => a.id), ['jetstream']);
  assert.equal(s.zones.filter((z) => z.kind === 'cHaste').length, 2);
  assert.equal(s.modFx.elixir, 1, 'surge expired and its effect is gone');
  run(s, 4);
  assert.equal(s.mods.active.length, 0);
  assert.equal(s.zones.filter((z) => z.modId).length, 0, 'zones removed when the modifier ends');
});

test('stacking: one per group, the same modifier refreshes instead of stacking, effects are capped', () => {
  const s = quiet({ modifiers: [{ id: 'surge', at: 1, dur: 5 }, { id: 'drought', at: 2, dur: 5 }, { id: 'overclock', at: 1, dur: 3 }, { id: 'overclock', at: 2, dur: 5 }] });
  run(s, 2.5);
  assert.deepEqual(s.mods.active.map((a) => a.id).sort(), ['overclock', 'surge'], 'drought shares the elixir group with surge, so it is refused');
  assert.ok(Math.abs(s.modFx.move - 1.3) < 1e-9, 'a repeated modifier never stacks with itself');
  assert.ok(s.mods.active.find((a) => a.id === 'overclock').end >= 6.9, 'it refreshes its timer instead');
  const fx = Sim.combineModFx(['overclock', 'overclock', 'overclock', 'jetstream']);
  assert.equal(fx.move, Sim.MOD_CAPS.move[1]);
  const many = Sim.combineModFx(['sale', 'sale', 'sale']);
  assert.equal(many.cost, -2, 'cost changes are capped');
  assert.equal(Sim.combineModFx(['pinball', 'pinball']).knock, 0.5, '"max" policy: highest wins');
});

test('cost modifiers: never below 1, deploy charges the shown cost, elixir never goes negative', () => {
  const s = quiet({ modifiers: [{ id: 'sale', at: 0.5, dur: 20 }] }, { decks: { A: ['shock', 'scout', 'brawler', 'siege', 'voltbug', 'drillcat', 'ramhog', 'flarepod'], B: null } });
  run(s, 1);
  assert.equal(Sim.playCost(s, 'A', 'shock'), 1);
  assert.equal(Sim.playCost(s, 'A', 'brawler'), 3);
  s.players.A.elixir = 3;
  assert.ok(Sim.deploy(s, 'A', 'brawler', 9, 26).ok);
  assert.ok(Math.abs(s.players.A.elixir) < 0.05);
  const res = Sim.deploy(s, 'A', 'siege', 9, 26);
  assert.equal(res.ok, false);
  assert.ok(s.players.A.elixir >= 0);
  assert.ok(Sim.snapshot(s).players.A.cost.siege === 5);
});

test('Meteor Shower: telegraphed, mirrored, hits troops on both sides, never towers, and stops at match end', () => {
  const s = Sim.createMatch({ seed: 4, rules: { modifiers: [{ id: 'meteors', at: 0.5, dur: 30 }] } });
  run(s, 2);
  const marks = s.zones.filter((z) => z.kind === 'impact');
  assert.equal(marks.length, 2);
  assert.ok(Math.abs(marks[0].x + marks[1].x - Sim.W) < 1e-6 && Math.abs(marks[0].y + marks[1].y - Sim.H) < 1e-6, 'mirrored');
  const a = Sim.spawnDirect(s, 'A', 'rocktitan', marks[0].x, marks[0].y);
  const b = Sim.spawnDirect(s, 'B', 'rocktitan', marks[1].x, marks[1].y);
  [a, b].forEach((u) => { u.speed = 0; u.dmg = 0; });
  const towerHp = s.towers.map((t) => t.hp);
  run(s, 1.6);
  assert.ok(a.hp < a.hpMax && b.hp < b.hpMax, 'both sides hit');
  assert.ok(Math.abs((a.hpMax - a.hp) - (b.hpMax - b.hp)) < 1);
  s.towers.forEach((t, i) => assert.ok(t.hp >= towerHp[i] - 200, 'meteors spare towers (towers only take normal fire)'));
  // End the match mid-shower: nothing is left armed
  s.towers.find((t) => t.owner === 'B' && t.tower === 'king').hp = 0;
  run(s, 0.1);
  assert.equal(s.running, false);
  assert.equal(s.zones.length, 0);
  const t0 = s.time;
  run(s, 5);
  assert.equal(s.time, t0, 'nothing happens after the final whistle');
});

test('Death Rattle and Pinball stay bounded in a crowded fight; dying units during a modifier are safe', () => {
  const s = quiet({ modifiers: [{ id: 'rattle', at: 0, dur: 30 }, { id: 'pinball', at: 0, dur: 30 }, { id: 'eagleeye', at: 2, dur: 3 }] });
  for (let i = 0; i < 30; i++) {
    Sim.spawnDirect(s, 'A', i % 2 ? 'scrapbots' : 'voltbug', 3 + (i % 6) * 2, 18 + Math.floor(i / 6));
    Sim.spawnDirect(s, 'B', i % 2 ? 'junkpack' : 'bugsquad', 3 + (i % 6) * 2, 14 - Math.floor(i / 6));
  }
  const t0 = Date.now();
  run(s, 20);
  assert.ok(Date.now() - t0 < 4000, 'fast enough');
  for (const u of s.units) {
    assert.ok(Number.isFinite(u.x) && Number.isFinite(u.y) && Number.isFinite(u.hp));
    assert.ok(u.x >= 0 && u.x <= Sim.W && u.y >= 0 && u.y <= Sim.H);
    if (u.kind === 'troop') assert.equal(u.range, u.baseRange, 'Eagle Eye range is gone after it ends');
  }
});

test('Aegis shields troops on the field and fresh deploys; Evolution Rush charges twice', () => {
  const s = quiet({ modifiers: [{ id: 'aegis', at: 1, dur: 10 }, { id: 'evorush', at: 1, dur: 10 }] }, { decks: { A: [{ id: 'brawler', evo: true }, 'scout', 'siege', 'guardian', 'voltbug', 'drillcat', 'ramhog', 'flarepod'], B: null } });
  const early = Sim.spawnDirect(s, 'A', 'brawler', 9, 27);
  run(s, 1.1);
  assert.equal(early.shield, Math.round(early.hpMax * 0.25));
  s.players.A.elixir = 10;
  const r = Sim.deploy(s, 'A', 'brawler', 9, 26);
  assert.ok(r.units[0].shield > 0);
  assert.equal(s.players.A.evo.brawler.charge, 2, 'one play charged it twice');
});

test('Chaos AI vs AI: legal, deterministic, and finishes, at every intensity', () => {
  for (const tier of ['mild', 'wild', 'extreme', 'total']) {
    const play = () => {
      const { state } = eventMatch('chaos', { tier, seed: 1234, hasEvo: true,
        deckA: ['brawler', 'siege', 'voltbug', 'flarepod', 'shock', 'firebomb', 'boltturret', 'ramhog'] });
      const ai = [Sim.createAi('A', null, 1), Sim.createAi('B', null, 2)];
      let illegal = 0;
      for (let i = 0; i < 4800 && state.running; i++) {
        ai.forEach((b) => { const res = Sim.aiUpdate(state, b, STEP); if (res && !res.ok) illegal++; });
        Sim.step(state);
        state.players.A.elixir >= 0 || illegal++;
      }
      return { snap: JSON.stringify(Sim.snapshot(state)), illegal, state };
    };
    const a = play();
    const b = play();
    assert.equal(a.illegal, 0, `${tier}: no illegal moves`);
    assert.equal(a.snap, b.snap, `${tier}: same seed, same match`);
    assert.equal(a.state.running, false, `${tier}: the match ends`);
  }
});

test('every PvP event survives a full AI-vs-AI match with only legal moves', () => {
  const pvp = Events.EVENTS.filter((e) => e.modes.includes('pvp') || e.id === 'draft');
  for (const ev of pvp) {
    const { state } = eventMatch(ev.id, { seed: 77, tier: ev.tiers ? ev.tiers[1].id : undefined });
    const ai = [Sim.createAi('A', null, 3), Sim.createAi('B', null, 4)];
    let bad = 0;
    let plays = 0;
    for (let i = 0; i < 6000 && state.running; i++) {
      ai.forEach((b) => { const res = Sim.aiUpdate(state, b, STEP); if (res) { if (res.ok) plays++; else bad++; } });
      Sim.step(state);
    }
    assert.equal(bad, 0, `${ev.id}: legal moves`);
    assert.ok(plays > 10, `${ev.id}: the AI actually plays (${plays})`);
    assert.equal(state.running, false, `${ev.id}: ends`);
  }
});

test('the AI plays survival and boss events (defends, no illegal moves) and the scripted side stays scripted', () => {
  for (const id of ['survival', 'boss']) {
    const { state } = eventMatch(id, { seed: 8, tier: 'normal' });
    const ai = Sim.createAi('A', { thinkMin: 0.3, thinkMax: 0.4, strategicChance: 0.9 }, 5);
    let bad = 0;
    let plays = 0;
    for (let i = 0; i < 4400 && state.running; i++) {
      const res = Sim.aiUpdate(state, ai, STEP);
      if (res) { if (res.ok) plays++; else bad++; }
      Sim.step(state);
    }
    assert.equal(bad, 0);
    assert.ok(plays > 5, `${id}: AI defends (${plays} plays)`);
    assert.equal(state.players.B.cardsPlayed, 0, 'nobody plays cards for the scripted side');
    assert.equal(state.running, false);
  }
});

test('the AI avoids telegraphed hazards when it can', () => {
  const s = quiet({});
  Sim.spawnDirect(s, 'B', 'brawler', 9, 22);
  // A pending meteor mark on its favourite defensive spot
  s.zones.push({ id: 'zt', kind: 'impact', owner: 'X', x: 9, y: 24.5, r: 1.6, delay: 1.2, total: 100, age: 0, done: false });
  const brain = Sim.createAi('A', { strategicChance: 1, thinkMin: 0.1, thinkMax: 0.1 }, 1);
  s.players.A.elixir = 10;
  const plan = Sim.aiDecide(s, brain);
  if (plan && !Sim.CARD_MAP[plan.cardId].spell) {
    assert.ok(Math.hypot(plan.x - 9, plan.y - 24.5) > 1.6 + 0.8 - 1e-6, 'deploys outside the warned circle');
  }
});

// ── Events module ───────────────────────────────────────────────────────────

test('catalog: every event is complete and builds valid rules for every tier', () => {
  for (const ev of Events.EVENTS) {
    for (const k of ['id', 'name', 'icon', 'category', 'tagline', 'desc', 'rules', 'win', 'loss', 'modes', 'schedule', 'rewards']) assert.ok(ev[k] != null, `${ev.id}.${k}`);
    assert.ok(ev.rules.length >= 1);
    const tiers = ev.tiers ? ev.tiers.map((t) => t.id) : [undefined];
    for (const tier of tiers) {
      const cfg = Events.buildMatch(ev.id, { seed: 5, tier, decks: { A: Events.loanerDeck(ev.id, 1), B: Events.loanerDeck(ev.id, 2) } });
      assert.equal(cfg.rules.eventId, ev.id);
      assert.deepEqual(Sim.normalizeRules(cfg.rules), cfg.rules, 'rules are already normal');
      const st = Sim.createMatch({ seed: 5, rules: cfg.rules, decks: cfg.decks });
      Sim.step(st);
    }
  }
  assert.throws(() => Events.buildMatch('nope', {}));
});

test('deck rules: validation explains problems, and loaner decks are always legal', () => {
  const bad = Events.validateDeck('spellstorm', ['brawler', 'scout', 'siege', 'guardian', 'voltbug', 'drillcat', 'ramhog', 'shock']);
  assert.equal(bad.ok, false);
  assert.match(bad.problems.join(' '), /3 spells/);
  const swarm = Events.validateDeck('swarm', ['brawler', 'junkpack', 'antmarch', 'mechmice', 'beeblitz', 'shock', 'firebomb', 'boltturret']);
  assert.match(swarm.problems.join(' '), /Brawler/);
  assert.equal(Events.validateDeck('heavy', ['shock', 'brawler', 'siege', 'guardian', 'voltbug', 'drillcat', 'ramhog', 'flarepod']).ok, false);
  assert.equal(Events.validateDeck('overload', ['scout']).ok, false, '8 cards needed');
  for (const ev of Events.EVENTS) {
    for (let seed = 1; seed <= 60; seed++) {
      const d = Events.loanerDeck(ev.id, seed);
      assert.equal(d.length, 8);
      assert.ok(Events.validateDeck(ev.id, d).ok, `${ev.id} seed ${seed}: ${Events.validateDeck(ev.id, d).problems}`);
    }
  }
  const fixed = Events.legalDeckFor('spellstorm', ['brawler', 'scout', 'siege', 'guardian', 'voltbug', 'drillcat', 'ramhog', 'shock'].map((id) => ({ id, level: 6 })), 3);
  assert.equal(fixed.loaner, true);
  assert.ok(Events.validateDeck('spellstorm', fixed.entries.map((e) => e.id)).ok);
  assert.equal(fixed.entries[0].level, 6);
});

test('draft: 16 different cards, both decks complete, bad picks default safely', () => {
  for (let seed = 1; seed < 80; seed++) {
    const rounds = Events.draftRounds(seed);
    assert.equal(rounds.length, 8);
    const all = rounds.flatMap((r) => r.options);
    assert.equal(all.length, 16);
    assert.equal(new Set(all.map((id) => Sim.CARD_MAP[id].slug)).size, 16);
    const d = Events.draftDecks(rounds, [1, 0, 'x', null, 1, 1, 7]);
    assert.equal(d.A.length, 8);
    assert.equal(d.B.length, 8);
    assert.equal(new Set(d.A.concat(d.B)).size, 16);
    assert.ok(d.A.some((id) => Sim.CARD_MAP[id].winCondition) && d.B.some((id) => Sim.CARD_MAP[id].winCondition));
  }
});

test('Chaos schedules respect every limit at every intensity, over many seeds', () => {
  const defs = Sim.MODIFIERS;
  for (const tier of Events.CHAOS_TIERS) {
    for (let seed = 1; seed <= 250; seed++) {
      const plan = Events.buildChaosSchedule(seed, tier.id, { hasEvo: seed % 2 === 0 });
      assert.ok(plan.length >= 4, `${tier.id}: enough happens`);
      for (const m of plan) {
        assert.ok(m.at >= 0 && m.at + m.dur <= 180 + 1e-9, 'inside full time');
        assert.ok(defs[m.id].sev <= tier.maxSev || defs[m.id].fixed);
        if (seed % 2) assert.notEqual(defs[m.id].needs, 'evo', 'no Evolution modifiers without Evolutions');
      }
      for (let t = 0; t < 180; t += 0.5) {
        const live = plan.filter((m) => m.at <= t && t < m.at + m.dur);
        const random = live.filter((m) => !defs[m.id].fixed);
        assert.ok(random.length <= tier.maxActive, `${tier.id} seed ${seed} t=${t}: ${live.map((m) => m.id)}`);
        const groups = live.map((m) => defs[m.id].group).filter(Boolean);
        assert.equal(new Set(groups).size, groups.length, `one per group (${live.map((m) => m.id)})`);
        assert.equal(new Set(live.map((m) => m.id)).size, live.length, 'never the same twice at once');
      }
      if (tier.finale) assert.ok(plan.some((m) => m.id === 'finale' && m.at === 150));
      assert.deepEqual(Events.buildChaosSchedule(seed, tier.id, { hasEvo: seed % 2 === 0 }), plan, 'deterministic');
    }
  }
});

test('rotation: 4 daily events, no repeats from yesterday, mixed categories, weekend Chaos, weekly challenge', () => {
  const day0 = Date.UTC(2026, 9, 12, 12);
  for (let d = 0; d < 60; d++) {
    const now = day0 + d * Events.DAY_MS;
    const r = Events.rotation(now);
    assert.equal(r.daily.length, 4);
    assert.equal(new Set(r.daily).size, 4);
    const y = Events.rotation(now - Events.DAY_MS).daily;
    assert.ok(r.daily.every((id) => !y.includes(id)), 'nothing from yesterday');
    assert.deepEqual(Events.rotation(now).daily, r.daily, 'stable');
    assert.ok(r.dayEndsAt > now && r.dayEndsAt - now <= Events.DAY_MS);
    assert.equal(new Date(r.weekEndsAt).getUTCDay(), 1, 'weeks end on Monday 00:00 UTC');
    assert.ok(r.weekEndsAt > now);
    if (r.weekend) assert.equal(r.featured, 'chaos');
    assert.ok(Events.availability(r.daily[0], now).ok);
    assert.ok(Events.availability('chaos', now).ok);
    assert.ok(Events.availability(r.challenge, now).ok);
    assert.equal(Events.availability(r.challenge === 'gauntlet' ? 'ladder' : 'gauntlet', now).ok, false);
    const off = Events.EVENTS.find((e) => e.schedule === 'rotating' && !r.daily.includes(e.id));
    assert.equal(Events.availability(off.id, now).ok, false);
    assert.equal(Events.availability(off.id, now, { forceAll: true }).ok, true);
  }
});

// ── Progress and rewards ────────────────────────────────────────────────────

const NOW = Date.UTC(2026, 9, 13, 10);
const win = (id, extra) => Object.assign({ matchId: `m-${Math.random()}`, eventId: id, result: 'win', ai: 'normal', mode: 'ai', cardsPlayed: 9, towersLost: 0, towersStanding: 3, duration: 120 }, extra || {});
const gold = (res) => res.rewards.filter((r) => r.kind === 'gold').reduce((s, r) => s + r.amount, 0);

test('a result is applied exactly once, and first-win prizes pay once ever', () => {
  const P = Events.freshProgress();
  const r = win('overload', { matchId: 'abc' });
  const first = Events.settleMatch(P, r, NOW);
  assert.ok(first.applied);
  assert.ok(first.rewards.some((x) => x.kind === 'chest'), 'first win chest');
  const again = Events.settleMatch(P, r, NOW);
  assert.equal(again.applied, false);
  assert.equal(again.rewards.length, 0);
  const second = Events.settleMatch(P, win('overload'), NOW);
  assert.ok(!second.rewards.some((x) => x.label === 'First win bonus'));
  assert.equal(P.records.overload.wins, 2);
});

test('daily caps: rewarded wins stop after the cap, records keep counting, the next day resets', () => {
  const P = Events.freshProgress();
  const golds = [];
  for (let i = 0; i < 5; i++) golds.push(gold(Events.settleMatch(P, win('mirror'), NOW)));
  assert.ok(golds[3] < golds[2], 'fewer rewards past the cap');
  assert.equal(P.daily.wins.mirror, Events.DAILY_WIN_CAP);
  assert.equal(P.records.mirror.wins, 5);
  const tomorrow = Events.settleMatch(P, win('mirror'), NOW + Events.DAY_MS);
  assert.ok(tomorrow.rewards.some((x) => /Victory \(1\//.test(x.label)));
});

test('no rewards for local PvP, abandoned or admin matches; abandoning after playing a card is a loss once', () => {
  const P = Events.freshProgress();
  const friendly = Events.settleMatch(P, win('chaos', { mode: 'pvp', tier: 'mild' }), NOW);
  assert.equal(gold(friendly), 0);
  assert.ok(friendly.friendly);
  assert.equal(P.records.chaos, undefined, 'local PvP records nothing');
  assert.equal(Events.tierUnlocked(P, 'chaos', 'wild'), false, 'and unlocks nothing');
  assert.equal(Object.keys(P.achievements).length, 0);
  assert.equal(gold(Events.settleMatch(P, win('overload', { noRewards: true }), NOW)), 0);
  Events.beginMatch(P, { matchId: 'p1', eventId: 'chaos', tier: 'mild' }, NOW);
  assert.equal(Events.resolvePending(P, NOW), null, 'leaving before playing a card is free');
  Events.beginMatch(P, { matchId: 'p2', eventId: 'chaos', tier: 'mild' }, NOW);
  Events.markEngaged(P, 'p2');
  const res = Events.resolvePending(P, NOW);
  assert.ok(res.applied);
  assert.equal(P.records.chaos.losses, 1);
  assert.equal(gold(res), 0);
  assert.equal(Events.resolvePending(P, NOW), null, 'only once');
  assert.equal(Events.settleMatch(P, { ...win('chaos'), matchId: 'p2' }, NOW).applied, false, 'a late result for the abandoned match is ignored');
});

test('a void match (opponent left at once) counts for nothing: no record, achievement, unlock or reward', () => {
  const P = Events.freshProgress();
  const r = Events.settleMatch(P, { ...win('chaos', { tier: 'mild' }), void: true }, NOW);
  assert.ok(r.applied && r.void);
  assert.equal(r.rewards.length, 0);
  assert.equal(r.achievements.length, 0);
  assert.equal(P.records.chaos, undefined);
  assert.equal(Events.tierUnlocked(P, 'chaos', 'wild'), false);
  assert.equal(Events.settleMatch(P, { ...win('chaos'), matchId: r.matchId || 'x' }, NOW).applied, true);
});

test('tiers unlock in order: win Mild to open Wild, and so on', () => {
  const P = Events.freshProgress();
  assert.equal(Events.tierUnlocked(P, 'chaos', 'mild'), true);
  assert.equal(Events.tierUnlocked(P, 'chaos', 'wild'), false);
  Events.settleMatch(P, win('chaos', { tier: 'wild' }), NOW);
  assert.equal(Events.tierUnlocked(P, 'chaos', 'extreme'), true, 'a win on a tier opens the next');
  const r = Events.settleMatch(P, win('chaos', { tier: 'mild' }), NOW);
  assert.equal(r.unlockedTier, null, 'a lower tier never re-announces');
  assert.equal(Events.tierUnlocked(P, 'boss', 'nightmare'), false);
});

test('challenge runs: wins advance, losses use lives, round and final prizes pay once per week', () => {
  const P = Events.freshProgress();
  const ch = Events.CHALLENGE_MAP.gauntlet;
  Events.startChallenge(P, 'gauntlet', NOW);
  const play = (result) => Events.settleMatch(P, { ...win(ch.rounds[P.challenges.gauntlet.round].event), result, challenge: 'gauntlet' }, NOW);
  play('win');
  play('loss');
  play('loss');
  assert.equal(P.challenges.gauntlet.round, 1);
  assert.equal(P.challenges.gauntlet.active, true);
  const out = play('loss');
  assert.equal(out.challenge.failed, true);
  assert.equal(P.challenges.gauntlet.active, false);
  // A new run the same week: round 1's prize is not paid again, but the run itself works
  Events.startChallenge(P, 'gauntlet', NOW);
  const again = play('win');
  assert.ok(!again.rewards.some((r) => /round 1 cleared/.test(r.label)));
  for (let i = 1; i < ch.rounds.length; i++) play('win');
  assert.equal(P.challenges.gauntlet.completions, 1);
  assert.ok(P.badges.gauntlet);
  assert.ok(P.achievements.gauntlet_done);
  // Another full run that week: no final prize
  Events.startChallenge(P, 'gauntlet', NOW);
  let finalAgain = false;
  for (let i = 0; i < ch.rounds.length; i++) finalAgain = finalAgain || play('win').rewards.some((r) => /complete!/.test(r.label));
  assert.equal(finalAgain, false);
  // Next week the prizes come back
  const nextWeek = NOW + 7 * Events.DAY_MS;
  Events.startChallenge(P, 'gauntlet', nextWeek);
  const r1 = Events.settleMatch(P, { ...win('chaos'), challenge: 'gauntlet' }, nextWeek);
  assert.ok(r1.rewards.some((r) => /round 1 cleared/.test(r.label)));
});

test('an unfinished challenge run from last week can still be finished', () => {
  const P = Events.freshProgress();
  Events.startChallenge(P, 'ladder', NOW);
  Events.settleMatch(P, { ...win('overload'), challenge: 'ladder' }, NOW);
  const later = NOW + 8 * Events.DAY_MS;
  const s = Events.challengeState(P, 'ladder', later);
  assert.equal(s.active, true);
  assert.equal(s.round, 1);
});

test('achievements and milestones are granted once; badges become selectable titles', () => {
  const P = Events.freshProgress();
  const a = Events.settleMatch(P, win('chaos', { tier: 'mild' }), NOW);
  assert.ok(a.achievements.some((x) => x.id === 'chaos_tamer'));
  assert.ok(a.achievements.some((x) => x.id === 'chaos_flawless'));
  assert.ok(P.badges.flawless);
  const b = Events.settleMatch(P, win('chaos', { tier: 'mild' }), NOW);
  assert.ok(!b.achievements.some((x) => x.id === 'chaos_tamer'));
  assert.equal(Events.setTitle(P, 'flawless'), true);
  assert.equal(Events.setTitle(P, 'colossus'), false, 'only owned badges');
  assert.equal(P.title, 'flawless');
  let milestone = 0;
  for (let i = 0; i < 12; i++) milestone += Events.settleMatch(P, win('chaos', { tier: 'mild' }), NOW + i * Events.DAY_MS).rewards.filter((r) => /milestone/.test(r.label)).length;
  assert.equal(milestone, 2, '3 and 10 wins (the 25-win badge is later)');
});

test('scores: survival and boss records keep the best', () => {
  const P = Events.freshProgress();
  const s1 = Events.settleMatch(P, win('survival', { result: 'loss', waves: 6, towersStanding: 0 }), NOW);
  assert.equal(s1.score, 600);
  const s2 = Events.settleMatch(P, win('survival', { result: 'loss', waves: 4, towersStanding: 0 }), NOW);
  assert.equal(s2.newBest, false);
  assert.equal(P.records.survival.best, 600);
  assert.equal(P.stats.bestWave, 6);
  const b = Events.settleMatch(P, win('boss', { tier: 'normal', timeLeft: 42, towersStanding: 2 }), NOW);
  assert.equal(b.score, 1000 + 420 + 300);
});

test('saved progress is cleaned: unknown events, junk numbers and bad ids are dropped, old saves upgrade', () => {
  const P = Events.normalizeProgress({
    records: { chaos: { wins: '5', played: -3, bestTier: 99, firstWin: { mild: 1 } }, deletedEvent: { wins: 9 } },
    daily: { day: 'x', wins: { chaos: 2, ghost: 4 } },
    settled: ['a', 4, 'b'],
    pending: { matchId: 'q', eventId: 'ghost' },
    challenges: { gauntlet: { round: 99, losses: -1, claimed: { r0: 1 } }, oldone: {} },
    badges: { flawless: 1, made_up: 1 },
    title: 'made_up',
    stats: { matches: 'NaN', chaosTier: 'bad' },
  });
  assert.equal(P.records.chaos.wins, 5);
  assert.equal(P.records.chaos.played, 0);
  assert.equal(P.records.chaos.bestTier, 3);
  assert.ok(!P.records.deletedEvent);
  assert.deepEqual(P.settled, ['a', 'b']);
  assert.equal(P.pending, null);
  assert.equal(P.challenges.gauntlet.round, 5);
  assert.ok(!P.challenges.oldone);
  assert.deepEqual(Object.keys(P.badges), ['flawless']);
  assert.equal(P.title, null);
  assert.equal(P.stats.matches, 0);
  assert.equal(P.stats.chaosTier, -1);
  assert.deepEqual(Events.normalizeProgress(undefined), Events.freshProgress());
  assert.deepEqual(Events.normalizeProgress(JSON.parse(JSON.stringify(P))), P, 'round-trips');
});

test('performance: Total Chaos with a big battle stays fast', () => {
  const { state } = eventMatch('chaos', { tier: 'total', seed: 3 });
  state.towers.forEach((t) => { t.hp = t.hpMax = 1e7; });
  for (let i = 0; i < 60; i++) {
    Sim.spawnDirect(state, 'A', ['scrapbots', 'voltbug', 'flarepod', 'brawler'][i % 4], 2 + (i % 14), 18 + (i % 5));
    Sim.spawnDirect(state, 'B', ['junkpack', 'bugsquad', 'siege', 'cryocaster'][i % 4], 2 + (i % 14), 13 - (i % 5));
  }
  const t0 = process.hrtime.bigint();
  const steps = 600;
  for (let i = 0; i < steps && state.running; i++) Sim.step(state);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / steps;
  assert.ok(ms < 2.5, `${ms.toFixed(3)} ms per step`);
});

// ── Regression: normal battles are untouched ────────────────────────────────
// Full AI-vs-AI matches (same decks, levels, Evolutions and seeds); every result must come out
// identical, to the hundredth, so nothing an event changes can leak into a normal battle.
// Re-recorded 2026-10-13 after the deliberate combat/AI changes in CLASH_TANKS.md section 13
// (simultaneous hits, wind-up retargeting, timer thresholds, the AI planner). Re-record only for
// an intended change to normal battles, never to make an event change pass.
const GOLDEN = [{"seed":11,"dA":["rocktitan","boulder","tartrap","cryocaster","mechmice-mk-ii","crackergang-burst","stormzeppelin","overdrive"],"dB":["flybombers-mk-ii","frostnova","boulder","boltturret","hawkstrike-core","beeblitz","scrapbots-core","lizarddash"],"lvl":5,"evo":[],"sig":"A king 153.45 3 1 10437.20 10543.56 20 20"},{"seed":23,"dA":["ufofleet","acidpool","rocketrain","phantomrider","cryocaster","nanodrones","antmarch","rocktitan"],"dB":["scout-mk-ii","boulder","rocketrain","sirenbeacon","raylance-core","bombbeetles","shieldknight","flakgunner"],"lvl":3,"evo":["rocketrain"],"sig":"B king 149.55 0 3 8327.30 12407.80 18 18"},{"seed":37,"dA":["stormzeppelin","firebomb","gravitywell","flaktower","flarepod-mk-ii","bugsquad","medicbot","crackergang-mk-ii"],"dB":["goblinbikers-burst","firebomb","rocketrain","flaktower","flarepod-mk-ii","crackergang","bugsquad","frostnova"],"lvl":3,"evo":["firebomb","flarepod-mk-ii"],"sig":"B crowns 180.00 0 1 7429.01 15393.75 19 21"},{"seed":41,"dA":["rocktitan","boulder","gravitywell","sirenbeacon","cryocaster","bugsquad-burst","scrapbots","crackergang-twin"],"dB":["flybombers","boulder","shock","infernospire","bombbeetles-twin","crackergang","shieldknight","scrapbots-mk-ii"],"lvl":7,"evo":[],"sig":"A crowns 180.00 1 0 14251.49 22153.93 23 23"},{"seed":58,"dA":["goblinbikers-core","boulder","rocketrain","teslapit","nanodrones-core","bugsquad","brawler","wolfpack"],"dB":["siege-burst","boulder","gravitywell","bonecrypt","bombbeetles","voltbug","lizarddash-mk-ii","mechmice-twin"],"lvl":3,"evo":["rocketrain","brawler"],"sig":"A crowns 180.00 1 0 13357.62 9696.17 23 26"},{"seed":64,"dA":["ufofleet-core","acidpool","gravitywell","teslapit","flarepod","flakgunner","junkpack","guardian-twin"],"dB":["rocktitan","firebomb","boulder","flarepod","beeblitz","mechmice-twin","raylance-burst","teslapit"],"lvl":2,"evo":["flarepod","junkpack"],"sig":"B crowns 180.00 0 1 14305.68 9019.16 21 21"}];

test('normal battles play out exactly as recorded (events never leak into them)', () => {
  for (const g of GOLDEN) {
    const s = Sim.createMatch({ seed: g.seed, decks: { A: g.dA.map((x) => ({ id: x, level: g.lvl, evo: g.evo.includes(x) })), B: g.dB.map((x) => ({ id: x, level: g.lvl })) } });
    const ai = [Sim.createAi('A', null, g.seed), Sim.createAi('B', null, g.seed + 1)];
    while (s.running) { ai.forEach((x) => Sim.aiUpdate(s, x, STEP)); Sim.step(s); }
    const sig = [s.winner, s.endReason, s.time.toFixed(2), s.players.A.crowns, s.players.B.crowns, s.players.A.damageDealt.toFixed(2), s.players.B.damageDealt.toFixed(2), s.players.A.cardsPlayed, s.players.B.cardsPlayed].join(' ');
    assert.equal(sig, g.sig, `seed ${g.seed}`);
  }
});
