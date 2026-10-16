// C.H.A.O.S.: card upgrades chosen mid-battle (clash-sim.js "C.H.A.O.S. card upgrades", events.js `upgrades`)
const test = require('node:test');
const assert = require('node:assert/strict');
const Sim = require('../shared/clash-sim.js');
const Events = require('../shared/events.js');

const STEP = Sim.MATCH.step;
const DECK_A = ['brawler', 'scout', 'voltbug', 'flarepod', 'firebomb', 'shock', 'boltturret', 'hawkstrike'];
const DECK_B = ['rocktitan', 'cryocaster', 'junkpack', 'bugsquad', 'rocketrain', 'boulder', 'bonecrypt', 'mechmice'];

function chaosMatch(opts) {
  const o = opts || {};
  const rules = { cardLevel: 11, evo: { disabled: true }, upgrades: { checkpoints: o.checkpoints || [{ at: 1, rarity: 'common' }, { at: 30, rarity: 'rare' }], choiceSecs: o.choiceSecs || 10, pause: o.pause !== false }, ...(o.rules || {}) };
  return Sim.createMatch({ seed: o.seed || 7, rules, decks: { A: (o.A || DECK_A).map((id) => ({ id, level: o.level || 4 })), B: (o.B || DECK_B).map((id) => ({ id, level: o.level || 4 })) } });
}
function stepUntil(s, fn, max) { for (let i = 0; i < (max || 10000) && s.running && !fn(); i++) Sim.step(s); }
// A quiet board for unit tests: towers can't be hurt and nothing gets in the way
function quietChaos(opts) {
  const s = chaosMatch(opts);
  s.towers.forEach((t) => { t.hp = t.hpMax = 1e7; });
  return s;
}

test('the upgrade table is sound: every pool card is real and has a Common, a Rare and an Epic upgrade', () => {
  assert.deepEqual(Sim.validateUpgrades(), []);
  assert.ok(Sim.CHAOS_POOL.length >= 20, 'a real pool');
  for (const id of Sim.CHAOS_POOL) {
    const c = Sim.CARD_MAP[id];
    assert.ok(c && !c.token && c.variant === 0, `${id} is a real base card`);
    assert.deepEqual([...new Set(Sim.upgradesFor(id).map((u) => u.rarity))].sort(), ['common', 'epic', 'rare'], id);
  }
  for (const u of Sim.CHAOS_UPGRADES) {
    assert.ok(u.name && u.desc.length > 5 && Sim.UPGRADE_RARITIES[u.rarity], u.id);
    assert.ok(u.stats || u.mech || u.em || u.spell || u.zone, `${u.id} changes something real`);
  }
});

test('deck rules: only pool cards, 8 different ones; saved decks are cleaned; loaner decks are legal', () => {
  assert.ok(Events.validateDeck('upgrades', DECK_A).ok);
  const bad = Events.validateDeck('upgrades', ['siege', ...DECK_A.slice(1)]);
  assert.equal(bad.ok, false);
  assert.match(bad.problems.join(' '), /C\.H\.A\.O\.S\. card pool/);
  assert.equal(Events.validateDeck('upgrades', DECK_A.slice(0, 7)).ok, false, 'too few');
  assert.equal(Events.validateDeck('upgrades', [...DECK_A.slice(0, 7), 'brawler']).ok, false, 'duplicate');
  assert.deepEqual(Events.cleanChaosDeck(['brawler', 'siege', 'brawler', 42, 'scout']), ['brawler', 'scout']);
  for (let seed = 1; seed < 30; seed++) assert.ok(Events.validateDeck('upgrades', Events.loanerDeck('upgrades', seed)).ok, `loaner ${seed}`);
  const P = Events.normalizeProgress({ chaosDeck: ['brawler', 'siege', 'scout'] });
  assert.deepEqual(P.chaosDeck, ['brawler', 'scout']);
  assert.deepEqual(Events.normalizeProgress(undefined).chaosDeck, []);
});

test('card levels are set to 11 for the match only; the deck entries and the card table are untouched', () => {
  const entries = DECK_A.map((id) => ({ id, level: 3 }));
  const before = JSON.stringify(entries);
  const hp = Sim.CARD_MAP.brawler.hp;
  const s = Sim.createMatch({ seed: 1, rules: { cardLevel: 11 }, decks: { A: entries, B: DECK_B.map((id) => ({ id, level: 14 })) } });
  Object.values(s.players.A.cards).forEach((c) => assert.equal(c.level, 11));
  Object.values(s.players.B.cards).forEach((c) => assert.equal(c.level, 11));
  assert.equal(s.players.A.cards.brawler.hpScaled, Sim.getCardStatsAtLevel('brawler', 11).hpScaled);
  assert.equal(JSON.stringify(entries), before);
  assert.equal(Sim.CARD_MAP.brawler.hp, hp);
});

test('a checkpoint opens two real offers per side, of its rarity, for cards in that deck', () => {
  const s = chaosMatch();
  assert.equal(s.chaos.active, null);
  stepUntil(s, () => s.chaos.active);
  const a = s.chaos.active;
  assert.ok(a, 'opened');
  assert.equal(a.rarity, 'common');
  for (const side of ['A', 'B']) {
    const o = a.offers[side];
    assert.equal(o.offers.length, 2);
    assert.equal(o.rarity, 'common');
    o.offers.forEach((off) => {
      const u = Sim.CHAOS_UPGRADE_MAP[off.upgradeId];
      assert.ok(s.players[side].cards[off.cardId], 'a card in this deck');
      assert.equal(u.card, Sim.CARD_MAP[off.cardId].slug, 'an upgrade for that card');
      assert.equal(u.rarity, 'common');
    });
    assert.notEqual(o.offers[0].cardId, o.offers[1].cardId, 'two different cards');
  }
  // Both sides get their own roll
  assert.notDeepEqual(a.offers.A.offers, a.offers.B.offers);
});

test('while a choice is open the battle is frozen: no time, elixir, movement or deploys', () => {
  const s = quietChaos();
  const u = Sim.spawnDirect(s, 'A', 'brawler', 9, 21);
  stepUntil(s, () => s.chaos.active);
  const t = s.time;
  const el = s.players.A.elixir;
  const y = u.y;
  for (let i = 0; i < 60; i++) Sim.step(s);
  assert.equal(s.time, t);
  assert.equal(s.players.A.elixir, el);
  assert.equal(u.y, y);
  assert.ok(Sim.choicePaused(s));
  const r = Sim.deploy(s, 'A', s.players.A.hand[0], 9, 21);
  assert.equal(r.ok, false);
  assert.match(r.reason, /upgrade/i);
  assert.ok(s.chaos.active.wait < 10, 'only the choice timer runs');
});

test('timeout: the left offer is taken for anyone who has not chosen, exactly once, and play resumes', () => {
  const s = chaosMatch({ choiceSecs: 4 });
  stepUntil(s, () => s.chaos.active);
  const offers = s.chaos.active.offers;
  assert.ok(Sim.chooseUpgrade(s, 'B', 1).ok);
  const t = s.time;
  for (let i = 0; i < Math.ceil(4 / STEP) + 2; i++) Sim.step(s);
  assert.equal(s.chaos.active, null, 'closed');
  assert.ok(s.time > t, 'resumed');
  const a = s.chaos.history.find((h) => h.side === 'A');
  const b = s.chaos.history.find((h) => h.side === 'B');
  assert.deepEqual(a.chosen, offers.A.offers[0]);
  assert.equal(a.auto, true);
  assert.deepEqual(b.chosen, offers.B.offers[1]);
  assert.equal(b.auto, false);
  assert.equal(s.chaos.history.length, 2, 'one record per side');
  assert.equal(s.chaos.upgrades.A[offers.A.offers[0].cardId], offers.A.offers[0].upgradeId);
  assert.equal(s.chaos.upgrades.A[offers.A.offers[1].cardId], undefined, 'the other offer is discarded');
});

test('a pick resolves once: repeats, late picks and bad picks are refused', () => {
  const s = chaosMatch();
  assert.equal(Sim.chooseUpgrade(s, 'A', 0).ok, false, 'nothing open yet');
  stepUntil(s, () => s.chaos.active);
  assert.equal(Sim.chooseUpgrade(s, 'A', 2).ok, false);
  assert.equal(Sim.chooseUpgrade(s, 'C', 0).ok, false);
  assert.ok(Sim.chooseUpgrade(s, 'A', 0).ok);
  assert.equal(Sim.chooseUpgrade(s, 'A', 1).ok, false, 'already chosen');
  assert.ok(Sim.chooseUpgrade(s, 'B', 0).ok);
  Sim.step(s);
  assert.equal(s.chaos.active, null);
  assert.equal(Sim.chooseUpgrade(s, 'A', 1).ok, false, 'too late');
  assert.equal(Object.keys(s.chaos.upgrades.A).length, 1);
});

test('an upgraded card is never offered again, and later checkpoints use their own rarity', () => {
  const s = chaosMatch({ checkpoints: [{ at: 1, rarity: 'common' }, { at: 3, rarity: 'rare' }, { at: 5, rarity: 'epic' }] });
  const got = [];
  for (let n = 0; n < 3; n++) {
    stepUntil(s, () => s.chaos.active);
    const a = s.chaos.active;
    assert.equal(a.offers.A.rarity, ['common', 'rare', 'epic'][n]);
    a.offers.A.offers.forEach((o) => assert.ok(!got.includes(o.cardId), `${o.cardId} already upgraded`));
    got.push(a.offers.A.offers[0].cardId);
    Sim.chooseUpgrade(s, 'A', 0);
    Sim.chooseUpgrade(s, 'B', 0);
    Sim.step(s);
  }
  assert.equal(Object.keys(s.chaos.upgrades.A).length, 3);
});

test('falls back to another rarity, then skips safely when a deck has nothing left to upgrade', () => {
  // A deck of 8 pool cards can take 8 upgrades; a 9th checkpoint has nothing to offer
  const checkpoints = Array.from({ length: 9 }, (_, i) => ({ at: 1 + i, rarity: 'epic' }));
  const s = chaosMatch({ checkpoints });
  let opened = 0;
  for (let n = 0; n < 9; n++) {
    stepUntil(s, () => s.chaos.active || s.chaos.next > n, 400);
    if (s.chaos.active) { opened++; ['A', 'B'].forEach((side) => { if (s.chaos.active.offers[side]) Sim.chooseUpgrade(s, side, 0); }); Sim.step(s); }
  }
  for (let i = 0; i < 100; i++) Sim.step(s);
  assert.equal(s.chaos.active, null, 'never stuck in a choice');
  assert.equal(Object.keys(s.chaos.upgrades.A).length, 8, 'every card upgraded once');
  assert.ok(opened >= 7);
  // With one upgradable card left, both offers are that card's (other rarities)
  const t = chaosMatch({ checkpoints: [{ at: 1, rarity: 'rare' }] });
  DECK_A.slice(1).forEach((id) => { t.chaos.upgrades.A[id] = 'x'; });
  const o = Sim.makeOffers(t, 'A', 0);
  assert.ok(o.offers.every((x) => x.cardId === 'brawler'));
  assert.notEqual(o.offers[0].upgradeId, o.offers[1].upgradeId);
});

function upgradeNow(s, side, cardId, upgradeId) {
  s.players[side].cards[cardId] = Sim.upgradedStats(s.players[side].cards[cardId], Sim.CHAOS_UPGRADE_MAP[upgradeId]);
  s.chaos.upgrades[side][cardId] = upgradeId;
}
function play(s, side, cardId, x, y) {
  s.players[side].elixir = 10;
  s.players[side].cooldowns[cardId] = 0;
  if (!s.players[side].hand.includes(cardId)) s.players[side].hand[0] = cardId;
  return Sim.deploy(s, side, cardId, x, y);
}

test('upgrades change real gameplay: stats, unit count, and new mechanics, on every later copy only', () => {
  const s = quietChaos({ checkpoints: [{ at: 900, rarity: 'common' }] });
  const base = s.players.A.cards.brawler.hpScaled;
  const before = play(s, 'A', 'brawler', 5, 21).units[0];
  upgradeNow(s, 'A', 'brawler', 'brawler_plating');
  for (let i = 0; i < 40; i++) Sim.step(s);
  const after = play(s, 'A', 'brawler', 7, 21).units[0];
  assert.equal(before.hpMax, base, 'a unit already on the field keeps its stats');
  assert.equal(after.hpMax, Math.round(base * 1.3));
  for (let i = 0; i < 40; i++) Sim.step(s);
  assert.equal(play(s, 'A', 'brawler', 9, 21).units[0].hpMax, Math.round(base * 1.3), 'and it lasts');
  // Count: Scout Party deploys two
  upgradeNow(s, 'A', 'scout', 'scout_party');
  assert.equal(play(s, 'A', 'scout', 11, 21).units.length, 2);
  // Mechanics: Quake Fist gives the unit the shockwave hook, through the normal combat code
  upgradeNow(s, 'B', 'junkpack', 'junkpack_rally');
  const pack = play(s, 'B', 'junkpack', 9, 9).units;
  assert.ok(pack.every((u) => u.em && u.em.rally && u.upg === 'junkpack_rally'));
  // The other side and other cards are untouched
  assert.equal(s.players.B.cards.rocktitan.upg, undefined);
  assert.equal(s.players.A.cards.voltbug.upg, undefined);
});

test('a melee upgrade fires from the real attack: Quake Fist knocks back troops near its target', () => {
  const s = quietChaos({ checkpoints: [{ at: 900, rarity: 'common' }] });
  upgradeNow(s, 'A', 'brawler', 'brawler_quake');
  const b = play(s, 'A', 'brawler', 9, 20).units[0];
  const target = Sim.spawnDirect(s, 'B', 'guardian', 9, 18.6, 11);
  const bystander = Sim.spawnDirect(s, 'B', 'mechmice', 9.8, 18.2, 11);
  target.speed = 0; bystander.speed = 0;
  let quakes = 0;
  for (let i = 0; i < 400; i++) { Sim.step(s); quakes += Sim.takeFx(s).filter((f) => f.type === 'shockwave').length; }
  assert.ok(b.evoHits >= 3, 'it attacked');
  assert.ok(quakes >= 1, 'every 3rd punch quakes');
  assert.ok(bystander.hp < bystander.hpMax, 'the quake splashed a troop it was not hitting');
});

test('spell upgrades go through the real spell code: Napalm leaves fire, Double Roll rolls twice', () => {
  const s = quietChaos({ checkpoints: [{ at: 900, rarity: 'common' }] });
  upgradeNow(s, 'A', 'firebomb', 'firebomb_napalm');
  play(s, 'A', 'firebomb', 9, 10);
  stepUntil(s, () => s.zones.some((z) => z.owner === 'A' && z.kind === 'dot'), 200);
  assert.ok(s.zones.some((z) => z.owner === 'A' && z.kind === 'dot'), 'burning ground');
  const t = quietChaos({ checkpoints: [{ at: 900, rarity: 'common' }], B: DECK_A, A: DECK_B });
  upgradeNow(t, 'A', 'boulder', 'boulder_double');
  play(t, 'A', 'boulder', 9, 20);
  assert.equal(t.zones.filter((z) => z.kind === 'roll').length, 2, 'two boulders');
});

test('nothing leaks: after a C.H.A.O.S. match a normal match has no upgrades, and the card table is unchanged', () => {
  const table = JSON.stringify(Sim.CARD_MAP.brawler);
  const s = chaosMatch();
  const ai = [Sim.createAi('A', null, 1), Sim.createAi('B', null, 2)];
  for (let i = 0; i < 3000 && s.running; i++) { ai.forEach((b) => Sim.aiUpdate(s, b, STEP)); Sim.step(s); }
  assert.ok(s.chaos.history.length >= 2);
  const n = Sim.createMatch({ seed: 7, decks: { A: DECK_A, B: DECK_B } });
  assert.equal(n.chaos, null);
  assert.equal(n.rules.upgrades, null);
  assert.equal(n.rules.cardLevel, 0);
  Object.values(n.players.A.cards).forEach((c) => assert.equal(c.upg, undefined));
  assert.equal(Sim.snapshot(n).chaos, undefined);
  assert.equal(JSON.stringify(Sim.CARD_MAP.brawler), table);
});

test('the AI makes every choice itself (before the timer), plays a full match, and its look-ahead never opens a choice', () => {
  const s = chaosMatch({ checkpoints: [{ at: 1, rarity: 'common' }, { at: 45, rarity: 'common' }, { at: 90, rarity: 'rare' }, { at: 135, rarity: 'rare' }, { at: 180, rarity: 'epic' }], seed: 11 });
  const ai = [Sim.createAi('A', null, 3), Sim.createAi('B', null, 4)];
  let steps = 0;
  while (s.running && steps < 20000) { ai.forEach((b) => Sim.aiUpdate(s, b, STEP)); Sim.step(s); steps++; }
  assert.equal(s.running, false, 'the match finished');
  // Every checkpoint that opened was answered by both sides (one at the exact final second never opens)
  assert.ok(s.chaos.next >= s.rules.upgrades.checkpoints.filter((c) => c.at < s.time - STEP).length);
  assert.equal(s.chaos.history.length, s.chaos.next * 2, 'both sides chose at every checkpoint that opened');
  assert.ok(s.chaos.history.every((h) => !h.auto), 'no timeouts');
  assert.equal(s.chaos.active, null);
  // Look-ahead copies have no C.H.A.O.S. state, so planning can't open or answer a choice
  const t = chaosMatch({ checkpoints: [{ at: 0.2, rarity: 'common' }] });
  const brain = Sim.createAi('B', { strategicChance: 1, lookahead: 2 }, 5);
  const before = JSON.stringify(t.chaos);
  Sim.aiDecide(t, brain);
  assert.equal(JSON.stringify(t.chaos), before);
});

test('the AI only reads its own offers and weighs the match situation', () => {
  const s = chaosMatch();
  stepUntil(s, () => s.chaos.active);
  const a = s.chaos.active;
  const r = () => 0.5;
  const v = a.offers.B.offers.map((o) => Sim.scoreUpgrade(s, 'B', o, r));
  v.forEach((x) => assert.ok(Number.isFinite(x)));
  // An offer for a card not in its deck is worthless to it
  assert.equal(Sim.scoreUpgrade(s, 'B', { cardId: 'brawler', upgradeId: 'brawler_plating' }, r), -Infinity);
  // Behind on crowns, an offensive upgrade scores higher than when level
  const off = { cardId: 'rocktitan', upgradeId: 'rocktitan_avalanche' };
  const level = Sim.scoreUpgrade(s, 'B', off, r);
  s.players.A.crowns = 1;
  assert.ok(Sim.scoreUpgrade(s, 'B', off, r) > level);
});

test('a checkpoint after the match is over never opens, and overtime checkpoints only open in overtime', () => {
  const s = chaosMatch({ checkpoints: [{ at: 1, rarity: 'common' }, { at: 185, rarity: 'epic' }], choiceSecs: 3 });
  s.towers.filter((t) => t.owner === 'B' && t.tower === 'princess')[0].hp = 0; // A leads on crowns at full time
  s.players.A.crowns = 1;
  for (let i = 0; i < 6000 && s.running; i++) Sim.step(s);
  assert.equal(s.running, false);
  assert.ok(s.time <= 181, 'ended at full time (A was ahead)');
  assert.equal(s.chaos.next, 1, 'the overtime checkpoint never opened');
  assert.equal(s.chaos.active, null);
});

test('every variant builds from the same engine: level 11, no Evolutions, its own schedule; Draft uses the pool', () => {
  for (const v of Events.CHAOS_VARIANTS) {
    const cfg = Events.buildMatch('upgrades', { seed: 3, tier: v.id, decks: { A: DECK_A.map((id) => ({ id, level: 2 })), B: DECK_B.map((id) => ({ id, level: 2 })) } });
    assert.equal(cfg.rules.cardLevel, 11, v.id);
    assert.equal(cfg.rules.evo.disabled, true);
    assert.equal(cfg.rules.upgrades.checkpoints.length, v.checkpoints.length);
    assert.equal(cfg.rules.blackout, v.id === 'blackout');
    const s = Sim.createMatch({ seed: 3, rules: cfg.rules, decks: cfg.decks });
    assert.ok(s.chaos, `${v.id} has a draft`);
    if (v.id === 'draft') {
      [...cfg.decks.A, ...cfg.decks.B].forEach((e) => assert.ok(Sim.CHAOS_POOL.includes(e.id), `${e.id} from the pool`));
      assert.equal(new Set(cfg.decks.A.map((e) => e.id)).size, 8);
    }
  }
  Events.CHAOS_VARIANTS.forEach((v) => assert.ok(Events.tierUnlocked(Events.freshProgress(), 'upgrades', v.id), `${v.id} is open from the start`));
  assert.equal(Events.tierUnlocked(Events.freshProgress(), 'chaos', 'wild'), false, 'Chaos Mode tiers still unlock in order');
  assert.deepEqual(Events.modesFor('upgrades', 'draft'), ['ai']);
  assert.deepEqual(Events.modesFor('upgrades', 'blackout'), ['ai', 'online']);
  assert.ok(Events.modesFor('upgrades', 'standard').includes('online'));
  assert.equal(Events.deckKind('upgrades', 'draft'), 'draft');
  assert.equal(Events.deckKind('upgrades', 'standard'), 'own');
  // A legal own deck goes in as it is; an illegal one becomes a legal loaner
  assert.equal(Events.legalDeckFor('upgrades', DECK_A.map((id) => ({ id, level: 11 })), 1, 'standard').loaner, false);
  const fixed = Events.legalDeckFor('upgrades', Sim.STARTER_DECK.map((id) => ({ id, level: 11 })), 1, 'standard');
  assert.equal(fixed.loaner, true);
  assert.ok(Events.validateDeck('upgrades', fixed.entries.map((e) => e.id)).ok);
});

test('the snapshot carries the choice (offers, timer, picks), public upgrades, history, and unit marks', () => {
  const s = chaosMatch();
  stepUntil(s, () => s.chaos.active);
  const snap = Sim.snapshot(s);
  assert.equal(snap.chaos.total, 2);
  assert.ok(snap.chaos.active.wait > 0 && snap.chaos.active.total === 10);
  assert.equal(snap.chaos.active.offers.A.offers.length, 2);
  assert.equal(snap.chaos.active.picked.A, null);
  Sim.chooseUpgrade(s, 'A', 0); Sim.chooseUpgrade(s, 'B', 0); Sim.step(s);
  const after = Sim.snapshot(s);
  assert.equal(after.chaos.active, null);
  assert.equal(Object.keys(after.chaos.upgrades.A).length, 1);
  assert.equal(after.chaos.history.length, 2);
  const card = Object.keys(s.chaos.upgrades.A)[0];
  if (!s.players.A.cards[card].spell) {
    const r = play(s, 'A', card, 9, 21);
    assert.ok(Sim.snapshot(s).units.some((u) => u.id === r.units[0].id && u.upg === s.chaos.upgrades.A[card]));
  }
  assert.equal(Sim.snapshot(chaosMatch({ rules: { blackout: true } })).blackout, 1);
});

test('every upgrade in the table deploys and fights without errors', () => {
  for (const u of Sim.CHAOS_UPGRADES) {
    const deck = [u.card, 'scout', 'brawler', 'voltbug', 'shock', 'mechmice', 'boltturret', 'firebomb'].filter((v, i, a) => a.indexOf(v) === i).slice(0, 8);
    const s = quietChaos({ A: deck, checkpoints: [{ at: 900, rarity: 'common' }] });
    upgradeNow(s, 'A', u.card, u.id);
    for (let i = 0; i < 5; i++) Sim.spawnDirect(s, 'B', ['brawler', 'junkpack', 'voltbug', 'hawkstrike', 'boltturret'][i], 4 + i * 2.5, 14, 11);
    const c = s.players.A.cards[u.card];
    const r = play(s, 'A', u.card, c.spell ? 8 : 4, c.spell ? 14 : 22);
    assert.ok(r.ok, `${u.id}: ${r.reason || ''}`);
    for (let i = 0; i < 300 && s.running; i++) Sim.step(s);
  }
});
