const PROTOTYPE_PASSWORD = '1ydzpU1y!';
const PROTOTYPE_KEY = 'prototype_access_v1';
const PROGRESS_KEY = 'prototype_progress_v4';

const SERVER_URL =
  location.hostname === 'caleb-liu.com' || location.hostname === 'www.caleb-liu.com'
    ? 'https://clash-tanks-server.onrender.com'
    : 'http://localhost:3001';

let socket = null;
let mySide = null;
let onlineActive = false;

const BOARD = {
  laneCount: 3,
  laneHeight: 100,
  spawnA: 6,
  spawnB: 94,
  towerX: { A: 24, B: 76 },
  baseX: { A: 2, B: 98 }
};

const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'champion'];
const RARITY_STYLE = {
  common: { label: 'Common', color: '#88c7ff', copies: 1, gold: 55 },
  rare: { label: 'Rare', color: '#63ffd2', copies: 2, gold: 85 },
  epic: { label: 'Epic', color: '#ffb36c', copies: 3, gold: 130 },
  legendary: { label: 'Legendary', color: '#ffd35f', copies: 5, gold: 210 },
  champion: { label: 'Champion', color: '#ff728f', copies: 7, gold: 300 }
};

const ARCHETYPES = [
  { slug: 'scout', name: 'Scout', icon: '🏎️', rarity: 'common', cost: 2, hp: 58, dmg: 11, range: 8, speed: 27, cd: 0.52, structureMult: 0.9, deployCd: 1.0, style: 'single', proj: 'slug', role: 'flank' },
  { slug: 'brawler', name: 'Brawler', icon: '🚛', rarity: 'common', cost: 4, hp: 146, dmg: 18, range: 9, speed: 13, cd: 0.78, structureMult: 1, deployCd: 1.15, style: 'single', proj: 'slug', role: 'tank' },
  { slug: 'siege', name: 'Siege', icon: '🛞', rarity: 'rare', cost: 6, hp: 98, dmg: 38, range: 18, speed: 8, cd: 1.2, structureMult: 1.6, deployCd: 1.45, style: 'single', proj: 'shell', role: 'siege' },
  { slug: 'guardian', name: 'Guardian', icon: '🛡️', rarity: 'rare', cost: 5, hp: 124, dmg: 10, range: 10, speed: 10, cd: 0.9, structureMult: 1, deployCd: 1.25, style: 'single', proj: 'pulse', role: 'aura' },
  { slug: 'voltbug', name: 'Volt Bug', icon: '⚡', rarity: 'common', cost: 3, hp: 82, dmg: 12, range: 10, speed: 22, cd: 0.66, structureMult: 1, deployCd: 1.0, style: 'double', proj: 'spark', role: 'chain' },
  { slug: 'flarepod', name: 'Flare Pod', icon: '🔥', rarity: 'epic', cost: 4, hp: 84, dmg: 13, range: 16, speed: 11, cd: 0.82, structureMult: 1.1, deployCd: 1.2, style: 'splash', proj: 'flare', role: 'burn' },
  { slug: 'drillcat', name: 'Drill Cat', icon: '🚜', rarity: 'rare', cost: 4, hp: 134, dmg: 21, range: 7, speed: 12, cd: 0.8, structureMult: 1.25, deployCd: 1.15, style: 'single', proj: 'drill', role: 'breaker' },
  { slug: 'raylance', name: 'Ray Lance', icon: '💠', rarity: 'legendary', cost: 5, hp: 100, dmg: 16, range: 15, speed: 12, cd: 0.62, structureMult: 1, deployCd: 1.35, style: 'beam', proj: 'beam', role: 'sniper' },
  { slug: 'mortarfox', name: 'Mortar Fox', icon: '🧨', rarity: 'epic', cost: 6, hp: 96, dmg: 34, range: 20, speed: 7, cd: 1.32, structureMult: 1.55, deployCd: 1.65, style: 'splash', proj: 'mortar', role: 'artillery' },
  { slug: 'ramhog', name: 'Ram Hog', icon: '🐗', rarity: 'rare', cost: 5, hp: 128, dmg: 24, range: 8, speed: 15, cd: 0.9, structureMult: 1.2, deployCd: 1.18, style: 'burst', proj: 'ram', role: 'charge' }
];

const VARIANTS = [
  { suffix: 'Mk-I', hp: 0, dmg: 0, range: 0, speed: 0, cost: 0, cd: 0, deployCd: 0, rarityShift: 0, style: null },
  { suffix: 'Mk-II', hp: 8, dmg: 2, range: 1, speed: 1, cost: 0, cd: -0.03, deployCd: -0.05, rarityShift: 0, style: null },
  { suffix: 'Twin', hp: -4, dmg: 3, range: 2, speed: -1, cost: 1, cd: 0.02, deployCd: 0.03, rarityShift: 1, style: 'double' },
  { suffix: 'Burst', hp: -7, dmg: 4, range: 0, speed: 0, cost: 1, cd: -0.08, deployCd: -0.08, rarityShift: 1, style: 'burst' },
  { suffix: 'Core', hp: 14, dmg: 6, range: 1, speed: -2, cost: 1, cd: 0.08, deployCd: 0.08, rarityShift: 2, style: 'splash' }
];

function rarityShift(base, shift) {
  const i = RARITY_ORDER.indexOf(base);
  return RARITY_ORDER[Math.max(0, Math.min(RARITY_ORDER.length - 1, i + shift))] || base;
}

function buildCards() {
  const cards = [];
  ARCHETYPES.forEach((a) => {
    VARIANTS.forEach((v, idx) => {
      const id = idx === 0 ? a.slug : `${a.slug}-${v.suffix.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      cards.push({
        id,
        name: idx === 0 ? a.name : `${a.name} ${v.suffix}`,
        icon: a.icon,
        rarity: rarityShift(a.rarity, v.rarityShift),
        cost: Math.max(1, Math.min(9, a.cost + v.cost)),
        hp: Math.max(40, a.hp + v.hp),
        dmg: Math.max(6, a.dmg + v.dmg),
        range: Math.max(6, a.range + v.range),
        speed: Math.max(5, a.speed + v.speed),
        cd: Math.max(0.45, a.cd + v.cd),
        deployCd: Math.max(0.7, a.deployCd + v.deployCd),
        structureMult: a.structureMult,
        style: v.style || a.style,
        proj: a.proj,
        role: a.role,
        splash: (v.style === 'splash' || a.style === 'splash') ? 5 : 0,
        ability: { name: 'Overclock Stub', minLevel: 12, minMastery: 40, dmgBoost: 1.05, hpBoost: 1.04 }
      });
    });
  });
  return cards;
}

const CARD_LIBRARY = buildCards();
const CARD_MAP = Object.fromEntries(CARD_LIBRARY.map((c) => [c.id, c]));
const ONLINE_CARD_IDS = ['scout', 'brawler', 'siege', 'guardian'];
const STARTER_DECK = ['scout', 'brawler', 'siege', 'guardian', 'voltbug', 'drillcat', 'ramhog', 'flarepod'];
const MAX_DECK = 8;

const AI_PRESETS = {
  easy: {
    baseMult: 0.85,
    towerMult: 0.85,
    thinkMin: 0.85,
    thinkMax: 1.15,
    strategicChance: 0.42,
    description: 'Easy: slower deploys and weaker structures.'
  },
  normal: {
    baseMult: 1,
    towerMult: 1,
    thinkMin: 0.48,
    thinkMax: 0.58,
    strategicChance: 0.7,
    description: 'Normal: balanced deploy speed and lane targeting.'
  },
  hard: {
    baseMult: 1.2,
    towerMult: 1.18,
    thinkMin: 0.33,
    thinkMax: 0.46,
    strategicChance: 0.84,
    description: 'Hard: faster deploys, better lane focus, tougher HP.'
  },
  insane: {
    baseMult: 1.45,
    towerMult: 1.4,
    thinkMin: 0.22,
    thinkMax: 0.33,
    strategicChance: 0.92,
    description: 'Insane: very fast deploys, aggressive targeting, high HP.'
  },
  custom: {
    baseMult: 1,
    towerMult: 1,
    thinkMin: 0.46,
    thinkMax: 0.62,
    strategicChance: 0.72,
    description: 'Custom: uses your manual HP multipliers.'
  }
};

const state = {
  running: false,
  mode: 'pvp',
  time: 0,
  lastTick: 0,
  aiTimer: 0,
  selectedCard: null,
  winner: null,
  units: [],
  structures: [],
  projectiles: [],
  nextId: 1,
  players: { A: null, B: null },
  chestOpening: false,
  chestSession: null,
  progress: {
    gold: 800,
    deck: [...STARTER_DECK],
    aiDeck: [...STARTER_DECK],
    collection: {},
    chests: [],
    buildings: { towerLevel: 1, baseLevel: 1 },
    aiHealth: { baseMult: 1, towerMult: 1 },
    aiDifficulty: 'normal'
  }
};

const ui = {
  lockPanel: null, content: null, password: null, unlock: null, error: null,
  board: null, units: null, structures: null, projectiles: null,
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
  chestOverlay: null, chestPhase: null, chestTier: null, chestVisual: null, chestRolls: null, chestReward: null, chestClaim: null,
  chestParticles: null,
  chestStars: null
};

function $(id) { return document.getElementById(id); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function enemyOf(owner) { return owner === 'A' ? 'B' : 'A'; }
function laneY(lane) { return lane * BOARD.laneHeight + BOARD.laneHeight / 2; }
function costClass(c) { return c <= 2 ? 'cost-low' : c <= 4 ? 'cost-mid' : c <= 6 ? 'cost-high' : 'cost-max'; }

function cardProgress(id) {
  if (!state.progress.collection[id]) {
    state.progress.collection[id] = { unlocked: false, level: 1, copies: 0, mastery: 0, abilityUnlocked: false };
  }
  return state.progress.collection[id];
}

function unlockInitial() {
  CARD_LIBRARY.forEach((c) => cardProgress(c.id));
  STARTER_DECK.forEach((id) => {
    const p = cardProgress(id);
    p.unlocked = true;
    p.copies += 3;
  });
}

function saveProgress() {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(state.progress)); } catch (_) {}
}

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
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
    }
  } catch (_) {}
  unlockInitial();
  if (!Array.isArray(state.progress.aiDeck) || state.progress.aiDeck.length === 0) {
    state.progress.aiDeck = [...STARTER_DECK];
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
  const card = CARD_MAP[id];
  if (!card) return null;
  const lvl = clamp(level || 1, 1, 14);
  const scale = 1 + (lvl - 1) * 0.075;
  const abilityReady = !!abilityUnlocked && lvl >= card.ability.minLevel && (mastery || 0) >= card.ability.minMastery;
  return {
    ...card,
    hpScaled: Math.round(card.hp * scale * (abilityReady ? card.ability.hpBoost : 1)),
    dmgScaled: +(card.dmg * scale * (abilityReady ? card.ability.dmgBoost : 1)).toFixed(2),
    deployCdScaled: Math.max(0.62, card.deployCd - (lvl - 1) * 0.02),
    abilityReady
  };
}

function deckFor(owner) {
  if (onlineActive) return ONLINE_CARD_IDS;
  if (owner === 'A') return state.progress.deck.filter((id) => cardProgress(id).unlocked).slice(0, MAX_DECK);
  if (state.mode === 'ai') {
    const ai = state.progress.aiDeck.filter((id) => cardProgress(id).unlocked).slice(0, MAX_DECK);
    if (ai.length > 0) return ai;
    const unlocked = CARD_LIBRARY.filter((c) => cardProgress(c.id).unlocked);
    return unlocked.sort((a, b) => a.cost - b.cost).slice(0, MAX_DECK).map((c) => c.id);
  }
  return state.progress.deck.slice(0, MAX_DECK);
}

function createPlayer(id, mode) {
  const b = state.progress.buildings;
  const isB = id === 'B';
  const aiBaseMult = mode === 'ai' && isB ? state.progress.aiHealth.baseMult : 1;
  return {
    id,
    name: isB ? (mode === 'ai' ? 'Enemy AI' : 'Commander B') : 'Commander A',
    baseHpMax: Math.round((1300 + (b.baseLevel - 1) * 120) * aiBaseMult),
    baseHp: Math.round((1300 + (b.baseLevel - 1) * 120) * aiBaseMult),
    energyMax: 10,
    energy: 10,
    energyRegen: 2.35,
    towerDamage: 13 + (b.towerLevel - 1) * 3,
    cooldowns: {}
  };
}

function setupMatch() {
  state.mode = ui.mode?.value || 'pvp';
  state.running = true;
  state.time = 0;
  state.lastTick = performance.now();
  state.aiTimer = 0;
  state.winner = null;
  state.selectedCard = null;
  state.units = [];
  state.structures = [];
  state.projectiles = [];
  state.nextId = 1;
  state.players.A = createPlayer('A', state.mode);
  state.players.B = createPlayer('B', state.mode);

  const keys = [...new Set([...deckFor('A'), ...deckFor('B')])];
  keys.forEach((k) => {
    state.players.A.cooldowns[k] = 0;
    state.players.B.cooldowns[k] = 0;
  });

  for (let lane = 0; lane < BOARD.laneCount; lane += 1) {
    const towerHpBase = 320 + (state.progress.buildings.towerLevel - 1) * 28;
    const towerHpA = towerHpBase;
    const towerHpB = state.mode === 'ai'
      ? Math.round(towerHpBase * state.progress.aiHealth.towerMult)
      : towerHpBase;
    state.structures.push({ id: `tower-A-${lane}`, owner: 'A', lane, x: BOARD.towerX.A, hpMax: towerHpA, hp: towerHpA, kind: 'tower', cd: 0 });
    state.structures.push({ id: `tower-B-${lane}`, owner: 'B', lane, x: BOARD.towerX.B, hpMax: towerHpB, hp: towerHpB, kind: 'tower', cd: 0 });
  }
  state.structures.push({ id: 'base-A', owner: 'A', lane: 1, x: BOARD.baseX.A, hpMax: state.players.A.baseHpMax, hp: state.players.A.baseHp, kind: 'base', cd: 0 });
  state.structures.push({ id: 'base-B', owner: 'B', lane: 1, x: BOARD.baseX.B, hpMax: state.players.B.baseHpMax, hp: state.players.B.baseHp, kind: 'base', cd: 0 });

  renderDecks();
  renderStatus();
  renderStructures();
  renderUnits();
  renderProjectiles();
}

function livingStructures(owner, lane, kind) {
  return state.structures.filter((s) => s.owner === owner && s.hp > 0 && (lane == null || s.lane === lane) && (!kind || s.kind === kind));
}

function findUnitTargets(u) {
  const foe = enemyOf(u.owner);
  const inRange = state.units
    .filter((x) => x.owner === foe && x.lane === u.lane && x.hp > 0)
    .map((x) => ({ t: x, d: Math.abs(x.x - u.x) }))
    .filter((x) => x.d <= u.range)
    .sort((a, b) => a.d - b.d)
    .map((x) => x.t);
  if (inRange.length === 0) return [];
  return u.style === 'double' ? inRange.slice(0, 2) : [inRange[0]];
}

function primaryEnemyStructure(unit) {
  const foe = enemyOf(unit.owner);
  const towers = livingStructures(foe, unit.lane, 'tower');
  if (towers.length > 0) return towers[0];
  return livingStructures(foe, null, 'base')[0] || null;
}

function unitById(id) { return state.units.find((u) => u.id === id) || null; }
function structureById(id) { return state.structures.find((s) => s.id === id) || null; }

function dealDamage(attacker, target, amount) {
  if (!target || target.hp <= 0 || amount <= 0) return;
  target.hp -= amount;
  if (attacker && attacker.owner === 'A') {
    attacker.rewardPool = (attacker.rewardPool || 0) + amount * 0.024;
    if (attacker.rewardPool >= 1) {
      state.progress.gold += Math.floor(attacker.rewardPool);
      attacker.rewardPool = 0;
    }
  }
}

function spawnProjectile(source, target, damage, targetKind) {
  const sx = source.x;
  const sy = laneY(source.lane) + (source.owner === 'A' ? 12 : -12);
  const tx = target.x;
  const ty = laneY(target.lane ?? source.lane);
  const dx = tx - sx;
  const dy = (ty - sy) / 12;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const speed = source.proj === 'beam' ? 170 : source.proj === 'mortar' ? 66 : 104;
  const ttl = dist / speed;

  state.projectiles.push({
    id: `p-${state.nextId++}`,
    owner: source.owner,
    x: sx,
    y: sy,
    vx: dx / ttl,
    vy: dy / ttl,
    ttl,
    style: source.proj || 'slug',
    damage,
    targetId: target.id,
    targetKind,
    sourceId: source.id,
    splash: source.splash || 0
  });
}

function hitProjectile(p) {
  const target = p.targetKind === 'unit' ? unitById(p.targetId) : structureById(p.targetId);
  if (!target || target.hp <= 0) return;
  const attacker = unitById(p.sourceId);
  dealDamage(attacker, target, p.damage);

  if (p.splash > 0 && target.lane != null) {
    state.units.forEach((u) => {
      if (u.hp <= 0 || u.owner !== target.owner || u.id === target.id || u.lane !== target.lane) return;
      if (Math.abs(u.x - target.x) <= p.splash) dealDamage(attacker, u, p.damage * 0.55);
    });
  }
}

function deployUnit(owner, cardId, lane) {
  if (!state.running) return false;
  const p = state.players[owner];
  const card = getCardStats(cardId);
  if (!p || !card) return false;
  if (p.energy < card.cost) return false;
  if ((p.cooldowns[cardId] || 0) > state.time) return false;

  p.energy -= card.cost;
  p.cooldowns[cardId] = state.time + card.deployCdScaled;

  state.units.push({
    id: `u-${state.nextId++}`,
    owner,
    lane,
    cardId,
    icon: card.icon,
    rarity: card.rarity,
    name: card.name,
    hp: card.hpScaled,
    hpMax: card.hpScaled,
    dmg: card.dmgScaled,
    range: card.range,
    speed: card.speed,
    cd: card.cd,
    atkCd: 0,
    x: owner === 'A' ? BOARD.spawnA : BOARD.spawnB,
    style: card.style,
    proj: card.proj,
    splash: card.splash,
    structureMult: card.structureMult,
    rewardPool: 0
  });

  const cp = cardProgress(cardId);
  cp.mastery = (cp.mastery || 0) + 0.25;
  saveProgress();
  return true;
}

function updateEnergy(dt) {
  ['A', 'B'].forEach((id) => {
    const p = state.players[id];
    p.energy = clamp(p.energy + p.energyRegen * dt, 0, p.energyMax);
  });
}

function updateUnits(dt) {
  state.units.forEach((u) => {
    if (u.hp <= 0) return;
    u.atkCd -= dt;

    const targets = findUnitTargets(u);
    if (targets.length > 0) {
      if (u.atkCd <= 0) {
        targets.forEach((t) => spawnProjectile(u, t, u.dmg, 'unit'));
        if (u.style === 'burst') spawnProjectile(u, targets[0], u.dmg * 0.45, 'unit');
        u.atkCd = u.cd;
      }
      return;
    }

    const structure = primaryEnemyStructure(u);
    if (!structure) return;
    const dist = Math.abs(structure.x - u.x);
    if (dist <= u.range) {
      if (u.atkCd <= 0) {
        spawnProjectile(u, structure, u.dmg * u.structureMult, 'structure');
        u.atkCd = u.cd;
      }
    } else {
      const dir = u.owner === 'A' ? 1 : -1;
      u.x += dir * u.speed * dt;
    }
  });

  state.units = state.units.filter((u) => u.hp > 0 && u.x >= -3 && u.x <= 103);
}

function updateProjectiles(dt) {
  state.projectiles.forEach((p) => {
    p.ttl -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.ttl <= 0) hitProjectile(p);
  });
  state.projectiles = state.projectiles.filter((p) => p.ttl > 0);
}

function updateStructures(dt) {
  state.structures.forEach((s) => {
    if (s.hp <= 0) return;
    s.cd -= dt;
    const foe = enemyOf(s.owner);
    let target = null;
    let best = Infinity;
    const range = s.kind === 'base' ? 14 : 22;
    const dmg = s.kind === 'base' ? 17 : state.players[s.owner].towerDamage;

    state.units.forEach((u) => {
      if (u.owner !== foe || u.lane !== s.lane || u.hp <= 0) return;
      const d = Math.abs(u.x - s.x);
      if (d <= range && d < best) { target = u; best = d; }
    });

    if (target && s.cd <= 0) {
      spawnProjectile({ id: s.id, owner: s.owner, lane: s.lane, x: s.x, proj: s.kind === 'base' ? 'pulse' : 'shell', splash: 0 }, target, dmg, 'unit');
      s.cd = s.kind === 'base' ? 0.72 : 0.9;
    }
  });
}

function syncBaseHp() {
  const a = state.structures.find((s) => s.id === 'base-A');
  const b = state.structures.find((s) => s.id === 'base-B');
  state.players.A.baseHp = a ? Math.max(0, a.hp) : 0;
  state.players.B.baseHp = b ? Math.max(0, b.hp) : 0;
}

function awardChest() {
  if (state.progress.chests.length >= 4) return;
  const t = ['wood', 'silver', 'golden'][Math.floor(Math.random() * 3)];
  const ms = t === 'wood' ? 0 : t === 'silver' ? 30000 : 80000;
  state.progress.chests.push({ id: `ch-${Date.now()}-${Math.random()}`, type: t, readyAt: Date.now() + ms });
}

function onVictory(winner) {
  if (!state.running || state.winner) return;
  state.winner = winner;
  state.running = false;
  if (winner === 'A') {
    state.progress.gold += 140;
    awardChest();
    deckFor('A').forEach((id) => { cardProgress(id).mastery += 1; });
    writeLog('You win. +140 gold and a chest earned.');
  } else {
    writeLog('Opponent wins. Press Start Match to rematch.');
  }
  saveProgress();
  renderProgress();
  renderCollection();
}

function updateAi(dt) {
  if (!state.running || state.mode !== 'ai') return;
  const profile = getAiProfile();
  state.aiTimer -= dt;
  if (state.aiTimer > 0) return;
  state.aiTimer = profile.thinkMin + Math.random() * (profile.thinkMax - profile.thinkMin);

  const p = state.players.B;
  const options = deckFor('B').filter((id) => {
    const c = getCardStats(id);
    return c && p.energy >= c.cost && (p.cooldowns[id] || 0) <= state.time;
  });
  if (options.length === 0) return;

  const laneThreat = [0, 0, 0];
  state.units.forEach((u) => {
    if (u.owner !== 'A' || u.hp <= 0) return;
    laneThreat[u.lane] += (100 - u.x) * 0.09 + u.hp * 0.03;
  });

  const lane = Math.random() < profile.strategicChance
    ? laneThreat.indexOf(Math.max(...laneThreat))
    : Math.floor(Math.random() * 3);

  const pick = state.progress.aiDifficulty === 'easy'
    ? options.sort((a, b) => (CARD_MAP[a]?.cost || 0) - (CARD_MAP[b]?.cost || 0))[0]
    : state.progress.aiDifficulty === 'insane'
      ? options.sort((a, b) => (CARD_MAP[b]?.cost || 0) - (CARD_MAP[a]?.cost || 0))[0]
      : options[Math.floor(Math.random() * options.length)];
  deployUnit('B', pick, lane);
}

function update(dt) {
  if (!state.running) return;
  state.time += dt;
  updateEnergy(dt);
  updateAi(dt);
  updateUnits(dt);
  updateStructures(dt);
  updateProjectiles(dt);

  state.structures.forEach((s) => { if (s.hp < 0) s.hp = 0; });
  syncBaseHp();
  if (state.players.A.baseHp <= 0) onVictory('B');
  if (state.players.B.baseHp <= 0) onVictory('A');
}

function renderStatus() {
  const A = state.players.A;
  const B = state.players.B;
  if (!A || !B) return;

  ['A', 'B'].forEach((id) => {
    const p = id === 'A' ? A : B;
    const s = ui.status[id];
    const alive = livingStructures(id, null, 'tower').length;
    s.name.textContent = p.name;
    s.base.textContent = Math.ceil(p.baseHp);
    s.tower.textContent = '⬡'.repeat(alive) + '✕'.repeat(3 - alive);
    s.energy.textContent = p.energy.toFixed(1);
    s.gold.textContent = id === 'A' ? `💰 ${state.progress.gold}` : (state.mode === 'ai' ? 'ENEMY AI' : '—');
    if (ui.baseBars[id]) ui.baseBars[id].style.width = `${clamp((p.baseHp / p.baseHpMax) * 100, 0, 100)}%`;
    if (ui.energyBars[id]) ui.energyBars[id].style.width = `${clamp((p.energy / p.energyMax) * 100, 0, 100)}%`;
  });
}

function cardButton(owner, id) {
  const card = getCardStats(id);
  if (!card) return '';
  const p = state.players[owner];
  const rem = Math.max(0, (p.cooldowns[id] || 0) - state.time);
  const onCd = rem > 0;
  const disabled = !state.running || p.energy < card.cost || onCd;
  const cdPct = onCd ? Math.round((1 - rem / card.deployCdScaled) * 100) : 100;
  const selected = state.selectedCard && state.selectedCard.owner === owner && state.selectedCard.type === id;
  const cp = cardProgress(id);
  return `<button class="card rarity-${card.rarity}" data-owner="${owner}" data-type="${id}" draggable="true" data-disabled="${disabled ? '1' : '0'}" data-selected="${selected ? '1' : '0'}"><span class="card-rarity">${RARITY_STYLE[card.rarity].label}</span><span class="card-icon">${card.icon}</span><span class="card-cost ${costClass(card.cost)}">${card.cost}</span><span class="card-name">${card.name}</span><span class="card-meta">Lv ${cp.level} • ${card.style}</span><span class="card-cd-bar"><i style="width:${cdPct}%"></i></span></button>`;
}

function renderDecks() {
  if (!state.players.A || !state.players.B) return;
  if (onlineActive) {
    const myDeck = mySide === 'A' ? ui.deckA : ui.deckB;
    const oppDeck = mySide === 'A' ? ui.deckB : ui.deckA;
    myDeck.innerHTML = ONLINE_CARD_IDS.map((id) => cardButton(mySide, id)).join('');
    oppDeck.innerHTML = '<div class="note">Opponent is playing…</div>';
    return;
  }

  ui.deckA.innerHTML = deckFor('A').map((id) => cardButton('A', id)).join('');
  ui.deckB.innerHTML = state.mode === 'ai'
    ? '<div class="note">Enemy AI controls this deck in real time.</div>'
    : deckFor('B').map((id) => cardButton('B', id)).join('');
}

function renderStructures() {
  ui.structures.innerHTML = state.structures.map((s) => {
    const y = laneY(s.lane);
    const hp = clamp((s.hp / s.hpMax) * 100, 0, 100);
    const hpNum = `${Math.max(0, Math.ceil(s.hp))}/${s.hpMax}`;
    const team = s.owner === 'A' ? 'team-a' : 'team-b';
    const icon = s.kind === 'base' ? '🏰' : '🗼';
    return `<div class="structure ${team} ${s.kind}" data-alive="${s.hp > 0 ? '1' : '0'}" style="left:${s.x}%;top:${y}px"><span class="structure-icon">${icon}</span><span class="structure-hp-label">${hpNum}</span><span class="hp"><i style="width:${hp}%"></i></span></div>`;
  }).join('');
}

function renderUnits() {
  ui.units.innerHTML = state.units.map((u) => {
    const y = laneY(u.lane) + (u.owner === 'A' ? 14 : -14);
    const hp = clamp((u.hp / u.hpMax) * 100, 0, 100);
    return `<div class="unit team-${u.owner.toLowerCase()} rarity-${u.rarity}" data-type="${u.cardId}" style="left:${u.x}%;top:${y}px"><span class="tank-art">${u.icon}</span><span class="hp"><i style="width:${hp}%"></i></span></div>`;
  }).join('');
}

function renderProjectiles() {
  ui.projectiles.innerHTML = state.projectiles.map((p) => `<div class="projectile ${p.style} team-${p.owner.toLowerCase()}" style="left:${p.x}%;top:${p.y}px"></div>`).join('');
}

function writeLog(msg) { if (ui.log) ui.log.textContent = msg; }

function tryDeploy(lane) {
  if (!state.selectedCard) return;
  if (onlineActive) {
    if (state.selectedCard.owner !== mySide) return;
    socket.emit('deploy', { unit: state.selectedCard.type, lane });
    state.selectedCard = null;
    return;
  }
  const ok = deployUnit(state.selectedCard.owner, state.selectedCard.type, lane);
  if (ok) {
    writeLog(`${state.players[state.selectedCard.owner].name} deployed ${CARD_MAP[state.selectedCard.type].name} in ${['Top', 'Mid', 'Bot'][lane]} lane.`);
    state.selectedCard = null;
  }
}

function bindBoardInput() {
  ui.board.querySelectorAll('.lane').forEach((laneEl) => {
    laneEl.addEventListener('dragover', (e) => { e.preventDefault(); laneEl.dataset.drop = '1'; });
    laneEl.addEventListener('dragleave', () => { laneEl.dataset.drop = '0'; });
    laneEl.addEventListener('drop', (e) => {
      e.preventDefault();
      laneEl.dataset.drop = '0';
      const lane = Number(laneEl.dataset.lane);
      const owner = e.dataTransfer?.getData('text/owner');
      const type = e.dataTransfer?.getData('text/type');
      if (!owner || !type) return;
      if (onlineActive) {
        if (owner !== mySide) return;
        socket.emit('deploy', { unit: type, lane });
        return;
      }
      if (state.mode === 'ai' && owner === 'B') return;
      if (deployUnit(owner, type, lane)) writeLog(`${state.players[owner].name} deployed ${CARD_MAP[type].name}.`);
    });
    laneEl.addEventListener('click', () => {
      tryDeploy(Number(laneEl.dataset.lane));
      renderDecks();
    });
  });

  const onDeckClick = (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    if (card.dataset.disabled === '1') return;
    const owner = card.dataset.owner;
    const type = card.dataset.type;
    if (onlineActive && owner !== mySide) return;
    if (!onlineActive && state.mode === 'ai' && owner === 'B') return;
    state.selectedCard = { owner, type };
    renderDecks();
  };

  ui.deckA.addEventListener('click', onDeckClick);
  ui.deckB.addEventListener('click', onDeckClick);

  document.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.card');
    if (!card || card.dataset.disabled === '1') return;
    const owner = card.dataset.owner;
    if (onlineActive && owner !== mySide) { e.preventDefault(); return; }
    if (!onlineActive && state.mode === 'ai' && owner === 'B') { e.preventDefault(); return; }
    e.dataTransfer?.setData('text/owner', owner);
    e.dataTransfer?.setData('text/type', card.dataset.type || '');
  });
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
  if (!state.chestSession || !ui.chestClaim) return;
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
  if (state.progress.gold < 5000) { writeLog('Need 5000 gold to unlock ability.'); return; }
  state.progress.gold -= 5000;
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
  if (ui.baseUpgradeInfo) {
    const lvl = state.progress.buildings.baseLevel;
    const nowHp = 1300 + (lvl - 1) * 120;
    const nextHp = 1300 + lvl * 120;
    ui.baseUpgradeInfo.textContent = `Base HP: ${nowHp} (next ${nextHp}, +120)`;
  }
  if (ui.towerUpgradeInfo) {
    const lvl = state.progress.buildings.towerLevel;
    const nowHp = 320 + (lvl - 1) * 28;
    const nextHp = 320 + lvl * 28;
    const nowDmg = 13 + (lvl - 1) * 3;
    const nextDmg = 13 + lvl * 3;
    ui.towerUpgradeInfo.textContent = `Tower HP/DMG: ${nowHp} / ${nowDmg} (next ${nextHp} / ${nextDmg})`;
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
    const playerBase = 1300 + (state.progress.buildings.baseLevel - 1) * 120;
    const playerTower = 320 + (state.progress.buildings.towerLevel - 1) * 28;
    const aiBase = Math.round(playerBase * state.progress.aiHealth.baseMult);
    const aiTower = Math.round(playerTower * state.progress.aiHealth.towerMult);
    ui.aiHealthInfo.textContent = `AI Base HP: ${aiBase} | AI Tower HP: ${aiTower}`;
  }
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
    const canAbility = unlocked && !cp.abilityUnlocked && cp.level >= c.ability.minLevel && cp.mastery >= c.ability.minMastery;
    let statLine = 'Locked';
    let nextLine = '';
    if (unlocked) {
      const nowStats = getCardStats(c.id);
      const nextStats = cp.level < 14 ? getCardStatsAtLevel(c.id, cp.level + 1, cp.abilityUnlocked, cp.mastery || 0) : null;
      statLine = `Lv ${cp.level} • HP ${nowStats.hpScaled} • DMG ${Math.round(nowStats.dmgScaled)} • RNG ${nowStats.range} • SPD ${nowStats.speed} • CD ${nowStats.deployCdScaled.toFixed(2)}s`;
      if (nextStats) {
        nextLine = `Next Lv: HP ${nextStats.hpScaled} • DMG ${Math.round(nextStats.dmgScaled)} • CD ${nextStats.deployCdScaled.toFixed(2)}s`;
      }
    }
    return `<article class="collection-card ${unlocked ? '' : 'locked'} ${inDeck ? 'in-deck' : ''}" data-card="${c.id}"><header><strong>${c.icon} ${c.name}</strong><span class="rarity-${c.rarity}">${RARITY_STYLE[c.rarity].label}</span></header><p>${unlocked ? `Copies ${cp.copies} • Mastery ${Math.floor(cp.mastery)}` : 'Locked'}</p><p>${statLine}</p><p>${unlocked ? `Cost ${c.cost} • ${c.style} target • ${c.role}` : 'Unknown stats'}</p><p>${nextLine}</p><div class="collection-actions">${unlocked ? `<button data-select="${c.id}">${inDeck ? 'In Deck' : 'Select'}</button>` : '<button disabled>Locked</button>'}${unlocked ? `<button data-up="${c.id}" ${canUp ? '' : 'disabled'}>Level Up (${need} copies, ${upCost}g)</button>` : ''}${unlocked ? `<button data-ability="${c.id}" ${canAbility ? '' : 'disabled'}>${cp.abilityUnlocked ? 'Ability ✓' : 'Unlock Ability'}</button>` : ''}</div></article>`;
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
  if (socket && socket.connected) return;
  if (socket) { socket.connect(); return; }
  if (typeof io === 'undefined') { writeLog('Socket.io not loaded.'); return; }

  socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });

  socket.on('connect_error', () => {
    if (ui.lobbyStatus) ui.lobbyStatus.textContent = 'Cannot reach game server.';
    writeLog('Server connection failed.');
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
    if (ui.lobbyStatus) ui.lobbyStatus.textContent = `Joined room ${code}. Starting...`;
  });

  socket.on('room_error', ({ msg }) => {
    if (ui.lobbyStatus) ui.lobbyStatus.textContent = `Error: ${msg}`;
  });

  socket.on('match_start', showMatchOnline);
  socket.on('state_update', applyServerState);
  socket.on('match_over', ({ winner }) => handleOnlineVictory(winner));

  socket.on('opponent_left', () => {
    state.running = false;
    onlineActive = false;
    writeLog('Opponent disconnected. Press Start Match.');
  });
}

function joinRoomByCode(code) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) { if (ui.lobbyStatus) ui.lobbyStatus.textContent = 'Enter room code first.'; return; }
  ensureSocket();
  if (!socket) return;
  socket.emit('join_room', { code: c });
  if (ui.lobbyStatus) ui.lobbyStatus.textContent = 'Joining...';
}

function bindLobby() {
  ui.createRoom?.addEventListener('click', () => {
    ensureSocket();
    if (!socket) return;
    socket.emit('create_room');
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
}

function showOnlineLobby() {
  if (ui.lobbyPanel) ui.lobbyPanel.hidden = false;
  if (ui.shareBox) ui.shareBox.hidden = true;
  if (ui.lobbyStatus) ui.lobbyStatus.textContent = 'Ready. Create or join room.';
  writeLog('Online uses balanced starter cards. Collection systems are active in local and AI modes.');
}

function showMatchOnline() {
  onlineActive = true;
  if (ui.lobbyPanel) ui.lobbyPanel.hidden = true;
  if (ui.joinCode) ui.joinCode.value = '';

  state.players.A = { name: mySide === 'A' ? 'You' : 'Opponent', baseHp: 1300, baseHpMax: 1300, energy: 0, energyMax: 10, cooldowns: { scout: 0, brawler: 0, siege: 0, guardian: 0 } };
  state.players.B = { name: mySide === 'B' ? 'You' : 'Opponent', baseHp: 1300, baseHpMax: 1300, energy: 0, energyMax: 10, cooldowns: { scout: 0, brawler: 0, siege: 0, guardian: 0 } };
  state.units = [];
  state.structures = [];
  state.projectiles = [];
  state.running = true;
  state.winner = null;
  state.time = 0;
  state.lastTick = performance.now();

  for (let lane = 0; lane < BOARD.laneCount; lane += 1) {
    state.structures.push({ id: `tower-A-${lane}`, owner: 'A', lane, x: BOARD.towerX.A, hpMax: 320, hp: 320, kind: 'tower' });
    state.structures.push({ id: `tower-B-${lane}`, owner: 'B', lane, x: BOARD.towerX.B, hpMax: 320, hp: 320, kind: 'tower' });
  }
  state.structures.push({ id: 'base-A', owner: 'A', lane: 1, x: BOARD.baseX.A, hpMax: 1300, hp: 1300, kind: 'base' });
  state.structures.push({ id: 'base-B', owner: 'B', lane: 1, x: BOARD.baseX.B, hpMax: 1300, hp: 1300, kind: 'base' });

  writeLog(`Online match started. You are side ${mySide}.`);
  renderDecks();
  renderStatus();
  renderStructures();
}

function applyServerState(serverState) {
  if (!onlineActive) return;
  state.structures = serverState.structures || [];
  state.units = (serverState.units || []).map((u) => {
    const card = CARD_MAP[u.type] || CARD_MAP.scout;
    return { ...u, icon: card.icon, hpMax: u.hpMax, rarity: card.rarity };
  });
  state.running = !!serverState.running;
  state.winner = serverState.winner || null;

  const updateP = (p, s) => {
    if (!p || !s) return;
    p.energy = s.energy;
    p.energyMax = s.energyMax;
    p.baseHp = s.baseHp;
    p.baseHpMax = s.baseHpMax;
    Object.keys(s.cooldownsRemaining || {}).forEach((k) => {
      p.cooldowns[k] = state.time + s.cooldownsRemaining[k];
    });
  };
  updateP(state.players.A, serverState.players?.A);
  updateP(state.players.B, serverState.players?.B);
}

function handleOnlineVictory(winner) {
  onlineActive = false;
  state.running = false;
  state.winner = winner;
  writeLog(winner === mySide ? 'You win online.' : 'Opponent wins online.');
}

function cacheUi() {
  ui.lockPanel = $('ptLockPanel');
  ui.content = $('ptContent');
  ui.password = $('ptPassword');
  ui.unlock = $('ptUnlock');
  ui.error = $('ptError');
  ui.board = $('ptBoard');
  ui.units = $('ptUnits');
  ui.structures = $('ptStructures');
  ui.projectiles = $('ptProjectiles');
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
  ui.chestOverlay = $('ptChestOverlay');
  ui.chestPhase = $('ptChestPhase');
  ui.chestTier = $('ptChestTier');
  ui.chestVisual = $('ptChestVisual');
  ui.chestRolls = $('ptChestRolls');
  ui.chestReward = $('ptChestReward');
  ui.chestClaim = $('ptChestClaim');
  ui.chestParticles = $('ptChestParticles');
  ui.chestStars = $('ptChestStars');
}

function bindCore() {
  bindBoardInput();
  bindLobby();
  bindProgressUi();

  ui.start?.addEventListener('click', () => {
    if (ui.mode?.value === 'online') showOnlineLobby();
    else {
      onlineActive = false;
      if (ui.lobbyPanel) ui.lobbyPanel.hidden = true;
      setupMatch();
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
      aiDifficulty: 'normal'
    };
    unlockInitial();
    saveProgress();
    renderProgress();
    renderCollection();
    setupMatch();
    writeLog('Progress reset.');
  });
}

function unlockPrototype() {
  if (ui.lockPanel) ui.lockPanel.hidden = true;
  if (ui.content) ui.content.hidden = false;
  loadProgress();
  renderProgress();
  renderCollection();
  bindCore();
  setupMatch();
  requestAnimationFrame(gameLoop);
}

function gameLoop(ts) {
  if (!state.lastTick) state.lastTick = ts;
  const dt = clamp((ts - state.lastTick) / 1000, 0, 0.045);
  state.lastTick = ts;
  if (!onlineActive) update(dt);
  else state.time += dt;
  renderStatus();
  renderDecks();
  renderStructures();
  renderUnits();
  renderProjectiles();
  requestAnimationFrame(gameLoop);
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
