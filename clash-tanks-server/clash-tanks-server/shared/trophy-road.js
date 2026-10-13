/*
 * Trophy Road: arenas, trophy gains and losses, milestone rewards.
 *
 * Pure rules with no DOM or storage, so the browser and the tests share one copy.
 * The page keeps a `road` object in the player's saved progress:
 *   { trophies, best, claimed: { milestoneId: time }, recent: [matchId], pending, theme }
 * and calls these functions to change it. Every change is idempotent:
 *   - a match result is applied at most once (by match id)
 *   - a milestone can be claimed at most once (by milestone id)
 *   - a ranked match that is abandoned counts as one loss, once
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TrophyRoad = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const MAX_TROPHIES = 7000;

  // Each arena has its own battlefield theme (drawn by the arena renderer)
  const ARENAS = [
    { id: 0, name: 'Boot Camp', icon: '🏕️', min: 0, theme: 'meadow', blurb: 'Fresh grass and a calm river. Learn the ropes.' },
    { id: 1, name: 'Scrapyard', icon: '🔩', min: 300, theme: 'scrap', blurb: 'Rusty plates and oil slicks. Skeletons, sparks and tar.' },
    { id: 2, name: 'Frost Pass', icon: '🏔️', min: 700, theme: 'frost', blurb: 'Snowfields over an icy river. Freeze and slow your foes.' },
    { id: 3, name: 'Sunscorch Dunes', icon: '🏜️', min: 1100, theme: 'dunes', blurb: 'Sand, heat and boulders. Siege from afar or dig under.' },
    { id: 4, name: 'Jungle Ruins', icon: '🌴', min: 1500, theme: 'jungle', blurb: 'Overgrown stone. Healers, hangars and decoys.' },
    { id: 5, name: 'Volcano Forge', icon: '🔥', min: 2000, theme: 'volcano', blurb: 'A lava river. Infernos, overdrive and elixir pumps.' },
    { id: 6, name: 'Neon Circuit', icon: '💡', min: 2600, theme: 'neon', blurb: 'A glowing grid. Hidden coils, blades and gravity.' },
    { id: 7, name: 'Sky Citadel', icon: '☁️', min: 3300, theme: 'sky', blurb: 'Above the clouds. Zeppelins and paratroopers.' },
    { id: 8, name: 'Royal Colosseum', icon: '🏛️', min: 4000, theme: 'royal', blurb: 'Marble and gold. Titans and orbital strikes.' },
    { id: 9, name: 'Legend Summit', icon: '🏆', min: 5000, theme: 'legend', blurb: 'The top of the road. Only the best climb further.' },
  ];

  // Cards that are new in each arena (the Trophy Road hands these out; chests can drop them too)
  const NEW_CARDS = {
    1: ['bonecrypt', 'flakgunner', 'sparkspirit', 'tartrap'],
    2: ['frostnova', 'shieldknight', 'cryocaster', 'flaktower'],
    3: ['boulder', 'mortarbunker', 'moledriller', 'acidpool'],
    4: ['repairwave', 'medicbot', 'dronehangar', 'sirenbeacon'],
    5: ['infernospire', 'teslatank', 'overdrive', 'elixirpump'],
    6: ['teslapit', 'boomerang', 'gravitywell', 'phantomrider'],
    7: ['stormzeppelin', 'paratroopers'],
    8: ['rocktitan', 'orbitallaser'],
  };

  // Evolution Shards on the road: [trophies, reward]. These stops sit between the regular ones, so
  // adding them never changes a milestone a player has already claimed. The first Evolution is a
  // complete one early on, so everyone gets to try the system.
  const EVO_STOPS = [
    [120, { type: 'shards', slug: 'brawler', amount: 6 }],
    [340, { type: 'wild', amount: 2 }],
    [560, { type: 'shards', slug: 'junkpack', amount: 4 }],
    [760, { type: 'wild', amount: 2 }],
    [980, { type: 'shards', slug: 'firebomb', amount: 4 }],
    [1260, { type: 'wild', amount: 2 }],
    [1460, { type: 'shards', slug: 'boltturret', amount: 4 }],
    [1730, { type: 'wild', amount: 3 }],
    [2150, { type: 'shards', slug: 'guardian', amount: 4 }],
    [2480, { type: 'wild', amount: 3 }],
    [2790, { type: 'shards', slug: 'rocketrain', amount: 4 }],
    [3140, { type: 'wild', amount: 3 }],
    [3600, { type: 'shards', slug: 'flarepod', amount: 4 }],
    [4250, { type: 'wild', amount: 4 }],
    [4600, { type: 'shards', slug: 'raylance', amount: 4 }],
    [5330, { type: 'wild', amount: 4 }],
    [6000, { type: 'wild', amount: 6 }],
  ];

  // Emotes unlocked on the road (the rest come from achievements)
  const ROAD_EMOTES = { 0: 'heart', 3: 'thinking', 6: 'sleepy', 9: 'trophy' };

  // ── Trophy changes ──
  // Online (matchmaking): +30 for a win; losses cost more the higher you climb.
  // vs AI: harder AIs give more and cost less, and each difficulty can only take you so far.
  const ONLINE_WIN = 30;
  const LOSS_BY_ARENA = [5, 12, 16, 20, 22, 24, 26, 28, 30, 30];
  const AI_RULES = {
    easy: { win: 12, loss: 1.0, cap: 800, label: 'Easy' },
    normal: { win: 20, loss: 0.9, cap: 2000, label: 'Normal' },
    hard: { win: 26, loss: 0.75, cap: 3600, label: 'Hard' },
    insane: { win: 32, loss: 0.6, cap: MAX_TROPHIES, label: 'Insane' },
  };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function arenaFor(trophies) {
    let a = ARENAS[0];
    for (const x of ARENAS) if (trophies >= x.min) a = x;
    return a;
  }

  function nextArena(trophies) {
    return ARENAS.find((a) => a.min > trophies) || null;
  }

  // "Frost Pass II" style ranks inside each arena; leagues above Legend Summit
  const LEAGUES = [
    { min: 5000, name: 'Legend' },
    { min: 5600, name: 'Champion' },
    { min: 6200, name: 'Grand Champion' },
    { min: 6800, name: 'Ultimate Champion' },
  ];
  function rankOf(trophies) {
    const t = clamp(Math.floor(trophies || 0), 0, MAX_TROPHIES);
    const arena = arenaFor(t);
    if (arena.id === ARENAS.length - 1) {
      let league = LEAGUES[0];
      for (const l of LEAGUES) if (t >= l.min) league = l;
      return { arena, label: league.name, tier: LEAGUES.indexOf(league) };
    }
    const next = nextArena(t);
    const span = next.min - arena.min;
    const tier = clamp(Math.floor(((t - arena.min) / span) * 3), 0, 2);
    return { arena, label: `${arena.name} ${['I', 'II', 'III'][tier]}`, tier };
  }

  function lossFor(trophies) {
    return LOSS_BY_ARENA[arenaFor(trophies).id];
  }

  /**
   * How many trophies a result is worth.
   * r: { result: 'win'|'loss'|'draw', mode: 'online'|'ai', difficulty }
   * Returns { delta, capped, floor } where `capped` means an AI difficulty ceiling stopped the gain.
   */
  function trophyChange(trophies, r) {
    const t = clamp(Math.floor(trophies || 0), 0, MAX_TROPHIES);
    if (r.result === 'draw') return { delta: 0, capped: false, floor: false };
    let delta = 0;
    let capped = false;
    if (r.mode === 'online') {
      delta = r.result === 'win' ? ONLINE_WIN : -lossFor(t);
    } else {
      const rules = AI_RULES[r.difficulty] || AI_RULES.normal;
      if (r.result === 'win') {
        delta = Math.max(0, Math.min(rules.win, rules.cap - t));
        capped = delta < rules.win;
      } else {
        delta = -Math.round(lossFor(t) * rules.loss);
      }
    }
    // You can't fall out of an arena you've reached, or climb past the top
    const floorAt = arenaFor(t).min;
    let floor = false;
    if (t + delta < floorAt) { delta = floorAt - t; floor = true; }
    if (t + delta > MAX_TROPHIES) delta = MAX_TROPHIES - t;
    return { delta, capped, floor };
  }

  // ── Milestones ──
  // Built once from the arena list: each arena gate unlocks the arena and hands out its first new
  // card; five more stops inside every arena give the rest of its cards, gold, chests and emotes.
  function buildMilestones() {
    const out = [];
    const add = (trophies, rewards) => out.push({ id: `tr-${trophies}`, trophies, rewards });
    ARENAS.forEach((arena, i) => {
      const next = ARENAS[i + 1];
      const cards = (NEW_CARDS[arena.id] || []).slice();
      const gold = 100 + arena.id * 60;
      const chestTier = clamp(1 + Math.floor(arena.id / 2), 1, 5);
      if (arena.id > 0) {
        const gate = [{ type: 'arena', arena: arena.id }];
        if (cards.length) gate.push({ type: 'card', id: cards.shift() });
        gate.push({ type: 'gold', amount: gold * 2 });
        if (ROAD_EMOTES[arena.id] && arena.id === 9) gate.push({ type: 'emote', id: ROAD_EMOTES[arena.id] });
        add(arena.min, gate);
      }
      const end = next ? next.min : MAX_TROPHIES;
      const stops = next ? 5 : 8;
      const plan = [];
      // Interleave the arena's remaining cards with gold, chests, card copies and its emote
      const fillers = [
        { type: 'gold', amount: gold },
        { type: 'chest', tier: chestTier },
        { type: 'copies', amount: 6 + arena.id * 2 },
        { type: 'gold', amount: Math.round(gold * 1.5) },
        { type: 'chest', tier: clamp(chestTier + 1, 1, 5) },
      ];
      for (let k = 0; k < stops; k++) {
        if (k % 2 === 0 && cards.length) plan.push({ type: 'card', id: cards.shift() });
        else plan.push(fillers[k % fillers.length]);
      }
      while (cards.length) plan[plan.length - 1 - cards.length] = { type: 'card', id: cards.shift() };
      if (ROAD_EMOTES[arena.id] && arena.id !== 9) {
        // The emote replaces a gold/chest stop, never a card
        const slot = [3, 1, 2, 4, 0].find((k) => plan[k] && plan[k].type !== 'card');
        plan[slot] = { type: 'emote', id: ROAD_EMOTES[arena.id] };
      }
      plan.forEach((reward, k) => {
        // Round to tens so the road reads nicely
        const at = Math.round((arena.min + ((end - arena.min) * (k + 1)) / (stops + 1)) / 10) * 10;
        add(at, [reward]);
      });
    });
    EVO_STOPS.forEach(([at, reward]) => add(at, [reward]));
    out.sort((a, b) => a.trophies - b.trophies);
    return out;
  }

  const MILESTONES = buildMilestones();
  const MILESTONE_MAP = Object.fromEntries(MILESTONES.map((m) => [m.id, m]));

  // ── Saved state ──

  function freshRoad() {
    return { trophies: 0, best: 0, claimed: {}, recent: [], pending: null, theme: null, seenArena: 0, seenNews: 0 };
  }

  // Clean up whatever was loaded from storage (old saves, hand edits, junk)
  function normalize(raw) {
    const r = freshRoad();
    if (!raw || typeof raw !== 'object') return r;
    r.trophies = clamp(Math.floor(Number(raw.trophies) || 0), 0, MAX_TROPHIES);
    r.best = clamp(Math.floor(Number(raw.best) || 0), r.trophies, MAX_TROPHIES);
    if (raw.claimed && typeof raw.claimed === 'object') {
      Object.keys(raw.claimed).forEach((id) => {
        const m = MILESTONE_MAP[id];
        // Only milestones you have actually reached can be marked claimed
        if (m && m.trophies <= r.best) r.claimed[id] = Number(raw.claimed[id]) || 1;
      });
    }
    if (Array.isArray(raw.recent)) r.recent = raw.recent.filter((x) => typeof x === 'string').slice(-40);
    if (raw.pending && typeof raw.pending === 'object' && typeof raw.pending.id === 'string') {
      r.pending = { id: raw.pending.id, mode: raw.pending.mode === 'online' ? 'online' : 'ai', difficulty: AI_RULES[raw.pending.difficulty] ? raw.pending.difficulty : 'normal', at: Number(raw.pending.at) || 0 };
    }
    r.theme = typeof raw.theme === 'string' && ARENAS.some((a) => a.theme === raw.theme) ? raw.theme : null;
    r.seenArena = clamp(Math.floor(Number(raw.seenArena) || 0), 0, ARENAS.length - 1);
    r.seenNews = raw.seenNews ? 1 : 0;
    return r;
  }

  /**
   * Apply a finished ranked match. m: { id, result, mode, difficulty, forfeit }.
   * Returns { applied, delta, before, after, arenaUp, arena, capped, floor }.
   * A match id that was already applied changes nothing (applied: false).
   */
  function applyMatch(road, m) {
    const before = road.trophies;
    const none = { applied: false, delta: 0, before, after: before, arenaUp: null, arena: arenaFor(before), capped: false, floor: false };
    if (!m || typeof m.id !== 'string' || !m.id) return none;
    if (road.pending && road.pending.id === m.id) road.pending = null;
    if (road.recent.includes(m.id)) return none;
    road.recent.push(m.id);
    if (road.recent.length > 40) road.recent.shift();
    const change = trophyChange(before, m);
    road.trophies = clamp(before + change.delta, 0, MAX_TROPHIES);
    road.best = Math.max(road.best, road.trophies);
    const oldArena = arenaFor(before);
    const newArena = arenaFor(road.trophies);
    return {
      applied: true,
      delta: road.trophies - before,
      before,
      after: road.trophies,
      arenaUp: newArena.id > oldArena.id ? newArena : null,
      arena: newArena,
      capped: change.capped,
      floor: change.floor,
    };
  }

  // Remember a ranked match in progress: if the page closes before it ends, it counts as a loss
  function beginRanked(road, id, mode, difficulty) {
    road.pending = { id, mode, difficulty: difficulty || 'normal', at: Date.now() };
  }

  function cancelPending(road, id) {
    if (road.pending && (!id || road.pending.id === id)) road.pending = null;
  }

  // Settle an abandoned ranked match as a loss (once). Returns the applyMatch result or null.
  function resolvePending(road) {
    const p = road.pending;
    if (!p) return null;
    road.pending = null;
    return applyMatch(road, { id: p.id, result: 'loss', mode: p.mode, difficulty: p.difficulty, forfeit: true });
  }

  function isClaimed(road, id) { return !!road.claimed[id]; }

  // Milestones reached (by best-ever trophies, so a loss never takes a reward away) and not yet claimed
  function claimable(road) {
    return MILESTONES.filter((m) => m.trophies <= road.best && !road.claimed[m.id]);
  }

  /** Mark a milestone claimed. Returns its rewards, or null if it isn't reached or was already claimed. */
  function claim(road, id) {
    const m = MILESTONE_MAP[id];
    if (!m || m.trophies > road.best || road.claimed[id]) return null;
    road.claimed[id] = Date.now();
    return m.rewards;
  }

  // Themes you may pick for the battlefield: every arena you have reached
  function unlockedThemes(road) {
    return ARENAS.filter((a) => a.min <= road.best).map((a) => a.theme);
  }

  function activeTheme(road) {
    const open = unlockedThemes(road);
    return road.theme && open.includes(road.theme) ? road.theme : arenaFor(road.trophies).theme;
  }

  // The highest arena whose cards may drop in chests and rewards
  function cardArena(road) {
    return arenaFor(road.best).id;
  }

  return {
    MAX_TROPHIES, ARENAS, NEW_CARDS, ROAD_EMOTES, EVO_STOPS, AI_RULES, ONLINE_WIN, LOSS_BY_ARENA, MILESTONES, MILESTONE_MAP,
    arenaFor, nextArena, rankOf, lossFor, trophyChange,
    freshRoad, normalize, applyMatch, beginRanked, cancelPending, resolvePending,
    isClaimed, claimable, claim, unlockedThemes, activeTheme, cardArena,
  };
});
