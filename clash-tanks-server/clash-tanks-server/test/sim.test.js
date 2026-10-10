'use strict';

// Gameplay tests for the shared engine. Run with: npm test
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

// A quiet arena: towers can't shoot, so tests isolate unit behaviour
function sandbox() {
  const s = Sim.createMatch({ seed: 7 });
  s.towers.forEach((t) => { t.active = false; t.hp = t.hpMax = 1e6; });
  return s;
}

const alive = (s, u) => s.units.includes(u) && u.hp > 0;
const inBridge = (x) => Sim.BRIDGES.some((b) => x > b.x0 && x < b.x1);

test('1. melee unit finds and attacks a nearby enemy troop', () => {
  const s = sandbox();
  const a = Sim.spawnDirect(s, 'A', 'brawler', 9, 22);
  const b = Sim.spawnDirect(s, 'B', 'scrapbots', 10.5, 20);
  const start = b.hp;
  run(s, 4);
  assert.ok(b.hp < start, 'enemy troop should take damage');
  assert.ok(!alive(s, b) || a.targetId === b.id);
});

test('2. building-targeting unit ignores distracting troops', () => {
  const s = sandbox();
  const hog = Sim.spawnDirect(s, 'A', 'ramhog', 14.5, 21);
  const bait = Sim.spawnDirect(s, 'B', 'brawler', 14, 20);
  bait.speed = 0; bait.dmg = 0;
  const baitHp = bait.hp;
  let touchedBait = false;
  run(s, 6, () => { if (hog.targetId === bait.id) touchedBait = true; });
  assert.equal(touchedBait, false, 'hog never targets the troop');
  assert.equal(bait.hp, baitHp, 'troop takes no damage from the hog');
  assert.match(hog.targetId || '', /^T-B/, 'hog heads for an enemy tower');
});

test('3. ranged unit attacks from its preferred distance', () => {
  const s = sandbox();
  const sniper = Sim.spawnDirect(s, 'A', 'raylance', 9, 27);
  const turret = Sim.spawnDirect(s, 'B', 'boltturret', 9, 19);
  turret.dmg = 0; turret.lifetime = 0;
  const start = turret.hp;
  let firstHitDist = null;
  run(s, 8, () => {
    if (firstHitDist === null && turret.hp < start) firstHitDist = Math.hypot(sniper.x - turret.x, sniper.y - turret.y);
  });
  assert.ok(firstHitDist !== null, 'sniper damaged the target');
  assert.ok(firstHitDist > 5, `attacked from range (${firstHitDist.toFixed(2)} tiles), not melee`);
  const finalDist = Math.hypot(sniper.x - turret.x, sniper.y - turret.y);
  assert.ok(finalDist > 5, 'sniper stopped instead of walking into melee');
});

test('4. ground unit crosses the river only on a bridge', () => {
  const s = sandbox();
  const u = Sim.spawnDirect(s, 'A', 'brawler', 9, 21);
  let crossed = false;
  let swam = false;
  run(s, 25, () => {
    if (u.y >= Sim.RIVER.y0 && u.y < Sim.RIVER.y1 && !inBridge(u.x)) swam = true;
    if (u.y < Sim.RIVER.y0 - 1) { crossed = true; return false; }
    return true;
  });
  assert.equal(swam, false, 'never walked through the river');
  assert.ok(crossed, 'made it across via a bridge');
});

test('5. flying unit crosses the river directly', () => {
  const s = sandbox();
  const u = Sim.spawnDirect(s, 'A', 'nanodrones', 9, 21);
  let overWater = false;
  run(s, 10, () => { if (u.y >= Sim.RIVER.y0 && u.y < Sim.RIVER.y1 && !inBridge(u.x)) overWater = true; });
  assert.ok(overWater, 'flew straight over the water');
});

test('6. units stop attacking dead targets', () => {
  const s = sandbox();
  const a = Sim.spawnDirect(s, 'A', 'brawler', 9, 22);
  const b = Sim.spawnDirect(s, 'B', 'antmarch', 9, 21);
  const deadId = b.id;
  run(s, 6, () => !(b.hp <= 0));
  assert.ok(b.hp <= 0, 'weak enemy died');
  run(s, 1);
  assert.notEqual(a.targetId, deadId, 'retargeted after the kill');
  assert.ok(!s.projectiles.some((p) => p.targetId === deadId && p.homing && !p.done), 'no shots chasing a corpse');
});

test('7. units do not stay stuck (behind own king tower, and in a crowd)', () => {
  const s = sandbox();
  const u = Sim.spawnDirect(s, 'A', 'brawler', 9, 31.7);
  run(s, 15, () => u.y > 24);
  assert.ok(u.y <= 24, `walked around the king tower (y=${u.y.toFixed(2)})`);

  const s2 = sandbox();
  const crowd = [];
  for (let i = 0; i < 16; i++) crowd.push(Sim.spawnDirect(s2, 'A', 'scrapbots', 8 + (i % 4) * 0.2, 22 + Math.floor(i / 4) * 0.2));
  const startY = crowd.map((c) => c.y);
  run(s2, 12);
  const progressed = crowd.filter((c, i) => startY[i] - c.y > 3).length;
  assert.ok(progressed >= 14, `${progressed}/16 crowd units made progress`);
});

test('8. units do not overlap uncontrollably', () => {
  const s = sandbox();
  for (let i = 0; i < 30; i++) Sim.spawnDirect(s, 'A', 'zombiemob', 9 + (i % 3) * 0.05, 22);
  run(s, 3);
  const ground = s.units.filter((u) => !u.air);
  let worst = 0;
  for (let i = 0; i < ground.length; i++) {
    for (let j = i + 1; j < ground.length; j++) {
      const a = ground[i];
      const b = ground[j];
      const overlap = (a.radius + b.radius - Math.hypot(a.x - b.x, a.y - b.y)) / (a.radius + b.radius);
      worst = Math.max(worst, overlap);
    }
  }
  assert.ok(worst < 0.5, `worst overlap ${(worst * 100).toFixed(0)}% of combined radius`);
});

test('9. towers acquire and attack valid enemies; king waits until activated', () => {
  const s = Sim.createMatch({ seed: 3 });
  const tower = s.towers.find((t) => t.id === 'T-A-L');
  const king = s.towers.find((t) => t.id === 'T-A-K');
  const intruder = Sim.spawnDirect(s, 'B', 'brawler', 3.5, 19.5);
  intruder.speed = 0;
  const hp = intruder.hp;
  run(s, 3);
  assert.equal(tower.targetId, intruder.id);
  assert.ok(intruder.hp < hp, 'tower damaged the intruder');
  assert.equal(king.active, false, 'king tower still asleep');
  tower.hp = 0;
  run(s, 0.2);
  assert.equal(king.active, true, 'king wakes when a princess tower falls');
  assert.equal(s.players.B.crowns, 1, 'destroying a princess tower awards a crown');
});

test('10. elixir can never go negative', () => {
  const s = Sim.createMatch({ seed: 1 });
  const p = s.players.A;
  let failures = 0;
  for (let i = 0; i < 20; i++) {
    const res = Sim.deploy(s, 'A', p.hand[0], 9, 24);
    if (!res.ok) failures++;
    assert.ok(p.elixir >= 0, 'elixir stayed non-negative');
  }
  assert.ok(failures > 0, 'ran out and got refused');
  assert.equal(Sim.deploy(s, 'A', p.hand[0], 9, 24).reason, 'Not enough elixir');
});

test('11. cards cannot be deployed when unaffordable or in invalid spots', () => {
  const s = Sim.createMatch({ seed: 2 });
  const p = s.players.A;
  p.elixir = 10;
  const card = p.hand[0];
  assert.equal(Sim.deploy(s, 'A', card, 9, 16).ok, false, 'river');
  assert.equal(Sim.deploy(s, 'A', card, 9, 8).ok, false, 'enemy half');
  assert.equal(Sim.deploy(s, 'A', card, 3.5, 25.5).ok, false, 'on top of own tower');
  assert.equal(Sim.deploy(s, 'B', s.players.B.hand[0], 9, 24).ok, false, "B can't place on A's half");
  const notInHand = p.queue[0];
  assert.equal(Sim.deploy(s, 'A', notInHand, 9, 24).reason, 'Card not in hand');
  assert.equal(Sim.deploy(s, 'A', card, 9, 24).ok, true, 'valid spot works');
  // Pocket opens once the enemy princess on that side is destroyed
  s.towers.find((t) => t.id === 'T-B-L').hp = 0;
  Sim.step(s);
  p.elixir = 10;
  assert.equal(Sim.deploy(s, 'A', p.hand[0], 4, 13).ok, true, 'pocket deploy allowed');
});

test('12. destroying the king tower ends the match; time and tiebreak rules work', () => {
  const s = Sim.createMatch({ seed: 4 });
  const king = s.towers.find((t) => t.id === 'T-B-K');
  king.hp = 1;
  Sim.spawnDirect(s, 'A', 'raylance', 9, 8);
  run(s, 5);
  assert.equal(s.running, false);
  assert.equal(s.winner, 'A');
  assert.equal(s.endReason, 'king');
  assert.equal(s.players.A.crowns, 3);

  // More crowns at the end of regulation wins
  const t = Sim.createMatch({ seed: 5 });
  t.players.B.crowns = 1;
  t.time = Sim.MATCH.regulation - STEP / 2;
  Sim.step(t);
  assert.equal(t.winner, 'B');
  assert.equal(t.endReason, 'crowns');

  // Level at the end of overtime: weakest tower decides; identical towers draw
  const u = Sim.createMatch({ seed: 6 });
  u.time = Sim.MATCH.regulation + Sim.MATCH.overtime - STEP / 2;
  u.phase = 'overtime';
  Sim.step(u);
  assert.equal(u.winner, 'draw');
  const v = Sim.createMatch({ seed: 6 });
  v.towers.find((x) => x.id === 'T-A-R').hp -= 50;
  v.time = Sim.MATCH.regulation + Sim.MATCH.overtime - STEP / 2;
  v.phase = 'overtime';
  Sim.step(v);
  assert.equal(v.winner, 'B');
});

test('13. a large battle runs fast', () => {
  const s = Sim.createMatch({ seed: 9 });
  const cards = ['brawler', 'zombiemob', 'bugsquad', 'beeblitz', 'flarepod', 'wolfpack'];
  for (let i = 0; i < 60; i++) {
    const c = cards[i % cards.length];
    Sim.spawnDirect(s, 'A', c, 1 + (i % 16), 18 + (i % 5));
    Sim.spawnDirect(s, 'B', c, 1 + (i % 16), 14 - (i % 5));
  }
  const unitsAtStart = s.units.length;
  const steps = 400; // 20 seconds of game time
  const t0 = process.hrtime.bigint();
  run(s, steps * STEP);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const perStep = ms / steps;
  console.log(`    ${unitsAtStart} units: ${perStep.toFixed(2)} ms per step (budget 50 ms)`);
  assert.ok(perStep < 10, `average step ${perStep.toFixed(2)} ms`);
});

test('AI vs AI plays a full, valid match', () => {
  const s = Sim.createMatch({ seed: 11 });
  const brains = { A: Sim.createAi('A', { thinkMin: 0.4, thinkMax: 0.6 }), B: Sim.createAi('B', { thinkMin: 0.4, thinkMax: 0.6, strategicChance: 0.9 }) };
  let seed = 42;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  brains.A.rand = rand;
  brains.B.rand = rand;
  let plays = 0;
  let refused = 0;
  while (s.running && s.time < 260) {
    for (const side of ['A', 'B']) {
      const res = Sim.aiUpdate(s, brains[side], STEP);
      if (res) { if (res.ok) plays++; else refused++; }
      assert.ok(s.players[side].elixir >= 0);
    }
    Sim.step(s);
  }
  assert.equal(s.running, false, 'match finished');
  assert.ok(['A', 'B', 'draw'].includes(s.winner));
  assert.ok(plays > 20, `AIs played ${plays} cards`);
  assert.equal(refused, 0, 'AI only tries legal deploys');
  console.log(`    winner ${s.winner} by ${s.endReason} at ${s.time.toFixed(0)}s, ${plays} cards played, crowns A${s.players.A.crowns}-B${s.players.B.crowns}`);
});

test('every card can reach and damage an enemy tower from either side', () => {
  const failures = [];
  const times = [];
  for (const card of Sim.CARD_LIBRARY) {
    if (card.building) continue;
    for (const [side, x, y] of [['A', 4, 22], ['A', 15, 28], ['B', 13, 10]]) {
      const s = Sim.createMatch({ seed: 5 });
      s.towers.forEach((t) => { t.active = false; t.hp = t.hpMax = 1e6; });
      Sim.spawnDirect(s, side, card.id, x, y);
      const foe = side === 'A' ? 'B' : 'A';
      let hitAt = null;
      run(s, 45, () => {
        if (s.towers.some((t) => t.owner === foe && t.hp < t.hpMax)) { hitAt = s.time; return false; }
        return true;
      });
      if (hitAt === null) failures.push(`${card.id}@${side}(${x},${y})`);
      else times.push(hitAt);
    }
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`    ${times.length} runs reached a tower, avg ${avg.toFixed(1)}s, slowest ${Math.max(...times).toFixed(1)}s`);
  assert.deepEqual(failures, []);
});

test('snapshot deploy check (online preview) agrees with the real rules', () => {
  const s = Sim.createMatch({ seed: 8 });
  Sim.spawnDirect(s, 'A', 'boltturret', 9, 22);
  s.towers.find((t) => t.id === 'T-B-R').hp = 0;
  Sim.step(s);
  const snap = Sim.snapshot(s);
  const troop = Sim.CARD_MAP.brawler;
  const building = Sim.CARD_MAP.boltturret;
  let mismatches = 0;
  for (const side of ['A', 'B']) {
    for (const card of [troop, building]) {
      for (let y = 0.25; y < Sim.H; y += 0.5) {
        for (let x = 0.25; x < Sim.W; x += 0.5) {
          if (Sim.canDeploy(s, side, x, y, card) !== Sim.canDeployOnSnapshot(snap, side, x, y, card)) mismatches++;
        }
      }
    }
  }
  assert.equal(mismatches, 0);
});
