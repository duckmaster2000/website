'use strict';

// Card Evolutions: the cycle mechanic and every Evolution's ability. Run with: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const Sim = require('../shared/clash-sim');

const STEP = Sim.MATCH.step;
function run(state, seconds, each) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps && state.running; i++) {
    Sim.step(state);
    if (each && each(state) === false) break;
  }
}
function sandbox(decks) {
  const s = Sim.createMatch({ seed: 7, decks });
  s.towers.forEach((t) => { t.active = false; t.hp = t.hpMax = 1e6; });
  return s;
}
// Deck with `evoIds` equipped; the given card first so it's in hand
const deck = (first, evoIds) => {
  const ids = [first, ...['scout', 'brawler', 'siege', 'guardian', 'voltbug', 'drillcat', 'ramhog', 'flarepod'].filter((x) => x !== first)].slice(0, 8);
  return ids.map((id) => ({ id, evo: (evoIds || [first]).includes(id) }));
};
// Play a card for side A over and over (cycling it straight back to hand) and return each result
function playRepeatedly(s, cardId, times, x, y) {
  const out = [];
  const p = s.players.A;
  for (let i = 0; i < times; i++) {
    p.elixir = 10;
    p.cooldowns[cardId] = 0;
    if (!p.hand.includes(cardId)) p.hand[0] = cardId;
    out.push(Sim.deploy(s, 'A', cardId, x, y));
  }
  return out;
}
const freeze = (u) => { u.speed = 0.0001; u.dmg = 0.0001; };
// Spawn an evolved unit directly (tests of the ability itself)
function spawnEvo(s, side, id, x, y) {
  const base = Sim.getCardStatsAtLevel(id, 1, false, 0);
  const s2 = Sim.evolvedStats(base);
  const u = Sim.spawnDirect(s, side, id, x, y);
  Object.assign(u, { evo: s2.evoSlug, em: s2.evo.mech || null, hp: s2.hpScaled, hpMax: s2.hpScaled, dmg: s2.dmgScaled });
  return u;
}

test('every Evolution is complete: name, cycles, ability text, counterplay, and a real mechanic', () => {
  const ids = Object.keys(Sim.EVOLUTIONS);
  assert.ok(ids.length >= 12);
  const roles = new Set();
  for (const slug of ids) {
    const e = Sim.EVOLUTIONS[slug];
    assert.ok(Sim.CARD_MAP[slug], `${slug} is a card`);
    assert.ok(e.name && e.ability && e.desc.length > 30 && e.counter.length > 20, slug);
    assert.ok(e.cycles >= 1 && e.cycles <= 3, `${slug} cycles`);
    assert.ok(e.mech || e.spell, `${slug} changes behaviour`);
    roles.add(e.role);
  }
  ['melee', 'tank', 'ranged', 'swarm', 'air', 'building', 'spell', 'support'].forEach((r) => assert.ok(roles.has(r), `has a ${r} evolution`));
  // Variants share their family's Evolution
  assert.equal(Sim.evolutionOf('brawler-twin'), Sim.EVOLUTIONS.brawler);
  assert.equal(Sim.evolutionOf('scout'), null);
});

test('decks keep evo flags only for cards with an Evolution, and never more than the slot limit', () => {
  const d = Sim.normalizeDeck([{ id: 'brawler', evo: true }, { id: 'scout', evo: true }, { id: 'voltbug', evo: true }, { id: 'siege', evo: true }, 'guardian']);
  assert.deepEqual(d.filter((e) => e.evo).map((e) => e.id), ['brawler', 'voltbug']);
  assert.equal(Sim.normalizeDeck([{ id: 'brawler', evo: true }], 0)[0].evo, false, 'a 0-slot mode disables evolutions');
  assert.equal(Sim.normalizeDeck([{ id: 'brawler', evo: true }], 9).filter((e) => e.evo).length, 1);
});

test('cycle: the card evolves on the play after its required cycles, then resets and charges again', () => {
  const s = sandbox({ A: deck('brawler') });
  const need = Sim.EVOLUTIONS.brawler.cycles;
  const results = playRepeatedly(s, 'brawler', need * 2 + 2, 9, 24);
  const pattern = results.map((r) => (r.ok ? (r.evolved ? 'E' : 'n') : 'x'));
  // need=2: n n E n n E ...
  const expect = [];
  for (let i = 0; i < pattern.length; i++) expect.push((i + 1) % (need + 1) === 0 ? 'E' : 'n');
  assert.deepEqual(pattern, expect);
  assert.ok(s.units.some((u) => u.evo === 'brawler'));
  assert.ok(s.units.some((u) => !u.evo), 'normal plays stay normal');
  // The snapshot shows the charge to both players
  const snap = Sim.snapshot(s);
  assert.deepEqual(snap.players.A.evo.brawler, [s.players.A.evo.brawler.charge, need]);
  assert.equal(snap.players.A.evoPlayed, 2);
});

test('cycle: failed plays (no elixir, bad spot, recharging, not in hand, match over) never advance it', () => {
  const s = sandbox({ A: deck('voltbug') });
  const p = s.players.A;
  p.elixir = 0;
  assert.equal(Sim.deploy(s, 'A', 'voltbug', 9, 24).ok, false);
  p.elixir = 10;
  assert.equal(Sim.deploy(s, 'A', 'voltbug', 9, 8).ok, false, 'enemy side');
  assert.equal(Sim.deploy(s, 'A', 'voltbug', 3.5, 25.5).ok, false, 'on a tower');
  assert.equal(p.evo.voltbug.charge, 0);
  assert.equal(Sim.deploy(s, 'A', 'voltbug', 9, 24).ok, true);
  assert.equal(p.evo.voltbug.charge, 1);
  assert.equal(Sim.deploy(s, 'A', 'voltbug', 9, 24).ok, false, 'card cycled out / recharging');
  assert.equal(p.evo.voltbug.charge, 1);
  // Ready, then the match ends: still ready, nothing consumed
  s.running = false;
  p.hand[0] = 'voltbug'; p.cooldowns.voltbug = 0;
  assert.equal(Sim.deploy(s, 'A', 'voltbug', 9, 24).ok, false);
  assert.equal(p.evo.voltbug.charge, 1);
  // Unequipped cards never evolve
  const t = sandbox({ A: deck('brawler', []) });
  assert.ok(playRepeatedly(t, 'brawler', 6, 9, 24).every((r) => r.ok && !r.evolved));
  // A new match starts uncharged
  assert.equal(Sim.createMatch({ decks: { A: deck('brawler') } }).players.A.evo.brawler.charge, 0);
});

test('two equipped Evolutions charge independently', () => {
  const s = sandbox({ A: deck('voltbug', ['voltbug', 'drillcat']) });
  playRepeatedly(s, 'voltbug', 1, 9, 24);
  const r = playRepeatedly(s, 'drillcat', 2, 9, 24);
  assert.deepEqual(r.map((x) => x.evolved), [false, true]);
  assert.equal(s.players.A.evo.voltbug.charge, 1);
  assert.equal(s.players.A.evo.drillcat.charge, 0);
  assert.equal(playRepeatedly(s, 'voltbug', 1, 9, 24)[0].evolved, true);
});

test('Juggernaut: every 3rd punch makes a knockback quake around its target', () => {
  const s = sandbox();
  const jug = spawnEvo(s, 'A', 'brawler', 9, 24);
  const victim = Sim.spawnDirect(s, 'B', 'brawler', 9, 22.6);
  const bystander = Sim.spawnDirect(s, 'B', 'scrapbots', 10.2, 22.2);
  [victim, bystander].forEach((u) => { freeze(u); u.hp = u.hpMax = 1e5; });
  let quakes = 0;
  run(s, 6, () => { quakes = Math.max(quakes, Math.floor(jug.evoHits / 3)); return true; });
  assert.ok(quakes >= 1);
  assert.ok(bystander.hp < bystander.hpMax, 'splash reaches the bystander');
  // A normal brawler never splashes
  const n = sandbox();
  Sim.spawnDirect(n, 'A', 'brawler', 9, 24);
  const v2 = Sim.spawnDirect(n, 'B', 'brawler', 9, 22.6);
  const b2 = Sim.spawnDirect(n, 'B', 'scrapbots', 10.2, 22.2);
  [v2, b2].forEach((u) => { freeze(u); u.hp = u.hpMax = 1e5; });
  run(n, 6);
  assert.equal(b2.hp, b2.hpMax);
});

test('Diamond Drill: consecutive hits stack, and a stun resets the stack', () => {
  const s = sandbox();
  const drill = spawnEvo(s, 'A', 'drillcat', 9, 24);
  const tank = Sim.spawnDirect(s, 'B', 'siege', 9, 22.8);
  freeze(tank); tank.hp = tank.hpMax = 1e6;
  run(s, 8);
  assert.equal(drill.stack, 3, 'maxed');
  Sim.castDirect(s, 'B', 'shock', drill.x, drill.y);
  Sim.step(s);
  assert.equal(drill.stack, 0);
});

test('Bastion: shields its nearest allies (not itself, never the enemy), up to its limit and amount', () => {
  const s = sandbox();
  const bastion = spawnEvo(s, 'A', 'guardian', 9, 24);
  const allies = [];
  for (let i = 0; i < 8; i++) allies.push(Sim.spawnDirect(s, 'A', 'antmarch', 8 + (i % 4) * 0.7, 25 + Math.floor(i / 4) * 0.7));
  const foe = Sim.spawnDirect(s, 'B', 'brawler', 10, 24);
  [...allies, foe].forEach(freeze);
  bastion.speed = 0.0001;
  run(s, 0.2);
  const shielded = allies.filter((a) => a.shield > 0).length;
  assert.equal(shielded, Sim.EVOLUTIONS.guardian.mech.allyShield.max);
  assert.equal(bastion.shield || 0, 0, 'never shields itself');
  assert.equal(foe.shield || 0, 0);
  run(s, 15);
  assert.ok(allies.every((a) => (a.shield || 0) <= Sim.EVOLUTIONS.guardian.mech.allyShield.amount));
});

test('Earthshaker: shells leave slowing craters (ground only, enemies only)', () => {
  const s = sandbox();
  spawnEvo(s, 'A', 'siege', 9, 26);
  const turret = Sim.spawnDirect(s, 'B', 'boltturret', 9, 21);
  turret.hp = turret.hpMax = 1e5; turret.dmg = 0.0001;
  const walker = Sim.spawnDirect(s, 'B', 'brawler', 9.6, 21.8);
  freeze(walker); walker.targets = 'none';
  let crater = false;
  run(s, 6, () => { if (s.zones.some((z) => z.kind === 'slow' && z.evo)) crater = true; return true; });
  assert.ok(crater);
  assert.ok(walker.slowT > 0 || walker.slowMult < 1);
});

test('Storm Bug: lightning reaches more enemies and jolts the first target', () => {
  const count = (evo) => {
    const s = sandbox();
    (evo ? spawnEvo : (a, b, c, d, e) => Sim.spawnDirect(a, b, c, d, e))(s, 'A', 'voltbug', 9, 26);
    const foes = [];
    for (let i = 0; i < 6; i++) foes.push(Sim.spawnDirect(s, 'B', 'scrapbots', 9 + Math.cos(i * 1.047) * 1.1, 21 + Math.sin(i * 1.047) * 1.1));
    foes.forEach((u) => { freeze(u); u.hp = u.hpMax = 1e5; });
    let stunned = false;
    run(s, 1.8, () => { if (foes.some((u) => u.stunT > 0)) stunned = true; return true; });
    return { hurt: foes.filter((u) => u.hp < u.hpMax).length, stunned };
  };
  const normal = count(false);
  const evo = count(true);
  assert.equal(normal.hurt, 3);
  assert.equal(evo.hurt, 1 + Sim.EVOLUTIONS.voltbug.mech.chain.count);
  assert.ok(evo.stunned && !normal.stunned);
});

test('Prism Lance: pierces every enemy in its line (air and ground) once each', () => {
  const s = sandbox();
  spawnEvo(s, 'A', 'raylance', 9, 27);
  const line = [22, 23.2, 24.4].map((y) => Sim.spawnDirect(s, 'B', 'brawler', 9, y));
  const flyer = Sim.spawnDirect(s, 'B', 'nanodrones', 9, 21);
  const offLine = Sim.spawnDirect(s, 'B', 'brawler', 13, 23);
  [...line, flyer, offLine].forEach((u) => { freeze(u); u.hp = u.hpMax = 1e5; });
  run(s, 1.2);
  const dealt = line.map((u) => u.hpMax - u.hp);
  assert.ok(dealt.every((d) => d > 0), `line ${dealt}`);
  assert.ok(flyer.hp < flyer.hpMax, 'air is hit too');
  assert.equal(offLine.hp, offLine.hpMax);
  // A single shot hits each enemy once: never more than one full + falloff per shot
  const dmg = Sim.CARD_MAP.raylance.dmg;
  assert.ok(Math.max(...dealt) <= dmg * 2 + 1);
});

test('Cluster Pod: bomblets scatter, and no enemy is hit by more than one bomblet per shot', () => {
  const s = sandbox();
  const pod = spawnEvo(s, 'A', 'flarepod', 9, 27);
  const pile = [];
  for (let i = 0; i < 5; i++) pile.push(Sim.spawnDirect(s, 'B', 'brawler', 8.6 + (i % 3) * 0.4, 22 + Math.floor(i / 3) * 0.4));
  pile.forEach((u) => { freeze(u); u.hp = u.hpMax = 1e5; });
  pod.cd = 99; pod.atkCd = 0;
  let bomblets = 0;
  run(s, 3, () => { bomblets = Math.max(bomblets, s.projectiles.filter((p) => p.style === 'bomblet').length); return true; });
  assert.equal(bomblets, Sim.EVOLUTIONS.flarepod.mech.cluster.count);
  const main = pod.dmg;
  const cap = main + main * Sim.EVOLUTIONS.flarepod.mech.cluster.dmgMult + 1; // the fireball + at most one bomblet
  pile.forEach((u) => assert.ok(u.hpMax - u.hp <= cap, `one bomblet max (${(u.hpMax - u.hp).toFixed(0)} <= ${cap.toFixed(0)})`));
});

test('Scrap Rally: survivors speed up when packmates fall, capped at 2 stacks', () => {
  const s = sandbox({ A: deck('junkpack') });
  s.players.A.evo.junkpack.charge = s.players.A.evo.junkpack.need;
  const r = playRepeatedly(s, 'junkpack', 1, 9, 26)[0];
  assert.ok(r.evolved && r.units.length === 3 && r.units.every((u) => u.pack === r.units[0].pack));
  run(s, 1.2);
  r.units[0].hp = 0;
  Sim.step(s);
  const per = Sim.EVOLUTIONS.junkpack.mech.rally.per;
  assert.ok(Math.abs(r.units[1].rally - per) < 1e-9);
  r.units[1].hp = 0;
  Sim.step(s);
  assert.ok(Math.abs(r.units[2].rally - per * 2) < 1e-9);
  // Another pack's deaths don't count
  const other = Sim.spawnDirect(s, 'A', 'junkpack', 5, 26);
  other.hp = 0;
  Sim.step(s);
  assert.ok(Math.abs(r.units[2].rally - per * 2) < 1e-9, 'capped and unaffected by other packs');
});

test('Dive Hawks: an opening dive for 2.5x, then a 4 s climb before the next', () => {
  const s = sandbox();
  const hawk = spawnEvo(s, 'A', 'hawkstrike', 9, 24);
  const foe = Sim.spawnDirect(s, 'B', 'brawler', 9, 23);
  freeze(foe); foe.hp = foe.hpMax = 1e5;
  const hits = [];
  let last = foe.hp;
  run(s, 6, () => { if (foe.hp < last) { hits.push(last - foe.hp); last = foe.hp; } return true; });
  const base = Sim.CARD_MAP.hawkstrike.dmg;
  assert.ok(Math.abs(hits[0] - base * 2.5) < 1, `dive ${hits[0]}`);
  assert.ok(Math.abs(hits[1] - base) < 1, 'then normal hits');
  assert.ok(hits.filter((h) => h > base * 2).length <= 2, 'at most one dive per 4 s');
});

test('Arc Turret: every 4th shot pulses, knocking back ground troops but not air', () => {
  const s = sandbox();
  const turret = spawnEvo(s, 'A', 'boltturret', 9, 24);
  const g = Sim.spawnDirect(s, 'B', 'brawler', 9, 22.2);
  const air = Sim.spawnDirect(s, 'B', 'nanodrones', 10, 23);
  [g, air].forEach((u) => { freeze(u); u.hp = u.hpMax = 1e5; });
  air.targets = 'none';
  const y0 = g.y;
  run(s, 4.5);
  assert.ok(turret.evoHits >= 4);
  assert.ok(g.y < y0 - 0.3, 'pushed away');
  assert.equal(air.hp, air.hpMax, 'pulse is ground-only');
});

test('Crypt of Legions: a Bone Giant replaces the 3 death skeletons; a normal crypt is unchanged', () => {
  const s = sandbox();
  const crypt = spawnEvo(s, 'A', 'bonecrypt', 9, 26);
  run(s, 0.1);
  const skel = () => s.units.filter((u) => u.cardId === 'cryptskel').length;
  const before = skel();
  crypt.hp = 0;
  Sim.step(s);
  assert.equal(s.units.filter((u) => u.cardId === 'bonegiant').length, 1);
  assert.equal(skel(), before);
  // Tokens never evolve or chain further
  assert.ok(s.units.filter((u) => u.cardId === 'bonegiant').every((u) => !u.evo));
});

test('Field Surgeon: removes slows from allies and triages the badly hurt', () => {
  const s = sandbox();
  spawnEvo(s, 'A', 'medicbot', 9, 24);
  const ally = Sim.spawnDirect(s, 'A', 'brawler', 9.5, 25);
  freeze(ally);
  ally.slowT = 5; ally.slowMult = 0.5;
  ally.hp = 50;
  run(s, 1.1);
  assert.equal(ally.slowT, 0);
  const healed = ally.hp - 50;
  const n = sandbox();
  Sim.spawnDirect(n, 'A', 'medicbot', 9, 24);
  const a2 = Sim.spawnDirect(n, 'A', 'brawler', 9.5, 25);
  freeze(a2); a2.hp = 50;
  run(n, 1.1);
  assert.ok(healed > (a2.hp - 50) * 1.5, `${healed} vs ${a2.hp - 50}`);
});

test('Napalm Bomb leaves burning ground that only hurts enemies', () => {
  const s = sandbox({ A: deck('firebomb') });
  const foe = Sim.spawnDirect(s, 'B', 'brawler', 9, 10);
  const mine = Sim.spawnDirect(s, 'A', 'brawler', 9.5, 10.3);
  [foe, mine].forEach((u) => { freeze(u); u.targets = 'none'; u.hp = u.hpMax = 1e5; });
  s.players.A.evo.firebomb.charge = 9;
  const r = playRepeatedly(s, 'firebomb', 1, 9, 10)[0];
  assert.ok(r.evolved);
  run(s, 1.5);
  const afterBlast = foe.hp;
  assert.ok(s.zones.some((z) => z.kind === 'dot' && z.evo));
  run(s, 3.5);
  assert.ok(foe.hp < afterBlast, 'burn ticks');
  assert.equal(mine.hp, mine.hpMax, 'no friendly fire');
});

test('Overload: a second pulse follows and stuns longer', () => {
  const s = sandbox({ A: deck('shock') });
  const foe = Sim.spawnDirect(s, 'B', 'brawler', 9, 10);
  freeze(foe); foe.hp = foe.hpMax = 1e5;
  s.players.A.evo.shock.charge = 9;
  playRepeatedly(s, 'shock', 1, 9, 10);
  Sim.step(s);
  const first = foe.hpMax - foe.hp;
  run(s, 1);
  const total = foe.hpMax - foe.hp;
  assert.ok(total > first * 1.4, `${first} then ${total}`);
  assert.ok(foe.stunT > 0.3);
});

test('Homing Barrage: rockets lock on to different enemies', () => {
  const s = sandbox({ A: deck('rocketrain') });
  const foes = [[7, 9], [10, 9.5], [9, 11], [11.5, 10.5]].map(([x, y]) => Sim.spawnDirect(s, 'B', 'brawler', x, y));
  foes.forEach((u) => { u.hp = u.hpMax = 1e5; u.dmg = 0.0001; u.speed = 0.6; });
  s.players.A.evo.rocketrain.charge = 9;
  playRepeatedly(s, 'rocketrain', 1, 9.5, 10);
  run(s, 3);
  assert.equal(foes.filter((u) => u.hp < u.hpMax).length, 4, 'every enemy got a rocket even while moving');
});

test('evolved troops still obey core rules: freeze, air targeting, invulnerable dashes, buildings expire', () => {
  const s = sandbox();
  const jug = spawnEvo(s, 'A', 'brawler', 9, 24);
  const flyer = Sim.spawnDirect(s, 'B', 'nanodrones', 9, 23);
  freeze(flyer); flyer.hp = flyer.hpMax = 1e5;
  run(s, 3);
  assert.equal(flyer.hp, flyer.hpMax, 'ground melee still cannot hit air');
  Sim.castDirect(s, 'B', 'frostnova', 9, 24);
  Sim.step(s);
  const hits = jug.evoHits;
  run(s, 2);
  assert.equal(jug.evoHits, hits, 'frozen: no punches');
  const t = sandbox();
  const turret = spawnEvo(t, 'A', 'boltturret', 9, 24);
  run(t, Sim.CARD_MAP.boltturret.lifetime + 1);
  assert.ok(!t.units.includes(turret), 'evolved buildings still expire');
});

test('heavy battle with every Evolution at once stays fast and stable', () => {
  const s = Sim.createMatch({ seed: 3 });
  const slugs = Object.keys(Sim.EVOLUTIONS).filter((k) => !Sim.CARD_MAP[k].spell);
  for (let i = 0; i < 3; i++) {
    slugs.forEach((id, k) => {
      spawnEvo(s, 'A', id, 1 + (k % 8) * 2, 20 + i + Math.floor(k / 8));
      spawnEvo(s, 'B', id, 1 + (k % 8) * 2, 12 - i - Math.floor(k / 8));
    });
  }
  ['firebomb', 'shock', 'rocketrain'].forEach((id) => {
    for (const side of ['A', 'B']) {
      const st = Sim.evolvedStats(Sim.getCardStatsAtLevel(id, 1, false, 0));
      Sim.castDirect(s, side, id, 9, side === 'A' ? 12 : 20);
      s.zones.length; // castDirect uses base stats; evolved spells are covered above
      void st;
    }
  });
  const t0 = Date.now();
  run(s, 30);
  const ms = Date.now() - t0;
  assert.ok(ms < 4000, `${ms} ms for 30 s of heavy battle`);
  assert.ok(s.units.length < 400, 'no runaway spawning');
  assert.ok(s.projectiles.length < 300);
  assert.ok(s.units.every((u) => Number.isFinite(u.x) && Number.isFinite(u.y) && u.hp <= u.hpMax + 1e-6));
});
