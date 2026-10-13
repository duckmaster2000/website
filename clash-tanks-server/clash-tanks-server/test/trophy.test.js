'use strict';

// Trophy Road rules. Run with: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../shared/trophy-road');
const Sim = require('../shared/clash-sim');

const win = (id, extra) => Object.assign({ id, result: 'win', mode: 'online' }, extra);
const loss = (id, extra) => Object.assign({ id, result: 'loss', mode: 'online' }, extra);

test('arenas climb in order and every arena has a theme; ranks read sensibly', () => {
  T.ARENAS.forEach((a, i) => {
    assert.equal(a.id, i);
    if (i) assert.ok(a.min > T.ARENAS[i - 1].min);
    assert.ok(a.theme && a.name && a.icon);
  });
  assert.equal(T.arenaFor(0).id, 0);
  assert.equal(T.arenaFor(299).id, 0);
  assert.equal(T.arenaFor(300).id, 1);
  assert.equal(T.arenaFor(99999).id, 9);
  assert.equal(T.rankOf(0).label, 'Boot Camp I');
  assert.equal(T.rankOf(290).label, 'Boot Camp III');
  assert.equal(T.rankOf(5000).label, 'Legend');
  assert.equal(T.rankOf(6900).label, 'Ultimate Champion');
});

test('online wins and losses move trophies; losses cost more higher up; draws change nothing', () => {
  const road = T.freshRoad();
  assert.equal(T.applyMatch(road, win('m1')).delta, T.ONLINE_WIN);
  assert.equal(road.trophies, 30);
  // Boot Camp losses are gentle, but you can't drop below 0
  road.trophies = 3;
  assert.equal(T.applyMatch(road, loss('m2')).after, 0);
  assert.equal(T.applyMatch(road, { id: 'm3', result: 'draw', mode: 'online' }).delta, 0);
  assert.ok(T.lossFor(4500) > T.lossFor(400));
});

test('you never drop out of an arena you reached, and never pass the cap', () => {
  const road = T.freshRoad();
  road.trophies = road.best = 705; // just inside Frost Pass
  const r = T.applyMatch(road, loss('x1'));
  assert.equal(road.trophies, 700);
  assert.ok(r.floor);
  road.trophies = road.best = T.MAX_TROPHIES - 5;
  T.applyMatch(road, win('x2'));
  assert.equal(road.trophies, T.MAX_TROPHIES);
});

test('AI difficulty sets the reward and a ceiling, so an easy AI cannot carry you up the road', () => {
  const road = T.freshRoad();
  assert.equal(T.applyMatch(road, win('a1', { mode: 'ai', difficulty: 'easy' })).delta, T.AI_RULES.easy.win);
  assert.ok(T.AI_RULES.insane.win > T.AI_RULES.normal.win && T.AI_RULES.normal.win > T.AI_RULES.easy.win);
  road.trophies = road.best = T.AI_RULES.easy.cap - 4;
  const r = T.applyMatch(road, win('a2', { mode: 'ai', difficulty: 'easy' }));
  assert.equal(r.delta, 4);
  const stuck = T.applyMatch(road, win('a3', { mode: 'ai', difficulty: 'easy' }));
  assert.equal(stuck.delta, 0);
  assert.ok(stuck.capped);
  assert.equal(T.applyMatch(road, win('a4', { mode: 'ai', difficulty: 'normal' })).delta, T.AI_RULES.normal.win);
  // Farming easy wins forever never passes its cap
  for (let i = 0; i < 500; i++) T.applyMatch(road, win(`f${i}`, { mode: 'ai', difficulty: 'easy' }));
  assert.ok(road.trophies <= Math.max(T.AI_RULES.easy.cap, 820));
});

test('the same match result is never applied twice', () => {
  const road = T.freshRoad();
  T.applyMatch(road, win('dup'));
  const again = T.applyMatch(road, win('dup'));
  assert.equal(again.applied, false);
  assert.equal(road.trophies, 30);
  assert.equal(T.applyMatch(road, { result: 'win', mode: 'online' }).applied, false, 'no id, no trophies');
});

test('reaching a new arena is reported once', () => {
  const road = T.freshRoad();
  road.trophies = road.best = 290;
  const r = T.applyMatch(road, win('up'));
  assert.equal(r.arenaUp && r.arenaUp.id, 1);
  assert.equal(T.applyMatch(road, win('up2')).arenaUp, null);
});

test('milestones: every new card is on the road exactly once, in its arena, and the road is ordered', () => {
  const given = T.MILESTONES.flatMap((m) => m.rewards.filter((r) => r.type === 'card').map((r) => ({ id: r.id, at: m.trophies })));
  const all = Object.values(T.NEW_CARDS).flat();
  assert.deepEqual(given.map((g) => g.id).sort(), all.slice().sort());
  given.forEach((g) => {
    const card = Sim.CARD_MAP[g.id];
    assert.ok(card, g.id);
    assert.equal(T.arenaFor(g.at).id, card.arena, `${g.id} is handed out in its own arena`);
  });
  const ids = new Set();
  T.MILESTONES.forEach((m, i) => {
    assert.ok(!ids.has(m.id));
    ids.add(m.id);
    if (i) assert.ok(m.trophies > T.MILESTONES[i - 1].trophies);
    assert.ok(m.rewards.length > 0);
  });
  // Emotes on the road exist in the engine's emote list
  T.MILESTONES.flatMap((m) => m.rewards).filter((r) => r.type === 'emote').forEach((r) => assert.ok(Sim.EMOTE_IDS.includes(r.id)));
});

test('milestones can be claimed once, only after reaching them, and stay claimable after losing trophies', () => {
  const road = T.freshRoad();
  const first = T.MILESTONES[0];
  assert.equal(T.claim(road, first.id), null, 'not reached yet');
  road.trophies = road.best = first.trophies;
  assert.ok(T.claimable(road).some((m) => m.id === first.id));
  assert.ok(T.claim(road, first.id));
  assert.equal(T.claim(road, first.id), null, 'already claimed');
  assert.equal(T.claim(road, 'tr-not-a-milestone'), null);
  // Losing trophies does not lock a reached reward
  const second = T.MILESTONES[1];
  road.trophies = road.best = second.trophies;
  T.applyMatch(road, loss('drop'));
  assert.ok(road.trophies < second.trophies);
  assert.ok(T.claimable(road).some((m) => m.id === second.id));
});

test('an abandoned ranked match counts as a loss exactly once', () => {
  const road = T.freshRoad();
  road.trophies = road.best = 1000;
  T.beginRanked(road, 'quit-1', 'online');
  const r = T.resolvePending(road);
  assert.ok(r.applied && r.delta < 0);
  assert.equal(T.resolvePending(road), null);
  // If the match result arrives anyway, it doesn't count a second time
  assert.equal(T.applyMatch(road, loss('quit-1')).applied, false);
  // A finished match clears its pending marker
  T.beginRanked(road, 'ok-1', 'ai', 'hard');
  T.applyMatch(road, win('ok-1', { mode: 'ai', difficulty: 'hard' }));
  assert.equal(road.pending, null);
});

test('loaded saves are cleaned up: bad numbers, unknown or unreached claims, junk pending', () => {
  const r = T.normalize({ trophies: 'abc', best: -5, claimed: { 'tr-50': 1, 'tr-5000': 1, bogus: 1 }, recent: [1, 'a'], pending: { id: 5 }, theme: 'lava' });
  assert.equal(r.trophies, 0);
  assert.equal(r.best, 0);
  assert.deepEqual(Object.keys(r.claimed), []);
  assert.deepEqual(r.recent, ['a']);
  assert.equal(r.pending, null);
  assert.equal(r.theme, null);
  const ok = T.normalize({ trophies: 900, best: 1200, claimed: { 'tr-50': 1 }, theme: 'frost' });
  assert.equal(ok.trophies, 900);
  assert.ok(ok.claimed['tr-50']);
  assert.equal(T.activeTheme(ok), 'frost');
  assert.ok(T.unlockedThemes(ok).includes('dunes'));
  assert.ok(!T.unlockedThemes(ok).includes('jungle'));
  assert.equal(T.normalize(null).trophies, 0);
});
