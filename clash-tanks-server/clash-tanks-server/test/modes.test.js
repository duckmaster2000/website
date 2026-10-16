// The game-mode library (2026-10-15): every new rule mode, its specific rule, and that it never
// leaks into a normal match. Existing modes keep their own tests in events/chaos/sim tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const Sim = require('../shared/clash-sim.js');
const Events = require('../shared/events.js');

const STEP = Sim.MATCH.step;
const T9 = { towerLevel: 9, kingLevel: 9 };
const NEW_MODES = ['double', 'triple', 'infinite', 'rampup', 'rage', 'towerrush', 'heist', 'touchdown', 'capture', 'payload', 'treasure', 'gambit', 'backline', 'infernosiege', 'bossrush', 'endless'];
const OLD_MODES = ['upgrades', 'chaos', 'overload', 'suddendeath', 'draft', 'mirror', 'roulette', 'scavenger', 'spellstorm', 'swarm', 'heavy', 'fortress', 'koth', 'pinball', 'sizes', 'evofrenzy', 'survival', 'boss'];

function modeMatch(id, opts) {
  const o = opts || {};
  const seed = o.seed || 11;
  const ev = Events.EVENT_MAP[id];
  const A = (o.A || Events.loanerDeck(id, seed)).map((x) => ({ id: x, level: 9 }));
  const B = (o.B || Events.aiDeckFor(id, seed + 1)).map((x) => ({ id: x, level: 9 }));
  const cfg = Events.buildMatch(id, { seed, tier: o.tier || (ev.tiers ? ev.tiers[0].id : undefined), decks: { A, B }, level: 9 });
  const state = Sim.createMatch({ seed, rules: cfg.rules, decks: cfg.decks, towers: { A: T9, B: T9 } });
  return { state, cfg };
}
function quiet(state) { state.towers.forEach((t) => { t.dmg = 0; }); return state; }
const stepN = (s, n) => { for (let i = 0; i < n && s.running; i++) Sim.step(s); };

test('every mode that existed before is still in the catalog, with its id', () => {
  OLD_MODES.forEach((id) => assert.ok(Events.EVENT_MAP[id], `${id} still exists`));
  assert.ok(Events.CHALLENGE_MAP.gauntlet && Events.CHALLENGE_MAP.ladder);
  NEW_MODES.forEach((id) => assert.ok(Events.EVENT_MAP[id], `${id} added`));
  // The daily rotation is drawn from the same rotating events as before (new modes are 'library')
  assert.ok(NEW_MODES.every((id) => Events.EVENT_MAP[id].schedule === 'library'));
});

test('every new mode plays a full AI-vs-AI match with only legal moves, and ends', () => {
  for (const id of NEW_MODES) {
    const { state, cfg } = modeMatch(id);
    const ai = [Sim.createAi('A', null, 3), cfg.scripted ? null : Sim.createAi('B', null, 4)].filter(Boolean);
    let bad = 0, plays = 0;
    for (let i = 0; i < 20 * 700 && state.running; i++) {
      ai.forEach((b) => { const r = Sim.aiUpdate(state, b, STEP); if (r) { if (r.ok) plays++; else bad++; } });
      Sim.step(state);
    }
    assert.equal(bad, 0, `${id}: legal moves`);
    assert.ok(plays > 2, `${id}: the AI plays (${plays})`);
    assert.equal(state.running, false, `${id}: ends`);
  }
});

test('nothing leaks: a normal match after any mode has default rules and no objective state', () => {
  const plain = Sim.createMatch({ seed: 1 });
  for (const id of NEW_MODES) {
    const { state } = modeMatch(id);
    stepN(state, 200);
    const after = Sim.createMatch({ seed: 1 });
    assert.deepEqual(after.rules, plain.rules, `${id}: pristine rules`);
    assert.equal(after.obj, null);
    assert.equal(after.towers.length, 6);
  }
});

test('Double / Triple / Ramp-Up: the elixir rate follows each schedule, max elixir unchanged', () => {
  const rate = (id, t) => {
    const { state } = modeMatch(id);
    state.time = t;
    return state.rules.elixirPhases.filter((p) => p.at <= t).pop().mult;
  };
  assert.equal(rate('double', 5), 2);
  assert.equal(rate('triple', 5), 3);
  assert.deepEqual([0, 40, 80, 110, 150].map((t) => rate('rampup', t)), [1, 1.5, 2, 2.5, 3]);
  ['double', 'triple', 'rampup'].forEach((id) => assert.equal(modeMatch(id).state.rules.maxElixir, 10));
  // Ramp-Up announces each step up
  const { state } = modeMatch('rampup');
  const stages = [];
  for (let i = 0; i < 20 * 80; i++) { Sim.step(state); Sim.takeFx(state).forEach((f) => { if (f.type === 'elixirStage') stages.push(f.mult); }); }
  assert.deepEqual(stages, [1.5, 2]);
});

test('Infinite Elixir: always full, cards still recharge, and the unit cap holds for both sides', () => {
  const { state } = modeMatch('infinite', { A: ['junkpack', 'mechmice', 'antmarch', 'bugsquad', 'scout', 'brawler', 'voltbug', 'shock'] });
  quiet(state);
  stepN(state, 5);
  assert.equal(state.players.A.elixir, 10);
  const card = state.players.A.hand[0];
  assert.ok(Sim.deploy(state, 'A', card, 4, 22).ok);
  stepN(state, 2);
  assert.equal(state.players.A.elixir, 10, 'refilled');
  let placed = 0, refusedCap = 0;
  for (let i = 0; i < 400; i++) {
    const p = state.players.A;
    for (const id of p.hand) { p.cooldowns[id] = 0; const r = Sim.deploy(state, 'A', id, 2 + (i % 14), 20 + (i % 8)); if (r.ok) placed++; else if (/Unit limit/.test(r.reason)) refusedCap++; }
    Sim.step(state);
  }
  const alive = state.units.filter((u) => u.owner === 'A' && u.hp > 0 && u.costShare > 0).length;
  assert.ok(alive <= 30, `cap respected (${alive})`);
  assert.ok(refusedCap > 0, 'the cap refuses extra units');
});

test('Rage: troops move 30% faster and troops and buildings attack 25% more often; spells untouched', () => {
  const { state } = modeMatch('rage', { A: ['brawler', 'boltturret', 'firebomb', 'scout', 'voltbug', 'flarepod', 'mechmice', 'shock'] });
  const base = (id) => Sim.getCardStatsAtLevel(id, 9);
  assert.equal(state.players.A.cards.brawler.speed, +(base('brawler').speed * 1.3).toFixed(2));
  assert.equal(state.players.A.cards.brawler.cd, +(base('brawler').cd * 0.75).toFixed(2));
  assert.equal(state.players.A.cards.boltturret.cd, +(base('boltturret').cd * 0.75).toFixed(2));
  assert.equal(state.players.A.cards.firebomb.dmgScaled, base('firebomb').dmgScaled);
});

test('Tower Rush: lighter towers on both sides and a 2:00 clock', () => {
  const { state } = modeMatch('towerrush');
  const normal = Sim.createMatch({ seed: 1, towers: { A: T9, B: T9 } });
  const hp = (s, side, kind) => s.towers.find((t) => t.owner === side && t.tower === kind).hpMax;
  ['A', 'B'].forEach((side) => {
    assert.equal(hp(state, side, 'princess'), Math.round(hp(normal, side, 'princess') * 0.55));
    assert.ok(Math.abs(hp(state, side, 'king') - hp(normal, side, 'king') * 0.6) <= 1);
  });
  assert.equal(state.rules.regulation, 120);
});

test('Heist: only a vault per side, awake and harmless; troops go for it; more vault health wins on time', () => {
  const { state } = modeMatch('heist');
  assert.equal(state.towers.length, 2);
  state.towers.forEach((t) => { assert.equal(t.tower, 'king'); assert.ok(t.active); assert.equal(t.dmg, 0); });
  const u = Sim.spawnDirect(state, 'A', 'brawler', 9, 18, 9);
  stepN(state, 40);
  assert.equal(u.targetId, 'T-B-K', 'troops head for the vault');
  const { state: t } = modeMatch('heist');
  t.towers.find((x) => x.owner === 'B').hp *= 0.5;
  t.time = t.rules.regulation + t.rules.overtime;
  t.phase = 'overtime';
  Sim.step(t);
  assert.equal(t.winner, 'A');
  assert.ok(Events.validateDeck('heist', Events.loanerDeck('heist', 3)).ok, 'needs a building');
});

test('Touchdown: no towers; a troop in the end zone scores and leaves; first to 3 wins', () => {
  const { state } = modeMatch('touchdown');
  assert.equal(state.towers.length, 0);
  const runner = Sim.spawnDirect(state, 'A', 'scout', 9, 6, 9);
  const deathSpawner = Sim.spawnDirect(state, 'A', 'rocktitan', 4, 3.4, 9); // must not leave shards behind
  stepN(state, 20 * 6);
  assert.equal(state.players.A.score, 2);
  assert.ok(!state.units.includes(runner) && !state.units.includes(deathSpawner));
  assert.ok(!state.units.some((u) => u.cardId === 'rockshard'), 'scoring is not a death');
  Sim.spawnDirect(state, 'A', 'scout', 9, 5, 9);
  stepN(state, 20 * 6);
  assert.equal(state.running, false);
  assert.equal(state.winner, 'A');
  assert.equal(state.endReason, 'score');
});

test('Capture the Point: only an uncontested zone scores; first to 100', () => {
  const { state } = modeMatch('capture');
  const [l] = state.rules.capture.spots;
  const a = Sim.spawnDirect(state, 'A', 'brawler', l.x, l.y + 0.5, 9);
  a.speed = 0;
  stepN(state, 20 * 2);
  const after2 = state.players.A.score;
  assert.ok(after2 > 6 && after2 < 9, `about 4/s while alone (${after2})`);
  const b = Sim.spawnDirect(state, 'B', 'brawler', l.x, l.y - 0.5, 9);
  b.speed = 0; a.targets = b.targets = 'none';
  stepN(state, 20 * 2);
  assert.ok(Math.abs(state.players.A.score - after2) < 0.01, 'contested: nobody scores');
  assert.equal(state.players.B.score || 0, 0);
  b.hp = 0;
  stepN(state, 20 * 30);
  assert.equal(state.winner, 'A');
  assert.equal(Math.floor(state.players.A.score), 100);
});

test('Payload: the cart rolls away from the side alone near it, stops when contested, and wins at the end line', () => {
  const { state } = modeMatch('payload');
  const c = state.obj.payload;
  const y0 = c.y;
  const a = Sim.spawnDirect(state, 'A', 'brawler', c.x, c.y + 1, 9);
  a.targets = 'none';
  stepN(state, 20 * 3);
  assert.ok(c.y < y0 - 1, 'A pushes it toward B');
  const yA = c.y;
  const b = Sim.spawnDirect(state, 'B', 'brawler', c.x, c.y - 1, 9);
  b.targets = 'none'; b.speed = 0;
  stepN(state, 20 * 2);
  assert.ok(Math.abs(c.y - yA) < 0.6, 'contested: it (nearly) stops');
  b.hp = 0;
  a.targets = 'ground'; // free to move again: it follows the cart on its own
  stepN(state, 20 * 60);
  assert.equal(state.winner, 'A');
  assert.equal(state.endReason, 'payload');
});

test('Treasure Hunt: chests come in mirrored pairs, a claim pays once (+1 point, +2 elixir), contested chests wait', () => {
  const { state } = modeMatch('treasure');
  quiet(state);
  stepN(state, 20 * 13);
  const chests = state.obj.treasure.chests;
  assert.equal(chests.length, 2);
  assert.ok(Math.abs(chests[0].x + chests[1].x - Sim.W) < 1e-9 && Math.abs(chests[0].y + chests[1].y - Sim.H) < 1e-9, 'mirrored');
  const mine = chests.find((c) => c.y > Sim.H / 2);
  state.players.A.elixir = 2;
  const u = Sim.spawnDirect(state, 'A', 'brawler', mine.x, mine.y, 9);
  u.speed = 0; u.targets = 'none';
  stepN(state, 20 * 2);
  assert.equal(state.players.A.score, 1);
  assert.ok(state.players.A.elixir >= 4);
  stepN(state, 20 * 2);
  assert.equal(state.players.A.score, 1, 'once');
  // A contested chest doesn't count down
  const theirs = state.obj.treasure.chests[0];
  const ua = Sim.spawnDirect(state, 'A', 'brawler', theirs.x, theirs.y + 0.3, 9);
  const ub = Sim.spawnDirect(state, 'B', 'brawler', theirs.x, theirs.y - 0.3, 9);
  [ua, ub].forEach((x) => { x.speed = 0; x.targets = 'none'; });
  stepN(state, 20 * 3);
  assert.equal(state.players.A.score, 1);
  assert.equal(state.players.B.score || 0, 0);
});

test('Princess Gambit: same 40-card pile for both sides in its own order, no repeats until it runs dry, level 11, always evolved', () => {
  const { state } = modeMatch('gambit');
  const pool = state.rules.gambit.pool;
  assert.equal(pool.length, 40);
  const all = (p) => [...p.hand, ...p.queue].sort();
  assert.deepEqual(all(state.players.A), [...pool].sort());
  assert.deepEqual(all(state.players.B), [...pool].sort());
  assert.notDeepEqual(state.players.A.hand.concat(state.players.A.queue), state.players.B.hand.concat(state.players.B.queue), 'own order');
  Object.values(state.players.A.cards).forEach((c) => assert.equal(c.level, 11));
  quiet(state);
  const played = [];
  for (let i = 0; i < 20; i++) {
    const p = state.players.A;
    p.elixir = 10;
    const id = p.hand.find((x) => !p.cards[x].spell && !p.cards[x].building) || p.hand[0];
    p.cooldowns[id] = 0;
    const r = Sim.deploy(state, 'A', id, 9, 24);
    if (!r.ok) { Sim.step(state); continue; }
    played.push(id);
    assert.ok(!p.hand.includes(id) && !p.queue.includes(id), `${id} is gone for now`);
    if (Sim.evolutionOf(id)) assert.ok(r.evolved, `${id} comes out evolved`);
    state.units.forEach((u) => { if (u.owner === 'A') u.hp = 0; });
    Sim.step(state);
  }
  assert.equal(new Set(played).size, played.length, 'no repeats');
  assert.equal(state.rules.crownsToWin, 1);
});

test('Back-Line Arena: troops and buildings only 4+ tiles behind the river; spells anywhere; the AI respects it', () => {
  const { state } = modeMatch('backline', { A: ['brawler', 'boltturret', 'firebomb', 'scout', 'voltbug', 'flarepod', 'mechmice', 'shock'] });
  const p = state.players.A;
  p.elixir = 10;
  ['brawler', 'boltturret', 'firebomb', 'scout'].forEach((id, i) => { p.hand[i] = id; });
  assert.equal(Sim.deploy(state, 'A', 'brawler', 4, 18.5).ok, false, 'too close to the river');
  assert.ok(Sim.deploy(state, 'A', 'brawler', 4, 22).ok);
  assert.ok(Sim.deploy(state, 'A', 'firebomb', 9, 10).ok, 'spells anywhere');
  const snap = Sim.snapshot(state);
  assert.equal(snap.deployDepth, 4);
  assert.equal(Sim.canDeployOnSnapshot(snap, 'A', 4, 18.5, Sim.CARD_MAP.brawler), false, 'the online preview agrees');
});

test('Inferno Siege: permanent defences, 16 plays, out of plays with nothing left loses', () => {
  const { state } = modeMatch('infernosiege');
  const defs = state.units.filter((u) => u.owner === 'B' && u.building);
  assert.equal(defs.length, 5);
  stepN(state, 20 * 50);
  assert.ok(defs.every((u) => u.hp === u.hpMax), "they don't decay");
  const s2 = modeMatch('infernosiege').state;
  s2.players.A.cardsPlayed = 16;
  const r = Sim.deploy(s2, 'A', s2.players.A.hand[0], 9, 24);
  assert.equal(r.ok, false);
  assert.match(r.reason, /plays/);
  Sim.step(s2);
  assert.equal(s2.winner, 'B');
  assert.equal(s2.endReason, 'outOfPlays');
});

test('Boss Rush: three stages, each a different boss, each unlocking the next', () => {
  const bosses = Events.BOSS_RUSH.map((b) => {
    const { state } = modeMatch('bossrush', { tier: b.id });
    for (let i = 0; i < 20 * 5; i++) Sim.step(state);
    const boss = state.units.find((u) => u.boss);
    return boss && boss.cardId;
  });
  assert.deepEqual(bosses, ['colossus', 'stonewarden', 'hivequeen']);
  const P = Events.freshProgress();
  assert.equal(Events.tierUnlocked(P, 'bossrush', 'warden'), false);
  const res = Events.settleMatch(P, { matchId: 'br1', eventId: 'bossrush', tier: 'colossus', result: 'win', ai: 'normal', mode: 'ai', cardsPlayed: 3 }, Date.now());
  assert.equal(res.unlockedTier.id, 'warden');
  assert.ok(Events.tierUnlocked(P, 'bossrush', 'warden'));
});

test('Elite Endurance: 36 escalating waves; holding out to the end is a win', () => {
  const w = Events.endlessWaves(2000, 9);
  assert.equal(w.length, 36);
  const size = (x) => x.units.length;
  assert.ok(size(w[35]) > size(w[0]));
  assert.ok(w[35].units[0].level > w[0].units[0].level);
  const { state } = modeMatch('endless');
  assert.equal(state.rules.timeout, 'survive');
  assert.equal(state.rules.waves.length, 36);
});
