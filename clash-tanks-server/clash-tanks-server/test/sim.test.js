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
    // Buildings and spells don't walk; anti-air troops never shoot towers by design
    if (card.building || card.spell || card.targets === 'air') continue;
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

// ─── Spells ────────────────────────────────────────────────────────────────

function spellMatch(deckA) {
  const s = Sim.createMatch({ seed: 21, decks: { A: deckA } });
  s.players.A.elixir = 10;
  return s;
}

test('spells can be cast anywhere in the arena, but not off it', () => {
  const s = spellMatch(['firebomb', 'shock', 'rocketrain', 'brawler', 'scout', 'siege', 'guardian', 'voltbug']);
  const fire = s.players.A.cards.firebomb;
  assert.ok(Sim.canDeploy(s, 'A', 9, 4, fire), 'deep in enemy territory');
  assert.ok(Sim.canDeploy(s, 'A', 3, 16, fire), 'over the river');
  assert.ok(!Sim.canDeploy(s, 'A', -1, 4, fire), 'off the arena');
  const snap = Sim.snapshot(s);
  assert.ok(Sim.canDeployOnSnapshot(snap, 'A', 9, 4, fire), 'online preview agrees');
  const res = Sim.deploy(s, 'A', 'firebomb', 9, 4);
  assert.ok(res.ok);
  assert.equal(res.units.length, 0, 'spells spawn no units');
  assert.equal(s.players.A.elixir, 6);
  assert.ok(!s.players.A.hand.includes('firebomb'), 'spell cycles out of hand');
});

test('Fire Bomb flies from the king tower, hits a cluster, knocks back, and chips towers less', () => {
  const s = spellMatch(['firebomb', 'shock', 'rocketrain', 'brawler']);
  s.towers.forEach((t) => { t.active = false; });
  const pack = [Sim.spawnDirect(s, 'B', 'scrapbots', 3.5, 9.5), Sim.spawnDirect(s, 'B', 'scrapbots', 4.3, 9.6), Sim.spawnDirect(s, 'B', 'flarepod', 3.9, 10.2)];
  pack.forEach((u) => { u.speed = 0; u.dmg = 0; });
  const tower = s.towers.find((t) => t.id === 'T-B-L');
  const towerHp = tower.hp;
  const before = pack.map((u) => ({ hp: u.hp, y: u.y }));
  Sim.deploy(s, 'A', 'firebomb', 3.8, 9.6);
  assert.equal(pack[0].hp, before[0].hp, 'no damage before the bomb lands');
  run(s, 2.5);
  pack.forEach((u, i) => assert.ok(u.hp < before[i].hp, `unit ${i} damaged`));
  assert.ok(Math.hypot(pack[2].x - 3.9, pack[2].y - before[2].y) > 0.3, 'survivor knocked back');
  const towerLoss = towerHp - tower.hp;
  const unitLoss = before[2].hp - Math.max(0, pack[2].hp);
  assert.ok(towerLoss > 0 && towerLoss < unitLoss * 0.5, `tower took reduced damage (${towerLoss} vs ${unitLoss})`);
});

test('Shock stuns troops and towers instantly; Rocket Rain clears a swarm', () => {
  const s = spellMatch(['shock', 'rocketrain', 'firebomb', 'brawler']);
  const hog = Sim.spawnDirect(s, 'B', 'ramhog', 9, 20);
  run(s, 0.5);
  const y0 = hog.y;
  Sim.deploy(s, 'A', 'shock', hog.x, hog.y);
  assert.ok(hog.stunT > 0, 'stunned right away');
  run(s, 0.4);
  assert.ok(Math.abs(hog.y - y0) < 0.05, 'stunned unit does not move');
  run(s, 1);
  assert.ok(Math.abs(hog.y - y0) > 0.2, 'moves again after the stun');

  const s2 = spellMatch(['rocketrain', 'shock', 'firebomb', 'brawler']);
  const bees = [];
  for (let i = 0; i < 4; i++) bees.push(Sim.spawnDirect(s2, 'B', 'beeblitz', 8 + i * 0.6, 12));
  bees.forEach((b) => { b.speed = 0; });
  Sim.deploy(s2, 'A', 'rocketrain', 9, 12);
  run(s2, 3);
  assert.equal(bees.filter((b) => s2.units.includes(b)).length, 0, 'all bees cleared');
});

test('AI with spells in its deck plays a full, legal match and uses its spells', () => {
  const deck = ['firebomb', 'shock', 'rocketrain', 'brawler', 'scout', 'junkpack', 'bugsquad', 'flarepod'];
  const s = Sim.createMatch({ seed: 99, decks: { A: deck, B: deck } });
  const brains = { A: Sim.createAi('A', { strategicChance: 0.9 }, 3), B: Sim.createAi('B', { strategicChance: 0.9 }, 4) };
  let refused = 0;
  let spellsCast = 0;
  while (s.running && s.time < 260) {
    for (const side of ['A', 'B']) {
      const res = Sim.aiUpdate(s, brains[side], STEP);
      if (res && !res.ok) refused++;
      if (res && res.ok && res.units.length === 0) spellsCast++;
    }
    Sim.step(s);
  }
  assert.equal(refused, 0);
  assert.ok(spellsCast >= 3, `spells cast: ${spellsCast}`);
  console.log(`    winner ${s.winner} by ${s.endReason} at ${s.time.toFixed(0)}s, ${spellsCast} spells cast`);
});

// ─── Emotes ────────────────────────────────────────────────────────────────

test('emotes are validated and rate limited', () => {
  const s = Sim.createMatch({ seed: 3 });
  assert.equal(Sim.emote(s, 'A', 'nope').ok, false, 'unknown emote refused');
  assert.equal(Sim.emote(s, 'A', 'laugh').ok, true);
  assert.equal(Sim.emote(s, 'A', 'cry').ok, false, 'too soon after the last one');
  assert.equal(Sim.emote(s, 'B', 'cry').ok, true, 'limits are per player');
  const fx = Sim.takeFx(s).filter((f) => f.type === 'emote');
  assert.deepEqual(fx.map((f) => [f.owner, f.emote]), [['A', 'laugh'], ['B', 'cry']]);
  // Spamming as fast as allowed still caps out within the window
  let sent = 1;
  for (let i = 0; i < 20 * 20; i++) {
    Sim.step(s);
    if (Sim.emote(s, 'A', 'thumbs').ok) sent++;
  }
  assert.ok(sent <= Sim.EMOTE_RULES.maxInWindow + 1, `sent ${sent} in ~20s`);
});

test('AI emotes when it takes or loses a tower, and at the end, without spamming', () => {
  const s = Sim.createMatch({ seed: 5 });
  const brain = Sim.createAi('B', { emoteChance: 1 }, 9);
  const emotes = [];
  const tick = () => { Sim.aiUpdate(s, brain, STEP); Sim.step(s); Sim.takeFx(s).forEach((f) => { if (f.type === 'emote') emotes.push(f); }); };
  for (let i = 0; i < 20; i++) tick();
  s.towers.find((t) => t.id === 'T-A-L').hp = 0; // AI just took a tower
  for (let i = 0; i < 60; i++) tick();
  assert.ok(emotes.some((e) => e.owner === 'B' && ['laugh', 'celebrate', 'king', 'cool'].includes(e.emote)), 'gloats after taking a tower');
  const count = emotes.length;
  s.towers.find((t) => t.id === 'T-B-K').hp = 0; // AI loses
  for (let i = 0; i < 5; i++) tick();
  assert.equal(s.running, false);
  assert.ok(emotes.length === count + 1 && ['gg', 'cry', 'facepalm'].includes(emotes[emotes.length - 1].emote), 'one good-game emote at the end');
});

// ─── Trophy Road cards: spells, buildings and troop mechanics ──────────────

const near = (s, side, x, y, r) => s.units.filter((u) => u.owner === side && Math.hypot(u.x - x, u.y - y) <= r);
const towerOf = (s, id) => s.towers.find((t) => t.id === id);

test('the card library has the new cards, each in one version, with an arena and a description', () => {
  const ids = ['frostnova', 'acidpool', 'tartrap', 'overdrive', 'repairwave', 'gravitywell', 'orbitallaser', 'boulder', 'paratroopers',
    'flaktower', 'infernospire', 'mortarbunker', 'teslapit', 'dronehangar', 'bonecrypt', 'elixirpump', 'sirenbeacon',
    'medicbot', 'rocktitan', 'teslatank', 'shieldknight', 'stormzeppelin', 'cryocaster', 'phantomrider', 'flakgunner', 'boomerang', 'moledriller', 'sparkspirit'];
  for (const id of ids) {
    const c = Sim.CARD_MAP[id];
    assert.ok(c, id);
    assert.ok(c.desc.length > 20, `${id} has a description`);
    assert.ok(c.arena >= 1 && c.arena <= Sim.MAX_ARENA, `${id} arena`);
    assert.ok(!Sim.CARD_MAP[`${id}-mk-ii`], `${id} has no variants`);
    assert.ok(c.ability && c.ability.name, `${id} has an ability`);
  }
  assert.equal(Sim.CARD_LIBRARY.filter((c) => c.spell).length, 12);
  assert.equal(Sim.CARD_LIBRARY.filter((c) => c.building).length, 2 + 8 + 2); // Bolt Turret (base + Mk-II), the 8 step-9 buildings, Snare Mine and War Drum
  // Tokens exist for spawning but can never be put in a deck
  for (const t of Sim.TOKEN_CARDS) {
    assert.ok(!Sim.CARD_LIBRARY.includes(t));
    assert.ok(!Sim.normalizeDeck([t.id, 'scout']).some((e) => e.id === t.id));
  }
  // Every card has a unique icon (tokens excluded)
  const icons = Sim.CARD_LIBRARY.filter((c) => c.variant === 0).map((c) => c.icon);
  assert.equal(new Set(icons).size, icons.length);
});

test('Frost Nova freezes troops, buildings and towers, then they recover', () => {
  const s = Sim.createMatch({ seed: 3 });
  const brawler = Sim.spawnDirect(s, 'B', 'brawler', 9, 21);
  const turret = Sim.spawnDirect(s, 'B', 'boltturret', 9, 23.5);
  run(s, 1.2);
  Sim.castDirect(s, 'A', 'frostnova', 9, 22.5);
  Sim.step(s);
  const y0 = brawler.y;
  assert.ok(brawler.frozenT > 0 && turret.frozenT > 0);
  run(s, 2);
  assert.ok(Math.abs(brawler.y - y0) < 0.05, 'frozen troops do not move');
  assert.equal(Sim.snapshot(s).units.find((u) => u.id === brawler.id).frz, 1);
  run(s, 1.5);
  assert.ok(brawler.frozenT <= 0);
  const y1 = brawler.y;
  run(s, 1);
  assert.ok(Math.abs(brawler.y - y1) > 0.3 || brawler.targetId, 'moves or fights again after thawing');
  // Towers freeze too
  const s2 = Sim.createMatch({ seed: 3 });
  Sim.castDirect(s2, 'A', 'frostnova', 3.5, 6.5);
  Sim.step(s2);
  assert.ok(towerOf(s2, 'T-B-L').stunT > 2.5);
});

test('Acid Pool deals its damage over 6 seconds and slows enemies in it; towers take 30%', () => {
  const s = sandbox();
  const bot = Sim.spawnDirect(s, 'B', 'zombiemob', 9, 22);
  bot.hp = bot.hpMax = 5000;
  bot.speed = 0.0001;
  Sim.castDirect(s, 'A', 'acidpool', 9, 22);
  run(s, 0.1);
  assert.ok(bot.slowT > 0, 'slowed while inside');
  run(s, 7);
  const dealt = 5000 - bot.hp;
  assert.ok(Math.abs(dealt - Sim.CARD_MAP.acidpool.dmg) < 1, `total damage ${dealt}`);
  assert.equal(s.zones.length, 0, 'pool expires');
  const t = Sim.createMatch({ seed: 2 });
  const tower = towerOf(t, 'T-B-L');
  const before = tower.hp;
  Sim.castDirect(t, 'A', 'acidpool', tower.x, tower.y);
  run(t, 7);
  assert.ok(Math.abs((before - tower.hp) - Sim.CARD_MAP.acidpool.dmg * 0.3) < 1);
});

test('Tar Trap slows movement; Overdrive speeds up only friendly troops', () => {
  const pace = (cast) => {
    const s = sandbox();
    const u = Sim.spawnDirect(s, 'A', 'brawler', 14.5, 27);
    if (cast) cast(s);
    run(s, 3);
    return 27 - u.y;
  };
  const base = pace(null);
  const tarred = pace((s) => Sim.castDirect(s, 'B', 'tartrap', 14.5, 26));
  const hasted = pace((s) => Sim.castDirect(s, 'A', 'overdrive', 14.5, 26));
  const enemyHaste = pace((s) => Sim.castDirect(s, 'B', 'overdrive', 14.5, 26));
  assert.ok(tarred < base * 0.75, `tar ${tarred} vs ${base}`);
  assert.ok(hasted > base * 1.15, `haste ${hasted} vs ${base}`);
  assert.ok(Math.abs(enemyHaste - base) < 0.05, 'enemy overdrive does nothing to us');
});

test('Repair Wave heals friendly troops and buildings, but never crown towers or enemies', () => {
  const s = sandbox();
  const mine = Sim.spawnDirect(s, 'A', 'brawler', 9, 24);
  const foe = Sim.spawnDirect(s, 'B', 'brawler', 10, 24);
  mine.hp = 100; foe.hp = 100;
  mine.speed = foe.speed = 0.0001; mine.dmg = foe.dmg = 0.0001;
  const tower = towerOf(s, 'T-A-L');
  tower.hp = 500;
  Sim.castDirect(s, 'A', 'repairwave', 9.5, 24);
  Sim.castDirect(s, 'A', 'repairwave', tower.x, tower.y);
  run(s, 3.5);
  assert.ok(Math.abs(mine.hp - (100 + Sim.CARD_MAP.repairwave.dmg)) < 1, `healed to ${mine.hp}`);
  assert.ok(foe.hp <= 100);
  assert.equal(tower.hp, 500);
});

test('Gravity Well pulls enemy troops together but cannot drag ground troops into the river', () => {
  const s = sandbox();
  const a = Sim.spawnDirect(s, 'B', 'brawler', 7, 22);
  const b = Sim.spawnDirect(s, 'B', 'brawler', 11, 22);
  a.speed = b.speed = 0.0001;
  Sim.castDirect(s, 'A', 'gravitywell', 9, 22);
  run(s, 2.3);
  assert.ok(Math.abs(b.x - a.x) < 2, `pulled together: ${a.x.toFixed(2)} ${b.x.toFixed(2)}`);
  assert.ok(a.hp < a.hpMax);
  const r = sandbox();
  const c = Sim.spawnDirect(r, 'B', 'brawler', 9, 18);
  c.speed = 0.0001;
  Sim.castDirect(r, 'A', 'gravitywell', 9, 15.5);
  run(r, 2.3);
  assert.ok(!Sim.isRiverPoint(c.x, c.y), 'stays on land');
});

test('Orbital Laser waits, then hits the 3 toughest enemies in range', () => {
  const s = sandbox();
  const big = ['siege', 'brawler', 'guardian'].map((id, i) => Sim.spawnDirect(s, 'B', id, 8 + i, 22));
  const small = Sim.spawnDirect(s, 'B', 'mechmice', 9, 23);
  s.units.forEach((u) => { u.speed = 0.0001; u.dmg = 0.0001; });
  Sim.castDirect(s, 'A', 'orbitallaser', 9, 22.5);
  run(s, 0.5);
  assert.ok(big.every((u) => u.hp === u.hpMax), 'nothing before the lock-on finishes');
  run(s, 0.6);
  assert.ok(big.every((u) => u.hp < u.hpMax), 'big three hit');
  assert.equal(small.hp, small.hpMax, 'the small fry is ignored');
});

test('Boulder Roll travels toward the enemy, hits each ground troop once and knocks it back; flyers are safe', () => {
  const s = sandbox();
  const g = Sim.spawnDirect(s, 'B', 'brawler', 9, 22);
  const air = Sim.spawnDirect(s, 'B', 'nanodrones', 9, 21);
  g.speed = air.speed = 0.0001;
  Sim.castDirect(s, 'A', 'boulder', 9, 25);
  run(s, 2.5);
  assert.equal(g.hpMax - g.hp, Sim.CARD_MAP.boulder.dmg);
  assert.ok(g.y < 21.5, `knocked forward to ${g.y}`);
  assert.equal(air.hp, air.hpMax);
});

test('Paratroopers drop all their troopers over time, even beside an enemy tower', () => {
  const s = sandbox();
  Sim.castDirect(s, 'A', 'paratroopers', 3.5, 9);
  run(s, 1);
  const early = near(s, 'A', 3.5, 9, 3.5).length;
  run(s, 4);
  const all = near(s, 'A', 3.5, 9, 4.5).concat(s.units.filter((u) => u.owner === 'A' && u.cardId === 'paratrooper'));
  assert.ok(early >= 1 && early < Sim.CARD_MAP.paratroopers.zone.count, `trickles in (${early} after 1s)`);
  assert.equal(new Set(all.filter((u) => u.cardId === 'paratrooper').map((u) => u.id)).size, Sim.CARD_MAP.paratroopers.zone.count);
  assert.ok(s.units.every((u) => u.cardId !== 'paratrooper' || u.costShare === 0), 'tokens carry no elixir value');
});

test('Flak Tower and Flak Gunner only shoot flyers', () => {
  const s = sandbox();
  Sim.spawnDirect(s, 'A', 'flaktower', 9, 22);
  const gunner = Sim.spawnDirect(s, 'A', 'flakgunner', 12, 24);
  const ground = Sim.spawnDirect(s, 'B', 'brawler', 9, 19.5);
  ground.speed = 0.0001; ground.dmg = 0.0001;
  run(s, 3);
  assert.equal(ground.hp, ground.hpMax, 'ground troops are ignored');
  assert.ok(Math.hypot(gunner.x - 12, gunner.y - 24) < 0.3, 'gunner holds position with no air target');
  const drone = Sim.spawnDirect(s, 'B', 'nanodrones', 10, 19.5);
  drone.speed = 0.0001;
  run(s, 2);
  assert.ok(drone.hp < drone.hpMax || !s.units.includes(drone));
});

test('Inferno Spire ramps up on one target and resets after a stun', () => {
  const s = sandbox();
  const spire = Sim.spawnDirect(s, 'A', 'infernospire', 9, 22);
  const tank = Sim.spawnDirect(s, 'B', 'siege', 9, 18.5);
  tank.hp = tank.hpMax = 100000; tank.speed = 0.0001; tank.dmg = 0.0001;
  let hp = tank.hp;
  run(s, 1);
  const early = hp - tank.hp;
  hp = tank.hp;
  run(s, 4);
  run(s, 1, () => { hp = tank.hp; return false; });
  const t0 = tank.hp;
  run(s, 1);
  const late = t0 - tank.hp;
  assert.ok(late > early * 3, `ramp: early ${early.toFixed(0)}/s, late ${late.toFixed(0)}/s`);
  assert.ok(Sim.snapshot(s).units.find((u) => u.id === spire.id).rmp > 0.9);
  Sim.castDirect(s, 'B', 'shock', 9, 22);
  Sim.step(s);
  assert.equal(spire.rampT, 0);
});

test('Mortar Bunker reaches a princess tower from beside the river but cannot hit nearby troops', () => {
  const s = Sim.createMatch({ seed: 4 });
  s.towers.forEach((t) => { t.active = false; });
  Sim.spawnDirect(s, 'A', 'mortarbunker', 5.7, 18.5);
  const tower = towerOf(s, 'T-B-L');
  run(s, 8);
  assert.ok(tower.hp < tower.hpMax, 'shells the tower');
  const r = sandbox();
  Sim.spawnDirect(r, 'A', 'mortarbunker', 9, 22);
  const pest = Sim.spawnDirect(r, 'B', 'brawler', 9, 20.5);
  pest.speed = 0.0001; pest.dmg = 0.0001;
  run(r, 6);
  assert.equal(pest.hp, pest.hpMax, 'inside the minimum range');
});

test('Tesla Pit hides until something comes in range, and hidden it cannot be targeted', () => {
  const s = sandbox();
  const pit = Sim.spawnDirect(s, 'A', 'teslapit', 9, 24);
  run(s, 1.2);
  assert.ok(pit.hidden);
  const hog = Sim.spawnDirect(s, 'B', 'scout', 9, 12);
  run(s, 0.5);
  assert.notEqual(hog.targetId, pit.id, 'a hidden pit is not a target');
  run(s, 6);
  assert.ok(!pit.hidden || hog.hp < hog.hpMax, 'popped up to fight');
  assert.ok(hog.hp < hog.hpMax);
});

test('Drone Hangar and Bone Crypt spawn tokens over time and more when destroyed', () => {
  const s = sandbox();
  const hangar = Sim.spawnDirect(s, 'A', 'dronehangar', 5, 26);
  const crypt = Sim.spawnDirect(s, 'A', 'bonecrypt', 13, 26);
  run(s, 6);
  const count = (id) => s.units.filter((u) => u.cardId === id).length;
  assert.ok(count('hangardrone') >= 1);
  assert.ok(count('cryptskel') >= 2);
  const before = count('cryptskel');
  crypt.hp = 0;
  Sim.step(s);
  assert.equal(count('cryptskel'), before + 3);
  assert.ok(hangar.hp > 0);
});

test('Elixir Pump produces elixir (never above the cap) and pays out once more when destroyed', () => {
  const s = Sim.createMatch({ seed: 9 });
  s.players.A.elixir = 0;
  const pump = Sim.spawnDirect(s, 'A', 'elixirpump', 9, 30.5);
  s.towers.forEach((t) => { t.active = false; });
  const regen = Sim.MATCH.elixirPerSec * 9.3;
  run(s, 9.3);
  assert.ok(s.players.A.elixir > regen + 0.9, `pumped: ${s.players.A.elixir.toFixed(2)}`);
  s.players.A.elixir = 9.8;
  run(s, 9);
  assert.ok(s.players.A.elixir <= Sim.MATCH.maxElixir);
  s.players.A.elixir = 0;
  pump.hp = 0;
  Sim.step(s);
  assert.ok(s.players.A.elixir >= 1);
});

test('Siren Beacon pulls enemy troops off their target', () => {
  const s = sandbox();
  const wolf = Sim.spawnDirect(s, 'B', 'brawler', 4, 21);
  const bait = Sim.spawnDirect(s, 'A', 'scrapbots', 3.5, 22);
  bait.speed = 0.0001; bait.dmg = 0.0001;
  run(s, 1);
  const beacon = Sim.spawnDirect(s, 'A', 'sirenbeacon', 8.5, 23);
  run(s, 3);
  assert.equal(wolf.targetId, beacon.id);
});

test('Medic Bot heals nearby friendly troops', () => {
  const s = sandbox();
  Sim.spawnDirect(s, 'A', 'medicbot', 9, 24);
  const hurt = Sim.spawnDirect(s, 'A', 'brawler', 9.5, 25);
  hurt.hp = 200;
  hurt.speed = 0.0001;
  run(s, 3);
  assert.ok(hurt.hp > 260, `healed to ${hurt.hp.toFixed(0)}`);
});

test('Rock Titan and Storm Zeppelin split into tokens when they die', () => {
  const s = sandbox();
  const titan = Sim.spawnDirect(s, 'A', 'rocktitan', 9, 26);
  const zep = Sim.spawnDirect(s, 'A', 'stormzeppelin', 13, 26);
  const foe = Sim.spawnDirect(s, 'B', 'brawler', 9, 27.6);
  run(s, 0.1);
  titan.hp = 0; zep.hp = 0;
  Sim.step(s);
  assert.equal(s.units.filter((u) => u.cardId === 'rockshard').length, 2);
  assert.equal(s.units.filter((u) => u.cardId === 'stormsprite' && u.air).length, Sim.CARD_MAP.stormzeppelin.mech.deathSpawn.count);
  assert.ok(foe.hp < foe.hpMax, 'titan death blast');
});

test('Tesla Tank loses its charge when stunned', () => {
  const s = sandbox();
  const tank = Sim.spawnDirect(s, 'A', 'teslatank', 9, 24);
  const foe = Sim.spawnDirect(s, 'B', 'brawler', 9, 20);
  foe.speed = 0.0001; foe.dmg = 0.0001; foe.hp = foe.hpMax = 1e5;
  run(s, 4);
  const cdBefore = tank.atkCd;
  Sim.castDirect(s, 'B', 'shock', 9, 24);
  Sim.step(s);
  assert.ok(tank.atkCd >= tank.cd - 0.1 && tank.atkCd >= cdBefore, 'charge reset');
});

test('Shield Knight soaks damage with its shield before losing health', () => {
  const s = sandbox();
  const k = Sim.spawnDirect(s, 'A', 'shieldknight', 9, 24);
  assert.ok(k.shield > 0);
  const src = { id: 'x', owner: 'B', structureMult: 1 };
  Sim.castDirect(s, 'B', 'firebomb', 9, 24);
  run(s, 2);
  assert.equal(k.hp, k.hpMax, 'health untouched while the shield holds');
  assert.ok(k.shield < k.shieldMax);
  assert.ok(Sim.snapshot(s).units.find((u) => u.id === k.id).shd < 1);
});

test('Cryo Caster slows what it hits', () => {
  const s = sandbox();
  Sim.spawnDirect(s, 'A', 'cryocaster', 9, 24);
  const foe = Sim.spawnDirect(s, 'B', 'brawler', 9, 20.5);
  foe.speed = 0.0001; foe.dmg = 0.0001; foe.hp = foe.hpMax = 1e5;
  run(s, 3);
  assert.ok(foe.slowT > 0 && foe.slowMult < 1);
});

test('Phantom Rider dashes in, untouchable, and lands a double hit', () => {
  const s = sandbox();
  const rider = Sim.spawnDirect(s, 'A', 'phantomrider', 9, 25);
  const foe = Sim.spawnDirect(s, 'B', 'brawler', 9, 21);
  foe.speed = 0.0001; foe.dmg = 0.0001; foe.hp = foe.hpMax = 1e5;
  let sawInvuln = false;
  run(s, 3, () => { if (rider.invuln) sawInvuln = true; return true; });
  assert.ok(sawInvuln, 'dashed');
  assert.ok(foe.hpMax - foe.hp >= rider.dmg * 2 - 1);
  rider.invuln = true;
  const hp = rider.hp;
  Sim.castDirect(s, 'B', 'firebomb', rider.x, rider.y);
  run(s, 2, () => { rider.invuln = true; return true; });
  assert.equal(rider.hp, hp, 'no damage while dashing');
});

test('Boomerang Bot hits every ground enemy in its line, twice', () => {
  const s = sandbox();
  Sim.spawnDirect(s, 'A', 'boomerang', 9, 25);
  const line = [21.5, 22.6].map((y) => Sim.spawnDirect(s, 'B', 'brawler', 9, y));
  line.forEach((u) => { u.speed = 0.0001; u.dmg = 0.0001; u.hp = u.hpMax = 1e5; });
  run(s, 1.5);
  const dmg = Sim.CARD_MAP.boomerang.dmg;
  line.forEach((u) => assert.ok(u.hpMax - u.hp >= dmg * 2 - 1, `${(u.hpMax - u.hp).toFixed(0)} dealt`));
});

test('Mole Driller deploys anywhere legal (not on water or towers), tunnels slower far away and chips towers', () => {
  const s = Sim.createMatch({ seed: 5, decks: { A: ['moledriller', 'scout', 'brawler', 'siege', 'guardian', 'voltbug', 'drillcat', 'ramhog'] } });
  const mole = s.players.A.cards.moledriller;
  assert.ok(Sim.canDeploy(s, 'A', 9, 8, mole), 'enemy side');
  assert.ok(!Sim.canDeploy(s, 'A', 9, 16, mole), 'not the river');
  assert.ok(!Sim.canDeploy(s, 'A', 3.5, 6.5, mole), 'not on a tower');
  const snap = Sim.snapshot(s);
  let mismatch = 0;
  for (let y = 0.25; y < Sim.H; y += 0.5) for (let x = 0.25; x < Sim.W; x += 0.5) {
    if (Sim.canDeploy(s, 'A', x, y, mole) !== Sim.canDeployOnSnapshot(snap, 'A', x, y, mole)) mismatch++;
  }
  assert.equal(mismatch, 0, 'online preview agrees');
  s.players.A.elixir = 10;
  const far = Sim.deploy(s, 'A', 'moledriller', 5.6, 6.5).units[0];
  assert.ok(far.deployT > Sim.MATCH.deployTime + 0.5);
  s.towers.forEach((t) => { t.active = false; });
  const tower = towerOf(s, 'T-B-L');
  run(s, 6);
  const dealt = tower.hpMax - tower.hp;
  assert.ok(dealt > 0 && dealt < far.dmg * 6, `reduced crown damage: ${dealt.toFixed(0)}`);
});

test('Spark Spirit jumps onto a target and stuns it and the enemies around it', () => {
  const s = sandbox();
  Sim.spawnDirect(s, 'A', 'sparkspirit', 9, 25);
  const group = [[9, 21.5], [10.2, 21], [8, 21]].map(([x, y]) => Sim.spawnDirect(s, 'B', 'brawler', x, y));
  group.forEach((u) => { u.speed = 0.0001; u.dmg = 0.0001; });
  let stunned = 0;
  run(s, 3, () => { stunned = Math.max(stunned, group.filter((u) => u.stunT > 0).length); return true; });
  assert.ok(stunned >= 2, `stunned ${stunned}`);
  assert.ok(!s.units.some((u) => u.cardId === 'sparkspirit'), 'spirit is spent');
});

test('the AI deck builder only uses cards from the allowed arenas and always fields a full, sane deck', () => {
  for (let arena = 0; arena <= Sim.MAX_ARENA; arena++) {
    for (let i = 0; i < 20; i++) {
      const deck = Sim.buildAiDeck(arena, Math.random);
      assert.equal(deck.length, 8);
      assert.equal(new Set(deck.map((id) => Sim.CARD_MAP[id].slug)).size, 8, 'one version per card');
      deck.forEach((id) => assert.ok(Sim.CARD_MAP[id].arena <= arena && !Sim.CARD_MAP[id].token));
      assert.ok(deck.some((id) => Sim.CARD_MAP[id].winCondition), 'has a win condition');
      assert.ok(deck.some((id) => Sim.CARD_MAP[id].spell), 'has a spell');
    }
  }
});

test('AI vs AI with the new cards plays full, legal matches and uses spells and buildings', () => {
  let spells = 0;
  let buildings = 0;
  for (let i = 0; i < 6; i++) {
    const r = (() => { let k = 5 + i; return () => ((k = (k * 16807) % 2147483647) / 2147483647); })();
    const s = Sim.createMatch({ seed: 31 + i, decks: { A: Sim.buildAiDeck(9, r), B: Sim.buildAiDeck(9, r) } });
    const ai = { A: Sim.createAi('A', {}, 1 + i), B: Sim.createAi('B', {}, 2 + i) };
    let steps = 0;
    while (s.running && steps < 20 * 260) {
      for (const side of ['A', 'B']) {
        const res = Sim.aiUpdate(s, ai[side], STEP);
        if (res) assert.ok(res.ok, `AI only makes legal moves (${res.reason})`);
      }
      Sim.step(s);
      // Count every building played (not just those still standing at the end)
      buildings += Sim.takeFx(s).filter((f) => f.type === 'deploy' && Sim.CARD_MAP[f.cardId] && Sim.CARD_MAP[f.cardId].building).length;
      steps++;
      assert.ok(s.players.A.elixir >= 0 && s.players.B.elixir >= 0);
    }
    assert.ok(!s.running, 'match finished');
    spells += s.castLog.length;
  }
  assert.ok(spells > 0, 'spells were cast');
  assert.ok(buildings > 0, 'buildings were placed');
});

test('removed Twin/Burst/Core versions are gone, and old ids map to the base card', () => {
  assert.ok(!Sim.CARD_LIBRARY.some((c) => /-(twin|burst|core)$/.test(c.id)));
  assert.ok(Sim.CARD_MAP['brawler-mk-ii']);
  assert.equal(Sim.migrateCardId('brawler-twin'), 'brawler');
  assert.equal(Sim.migrateCardId('flarepod-core'), 'flarepod');
  assert.equal(Sim.migrateCardId('brawler-mk-ii'), 'brawler-mk-ii');
  assert.equal(Sim.migrateCardId('nonsense-twin'), null);
  assert.equal(Sim.migrateCardId(42), null);
});

// ── Thorn Golem, Siphon Priest, Snare Mine, War Drum (2026-10-15) ─────────────
function arenaWith() {
  const s = Sim.createMatch({ seed: 3, decks: { A: Sim.STARTER_DECK, B: Sim.STARTER_DECK } });
  s.towers.forEach((t) => { t.hp = t.hpMax = 1e7; t.dmg = 0; }); // towers stay out of it
  return s;
}
const stepN = (s, n) => { for (let i = 0; i < n; i++) Sim.step(s); };

test('Thorn Golem reflects part of melee hits (capped per hit), never ranged ones, and never back and forth', () => {
  const s = arenaWith();
  const g = Sim.spawnDirect(s, 'A', 'thorngolem', 9, 20, 1);
  g.speed = 0; g.targets = 'none';
  const brute = Sim.spawnDirect(s, 'B', 'brawler', 9, 19.2, 1);
  stepN(s, 120);
  assert.ok(g.hp < g.hpMax, 'the golem was hit');
  assert.ok(brute.hp < brute.hpMax, 'the melee attacker took thorns');
  const taken = brute.hpMax - brute.hp;
  const dealt = g.hpMax - g.hp;
  assert.ok(taken <= dealt * 0.35 + 1, 'at most 35% comes back');
  const t = arenaWith();
  const g2 = Sim.spawnDirect(t, 'A', 'thorngolem', 9, 20, 1);
  g2.speed = 0; g2.targets = 'none';
  const archer = Sim.spawnDirect(t, 'B', 'voltbug', 9, 16.5, 1);
  archer.speed = 0;
  stepN(t, 200);
  assert.ok(g2.hp < g2.hpMax);
  assert.equal(archer.hp, archer.hpMax, 'ranged attackers are not reflected');
  // Two golems hitting each other would loop if thorns were reflected again; they don't
  const u = arenaWith();
  const a = Sim.spawnDirect(u, 'A', 'thorngolem', 9, 20, 1);
  const b = Sim.spawnDirect(u, 'B', 'thorngolem', 9, 19.2, 1);
  a.targets = b.targets = 'ground'; a.speed = b.speed = 0;
  stepN(u, 60);
  assert.ok(Number.isFinite(a.hp) && Number.isFinite(b.hp));
});

test('Siphon Priest heals itself from the damage it deals, never above full', () => {
  const s = arenaWith();
  const p = Sim.spawnDirect(s, 'A', 'siphonpriest', 9, 20, 1);
  p.speed = 0;
  p.hp = p.hpMax * 0.5;
  const dummy = Sim.spawnDirect(s, 'B', 'guardian', 9, 17, 1);
  dummy.speed = 0; dummy.targets = 'none';
  stepN(s, 160);
  assert.ok(dummy.hp < dummy.hpMax, 'it attacked');
  assert.ok(p.hp > p.hpMax * 0.5, 'and healed');
  stepN(s, 2000);
  assert.ok(p.hp <= p.hpMax);
});

test('Snare Mine is hidden, ignores flyers, and goes off once on ground troops: damage and a root in its area', () => {
  const s = arenaWith();
  const m = Sim.spawnDirect(s, 'A', 'snaremine', 9, 20, 1);
  stepN(s, 30);
  assert.equal(m.hidden, true, 'buried');
  const flyer = Sim.spawnDirect(s, 'B', 'hawkstrike', 9, 20.4, 1);
  flyer.speed = 0; flyer.targets = 'none';
  stepN(s, 30);
  assert.ok(m.hp > 0, 'flyers pass over it');
  const walkers = [Sim.spawnDirect(s, 'B', 'brawler', 9.4, 20.6, 1), Sim.spawnDirect(s, 'B', 'junkpack', 8.2, 21.2, 1)];
  walkers.forEach((w) => { w.targets = 'none'; });
  Sim.step(s);
  assert.ok(m.hp <= 0, 'sprung');
  walkers.forEach((w) => { assert.ok(w.hp < w.hpMax, 'damaged'); if (w.hp > 0) assert.ok(w.stunT > 1.5, 'survivors are rooted'); });
  assert.equal(flyer.hp, flyer.hpMax, 'the flyer was not hit');
  const fx = Sim.takeFx(s);
  assert.equal(fx.filter((f) => f.type === 'trap').length, 1, 'once');
});

test('War Drum: friendly troops in range hit 35% harder; out of range and enemies do not', () => {
  const hitFor = (withDrum, dx, drumOwner) => {
    const s = arenaWith();
    if (withDrum) Sim.spawnDirect(s, drumOwner || 'A', 'wardrum', 9 + dx, 22, 1);
    const b = Sim.spawnDirect(s, 'A', 'brawler', 9, 20, 1);
    b.speed = 0;
    const d = Sim.spawnDirect(s, 'B', 'guardian', 9, 19.3, 1);
    d.speed = 0; d.targets = 'none';
    stepN(s, 120);
    return d.hpMax - d.hp;
  };
  const base = hitFor(false, 0);
  assert.ok(base > 0);
  assert.ok(Math.abs(hitFor(true, 0) - base * 1.35) < base * 0.02, 'in range: +35%');
  assert.ok(Math.abs(hitFor(true, 6) - base) < 1, 'out of range: normal');
  assert.ok(Math.abs(hitFor(true, 0, 'B') - base) < 1, "the enemy's drum doesn't help you");
});

test('the AI plays the new buildings sensibly: a mine against ground pushes, a drum next to its own push', () => {
  const deck = ['snaremine', 'wardrum', 'brawler', 'scout', 'voltbug', 'flarepod', 'firebomb', 'ramhog'];
  let mines = 0, drums = 0, drumNearTroops = 0;
  for (let i = 0; i < 4; i++) {
    const s = Sim.createMatch({ seed: 60 + i, decks: { A: Sim.STARTER_DECK, B: deck } });
    const ai = [Sim.createAi('A', null, 10 + i), Sim.createAi('B', null, 20 + i)];
    for (let k = 0; k < 3600 && s.running; k++) {
      ai.forEach((b) => {
        const r = Sim.aiUpdate(s, b, STEP);
        if (r && r.ok && b.side === 'B' && r.units && r.units[0]) {
          if (r.units[0].cardId === 'snaremine') mines++;
          if (r.units[0].cardId === 'wardrum') {
            drums++;
            if (s.units.some((u) => u.owner === 'B' && u.kind === 'troop' && Math.hypot(u.x - r.units[0].x, u.y - r.units[0].y) <= 4)) drumNearTroops++;
          }
        }
      });
      Sim.step(s);
    }
  }
  assert.ok(mines > 0, 'mines get played');
  assert.ok(drums > 0, 'drums get played');
  assert.ok(drumNearTroops / drums >= 0.5, 'drums mostly go next to its own troops');
});
