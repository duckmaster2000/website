/*
 * Clash Tanks special events.
 *
 * Pure rules (no DOM, no network), shared by the browser and the online server and tested in Node:
 *
 *   EVENTS        the catalog. Each event is data (name, rules text, deck rules, rewards) plus a
 *                 `build` that turns it into a match config for the engine (ClashSim rules + decks).
 *   Chaos         buildChaosSchedule() picks the timed modifiers for a Chaos match from a seed, with
 *                 compatibility, category and severity limits. The engine only plays the schedule.
 *   Decks         validateDeck / loanerDeck / draft rounds / mirror and roulette decks.
 *   Rotation      rotation(now): permanent, daily and weekly events from the UTC date, so everyone
 *                 with a correct clock sees the same line-up (no server needed; see limitations).
 *   Progress      records, daily reward caps, first wins, milestones, challenges and achievements.
 *                 settleMatch() applies a result at most once per match id.
 *
 * The engine never sees event names: an event is only a combination of engine rules.
 * Adding an event: see CLASH_TANKS.md, "Adding a special event".
 */
(function (root, factory) {
  const sim = typeof module === 'object' && module.exports ? require('./clash-sim') : root && root.ClashSim;
  const api = factory(sim);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ClashEvents = api;
})(typeof window !== 'undefined' ? window : null, function (Sim) {
  'use strict';

  const DAY_MS = 86400000;
  const EVENT_LEVEL = 9;         // default card level for decks the event hands out (the page passes your average level)
  const DAILY_WIN_CAP = 3;       // rewarded wins per event per day (records still count after that)
  const DAILY_PLAY_CAP = 6;      // rewarded participations per event per day
  const SETTLED_KEEP = 60;       // how many settled match ids are remembered (duplicate guard)
  const PROGRESS_VERSION = 1;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // Small deterministic RNG (same algorithm as the engine's)
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      let t = (s = (s + 0x6D2B79F5) | 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function shuffle(list, rand) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function weightedPick(items, weightOf, rand) {
    const total = items.reduce((s, it) => s + Math.max(0, weightOf(it)), 0);
    if (total <= 0) return null;
    let r = rand() * total;
    for (const it of items) { r -= Math.max(0, weightOf(it)); if (r <= 0) return it; }
    return items[items.length - 1];
  }

  // ─── Card pools ──────────────────────────────────────────────────────────

  // Base versions only (no Mk-II/Twin/Burst/Core), so event decks are easy to read
  const BASE = Sim.CARD_LIBRARY.filter((c) => c.variant === 0 && !c.token);
  const isTroop = (c) => !c.spell && !c.building;
  const isSwarm = (c) => isTroop(c) && c.swarmCount > 1;
  const hasEvo = (c) => !!Sim.evolutionOf(c.id);

  // ─── Deck rules ──────────────────────────────────────────────────────────
  //
  //   minSpells / minBuildings / minEvo   at least that many of a kind
  //   swarmTroopsOnly                     every troop must be a swarm card
  //   minCost                             no card may cost less than this
  //   banned                              card families (slugs) that are not allowed
  //   pool                                only these card ids are allowed (C.H.A.O.S.)

  function cardAllowed(rules, c) {
    if (!rules || !c) return !!c;
    if (rules.minCost && c.cost < rules.minCost) return false;
    if (rules.swarmTroopsOnly && isTroop(c) && !isSwarm(c)) return false;
    if (rules.banned && rules.banned.includes(c.slug)) return false;
    if (rules.pool && !rules.pool.includes(c.id)) return false;
    return true;
  }

  /** Check a deck against an event's deck rules. Returns { ok, problems: [text] }. */
  function validateDeck(eventId, ids) {
    const ev = EVENT_MAP[eventId];
    const problems = [];
    const cards = (Array.isArray(ids) ? ids : []).map((id) => Sim.CARD_MAP[id]).filter((c) => c && !c.token);
    const unique = new Set(cards.map((c) => c.id));
    if (cards.length !== Sim.MAX_DECK || unique.size !== cards.length) problems.push(`A deck needs ${Sim.MAX_DECK} different cards.`);
    const r = ev && ev.deckRules;
    if (r) {
      const bad = cards.filter((c) => !cardAllowed(r, c));
      if (bad.length) {
        const why = r.pool ? 'not in the C.H.A.O.S. card pool' : r.swarmTroopsOnly ? 'only swarm troops are allowed' : r.minCost ? `nothing under ${r.minCost} elixir` : 'banned in this event';
        problems.push(`Not allowed (${why}): ${bad.map((c) => c.name).join(', ')}.`);
      }
      const count = (fn) => cards.filter(fn).length;
      if (r.minSpells && count((c) => c.spell) < r.minSpells) problems.push(`Needs at least ${r.minSpells} spells (has ${count((c) => c.spell)}).`);
      if (r.minBuildings && count((c) => c.building) < r.minBuildings) problems.push(`Needs at least ${r.minBuildings} buildings (has ${count((c) => c.building)}).`);
      if (r.minEvo && count(hasEvo) < r.minEvo) problems.push(`Needs at least ${r.minEvo} cards that have an Evolution (has ${count(hasEvo)}).`);
    }
    return { ok: problems.length === 0, problems };
  }

  /**
   * A legal deck for an event's deck rules, built from the seed: required kinds first, then a win
   * condition, anti-air, then fill. Always returns 8 legal cards for every event in the catalog.
   */
  function loanerDeck(eventId, seed) {
    const ev = EVENT_MAP[eventId];
    const r = (ev && ev.deckRules) || {};
    const rand = rng(seed || 1);
    const pool = shuffle(BASE.filter((c) => cardAllowed(r, c)), rand);
    const deck = [];
    // Cards that deal no damage themselves (slows, haste, heals, auras, pumps): at most one per loaner deck
    const utility = (c) => (c.spell && !(c.dmg > 0) && !(c.zone && c.zone.kind === 'spawn')) || (c.spell && c.friendly) || (c.mech && (c.mech.empower || c.mech.elixir));
    const take = (fn, n) => {
      for (const c of pool) {
        if (deck.length >= Sim.MAX_DECK || n <= 0) break;
        if (utility(c) && deck.some(utility)) continue;
        if (!deck.includes(c) && fn(c)) { deck.push(c); n--; }
      }
    };
    if (r.minEvo) take(hasEvo, r.minEvo);
    if (r.minSpells) take((c) => c.spell && !c.friendly, r.minSpells);
    if (r.minBuildings) take((c) => c.building && !(c.mech && c.mech.elixir), r.minBuildings);
    if (!deck.some((c) => c.winCondition)) take((c) => isTroop(c) && c.winCondition, 1);
    if (!deck.some((c) => c.spell)) take((c) => c.spell && !c.friendly && c.cost <= 4, 1);
    if (!deck.some((c) => c.targets === 'any' || c.targets === 'air')) take((c) => isTroop(c) && (c.targets === 'any' || c.targets === 'air'), 1);
    take((c) => isTroop(c) && c.splash > 0, deck.some((c) => c.splash > 0 && isTroop(c)) ? 0 : 1);
    take((c) => isTroop(c) && c.cost <= 4 && !c.winCondition, 2);
    take(() => true, Sim.MAX_DECK);
    return deck.slice(0, Sim.MAX_DECK).map((c) => c.id);
  }

  // A sensible random deck (the AI deck builder), at full card availability
  function randomDeck(rand) {
    return Sim.buildAiDeck(Sim.MAX_ARENA, rand);
  }

  // Draft: 8 rounds of 2 cards. You keep one, your opponent gets the other, so both decks end up
  // with a win condition, two spells, anti-air and splash, and no card appears twice.
  const DRAFT_ROLES = [
    { role: 'Win condition', fn: (c) => isTroop(c) && c.winCondition },
    { role: 'Big spell', fn: (c) => c.spell && !c.friendly && c.cost >= 4 },
    { role: 'Small spell', fn: (c) => c.spell && !c.friendly && c.cost <= 3 && !(c.zone && c.zone.kind === 'spawn') },
    { role: 'Anti-air', fn: (c) => isTroop(c) && (c.targets === 'any' || c.targets === 'air') && !c.winCondition },
    { role: 'Splash', fn: (c) => !c.spell && c.splash > 0 && c.targets !== 'air' },
    { role: 'Building', fn: (c) => c.building && !(c.mech && c.mech.elixir) },
    { role: 'Tank or bruiser', fn: (c) => isTroop(c) && c.hp >= 450 && !c.winCondition },
    { role: 'Cycle card', fn: (c) => !c.building && c.cost <= 3 },
  ];

  function draftRounds(seed, poolIds) {
    const rand = rng(seed);
    const used = new Set();
    const from = poolIds ? BASE.filter((c) => poolIds.includes(c.id)) : BASE;
    return DRAFT_ROLES.map((r) => {
      let options = shuffle(from.filter((c) => r.fn(c) && !used.has(c.slug)), rand).slice(0, 2);
      // Never get stuck: top up from anything unused
      if (options.length < 2) options = options.concat(shuffle(from.filter((c) => !used.has(c.slug) && !options.includes(c)), rand).slice(0, 2 - options.length));
      options.forEach((c) => used.add(c.slug));
      return { role: r.role, options: options.map((c) => c.id) };
    });
  }

  /** picks[i] is 0 or 1 (the option you kept). Returns { A: ids, B: ids }. Bad or missing picks default to 0. */
  function draftDecks(rounds, picks) {
    const A = [];
    const B = [];
    rounds.forEach((r, i) => {
      const k = picks && picks[i] === 1 ? 1 : 0;
      A.push(r.options[k]);
      B.push(r.options[1 - k] || r.options[k]);
    });
    return { A, B };
  }

  function entries(ids, level, evoIds) {
    const evo = new Set(evoIds || []);
    return ids.map((id) => ({ id, level, abilityUnlocked: false, mastery: 0, evo: evo.has(id) }));
  }

  // ─── Chaos Mode ──────────────────────────────────────────────────────────

  // Intensity tiers. Each changes how often modifiers arrive, how many overlap, how wild they can be,
  // and (Total) adds one standing "Chaos Law" for the whole match.
  const CHAOS_TIERS = [
    { id: 'mild', name: 'Mild Chaos', first: 20, every: 30, maxActive: 1, maxSev: 1, durScale: 1, finale: false, noRepeat: 3, sevBoost: 1,
      blurb: 'One modifier at a time, every 30 s. Only the gentle ones.' },
    { id: 'wild', name: 'Wild Chaos', first: 15, every: 20, maxActive: 2, maxSev: 2, durScale: 1, finale: true, noRepeat: 2, sevBoost: 1,
      blurb: 'Up to 2 modifiers at once, every 20 s, hazards included, and a Final Frenzy.' },
    { id: 'extreme', name: 'Extreme Chaos', first: 10, every: 14, maxActive: 3, maxSev: 2, durScale: 1.1, finale: true, noRepeat: 2, sevBoost: 1.8,
      blurb: 'Up to 3 at once, every 14 s, weighted toward the disruptive ones.' },
    { id: 'total', name: 'Total Chaos', first: 6, every: 11, maxActive: 4, maxSev: 2, durScale: 1.2, finale: true, noRepeat: 1, sevBoost: 2, law: true,
      blurb: 'Up to 4 at once, every 11 s, plus a Chaos Law that bends the rules all match.' },
  ];
  const CHAOS_TIER_MAP = Object.fromEntries(CHAOS_TIERS.map((t, i) => [t.id, { ...t, index: i }]));

  // Total Chaos: one standing rule for the whole match, announced at the start
  const CHAOS_LAWS = [
    { id: 'echo', name: 'Law of Echoes', desc: 'Damage spells ring out again at 40% strength a moment after they land.', rules: { spellEcho: 0.4 } },
    { id: 'sizes', name: 'Law of Sizes', desc: 'Every troop card in hand is rolled Tiny, Normal or Mega (shown on the card).', rules: { sizeRoll: { tiny: 0.3, mega: 0.3 } } },
    { id: 'bounce', name: 'Law of Bounce', desc: 'Single-target hits knock ground troops back a third of a tile.', rules: { knockOnHit: 0.35 } },
    { id: 'scrap', name: 'Law of Scrap', desc: 'Kills refund 25% of the fallen troop\'s elixir to the side that killed it.', rules: { killRefund: 0.25 } },
  ];

  // Modifier ids that should never be picked together (on top of the one-per-group rule)
  const CHAOS_EXCLUDE = [['drought', 'highroller'], ['growth', 'aegis'], ['glass', 'rattle'], ['meteors', 'springs']];
  const excluded = (a, b) => CHAOS_EXCLUDE.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const INTRO = ['surge', 'jetstream', 'sale', 'overclock', 'arcane'];

  /**
   * Pick the timed modifiers for a Chaos match. Deterministic from the seed.
   * ctx.hasEvo: someone has an Evolution equipped (Evolution modifiers need it).
   * Guarantees: never more than tier.maxActive at once, one per group, at most 2 per category,
   * no excluded pairs, no repeat of the last `noRepeat` picks, and nothing past full time.
   */
  function buildChaosSchedule(seed, tierId, ctx) {
    const tier = CHAOS_TIER_MAP[tierId] || CHAOS_TIER_MAP.mild;
    const c = ctx || {};
    const regulation = c.regulation || 180;
    const rand = rng(seed);
    const defs = Sim.MODIFIERS;
    const plan = [];
    const recent = [];
    const finaleAt = regulation - 30;
    const reserved = (def, at, dur) => tier.finale && (def.group === 'elixir' || def.group === 'tower') && at + dur > finaleAt;
    const activeAt = (t) => plan.filter((m) => m.at <= t && t < m.at + m.dur);
    for (let t = tier.first; t <= regulation - 12; t += tier.every) {
      const live = activeAt(t);
      if (live.length >= tier.maxActive) continue;
      const pool = Object.keys(defs).filter((id) => {
        const d = defs[id];
        if (d.fixed || !(d.weight > 0) || d.sev > tier.maxSev) return false;
        if (d.needs === 'evo' && !c.hasEvo) return false;
        if (recent.slice(-tier.noRepeat).includes(id)) return false;
        const dur = Math.round(d.dur * tier.durScale);
        // Everything it would overlap with during its run, not just what's live right now
        const overlap = plan.filter((m) => m.at < t + dur && t < m.at + m.dur);
        if (overlap.some((m) => m.id === id || excluded(m.id, id))) return false;
        if (d.group && overlap.some((m) => defs[m.id].group === d.group)) return false;
        if (overlap.filter((m) => defs[m.id].cat === d.cat).length >= 2) return false;
        if (overlap.length >= tier.maxActive) return false;
        if (reserved(d, t, dur)) return false;
        return true;
      });
      if (!pool.length) continue;
      const first = plan.length === 0;
      const choices = first && pool.some((id) => INTRO.includes(id)) ? pool.filter((id) => INTRO.includes(id)) : pool;
      const id = weightedPick(choices, (k) => defs[k].weight * (defs[k].sev >= 2 ? tier.sevBoost : 1), rand);
      const dur = Math.min(Math.round(defs[id].dur * tier.durScale), regulation - t);
      plan.push({ id, at: t, dur });
      recent.push(id);
    }
    if (tier.finale) plan.push({ id: 'finale', at: finaleAt, dur: 30 });
    return plan.sort((a, b) => a.at - b.at);
  }

  // ─── Survival and boss scripts ───────────────────────────────────────────

  // Ten escalating waves. The seed is the week, so everyone faces the same waves for a week.
  const WAVE_POOLS = [
    ['antmarch', 'mechmice', 'junkpack', 'crickethop'],
    ['scrapbots', 'lizarddash', 'bugsquad', 'beeblitz', 'brawler'],
    ['wolfpack', 'zombiemob', 'voltbug', 'flarepod', 'shieldknight', 'nanodrones'],
    ['siege', 'guardian', 'dustdevils', 'hawkstrike', 'cryocaster', 'teslatank', 'crackergang'],
    ['makoswarm', 'rocktitan', 'stormzeppelin', 'boomerang', 'phantomrider', 'ufofleet'],
  ];
  // `base` is the defender's average card level, so the waves scale with the player (offset -2..+2)
  function survivalWaves(seed, base, offset) {
    const rand = rng(seed);
    const b = clamp(Math.round(base || 1), 1, 14);
    const off = offset == null ? 0 : offset;
    const waves = [];
    for (let i = 0; i < 10; i++) {
      const tierIdx = Math.min(WAVE_POOLS.length - 1, Math.floor(i / 2));
      const level = clamp(b - 1 + off + Math.floor(i / 3), 1, 14);
      const units = [];
      const groups = i < 3 ? 1 : i < 7 ? 2 : 3;
      const lane = i % 2;
      for (let g = 0; g < groups; g++) {
        const pool = WAVE_POOLS[Math.max(0, tierIdx - (g === groups - 1 ? 0 : 1))];
        const card = pool[Math.floor(rand() * pool.length)];
        // From wave 6 the attack comes down both lanes
        units.push({ card, n: 1, lane: i >= 5 && g === groups - 1 ? 1 - lane : lane, level });
      }
      waves.push({ at: 8 + i * 17, units });
    }
    return waves;
  }

  const BOSS_TIERS = [
    // Boss level = your average card level + offset, so it is a fight at every stage of progression
    { id: 'normal', name: 'Normal', offset: 0, blurb: 'The Colossus at your level. Learn the slam.' },
    { id: 'hard', name: 'Hard', offset: 3, blurb: 'Three levels above you: tougher armour, harder slams.' },
    { id: 'nightmare', name: 'Nightmare', offset: 4, extraSummon: true, blurb: 'Four levels above you, and a third guard summon at 20% HP.' },
  ];


  // ─── Mode library helpers (2026-10-15) ──────────────────────────────────

  // Princess Gambit's 40-card pile for a match: a spread of roles, rolled from the seed
  function gambitPool(seed) {
    const rand = rng(seed ^ 0x6a3b);
    const pick = (list, n, out) => { shuffle(list.filter((c) => !out.includes(c)), rand).slice(0, n).forEach((c) => out.push(c)); };
    const out = [];
    pick(BASE.filter((c) => isTroop(c) && c.winCondition), 5, out);
    pick(BASE.filter((c) => c.spell && !c.friendly), 7, out);
    pick(BASE.filter((c) => c.building), 4, out);
    pick(BASE.filter((c) => isTroop(c) && (c.targets === 'any' || c.targets === 'air')), 8, out);
    pick(BASE.filter((c) => isTroop(c)), 40 - out.length, out);
    return out.slice(0, 40).map((c) => c.id);
  }

  // Elite Endurance: survival that keeps going, every wave a little bigger than the last
  function endlessWaves(seed, base) {
    const rand = rng(seed);
    const b = clamp(Math.round(base || 1), 1, 14);
    const waves = [];
    for (let i = 0; i < 36; i++) {
      const tierIdx = Math.min(WAVE_POOLS.length - 1, Math.floor(i / 3));
      const level = clamp(b - 2 + Math.floor(i / 4), 1, 14);
      const groups = Math.min(4, 1 + Math.floor(i / 5));
      const units = [];
      for (let g = 0; g < groups; g++) {
        const pool = WAVE_POOLS[Math.max(0, tierIdx - (g % 2))];
        units.push({ card: pool[Math.floor(rand() * pool.length)], n: 1, lane: (i + g) % 2, level });
      }
      waves.push({ at: 6 + i * 15, units });
    }
    return waves;
  }

  const BOSS_RUSH = [
    { id: 'colossus', name: 'Iron Colossus', card: 'colossus', blurb: 'Stage 1: telegraphed slams and guard summons.' },
    { id: 'warden', name: 'Stone Warden', card: 'stonewarden', blurb: 'Stage 2: slow, huge, wide slams; calls Rock Shards.' },
    { id: 'queen', name: 'Hive Queen', card: 'hivequeen', blurb: 'Stage 3: fast, and calls air drones: bring anti-air.' },
  ];

  const LANE_X = [Sim.BRIDGES[0].cx, Sim.BRIDGES[1].cx];
  const LIB_REWARDS = { play: 20, win: 80, first: { gold: 200, chest: true }, milestones: [{ wins: 3, gold: 150 }, { wins: 10, gold: 300, chest: true }] };

  // ─── The catalog ─────────────────────────────────────────────────────────
  //
  // deck:      'own' (your deck, checked against deckRules) | 'draft' | 'mirror' | 'roulette'
  // modes:     where it can be played: 'ai' (vs AI), 'pvp' (local), 'online'
  // schedule:  'permanent' | 'rotating' (daily pool, featured for rewards) | 'library' (always open) — challenges are weekly
  // tiers:     optional difficulty/intensity levels; `unlock` = win the previous tier first
  // rewards:   gold for playing / winning, a one-time first-win prize, and milestone prizes
  // build(c):  the engine rules (and decks) for one match. c: { seed, tier, decks, hasEvo, week }

  const STD_REWARDS = { play: 20, win: 90, first: { gold: 250, chest: true }, milestones: [{ wins: 3, gold: 200 }, { wins: 10, gold: 400, chest: true }] };

  // ─── C.H.A.O.S. ──────────────────────────────────────────────────────────
  //
  // Card upgrades chosen mid-battle (the engine side is "C.H.A.O.S. card upgrades" in clash-sim.js).
  // Every variant shares the same pool, upgrade table and choice engine; a variant only lists the
  // settings it changes. deck / modes on a variant override the event's.
  //
  //   checkpoints  [{ at (match seconds), rarity }]: when each choice opens and the rarity both offers have
  //   choiceSecs   how long a choice stays open before the left offer is taken
  //   rules        extra engine rules for the variant
  const CHAOS_STD_CHECKPOINTS = [{ at: 1, rarity: 'common' }, { at: 45, rarity: 'common' }, { at: 90, rarity: 'rare' }, { at: 135, rarity: 'rare' }, { at: 180, rarity: 'epic' }];
  const CHAOS_VARIANTS = [
    { id: 'standard', name: 'Standard', blurb: 'Build a deck from the pool. Upgrade it as you fight.', checkpoints: CHAOS_STD_CHECKPOINTS },
    { id: 'draft', name: 'Draft', blurb: 'Draft your deck from the pool, then upgrade it.', deck: 'draft', modes: ['ai'], checkpoints: CHAOS_STD_CHECKPOINTS },
    { id: 'blackout', name: 'Blackout', blurb: 'The arena is dark: you only see near your own troops and towers.', modes: ['ai', 'online'], checkpoints: CHAOS_STD_CHECKPOINTS, rules: { blackout: true } },
    { id: 'surge', name: 'Power Surge', blurb: 'A choice every 30 s, Rare from the start, Epics from 1:30, and 1.5× elixir.',
      checkpoints: [{ at: 1, rarity: 'rare' }, { at: 30, rarity: 'rare' }, { at: 60, rarity: 'rare' }, { at: 90, rarity: 'epic' }, { at: 120, rarity: 'epic' }, { at: 150, rarity: 'epic' }],
      rules: { startElixir: 7, elixirPhases: [{ at: 0, mult: 1.5 }, { at: 120, mult: 2 }] } },
  ];
  const CHAOS_VARIANT_MAP = Object.fromEntries(CHAOS_VARIANTS.map((v) => [v.id, v]));
  const CHAOS_LEVEL = 11;      // every card in a C.H.A.O.S. match plays at this level (the collection is untouched)
  const CHAOS_CHOICE_SECS = 10;

  const EVENTS = [
    {
      id: 'upgrades', name: 'C.H.A.O.S.', icon: '🧬', art: 'upgrades', category: 'C.H.A.O.S.', difficulty: 3, deck: 'own', deckSource: 'chaos',
      modes: ['ai', 'pvp', 'online'], schedule: 'permanent',
      deckRules: { pool: Sim.CHAOS_POOL.slice() },
      tagline: 'Pick an upgrade for one of your cards, again and again, mid-battle.',
      desc: 'Build an 8-card deck from the C.H.A.O.S. pool. During the battle the clock stops at set moments and you choose one of two upgrades, each for a specific card in your deck: more HP, a shockwave punch, chain lightning, homing rockets, a Bone Giant that rises from a crypt. The card keeps it for the rest of the match. Your opponent drafts their own upgrades at the same time.',
      rules: [
        'Your C.H.A.O.S. deck: 8 cards from the pool (build it on this screen). Every card plays at level 11.',
        'At each checkpoint the battle pauses and you get two upgrades for cards in your deck. Pick one in 10 s, or the left one is taken for you.',
        'Upgrades are Common, Rare or Epic; later checkpoints offer rarer ones. A card can only have one upgrade.',
        'An upgrade changes every copy of that card you play from then on (troops already on the field stay as they were).',
        'No Evolutions; upgrades are this mode\'s power-ups. Nothing carries over after the match.',
      ],
      win: 'Normal battle rules: more crowns at full time, or destroy the King Tower.', loss: 'Lose your King Tower, or have fewer crowns at the end.',
      random: 'Which two upgrades you are offered at each checkpoint (rolled from the match seed, separately for each side).',
      fixed: 'The card pool, the level, when choices open and their rarity, and the battle rules.',
      tiers: CHAOS_VARIANTS.map((v) => ({ id: v.id, name: v.name, blurb: v.blurb, unlock: null, deck: v.deck, modes: v.modes })),
      rewards: { play: 25, win: 110, first: { gold: 300, chest: true, wild: 1 }, milestones: [{ wins: 3, gold: 250 }, { wins: 10, gold: 500, chest: true }, { wins: 25, badge: 'mutator' }] },
      build(c) {
        const v = CHAOS_VARIANT_MAP[c.tier] || CHAOS_VARIANTS[0];
        const rules = { ...(v.rules || {}), cardLevel: CHAOS_LEVEL, evo: { disabled: true }, upgrades: { checkpoints: v.checkpoints, choiceSecs: CHAOS_CHOICE_SECS, pause: true, autoPick: 0, perCard: 1 } };
        if (v.deck === 'draft') {
          const rounds = c.rounds || draftRounds(c.seed, Sim.CHAOS_POOL);
          const d = draftDecks(rounds, c.picks);
          return { rules, decks: { A: entries(d.A, CHAOS_LEVEL), B: entries(d.B, CHAOS_LEVEL) }, rounds };
        }
        return { rules };
      },
    },
    {
      id: 'chaos', name: 'Chaos Mode', icon: '🌀', art: 'chaos', category: 'Chaos', difficulty: 3, deck: 'own',
      modes: ['ai', 'pvp', 'online'], schedule: 'permanent', featuredWeekend: true,
      tagline: 'Controlled mayhem: the arena keeps changing under your feet.',
      desc: 'Timed modifiers switch on and off through the match: speed lanes, meteor showers, elixir surges, glass cannons, Evolution rushes and more. Every one is announced a few seconds before it starts, shown on the arena and in the modifier tray, and applies to both sides equally. Read the board, adapt, and turn the chaos to your advantage.',
      rules: [
        'Your own deck and Evolutions.',
        'Modifiers are announced 4 s before they start; the tray shows each one\'s timer.',
        'Battlefield modifiers are mirrored, so both sides always get the same layout.',
        'Several of the same kind never stack: one elixir change, one cost change, one speed change at a time, and every effect has a hard cap.',
        'Higher intensity: more modifiers, more overlap, wilder picks. Total Chaos adds a Chaos Law for the whole match.',
      ],
      win: 'Normal battle rules: more crowns at full time, or destroy the King Tower.', loss: 'Lose your King Tower, or have fewer crowns at the end.',
      random: 'Which modifiers appear and when (set at the start of the match from its seed). Total Chaos also rolls one Chaos Law.',
      fixed: 'The arena, towers, your deck, the clock and the 2× elixir minute.',
      tiers: CHAOS_TIERS.map((t, i) => ({ id: t.id, name: t.name, blurb: t.blurb, unlock: i > 0 ? CHAOS_TIERS[i - 1].id : null })),
      rewards: { play: 25, win: 110, first: { gold: 300, chest: true, wild: 1 }, milestones: [{ wins: 3, gold: 250 }, { wins: 10, gold: 500, chest: true }, { wins: 25, badge: 'chaoslord' }] },
      build(c) {
        const tier = CHAOS_TIER_MAP[c.tier] || CHAOS_TIER_MAP.mild;
        const rules = { modifiers: buildChaosSchedule(c.seed, tier.id, { hasEvo: c.hasEvo }) };
        let law = null;
        if (tier.law) {
          law = CHAOS_LAWS[rng(c.seed ^ 0x9e3779b9)() * CHAOS_LAWS.length | 0];
          Object.assign(rules, law.rules);
        }
        return { rules, law };
      },
    },
    {
      id: 'overload', name: 'Elixir Overload', icon: '⚗️', art: 'elixir', category: 'Elixir', difficulty: 2, deck: 'own',
      modes: ['ai', 'pvp', 'online'], schedule: 'rotating',
      tagline: '2× elixir from the first second, 3× in the last minute.',
      desc: 'Elixir pours in from the start, so heavy pushes come early and often. In the final minute it triples. Cheap cycle decks lose their edge; decks that can defend a double push and punish with a bigger one shine.',
      rules: ['Start with 7 elixir.', '2× elixir for the first two minutes, 3× in the last minute and in overtime.', 'Everything else is a normal battle.'],
      win: 'Normal battle rules.', loss: 'Normal battle rules.', random: null, fixed: 'All rules.',
      rewards: STD_REWARDS,
      build() { return { rules: { startElixir: 7, elixirPhases: [{ at: 0, mult: 2 }, { at: 120, mult: 3 }], overtimeMult: 3 } }; },
    },
    {
      id: 'suddendeath', name: 'Sudden Death', icon: '⚔️', art: 'sudden', category: 'Combat', difficulty: 3, deck: 'own',
      modes: ['ai', 'pvp', 'online'], schedule: 'rotating',
      tagline: 'The first crown wins. One mistake is all it takes.',
      desc: 'A single tower decides the match. With 1.5× elixir throughout, every push is a threat and every leak can be fatal. Defence wins this one; chip damage settles the tiebreak.',
      rules: ['The first player to destroy any tower wins instantly.', '2:30 on the clock, 1.5× elixir, 2× in the last minute.', 'No overtime: if no tower falls, the side whose weakest tower has more health left wins.'],
      win: 'Destroy any enemy tower first, or have the healthier weakest tower at full time.', loss: 'Lose any tower.',
      random: null, fixed: 'All rules.',
      rewards: STD_REWARDS,
      build() { return { rules: { crownsToWin: 1, regulation: 150, overtime: 0, elixirPhases: [{ at: 0, mult: 1.5 }, { at: 90, mult: 2 }] } }; },
    },
    {
      id: 'draft', name: 'Draft Duel', icon: '🃏', art: 'draft', category: 'Deck building', difficulty: 3, deck: 'draft',
      modes: ['ai'], schedule: 'rotating',
      tagline: 'Pick one card, your opponent gets the other.',
      desc: 'Eight rounds, two cards each: a win condition, a big spell, a small spell, anti-air, splash, a building, a bruiser and a cycle card. Every card you take is a card you deny. Both decks are at the same level (your average card level).',
      rules: ['Draft 8 cards, one round at a time. The card you pass goes to the AI.', 'Both decks are at your average card level; no Evolutions.', 'Then a normal battle.'],
      win: 'Normal battle rules.', loss: 'Normal battle rules.',
      random: 'The 16 cards offered (no card appears twice).', fixed: 'The round order and the battle rules.',
      rewards: { ...STD_REWARDS, win: 110 },
      build(c) {
        const rounds = c.rounds || draftRounds(c.seed);
        const d = draftDecks(rounds, c.picks);
        return { rules: { evo: { disabled: true } }, decks: { A: entries(d.A, c.level), B: entries(d.B, c.level) }, rounds };
      },
    },
    {
      id: 'mirror', name: 'Mirror Match', icon: '🪞', art: 'mirror', category: 'Deck building', difficulty: 2, deck: 'mirror',
      modes: ['ai', 'pvp', 'online'], schedule: 'rotating',
      tagline: 'Same deck, same levels. Pure skill.',
      desc: 'Both players get the same random deck at the same level, with the same Evolution. You know exactly what your opponent can play, so it comes down to timing, placement and elixir trades.',
      rules: ['Both sides use the same randomly built deck at the same card level (your average level; online, the average of both players).', 'If the deck has a card with an Evolution, both sides get it equipped.', 'Normal battle rules.'],
      win: 'Normal battle rules.', loss: 'Normal battle rules.', random: 'The shared deck.', fixed: 'Everything else.',
      rewards: STD_REWARDS,
      build(c) {
        const ids = randomDeck(rng(c.seed));
        const evo = ids.filter((id) => Sim.evolutionOf(id)).slice(0, 1);
        return { rules: {}, decks: { A: entries(ids, c.level, evo), B: entries(ids, c.level, evo) } };
      },
    },
    {
      id: 'roulette', name: 'Deck Roulette', icon: '🎡', art: 'roulette', category: 'Deck building', difficulty: 3, deck: 'roulette',
      modes: ['ai', 'pvp', 'online'], schedule: 'rotating',
      tagline: 'Your deck is replaced twice during the match.',
      desc: 'You start with a random deck, and at 2:00 and 1:00 left both hands are swapped for brand-new random decks. A countdown warns you, so spend before the swap or save elixir for what comes next.',
      rules: ['Random decks for both sides (different decks, built the same way, at the same card level).', 'At 2:00 and 1:00 left, both decks are replaced. A countdown shows when.', 'Cooldowns reset on a swap. No Evolutions.'],
      win: 'Normal battle rules.', loss: 'Normal battle rules.', random: 'All three decks for each side.', fixed: 'Swap times and the battle rules.',
      rewards: STD_REWARDS,
      build(c) {
        const rand = rng(c.seed);
        const deckA = randomDeck(rand);
        const deckB = randomDeck(rand);
        return {
          rules: { evo: { disabled: true }, deckLevel: c.level, deckSwaps: [{ at: 60, A: randomDeck(rand), B: randomDeck(rand) }, { at: 120, A: randomDeck(rand), B: randomDeck(rand) }] },
          decks: { A: entries(deckA, c.level), B: entries(deckB, c.level) },
        };
      },
    },
    {
      id: 'scavenger', name: 'Scavenger', icon: '🦴', art: 'scavenger', category: 'Elixir', difficulty: 4, deck: 'own',
      modes: ['ai', 'pvp', 'online'], schedule: 'rotating',
      tagline: 'Elixir is scarce. Kills pay you back.',
      desc: 'Elixir flows at just over half speed, but every enemy troop you kill refunds 45% of its cost. Efficient defence fuels your offence; overcommitting starves you. Cheap swarms feed your opponent.',
      rules: ['Start with 4 elixir; generation is 0.55× (1× in the last minute).', 'Killing an enemy troop refunds 45% of its elixir to you (at most 2 per kill). Troops that blow themselves up and spawned tokens pay nothing.'],
      win: 'Normal battle rules.', loss: 'Normal battle rules.', random: null, fixed: 'All rules.',
      rewards: { ...STD_REWARDS, win: 110 },
      build() { return { rules: { startElixir: 4, elixirPhases: [{ at: 0, mult: 0.55 }, { at: 120, mult: 1 }], overtimeMult: 1, killRefund: 0.45 } }; },
    },
    {
      id: 'spellstorm', name: 'Spellstorm', icon: '🌩️', art: 'spell', category: 'Combat', difficulty: 3, deck: 'own',
      modes: ['ai', 'pvp', 'online'], schedule: 'rotating', deckRules: { minSpells: 3 },
      tagline: 'Spells are cheaper, and they echo.',
      desc: 'Every damage spell rings out a second time at half strength a moment after it lands; lingering spells last 50% longer. Spells cost 1 less. Bring at least three, spread your troops, and bait out the enemy\'s.',
      rules: ['Your deck needs at least 3 spells.', 'Spells cost 1 less (never below 1).', 'Damage spells echo at 50% strength about a second after landing; lingering spells last 50% longer, Orbital Laser and Boulder Roll strike twice.'],
      win: 'Normal battle rules.', loss: 'Normal battle rules.', random: null, fixed: 'All rules.',
      rewards: STD_REWARDS,
      build() { return { rules: { spellEcho: 0.5, cardMods: [{ when: { spell: true }, cost: -1 }] } }; },
    },
    {
      id: 'swarm', name: 'Swarm Wars', icon: '🐜', art: 'swarm', category: 'Combat', difficulty: 2, deck: 'own',
      modes: ['ai', 'pvp', 'online'], schedule: 'rotating', deckRules: { swarmTroopsOnly: true },
      tagline: 'Only swarms, and every swarm is 50% bigger.',
      desc: 'Single troops are banned: your troops must be swarm cards, and every swarm spawns 50% more members. Splash troops and buildings deal 25% less, so spells and smart placement are how you clear a horde.',
      rules: ['Every troop in your deck must be a swarm card (spells and buildings are fine).', 'Swarm cards spawn 50% more units (rounded up).', 'Troops and buildings with splash deal 25% less damage.'],
      win: 'Normal battle rules.', loss: 'Normal battle rules.', random: null, fixed: 'All rules.',
      rewards: STD_REWARDS,
      build() { return { rules: { cardMods: [{ when: { swarm: true }, count: 1.5 }, { when: { splash: true }, dmg: 0.75 }] } }; },
    },
    {
      id: 'heavy', name: 'Heavyweights', icon: '🦣', art: 'heavy', category: 'Combat', difficulty: 3, deck: 'own',
      modes: ['ai', 'pvp', 'online'], schedule: 'rotating', deckRules: { minCost: 3 },
      tagline: 'Big elixir, big troops. Nothing under 3 elixir.',
      desc: 'Max elixir is 14 and you start with 8, so you can drop a tank and its support at once. Nothing costs under 3, so there\'s no cheap cycling out of a bad hand, and tanks move 15% faster.',
      rules: ['No card costing less than 3.', 'Max elixir 14, start with 8.', 'Tanks (troops with 600+ base HP) move 15% faster.'],
      win: 'Normal battle rules.', loss: 'Normal battle rules.', random: null, fixed: 'All rules.',
      rewards: STD_REWARDS,
      build() { return { rules: { maxElixir: 14, startElixir: 8, cardMods: [{ when: { tank: true }, speed: 1.15 }] } }; },
    },
    {
      id: 'fortress', name: 'Fortress Wars', icon: '🏯', art: 'fortress', category: 'Combat', difficulty: 3, deck: 'own',
      modes: ['ai', 'pvp', 'online'], schedule: 'rotating', deckRules: { minBuildings: 2 },
      tagline: 'Buildings are cheaper, tougher, and fuel your elixir.',
      desc: 'Buildings cost 1 less, last 50% longer and have 20% more HP. Each of your living buildings speeds up your elixir by 12% (up to 3). Siege the enemy\'s fortifications or out-build them.',
      rules: ['Your deck needs at least 2 buildings.', 'Buildings cost 1 less, last 50% longer, +20% HP.', 'Each living building of yours: +12% elixir generation (max 3 buildings).'],
      win: 'Normal battle rules.', loss: 'Normal battle rules.', random: null, fixed: 'All rules.',
      rewards: STD_REWARDS,
      build() { return { rules: { buildingElixir: 0.12, cardMods: [{ when: { building: true }, cost: -1, lifetime: 1.5, hp: 1.2 }] } }; },
    },
    {
      id: 'koth', name: 'King of the Hill', icon: '⛰️', art: 'hill', category: 'Objective', difficulty: 3, deck: 'own',
      modes: ['ai', 'pvp', 'online'], schedule: 'rotating',
      tagline: 'Hold the bridge to earn crowns.',
      desc: 'A hill sits on one bridge and hops to the other every 40 seconds. Whoever has more troop strength on it fills their meter; a full meter is a crown. Three crowns wins. Fight over the hill, or ignore it and go for towers: both count.',
      rules: ['The hill starts on the left bridge and moves every 40 s (a marker shows where it goes next).', 'More troop strength on the hill fills your meter (faster the bigger your edge). A full meter = 1 crown.', 'Tower crowns count too. The first to 3 crowns wins.'],
      win: 'Reach 3 crowns (towers + hill), or have more crowns at the end.', loss: 'The opponent reaches 3 crowns first.',
      random: null, fixed: 'Hill timing and position.',
      rewards: { ...STD_REWARDS, milestones: STD_REWARDS.milestones.concat([{ wins: 15, badge: 'hillking' }]) },
      build() { return { rules: { crownsToWin: 3, hill: { spots: [{ x: 3.5, y: 16 }, { x: 14.5, y: 16 }], every: 40, r: 2.3, rate: 6, points: 100 } } }; },
    },
    {
      id: 'pinball', name: 'Pinball Panic', icon: '🎱', art: 'pinball', category: 'Party', difficulty: 2, deck: 'own',
      modes: ['ai', 'pvp', 'online'], schedule: 'rotating',
      tagline: 'Every hit sends troops flying.',
      desc: 'Every single-target hit, from troops and towers alike, knocks ground troops back. Troops move 15% faster to bounce back in. Ranged troops can juggle melee forever; heavy splash and flyers don\'t care.',
      rules: ['Single-target hits knock ground troops back 0.45 tiles (bosses and dashing troops excepted).', 'All troops move 15% faster.'],
      win: 'Normal battle rules.', loss: 'Normal battle rules.', random: null, fixed: 'All rules.',
      rewards: STD_REWARDS,
      build() { return { rules: { knockOnHit: 0.45, cardMods: [{ when: { troop: true }, speed: 1.15 }] } }; },
    },
    {
      id: 'sizes', name: 'Size Roulette', icon: '🎲', art: 'sizes', category: 'Party', difficulty: 2, deck: 'own',
      modes: ['ai', 'pvp', 'online'], schedule: 'rotating',
      tagline: 'Tiny or Mega? Check the card before you play it.',
      desc: 'Each troop card is rolled as it enters your hand: Tiny (cheaper, faster, fragile), Normal, or Mega (pricier, slower, huge). The form shows on the card, so you choose when to play a Mega tank or flick out a Tiny one.',
      rules: ['Each troop card in hand: 30% Tiny, 30% Mega, 40% Normal (re-rolled every time it comes back into hand).', 'Tiny: −1 cost, 60% HP, 75% damage, 30% faster, smaller.', 'Mega: +1 cost, 160% HP, 130% damage, 20% slower, bigger.', 'Spells and buildings are never resized.'],
      win: 'Normal battle rules.', loss: 'Normal battle rules.', random: 'Each card\'s size, rolled from the match seed.', fixed: 'Everything else.',
      rewards: STD_REWARDS,
      build() { return { rules: { sizeRoll: { tiny: 0.3, mega: 0.3 } } }; },
    },
    {
      id: 'evofrenzy', name: 'Evolution Frenzy', icon: '✦', art: 'evo', category: 'Evolution', difficulty: 3, deck: 'own',
      modes: ['ai', 'pvp', 'online'], schedule: 'rotating', deckRules: { minEvo: 3 },
      tagline: 'Every Evolution, unlocked and charging faster.',
      desc: 'For this event only, every card in your deck that has an Evolution gets it, unlocked or not, with no slot limit, and each needs one fewer cycle. Single-cycle Evolutions come out evolved every time.',
      rules: ['Your deck needs at least 3 cards that have an Evolution.', 'Every such card is evolved-capable this match (temporary, nothing is unlocked).', 'Evolution cycles are 1 shorter (1-cycle Evolutions evolve on every play).'],
      win: 'Normal battle rules.', loss: 'Normal battle rules.', random: null, fixed: 'All rules.',
      rewards: { ...STD_REWARDS, first: { gold: 250, chest: true, wild: 2 } },
      build() { return { rules: { evo: { all: true, cycleDelta: -1 } } }; },
    },
    {
      id: 'survival', name: 'Last Stand', icon: '🛡️', art: 'survival', category: 'Survival', difficulty: 3, deck: 'own',
      modes: ['ai'], schedule: 'permanent', scoreLabel: 'Score',
      tagline: 'Ten waves are coming. Hold the line.',
      desc: 'Hordes pour over both bridges in ten escalating waves while your elixir slowly dries up. There are no enemy towers: your troops hold a line at the river. Survive to the end, or clear every wave, to win. Score counts waves cleared and towers left standing.',
      rules: ['10 waves, one every 17 s, getting bigger and nastier; from wave 6 both lanes are attacked.', 'Elixir: 1.2× at first, 1× from 1:00, 0.85× from 2:00.', 'No enemy towers, so building-targeting troops have nothing to hit. Troops without a target hold the line in front of your bridges.', 'The waves change every week (same for everyone).'],
      win: 'Your King Tower is still standing when the last wave is beaten or time runs out.', loss: 'Your King Tower falls.',
      random: 'Wave make-up, rolled once per week.', fixed: 'Timing and strength curve.',
      rewards: { play: 30, win: 140, first: { gold: 300, chest: true }, milestones: [{ wins: 3, gold: 300 }, { wins: 10, badge: 'survivor' }] },
      build(c) {
        const waves = survivalWaves(1000 + (c.week || 0), c.level);
        return { rules: { noTowers: ['B'], guard: true, timeout: 'survive', regulation: 200, overtime: 0, waves, elixirPhases: [{ at: 0, mult: 1.2 }, { at: 60, mult: 1 }, { at: 120, mult: 0.85 }] }, scripted: true };
      },
      score(r) { return (r.waves || 0) * 100 + (r.towersStanding || 0) * 150 + (r.result === 'win' ? 300 : 0); },
    },
    {
      id: 'boss', name: 'Boss Battle', icon: '🤖', art: 'boss', category: 'Boss', difficulty: 4, deck: 'own',
      modes: ['ai'], schedule: 'permanent', scoreLabel: 'Score',
      tagline: 'Bring down the Iron Colossus.',
      desc: 'A towering machine crosses the river and marches on your towers. It telegraphs ground slams at your biggest group of troops, calls Ironling guards at 70% and 40% HP (it takes half damage while they live), and enrages below 35%. Kill it before the clock runs out.',
      rules: [
        'The Colossus arrives after 3 s. It can\'t be knocked back or pulled; stuns and freezes last half as long on it.',
        'Slam: a red circle marks where it will hit 1.6 s later (big damage, knockback). Don\'t drop troops into it.',
        'Guard: at 70% and 40% HP it calls 3 Ironlings; while any is alive it takes 50% damage. Splash clears them fast.',
        'It smashes troops at full strength but deals only 45% damage to towers and buildings.',
        'Enrage under 35% HP: 35% faster, and it slams more often.',
        'No enemy towers; the match lasts 3:00 with no overtime.',
      ],
      win: 'Destroy the Iron Colossus.', loss: 'Your King Tower falls, or time runs out.',
      random: null, fixed: 'All rules.',
      tiers: BOSS_TIERS.map((t, i) => ({ id: t.id, name: t.name, blurb: t.blurb, unlock: i > 0 ? BOSS_TIERS[i - 1].id : null })),
      rewards: { play: 30, win: 150, first: { gold: 350, chest: true, wild: 1 }, milestones: [{ wins: 3, gold: 300 }, { wins: 10, gold: 500, chest: true }] },
      build(c) {
        const t = BOSS_TIERS.find((b) => b.id === c.tier) || BOSS_TIERS[0];
        return { rules: { noTowers: ['B'], guard: true, timeout: 'defend', regulation: 180, overtime: 0, boss: { at: 3, card: 'colossus', lane: rng(c.seed)() < 0.5 ? 0 : 1, level: clamp(c.level + t.offset, 1, 14), extraSummon: !!t.extraSummon } }, scripted: true };
      },
      score(r) { return r.result === 'win' ? 1000 + Math.round((r.timeLeft || 0) * 10) + (r.towersStanding || 0) * 150 : Math.round((1 - (r.bossHpFrac == null ? 1 : r.bossHpFrac)) * 800); },
    },
    // ─── Mode library (2026-10-15): added alongside everything above, never instead of it ───
    {
      id: 'double', name: 'Double Elixir', icon: '💧', art: 'elixir', category: 'Elixir', difficulty: 2, deck: 'own',
      modes: ['ai', 'pvp', 'online'], schedule: 'library',
      tagline: 'Twice the elixir, from the first second to the last.',
      desc: 'Elixir generates at 2× for the whole match (and in overtime). Max elixir and card costs are unchanged, so it is about chaining bigger pushes without overcommitting.',
      rules: ['2× elixir all match, including overtime.', 'Max elixir 10; costs unchanged.', 'Otherwise a normal battle.'],
      win: 'Normal battle rules.', loss: 'Normal battle rules.', random: null, fixed: 'All rules.', rewards: LIB_REWARDS,
      build() { return { rules: { elixirPhases: [{ at: 0, mult: 2 }], overtimeMult: 2 } }; },
    },
    {
      id: 'triple', name: 'Triple Elixir', icon: '⚗️', art: 'elixir', category: 'Elixir', difficulty: 3, deck: 'own',
      modes: ['ai', 'pvp', 'online'], schedule: 'library',
      tagline: '3× elixir. Huge pushes, constant counter-attacks.',
      desc: 'Elixir pours in at 3× all match. Expect stacked pushes and big spell trades. To keep the battle readable each side may have at most 40 units on the field at once.',
      rules: ['3× elixir all match, including overtime.', 'Max elixir 10; costs unchanged.', 'Up to 40 units per side on the field (both sides alike).'],
      win: 'Normal battle rules.', loss: 'Normal battle rules.', random: null, fixed: 'All rules.', rewards: LIB_REWARDS,
      build() { return { rules: { elixirPhases: [{ at: 0, mult: 3 }], overtimeMult: 3, unitCap: 40 } }; },
    },
    {
      id: 'infinite', name: 'Infinite Elixir', icon: '♾️', art: 'elixir', category: 'Elixir', difficulty: 3, deck: 'own',
      modes: ['ai', 'pvp', 'online'], schedule: 'library',
      tagline: 'Elixir never runs out. Composition and timing are everything.',
      desc: 'Your elixir bar is always full. Hand cycling, card recharge times and deploy zones still apply, so what you play and where matters more than ever. Each side may have at most 30 units on the field.',
      rules: ['Elixir is always full.', 'Cards still recharge after you play them, and your hand still cycles.', 'Up to 30 units per side on the field (both sides alike).'],
      win: 'Normal battle rules.', loss: 'Normal battle rules.', random: null, fixed: 'All rules.', rewards: LIB_REWARDS,
      build() { return { rules: { infiniteElixir: true, unitCap: 30 } }; },
    },
    {
      id: 'rampup', name: 'Ramp-Up', icon: '📈', art: 'elixir', category: 'Elixir', difficulty: 2, deck: 'own',
      modes: ['ai', 'pvp', 'online'], schedule: 'library',
      tagline: 'Elixir speeds up in five stages through the match.',
      desc: 'A careful 1× start, then 1.5× at 0:36, 2× at 1:12, 2.5× at 1:48 and 3× from 2:24 (and in overtime). Each step is announced on the arena. The same schedule for both players.',
      rules: ['Elixir: 1× → 1.5× (0:36) → 2× (1:12) → 2.5× (1:48) → 3× (2:24 and overtime).', 'Every stage change is announced.'],
      win: 'Normal battle rules.', loss: 'Normal battle rules.', random: null, fixed: 'All rules.', rewards: LIB_REWARDS,
      build() { return { rules: { announceStages: true, elixirPhases: [{ at: 0, mult: 1 }, { at: 36, mult: 1.5 }, { at: 72, mult: 2 }, { at: 108, mult: 2.5 }, { at: 144, mult: 3 }], overtimeMult: 3 } }; },
    },
    {
      id: 'rage', name: 'Rage Battle', icon: '😡', art: 'sudden', category: 'Combat', difficulty: 3, deck: 'own',
      modes: ['ai', 'pvp', 'online'], schedule: 'library',
      tagline: 'Every troop and building is permanently enraged.',
      desc: 'All troops move 30% faster and every troop and building attacks 25% more often, for both sides, all match. Fights resolve fast; reactions matter.',
      rules: ['Troops: +30% movement speed.', 'Troops and buildings: attack interval ×0.75.', 'Spells and towers are unchanged.'],
      win: 'Normal battle rules.', loss: 'Normal battle rules.', random: null, fixed: 'All rules.', rewards: LIB_REWARDS,
      build() { return { rules: { cardMods: [{ when: { all: true }, speed: 1.3, cd: 0.75 }] } }; },
    },
    {
      id: 'towerrush', name: 'Tower Rush', icon: '🏹', art: 'sudden', category: 'Combat', difficulty: 3, deck: 'own',
      modes: ['ai', 'pvp', 'online'], schedule: 'library',
      tagline: 'Lighter towers, a shorter clock: keep the pressure on.',
      desc: 'Princess Towers have 55% health and King Towers 60%. 2:00 on the clock plus 30 s of overtime, 1.5× elixir and a 7-elixir start. Unlike Sudden Death, one tower doesn\'t end it: sustained pressure takes all three crowns.',
      rules: ['Princess Towers 55% HP, King Tower 60% HP (both sides).', '2:00 + 30 s overtime; 1.5× elixir; start with 7.', 'Normal crown rules.'],
      win: 'More crowns at the end, or the King Tower.', loss: 'Fewer crowns, or your King Tower.', random: null, fixed: 'All rules.', rewards: LIB_REWARDS,
      build() { return { rules: { towerHp: { princess: 0.55, king: 0.6 }, regulation: 120, overtime: 30, startElixir: 7, elixirPhases: [{ at: 0, mult: 1.5 }], overtimeMult: 2 } }; },
    },
    {
      id: 'heist', name: 'Heist', icon: '💰', art: 'fortress', category: 'Objective', difficulty: 3, deck: 'own',
      modes: ['ai', 'pvp', 'online'], schedule: 'library', deckRules: { minBuildings: 1 },
      tagline: 'No Princess Towers. Crack their vault, guard yours.',
      desc: 'Each side has one Vault (the King Tower, 2.2× health) and no Princess Towers. Vaults don\'t shoot: your defence is your cards, so buildings matter. Destroy the enemy Vault to win; at full time the Vault with more health left wins.',
      rules: ['One Vault per side (2.2× King HP); it never attacks.', 'No Princess Towers; troops head straight for the Vault.', 'Your deck needs at least 1 building.', 'Time out: more Vault health wins (equal = draw).'],
      win: 'Destroy the enemy Vault, or have more Vault health left.', loss: 'Your Vault falls, or has less health at the end.', random: null, fixed: 'All rules.', rewards: LIB_REWARDS,
      build() { return { rules: { kingOnly: true, vault: { hp: 2.2, shoots: false } } }; },
    },
    {
      id: 'touchdown', name: 'Touchdown', icon: '🏈', art: 'hill', category: 'Objective', difficulty: 3, deck: 'own',
      modes: ['ai', 'pvp', 'online'], schedule: 'library',
      tagline: 'No towers. Get a troop into their end zone. First to 3.',
      desc: 'There are no towers. Troops with nothing to fight run for the enemy end zone (the back 2.5 tiles of their side); each troop that reaches it scores 1 and leaves the field. Defenders intercept. First to 3 wins; time out, more touchdowns wins; overtime is next score wins.',
      rules: ['No towers: troops fight what they meet, otherwise run for the enemy end zone.', 'A troop in the enemy end zone scores 1 (spells and buildings can\'t score).', 'First to 3. Time out: more scores wins, level = overtime (next score wins), then a draw.'],
      win: 'Score 3, or lead when time runs out.', loss: 'Concede 3, or trail at the end.', random: null, fixed: 'All rules.', rewards: LIB_REWARDS,
      build() { return { rules: { noTowers: ['A', 'B'], touchdown: { depth: 2.5 }, scoreToWin: 3, overtime: 60 } }; },
    },
    {
      id: 'capture', name: 'Capture the Point', icon: '🚩', art: 'hill', category: 'Objective', difficulty: 3, deck: 'own',
      modes: ['ai', 'pvp', 'online'], schedule: 'library',
      tagline: 'Hold the bridges. Only uncontested zones score.',
      desc: 'Two capture zones sit on the bridges. A zone scores 4 points a second for the side whose troops are the only ones in it; if both sides are in it, nobody scores. No towers. First to 100 points wins (or more points at full time). Different from King of the Hill: both zones are always live, scoring is strict, and points, not crowns, decide it.',
      rules: ['No towers. Troops with nothing to fight head for a zone.', 'A zone held by only your troops gives you 4 points/s; contested zones give nothing.', 'First to 100; time out: more points wins, level = overtime, then a draw.'],
      win: 'Reach 100 points, or lead at the end.', loss: 'The opponent reaches 100, or leads at the end.', random: null, fixed: 'All rules.', rewards: LIB_REWARDS,
      build() { return { rules: { noTowers: ['A', 'B'], capture: { spots: [{ x: LANE_X[0], y: 16 }, { x: LANE_X[1], y: 16 }], r: 2.3, rate: 4 }, scoreToWin: 100, overtime: 60 } }; },
    },
    {
      id: 'payload', name: 'Payload Push', icon: '🛒', art: 'hill', category: 'Objective', difficulty: 3, deck: 'own',
      modes: ['ai', 'pvp', 'online'], schedule: 'library',
      tagline: 'Escort the cart into their base.',
      desc: 'A cart starts on the left bridge. It rolls toward the enemy base while only your troops are near it, and stops while it is contested. No towers. Push it all the way to win; at full time the cart\'s side of the river decides, then overtime, then a draw.',
      rules: ['The cart moves 0.45 tiles/s toward the enemy while only your troops are within 2.2 tiles.', 'Contested or empty: it stops.', 'Reach their base line to win. Time out: the side the cart is on loses.'],
      win: 'Push the cart into their base, or have it on their side at the end.', loss: 'The cart reaches your base, or sits on your side at the end.', random: null, fixed: 'All rules.', rewards: LIB_REWARDS,
      build() { return { rules: { noTowers: ['A', 'B'], payload: { x: LANE_X[0], r: 2.2, speed: 0.45, end: 3 }, overtime: 60 } }; },
    },
    {
      id: 'treasure', name: 'Treasure Hunt', icon: '🗝️', art: 'scavenger', category: 'Objective', difficulty: 2, deck: 'own',
      modes: ['ai', 'pvp', 'online'], schedule: 'library',
      tagline: 'Chests appear in pairs. Hold one to claim it. First to 5.',
      desc: 'Every 18 s a pair of chests appears, one on each side of the river at mirrored spots, with a 3 s warning marker. A chest is claimed by standing on it alone for 1.2 s: +1 point and +2 elixir. Unclaimed chests vanish after 20 s. No towers. First to 5 points.',
      rules: ['No towers. Troops with nothing to fight head for the nearest chest.', 'Hold a chest alone for 1.2 s: +1 point, +2 elixir. Contested chests don\'t count down.', 'First to 5; time out: more points wins, level = overtime, then a draw.'],
      win: 'Claim 5 chests, or more by the end.', loss: 'The opponent claims 5, or more by the end.', random: null, fixed: 'Chest timing and mirrored spots.', rewards: LIB_REWARDS,
      build() { return { rules: { noTowers: ['A', 'B'], treasure: { every: 18, life: 20, r: 1.4, hold: 1.2, elixir: 2 }, scoreToWin: 5, overtime: 60 } }; },
    },
    {
      id: 'gambit', name: 'Princess Gambit', icon: '👸', art: 'sudden', category: 'Party', difficulty: 3, deck: 'gambit',
      modes: ['ai', 'pvp', 'online'], schedule: 'library',
      tagline: 'No decks. A 40-card pile, no repeats. First Princess Tower wins.',
      desc: 'Nobody brings a deck. Each side draws from the same 40-card pile in its own random order, and a played card is gone (it only returns if the pile runs dry). Every card with an Evolution comes out evolved, every time. All cards are level 11. Sudden death: destroy one Princess Tower to win.',
      rules: ['No deck: draw from a 40-card pile (same cards for both sides, own order). Played cards don\'t come back.', 'Every card that has an Evolution is always evolved in this mode.', 'All cards and towers level 11. The first Princess Tower destroyed wins; 3:00, then the healthier weakest tower.'],
      win: 'Destroy a Princess Tower first.', loss: 'Lose a Princess Tower first.', random: 'The 40-card pile and each side\'s draw order.', fixed: 'Pile size, levels, rules.', rewards: LIB_REWARDS,
      build(c) { return { rules: { gambit: { pool: gambitPool(c.seed) }, cardLevel: 11, towerLevel: 11, crownsToWin: 1, overtime: 0, evo: { all: true, startCharged: true, cycleDelta: -3 } } }; },
    },
    {
      id: 'backline', name: 'Back-Line Arena', icon: '🧱', art: 'fortress', category: 'Special arena', difficulty: 3, deck: 'own',
      modes: ['ai', 'pvp', 'online'], schedule: 'library',
      tagline: 'Deploy only deep in your own half.',
      desc: 'A walled-off arena: troops and buildings can only be placed at least 4 tiles back from the river (spells anywhere). Every push has to walk the full length, so tanks lead and defences get a moment to set up. 1.5× elixir to keep it moving.',
      rules: ['Troops and buildings: at least 4 tiles behind the river (both sides). Spells: anywhere.', 'No pocket deploys after a tower falls.', '1.5× elixir, 2× in the last minute.'],
      win: 'Normal battle rules.', loss: 'Normal battle rules.', random: null, fixed: 'All rules.', rewards: LIB_REWARDS,
      build() { return { rules: { deployDepth: 4, elixirPhases: [{ at: 0, mult: 1.5 }, { at: 120, mult: 2 }] } }; },
    },
    {
      id: 'infernosiege', name: 'Inferno Siege', icon: '🔥', art: 'boss', category: 'PvE', difficulty: 4, deck: 'own',
      modes: ['ai'], schedule: 'library', scoreLabel: 'Score',
      tagline: 'A fortified base. 16 plays to break its King.',
      desc: 'The enemy base never plays cards, but it is ringed by Inferno Spires and Bolt Turrets that don\'t expire. You have 16 card plays (elixir at 2×) to destroy its King Tower. Read the defences, bait the Spires, and spend your plays where they count.',
      rules: ['The defenders: 3 Inferno Spires and 2 Bolt Turrets around the towers, permanent, at your level.', 'You get 16 plays and 2× elixir; you lose when you are out of plays with no troops left, or at 3:00.', 'Destroy the King Tower to win. Score = time left and plays left.'],
      win: 'Destroy the King Tower.', loss: 'Out of plays with nothing left, or time runs out.', random: null, fixed: 'The base layout.', scripted: true,
      rewards: { play: 30, win: 140, first: { gold: 300, chest: true }, milestones: [{ wins: 3, gold: 250 }] },
      build(c) {
        const L = clamp(c.level, 1, 14);
        const defenses = [
          { card: 'infernospire', side: 'B', x: 6, y: 9.5, level: L }, { card: 'infernospire', side: 'B', x: 12, y: 9.5, level: L },
          { card: 'infernospire', side: 'B', x: 9, y: 6.2, level: L },
          { card: 'boltturret', side: 'B', x: 3.5, y: 9.2, level: L }, { card: 'boltturret', side: 'B', x: 14.5, y: 9.2, level: L },
        ];
        return { rules: { defenses, playLimit: { A: 16, B: 0 }, startElixir: 10, elixirPhases: [{ at: 0, mult: 2 }], timeout: 'defend', overtime: 0 }, scripted: true };
      },
      score(r) { return r.result === 'win' ? 1000 + Math.round((r.timeLeft || 0) * 10) + (r.playsLeft || 0) * 50 : 0; },
    },
    {
      id: 'bossrush', name: 'Boss Rush', icon: '👹', art: 'boss', category: 'PvE', difficulty: 4, deck: 'own',
      modes: ['ai'], schedule: 'library', scoreLabel: 'Score',
      tagline: 'Three bosses, three stages. Beat one to face the next.',
      desc: 'A run of boss fights: the Iron Colossus, then the Stone Warden (slow, huge, wide slams, Rock Shard guards), then the Hive Queen (fast, calls air drones: bring anti-air). Each stage unlocks the next. Every boss telegraphs its slam, calls guards (half damage while they live) and enrages at low health.',
      rules: ['Win a stage to unlock the next; replay any stage you have unlocked.', 'Bosses are at your card level; no enemy towers; 3:00 per stage.', 'Slams are marked 1.4–1.8 s ahead: don\'t drop troops into the circle.'],
      win: 'Destroy the boss.', loss: 'Your King Tower falls, or time runs out.', random: null, fixed: 'All rules.', scripted: true,
      tiers: BOSS_RUSH.map((b, i) => ({ id: b.id, name: b.name, blurb: b.blurb, unlock: i > 0 ? BOSS_RUSH[i - 1].id : null })),
      rewards: { play: 30, win: 150, first: { gold: 350, chest: true, wild: 1 }, milestones: [{ wins: 3, gold: 300 }] },
      build(c) {
        const b = BOSS_RUSH.find((x) => x.id === c.tier) || BOSS_RUSH[0];
        return { rules: { noTowers: ['B'], guard: true, timeout: 'defend', regulation: 180, overtime: 0, boss: { at: 3, card: b.card, lane: rng(c.seed)() < 0.5 ? 0 : 1, level: clamp(c.level, 1, 14) } }, scripted: true };
      },
      score(r) { return r.result === 'win' ? 1000 + Math.round((r.timeLeft || 0) * 10) : Math.round((1 - (r.bossHpFrac == null ? 1 : r.bossHpFrac)) * 800); },
    },
    {
      id: 'endless', name: 'Elite Endurance', icon: '🏔️', art: 'survival', category: 'PvE', difficulty: 4, deck: 'own',
      modes: ['ai'], schedule: 'library', scoreLabel: 'Waves',
      tagline: 'Endless waves, each bigger. How far can you go?',
      desc: 'The long survival: 36 waves, one every 15 s, growing in size and level the whole way. No enemy towers. Score = waves cleared (plus a bonus for towers standing). Surviving all 36 is a win; most runs end earlier, and your best is kept.',
      rules: ['36 waves, one every 15 s; each wave is bigger and up to higher level than the last.', 'Normal elixir, 2× from 2:00. No enemy towers.', 'Your King Tower falls: run over. Score is your best wave.'],
      win: 'Survive all 36 waves.', loss: 'Your King Tower falls.', random: 'Wave make-up (rolled once per week).', fixed: 'Timing and the growth curve.', scripted: true,
      rewards: { play: 30, win: 300, first: { gold: 400, chest: true, wild: 2 }, milestones: [{ wins: 1, badge: 'survivor' }] },
      build(c) { return { rules: { noTowers: ['B'], guard: true, timeout: 'survive', regulation: 560, overtime: 0, waves: endlessWaves(2000 + (c.week || 0), c.level) }, scripted: true }; },
      score(r) { return (r.waves || 0) * 100 + (r.towersStanding || 0) * 100; },
    },
  ];
  const EVENT_MAP = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

  // ─── Challenges (multi-match runs) ───────────────────────────────────────
  //
  // A run is a sequence of rounds; each round is an event (+ tier) against a set AI difficulty.
  // `lives` losses end the run. Each round's reward and the final reward are paid once per week.

  const CHALLENGES = [
    {
      id: 'gauntlet', name: 'Chaos Gauntlet', icon: '🌪️', art: 'chaos', lives: 3,
      tagline: 'Five rounds of rising chaos. Three losses and you\'re out.',
      desc: 'Starts gentle and ends in Total Chaos. Each round adds something: more modifiers, harder AI, a swapping deck, then everything at once.',
      rounds: [
        { event: 'chaos', tier: 'mild', ai: 'normal', note: 'One modifier at a time.' },
        { event: 'chaos', tier: 'wild', ai: 'normal', note: 'Two at once, hazards included.' },
        { event: 'roulette', ai: 'normal', note: 'Your deck won\'t stay the same.' },
        { event: 'chaos', tier: 'extreme', ai: 'hard', note: 'Three at once, against a sharper AI.' },
        { event: 'chaos', tier: 'total', ai: 'hard', note: 'Total Chaos and a Chaos Law.' },
      ],
      roundGold: [80, 120, 160, 220],
      final: { gold: 800, chest: true, wild: 2, badge: 'gauntlet' },
    },
    {
      id: 'ladder', name: 'Rising Ladder', icon: '🪜', art: 'ladder', lives: 3,
      tagline: 'Five different events, each against a tougher AI.',
      desc: 'A tour of the event rules: overloaded elixir, sudden death, a mirror match, the hill, then Extreme Chaos against Insane AI.',
      rounds: [
        { event: 'overload', ai: 'normal', note: 'Warm up with lots of elixir.' },
        { event: 'suddendeath', ai: 'normal', note: 'One tower decides it.' },
        { event: 'mirror', ai: 'hard', note: 'Same deck as the AI.' },
        { event: 'koth', ai: 'hard', note: 'Fight for the bridge.' },
        { event: 'chaos', tier: 'extreme', ai: 'insane', note: 'The final climb.' },
      ],
      roundGold: [70, 110, 150, 200],
      final: { gold: 700, chest: true, wild: 2, badge: 'ladder' },
    },
  ];
  const CHALLENGE_MAP = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));

  // ─── Achievements and badges ─────────────────────────────────────────────
  // check(r, P) runs after a result is recorded: r = the result, P = event progress (already updated)

  const BADGES = {
    chaoslord: { icon: '🌀', name: 'Chaos Lord' }, hillking: { icon: '⛰️', name: 'Hill King' }, survivor: { icon: '🛡️', name: 'Survivor' },
    gauntlet: { icon: '🌪️', name: 'Gauntlet Champion' }, ladder: { icon: '🪜', name: 'Ladder Climber' }, colossus: { icon: '🤖', name: 'Colossus Breaker' },
    flawless: { icon: '💎', name: 'Flawless' }, explorer: { icon: '🧭', name: 'Explorer' }, total: { icon: '☢️', name: 'Agent of Chaos' },
    streak: { icon: '🔥', name: 'On Fire' }, mutator: { icon: '🧬', name: 'Mutator' },
  };
  const won = (r) => r.result === 'win';
  const ACHIEVEMENTS = [
    { id: 'chaos_tamer', icon: '🌀', name: 'Chaos Tamer', desc: 'Win a Chaos Mode match (any intensity).', gold: 150, check: (r) => won(r) && r.eventId === 'chaos' },
    { id: 'chaos_flawless', icon: '💎', name: 'Eye of the Storm', desc: 'Win a Chaos Mode match without losing a tower.', gold: 250, badge: 'flawless', check: (r) => won(r) && r.eventId === 'chaos' && r.towersLost === 0 },
    { id: 'chaos_total', icon: '☢️', name: 'Agent of Chaos', desc: 'Win a Total Chaos match.', gold: 400, badge: 'total', check: (r) => won(r) && r.eventId === 'chaos' && r.tier === 'total' },
    { id: 'survivor', icon: '🛡️', name: 'Last One Standing', desc: 'Win Last Stand.', gold: 200, check: (r) => won(r) && r.eventId === 'survival' },
    { id: 'boss_down', icon: '🤖', name: 'Scrap Metal', desc: 'Defeat the Iron Colossus.', gold: 200, check: (r) => won(r) && r.eventId === 'boss' },
    { id: 'boss_nightmare', icon: '👹', name: 'Colossus Breaker', desc: 'Defeat the Iron Colossus on Nightmare.', gold: 500, badge: 'colossus', check: (r) => won(r) && r.eventId === 'boss' && r.tier === 'nightmare' },
    { id: 'hill_king', icon: '⛰️', name: 'Holding Ground', desc: 'Win King of the Hill with at least 2 hill crowns.', gold: 200, check: (r) => won(r) && r.eventId === 'koth' && (r.hillCrowns || 0) >= 2 },
    { id: 'drafted', icon: '🃏', name: 'Draft Pick', desc: 'Win a Draft Duel.', gold: 150, check: (r) => won(r) && r.eventId === 'draft' },
    { id: 'gauntlet_done', icon: '🌪️', name: 'Through the Storm', desc: 'Complete the Chaos Gauntlet.', gold: 300, check: (r, P) => !!(P.challenges.gauntlet && P.challenges.gauntlet.completions > 0) },
    { id: 'ladder_done', icon: '🪜', name: 'Top Rung', desc: 'Complete the Rising Ladder.', gold: 300, check: (r, P) => !!(P.challenges.ladder && P.challenges.ladder.completions > 0) },
    { id: 'explorer', icon: '🧭', name: 'Explorer', desc: 'Win 6 different events.', gold: 300, badge: 'explorer', check: (r, P) => Object.keys(P.records).filter((id) => P.records[id].wins > 0).length >= 6 },
    { id: 'upgrades_win', icon: '🧬', name: 'Survival of the Fittest', desc: 'Win a C.H.A.O.S. match.', gold: 150, check: (r) => won(r) && r.eventId === 'upgrades' },
    { id: 'upgrades_epic', icon: '💥', name: 'Full Mutation', desc: 'Win a C.H.A.O.S. match with an Epic upgrade.', gold: 250, check: (r) => won(r) && r.eventId === 'upgrades' && (r.epicUpgrades || 0) > 0 },
    { id: 'streak5', icon: '🔥', name: 'On Fire', desc: 'Win 5 event matches in a row.', gold: 250, badge: 'streak', check: (r, P) => P.stats.streak >= 5 },
  ];

  // ─── Rotation and schedule ───────────────────────────────────────────────
  //
  // Day = UTC day number; week starts Monday (UTC). Everything is derived from the date, so the
  // line-up is the same for everyone whose clock is right. It is NOT pushed from a server: a player
  // who changes their clock sees another day's line-up. Progress is keyed by day/week ids, and
  // one-time rewards are keyed so changing the clock can't pay them twice.

  const ROTATING = EVENTS.filter((e) => e.schedule === 'rotating').map((e) => e.id);
  const PERMANENT = EVENTS.filter((e) => e.schedule === 'permanent').map((e) => e.id);
  const DAILY_COUNT = 4;

  function dayOf(now) { return Math.floor(now / DAY_MS); }
  function weekOf(now) { return Math.floor((dayOf(now) + 3) / 7); } // day 0 (1 Jan 1970) was a Thursday
  function isWeekend(now) { const d = new Date(now).getUTCDay(); return d === 0 || d === 6; }

  // The daily line-up: different categories where possible, never yesterday's events again.
  // Each day is picked avoiding the previous day's picks, walking forward from a fixed start date,
  // so the guarantee holds every day (results are cached; it's a few hundred cheap steps at most).
  const ROTATION_EPOCH = Math.floor(Date.UTC(2026, 0, 1) / DAY_MS);
  const dailyCache = new Map();
  function pickDaily(d, avoid, salt) {
    const order = shuffle(ROTATING, rng(hashStr(salt ? `daily-${d}-r${salt}` : `daily-${d}`)));
    const out = [];
    const cats = new Set();
    for (const pass of [0, 1, 2]) {
      for (const id of order) {
        if (out.length >= DAILY_COUNT) break;
        if (out.includes(id)) continue;
        if (pass < 2 && avoid.includes(id)) continue;
        if (pass === 0 && cats.has(EVENT_MAP[id].category)) continue;
        out.push(id);
        cats.add(EVENT_MAP[id].category);
      }
    }
    return out;
  }
  function dailyFor(day) {
    if (day <= ROTATION_EPOCH) return pickDaily(day, []);
    if (dailyCache.has(day)) return dailyCache.get(day);
    let from = day - 1;
    while (from > ROTATION_EPOCH && !dailyCache.has(from)) from--;
    let prev = from <= ROTATION_EPOCH ? pickDaily(from, []) : dailyCache.get(from);
    for (let d = from + 1; d <= day; d++) {
      prev = pickDaily(d, prev);
      dailyCache.set(d, prev);
    }
    if (dailyCache.size > 4000) dailyCache.clear();
    return prev;
  }

  /**
   * Everything the event hub shows for this moment. `forceAll` (dev/admin) opens every event.
   * `reroll` (admin, a positive integer) swaps in another random line-up and weekly challenge.
   */
  function rotation(now, opts) {
    const day = dayOf(now);
    const week = weekOf(now);
    const salt = (opts && opts.reroll) >>> 0;
    const daily = salt ? pickDaily(day, dailyFor(day - 1), salt) : dailyFor(day);
    const weekend = isWeekend(now);
    const cw = week + salt;
    const challenge = CHALLENGES[cw % CHALLENGES.length].id;
    return {
      now, day, week,
      dayEndsAt: (day + 1) * DAY_MS,
      weekEndsAt: weekStart(week + 1),
      permanent: PERMANENT.slice(),
      daily,
      tomorrow: salt ? pickDaily(day + 1, daily, salt) : dailyFor(day + 1),
      challenge,
      nextChallenge: CHALLENGES[(cw + 1) % CHALLENGES.length].id,
      reroll: salt,
      // Weekends feature Chaos Mode; weekdays feature the first daily event
      featured: weekend ? 'chaos' : daily[0],
      weekend,
      forceAll: !!(opts && opts.forceAll),
    };
  }

  function weekStart(week) { return (week * 7 - 3) * DAY_MS; }

  /** Is this event (or challenge) open right now? Returns { ok, reason }. */
  function availability(id, now, opts) {
    const rot = rotation(now, opts);
    if (rot.forceAll) return { ok: true };
    if (CHALLENGE_MAP[id]) return id === rot.challenge ? { ok: true } : { ok: false, reason: `Returns in a later week.` };
    const ev = EVENT_MAP[id];
    if (!ev) return { ok: false, reason: 'Unknown event.' };
    if (ev.schedule === 'permanent' || ev.schedule === 'library') return { ok: true };
    if (rot.daily.includes(id)) return { ok: true, featured: true };
    // Rotation only decides what is featured: every event stays playable (casual: no event gold)
    return { ok: true, casual: true, reason: rot.tomorrow.includes(id) ? 'Featured tomorrow; casual today (no event gold).' : 'Not featured today: casual (no event gold).' };
  }

  // ─── Match configs ───────────────────────────────────────────────────────

  /**
   * Build everything a match needs for an event.
   *   c.seed          match seed (the engine seed too)
   *   c.tier          intensity/difficulty tier id (Chaos, Boss)
   *   c.decks         { A, B } deck entries for 'own'-deck events (already checked by the caller)
   *   c.hasEvo        someone has an Evolution equipped
   *   c.picks         draft picks (c.rounds: the draft rounds that were shown, else rolled from the seed)
   *   c.now           for the weekly survival waves
   *   c.level         card level for decks the event hands out (same for both sides)
   * Returns { eventId, tier, rules, decks: {A,B}, scripted, law, rounds } or throws on an unknown event.
   */
  function buildMatch(eventId, c) {
    const ev = EVENT_MAP[eventId];
    if (!ev) throw new Error(`Unknown event: ${eventId}`);
    const ctx = { seed: (c && c.seed) >>> 0 || 1, tier: c && c.tier, picks: c && c.picks, rounds: c && Array.isArray(c.rounds) && c.rounds.length === 8 ? c.rounds : null, hasEvo: !!(c && c.hasEvo), week: weekOf((c && c.now) || Date.now()), level: clamp(Math.round(Number(c && c.level) || EVENT_LEVEL), 1, 14) };
    if (ev.tiers && !ev.tiers.some((t) => t.id === ctx.tier)) ctx.tier = ev.tiers[0].id;
    const built = ev.build(ctx);
    const tierName = ev.tiers ? ev.tiers.find((t) => t.id === ctx.tier).name : null;
    const rules = Sim.normalizeRules({ ...built.rules, eventId, label: tierName && ev.id !== 'chaos' ? `${ev.name} · ${tierName}` : tierName || ev.name });
    const decks = built.decks || { A: (c && c.decks && c.decks.A) || null, B: (c && c.decks && c.decks.B) || null };
    return { eventId, tier: ev.tiers ? ctx.tier : null, rules, decks, scripted: !!built.scripted, law: built.law || null, rounds: built.rounds || null };
  }

  /** How an event (and tier) gets its decks: 'own' | 'draft' | 'mirror' | 'roulette'. A tier can override the event. */
  function deckKind(eventId, tier) {
    const ev = EVENT_MAP[eventId];
    if (!ev) return 'own';
    const t = ev.tiers && ev.tiers.find((x) => x.id === tier);
    return (t && t.deck) || ev.deck;
  }

  /** Where an event (and tier) can be played: 'ai', 'pvp', 'online'. */
  function modesFor(eventId, tier) {
    const ev = EVENT_MAP[eventId];
    if (!ev) return [];
    const t = ev.tiers && ev.tiers.find((x) => x.id === tier);
    return ((t && t.modes) || ev.modes).filter((m) => ev.modes.includes(m));
  }

  /** Clean a saved C.H.A.O.S. deck: pool cards only, no repeats, at most 8. */
  function cleanChaosDeck(ids) {
    const out = [];
    (Array.isArray(ids) ? ids : []).forEach((id) => { if (typeof id === 'string' && Sim.CHAOS_POOL.includes(id) && !out.includes(id) && out.length < Sim.MAX_DECK) out.push(id); });
    return out;
  }

  /**
   * Online and local entry point for own-deck events: returns a deck that is legal for the event.
   * An illegal deck is replaced by a loaner deck (the player is told why).
   */
  function legalDeckFor(eventId, entriesIn, seed, tier) {
    const ev = EVENT_MAP[eventId];
    const list = Array.isArray(entriesIn) ? entriesIn : [];
    const ids = list.map((e) => (typeof e === 'string' ? e : e && e.id));
    if (!ev || deckKind(eventId, tier) !== 'own') return { entries: list, loaner: false };
    const check = validateDeck(eventId, ids);
    if (check.ok) return { entries: list, loaner: false, problems: [] };
    const avg = list.length ? Math.round(list.reduce((s, e) => s + (Number(e && e.level) || 1), 0) / list.length) : EVENT_LEVEL;
    return { entries: entries(loanerDeck(eventId, seed), clamp(avg, 1, 14)), loaner: true, problems: check.problems };
  }

  /** The AI's deck for an own-deck event: legal for the event's deck rules, otherwise an arena deck. */
  function aiDeckFor(eventId, seed, arena) {
    const ev = EVENT_MAP[eventId];
    if (ev && ev.deckRules) return loanerDeck(eventId, seed);
    return Sim.buildAiDeck(arena == null ? Sim.MAX_ARENA : arena, rng(seed));
  }

  // ─── Progress, rewards and records ───────────────────────────────────────

  function freshRecord() { return { played: 0, wins: 0, losses: 0, draws: 0, best: 0, bestTier: -1, streak: 0, fastest: 0, firstWin: {}, milestones: {} }; }
  function freshProgress() {
    return {
      v: PROGRESS_VERSION,
      records: {},
      daily: { day: -1, wins: {}, plays: {} },
      settled: [],
      pending: null,
      challenges: {},
      achievements: {},
      badges: {},
      title: null,
      stats: { matches: 0, wins: 0, losses: 0, draws: 0, streak: 0, bestStreak: 0, chaosWins: 0, chaosTier: -1, bestWave: 0, bestBossTime: 0, challengeWins: 0 },
      seen: {},
      chaosDeck: [],   // the C.H.A.O.S. deck (pool card ids), built on the event screen
    };
  }

  const n0 = (v, hi) => clamp(Math.floor(Number(v) || 0), 0, hi || 1e9);

  /** Clean a saved event progress object: unknown events/badges dropped, numbers clamped, old saves upgraded. */
  function normalizeProgress(raw) {
    const P = freshProgress();
    const r = raw && typeof raw === 'object' ? raw : {};
    if (r.records && typeof r.records === 'object') {
      Object.keys(r.records).forEach((id) => {
        if (!EVENT_MAP[id]) return; // removed or renamed events are dropped, nothing else is touched
        const s = r.records[id] || {};
        const rec = freshRecord();
        ['played', 'wins', 'losses', 'draws', 'best', 'streak', 'fastest'].forEach((k) => { rec[k] = n0(s[k]); });
        const tiers = EVENT_MAP[id].tiers;
        rec.bestTier = tiers ? clamp(Math.floor(Number(s.bestTier)), -1, tiers.length - 1) : -1;
        if (!Number.isFinite(rec.bestTier)) rec.bestTier = -1;
        if (s.firstWin && typeof s.firstWin === 'object') Object.keys(s.firstWin).forEach((k) => { if (s.firstWin[k]) rec.firstWin[k] = 1; });
        if (s.milestones && typeof s.milestones === 'object') Object.keys(s.milestones).forEach((k) => { if (s.milestones[k]) rec.milestones[k] = 1; });
        P.records[id] = rec;
      });
    }
    if (r.daily && typeof r.daily === 'object') {
      P.daily.day = Math.floor(Number(r.daily.day)) || -1;
      ['wins', 'plays'].forEach((k) => {
        const m = r.daily[k] && typeof r.daily[k] === 'object' ? r.daily[k] : {};
        Object.keys(m).forEach((id) => { if (EVENT_MAP[id]) P.daily[k][id] = n0(m[id], 99); });
      });
    }
    P.settled = (Array.isArray(r.settled) ? r.settled : []).filter((x) => typeof x === 'string').slice(-SETTLED_KEEP);
    if (r.pending && typeof r.pending === 'object' && typeof r.pending.matchId === 'string' && (EVENT_MAP[r.pending.eventId])) {
      P.pending = {
        matchId: r.pending.matchId, eventId: r.pending.eventId, tier: typeof r.pending.tier === 'string' ? r.pending.tier : null,
        engaged: !!r.pending.engaged, challenge: CHALLENGE_MAP[r.pending.challenge] ? r.pending.challenge : null,
        ai: typeof r.pending.ai === 'string' ? r.pending.ai : 'normal', at: n0(r.pending.at),
      };
    }
    if (r.challenges && typeof r.challenges === 'object') {
      Object.keys(r.challenges).forEach((id) => {
        const ch = CHALLENGE_MAP[id];
        if (!ch) return;
        const s = r.challenges[id] || {};
        P.challenges[id] = {
          week: Math.floor(Number(s.week)) || 0,
          active: !!s.active,
          round: n0(s.round, ch.rounds.length),
          losses: n0(s.losses, ch.lives),
          claimed: {},
          completions: n0(s.completions),
          best: n0(s.best, ch.rounds.length),
          runs: n0(s.runs),
        };
        if (s.claimed && typeof s.claimed === 'object') Object.keys(s.claimed).forEach((k) => { if (s.claimed[k]) P.challenges[id].claimed[k] = 1; });
      });
    }
    if (r.achievements && typeof r.achievements === 'object') ACHIEVEMENTS.forEach((a) => { if (r.achievements[a.id]) P.achievements[a.id] = n0(r.achievements[a.id]) || 1; });
    if (r.badges && typeof r.badges === 'object') Object.keys(BADGES).forEach((b) => { if (r.badges[b]) P.badges[b] = 1; });
    P.title = typeof r.title === 'string' && P.badges[r.title] ? r.title : null;
    if (r.stats && typeof r.stats === 'object') {
      Object.keys(P.stats).forEach((k) => {
        if (k !== 'chaosTier') { P.stats[k] = n0(r.stats[k]); return; }
        const t = Math.floor(Number(r.stats[k]));
        P.stats[k] = Number.isFinite(t) ? clamp(t, -1, CHAOS_TIERS.length - 1) : -1;
      });
    }
    if (r.seen && typeof r.seen === 'object') Object.keys(r.seen).slice(0, 50).forEach((k) => { P.seen[k] = 1; });
    P.chaosDeck = cleanChaosDeck(r.chaosDeck);
    return P;
  }

  function record(P, id) { return P.records[id] || (P.records[id] = freshRecord()); }

  /** Is this tier unlocked? (Tier 1 always; later tiers need a win on the previous tier.) */
  function tierUnlocked(P, eventId, tierId) {
    const ev = EVENT_MAP[eventId];
    if (!ev || !ev.tiers) return true;
    const i = ev.tiers.findIndex((t) => t.id === tierId);
    if (i < 0) return false;
    if (ev.tiers[i].unlock == null) return true; // no requirement (the first tier, and C.H.A.O.S. variants)
    return (P.records[eventId] ? P.records[eventId].bestTier : -1) >= i - 1;
  }

  // The current week's challenge run (a run started last week can still be finished)
  function challengeState(P, id, now) {
    const ch = CHALLENGE_MAP[id];
    if (!ch) return null;
    const week = weekOf(now);
    let s = P.challenges[id];
    if (!s) s = P.challenges[id] = { week, active: false, round: 0, losses: 0, claimed: {}, completions: 0, best: 0, runs: 0 };
    if (s.week !== week && !s.active) { s.week = week; s.round = 0; s.losses = 0; s.claimed = {}; }
    return s;
  }

  function startChallenge(P, id, now) {
    const s = challengeState(P, id, now);
    if (!s) return { ok: false, reason: 'Unknown challenge.' };
    if (!s.active) { s.active = true; s.round = 0; s.losses = 0; s.runs += 1; }
    return { ok: true, state: s, round: CHALLENGE_MAP[id].rounds[s.round] };
  }

  /**
   * Called when an event match starts. Records it as pending, so leaving after playing a card
   * counts as a loss (same policy as ranked). Settles a stale pending match first.
   */
  function beginMatch(P, m, now) {
    const stale = P.pending && P.pending.matchId !== m.matchId ? resolvePending(P, now) : null;
    P.pending = { matchId: String(m.matchId), eventId: m.eventId, tier: m.tier || null, engaged: false, challenge: m.challenge || null, ai: m.ai || 'normal', at: now };
    return stale;
  }

  function markEngaged(P, matchId) {
    if (P.pending && P.pending.matchId === matchId) P.pending.engaged = true;
  }

  /** A match that never finished: a loss if a card was played (once), otherwise forgotten. */
  function resolvePending(P, now) {
    const pd = P.pending;
    P.pending = null;
    if (!pd || !pd.engaged) return null;
    return settleMatch(P, { matchId: pd.matchId, eventId: pd.eventId, tier: pd.tier, challenge: pd.challenge, ai: pd.ai, result: 'loss', abandoned: true }, now);
  }

  const AI_GOLD = { easy: 0.6, normal: 1, hard: 1.3, insane: 1.6, pvp: 0, online: 0.8 };

  /**
   * Apply a finished event match exactly once (by matchId).
   *   r: { matchId, eventId, tier, result: 'win'|'loss'|'draw', ai, mode, challenge, towersLost, towersStanding,
   *        waves, bossHpFrac, timeLeft, hillCrowns, duration, cardsPlayed, abandoned, noRewards, void }
   * Returns { applied, rewards: [{ kind, amount?, label }], score, newBest, achievements, challenge, unlockedTier }
   * Reward kinds the page grants: gold, chest, wild, badge. Nothing here touches the wallet itself.
   */
  function settleMatch(P, r, now) {
    const ev = EVENT_MAP[r.eventId];
    const out = { applied: false, rewards: [], score: 0, newBest: false, achievements: [], challenge: null, unlockedTier: null };
    if (!ev || !r.matchId || P.settled.includes(r.matchId)) return out;
    P.settled.push(r.matchId);
    if (P.settled.length > SETTLED_KEEP) P.settled.splice(0, P.settled.length - SETTLED_KEEP);
    if (P.pending && P.pending.matchId === r.matchId) P.pending = null;
    out.applied = true;
    // A void match (e.g. the opponent left in the first seconds) counts for nothing at all, and
    // local PvP (both sides on one device) is friendly: no records, unlocks, achievements or rewards
    if (r.void) { out.void = true; return out; }
    if (r.mode === 'pvp') { out.friendly = true; return out; }

    const day = dayOf(now);
    if (P.daily.day !== day) P.daily = { day, wins: {}, plays: {} };
    const rec = record(P, ev.id);
    const st = P.stats;
    const win = r.result === 'win';
    rec.played += 1;
    st.matches += 1;
    if (win) { rec.wins += 1; st.wins += 1; rec.streak += 1; st.streak += 1; st.bestStreak = Math.max(st.bestStreak, st.streak); }
    else { rec.streak = 0; st.streak = 0; if (r.result === 'loss') { rec.losses += 1; st.losses += 1; } else { rec.draws += 1; st.draws += 1; } }

    const tierIdx = ev.tiers ? ev.tiers.findIndex((t) => t.id === r.tier) : -1;
    if (win && tierIdx > rec.bestTier) {
      if (ev.tiers[tierIdx + 1]) out.unlockedTier = ev.tiers[tierIdx + 1];
      rec.bestTier = tierIdx;
    }
    if (ev.id === 'chaos' && win) { st.chaosWins += 1; st.chaosTier = Math.max(st.chaosTier, tierIdx); }
    if (ev.id === 'survival') st.bestWave = Math.max(st.bestWave, n0(r.waves, 99));
    if (ev.id === 'boss' && win) st.bestBossTime = Math.max(st.bestBossTime, Math.round(r.timeLeft || 0));
    if (win && r.duration > 0 && (!rec.fastest || r.duration < rec.fastest)) rec.fastest = Math.round(r.duration);
    if (ev.score) {
      out.score = Math.max(0, Math.round(ev.score(r)));
      if (out.score > rec.best) { out.newBest = rec.best > 0 || out.score > 0; rec.best = out.score; }
    }

    // Rewards: none for abandoned matches or admin/dev runs (local PvP returned above), and no
    // event gold for a rotating event played on a day it isn't featured (challenge rounds excepted)
    const featured = ev.schedule !== 'rotating' || !!r.challenge || rotation(now).daily.includes(ev.id);
    if (!featured) out.casual = true;
    const paid = !r.abandoned && !r.noRewards && featured;
    const give = (kind, amount, label) => { if (amount) out.rewards.push({ kind, amount, label }); };
    if (paid) {
      const mult = AI_GOLD[r.mode === 'online' ? 'online' : r.ai] || 1;
      const plays = P.daily.plays[ev.id] || 0;
      if (plays < DAILY_PLAY_CAP && (r.cardsPlayed || 0) > 0) { give('gold', Math.round(ev.rewards.play * mult), 'Played'); P.daily.plays[ev.id] = plays + 1; }
      if (win) {
        const wins = P.daily.wins[ev.id] || 0;
        if (wins < DAILY_WIN_CAP) {
          give('gold', Math.round(ev.rewards.win * mult), `Victory (${wins + 1}/${DAILY_WIN_CAP} today)`);
          P.daily.wins[ev.id] = wins + 1;
        } else out.rewards.push({ kind: 'note', label: `Daily reward limit reached for ${ev.name}. Records still count.` });
        // First win (per tier) pays once, ever
        const fk = r.tier || 'base';
        if (!rec.firstWin[fk]) {
          rec.firstWin[fk] = 1;
          const f = ev.rewards.first;
          give('gold', f.gold, 'First win bonus');
          if (f.chest) give('chest', 1, 'First win chest');
          if (f.wild) give('wild', f.wild, 'First win Wild Shards');
        }
      }
      (ev.rewards.milestones || []).forEach((m) => {
        const key = `w${m.wins}`;
        if (rec.wins < m.wins || rec.milestones[key]) return;
        rec.milestones[key] = 1;
        give('gold', m.gold, `${m.wins} wins milestone`);
        if (m.chest) give('chest', 1, `${m.wins} wins chest`);
        if (m.badge && !P.badges[m.badge]) { P.badges[m.badge] = 1; out.rewards.push({ kind: 'badge', id: m.badge, label: `Badge: ${BADGES[m.badge].name}` }); }
      });
    }

    // Challenge progress
    if (r.challenge && CHALLENGE_MAP[r.challenge]) {
      const ch = CHALLENGE_MAP[r.challenge];
      const s = challengeState(P, ch.id, now);
      if (s.active) {
        const roundIdx = s.round;
        const info = { id: ch.id, round: roundIdx, result: r.result, done: false, failed: false };
        if (win) {
          s.round += 1;
          s.best = Math.max(s.best, s.round);
          const key = `r${roundIdx}`;
          if (paid && !s.claimed[key] && s.round < ch.rounds.length) {
            s.claimed[key] = 1;
            give('gold', ch.roundGold[roundIdx] || 0, `${ch.name}: round ${roundIdx + 1} cleared`);
          }
          if (s.round >= ch.rounds.length) {
            s.active = false;
            s.completions += 1;
            st.challengeWins += 1;
            info.done = true;
            if (paid && !s.claimed.final) {
              s.claimed.final = 1;
              const f = ch.final;
              give('gold', f.gold, `${ch.name} complete!`);
              if (f.chest) give('chest', 1, `${ch.name} chest`);
              if (f.wild) give('wild', f.wild, `${ch.name} Wild Shards`);
              if (f.badge && !P.badges[f.badge]) { P.badges[f.badge] = 1; out.rewards.push({ kind: 'badge', id: f.badge, label: `Badge: ${BADGES[f.badge].name}` }); }
            }
          }
        } else {
          s.losses += 1;
          if (s.losses >= ch.lives) { s.active = false; info.failed = true; }
        }
        info.state = { round: s.round, losses: s.losses, lives: ch.lives, active: s.active };
        out.challenge = info;
      }
    }

    // Achievements (each once)
    ACHIEVEMENTS.forEach((a) => {
      if (P.achievements[a.id] || r.abandoned || r.noRewards || !a.check(r, P)) return;
      P.achievements[a.id] = now || 1;
      out.achievements.push(a);
      if (paid) give('gold', a.gold, `Achievement: ${a.name}`);
      if (a.badge && !P.badges[a.badge]) { P.badges[a.badge] = 1; out.rewards.push({ kind: 'badge', id: a.badge, label: `Badge: ${BADGES[a.badge].name}` }); }
    });
    return out;
  }

  function setTitle(P, badgeId) {
    if (badgeId == null) { P.title = null; return true; }
    if (!P.badges[badgeId]) return false;
    P.title = badgeId;
    return true;
  }

  return {
    EVENTS, EVENT_MAP, CHALLENGES, CHALLENGE_MAP, CHAOS_TIERS, CHAOS_LAWS, BOSS_TIERS, ACHIEVEMENTS, BADGES,
    CHAOS_VARIANTS, CHAOS_VARIANT_MAP, CHAOS_LEVEL, deckKind, modesFor, cleanChaosDeck, gambitPool, endlessWaves, BOSS_RUSH,
    EVENT_LEVEL, DAILY_WIN_CAP, DAILY_PLAY_CAP, DAY_MS,
    rng, validateDeck, loanerDeck, cardAllowed, draftRounds, draftDecks, buildChaosSchedule, survivalWaves,
    rotation, availability, dayOf, weekOf, weekStart, dailyFor,
    buildMatch, legalDeckFor, aiDeckFor,
    freshProgress, normalizeProgress, tierUnlocked, challengeState, startChallenge,
    beginMatch, markEngaged, resolvePending, settleMatch, setTitle,
  };
});
