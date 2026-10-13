'use strict';

// Evolution progression (shards, Wild Shards, unlocks, slots) and its Trophy Road rewards. Run with: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../shared/evo-progress');
const T = require('../shared/trophy-road');
const Sim = require('../shared/clash-sim');

const SLUGS = Object.keys(Sim.EVOLUTIONS);
const slugOf = (id) => { const e = Sim.evolutionOf(id); return e ? Sim.CARD_MAP[id].slug : null; };
const NEED = E.RULES.SHARDS_TO_UNLOCK;

test('shards add up and unlock exactly once at the requirement', () => {
  const evo = E.fresh();
  assert.equal(E.addShards(evo, 'brawler', 2).unlocked, false);
  assert.equal(E.shardsOf(evo, 'brawler'), 2);
  const r = E.addShards(evo, 'brawler', NEED - 2);
  assert.equal(r.unlocked, true);
  assert.ok(E.isUnlocked(evo, 'brawler'));
  assert.equal(E.addShards(evo, 'brawler', 1).unlocked, false, 'no second unlock');
});

test('extra shards never vanish: overflow becomes Wild Shards, and past the cap, gold', () => {
  const evo = E.fresh();
  const r = E.addShards(evo, 'voltbug', NEED + 3);
  assert.ok(r.unlocked);
  assert.equal(r.wild, 3);
  const more = E.addShards(evo, 'voltbug', E.RULES.WILD_CAP);
  assert.equal(evo.wild, E.RULES.WILD_CAP);
  assert.equal(more.gold, 3 * E.RULES.GOLD_PER_SHARD);
  assert.equal(more.wild + more.gold / E.RULES.GOLD_PER_SHARD, E.RULES.WILD_CAP);
});

test('Wild Shards go into locked Evolutions only', () => {
  const evo = E.fresh();
  evo.wild = 2;
  E.addShards(evo, 'shock', NEED - 1);
  const r = E.useWild(evo, 'shock');
  assert.ok(r.unlocked);
  assert.equal(E.useWild(evo, 'shock'), null, 'already unlocked');
  assert.equal(evo.wild, 1);
  evo.wild = 0;
  assert.equal(E.useWild(evo, 'siege'), null, 'none left');
});

test('equipping: needs an unlocked Evolution, the card in the deck, and a free slot', () => {
  const evo = E.fresh();
  const deck = ['brawler', 'voltbug', 'siege', 'scout', 'guardian', 'drillcat', 'ramhog', 'flarepod'];
  assert.equal(E.toggleEquip(evo, 0, 'scout', deck, slugOf, 2).reason, 'no-evo');
  assert.equal(E.toggleEquip(evo, 0, 'brawler', deck, slugOf, 2).reason, 'locked');
  ['brawler', 'voltbug', 'siege', 'shock'].forEach((s) => E.addShards(evo, s, NEED));
  assert.ok(E.toggleEquip(evo, 0, 'brawler', deck, slugOf, 2).ok);
  assert.ok(E.toggleEquip(evo, 0, 'voltbug', deck, slugOf, 2).ok);
  assert.equal(E.toggleEquip(evo, 0, 'siege', deck, slugOf, 2).reason, 'full');
  assert.equal(E.toggleEquip(evo, 0, 'shock', deck, slugOf, 2).reason, 'not-in-deck');
  assert.equal(E.toggleEquip(evo, 0, 'brawler', deck, slugOf, 2).equipped, false, 'toggles off');
  // Decks are separate
  assert.ok(E.toggleEquip(evo, 1, 'siege', deck, slugOf, 2).ok);
  assert.deepEqual(E.validEquipped(evo, 0, deck, slugOf, 2), ['voltbug']);
  // A card that leaves the deck drops out of the valid list
  assert.deepEqual(E.validEquipped(evo, 1, deck.filter((x) => x !== 'siege'), slugOf, 2), []);
  // A mode with fewer slots trims the list
  evo.equipped[2] = ['brawler', 'voltbug'];
  assert.deepEqual(E.validEquipped(evo, 2, deck, slugOf, 1), ['brawler']);
});

test('saves are cleaned: unknown Evolutions, junk numbers, full bars repaired, equips of locked ones dropped', () => {
  const evo = E.normalize({ shards: { brawler: 99, nope: 3, siege: 'x', voltbug: 6 }, unlocked: { fake: 1 }, wild: -4, equipped: [['brawler', 'siege', 7]], seen: { brawler: 1 } }, SLUGS, slugOf);
  assert.equal(evo.shards.brawler, NEED);
  assert.ok(evo.unlocked.brawler && evo.unlocked.voltbug, 'full bars count as unlocked');
  assert.ok(!('nope' in evo.shards) && !('fake' in evo.unlocked));
  assert.equal(evo.shards.siege, 0);
  assert.equal(evo.wild, 0);
  assert.deepEqual(evo.equipped[0], ['brawler']);
  assert.equal(evo.equipped.length, 3);
  assert.deepEqual(E.normalize(undefined, SLUGS, slugOf), E.fresh());
});

test('Trophy Road hands out Evolution Shards for real Evolutions, with an early complete one', () => {
  const shardStops = T.MILESTONES.filter((m) => m.rewards.some((r) => r.type === 'shards' || r.type === 'wild'));
  assert.ok(shardStops.length >= 10);
  shardStops.flatMap((m) => m.rewards).filter((r) => r.type === 'shards').forEach((r) => assert.ok(Sim.EVOLUTIONS[r.slug], r.slug));
  const first = shardStops[0];
  assert.ok(first.trophies <= 200 && first.rewards[0].amount >= NEED, 'first Evolution comes early and complete');
  // Milestones stay unique and ordered with the shard stops mixed in
  T.MILESTONES.forEach((m, i) => { if (i) assert.ok(m.trophies > T.MILESTONES[i - 1].trophies); });
});
