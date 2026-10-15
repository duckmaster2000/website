'use strict';

// Combat resolution, targeting, navigation and AI tests (see CLASH_TANKS.md section 13). Run with: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const Sim = require('../shared/clash-sim');

const STEP = Sim.MATCH.step;

function run(state, seconds, each) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps && state.running; i++) {
    if (each && each(state) === false) break;
    Sim.step(state);
  }
}

// A quiet arena: towers can't shoot, so tests isolate unit behaviour
function sandbox(seed) {
  const s = Sim.createMatch({ seed: seed || 7 });
  s.towers.forEach((t) => { t.active = false; t.hp = t.hpMax = 1e6; });
  return s;
}

const tower = (s, id) => s.towers.find((t) => t.id === id);

// ── Combat resolution ───────────────────────────────────────────────────────

test('two units that kill each other on the same tick both land their hit, whatever the update order', () => {
  for (const pre of [0, 1]) {
    for (const order of [['A', 'B'], ['B', 'A']]) {
      const s = sandbox();
      for (let i = 0; i < pre; i++) Sim.step(s); // flips which way the update order runs
      const pos = { A: [9, 20], B: [9, 18.85] };
      const u = {};
      for (const side of order) u[side] = Sim.spawnDirect(s, side, 'brawler', ...pos[side]);
      u.A.hp = u.B.hp = 50;
      run(s, 1);
      assert.ok(u.A.hp <= 0 && u.B.hp <= 0, `both die (pre ${pre}, ${order}): A ${u.A.hp} B ${u.B.hp}`);
      assert.ok(!s.units.includes(u.A) && !s.units.includes(u.B), 'and are cleaned up');
    }
  }
});

test('a wind-up whose target dies is called off: no stray hit on the next unit, and the attack timer is handed back', () => {
  const s = sandbox();
  const a = Sim.spawnDirect(s, 'A', 'brawler', 9, 20);
  const m1 = Sim.spawnDirect(s, 'B', 'mechmice', 9, 18.9);
  const m2 = Sim.spawnDirect(s, 'B', 'mechmice', 9.9, 19.5);
  [m1, m2].forEach((m) => { m.hp = m.hpMax = 1000; m.targets = 'none'; }); // punching bags
  run(s, 2, () => a.windupT <= 0); // until the swing starts
  assert.ok(a.windupT > 0, 'winding up');
  const first = s.byId.get(a.windupTarget);
  const other = first === m1 ? m2 : m1;
  Sim.step(s);
  first.hp = 0; // killed by something else mid-swing
  const killedAt = s.time;
  const hpBefore = other.hp;
  let hitAt = null;
  run(s, 2, () => { if (hitAt == null && other.hp < hpBefore) hitAt = s.time; });
  assert.ok(hitAt != null, 'it does hit the other one eventually');
  const gap = hitAt - killedAt;
  assert.ok(gap >= 0.3 - 1e-6, `a fresh full wind-up first (${gap.toFixed(2)}s)`);
  assert.ok(gap < 0.7, `not a whole cooldown later: the timer was handed back (${gap.toFixed(2)}s)`);
});

test('a stun during a wind-up still costs the attack (the timer is not handed back)', () => {
  const s = sandbox();
  const a = Sim.spawnDirect(s, 'A', 'brawler', 9, 20);
  const m = Sim.spawnDirect(s, 'B', 'mechmice', 9, 18.9);
  m.hp = m.hpMax = 5000; m.targets = 'none';
  run(s, 2, () => a.windupT <= 0);
  Sim.castDirect(s, 'B', 'shock', a.x, a.y);
  assert.ok(a.windupT === 0 && a.stunT > 0, 'stunned, swing cancelled');
  assert.ok(a.atkCd > 0.5, 'attack timer still running');
});

test('if both kings fall on the same tick the match is a draw, decided once', () => {
  const s = Sim.createMatch({ seed: 3 });
  s.towers.filter((t) => t.tower === 'king').forEach((t) => { t.hp = 0; });
  Sim.step(s);
  assert.equal(s.running, false);
  assert.equal(s.winner, 'draw');
  assert.equal(s.endReason, 'king');
  Sim.step(s);
  assert.equal(s.winner, 'draw', 'never re-decided');

  const s2 = Sim.createMatch({ seed: 3 });
  tower(s2, 'T-B-K').hp = 0;
  Sim.step(s2);
  assert.equal(s2.winner, 'A');
  assert.equal(s2.players.A.crowns, 3);
});

test('a tower destroyed on the tick its shot was due still fires that shot', () => {
  const s = sandbox();
  const t = tower(s, 'T-B-L');
  t.active = true;
  const a = Sim.spawnDirect(s, 'A', 'brawler', 3.5, 8.7);
  a.hp = a.hpMax = 1e5;
  let killTick = false;
  run(s, 3, () => {
    if (a.windupT > 0 && a.windupT <= STEP + 1e-9 && a.windupTarget === t.id) {
      t.hp = 1;      // this swing will finish it
      t.atkCd = 0.01; // and its own shot is due this very tick
      killTick = true;
      return false;
    }
  });
  assert.ok(killTick, 'set up the shared tick');
  const shotsBefore = s.projectiles.filter((p) => p.source.id === t.id).length;
  Sim.step(s);
  assert.ok(t.hp <= 0 && t.destroyed, 'tower destroyed');
  const shots = s.projectiles.filter((p) => p.source.id === t.id).length;
  assert.equal(shots, shotsBefore + 1, 'its last arrow is in the air');
  Sim.step(s);
  assert.equal(s.projectiles.filter((p) => p.source.id === t.id && p.x === t.x && p.y === t.y).length, 0, 'and it fires nothing more');
});

test('a spell cast on the same tick a troop lands still hits it', () => {
  const s = sandbox();
  Sim.step(s);
  const u = Sim.spawnDirect(s, 'B', 'brawler', 9, 10);
  Sim.castDirect(s, 'A', 'shock', 9, 10);
  assert.ok(u.hp < u.hpMax, 'troop deployed between steps is hit');
});

test('a projectile already in flight still lands after its shooter dies', () => {
  const s = sandbox();
  const shooter = Sim.spawnDirect(s, 'A', 'raylance', 9, 22);
  const target = Sim.spawnDirect(s, 'B', 'brawler', 9, 16.5);
  target.targets = 'none';
  run(s, 3, () => s.projectiles.length === 0);
  assert.ok(s.projectiles.length > 0, 'fired');
  shooter.hp = 0;
  const before = target.hp;
  run(s, 1);
  assert.ok(target.hp < before, 'the shot still hits');
});

test('death effects happen exactly once, even when several hits land on a dying unit', () => {
  const s = sandbox();
  const titan = Sim.spawnDirect(s, 'B', 'rocktitan', 9, 10);
  titan.hp = 0;
  Sim.castDirect(s, 'A', 'shock', 9, 10); // more damage on the same tick
  run(s, 1);
  assert.equal(s.units.filter((u) => u.cardId === 'rockshard').length, 2, 'two shards, once');
  run(s, 1);
  assert.equal(s.units.filter((u) => u.cardId === 'rockshard').length, 2, 'still two');
  assert.ok(!s.byId.has(titan.id), 'removed from lookups, so nothing can target it');
});

// ── Targeting and aggro ─────────────────────────────────────────────────────

test('a building pulls a building-targeting troop off its tower; a troop in the same spot does not', () => {
  const pull = (decoy) => {
    const s = sandbox();
    const hog = Sim.spawnDirect(s, 'B', 'ramhog', 3.5, 12);
    hog.hp = hog.hpMax = 1e5;
    const d = Sim.spawnDirect(s, 'A', decoy, 6.1, 20.6);
    d.hp = d.hpMax = 1e5;
    if (d.kind === 'troop') d.speed = 0; // keep the troop where we put it
    let first = null;
    run(s, 8, () => { if (!first && hog.windupT > 0) first = hog.windupTarget; });
    return { first, decoy: d, hog, s };
  };
  const b = pull('boltturret');
  assert.equal(b.first, b.decoy.id, 'goes for the building');
  const why = Sim.explainTargeting(b.s, b.hog.id);
  assert.equal(why.target, b.decoy.id);
  assert.ok(why.why, 'records why it picked it');

  const t = pull('brawler');
  assert.equal(t.first, 'T-A-L', 'ignores the troop and hits the tower');
  const rep = Sim.explainTargeting(t.s, t.hog.id);
  assert.equal(rep.candidates.find((c) => c.id === t.decoy.id).reject, 'only targets buildings');
});

test('two near-equal targets do not make a troop flip-flop', () => {
  const s = sandbox();
  const a = Sim.spawnDirect(s, 'A', 'brawler', 9, 23);
  const l = Sim.spawnDirect(s, 'B', 'brawler', 7.5, 19);
  const r = Sim.spawnDirect(s, 'B', 'brawler', 10.5, 19);
  [l, r].forEach((u) => { u.speed = 0; u.targets = 'none'; u.hp = u.hpMax = 1e5; });
  let switches = 0;
  let last = null;
  let tick = 0;
  run(s, 4, () => {
    // jiggle them so each is "closest" in turn
    tick++;
    l.x = 7.5 + (tick % 2 ? 0.2 : -0.2);
    r.x = 10.5 + (tick % 2 ? 0.2 : -0.2);
    if (a.targetId && a.targetId !== last) { if (last) switches++; last = a.targetId; }
  });
  assert.ok(switches <= 1, `switched ${switches} times`);
});

test('towers keep their target until it dies or leaves range, then pick the nearest', () => {
  const s = sandbox();
  const t = tower(s, 'T-B-L');
  t.active = true;
  const far = Sim.spawnDirect(s, 'A', 'brawler', 3.5, 13.5);
  far.speed = 0; far.targets = 'none';
  run(s, 0.2);
  assert.equal(t.targetId, far.id);
  const near = Sim.spawnDirect(s, 'A', 'brawler', 5.5, 9.5);
  near.speed = 0; near.targets = 'none';
  run(s, 1);
  assert.equal(t.targetId, far.id, 'keeps the first one');
  far.hp = 0;
  run(s, 0.2);
  assert.equal(t.targetId, near.id, 'retargets once it is gone');
  assert.equal(Sim.explainTargeting(s, t.id).target, near.id);
});

test('explainTargeting changes nothing', () => {
  const s = sandbox();
  const a = Sim.spawnDirect(s, 'A', 'brawler', 9, 20);
  Sim.spawnDirect(s, 'B', 'brawler', 9, 14);
  run(s, 1);
  const seed = s.seed;
  const snap = JSON.stringify(Sim.snapshot(s));
  const rep = Sim.explainTargeting(s, a.id);
  assert.ok(rep.candidates.length >= 4, 'lists units and towers');
  assert.equal(s.seed, seed, 'no random draws');
  assert.equal(JSON.stringify(Sim.snapshot(s)), snap);
});

// ── Navigation and collision ────────────────────────────────────────────────

test('a building dropped in a troop\'s path makes it go round, never through', () => {
  const s = sandbox();
  const u = Sim.spawnDirect(s, 'A', 'brawler', 3.5, 23);
  run(s, 0.5);
  Sim.spawnDirect(s, 'A', 'sirenbeacon', 3.5, 20.5);
  let inside = 0;
  let crossed = false;
  run(s, 12, () => {
    if (!Sim.walkablePoint(s, u.x, u.y, false)) inside++;
    if (u.y < Sim.RIVER.y0) crossed = true;
  });
  assert.equal(inside, 0, 'never stood inside the building or the river');
  assert.ok(crossed, 'got round and over the bridge');
});

test('knockback never leaves a ground troop in the river or inside a tower', () => {
  const s = sandbox();
  const units = [];
  for (let i = 0; i < 8; i++) units.push(Sim.spawnDirect(s, 'B', 'junkpack', 0.6 + i * 0.25, 14.4));
  units.push(Sim.spawnDirect(s, 'B', 'junkpack', 3.5, 8.3)); // just below a tower
  units.forEach((u) => { u.speed = 0; u.hp = u.hpMax = 1e5; });
  Sim.castDirect(s, 'A', 'firebomb', 1.5, 13.4);
  Sim.castDirect(s, 'A', 'firebomb', 3.5, 9.4);
  run(s, 2, () => units.forEach((u) => assert.ok(Sim.walkablePoint(s, u.x, u.y, false), `${u.x.toFixed(2)},${u.y.toFixed(2)}`)));
});

// ── AI ──────────────────────────────────────────────────────────────────────

function aiMatch(handA, extra) {
  const deck = handA.concat(['brawler', 'mechmice', 'antmarch', 'scout', 'shock', 'firebomb', 'raylance', 'junkpack'].filter((c) => !handA.includes(c))).slice(0, 8);
  const s = Sim.createMatch(Object.assign({ seed: 9, decks: { A: deck, B: Sim.STARTER_DECK } }, extra));
  s.players.A.hand = handA.slice(0, 4);
  s.players.A.queue = deck.filter((c) => !s.players.A.hand.includes(c));
  s.players.A.elixir = 10;
  return s;
}

test('threats are ranked by how soon and how hard they hit, not just by what they are', () => {
  const s = Sim.createMatch({ seed: 4 });
  const far = Sim.spawnDirect(s, 'B', 'brawler', 14.5, 3.5);
  const hog = Sim.spawnDirect(s, 'B', 'ramhog', 3.5, 21);
  const th = Sim.assessThreats(s, 'A');
  assert.equal(th[0].u, hog, 'the hog at the tower comes first');
  assert.equal(th[0].goal.id, 'T-A-L');
  assert.ok(th[0].eta < 1.5 && th.find((t) => t.u === far).eta > 10, 'eta reflects the route (bridge included)');
});

test('card-cycle inference: a card just played is known to be out of hand only once the rules prove it', () => {
  const s = Sim.createMatch({ seed: 4 });
  const play = (id) => s.playLog.push({ n: ++s.playSeq, owner: 'B', cardId: id, at: 0, swap: 0 });
  ['brawler', 'scout', 'siege', 'guardian'].forEach(play);
  let c = Sim.foeCycle(s, 'A');
  assert.ok(c.mayHold('brawler'), 'four cards seen: the deck could be four cards, so nothing is proven');
  ['voltbug', 'drillcat', 'ramhog', 'flarepod'].forEach(play);
  c = Sim.foeCycle(s, 'A');
  assert.ok(!c.mayHold('flarepod') && !c.mayHold('voltbug'), 'eight seen: the last four are still cycling');
  assert.ok(c.mayHold('brawler'), 'the first ones are back');
  assert.ok(c.mayHold('shock'), 'never-seen cards are unknown, never assumed absent');
});

test('the AI decides from what it can see: the opponent\'s hand and elixir make no difference', () => {
  const mk = () => {
    const s = aiMatch(['boltturret', 'mechmice', 'scout', 'antmarch']);
    const hog = Sim.spawnDirect(s, 'B', 'ramhog', 3.5, 13);
    hog.costShare = 5;
    return s;
  };
  const s1 = mk();
  const s2 = mk();
  s2.players.B.elixir = 0;
  s2.players.B.hand = s2.players.B.hand.slice().reverse();
  const p1 = Sim.aiDecide(s1, Sim.createAi('A', { strategicChance: 1 }, 5));
  const p2 = Sim.aiDecide(s2, Sim.createAi('A', { strategicChance: 1 }, 5));
  assert.deepEqual(p1 && [p1.cardId, p1.x, p1.y], p2 && [p2.cardId, p2.x, p2.y]);
});

test('look-ahead plays out its options in a private copy: the real match is untouched', () => {
  const s = aiMatch(['boltturret', 'mechmice', 'brawler', 'antmarch']);
  Sim.spawnDirect(s, 'B', 'ramhog', 3.5, 13);
  run(s, 0.5);
  const before = structuredClone({ ...s, fx: [] });
  const brain = Sim.createAi('A', { strategicChance: 1, lookahead: 3 }, 5);
  const plan = Sim.aiDecide(s, brain);
  assert.ok(brain.stats.rollouts > 0, 'it did look ahead');
  assert.deepEqual(structuredClone({ ...s, fx: [] }), before, 'nothing in the match changed');
  assert.ok(plan && plan.why && plan.why.by === 'lookahead', 'and says how it chose');
  assert.ok(Array.isArray(plan.why.tried) && typeof plan.why.hold === 'number', 'with the numbers it compared');
});

test('AI answers a Ram Hog with a legal play that draws it off the tower, and the tower takes less damage', () => {
  const towerLoss = (withAi) => {
    const s = aiMatch(['boltturret', 'mechmice', 'brawler', 'antmarch']);
    s.players.B.elixir = 0;
    const hog = Sim.spawnDirect(s, 'B', 'ramhog', 3.5, 11);
    hog.costShare = 5;
    const brain = Sim.createAi('A', { strategicChance: 1, lookahead: 3, aggression: 0 }, 5);
    let plan = null;
    run(s, 14, () => {
      if (withAi && !plan) {
        const res = Sim.aiUpdate(s, brain, STEP);
        if (res) { assert.ok(res.ok, 'legal'); plan = brain.lastPlan; }
      }
    });
    return { loss: tower(s, 'T-A-L').hpMax - tower(s, 'T-A-L').hp, plan, hog };
  };
  const none = towerLoss(false);
  const ai = towerLoss(true);
  assert.ok(ai.plan && ai.plan.why.kind === 'defend' && ai.plan.why.threat === 'ramhog', JSON.stringify(ai.plan && ai.plan.why));
  assert.ok(ai.loss < none.loss * 0.5, `tower lost ${ai.loss.toFixed(0)} with the AI, ${none.loss.toFixed(0)} without`);
});

test('the AI does not retry a spot the match just refused', () => {
  const s = aiMatch(['boltturret', 'mechmice', 'brawler', 'antmarch']);
  Sim.spawnDirect(s, 'B', 'ramhog', 3.5, 13).costShare = 5;
  const brain = Sim.createAi('A', { strategicChance: 1, lookahead: 0 }, 5);
  const p1 = Sim.aiDecide(s, brain);
  brain.refused = { cardId: p1.cardId, x: p1.x, y: p1.y, until: s.time + 2 };
  const p2 = Sim.aiDecide(s, brain);
  assert.ok(p2.cardId !== p1.cardId || Math.hypot(p2.x - p1.x, p2.y - p1.y) >= 0.6);
});

test('AI decisions stay cheap', () => {
  let maxSteps = 0;
  const s = Sim.createMatch({ seed: 21, decks: { A: Sim.STARTER_DECK, B: Sim.STARTER_DECK } });
  const brains = [Sim.createAi('A', { lookahead: 3 }, 1), Sim.createAi('B', { lookahead: 3 }, 2)];
  while (s.running) {
    brains.forEach((b) => {
      const st = b.stats.steps;
      Sim.aiUpdate(s, b, STEP);
      maxSteps = Math.max(maxSteps, b.stats.steps - st);
    });
    Sim.step(s);
  }
  const total = brains.reduce((n, b) => n + b.stats.decisions, 0);
  const ms = brains.reduce((n, b) => n + b.stats.ms, 0) / total;
  assert.ok(maxSteps <= 500, `at most ${maxSteps} simulated steps in one decision`);
  assert.ok(ms < 2, `${ms.toFixed(3)} ms per decision on average`);
});

// ── Opponent model, spell / attack look-ahead, route stickiness, square towers ─

test('the opponent model only uses cards the AI has seen played, never the real hand or elixir', () => {
  const s = Sim.createMatch({ seed: 4 });
  const brain = Sim.createAi('A', null, 5);
  brain.foeElixir = 6.5;
  s.players.B.hand = ['siege', 'guardian', 'drillcat', 'ramhog'];
  s.players.B.elixir = 10;
  s.playLog.push({ n: ++s.playSeq, owner: 'B', cardId: 'scout', at: 0, swap: 0 });
  s.playLog.push({ n: ++s.playSeq, owner: 'B', cardId: 'flarepod', at: 1, swap: 0 });
  const m = Sim.foeModel(s, brain);
  assert.deepEqual(m.ids.sort(), ['flarepod', 'scout']);
  assert.equal(m.elixir, 6.5, 'its own estimate, not their bar');
  assert.equal(Sim.foeModel(s, Sim.createAi('A', { replies: false }, 5)), null, 'switchable');
});

test('with look-ahead, a spell is played out before it is cast, and the reason is kept', () => {
  const s = aiMatch(['firebomb', 'mechmice', 'brawler', 'antmarch']);
  for (let i = 0; i < 4; i++) {
    const u = Sim.spawnDirect(s, 'B', 'junkpack', 3 + (i % 2) * 0.6, 21 + Math.floor(i / 2) * 0.6);
    u.costShare = 1.5;
    u.hp = 150; // already hurt, so one Fire Bomb (165) kills the whole group
  }
  const brain = Sim.createAi('A', { strategicChance: 1, lookahead: 2 }, 5);
  const before = structuredClone({ ...s, fx: [] });
  const plan = Sim.aiDecide(s, brain);
  assert.deepEqual(structuredClone({ ...s, fx: [] }), before, 'the real match is untouched');
  assert.equal(brain.lastPlan.why.kind, 'spell');
  assert.ok(Array.isArray(brain.lastPlan.why.tried) && typeof brain.lastPlan.why.hold === 'number');
  if (plan) assert.equal(plan.cardId, 'firebomb', 'and casts it when it beats holding');
});

test('with look-ahead, an attack compares both lanes for a fast win condition', () => {
  const s = aiMatch(['ramhog', 'mechmice', 'brawler', 'antmarch']);
  s.players.A.elixir = 10;
  const brain = Sim.createAi('A', { strategicChance: 1, lookahead: 2, aggression: 1, leakAt: 9.5 }, 5);
  const plan = Sim.aiDecide(s, brain);
  assert.ok(plan && plan.why && plan.why.kind === 'push', JSON.stringify(plan && plan.why));
  assert.ok(plan.why.tried.length >= 2 && new Set(plan.why.tried.map((t) => t.lane)).size === 2, 'both lanes tried');
  assert.ok(Sim.deploy(s, 'A', plan.cardId, plan.x, plan.y).ok, 'and the play is legal');
});

test('a troop chasing a target that swings across the middle commits to a bridge and crosses', () => {
  // Without route stickiness this unit flipped bridges ~10 times and never crossed
  const s = sandbox();
  const u = Sim.spawnDirect(s, 'B', 'brawler', 9, 9);
  u.sight = 40; // keep it on the moving target, not the towers
  const t = Sim.spawnDirect(s, 'A', 'brawler', 9, 23);
  t.speed = 0; t.targets = 'none';
  let flips = 0;
  let last = -1;
  let crossedAt = null;
  let tick = 0;
  run(s, 12, () => {
    tick++;
    t.x = 9 + (Math.floor(tick / 10) % 2 ? 2.5 : -2.5); // swings from one side of the middle to the other
    if (u.y < Sim.RIVER.y0 && u.path && u.path.bridge >= 0) {
      if (last >= 0 && u.path.bridge !== last) flips++;
      last = u.path.bridge;
    }
    if (crossedAt == null && u.y > Sim.RIVER.y1) crossedAt = s.time;
  });
  assert.equal(flips, 0, `bridge flips: ${flips}`);
  assert.ok(crossedAt != null && crossedAt < 11, `crossed the river (at ${crossedAt})`);
});

test('troops are pushed out of a tower\'s square corner, not just its circle', () => {
  const s = sandbox();
  const t = tower(s, 'T-B-L'); // centre 3.5, 6.5, half 1.5: corner at (5, 8)
  const u = Sim.spawnDirect(s, 'A', 'brawler', 5.3, 8.3);
  u.speed = 0; u.targets = 'none';
  const gap = () => Math.hypot(Math.max(Math.abs(u.x - t.x) - t.half, 0), Math.max(Math.abs(u.y - t.y) - t.half, 0));
  assert.ok(gap() < u.radius, 'starts overlapping the corner');
  run(s, 0.5);
  assert.ok(gap() >= u.radius - 1e-6, `pushed clear (gap ${gap().toFixed(3)})`);
});
