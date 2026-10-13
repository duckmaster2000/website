const PROTOTYPE_PASSWORD = 'test';
const ADMIN_PASSWORD = '2ydzpU2y!';
const PROTOTYPE_KEY = 'prototype_access_v1';
const PROGRESS_KEY = 'prototype_progress_v4';

const SERVER_URL =
  location.hostname === 'caleb-liu.com' || location.hostname === 'www.caleb-liu.com'
    ? 'https://clash-tanks-server.onrender.com'
    : 'http://localhost:3001';

let socket = null;
let mySide = null;
let onlineActive = false;
let inQueue = false;
let lastMatchWasOnline = false;
let onlineDeckIds = [];

// Online smoothing: the server sends ~20 snapshots/sec. We draw slightly in the
// past and blend between the two snapshots around that moment so units glide.
const NET_INTERP_DELAY = 0.1; // seconds
let netSnapshots = [];
let netClockOffset = null; // client clock (s) minus server match time
let netFx = [];            // server effects waiting for the delayed picture to reach them
let arena = null;          // canvas renderer (prototype_arena.js)

// Cards, arena rules and the match simulation are shared with the server (clash-sim.js)
const Sim = window.ClashSim;
const CARD_LIBRARY = Sim.CARD_LIBRARY;
const CARD_MAP = Sim.CARD_MAP;
const STARTER_DECK = Sim.STARTER_DECK;
const MAX_DECK = Sim.MAX_DECK;
const RARITY_ORDER = Sim.RARITY_ORDER;
const STEP = Sim.MATCH.step;

const RARITY_STYLE = {
  common: { label: 'Common', color: '#88c7ff', copies: 1, gold: 55 },
  rare: { label: 'Rare', color: '#63ffd2', copies: 2, gold: 85 },
  epic: { label: 'Epic', color: '#ffb36c', copies: 3, gold: 130 },
  legendary: { label: 'Legendary', color: '#ffd35f', copies: 5, gold: 210 },
  champion: { label: 'Champion', color: '#ff728f', copies: 7, gold: 300 }
};

const SPELL_IDS = ['firebomb', 'shock', 'rocketrain'];
// Default AI deck (used until you customise it): a real deck with spells, so the AI can use them
const AI_DEFAULT_DECK = ['brawler', 'siege', 'ramhog', 'voltbug', 'drillcat', 'flarepod', 'firebomb', 'shock'];

// Achievements: stats → gold, and some unlock emotes. progress(s) returns [current, goal].
const ACHIEVEMENTS = [
  { id: 'first_win', icon: '🏆', name: 'First Victory', desc: 'Win a match', gold: 100, emote: 'celebrate', progress: (s) => [s.wins, 1] },
  { id: 'tower_breaker', icon: '🏰', name: 'Tower Breaker', desc: 'Destroy 10 enemy towers', gold: 150, emote: 'cool', progress: (s) => [s.towers, 10] },
  { id: 'three_crown', icon: '👑', name: 'Three-Crown Win', desc: 'Destroy the enemy King Tower', gold: 200, emote: 'king', progress: (s) => [s.threeCrowns, 1] },
  { id: 'veteran', icon: '🎖️', name: 'Veteran', desc: 'Play 10 matches', gold: 150, emote: 'facepalm', progress: (s) => [s.matches, 10] },
  { id: 'giant_slayer', icon: '🗡️', name: 'Giant Slayer', desc: 'Beat the AI on Hard or Insane', gold: 300, progress: (s) => [s.hardWins, 1] },
  { id: 'online_champ', icon: '🌐', name: 'Online Champion', desc: 'Win an online match', gold: 250, progress: (s) => [s.onlineWins, 1] },
  { id: 'spell_slinger', icon: '☄️', name: 'Spell Slinger', desc: 'Cast 25 spells', gold: 120, progress: (s) => [s.spells, 25] },
  { id: 'commander', icon: '🃏', name: 'Commander', desc: 'Play 200 cards', gold: 150, progress: (s) => [s.cards, 200] },
];

function freshStats() {
  return { matches: 0, wins: 0, losses: 0, draws: 0, towers: 0, threeCrowns: 0, hardWins: 0, onlineWins: 0, spells: 0, cards: 0, emotes: 0 };
}

const AI_PRESETS = {
  easy: {
    baseMult: 0.85,
    towerMult: 0.85,
    thinkMin: 0.85,
    thinkMax: 1.15,
    strategicChance: 0.42,
    aggression: 0.15,
    leakAt: 9.9,
    description: 'Easy: slow reactions, rarely attacks, weaker towers.'
  },
  normal: {
    baseMult: 1,
    towerMult: 1,
    thinkMin: 0.48,
    thinkMax: 0.58,
    strategicChance: 0.7,
    aggression: 0.35,
    leakAt: 9.3,
    description: 'Normal: defends threats, builds tank-and-support pushes.'
  },
  hard: {
    baseMult: 1.2,
    towerMult: 1.18,
    thinkMin: 0.33,
    thinkMax: 0.46,
    strategicChance: 0.84,
    aggression: 0.5,
    leakAt: 9.0,
    description: 'Hard: quick reactions, smarter counters, tougher towers.'
  },
  insane: {
    baseMult: 1.45,
    towerMult: 1.4,
    thinkMin: 0.22,
    thinkMax: 0.33,
    strategicChance: 0.92,
    aggression: 0.65,
    leakAt: 8.6,
    description: 'Insane: near-instant counters, constant pressure, high tower HP.'
  },
  custom: {
    baseMult: 1,
    towerMult: 1,
    thinkMin: 0.46,
    thinkMax: 0.62,
    strategicChance: 0.72,
    aggression: 0.35,
    leakAt: 9.3,
    description: 'Custom: uses your manual HP multipliers.'
  }
};

const state = {
  running: false,
  mode: 'pvp',
  lastTick: 0,
  selectedCard: null,   // { owner, type } card picked from a hand
  winner: null,
  match: null,          // local ClashSim match (local PvP and vs AI)
  ai: null,             // AI brain in vs-AI mode
  acc: 0,               // fixed-timestep accumulator
  snapPrev: null,       // previous / current simulation snapshots (rendering blends them)
  snapCur: null,
  view: null,           // what the arena draws this frame
  viewSource: 'local',  // 'local' or 'online'
  goldPool: 0,
  damageSeen: 0,
  chestOpening: false,
  chestSession: null,
  admin: {
    active: false,
    backupProgress: null
  },
  progress: {
    gold: 800,
    deck: [...STARTER_DECK],
    aiDeck: [...STARTER_DECK],
    collection: {},
    chests: [],
    buildings: { towerLevel: 1, baseLevel: 1 },
    aiHealth: { baseMult: 1, towerMult: 1 },
    aiDifficulty: 'normal',
    stats: freshStats(),
    achievements: {},
    emoteMuted: false,
    seenSpellNews: false
  }
};

const ui = {
  lockPanel: null, content: null, password: null, unlock: null, error: null,
  board: null, arena: null, sound: null,
  deckA: null, deckB: null, mode: null, start: null, resetUpgrades: null, log: null,
  status: {
    A: { name: null, base: null, tower: null, energy: null, gold: null },
    B: { name: null, base: null, tower: null, energy: null, gold: null }
  },
  baseBars: { A: null, B: null },
  energyBars: { A: null, B: null },
  lobbyPanel: null, createRoom: null, joinCode: null, joinRoom: null, roomCodeDisplay: null,
  shareBox: null, shareLink: null, copyLink: null, lobbyStatus: null,
  goldAmount: null, chestStatus: null, earnChest: null, openChest: null,
  deckSlots: null, aiDeckSlots: null, cardCollection: null, cardSearch: null,
  towerLevel: null, baseLevel: null, upgradeTower: null, upgradeBase: null,
  towerUpgradeInfo: null, baseUpgradeInfo: null,
  aiBaseMult: null, aiTowerMult: null, aiBaseMultOut: null, aiTowerMultOut: null, aiHealthInfo: null,
  aiDifficulty: null, aiDifficultyInfo: null,
  adminToggle: null, adminPanel: null, adminState: null,
  adminUnlockRow: null, adminPassword: null, adminUnlock: null, adminError: null, adminExit: null,
  chestOverlay: null, chestPhase: null, chestTier: null, chestVisual: null, chestRolls: null, chestReward: null, chestClaim: null,
  chestParticles: null,
  chestStars: null,
  winOverlay: null, winHeadline: null, winSubline: null, winCardSlot: null, winCardReveal: null, winCardLabel: null, winClaim: null, winRematch: null,
  findMatch: null, cancelQueue: null, queueStatus: null,
  winCrowns: null, winStats: null, winAch: null, confetti: null, toasts: null, achList: null, achCount: null,
  emoteBtnA: null, emoteBtnB: null, emotePanel: null, emoteGrid: null, emoteHint: null, emoteMute: null
};

let matchToken = 0;        // bumps every new match so stale timers (result screens) don't fire
let lastTickSecond = null; // final-seconds countdown ticks

function $(id) { return document.getElementById(id); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function enemyOf(owner) { return owner === 'A' ? 'B' : 'A'; }
function costClass(c) { return c <= 2 ? 'cost-low' : c <= 4 ? 'cost-mid' : c <= 6 ? 'cost-high' : 'cost-max'; }

function cardProgress(id) {
  if (!state.progress.collection[id]) {
    state.progress.collection[id] = { unlocked: false, level: 1, copies: 0, mastery: 0, abilityUnlocked: false };
  }
  return state.progress.collection[id];
}

function unlockInitial() {
  CARD_LIBRARY.forEach((c) => cardProgress(c.id));
  // Starter copies are a one-time gift when the card is first unlocked, not on every page load
  STARTER_DECK.forEach((id) => {
    const p = cardProgress(id);
    if (p.unlocked) return;
    p.unlocked = true;
    p.copies += 3;
  });
  // Everyone gets the basic defensive building so that role is available from the start
  const turret = cardProgress('boltturret');
  if (!turret.unlocked) { turret.unlocked = true; turret.copies += 1; }
  // ...and the spells
  SPELL_IDS.forEach((id) => {
    const cp = cardProgress(id);
    if (!cp.unlocked) { cp.unlocked = true; cp.copies += 1; }
  });
}

function saveProgress() {
  if (state.admin.active) return;
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(state.progress)); } catch (_) {}
}

function cloneProgress(progress) {
  try {
    return JSON.parse(JSON.stringify(progress));
  } catch (_) {
    return null;
  }
}

function applyAdminProgressSnapshot() {
  CARD_LIBRARY.forEach((c) => {
    const cp = cardProgress(c.id);
    cp.unlocked = true;
    cp.level = 14;
    cp.copies = 999;
    cp.mastery = 999;
    cp.abilityUnlocked = true;
  });
  state.progress.gold = 9999999;
  state.progress.buildings.baseLevel = 20;
  state.progress.buildings.towerLevel = 20;
  state.progress.aiHealth.baseMult = 2.2;
  state.progress.aiHealth.towerMult = 2.2;
  state.progress.aiDifficulty = 'custom';
  state.progress.deck = CARD_LIBRARY.slice(0, MAX_DECK).map((c) => c.id);
  state.progress.aiDeck = CARD_LIBRARY.slice(-MAX_DECK).map((c) => c.id);
}

function updateAdminUi() {
  if (!ui.adminPanel) return;
  ui.adminPanel.classList.toggle('active', state.admin.active);
  if (ui.adminState) ui.adminState.textContent = state.admin.active ? 'Active' : 'Inactive';
  if (ui.adminUnlockRow) ui.adminUnlockRow.hidden = state.admin.active;
  if (ui.adminExit) ui.adminExit.hidden = !state.admin.active;
  if (ui.adminError) ui.adminError.hidden = true;
}

function enableAdminMode() {
  if (state.admin.active) return;
  const backup = cloneProgress(state.progress);
  if (!backup) {
    writeLog('Admin mode failed to initialize.');
    return;
  }
  state.admin.backupProgress = backup;
  state.admin.active = true;
  applyAdminProgressSnapshot();
  renderProgress();
  renderCollection();
  setupMatch();
  updateAdminUi();
  writeLog('Admin mode enabled: temporary max progression applied.');
}

function disableAdminMode() {
  if (!state.admin.active) return;
  if (state.admin.backupProgress) {
    state.progress = cloneProgress(state.admin.backupProgress) || state.progress;
  }
  state.admin.backupProgress = null;
  state.admin.active = false;
  saveProgress();
  renderProgress();
  renderCollection();
  setupMatch();
  updateAdminUi();
  writeLog('Admin mode disabled: normal progression restored.');
}

function bindAdminUi() {
  ui.adminToggle?.addEventListener('click', () => {
    if (ui.adminPanel && !ui.adminPanel.hidden && state.admin.active) {
      disableAdminMode();
    }
    if (ui.adminPanel) ui.adminPanel.hidden = !ui.adminPanel.hidden;
    updateAdminUi();
  });

  const tryAdminUnlock = () => {
    const value = String(ui.adminPassword?.value || '');
    if (value !== ADMIN_PASSWORD) {
      if (ui.adminError) ui.adminError.hidden = false;
      return;
    }
    if (ui.adminError) ui.adminError.hidden = true;
    if (ui.adminPassword) ui.adminPassword.value = '';
    enableAdminMode();
  };

  ui.adminUnlock?.addEventListener('click', tryAdminUnlock);
  ui.adminPassword?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryAdminUnlock();
  });

  ui.adminExit?.addEventListener('click', () => {
    disableAdminMode();
    if (ui.adminPanel) ui.adminPanel.hidden = true;
  });
}

function applySavedProgress(saved) {
  if (saved && typeof saved === 'object') {
    state.progress.gold = clamp(Number(saved.gold || 800), 0, 9999999);
    state.progress.deck = Array.isArray(saved.deck) ? saved.deck.slice(0, MAX_DECK) : [...STARTER_DECK];
    state.progress.aiDeck = Array.isArray(saved.aiDeck) ? saved.aiDeck.slice(0, MAX_DECK) : [...STARTER_DECK];
    state.progress.collection = saved.collection && typeof saved.collection === 'object' ? saved.collection : {};
    state.progress.chests = Array.isArray(saved.chests) ? saved.chests.slice(0, 4) : [];
    state.progress.buildings = {
      towerLevel: clamp(Number(saved.buildings?.towerLevel || 1), 1, 20),
      baseLevel: clamp(Number(saved.buildings?.baseLevel || 1), 1, 20)
    };
    state.progress.aiHealth = {
      baseMult: clamp(Number(saved.aiHealth?.baseMult || 1), 0.6, 2.2),
      towerMult: clamp(Number(saved.aiHealth?.towerMult || 1), 0.6, 2.2)
    };
    state.progress.aiDifficulty = Object.prototype.hasOwnProperty.call(AI_PRESETS, saved.aiDifficulty)
      ? saved.aiDifficulty
      : 'normal';
    state.progress.stats = Object.assign(freshStats(), saved.stats && typeof saved.stats === 'object' ? saved.stats : {});
    state.progress.achievements = saved.achievements && typeof saved.achievements === 'object' ? saved.achievements : {};
    state.progress.emoteMuted = !!saved.emoteMuted;
    state.progress.seenSpellNews = !!saved.seenSpellNews;
  }
}

function loadProgress() {
  try {
    applySavedProgress(JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'));
  } catch (_) {}
  unlockInitial();
  const aiDeck = state.progress.aiDeck;
  // An AI deck that was never customised gets the newer default (which includes spells)
  if (!Array.isArray(aiDeck) || aiDeck.length === 0 || aiDeck.join() === STARTER_DECK.join()) {
    state.progress.aiDeck = [...AI_DEFAULT_DECK];
  }
  saveProgress();
}

function getCardStats(id) {
  const card = CARD_MAP[id];
  if (!card) return null;
  const p = cardProgress(id);
  return getCardStatsAtLevel(id, clamp(p.level || 1, 1, 14), p.abilityUnlocked, p.mastery || 0);
}

function getAiProfile() {
  const key = state.progress.aiDifficulty || 'normal';
  return AI_PRESETS[key] || AI_PRESETS.normal;
}

function applyAiDifficultyPreset(level) {
  const key = Object.prototype.hasOwnProperty.call(AI_PRESETS, level) ? level : 'normal';
  const profile = AI_PRESETS[key];
  state.progress.aiDifficulty = key;
  if (key !== 'custom') {
    state.progress.aiHealth.baseMult = clamp(profile.baseMult, 0.6, 2.2);
    state.progress.aiHealth.towerMult = clamp(profile.towerMult, 0.6, 2.2);
  }
  saveProgress();
  renderProgress();
}

function getCardStatsAtLevel(id, level, abilityUnlocked, mastery) {
  return Sim.getCardStatsAtLevel(id, level, abilityUnlocked, mastery);
}

function deckFor(owner) {
  if (onlineActive) return onlineDeckIds;
  if (owner === 'A') return state.progress.deck.filter((id) => CARD_MAP[id] && cardProgress(id).unlocked).slice(0, MAX_DECK);
  if (state.mode === 'ai') {
    const ai = state.progress.aiDeck.filter((id) => CARD_MAP[id] && cardProgress(id).unlocked).slice(0, MAX_DECK);
    if (ai.length > 0) return ai;
    const unlocked = CARD_LIBRARY.filter((c) => cardProgress(c.id).unlocked);
    return unlocked.sort((a, b) => a.cost - b.cost).slice(0, MAX_DECK).map((c) => c.id);
  }
  return state.progress.deck.filter((id) => CARD_MAP[id]).slice(0, MAX_DECK);
}

// Deck entries carry your card levels into the match
function deckEntries(ids) {
  return ids.map((id) => {
    const cp = cardProgress(id);
    return { id, level: cp.level || 1, abilityUnlocked: !!cp.abilityUnlocked, mastery: cp.mastery || 0 };
  });
}

function aiProfile() {
  const p = getAiProfile();
  return { thinkMin: p.thinkMin, thinkMax: p.thinkMax, strategicChance: p.strategicChance, aggression: p.aggression, leakAt: p.leakAt };
}

function playerName(side) {
  if (onlineActive || state.viewSource === 'online') return side === mySide ? 'You' : 'Opponent';
  if (side === 'B') return state.mode === 'ai' ? 'Enemy AI' : 'Commander B';
  return 'Commander A';
}

// Which side's info goes in the top / bottom nameplate and deck (online: you're always at the bottom)
function sideAt(position) {
  const bottom = state.viewSource === 'online' && mySide ? mySide : 'A';
  return position === 'bottom' ? bottom : enemyOf(bottom);
}

function setupMatch() {
  state.mode = ui.mode?.value || 'pvp';
  leaveQueue();
  lastMatchWasOnline = false;
  const b = state.progress.buildings;
  const vsAi = state.mode === 'ai';
  const mine = { towerLevel: b.towerLevel, kingLevel: b.baseLevel };
  const theirs = vsAi
    ? { ...mine, towerMult: state.progress.aiHealth.towerMult, kingMult: state.progress.aiHealth.baseMult }
    : mine;
  state.match = Sim.createMatch({
    seed: Math.floor(Math.random() * 2147483647),
    decks: { A: deckEntries(deckFor('A')), B: deckEntries(deckFor('B')) },
    towers: { A: mine, B: theirs },
  });
  state.ai = vsAi ? Sim.createAi('B', aiProfile()) : null;
  state.viewSource = 'local';
  state.running = true;
  state.winner = null;
  state.selectedCard = null;
  state.acc = 0;
  state.damageSeen = 0;
  state.goldPool = 0;
  state.snapPrev = Sim.snapshot(state.match);
  state.snapCur = state.snapPrev;
  state.view = state.snapCur;
  beginMatchPresentation();
  renderDecks();
  renderStatus();
}

// Fresh arena, names for announcements, and the "BATTLE!" banner
function beginMatchPresentation() {
  matchToken++;
  closeEmotePanel();
  lastTickSecond = null;
  if (ui.winOverlay) ui.winOverlay.hidden = true;
  if (!arena) return;
  arena.reset();
  arena.setNames({ A: playerName('A'), B: playerName('B') });
  arena.announce('BATTLE!', { sub: state.viewSource === 'online' ? 'Destroy the enemy King Tower' : null, color: '#ffe680', dur: 1400, urgent: true });
  Sound.play('start');
}

// Gold trickles in from damage you deal in local modes (same idea as before the arena rework)
function rewardDamage() {
  const dealt = state.match.players.A.damageDealt;
  state.goldPool += (dealt - state.damageSeen) * 0.014;
  state.damageSeen = dealt;
  if (state.goldPool >= 1) {
    const whole = Math.floor(state.goldPool);
    state.progress.gold += whole;
    state.goldPool -= whole;
  }
}

// Fixed-timestep simulation; rendering blends the last two steps so motion stays smooth
function stepLocalMatch(dt) {
  const m = state.match;
  if (!m || !state.running) return;
  state.acc = Math.min(state.acc + dt, 0.25);
  while (state.acc >= STEP) {
    state.acc -= STEP;
    if (state.ai) Sim.aiUpdate(m, state.ai, STEP);
    Sim.step(m);
    handleFx(Sim.takeFx(m));
    rewardDamage();
    state.snapPrev = state.snapCur;
    state.snapCur = Sim.snapshot(m);
    if (!m.running) {
      state.acc = 0;
      onVictory(m.winner);
      // The AI gets its last word (a good-game emote) in after the final whistle
      if (state.ai) { Sim.aiUpdate(m, state.ai, 0); handleFx(Sim.takeFx(m)); }
      break;
    }
  }
}

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function lerpSnap(a, b, t) {
  if (!a || !b || a === b) return b;
  const k = clamp(t, 0, 1);
  const lerp = (x, y) => x + (y - x) * k;
  const prevUnits = new Map(a.units.map((u) => [u.id, u]));
  const prevShots = new Map(a.projectiles.map((p) => [p.id, p]));
  return {
    ...b,
    units: b.units.map((u) => {
      const p = prevUnits.get(u.id);
      return p ? { ...u, x: lerp(p.x, u.x), y: lerp(p.y, u.y), face: angleLerp(p.face, u.face, k) } : u;
    }),
    projectiles: b.projectiles.map((pr) => {
      const p = prevShots.get(pr.id);
      return p ? { ...pr, x: lerp(p.x, pr.x), y: lerp(p.y, pr.y), lob: pr.lob == null ? null : lerp(p.lob ?? pr.lob, pr.lob) } : pr;
    }),
  };
}

function awardChest() {
  if (state.progress.chests.length >= 4) return;
  const t = ['wood', 'silver', 'golden'][Math.floor(Math.random() * 3)];
  const ms = t === 'wood' ? 0 : t === 'silver' ? 30000 : 80000;
  state.progress.chests.push({ id: `ch-${Date.now()}-${Math.random()}`, type: t, readyAt: Date.now() + ms });
}

function awardWinCard() {
  const locked = CARD_LIBRARY.filter((c) => !cardProgress(c.id).unlocked);
  const unlocked = CARD_LIBRARY.filter((c) => cardProgress(c.id).unlocked);

  // 25% chance to unlock a brand-new card
  if (locked.length > 0 && Math.random() < 0.25) {
    const pick = locked[Math.floor(Math.random() * locked.length)];
    const cp = cardProgress(pick.id);
    cp.unlocked = true;
    cp.copies += 1;
    return { card: pick, isUnlock: true, copies: 1 };
  }

  // Otherwise add copies to a random unlocked card
  const pool = unlocked.length > 0 ? unlocked : locked;
  if (pool.length === 0) return null;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const cp = cardProgress(pick.id);
  if (!cp.unlocked) { cp.unlocked = true; }
  const copies = Math.max(1, RARITY_STYLE[pick.rarity].copies || 1);
  cp.copies += copies;
  return { card: pick, isUnlock: false, copies };
}

// result: 'win' | 'loss' | 'draw'. extra: { headline, detail }
function showWinOverlay(result, cardAward, goldBonus, isOnline, extra) {
  if (!ui.winOverlay) return;
  const won = result === 'win';
  const x = extra || {};
  if (ui.winHeadline) ui.winHeadline.textContent = x.headline || (won ? 'VICTORY!' : result === 'draw' ? 'DRAW' : 'DEFEAT');
  ui.winOverlay.classList.toggle('is-loss', result === 'loss');
  ui.winOverlay.classList.toggle('is-draw', result === 'draw');
  if (ui.winSubline) ui.winSubline.textContent = [x.detail, goldBonus ? `+${goldBonus} gold` : ''].filter(Boolean).join(' · ');

  if (won && cardAward) {
    const { card, isUnlock, copies } = cardAward;
    const rarityColor = RARITY_STYLE[card.rarity]?.color || '#8effd2';
    if (ui.winCardSlot) {
      ui.winCardSlot.hidden = false;
      ui.winCardSlot.style.setProperty('--rarity-color', rarityColor);
    }
    if (ui.winCardReveal) ui.winCardReveal.innerHTML = `<span class="win-card-icon">${card.icon}</span>`;
    if (ui.winCardLabel) {
      ui.winCardLabel.textContent = isUnlock
        ? `✨ NEW: ${card.name} unlocked!`
        : `+${copies} ${card.name} ${copies === 1 ? 'copy' : 'copies'}`;
      ui.winCardLabel.style.color = rarityColor;
    }
  } else {
    if (ui.winCardSlot) ui.winCardSlot.hidden = true;
    if (ui.winCardLabel) ui.winCardLabel.textContent = '';
  }

  if (ui.winRematch) {
    ui.winRematch.hidden = !isOnline;
    ui.winRematch.disabled = false;
    ui.winRematch.textContent = 'Rematch';
  }
  if (ui.winClaim) ui.winClaim.textContent = isOnline ? 'Continue' : 'Play Again';
  if (ui.winCrowns) {
    const n = clamp(x.crowns || 0, 0, 3);
    ui.winCrowns.innerHTML = [0, 1, 2].map((i) => `<span class="win-crown${i < n ? ' lit' : ''}" style="--i:${i}">👑</span>`).join('');
  }
  if (ui.winStats) {
    ui.winStats.innerHTML = (x.stats || []).map(([label, value]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('');
  }
  if (ui.winAch) {
    ui.winAch.innerHTML = (x.achievements || []).map((a) => `<div class="win-ach-row"><span>${a.icon}</span><b>${a.name}</b><em>+${a.gold} gold${a.emote ? ' · new emote!' : ''}</em></div>`).join('');
  }
  if (ui.confetti) {
    ui.confetti.innerHTML = won ? confettiHtml(46) : '';
  }
  ui.winOverlay.hidden = false;
}

function confettiHtml(n) {
  const colors = ['#ff4d6d', '#4dc3ff', '#ffe14d', '#7dff8a', '#c38bff', '#ffb347'];
  let html = '';
  for (let i = 0; i < n; i++) {
    const left = Math.random() * 100;
    const delay = Math.random() * 0.6;
    const dur = 1.6 + Math.random() * 1.4;
    const rot = Math.round(Math.random() * 720 - 360);
    html += `<i style="left:${left.toFixed(1)}%;background:${colors[i % colors.length]};animation-delay:${delay.toFixed(2)}s;animation-duration:${dur.toFixed(2)}s;--rot:${rot}deg"></i>`;
  }
  return html;
}

// Short pause on the arena (banner, explosions, last emotes) before the results sheet
function presentResult(result, headline, showOverlay) {
  const token = matchToken;
  closeEmotePanel();
  if (arena) {
    const color = result === 'win' ? '#8effd2' : result === 'draw' ? '#ffe680' : '#ff7070';
    arena.announce(headline, { color, big: true, dur: 2200, urgent: true });
  }
  setTimeout(() => { if (token === matchToken) showOverlay(); }, 1900);
}

function closeWinOverlay() {
  if (ui.winOverlay) ui.winOverlay.hidden = true;
  if (ui.confetti) ui.confetti.innerHTML = '';
  if (lastMatchWasOnline) {
    if (ui.lobbyPanel) ui.lobbyPanel.hidden = false;
    if (ui.lobbyStatus) ui.lobbyStatus.textContent = 'Ready. Create or join a room.';
  }
  saveProgress();
  renderProgress();
  renderCollection();
}

function crownLine(view) {
  if (!view) return '';
  return `👑 ${view.players.A.crowns} – ${view.players.B.crowns}`;
}

function endReasonText(reason) {
  return { king: 'King tower destroyed', crowns: 'More crowns at full time', overtime: 'Overtime crown', tiebreak: 'Tiebreaker: healthier towers' }[reason] || '';
}

function onVictory(winner) {
  if (state.winner) return;
  state.winner = winner;
  state.running = false;
  state.selectedCard = null;
  let cardAward = null;
  let goldBonus = 0;
  const reason = endReasonText(state.match?.endReason);
  if (winner === 'A') {
    goldBonus = 140;
    state.progress.gold += goldBonus;
    awardChest();
    deckFor('A').forEach((id) => { cardProgress(id).mastery += 1; });
    cardAward = awardWinCard();
    const cardMsg = cardAward
      ? (cardAward.isUnlock ? ` Unlocked ${cardAward.card.name}!` : ` +${cardAward.copies} ${cardAward.card.name}.`)
      : '';
    writeLog(`${playerName('A')} wins! ${reason}. +${goldBonus} gold, chest earned.${cardMsg}`);
  } else if (winner === 'draw') {
    writeLog(`Draw. ${reason}. Press Start Match to play again.`);
  } else {
    writeLog(`${playerName('B')} wins. ${reason}. Press Start Match to rematch.`);
  }
  const result = winner === 'draw' ? 'draw' : winner === 'A' ? 'win' : 'loss';
  const snap = state.snapCur;
  const me = snap && snap.players.A;
  const newAch = recordMatch({
    result,
    crowns: me ? me.crowns : 0,
    kingKill: winner === 'A' && state.match?.endReason === 'king',
    hardAi: state.mode === 'ai' && ['hard', 'insane'].includes(state.progress.aiDifficulty),
    online: false,
  });
  saveProgress();
  renderProgress();
  renderCollection();
  Sound.play(winner === 'A' ? 'win' : winner === 'draw' ? 'draw' : 'lose');
  const pvp = state.mode === 'pvp';
  const headline = pvp && winner !== 'draw' ? `${playerName(winner).toUpperCase()} WINS!` : null;
  const banner = headline || (result === 'win' ? 'VICTORY!' : result === 'draw' ? 'DRAW' : 'DEFEAT');
  const crownSide = pvp && winner === 'B' ? 'B' : 'A';
  presentResult(result, banner, () => showWinOverlay(result, cardAward, goldBonus, false, {
    headline,
    detail: `${reason} · ${crownLine(snap)}`,
    crowns: snap ? snap.players[crownSide].crowns : 0,
    stats: matchStats(snap, crownSide),
    achievements: newAch,
  }));
}

function matchStats(snap, side) {
  if (!snap) return [];
  const p = snap.players[side];
  const t = Math.round(snap.time || 0);
  return [
    ['Damage dealt', (p.dmg || 0).toLocaleString()],
    ['Cards played', p.played || 0],
    ['Match time', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`],
  ];
}

// ─── Stats & achievements ───────────────────────────────────────────────────

function recordMatch(r) {
  const st = state.progress.stats;
  st.matches += 1;
  if (r.result === 'win') st.wins += 1;
  else if (r.result === 'loss') st.losses += 1;
  else st.draws += 1;
  st.towers += Math.min(3, r.crowns || 0);
  if (r.kingKill) st.threeCrowns += 1;
  if (r.result === 'win' && r.hardAi) st.hardWins += 1;
  if (r.result === 'win' && r.online) st.onlineWins += 1;
  return checkAchievements();
}

function checkAchievements() {
  const st = state.progress.stats;
  const earned = [];
  ACHIEVEMENTS.forEach((a) => {
    if (state.progress.achievements[a.id]) return;
    const [cur, goal] = a.progress(st);
    if (cur < goal) return;
    state.progress.achievements[a.id] = Date.now();
    state.progress.gold += a.gold;
    earned.push(a);
  });
  earned.forEach((a, i) => setTimeout(() => {
    const em = a.emote && EmoteArt.EMOTES.find((e) => e.id === a.emote);
    toast(a.icon, `Achievement: ${a.name}`, `+${a.gold} gold${em ? ` · Emote unlocked: ${em.name}` : ''}`);
    Sound.play('achievement');
  }, 2300 + i * 900));
  if (earned.length) { buildEmoteGrid(); renderAchievements(); }
  return earned;
}

function renderAchievements() {
  if (!ui.achList) return;
  const st = state.progress.stats;
  const done = ACHIEVEMENTS.filter((a) => state.progress.achievements[a.id]).length;
  if (ui.achCount) ui.achCount.textContent = `${done}/${ACHIEVEMENTS.length}`;
  ui.achList.innerHTML = ACHIEVEMENTS.map((a) => {
    const got = !!state.progress.achievements[a.id];
    const [cur, goal] = a.progress(st);
    const pct = clamp((cur / goal) * 100, 0, 100);
    const em = a.emote && EmoteArt.EMOTES.find((e) => e.id === a.emote);
    return `<li class="${got ? 'done' : ''}"><span class="ach-icon">${a.icon}</span><div class="ach-body"><b>${a.name}</b><small>${a.desc} · ${a.gold}g${em ? ` + “${em.name}” emote` : ''}</small><span class="ach-bar"><i style="width:${pct}%"></i></span></div><span class="ach-state">${got ? '✓' : `${Math.min(cur, goal)}/${goal}`}</span></li>`;
  }).join('');
}

function toast(icon, title, sub) {
  if (!ui.toasts) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="toast-icon">${icon}</span><div><b></b><small></small></div>`;
  el.querySelector('b').textContent = title;
  el.querySelector('small').textContent = sub || '';
  ui.toasts.appendChild(el);
  setTimeout(() => el.classList.add('out'), 3800);
  setTimeout(() => el.remove(), 4300);
}

// ─── Emotes ─────────────────────────────────────────────────────────────────

const emoteUi = { side: null, lastSent: { A: -1e9, B: -1e9 }, raf: 0 };

function emoteUnlocked(id) {
  const meta = EmoteArt.EMOTES.find((e) => e.id === id);
  if (!meta) return false;
  if (meta.starter || state.admin.active) return true;
  const ach = ACHIEVEMENTS.find((a) => a.emote === id);
  return !!(ach && state.progress.achievements[ach.id]);
}

// The side whose emotes are shown as "mine" (muting only hides the other side)
function localSide() {
  return state.viewSource === 'online' ? mySide : 'A';
}

function localPvp() {
  return state.viewSource !== 'online' && state.mode === 'pvp';
}

function emoteHidden(owner) {
  return state.progress.emoteMuted && !localPvp() && owner !== localSide();
}

function canEmote(side) {
  if (!side || !state.view) return false;
  if (state.viewSource === 'online') return side === mySide && !!socket && socket.connected;
  if (!state.match) return false;
  if (state.mode === 'ai') return side === 'A';
  return true;
}

function buildEmoteGrid() {
  if (!ui.emoteGrid) return;
  ui.emoteGrid.innerHTML = EmoteArt.EMOTES.map((e) => {
    const open = emoteUnlocked(e.id);
    const ach = ACHIEVEMENTS.find((a) => a.emote === e.id);
    const tip = open ? e.name : `Locked: earn “${ach ? ach.name : '?'}”`;
    return `<button type="button" class="emote-choice${open ? '' : ' locked'}" data-emote="${e.id}" title="${tip}" aria-label="${tip}"><canvas width="112" height="112"></canvas><span>${open ? e.name : '🔒'}</span></button>`;
  }).join('');
  drawEmoteGrid(0.35);
}

function drawEmoteGrid(t) {
  if (!ui.emoteGrid) return;
  ui.emoteGrid.querySelectorAll('.emote-choice').forEach((b, i) => {
    const c = b.querySelector('canvas');
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    EmoteArt.draw(g, b.dataset.emote, c.width / 2, c.height / 2 + 4, c.width * 0.3, t + i * 0.37);
  });
}

function openEmotePanel(position) {
  const side = sideAt(position);
  if (!ui.emotePanel) return;
  if (!canEmote(side)) { writeLog(state.viewSource === 'online' ? 'Emotes work during online matches.' : 'Start a match to use emotes.'); return; }
  if (emoteUi.side === side && !ui.emotePanel.hidden) { closeEmotePanel(); return; }
  emoteUi.side = side;
  ui.emotePanel.classList.toggle('at-top', position === 'top');
  ui.emotePanel.hidden = false;
  if (ui.emoteHint) ui.emoteHint.textContent = 'Tap an emote to send it';
  updateMuteButton();
  Sound.play('select');
  const start = performance.now();
  const loop = (now) => {
    if (ui.emotePanel.hidden) return;
    drawEmoteGrid((now - start) / 1000);
    emoteUi.raf = requestAnimationFrame(loop);
  };
  cancelAnimationFrame(emoteUi.raf);
  emoteUi.raf = requestAnimationFrame(loop);
}

function closeEmotePanel() {
  if (ui.emotePanel) ui.emotePanel.hidden = true;
  cancelAnimationFrame(emoteUi.raf);
  emoteUi.side = null;
}

function emoteButtonFor(side) {
  return sideAt('bottom') === side ? ui.emoteBtnA : ui.emoteBtnB;
}

function sendEmote(side, id) {
  if (!emoteUnlocked(id)) {
    const ach = ACHIEVEMENTS.find((a) => a.emote === id);
    if (ui.emoteHint) ui.emoteHint.textContent = ach ? `Unlock with “${ach.name}”: ${ach.desc}` : 'Locked';
    Sound.play('reject');
    return;
  }
  const gap = Sim.EMOTE_RULES.minGap * 1000;
  if (performance.now() - emoteUi.lastSent[side] < gap) {
    if (ui.emoteHint) ui.emoteHint.textContent = 'Easy there! Emote recharging…';
    Sound.play('reject');
    return;
  }
  if (state.viewSource === 'online') {
    socket.emit('emote', { id });
  } else {
    const res = Sim.emote(state.match, side, id);
    if (!res.ok) {
      if (ui.emoteHint) ui.emoteHint.textContent = res.reason === 'Too many emotes' ? 'Too many emotes, take a breather' : 'Emote recharging…';
      Sound.play('reject');
      return;
    }
    handleFx(Sim.takeFx(state.match));
  }
  emoteUi.lastSent[side] = performance.now();
  if (side === localSide()) state.progress.stats.emotes += 1;
  const btn = emoteButtonFor(side);
  if (btn) {
    btn.style.setProperty('--cd', `${Sim.EMOTE_RULES.minGap}s`);
    btn.classList.remove('cooling');
    void btn.offsetWidth;
    btn.classList.add('cooling');
  }
  closeEmotePanel();
}

function updateMuteButton() {
  if (!ui.emoteMute) return;
  const muted = !!state.progress.emoteMuted;
  ui.emoteMute.hidden = localPvp();
  ui.emoteMute.textContent = muted ? '🔔 Unmute opponent' : '🔕 Mute opponent';
  ui.emoteMute.setAttribute('aria-pressed', muted ? 'true' : 'false');
}

function syncEmoteButtons() {
  const top = sideAt('top');
  const bottom = sideAt('bottom');
  if (ui.emoteBtnA) ui.emoteBtnA.hidden = !canEmote(bottom);
  if (ui.emoteBtnB) ui.emoteBtnB.hidden = !canEmote(top);
}

function bindEmotes() {
  buildEmoteGrid();
  ui.emoteBtnA?.addEventListener('click', (e) => { e.stopPropagation(); Sound.unlock(); openEmotePanel('bottom'); });
  ui.emoteBtnB?.addEventListener('click', (e) => { e.stopPropagation(); Sound.unlock(); openEmotePanel('top'); });
  ui.emoteGrid?.addEventListener('click', (e) => {
    const b = e.target.closest('.emote-choice');
    if (b && emoteUi.side) sendEmote(emoteUi.side, b.dataset.emote);
  });
  ui.emoteMute?.addEventListener('click', () => {
    state.progress.emoteMuted = !state.progress.emoteMuted;
    saveProgress();
    updateMuteButton();
    writeLog(state.progress.emoteMuted ? 'Opponent emotes muted.' : 'Opponent emotes unmuted.');
  });
  ui.emotePanel?.addEventListener('pointerdown', (e) => e.stopPropagation());
  document.addEventListener('pointerdown', (e) => {
    if (!ui.emotePanel || ui.emotePanel.hidden) return;
    if (e.target.closest('.emote-btn')) return;
    closeEmotePanel();
  });
}

function renderStatus() {
  const v = state.view;
  if (!v) return;
  [['bottom', 'A'], ['top', 'B']].forEach(([position, slot]) => {
    const side = sideAt(position);
    const p = v.players[side];
    const s = ui.status[slot];
    const towers = v.towers.filter((t) => t.owner === side);
    const king = towers.find((t) => t.tower === 'king');
    const princesses = towers.filter((t) => t.tower === 'princess').map((t) => (t.hp > 0 ? '⬡' : '✕'));
    setText(s.name, playerName(side));
    setText(s.base, Math.ceil(king.hp));
    setText(s.tower, `${princesses[0]}♛${princesses[1]}  👑${p.crowns}`);
    // Like the real game, you can't see your online opponent's elixir
    const hidden = state.viewSource === 'online' && side !== mySide;
    setText(s.energy, hidden ? '?' : Math.floor(p.elixir));
    const mine = side === 'A' && state.viewSource !== 'online';
    setText(s.gold, mine ? `💰 ${state.progress.gold}` : (state.mode === 'ai' && state.viewSource !== 'online' && side === 'B' ? 'ENEMY AI' : '—'));
    setStyle(ui.baseBars[slot], 'width', `${clamp((king.hp / king.hpMax) * 100, 0, 100).toFixed(1)}%`);
    setStyle(ui.energyBars[slot], 'width', hidden ? '0%' : `${clamp((p.elixir / Sim.MATCH.maxElixir) * 100, 0, 100).toFixed(1)}%`);
    const track = ui.energyBars[slot] && ui.energyBars[slot].parentElement;
    const full = !hidden && p.elixir >= Sim.MATCH.maxElixir && v.running;
    if (track && track.__full !== full) { track.__full = full; track.classList.toggle('full', full); }
  });
}

function setText(el, value) {
  const text = String(value);
  if (!el || el.__text === text) return;
  el.textContent = text;
  el.__text = text;
}

function setStyle(el, prop, value) {
  if (!el) return;
  const key = `__${prop}`;
  if (el[key] === value) return;
  el.style[prop] = value;
  el[key] = value;
}

function cardButton(owner, id) {
  const card = getCardStats(id);
  const v = state.view;
  if (!card || !v) return '';
  const p = v.players[owner];
  const rem = (p.cooldownsRemaining && p.cooldownsRemaining[id]) || 0;
  const onCd = rem > 0;
  const short = p.elixir < card.cost;
  const disabled = !v.running || onCd;
  const cdPct = onCd ? Math.round((1 - rem / card.deployCdScaled) * 10) * 10 : 100;
  // Quantised so the hand doesn't re-render every frame while elixir fills
  const fill = Math.floor(clamp(p.elixir / card.cost, 0, 1) * 10) * 10;
  const selected = state.selectedCard && state.selectedCard.owner === owner && state.selectedCard.type === id;
  const cp = cardProgress(id);
  const tags = `${card.spell ? ' ✦ Spell' : ''}${card.winCondition ? ' 👑' : ''}${card.air ? ' ✈' : ''}${card.swarmCount > 1 ? ` ×${card.swarmCount}` : ''}`;
  const entering = (handEnter[owner] && handEnter[owner][id] || 0) > performance.now();
  return `<button class="card rarity-${card.rarity}${card.winCondition ? ' wc' : ''}${card.swarmCount > 1 ? ' swarm' : ''}${card.spell ? ' spell' : ''}${entering ? ' card-enter' : ''}" data-owner="${owner}" data-type="${id}" data-disabled="${disabled ? '1' : '0'}" data-short="${short ? '1' : '0'}" data-selected="${selected ? '1' : '0'}" title="${card.name}: ${card.role}"><span class="card-rarity">${RARITY_STYLE[card.rarity].label}${tags}</span><span class="card-icon">${card.icon}</span><span class="card-cost ${costClass(card.cost)}">${card.cost}</span><span class="card-name">${card.name}</span><span class="card-meta">Lv ${cp.level} • ${card.role}</span><span class="card-cd-bar"><i style="width:${cdPct}%"></i></span>${short ? `<span class="card-short" style="transform:scaleX(${fill / 100})"></span>` : ''}</button>`;
}

function deckAvgCost(ids) {
  if (!ids.length) return '0.0';
  return (ids.reduce((s, id) => s + (CARD_MAP[id]?.cost || 0), 0) / ids.length).toFixed(1);
}

function avgElixirBar(ids) {
  const avg = Number(deckAvgCost(ids));
  const pct = Math.min(100, (avg / 9) * 100);
  const cls = avg <= 3 ? 'avg-low' : avg <= 5 ? 'avg-mid' : 'avg-high';
  return `<div class="avg-elixir"><span class="avg-elixir-label">⚡ Avg ${avg.toFixed(1)}</span><span class="avg-elixir-track"><span class="avg-elixir-fill ${cls}" style="width:${pct}%"></span></span></div>`;
}

// Cards that just cycled into the hand slide in (tracked per card for a moment)
const handEnter = { A: {}, B: {} };
const handPrev = { A: null, B: null };

function noteHandChanges(owner, hand) {
  const prev = handPrev[owner];
  if (prev) hand.forEach((id) => { if (!prev.includes(id)) handEnter[owner][id] = performance.now() + 420; });
  handPrev[owner] = hand.slice();
}

function renderHandDeck(owner) {
  const v = state.view;
  const p = v && v.players[owner];
  const hand = p && p.hand.length ? p.hand : deckFor(owner).slice(0, 4);
  noteHandChanges(owner, hand);
  const nextCard = p && p.next ? CARD_MAP[p.next] : null;
  const nextHtml = nextCard
    ? `<div class="next-card-preview"><span class="next-label">NEXT</span><span class="next-icon">${nextCard.icon}</span><span class="next-name">${nextCard.name}</span></div>`
    : '';
  return hand.map((id) => cardButton(owner, id)).join('') + nextHtml + avgElixirBar(hand);
}

function renderDecks() {
  if (!state.view) return;
  if (state.viewSource === 'online') {
    setHtml(ui.deckA, mySide ? renderHandDeck(mySide) : '');
    setHtml(ui.deckB, '<div class="note">Opponent is playing…</div>');
    return;
  }
  setHtml(ui.deckA, renderHandDeck('A'));
  if (state.mode === 'ai') {
    setHtml(ui.deckB, '<div class="note">Enemy AI controls this deck in real time.</div>');
  } else {
    setHtml(ui.deckB, renderHandDeck('B'));
  }
}

function writeLog(msg) { if (ui.log) ui.log.textContent = msg; }

// Only touch the DOM when the markup actually changed (avoids rebuilding every frame)
function setHtml(el, html) {
  if (!el || el.__html === html) return;
  el.innerHTML = html;
  el.__html = html;
}

// ─── Sound: a tiny WebAudio synth, so no audio files are needed ─────────────

const Sound = (() => {
  let ctx = null;
  let enabled = true;
  try { enabled = localStorage.getItem('prototype_sound') !== 'off'; } catch (_) {}
  const lastPlayed = {};

  function unlock() {
    if (!enabled) return;
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (_) { ctx = null; }
  }

  function tone(freq, dur, opts) {
    const o = opts || {};
    const t0 = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * o.slide), t0 + dur);
    gain.gain.setValueAtTime(o.vol || 0.05, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol) {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.buffer = buf;
    src.connect(gain).connect(ctx.destination);
    src.start();
  }

  const EMOTE_TUNES = {
    laugh: () => [700, 600, 700, 600].forEach((f, i) => tone(f, 0.07, { type: 'triangle', delay: i * 0.09, vol: 0.05 })),
    king: () => [440, 380, 440, 380, 330].forEach((f, i) => tone(f, 0.08, { type: 'square', delay: i * 0.09, vol: 0.03 })),
    thumbs: () => [660, 990].forEach((f, i) => tone(f, 0.1, { type: 'triangle', delay: i * 0.08, vol: 0.05 })),
    cry: () => tone(620, 0.55, { slide: 0.45, vol: 0.05 }),
    angry: () => tone(140, 0.35, { type: 'sawtooth', slide: 0.7, vol: 0.04 }),
    surprised: () => tone(380, 0.22, { type: 'triangle', slide: 3, vol: 0.05 }),
    gg: () => [784, 1046].forEach((f, i) => tone(f, 0.16, { type: 'triangle', delay: i * 0.12, vol: 0.05 })),
    celebrate: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.1, { type: 'triangle', delay: i * 0.06, vol: 0.05 })),
    facepalm: () => [300, 210].forEach((f, i) => tone(f, 0.22, { type: 'triangle', delay: i * 0.2, vol: 0.05 })),
    cool: () => [880, 1320].forEach((f, i) => tone(f, 0.12, { delay: i * 0.1, vol: 0.045 })),
  };

  const SOUNDS = {
    emote: (id) => (EMOTE_TUNES[id] || EMOTE_TUNES.thumbs)(),
    cast: () => { tone(260, 0.25, { type: 'triangle', slide: 3, vol: 0.04 }); noise(0.15, 0.02); },
    boom: () => { noise(0.5, 0.12); tone(80, 0.45, { slide: 0.5, vol: 0.1 }); },
    shock: () => { tone(1400, 0.16, { type: 'square', slide: 0.25, vol: 0.03 }); noise(0.12, 0.05); },
    rocket: () => { noise(0.14, 0.05); tone(180, 0.12, { type: 'square', slide: 0.5, vol: 0.02 }); },
    crown: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.2, { type: 'triangle', delay: i * 0.08, vol: 0.05 })),
    horn: () => { tone(220, 0.5, { type: 'sawtooth', vol: 0.03 }); tone(330, 0.5, { type: 'sawtooth', delay: 0.05, vol: 0.025 }); },
    tick: (urgent) => tone(urgent ? 1250 : 900, 0.05, { type: 'square', vol: urgent ? 0.035 : 0.02 }),
    start: () => [523, 659, 784].forEach((f, i) => tone(f, 0.14, { type: 'triangle', delay: i * 0.07, vol: 0.05 })),
    double: () => [660, 880, 1100, 1320].forEach((f, i) => tone(f, 0.09, { delay: i * 0.05, vol: 0.04 })),
    overtime: () => [392, 392, 523].forEach((f, i) => tone(f, 0.18, { type: 'triangle', delay: i * 0.16, vol: 0.05 })),
    achievement: () => [1046, 1318, 1568, 2093].forEach((f, i) => tone(f, 0.14, { delay: i * 0.07, vol: 0.04 })),
    deploy: () => tone(520, 0.12, { type: 'triangle', slide: 1.6, vol: 0.05 }),
    select: () => tone(760, 0.05, { vol: 0.025 }),
    hit: () => tone(190, 0.05, { type: 'square', vol: 0.01 }),
    splash: () => noise(0.18, 0.04),
    death: () => tone(240, 0.16, { type: 'sawtooth', slide: 0.4, vol: 0.02 }),
    tower: () => { noise(0.7, 0.14); tone(90, 0.6, { slide: 0.5, vol: 0.12 }); },
    reject: () => tone(140, 0.12, { type: 'square', vol: 0.035 }),
    win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, { type: 'triangle', delay: i * 0.12, vol: 0.06 })),
    lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.35, { type: 'triangle', delay: i * 0.16, vol: 0.05 })),
    draw: () => [440, 440].forEach((f, i) => tone(f, 0.2, { delay: i * 0.2, vol: 0.04 })),
  };
  const MIN_GAP = { hit: 0.07, splash: 0.12, death: 0.08, rocket: 0.1, horn: 0.5 };

  function play(name, arg) {
    if (!enabled || !ctx || !SOUNDS[name]) return;
    const now = ctx.currentTime;
    if (MIN_GAP[name] && now - (lastPlayed[name] || 0) < MIN_GAP[name]) return;
    lastPlayed[name] = now;
    try { SOUNDS[name](arg); } catch (_) {}
  }

  function setEnabled(on) {
    enabled = on;
    try { localStorage.setItem('prototype_sound', on ? 'on' : 'off'); } catch (_) {}
    if (on) unlock();
  }

  return { unlock, play, setEnabled, get enabled() { return enabled; } };
})();

// Battle effects from the simulation: draw them and play matching sounds
function handleFx(list) {
  if (!list || !list.length || !arena) return;
  const shown = list.filter((f) => !(f.type === 'emote' && emoteHidden(f.owner)));
  arena.addFx(shown);
  for (const f of shown) {
    switch (f.type) {
      case 'deploy': case 'tower': case 'splash': case 'death': case 'hit': Sound.play(f.type); break;
      case 'cast': Sound.play('cast'); break;
      case 'spell': Sound.play(f.kind === 'shock' ? 'shock' : f.kind === 'firebomb' ? 'boom' : 'rocket'); break;
      case 'crown': Sound.play('crown'); break;
      case 'kingWake': Sound.play('horn'); break;
      case 'emote': Sound.play('emote', f.emote); break;
      default: break;
    }
  }
}

// ─── Card placement: drag a card onto the arena, or tap a card then tap the arena ───

let drag = null;          // card being dragged from the hand
let pointerWorld = null;  // pointer position in arena tiles (null when off the arena)
let rejectNote = null;    // short-lived "why that didn't work" message
let dragGhostEl = null;

function canControl(owner) {
  if (state.viewSource === 'online') return onlineActive && owner === mySide;
  if (!state.running) return false;
  if (state.mode === 'ai') return owner === 'A';
  return owner === 'A' || owner === 'B';
}

function zoneCheck(owner, card, x, y) {
  return state.viewSource === 'online'
    ? Sim.canDeployOnSnapshot(state.view, owner, x, y, card)
    : Sim.canDeploy(state.match, owner, x, y, card);
}

function deployCheck(owner, cardId, x, y) {
  const card = getCardStats(cardId);
  const v = state.view;
  const p = v && v.players[owner];
  if (!card || !p) return { ok: false, reason: 'Match not running' };
  if (!v.running) return { ok: false, reason: 'Match is over' };
  if (!zoneCheck(owner, card, x, y)) return { ok: false, reason: "Can't deploy there" };
  if (p.elixir < card.cost) return { ok: false, reason: `Need ${card.cost} elixir` };
  if (((p.cooldownsRemaining && p.cooldownsRemaining[cardId]) || 0) > 0) return { ok: false, reason: 'Card is recharging' };
  return { ok: true };
}

function rejectDeploy(reason, owner, cardId) {
  rejectNote = { text: reason, until: performance.now() + 1100 };
  writeLog(reason);
  Sound.play('reject');
  const el = [...document.querySelectorAll('.card')].find((c) => c.dataset.owner === owner && c.dataset.type === cardId);
  if (el) {
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }
}

function countPlay(owner, cardId) {
  if (owner !== localSide()) return;
  state.progress.stats.cards += 1;
  if (CARD_MAP[cardId]?.spell) state.progress.stats.spells += 1;
}

function tryDeployAt(owner, cardId, x, y) {
  if (!canControl(owner)) return false;
  const check = deployCheck(owner, cardId, x, y);
  if (!check.ok) { rejectDeploy(check.reason, owner, cardId); return false; }
  if (state.viewSource === 'online') {
    countPlay(owner, cardId);
    socket.emit('deploy', { cardId, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
    state.selectedCard = null;
    Sound.play('deploy');
    return true;
  }
  const res = Sim.deploy(state.match, owner, cardId, x, y);
  if (!res.ok) { rejectDeploy(res.reason, owner, cardId); return false; }
  if (owner === 'A') {
    const cp = cardProgress(cardId);
    cp.mastery = (cp.mastery || 0) + 0.25;
    saveProgress();
  }
  countPlay(owner, cardId);
  writeLog(`${playerName(owner)} ${CARD_MAP[cardId].spell ? 'cast' : 'deployed'} ${CARD_MAP[cardId].name}.`);
  state.selectedCard = null;
  handleFx(Sim.takeFx(state.match));
  state.snapCur = Sim.snapshot(state.match); // show it immediately
  return true;
}

function placementGhost() {
  const sel = state.selectedCard;
  if (!sel || !pointerWorld || !canControl(sel.owner)) return null;
  const check = deployCheck(sel.owner, sel.type, pointerWorld.x, pointerWorld.y);
  const note = rejectNote && performance.now() < rejectNote.until ? rejectNote.text : null;
  return { cardId: sel.type, owner: sel.owner, x: pointerWorld.x, y: pointerWorld.y, valid: check.ok, reason: check.ok ? null : (note || check.reason) };
}

function zoneOverlay() {
  const sel = state.selectedCard;
  const v = state.view;
  if (!sel || !v || !canControl(sel.owner)) return null;
  const card = getCardStats(sel.type);
  if (!card || card.spell) return null; // spells can go anywhere
  const alive = v.towers.map((t) => (t.hp > 0 ? 1 : 0)).join('');
  const buildings = v.units.filter((u) => u.building).map((u) => u.id).join(',');
  return { fn: (x, y) => zoneCheck(sel.owner, card, x, y), key: `${sel.owner}|${card.building ? 1 : 0}|${alive}|${buildings}` };
}

function renderArena() {
  if (!arena) return;
  const zones = zoneOverlay();
  arena.render(state.view, {
    flip: state.viewSource === 'online' && mySide === 'B',
    zoneFn: zones && zones.fn,
    zoneKey: zones && zones.key,
    ghost: placementGhost(),
  });
}

function bindBoardInput() {
  const onCardDown = (e) => {
    const el = e.target.closest('.card');
    if (!el || e.button > 0) return;
    Sound.unlock();
    const owner = el.dataset.owner;
    const cardId = el.dataset.type;
    if (!canControl(owner) || el.dataset.disabled === '1') return;
    drag = { owner, cardId, x0: e.clientX, y0: e.clientY, dragging: false, icon: CARD_MAP[cardId]?.icon || '' };
    e.preventDefault();
  };
  ui.deckA.addEventListener('pointerdown', onCardDown);
  ui.deckB.addEventListener('pointerdown', onCardDown);

  window.addEventListener('pointermove', (e) => {
    pointerWorld = arena ? arena.toWorld(e.clientX, e.clientY) : null;
    if (!drag) return;
    if (!drag.dragging && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8) {
      drag.dragging = true;
      state.selectedCard = { owner: drag.owner, type: drag.cardId };
      dragGhostEl = document.createElement('div');
      dragGhostEl.className = 'drag-ghost';
      dragGhostEl.textContent = drag.icon;
      document.body.appendChild(dragGhostEl);
    }
    if (drag.dragging && dragGhostEl) {
      dragGhostEl.style.left = `${e.clientX}px`;
      dragGhostEl.style.top = `${e.clientY}px`;
      // Over the arena, the canvas draws the real placement preview instead
      dragGhostEl.hidden = !!pointerWorld;
    }
  });

  const endDrag = (e, cancelled) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (dragGhostEl) { dragGhostEl.remove(); dragGhostEl = null; }
    if (cancelled) return;
    if (d.dragging) {
      const w = arena && arena.toWorld(e.clientX, e.clientY);
      if (w) tryDeployAt(d.owner, d.cardId, w.x, w.y);
      else state.selectedCard = null;
    } else {
      const sel = state.selectedCard;
      const same = sel && sel.owner === d.owner && sel.type === d.cardId;
      state.selectedCard = same ? null : { owner: d.owner, type: d.cardId };
      if (!same) Sound.play('select');
    }
    renderDecks();
  };
  window.addEventListener('pointerup', (e) => endDrag(e, false));
  window.addEventListener('pointercancel', (e) => endDrag(e, true));

  ui.arena.addEventListener('pointerdown', (e) => {
    Sound.unlock();
    pointerWorld = arena ? arena.toWorld(e.clientX, e.clientY) : null;
  });
  ui.arena.addEventListener('click', (e) => {
    const sel = state.selectedCard;
    if (!sel) { writeLog('Pick a card first, then tap the arena (or drag the card onto it).'); return; }
    const w = arena.toWorld(e.clientX, e.clientY);
    if (w) tryDeployAt(sel.owner, sel.type, w.x, w.y);
    renderDecks();
  });
  ui.arena.addEventListener('pointerleave', () => { if (!drag) pointerWorld = null; });

  // Keys 1-4 pick a card from the bottom hand; Esc cancels
  window.addEventListener('keydown', (e) => {
    if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === 'Escape') { state.selectedCard = null; closeEmotePanel(); renderDecks(); return; }
    if (e.key === 'e' || e.key === 'E') { openEmotePanel('bottom'); return; }
    const n = Number(e.key);
    if (n >= 1 && n <= 4 && state.view) {
      const side = sideAt('bottom');
      const hand = state.view.players[side]?.hand || [];
      if (hand[n - 1] && canControl(side)) {
        state.selectedCard = { owner: side, type: hand[n - 1] };
        Sound.play('select');
        renderDecks();
      }
    }
  });

  if (window.ResizeObserver) new ResizeObserver(() => arena && arena.resize()).observe(ui.arena);
  else window.addEventListener('resize', () => arena && arena.resize());

  ui.sound?.addEventListener('click', () => {
    Sound.setEnabled(!Sound.enabled);
    updateSoundButton();
  });
  updateSoundButton();
}

function updateSoundButton() {
  if (!ui.sound) return;
  ui.sound.textContent = Sound.enabled ? '🔊 Sound' : '🔇 Muted';
  ui.sound.setAttribute('aria-pressed', Sound.enabled ? 'true' : 'false');
}

function chestReady(c) { return Date.now() >= c.readyAt; }

function tierRewardMultiplier(tier) {
  const map = { 1: 1, 2: 1.35, 3: 1.8, 4: 2.4, 5: 3.2 };
  return map[tier] || 1;
}

function playTierBurst(tier) {
  if (!ui.chestParticles) return;
  ui.chestParticles.innerHTML = '';

  const colorsByTier = {
    1: ['#8fc8ff', '#6bb8ff'],
    2: ['#63ffd2', '#47f3bf'],
    3: ['#ffb36c', '#ff9c4d'],
    4: ['#ffd35f', '#ffc24a'],
    5: ['#ff7e99', '#ffd35f', '#8fd0ff']
  };
  const colors = colorsByTier[tier] || colorsByTier[1];
  const count = 14 + tier * 7;

  for (let i = 0; i < count; i += 1) {
    const p = document.createElement('span');
    p.className = 'chest-particle';
    const angle = (Math.PI * 2 * i) / count + (Math.random() * 0.6 - 0.3);
    const radius = 60 + Math.random() * (80 + tier * 14);
    const tx = Math.cos(angle) * radius;
    const ty = Math.sin(angle) * radius - (50 + Math.random() * 60);
    const size = 4 + Math.random() * (4 + tier * 0.9);
    const dur = 680 + Math.random() * 620;
    const color = colors[Math.floor(Math.random() * colors.length)];
    p.style.setProperty('--tx', `${tx.toFixed(1)}px`);
    p.style.setProperty('--ty', `${ty.toFixed(1)}px`);
    p.style.setProperty('--size', `${size.toFixed(1)}px`);
    p.style.setProperty('--dur', `${dur.toFixed(0)}ms`);
    p.style.setProperty('--color', color);
    ui.chestParticles.appendChild(p);
  }

  setTimeout(() => {
    if (ui.chestParticles) ui.chestParticles.innerHTML = '';
  }, 1500);
}

function updateChestStars(rollIndex, success) {
  if (!ui.chestStars) return;
  const stars = ui.chestStars.querySelectorAll('.chest-star');
  if (!stars || stars.length === 0) return;
  const idx = Math.max(0, Math.min(stars.length - 1, rollIndex - 1));
  const star = stars[idx];
  if (!star) return;
  star.classList.remove('pending', 'success', 'fail');
  star.classList.add(success ? 'success' : 'fail');
}

function resetChestStars() {
  if (!ui.chestStars) return;
  ui.chestStars.querySelectorAll('.chest-star').forEach((star) => {
    star.classList.remove('success', 'fail');
    star.classList.add('pending');
  });
}

function grantTierRewards(tier) {
  const mult = tierRewardMultiplier(tier);
  const gold = Math.round((90 + Math.random() * 150) * mult);
  state.progress.gold += gold;

  const unlockChanceByTier = [0.2, 0.38, 0.58, 0.76, 0.9];
  const rarityCapByTier = ['rare', 'epic', 'legendary', 'champion', 'champion'];
  const unlockChance = unlockChanceByTier[Math.max(0, Math.min(4, tier - 1))];
  const maxRarity = rarityCapByTier[Math.max(0, Math.min(4, tier - 1))];

  const maxIdx = RARITY_ORDER.indexOf(maxRarity);
  const lockedEligible = CARD_LIBRARY.filter((c) => {
    if (cardProgress(c.id).unlocked) return false;
    return RARITY_ORDER.indexOf(c.rarity) <= maxIdx;
  });

  let unlockedName = '';
  if (lockedEligible.length > 0 && Math.random() < unlockChance) {
    const picked = lockedEligible[Math.floor(Math.random() * lockedEligible.length)];
    const cp = cardProgress(picked.id);
    cp.unlocked = true;
    cp.copies += 1;
    unlockedName = picked.name;
  }

  const unlockedCards = CARD_LIBRARY.filter((c) => cardProgress(c.id).unlocked);
  const copyDrops = Math.min(6, 2 + tier);
  for (let i = 0; i < copyDrops && unlockedCards.length > 0; i += 1) {
    const c = unlockedCards[Math.floor(Math.random() * unlockedCards.length)];
    const baseCopies = RARITY_STYLE[c.rarity].copies || 1;
    const bonus = Math.max(1, Math.round(baseCopies * (0.45 + Math.random() * 0.9) * mult));
    cardProgress(c.id).copies += bonus;
  }

  return {
    gold,
    unlockedName,
    copyDrops
  };
}

function startChestOpeningSession(chest) {
  state.chestOpening = true;
  state.chestSession = {
    chestId: chest.id,
    tier: 1,
    rollIndex: 0,
    rewards: null
  };

  if (ui.chestOverlay) ui.chestOverlay.hidden = false;
  if (ui.chestOverlay) {
    ui.chestOverlay.setAttribute('tabindex', '-1');
    ui.chestOverlay.focus();
  }
  if (ui.chestTier) ui.chestTier.textContent = '1';
  if (ui.chestPhase) ui.chestPhase.textContent = 'CHEST UNLOCKED';
  if (ui.chestRolls) ui.chestRolls.textContent = 'Click to roll chance 1 of 4 (40%).';
  if (ui.chestReward) ui.chestReward.textContent = '';
  resetChestStars();
  if (ui.chestVisual) {
    ui.chestVisual.classList.remove('tier-up');
    ui.chestVisual.classList.add('open');
  }
  if (ui.chestClaim) {
    ui.chestClaim.disabled = false;
    ui.chestClaim.textContent = 'Roll Chance 1/4';
  }
}

function finalizeChestOpeningSession() {
  if (!state.chestSession) return;

  const rewards = grantTierRewards(state.chestSession.tier);
  state.chestSession.rewards = rewards;
  state.progress.chests = state.progress.chests.filter((c) => c.id !== state.chestSession.chestId);

  if (ui.chestPhase) ui.chestPhase.textContent = `FINAL TIER ${state.chestSession.tier}`;
  if (ui.chestRolls) ui.chestRolls.textContent = 'All 4 chances used.';
  playTierBurst(state.chestSession.tier);
  if (ui.chestReward) {
    const unlockText = rewards.unlockedName ? `Unlocked: ${rewards.unlockedName}` : 'No new card unlocked';
    ui.chestReward.innerHTML = `
      <strong>Rewards</strong><br>
      Gold: +${rewards.gold}<br>
      Copy drops: ${rewards.copyDrops}<br>
      ${unlockText}
    `;
  }
  if (ui.chestClaim) {
    ui.chestClaim.disabled = false;
    ui.chestClaim.textContent = 'Claim Rewards';
  }

  writeLog(`Opened tier ${state.chestSession.tier} chest: +${rewards.gold} gold${rewards.unlockedName ? `, unlocked ${rewards.unlockedName}` : ''}.`);
  saveProgress();
  renderProgress();
  renderCollection();
}

function advanceChestRoll() {
  if (!state.chestSession) return;
  if (state.chestSession.rollIndex >= 4) {
    closeChestOverlay();
    return;
  }

  state.chestSession.rollIndex += 1;
  const success = state.chestSession.tier < 5 && Math.random() < 0.4;
  if (success) {
    state.chestSession.tier += 1;
    updateChestStars(state.chestSession.rollIndex, true);
    if (ui.chestTier) ui.chestTier.textContent = String(state.chestSession.tier);
    if (ui.chestVisual) {
      ui.chestVisual.classList.remove('tier-up');
      void ui.chestVisual.offsetWidth;
      ui.chestVisual.classList.add('tier-up');
    }
    playTierBurst(state.chestSession.tier);
    if (ui.chestRolls) ui.chestRolls.textContent = `Chance ${state.chestSession.rollIndex}/4: Tier upgraded!`;
  } else {
    updateChestStars(state.chestSession.rollIndex, false);
    if (ui.chestRolls) ui.chestRolls.textContent = `Chance ${state.chestSession.rollIndex}/4: No upgrade.`;
  }

  if (state.chestSession.rollIndex < 4) {
    ui.chestClaim.textContent = `Roll Chance ${state.chestSession.rollIndex + 1}/4`;
    return;
  }

  finalizeChestOpeningSession();
}

function closeChestOverlay() {
  if (ui.chestOverlay) ui.chestOverlay.hidden = true;
  if (ui.chestVisual) ui.chestVisual.classList.remove('open', 'tier-up');
  if (ui.chestParticles) ui.chestParticles.innerHTML = '';
  resetChestStars();
  state.chestOpening = false;
  state.chestSession = null;
}

function handleChestAdvanceClick() {
  if (!state.chestOpening) return;
  if (state.chestSession && state.chestSession.rollIndex < 4) {
    advanceChestRoll();
    return;
  }
  closeChestOverlay();
}

function openReadyChest() {
  if (state.chestOpening) return;
  const chest = state.progress.chests.find((c) => chestReady(c));
  if (!chest) { writeLog('No chest ready yet.'); return; }

  if (!ui.chestOverlay || !ui.chestTier || !ui.chestVisual || !ui.chestRolls || !ui.chestPhase || !ui.chestReward || !ui.chestClaim) {
    const fallback = grantTierRewards(2);
    state.progress.chests = state.progress.chests.filter((c) => c.id !== chest.id);
    writeLog(`Opened chest: +${fallback.gold} gold.`);
    saveProgress();
    renderProgress();
    renderCollection();
    return;
  }

  startChestOpeningSession(chest);
}

function buildingCost(kind) {
  const lvl = kind === 'tower' ? state.progress.buildings.towerLevel : state.progress.buildings.baseLevel;
  return Math.round(180 + Math.pow(lvl, 1.55) * 70);
}

function upgradeBuilding(kind) {
  const cost = buildingCost(kind);
  if (state.progress.gold < cost) { writeLog('Not enough gold.'); return; }
  state.progress.gold -= cost;
  if (kind === 'tower') state.progress.buildings.towerLevel = clamp(state.progress.buildings.towerLevel + 1, 1, 20);
  else state.progress.buildings.baseLevel = clamp(state.progress.buildings.baseLevel + 1, 1, 20);
  saveProgress();
  renderProgress();
  writeLog(`${kind === 'tower' ? 'Tower' : 'Base'} upgraded.`);
}

function cardUpgradeCost(id, nextLevel) {
  const c = CARD_MAP[id];
  return Math.round((RARITY_STYLE[c.rarity].gold || 70) * nextLevel * 0.85 + nextLevel * nextLevel * 6);
}

function copiesNeed(nextLevel) { return Math.round(2 + nextLevel * 1.7); }

function upgradeCard(id) {
  const cp = cardProgress(id);
  if (!cp.unlocked) return;
  if (cp.level >= 14) { writeLog('Card is max level.'); return; }
  const next = cp.level + 1;
  const need = copiesNeed(next);
  const cost = cardUpgradeCost(id, next);
  if (cp.copies < need || state.progress.gold < cost) { writeLog('Need more copies or gold.'); return; }
  cp.copies -= need;
  cp.level = next;
  saveProgress();
  renderProgress();
  renderCollection();
  renderDecks();
  writeLog(`${CARD_MAP[id].name} leveled to ${cp.level}.`);
}

function unlockAbility(id) {
  const cp = cardProgress(id);
  const card = CARD_MAP[id];
  if (!cp.unlocked || cp.abilityUnlocked) return;
  if (cp.level < card.ability.minLevel || cp.mastery < card.ability.minMastery) {
    writeLog('Ability unlock is intentionally hard: level 12 + mastery 40.');
    return;
  }
  if (state.progress.gold < 400) { writeLog('Need 400 gold to unlock ability.'); return; }
  state.progress.gold -= 400;
  cp.abilityUnlocked = true;
  saveProgress();
  renderProgress();
  renderCollection();
  writeLog(`${card.name} ability unlocked. It is intentionally modest.`);
}

function setDeckSlot(slot, cardId) {
  if (slot < 0 || slot >= MAX_DECK) return;
  if (!cardProgress(cardId).unlocked) return;
  const deck = [...state.progress.deck];
  const other = deck.indexOf(cardId);
  if (other >= 0) {
    const temp = deck[slot];
    deck[slot] = cardId;
    deck[other] = temp;
  } else {
    deck[slot] = cardId;
  }
  state.progress.deck = deck.slice(0, MAX_DECK);
  saveProgress();
  renderCollection();
  renderDecks();
}

function setAiDeckSlot(slot, cardId) {
  if (slot < 0 || slot >= MAX_DECK) return;
  if (!cardProgress(cardId).unlocked) return;
  const deck = [...state.progress.aiDeck];
  const other = deck.indexOf(cardId);
  if (other >= 0) {
    const temp = deck[slot];
    deck[slot] = cardId;
    deck[other] = temp;
  } else {
    deck[slot] = cardId;
  }
  state.progress.aiDeck = deck.slice(0, MAX_DECK);
  saveProgress();
  renderCollection();
}

function renderProgress() {
  if (ui.goldAmount) ui.goldAmount.textContent = String(state.progress.gold);
  if (ui.towerLevel) ui.towerLevel.textContent = String(state.progress.buildings.towerLevel);
  if (ui.baseLevel) ui.baseLevel.textContent = String(state.progress.buildings.baseLevel);
  const bl = state.progress.buildings;
  const towersNow = Sim.towerStats(bl.towerLevel, bl.baseLevel);
  const towersNext = Sim.towerStats(bl.towerLevel + 1, bl.baseLevel + 1);
  if (ui.baseUpgradeInfo) {
    ui.baseUpgradeInfo.textContent = `King Tower HP/DMG: ${towersNow.kingHp} / ${towersNow.kingDmg} (next ${towersNext.kingHp} / ${towersNext.kingDmg})`;
  }
  if (ui.towerUpgradeInfo) {
    ui.towerUpgradeInfo.textContent = `Princess Tower HP/DMG: ${towersNow.princessHp} / ${towersNow.princessDmg} (next ${towersNext.princessHp} / ${towersNext.princessDmg})`;
  }
  if (ui.chestStatus) {
    const ready = state.progress.chests.filter((c) => chestReady(c)).length;
    ui.chestStatus.textContent = state.progress.chests.length === 0
      ? 'No chests queued.'
      : `${state.progress.chests.length} chest(s), ${ready} ready.`;
  }
  if (ui.upgradeTower) ui.upgradeTower.textContent = `Upgrade Tower (${buildingCost('tower')})`;
  if (ui.upgradeBase) ui.upgradeBase.textContent = `Upgrade Base (${buildingCost('base')})`;
  if (ui.aiDifficulty) ui.aiDifficulty.value = state.progress.aiDifficulty || 'normal';
  if (ui.aiDifficultyInfo) {
    const profile = getAiProfile();
    ui.aiDifficultyInfo.textContent = profile.description;
  }
  if (ui.aiBaseMult) ui.aiBaseMult.value = String(state.progress.aiHealth.baseMult);
  if (ui.aiTowerMult) ui.aiTowerMult.value = String(state.progress.aiHealth.towerMult);
  if (ui.aiBaseMultOut) ui.aiBaseMultOut.textContent = `${state.progress.aiHealth.baseMult.toFixed(2)}x`;
  if (ui.aiTowerMultOut) ui.aiTowerMultOut.textContent = `${state.progress.aiHealth.towerMult.toFixed(2)}x`;
  if (ui.aiHealthInfo) {
    const aiTowers = Sim.towerStats(bl.towerLevel, bl.baseLevel, { king: state.progress.aiHealth.baseMult, tower: state.progress.aiHealth.towerMult });
    ui.aiHealthInfo.textContent = `AI King HP: ${aiTowers.kingHp} | AI Princess HP: ${aiTowers.princessHp}`;
  }
}

function speedLabel(c) {
  if (c.spell) return 'instant cast';
  if (c.building) return `lasts ${c.lifetime}s`;
  if (c.speed >= 2) return 'very fast';
  if (c.speed >= 1.4) return 'fast';
  if (c.speed >= 0.95) return 'medium';
  return 'slow';
}

// Plain-language summary of how a card behaves in battle
function cardTraits(c) {
  if (c.spell) {
    const sp = [c.role, `cast anywhere, radius ${c.splash} tiles`, `${Math.round(c.towerMult * 100)}% damage to crown towers`];
    if (c.proj !== 'shock') sp.push('launched from your King Tower');
    if (c.stun) sp.push(`stuns for ${c.stun}s and resets attacks`);
    if (c.knockback) sp.push('knocks troops back');
    if (c.waves > 1) sp.push(`${c.waves} waves`);
    return sp.join(' • ');
  }
  const parts = [c.role];
  parts.push(c.targets === 'buildings' ? 'attacks buildings only' : c.targets === 'any' ? 'hits air & ground' : 'hits ground only');
  if (c.air) parts.push('flying');
  if (c.swarmCount > 1) parts.push(`${c.swarmCount} units`);
  if (c.splash) parts.push(`splash ${c.splash} tiles`);
  if (c.special.includes('jump')) parts.push('jumps the river');
  if (c.special.includes('charge')) parts.push('charges for double damage');
  if (c.special.includes('aura')) parts.push('shields nearby allies (-25% damage)');
  if (c.special.includes('chain')) parts.push('lightning chains to 2 more');
  if (c.special.includes('kamikaze')) parts.push('explodes on contact');
  if (c.special.includes('deathBomb')) parts.push('drops a bomb when destroyed');
  if (c.minRange) parts.push(`can't hit within ${c.minRange} tiles`);
  if (c.style === 'double') parts.push('hits 2 targets');
  if (c.style === 'burst') parts.push('bonus follow-up shot');
  return parts.join(' • ');
}

function filterCards() {
  const q = String(ui.cardSearch?.value || '').trim().toLowerCase();
  if (!q) return CARD_LIBRARY;
  return CARD_LIBRARY.filter((c) => c.name.toLowerCase().includes(q) || c.rarity.includes(q) || c.role.includes(q) || c.style.includes(q));
}

function renderCollection() {
  const deck = state.progress.deck.slice(0, MAX_DECK);
  while (deck.length < MAX_DECK) deck.push(STARTER_DECK[deck.length % STARTER_DECK.length]);
  state.progress.deck = deck;

  const aiDeck = state.progress.aiDeck.slice(0, MAX_DECK);
  while (aiDeck.length < MAX_DECK) aiDeck.push(STARTER_DECK[aiDeck.length % STARTER_DECK.length]);
  state.progress.aiDeck = aiDeck;

  if (ui.deckSlots) {
    ui.deckSlots.innerHTML = deck.map((id, idx) => {
      const card = CARD_MAP[id];
      const cp = cardProgress(id);
      return `<button class="deck-slot" data-slot="${idx}"><span>${idx + 1}</span>${card.icon} ${card.name}<small>Lv ${cp.level}</small></button>`;
    }).join('');

    ui.deckSlots.querySelectorAll('.deck-slot').forEach((el) => {
      el.addEventListener('click', () => {
        const slot = Number(el.dataset.slot);
        if (state.selectedCard && state.selectedCard.owner === 'collection') setDeckSlot(slot, state.selectedCard.type);
        else writeLog('Select a collection card, then click a deck slot to assign it.');
      });
    });
  }

  if (ui.aiDeckSlots) {
    ui.aiDeckSlots.innerHTML = aiDeck.map((id, idx) => {
      const card = CARD_MAP[id];
      const cp = cardProgress(id);
      return `<button class="deck-slot ai-deck-slot" data-ai-slot="${idx}"><span>AI ${idx + 1}</span>${card.icon} ${card.name}<small>Lv ${cp.level}</small></button>`;
    }).join('');

    ui.aiDeckSlots.querySelectorAll('[data-ai-slot]').forEach((el) => {
      el.addEventListener('click', () => {
        const slot = Number(el.getAttribute('data-ai-slot'));
        if (state.selectedCard && state.selectedCard.owner === 'collection') setAiDeckSlot(slot, state.selectedCard.type);
        else writeLog('Select a collection card, then click an AI deck slot to assign it.');
      });
    });
  }

  if (!ui.cardCollection) return;
  ui.cardCollection.innerHTML = filterCards().map((c) => {
    const cp = cardProgress(c.id);
    const unlocked = cp.unlocked;
    const inDeck = deck.includes(c.id);
    const next = cp.level + 1;
    const need = copiesNeed(next);
    const upCost = cardUpgradeCost(c.id, next);
    const canUp = unlocked && cp.level < 14 && cp.copies >= need && state.progress.gold >= upCost;
    const canAbility = unlocked && !cp.abilityUnlocked && cp.level >= c.ability.minLevel && cp.mastery >= c.ability.minMastery && state.progress.gold >= 400;
    let statLine = 'Locked';
    let nextLine = '';
    if (unlocked) {
      const nowStats = getCardStats(c.id);
      const nextStats = cp.level < 14 ? getCardStatsAtLevel(c.id, cp.level + 1, cp.abilityUnlocked, cp.mastery || 0) : null;
      statLine = nowStats.spell
        ? `Lv ${cp.level} • DMG ${Math.round(nowStats.dmgScaled)} (towers ${Math.round(nowStats.dmgScaled * nowStats.towerMult)}) • Radius ${nowStats.splash} tiles`
        : `Lv ${cp.level} • HP ${nowStats.hpScaled} • DMG ${Math.round(nowStats.dmgScaled)} every ${nowStats.cd}s • Range ${nowStats.proj === 'melee' ? 'melee' : `${nowStats.range} tiles`} • ${speedLabel(nowStats)}`;
      if (nextStats) {
        nextLine = nextStats.spell ? `Next Lv: DMG ${Math.round(nextStats.dmgScaled)}` : `Next Lv: HP ${nextStats.hpScaled} • DMG ${Math.round(nextStats.dmgScaled)}`;
      }
    }
    return `<article class="collection-card ${unlocked ? '' : 'locked'} ${inDeck ? 'in-deck' : ''} ${c.winCondition ? 'win-condition' : ''} ${c.swarmCount > 1 ? 'swarm-card' : ''}" data-card="${c.id}"><header><strong>${c.icon} ${c.name}</strong><span class="rarity-${c.rarity}">${RARITY_STYLE[c.rarity].label}</span>${c.winCondition ? '<span class="wc-badge">👑 Win Condition</span>' : ''}${c.swarmCount > 1 ? `<span class="swarm-badge">🐝 ×${c.swarmCount} Swarm</span>` : ''}</header><p>${unlocked ? `Copies ${cp.copies} • Mastery ${Math.floor(cp.mastery)}` : 'Locked'}</p><p>${statLine}</p><p>${unlocked ? `Cost ${c.cost} • ${cardTraits(c)}` : 'Unknown stats'}</p><p>${nextLine}</p><div class="collection-actions">${unlocked ? `<button data-select="${c.id}">${inDeck ? 'In Deck' : 'Select'}</button>` : '<button disabled>Locked</button>'}${unlocked ? `<button data-up="${c.id}" ${canUp ? '' : 'disabled'}>Level Up (${need} copies, ${upCost}g)</button>` : ''}${unlocked ? `<button data-ability="${c.id}" ${canAbility ? '' : 'disabled'}>${cp.abilityUnlocked ? `✓ ${c.ability.name}` : `${c.ability.name} (Lv${c.ability.minLevel}, ${c.ability.minMastery}M, 400g)`}</button>` : ''}</div></article>`;
  }).join('');

  ui.cardCollection.querySelectorAll('[data-select]').forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.getAttribute('data-select');
      if (!id) return;
      state.selectedCard = { owner: 'collection', type: id };
      writeLog(`Selected ${CARD_MAP[id].name}. Click a deck slot (1-8).`);
    });
  });

  ui.cardCollection.querySelectorAll('[data-up]').forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.getAttribute('data-up');
      if (!id) return;
      upgradeCard(id);
    });
  });

  ui.cardCollection.querySelectorAll('[data-ability]').forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.getAttribute('data-ability');
      if (!id) return;
      unlockAbility(id);
    });
  });
}

function bindProgressUi() {
  ui.earnChest?.addEventListener('click', () => {
    awardChest();
    saveProgress();
    renderProgress();
    writeLog('Chest added to queue.');
  });

  ui.openChest?.addEventListener('click', openReadyChest);
  ui.upgradeTower?.addEventListener('click', () => upgradeBuilding('tower'));
  ui.upgradeBase?.addEventListener('click', () => upgradeBuilding('base'));
  ui.cardSearch?.addEventListener('input', renderCollection);
  ui.aiDifficulty?.addEventListener('change', () => {
    applyAiDifficultyPreset(ui.aiDifficulty?.value || 'normal');
  });
  ui.aiBaseMult?.addEventListener('input', () => {
    state.progress.aiHealth.baseMult = clamp(Number(ui.aiBaseMult.value || 1), 0.6, 2.2);
    state.progress.aiDifficulty = 'custom';
    saveProgress();
    renderProgress();
  });
  ui.aiTowerMult?.addEventListener('input', () => {
    state.progress.aiHealth.towerMult = clamp(Number(ui.aiTowerMult.value || 1), 0.6, 2.2);
    state.progress.aiDifficulty = 'custom';
    saveProgress();
    renderProgress();
  });

  ui.chestClaim?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleChestAdvanceClick();
  });

  ui.chestOverlay?.addEventListener('click', () => {
    handleChestAdvanceClick();
  });

  ui.chestOverlay?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleChestAdvanceClick();
    }
  });
}

function ensureSocket() {
  // Keep a socket that is connected or still connecting (server may be waking up)
  if (socket && (socket.connected || socket.active)) return;
  // If we have a dead socket, destroy it so we build a fresh one
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  if (typeof io === 'undefined') { writeLog('Socket.io not loaded.'); return; }

  // Free Render instances sleep when idle and can take ~60s to wake, so allow a long connect timeout
  socket = io(SERVER_URL, { transports: ['websocket', 'polling'], reconnection: false, timeout: 75000 });
  if (ui.lobbyStatus) ui.lobbyStatus.textContent = 'Connecting to game server (can take up to a minute if it was asleep)...';

  socket.on('connect', () => {
    if (ui.lobbyStatus && /^(Cannot reach|Connecting to game server)/.test(ui.lobbyStatus.textContent)) {
      ui.lobbyStatus.textContent = 'Connected. Ready to play!';
    }
  });

  socket.on('connect_error', () => {
    if (ui.lobbyStatus) ui.lobbyStatus.textContent = 'Cannot reach game server. Is the server running?';
    writeLog('Server connection failed.');
    inQueue = false;
    if (ui.queueStatus) ui.queueStatus.hidden = true;
    if (ui.findMatch) ui.findMatch.disabled = false;
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  });

  socket.on('room_created', ({ code, side }) => {
    mySide = side;
    if (ui.roomCodeDisplay) ui.roomCodeDisplay.textContent = code;
    if (ui.shareLink) ui.shareLink.value = `${location.origin}/prototype.html?room=${code}`;
    if (ui.shareBox) ui.shareBox.hidden = false;
    if (ui.lobbyStatus) ui.lobbyStatus.textContent = 'Waiting for opponent...';
  });

  socket.on('room_joined', ({ code, side }) => {
    mySide = side;
    inQueue = false;
    if (ui.queueStatus) ui.queueStatus.hidden = true;
    if (ui.findMatch) ui.findMatch.disabled = false;
    if (ui.lobbyStatus) ui.lobbyStatus.textContent = `Matched! Room ${code}. Starting...`;
  });

  socket.on('room_error', ({ msg }) => {
    if (ui.lobbyStatus) ui.lobbyStatus.textContent = `Error: ${msg}`;
  });

  socket.on('queue_waiting', () => {
    inQueue = true;
    if (ui.queueStatus) ui.queueStatus.hidden = false;
    if (ui.lobbyStatus) ui.lobbyStatus.textContent = 'In queue — waiting for opponent...';
  });

  socket.on('queue_left', () => {
    inQueue = false;
    if (ui.queueStatus) ui.queueStatus.hidden = true;
    if (ui.findMatch) ui.findMatch.disabled = false;
    if (ui.lobbyStatus) ui.lobbyStatus.textContent = 'Ready. Create or join a room.';
  });

  socket.on('rematch_waiting', () => {
    if (ui.lobbyStatus) ui.lobbyStatus.textContent = 'Waiting for opponent to accept rematch...';
    if (ui.winRematch) { ui.winRematch.disabled = true; ui.winRematch.textContent = 'Waiting...'; }
  });

  socket.on('match_start', showMatchOnline);
  // Emotes sent after the final whistle arrive outside the normal state updates
  socket.on('fx', (list) => handleFx(Array.isArray(list) ? list : []));
  socket.on('emote_rejected', ({ reason } = {}) => { writeLog(reason || 'Emote not sent.'); });
  socket.on('state_update', applyServerState);
  socket.on('match_over', ({ winner }) => handleOnlineVictory(winner));

  socket.on('opponent_left', () => {
    state.running = false;
    onlineActive = false;
    state.selectedCard = null;
    writeLog('Opponent disconnected.');
    if (ui.lobbyPanel) ui.lobbyPanel.hidden = false;
  });

  // The server is the referee online; if it refuses a deploy, say why
  socket.on('deploy_rejected', ({ reason } = {}) => {
    rejectNote = { text: reason || "Can't deploy", until: performance.now() + 1100 };
    writeLog(reason || "Can't deploy");
    Sound.play('reject');
  });
}

function joinRoomByCode(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) { if (ui.lobbyStatus) ui.lobbyStatus.textContent = 'Enter room code first.'; return; }
  ensureSocket();
  if (!socket) return;
  socket.emit('join_room', { code: c, deck: onlineDeckPayload() });
  if (ui.lobbyStatus) ui.lobbyStatus.textContent = 'Joining...';
}

function bindLobby() {
  ui.createRoom?.addEventListener('click', () => {
    ensureSocket();
    if (!socket) return;
    socket.emit('create_room', { deck: onlineDeckPayload() });
    if (ui.lobbyStatus) ui.lobbyStatus.textContent = 'Creating room...';
  });

  ui.joinRoom?.addEventListener('click', () => joinRoomByCode(ui.joinCode?.value || ''));
  ui.joinCode?.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoomByCode(ui.joinCode?.value || ''); });

  ui.copyLink?.addEventListener('click', () => {
    const link = ui.shareLink?.value;
    if (!link) return;
    navigator.clipboard?.writeText(link).then(() => {
      ui.copyLink.textContent = 'Copied!';
      setTimeout(() => { ui.copyLink.textContent = 'Copy Link'; }, 1400);
    }).catch(() => {});
  });

  ui.findMatch?.addEventListener('click', joinQueue);
  ui.cancelQueue?.addEventListener('click', leaveQueue);
  ui.winClaim?.addEventListener('click', () => {
    const again = !lastMatchWasOnline && ui.mode?.value !== 'online';
    closeWinOverlay();
    if (again) setupMatch();
  });
  ui.winRematch?.addEventListener('click', () => {
    if (!socket || !socket.connected) return;
    socket.emit('rematch');
    if (ui.winRematch) { ui.winRematch.disabled = true; ui.winRematch.textContent = 'Waiting...'; }
    closeWinOverlay();
    if (ui.lobbyPanel) ui.lobbyPanel.hidden = false;
    if (ui.lobbyStatus) ui.lobbyStatus.textContent = 'Waiting for opponent to accept rematch...';
  });
}

// The deck you bring online: your saved deck (unlocked cards only), at your card levels
function onlineDeckPayload() {
  let ids = state.progress.deck.filter((id) => CARD_MAP[id] && cardProgress(id).unlocked).slice(0, MAX_DECK);
  if (ids.length === 0) ids = [...STARTER_DECK];
  onlineDeckIds = ids;
  return ids.map((id) => {
    const cp = cardProgress(id);
    return { id, level: cp.level || 1, abilityUnlocked: !!cp.abilityUnlocked, mastery: cp.mastery || 0 };
  });
}

function showOnlineLobby() {
  state.running = false; // pause the local match while you look for an opponent
  if (ui.lobbyPanel) ui.lobbyPanel.hidden = false;
  if (ui.shareBox) ui.shareBox.hidden = true;
  if (ui.lobbyStatus) ui.lobbyStatus.textContent = 'Ready. Create or join room.';
  writeLog('Online matches use your current deck.');
  // Connect now so a sleeping server starts waking up before you click anything
  ensureSocket();
}

function scrollToBattle() {
  const wrap = document.querySelector('.battle-wrap');
  if (wrap) wrap.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

function showMatchOnline() {
  onlineActive = true;
  lastMatchWasOnline = true;
  inQueue = false;
  if (ui.lobbyPanel) ui.lobbyPanel.hidden = true;
  if (ui.queueStatus) ui.queueStatus.hidden = true;
  if (ui.joinCode) ui.joinCode.value = '';
  if (ui.winOverlay) ui.winOverlay.hidden = true;
  state.running = false; // pause any local match underneath
  state.viewSource = 'online';
  state.selectedCard = null;
  state.view = null;
  netSnapshots = [];
  netClockOffset = null;
  netFx = [];
  emoteUi.lastSent = { A: -1e9, B: -1e9 };
  beginMatchPresentation();
  writeLog(`Online match started. Your towers are at the bottom.`);
  scrollToBattle();
}

function applyServerState(serverState) {
  if (!onlineActive) return;

  // Track how far the server's match clock is from ours. Take the smallest gap
  // seen (least network delay) and let it drift up slowly if the server falls behind.
  const offset = performance.now() / 1000 - serverState.time;
  if (netClockOffset === null || offset < netClockOffset) netClockOffset = offset;
  else netClockOffset += (offset - netClockOffset) * 0.02;
  netSnapshots.push(serverState);
  netSnapshots = netSnapshots.filter((s) => s.time >= serverState.time - 1);
  // Effects are shown when the (slightly delayed) picture reaches them, so hits line up with shots
  (serverState.fx || []).forEach((f) => netFx.push({ ...f, t: serverState.time }));
  // A hidden tab doesn't draw, so don't let old effects pile up
  if (netFx.length > 200) netFx = netFx.filter((f) => f.t >= serverState.time - 1);
  if (!state.view) state.view = serverState;
}

// Draw the battle as it was NET_INTERP_DELAY ago, blending the two snapshots around that moment
function interpolateNet() {
  if (netSnapshots.length === 0 || netClockOffset === null) return;
  const renderTime = performance.now() / 1000 - netClockOffset - NET_INTERP_DELAY;
  let a = null;
  let b = null;
  for (const s of netSnapshots) {
    if (s.time <= renderTime) a = s;
    else { b = s; break; }
  }
  if (!a) a = b;
  if (!b) b = a;
  const t = b.time > a.time ? (renderTime - a.time) / (b.time - a.time) : 1;
  state.view = lerpSnap(a, b, t);
  if (netFx.length) {
    const due = netFx.filter((f) => f.t <= renderTime);
    if (due.length) {
      netFx = netFx.filter((f) => f.t > renderTime);
      handleFx(due);
    }
  }
}

function handleOnlineVictory(winner) {
  onlineActive = false;
  state.running = false;
  state.selectedCard = null;
  // Show the final position
  const last = netSnapshots[netSnapshots.length - 1];
  if (last) state.view = last;
  if (netFx.length) { handleFx(netFx); netFx = []; }
  const won = winner === mySide;
  const draw = winner === 'draw';
  let cardAward = null;
  let goldBonus = 0;
  const reason = endReasonText(last && last.endReason);
  if (won) {
    goldBonus = 200;
    state.progress.gold += goldBonus;
    awardChest();
    cardAward = awardWinCard();
    const cardMsg = cardAward
      ? (cardAward.isUnlock ? ` Unlocked ${cardAward.card.name}!` : ` +${cardAward.copies} ${cardAward.card.name}.`)
      : '';
    writeLog(`Online win! ${reason}. +${goldBonus} gold, chest earned.${cardMsg}`);
  } else if (draw) {
    writeLog(`Online draw. ${reason}.`);
  } else {
    writeLog(`Opponent wins online. ${reason}.`);
  }
  const result = draw ? 'draw' : won ? 'win' : 'loss';
  const mine = last ? last.players[mySide] : null;
  const newAch = recordMatch({ result, crowns: mine ? mine.crowns : 0, kingKill: won && last?.endReason === 'king', hardAi: false, online: true });
  saveProgress();
  renderProgress();
  renderCollection();
  Sound.play(won ? 'win' : draw ? 'draw' : 'lose');
  const crowns = last ? `👑 You ${last.players[mySide].crowns} – ${last.players[enemyOf(mySide)].crowns} Opponent` : '';
  presentResult(result, won ? 'VICTORY!' : draw ? 'DRAW' : 'DEFEAT', () => showWinOverlay(result, cardAward, goldBonus, true, {
    detail: `${reason} · ${crowns}`,
    crowns: mine ? mine.crowns : 0,
    stats: matchStats(last, mySide),
    achievements: newAch,
  }));
}

function joinQueue() {
  ensureSocket();
  if (!socket) return;
  inQueue = true;
  if (ui.queueStatus) ui.queueStatus.hidden = false;
  if (ui.findMatch) ui.findMatch.disabled = true;
  if (!socket.connected && ui.lobbyStatus) ui.lobbyStatus.textContent = 'Connecting to game server (can take up to a minute if it was asleep)...';
  const doJoin = () => {
    if (!inQueue) return; // cancelled while connecting
    socket.emit('join_queue', { deck: onlineDeckPayload() });
    if (ui.lobbyStatus) ui.lobbyStatus.textContent = 'Searching for opponent...';
  };
  if (socket.connected) {
    doJoin();
  } else {
    socket.once('connect', doJoin);
    socket.once('connect_error', () => {
      inQueue = false;
      if (ui.queueStatus) ui.queueStatus.hidden = true;
      if (ui.findMatch) ui.findMatch.disabled = false;
    });
  }
}

function leaveQueue() {
  inQueue = false;
  if (socket && socket.connected) socket.emit('leave_queue');
  if (ui.queueStatus) ui.queueStatus.hidden = true;
  if (ui.findMatch) ui.findMatch.disabled = false;
  if (ui.lobbyStatus) ui.lobbyStatus.textContent = 'Ready. Create or join a room.';
}

function cacheUi() {
  ui.lockPanel = $('ptLockPanel');
  ui.content = $('ptContent');
  ui.password = $('ptPassword');
  ui.unlock = $('ptUnlock');
  ui.error = $('ptError');
  ui.board = $('ptBoard');
  ui.arena = $('ptArena');
  ui.sound = $('ptSound');
  ui.deckA = $('ptDeckA');
  ui.deckB = $('ptDeckB');
  ui.mode = $('ptMode');
  ui.start = $('ptStartMatch');
  ui.resetUpgrades = $('ptResetUpgrades');
  ui.log = $('ptMatchLog');
  ui.status.A.name = $('ptNameA');
  ui.status.A.base = $('ptBaseA');
  ui.status.A.tower = $('ptTowerA');
  ui.status.A.energy = $('ptEnergyA');
  ui.status.A.gold = $('ptGoldA');
  ui.status.B.name = $('ptNameB');
  ui.status.B.base = $('ptBaseB');
  ui.status.B.tower = $('ptTowerB');
  ui.status.B.energy = $('ptEnergyB');
  ui.status.B.gold = $('ptGoldB');
  ui.baseBars.A = $('ptBaseBarA');
  ui.baseBars.B = $('ptBaseBarB');
  ui.energyBars.A = $('ptEnergyBarA');
  ui.energyBars.B = $('ptEnergyBarB');
  ui.lobbyPanel = $('ptLobbyPanel');
  ui.createRoom = $('ptCreateRoom');
  ui.joinCode = $('ptJoinCode');
  ui.joinRoom = $('ptJoinRoom');
  ui.roomCodeDisplay = $('ptRoomCode');
  ui.shareBox = $('ptShareBox');
  ui.shareLink = $('ptShareLink');
  ui.copyLink = $('ptCopyLink');
  ui.lobbyStatus = $('ptLobbyStatus');

  ui.goldAmount = $('ptGoldAmount');
  ui.chestStatus = $('ptChestStatus');
  ui.earnChest = $('ptEarnChest');
  ui.openChest = $('ptOpenChest');
  ui.deckSlots = $('ptDeckSlots');
  ui.aiDeckSlots = $('ptAiDeckSlots');
  ui.cardCollection = $('ptCardCollection');
  ui.cardSearch = $('ptCardSearch');
  ui.towerLevel = $('ptTowerLevel');
  ui.baseLevel = $('ptBaseLevel');
  ui.upgradeTower = $('ptUpgradeTower');
  ui.upgradeBase = $('ptUpgradeBase');
  ui.towerUpgradeInfo = $('ptTowerUpgradeInfo');
  ui.baseUpgradeInfo = $('ptBaseUpgradeInfo');
  ui.aiBaseMult = $('ptAiBaseMult');
  ui.aiTowerMult = $('ptAiTowerMult');
  ui.aiBaseMultOut = $('ptAiBaseMultOut');
  ui.aiTowerMultOut = $('ptAiTowerMultOut');
  ui.aiHealthInfo = $('ptAiHealthInfo');
  ui.aiDifficulty = $('ptAiDifficulty');
  ui.aiDifficultyInfo = $('ptAiDifficultyInfo');
  ui.adminToggle = $('ptAdminToggle');
  ui.adminPanel = $('ptAdminPanel');
  ui.adminState = $('ptAdminState');
  ui.adminUnlockRow = $('ptAdminUnlockRow');
  ui.adminPassword = $('ptAdminPassword');
  ui.adminUnlock = $('ptAdminUnlock');
  ui.adminError = $('ptAdminError');
  ui.adminExit = $('ptAdminExit');
  ui.chestOverlay = $('ptChestOverlay');
  ui.chestPhase = $('ptChestPhase');
  ui.chestTier = $('ptChestTier');
  ui.chestVisual = $('ptChestVisual');
  ui.chestRolls = $('ptChestRolls');
  ui.chestReward = $('ptChestReward');
  ui.chestClaim = $('ptChestClaim');
  ui.chestParticles = $('ptChestParticles');
  ui.chestStars = $('ptChestStars');
  ui.winOverlay = $('ptWinOverlay');
  ui.winHeadline = $('ptWinHeadline');
  ui.winSubline = $('ptWinSubline');
  ui.winCardSlot = $('ptWinCardSlot');
  ui.winCardReveal = $('ptWinCardReveal');
  ui.winCardLabel = $('ptWinCardLabel');
  ui.winClaim = $('ptWinClaim');
  ui.winRematch = $('ptWinRematch');
  ui.winCrowns = $('ptWinCrowns');
  ui.winStats = $('ptWinStats');
  ui.winAch = $('ptWinAch');
  ui.confetti = $('ptConfetti');
  ui.toasts = $('ptToasts');
  ui.achList = $('ptAchList');
  ui.achCount = $('ptAchCount');
  ui.emoteBtnA = $('ptEmoteBtnA');
  ui.emoteBtnB = $('ptEmoteBtnB');
  ui.emotePanel = $('ptEmotePanel');
  ui.emoteGrid = $('ptEmoteGrid');
  ui.emoteHint = $('ptEmoteHint');
  ui.emoteMute = $('ptEmoteMute');
  ui.findMatch = $('ptFindMatch');
  ui.cancelQueue = $('ptCancelQueue');
  ui.queueStatus = $('ptQueueStatus');
}

function bindCore() {
  bindBoardInput();
  bindEmotes();
  bindLobby();
  bindProgressUi();
  bindAdminUi();
  updateAdminUi();

  const syncModeClass = () => {
    document.body.classList.toggle('mode-ai', (ui.mode?.value || 'pvp') === 'ai');
  };
  ui.mode?.addEventListener('change', syncModeClass);
  syncModeClass();

  ui.start?.addEventListener('click', () => {
    Sound.unlock();
    if (ui.mode?.value === 'online') showOnlineLobby();
    else {
      onlineActive = false;
      if (ui.lobbyPanel) ui.lobbyPanel.hidden = true;
      if (ui.winOverlay) ui.winOverlay.hidden = true;
      setupMatch();
      scrollToBattle();
    }
  });

  ui.resetUpgrades?.addEventListener('click', () => {
    localStorage.removeItem(PROGRESS_KEY);
    state.progress = {
      gold: 800,
      deck: [...STARTER_DECK],
      aiDeck: [...STARTER_DECK],
      collection: {},
      chests: [],
      buildings: { towerLevel: 1, baseLevel: 1 },
      aiHealth: { baseMult: 1, towerMult: 1 },
      aiDifficulty: 'normal',
      stats: freshStats(),
      achievements: {},
      emoteMuted: false,
      seenSpellNews: true
    };
    unlockInitial();
    state.progress.aiDeck = [...AI_DEFAULT_DECK];
    buildEmoteGrid();
    renderAchievements();
    saveProgress();
    renderProgress();
    renderCollection();
    setupMatch();
    writeLog('Progress reset.');
  });
}

// Another tab saved progress (e.g. you changed your deck there). Pick it up here so this
// tab doesn't play with, or later save over, an out-of-date deck.
function syncProgressFromOtherTab(e) {
  if (e.key !== PROGRESS_KEY || !e.newValue || state.admin.active || state.chestOpening) return;
  try { applySavedProgress(JSON.parse(e.newValue)); } catch (_) { return; }
  renderProgress();
  renderCollection();
  renderDecks();
}

function unlockPrototype() {
  if (ui.lockPanel) ui.lockPanel.hidden = true;
  if (ui.content) ui.content.hidden = false;
  loadProgress();
  renderProgress();
  renderCollection();
  arena = ArenaView.create(ui.arena);
  arena.onCue = (cue) => Sound.play(cue === 'double' ? 'double' : 'overtime');
  bindCore();
  renderAchievements();
  if (!state.progress.seenSpellNews) {
    state.progress.seenSpellNews = true;
    saveProgress();
    setTimeout(() => toast('☄️', 'New: Spells!', 'Fire Bomb, Shock and Rocket Rain are in your collection. Add them to your deck.'), 900);
  }
  window.addEventListener('storage', syncProgressFromOtherTab);
  setupMatch();
  requestAnimationFrame(gameLoop);
}

function gameLoop(ts) {
  // Queue the next frame first: a single bad frame must never freeze the whole game
  requestAnimationFrame(gameLoop);
  try {
    gameFrame(ts);
  } catch (err) {
    if (!gameLoop.lastErr || ts - gameLoop.lastErr > 2000) { gameLoop.lastErr = ts; console.error(err); }
  }
}

function gameFrame(ts) {
  const dt = state.lastTick ? Math.min(0.1, (ts - state.lastTick) / 1000) : 0;
  state.lastTick = ts;
  if (onlineActive) {
    interpolateNet();
  } else if (state.viewSource === 'local' && state.match) {
    stepLocalMatch(dt);
    state.view = lerpSnap(state.snapPrev, state.snapCur, state.acc / STEP);
  }
  // Final-seconds countdown ticks
  const v = state.view;
  if (v && v.running && v.timeLeft <= 10 && v.timeLeft > 0) {
    const sec = Math.ceil(v.timeLeft);
    if (sec !== lastTickSecond) { lastTickSecond = sec; Sound.play('tick', sec <= 3); }
  }
  renderStatus();
  renderDecks();
  syncEmoteButtons();
  renderArena();
}

function boot() {
  cacheUi();

  const params = new URLSearchParams(location.search);
  const roomFromUrl = (params.get('room') || '').trim().toUpperCase();

  const launch = () => {
    unlockPrototype();
    if (roomFromUrl) {
      if (ui.mode) ui.mode.value = 'online';
      showOnlineLobby();
      setTimeout(() => joinRoomByCode(roomFromUrl), 350);
    }
  };

  try {
    if (localStorage.getItem(PROTOTYPE_KEY) === 'ok') { launch(); return; }
  } catch (_) {}

  if (roomFromUrl) {
    try { localStorage.setItem(PROTOTYPE_KEY, 'ok'); } catch (_) {}
    launch();
    return;
  }

  const tryUnlock = () => {
    const value = String(ui.password?.value || '');
    if (value !== PROTOTYPE_PASSWORD) {
      if (ui.error) ui.error.hidden = false;
      return;
    }
    try { localStorage.setItem(PROTOTYPE_KEY, 'ok'); } catch (_) {}
    if (ui.error) ui.error.hidden = true;
    unlockPrototype();
  };

  ui.unlock?.addEventListener('click', tryUnlock);
  ui.password?.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryUnlock(); });
}

boot();
