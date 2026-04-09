const PF_SAVE_KEY = 'caleb_platformer_meta_v1';

const TILE = 40;
const GRAVITY = 1780;
const TERMINAL_VY = 920;
const BASE_MOVE = 282;
const BASE_JUMP = 600;
const BASE_DASH_FORCE = 8000;
const MAX_DASH_CHARGES = 2;
const DASH_RECHARGE_SEC = 1.15;
const BASE_MAX_HEALTH = 3;
const BASE_LIVES = 3;
const MAX_EQUIPPED_ACCESSORIES = 5;
const LEVEL_COUNT = 180;
const MAP_W = 68;
const MAP_H = 15;

const KEYS = {
  left: false,
  right: false,
  up: false,
  upPressed: false,
  dash: false
};

const el = {
  canvas: document.getElementById('pfCanvas'),
  overlay: document.getElementById('pfOverlay'),
  level: document.getElementById('pfLevel'),
  health: document.getElementById('pfHealth'),
  lives: document.getElementById('pfLives'),
  dashes: document.getElementById('pfDashes'),
  runCoins: document.getElementById('pfRunCoins'),
  wallet: document.getElementById('pfWallet'),
  objective: document.getElementById('pfObjective'),
  status: document.getElementById('pfStatus'),
  modeLabel: document.getElementById('pfModeLabel'),
  accessoryCount: document.getElementById('pfAccessoryCount'),
  modePills: document.getElementById('pfModePills'),
  buffs: document.getElementById('pfBuffs'),
  shop: document.getElementById('pfShop'),
  upgradeList: document.getElementById('pfUpgradeList'),
  cosmeticList: document.getElementById('pfCosmeticList'),
  closeShop: document.getElementById('pfCloseShop')
};

const SHOP = [
  {
    key: 'maxHealth',
    name: 'Hull Plating',
    desc: 'Increase maximum health by +1.',
    baseCost: 45,
    max: 6
  },
  {
    key: 'moveSpeed',
    name: 'Servo Actuators',
    desc: 'Move speed +8% per level.',
    baseCost: 36,
    max: 8
  },
  {
    key: 'jumpPower',
    name: 'Jump Coil',
    desc: 'Jump power +7% per level.',
    baseCost: 42,
    max: 8
  },
  {
    key: 'dashLength',
    name: 'Vector Thruster',
    desc: 'Dash length +12% per level.',
    baseCost: 50,
    max: 7
  },
  {
    key: 'coinBoost',
    name: 'Coin Synthesizer',
    desc: 'Coin value +15% per level.',
    baseCost: 54,
    max: 7
  },
  {
    key: 'tempDuration',
    name: 'Buff Stabilizer',
    desc: 'Temporary power-up duration +12% per level.',
    baseCost: 60,
    max: 6
  },
  {
    key: 'extraLife',
    name: 'Emergency Clone',
    desc: 'Start runs with +1 life per level.',
    baseCost: 80,
    max: 4
  },
  {
    key: 'neoVisor',
    name: 'Neo Visor',
    desc: 'Cosmetic visor. Passive: +3% move speed.',
    baseCost: 95,
    max: 1,
    kind: 'cosmetic'
  },
  {
    key: 'plasmaTrim',
    name: 'Plasma Trim',
    desc: 'Neon body trim. Passive: +4% jump power.',
    baseCost: 110,
    max: 1,
    kind: 'cosmetic'
  },
  {
    key: 'ionTrailSkin',
    name: 'Ion Trail',
    desc: 'Stylized trail effect. Passive: +4% coin value.',
    baseCost: 130,
    max: 1,
    kind: 'cosmetic'
  },
  {
    key: 'crownAntenna',
    name: 'Crown Antenna',
    desc: 'Signal crown accessory. Passive: +0.15s damage invulnerability.',
    baseCost: 145,
    max: 1,
    kind: 'cosmetic'
  },
  {
    key: 'reactorBoots',
    name: 'Reactor Boots',
    desc: 'Glow boots. Passive: +2.5% move speed.',
    baseCost: 90,
    max: 1,
    kind: 'cosmetic'
  },
  {
    key: 'jumpJets',
    name: 'Jump Jets',
    desc: 'Thruster fins. Passive: +3% jump power.',
    baseCost: 98,
    max: 1,
    kind: 'cosmetic'
  },
  {
    key: 'luckyCharm',
    name: 'Lucky Charm',
    desc: 'Sparkle charm. Passive: +3% coin value.',
    baseCost: 102,
    max: 1,
    kind: 'cosmetic'
  },
  {
    key: 'phaseCape',
    name: 'Phase Cape',
    desc: 'Holo cape. Passive: +0.08s invulnerability after hit.',
    baseCost: 118,
    max: 1,
    kind: 'cosmetic'
  },
  {
    key: 'fluxBattery',
    name: 'Flux Battery',
    desc: 'Back battery. Passive: +5% buff duration.',
    baseCost: 124,
    max: 1,
    kind: 'cosmetic'
  },
  {
    key: 'guardianShell',
    name: 'Guardian Shell',
    desc: 'Armor shell. Passive: +1 max health.',
    baseCost: 165,
    max: 1,
    kind: 'cosmetic'
  },
  {
    key: 'magnetHalo',
    name: 'Magnet Halo',
    desc: 'Orbiting ring. Passive: +12% coin magnet radius.',
    baseCost: 132,
    max: 1,
    kind: 'cosmetic'
  },
  {
    key: 'dashGlyph',
    name: 'Dash Glyph',
    desc: 'Arc glyph. Passive: +6% dash length.',
    baseCost: 126,
    max: 1,
    kind: 'cosmetic'
  },
  {
    key: 'starlightMask',
    name: 'Starlight Mask',
    desc: 'Faceplate glow. Passive: +2% move and +2% jump.',
    baseCost: 140,
    max: 1,
    kind: 'cosmetic'
  },
  {
    key: 'vaultKeychain',
    name: 'Vault Keychain',
    desc: 'Trophy keychain. Passive: +2% coin value.',
    baseCost: 112,
    max: 1,
    kind: 'cosmetic'
  },
  {
    key: 'prismOutline',
    name: 'Prism Outline',
    desc: 'Rainbow outline. Passive: +2% move speed.',
    baseCost: 116,
    max: 1,
    kind: 'cosmetic'
  },
  {
    key: 'echoEmitter',
    name: 'Echo Emitter',
    desc: 'Pulse emitter. Passive: +5% particle intensity.',
    baseCost: 92,
    max: 1,
    kind: 'cosmetic'
  }
];

const MODE_INFO = {
  level: {
    name: 'Level',
    objective: 'Finish every sector in order.',
    difficultyMult: 1,
    lifeMult: 1
  },
  endless: {
    name: 'Endless',
    objective: 'Push as many floors as possible.',
    difficultyMult: 1.12,
    lifeMult: 1
  },
  hardcore: {
    name: 'Hardcore',
    objective: 'One life. Three hearts. No extra survivability.',
    difficultyMult: 1.28,
    lifeMult: 1
  },
  chaos: {
    name: 'Chaos',
    objective: 'Dense enemies, extra traps, bigger risk.',
    difficultyMult: 1.45,
    lifeMult: 0.85
  },
  rush: {
    name: 'Rush',
    objective: 'Fast enemies, fast attacks, and heavier coin gate.',
    difficultyMult: 1.38,
    lifeMult: 0.9
  }
};

function cosmeticOwned(key) {
  return Number(game.meta.upgrades[key] || 0) > 0;
}

function accessoryEquipped(key) {
  return Array.isArray(game.meta.equippedAccessories) && game.meta.equippedAccessories.includes(key);
}

function equippedAccessories() {
  return Array.isArray(game.meta.equippedAccessories) ? game.meta.equippedAccessories : [];
}

function sanitizeEquippedAccessories() {
  const cosmetics = SHOP.filter((item) => item.kind === 'cosmetic').map((item) => item.key);
  const owned = new Set(cosmetics.filter((key) => cosmeticOwned(key)));
  const seen = new Set();
  const next = [];
  equippedAccessories().forEach((key) => {
    if (!owned.has(key) || seen.has(key)) return;
    seen.add(key);
    next.push(key);
  });
  game.meta.equippedAccessories = next.slice(0, MAX_EQUIPPED_ACCESSORIES);
}

function toggleAccessoryEquip(key) {
  if (!cosmeticOwned(key)) return;
  if (!Array.isArray(game.meta.equippedAccessories)) game.meta.equippedAccessories = [];

  const current = game.meta.equippedAccessories;
  const idx = current.indexOf(key);
  if (idx >= 0) {
    current.splice(idx, 1);
    saveMeta();
    setStatus('Accessory unequipped.', 1.1);
    renderShop();
    return;
  }

  if (current.length >= MAX_EQUIPPED_ACCESSORIES) {
    setStatus(`Max ${MAX_EQUIPPED_ACCESSORIES} accessories equipped.`, 1.3);
    return;
  }

  current.push(key);
  saveMeta();
  setStatus('Accessory equipped.', 1.1);
  renderShop();
}

function cosmeticBonuses() {
  const b = {
    moveMult: 1,
    jumpMult: 1,
    coinMult: 1,
    dashMult: 1,
    tempMult: 1,
    invulnBonus: 0,
    magnetMult: 1,
    maxHpBonus: 0,
    particleMult: 1
  };

  if (accessoryEquipped('neoVisor')) b.moveMult *= 1.03;
  if (accessoryEquipped('reactorBoots')) b.moveMult *= 1.025;
  if (accessoryEquipped('prismOutline')) b.moveMult *= 1.02;
  if (accessoryEquipped('starlightMask')) b.moveMult *= 1.02;

  if (accessoryEquipped('plasmaTrim')) b.jumpMult *= 1.04;
  if (accessoryEquipped('jumpJets')) b.jumpMult *= 1.03;
  if (accessoryEquipped('starlightMask')) b.jumpMult *= 1.02;

  if (accessoryEquipped('ionTrailSkin')) b.coinMult *= 1.04;
  if (accessoryEquipped('luckyCharm')) b.coinMult *= 1.03;
  if (accessoryEquipped('vaultKeychain')) b.coinMult *= 1.02;

  if (accessoryEquipped('crownAntenna')) b.invulnBonus += 0.15;
  if (accessoryEquipped('phaseCape')) b.invulnBonus += 0.08;

  if (accessoryEquipped('fluxBattery')) b.tempMult *= 1.05;
  if (accessoryEquipped('magnetHalo')) b.magnetMult *= 1.12;
  if (accessoryEquipped('dashGlyph')) b.dashMult *= 1.06;
  if (accessoryEquipped('guardianShell')) b.maxHpBonus += 1;
  if (accessoryEquipped('echoEmitter')) b.particleMult *= 1.05;

  return b;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function buildProceduralLevel(seed, levelNumber, difficultyMult = 1, modeName = 'level') {
  const rng = mulberry32(9137 + seed * 131);
  const levelScale = 1 + levelNumber * 0.011;
  const danger = clamp(levelScale * difficultyMult, 1, 4.6);
  const chaosBoost = modeName === 'chaos' ? 1 : 0;
  const grid = Array.from({ length: MAP_H }, () => Array.from({ length: MAP_W }, () => '.'));

  for (let x = 0; x < MAP_W; x += 1) {
    grid[0][x] = '#';
    grid[MAP_H - 1][x] = '#';
  }
  for (let y = 0; y < MAP_H; y += 1) {
    grid[y][0] = '#';
    grid[y][MAP_W - 1] = '#';
  }

  const safeSet = new Set();
  const markSafe = (x, y) => safeSet.add(`${x},${y}`);

  let x = 2;
  let y = MAP_H - 4 - (seed % 2);
  let prevX = x;
  const segments = [];

  while (x < MAP_W - 6) {
    const lenMax = danger >= 2.4 ? 5 : 6;
    const len = 2 + Math.floor(rng() * lenMax);
    const endX = Math.min(MAP_W - 3, x + len);

    for (let px = x; px <= endX; px += 1) {
      grid[y][px] = '#';
      markSafe(px, y);
      if (rng() < clamp(0.44 - danger * 0.05, 0.14, 0.44) && y - 1 > 1) grid[y - 1][px] = 'C';
    }

    if (rng() < clamp(0.3 + danger * 0.06 + chaosBoost * 0.18, 0.3, 0.9) && endX - x >= 2 && y - 1 > 2) {
      const ex = x + 1 + Math.floor(rng() * (endX - x - 1));
      const enemy = rng() < 0.34 ? 'R' : (rng() < 0.5 ? 'B' : 'G');
      grid[y - 1][ex] = enemy;
    }

    if (rng() < clamp(0.2 - danger * 0.03, 0.07, 0.2) && endX - x >= 2 && y - 1 > 2) {
      const px = x + 1 + Math.floor(rng() * (endX - x - 1));
      const pwr = ['H', 'J', 'V', 'M'][Math.floor(rng() * 4)];
      grid[y - 1][px] = pwr;
    }

    if (rng() < clamp(0.3 + danger * 0.08 + chaosBoost * 0.2, 0.3, 0.96) && endX - x >= 3 && y - 1 > 2) {
      const hx = x + 1 + Math.floor(rng() * (endX - x - 2));
      if (!safeSet.has(`${hx},${y}`)) grid[y][hx] = '^';
    }

    segments.push({ x0: x, x1: endX, y });

    const gap = 2 + Math.floor(rng() * (2 + Math.min(3, Math.floor(danger))));
    const rise = Math.floor(rng() * 5) - 2;
    const boundedRise = clamp(rise, -2, 2);
    x = endX + gap;
    y = clamp(y + boundedRise, 3, MAP_H - 4);

    if (x - prevX > 9) {
      const bridgeY = clamp(y + 1, 3, MAP_H - 4);
      const bridgeX = x - 2;
      grid[bridgeY][bridgeX] = '#';
      markSafe(bridgeX, bridgeY);
    }
    prevX = x;
  }

  // Start and end pads.
  const first = segments[0] || { x0: 2, x1: 6, y: MAP_H - 4 };
  const last = segments[segments.length - 1] || { x0: MAP_W - 8, x1: MAP_W - 3, y: MAP_H - 4 };

  const sx = clamp(first.x0 + 1, 2, MAP_W - 4);
  const sy = clamp(first.y - 1, 1, MAP_H - 3);
  grid[first.y][sx] = '#';
  grid[sy][sx] = 'S';

  const ex = clamp(last.x1 - 1, 2, MAP_W - 3);
  const ey = clamp(last.y - 1, 1, MAP_H - 3);
  grid[last.y][ex] = '#';
  grid[ey][ex] = 'E';

  // Add low-floor danger pools away from spawn/exit.
  const lavaBands = 2 + chaosBoost * 2 + Math.floor(rng() * (2 + Math.min(3, Math.floor(danger))));
  for (let i = 0; i < lavaBands; i += 1) {
    const lx = 6 + Math.floor(rng() * (MAP_W - 16));
    const lw = 2 + Math.floor(rng() * (3 + Math.min(4, Math.floor(danger))));
    for (let j = 0; j < lw; j += 1) {
      const cx = lx + j;
      if (cx <= 1 || cx >= MAP_W - 1) continue;
      if (Math.abs(cx - sx) < 5 || Math.abs(cx - ex) < 5) continue;
      if (grid[MAP_H - 2][cx] === '.') grid[MAP_H - 2][cx] = 'L';
    }
  }

  // Ensure enough coins exist.
  let coinCount = 0;
  for (let ry = 0; ry < MAP_H; ry += 1) {
    for (let rx = 0; rx < MAP_W; rx += 1) {
      if (grid[ry][rx] === 'C') coinCount += 1;
    }
  }
  const minimumCoins = clamp(14 - Math.floor(danger * 2), 7, 14);
  while (coinCount < minimumCoins) {
    const seg = segments[Math.floor(rng() * segments.length)] || first;
    const cx = clamp(seg.x0 + Math.floor(rng() * Math.max(1, seg.x1 - seg.x0 + 1)), 1, MAP_W - 2);
    const cy = clamp(seg.y - 1, 1, MAP_H - 3);
    if (grid[cy][cx] === '.') {
      grid[cy][cx] = 'C';
      coinCount += 1;
    }
  }

  if (modeName === 'chaos' && segments.length > 0) {
    const bonusEnemyDrops = 3 + Math.floor(rng() * 5);
    for (let i = 0; i < bonusEnemyDrops; i += 1) {
      const seg = segments[Math.floor(rng() * segments.length)];
      if (!seg) continue;
      const ex2 = clamp(seg.x0 + 1 + Math.floor(rng() * Math.max(1, seg.x1 - seg.x0)), 1, MAP_W - 2);
      const ey2 = clamp(seg.y - 1, 1, MAP_H - 3);
      if (grid[ey2][ex2] === '.') {
        grid[ey2][ex2] = rng() < 0.35 ? 'R' : (rng() < 0.5 ? 'B' : 'G');
      }
    }

    const bonusTrapDrops = 6 + Math.floor(rng() * 10);
    for (let i = 0; i < bonusTrapDrops; i += 1) {
      const seg = segments[Math.floor(rng() * segments.length)];
      if (!seg) continue;
      const tx = clamp(seg.x0 + 1 + Math.floor(rng() * Math.max(1, seg.x1 - seg.x0)), 1, MAP_W - 2);
      if (grid[seg.y][tx] === '#') grid[seg.y][tx] = '^';
    }
  }

  const map = grid.map((row) => row.join(''));
  const pct = clamp(0.39 + ((seed % 9) * 0.014) + danger * 0.014, 0.42, 0.66);
  return {
    name: `Sector ${String(levelNumber).padStart(3, '0')}`,
    requiredCoinPct: pct,
    map
  };
}

function buildUniqueLevels(total) {
  const levels = [];
  const signatures = new Set();

  for (let i = 0; i < total; i += 1) {
    let attempt = 0;
    let built = null;
    let sig = '';

    while (attempt < 40) {
      built = buildProceduralLevel(i + attempt * total, i + 1, 1, 'level');
      sig = built.map.join('\n');
      if (!signatures.has(sig)) break;
      attempt += 1;
    }

    signatures.add(sig);
    levels.push(built);
  }

  return levels;
}

const LEVELS = buildUniqueLevels(LEVEL_COUNT);

const game = {
  ctx: null,
  mode: 'level',
  activeLevelDef: null,
  levelIndex: 0,
  worldW: 0,
  worldH: 0,
  solids: [],
  lava: [],
  spikes: [],
  coins: [],
  enemies: [],
  enemyShots: [],
  particles: [],
  powerups: [],
  exit: null,
  start: { x: 80, y: 80 },
  camera: { x: 0, y: 0 },
  runCoins: 0,
  collectedCoins: 0,
  totalCoins: 0,
  requiredCoins: 0,
  statusTimer: 0,
  statusText: 'Ready',
  overlayTimer: 0,
  overlayText: '',
  paused: false,
  time: 0,
  state: 'running',
  player: null,
  meta: {
    wallet: 0,
    unlockedLevel: 1,
    mode: 'level',
    endlessSeed: 7321,
    progressByMode: {
      level: 1,
      endless: 1,
      hardcore: 1,
      chaos: 1,
      rush: 1
    },
    equippedAccessories: [],
    upgrades: {
      maxHealth: 0,
      moveSpeed: 0,
      jumpPower: 0,
      coinBoost: 0,
      tempDuration: 0,
      extraLife: 0
    }
  }
};

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function rectsIntersect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function loadMeta() {
  try {
    const raw = localStorage.getItem(PF_SAVE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    game.meta.wallet = Math.max(0, Number(parsed.wallet || 0));
    game.meta.unlockedLevel = clamp(Number(parsed.unlockedLevel || 1), 1, LEVELS.length);
    game.meta.mode = MODE_INFO[parsed.mode] ? parsed.mode : 'level';
    game.mode = game.meta.mode;
    game.meta.endlessSeed = Math.max(1000, Number(parsed.endlessSeed || game.meta.endlessSeed || 7321));

    const defaultProgress = game.meta.progressByMode;
    if (parsed.progressByMode && typeof parsed.progressByMode === 'object') {
      Object.keys(defaultProgress).forEach((modeKey) => {
        const maxLevel = modeKey === 'endless' ? 9999 : LEVELS.length;
        defaultProgress[modeKey] = clamp(Number(parsed.progressByMode[modeKey] || defaultProgress[modeKey]), 1, maxLevel);
      });
    } else {
      defaultProgress.level = clamp(Number(parsed.currentLevel || 1), 1, LEVELS.length);
    }

    if (parsed.upgrades && typeof parsed.upgrades === 'object') {
      // Save migration: preserve progress from older dashDuration upgrade key.
      if (parsed.upgrades.dashLength == null && parsed.upgrades.dashDuration != null) {
        parsed.upgrades.dashLength = parsed.upgrades.dashDuration;
      }
      SHOP.forEach((item) => {
        game.meta.upgrades[item.key] = clamp(Number(parsed.upgrades[item.key] || 0), 0, item.max);
      });
    }

    if (Array.isArray(parsed.equippedAccessories)) {
      game.meta.equippedAccessories = parsed.equippedAccessories.slice(0, MAX_EQUIPPED_ACCESSORIES);
    } else {
      const ownedCosmetics = SHOP
        .filter((item) => item.kind === 'cosmetic' && cosmeticOwned(item.key))
        .map((item) => item.key);
      game.meta.equippedAccessories = ownedCosmetics.slice(0, MAX_EQUIPPED_ACCESSORIES);
    }
    sanitizeEquippedAccessories();
  } catch (_e) {
    // Ignore malformed save.
  }
}

function saveMeta() {
  localStorage.setItem(PF_SAVE_KEY, JSON.stringify(game.meta));
}

function shopCost(item) {
  const lvl = game.meta.upgrades[item.key] || 0;
  return Math.round(item.baseCost * Math.pow(1.42, lvl));
}

function durationScale() {
  const base = 1 + (game.meta.upgrades.tempDuration || 0) * 0.12;
  return base * cosmeticBonuses().tempMult;
}

function coinValue() {
  const base = 1 + (game.meta.upgrades.coinBoost || 0) * 0.15;
  return base * cosmeticBonuses().coinMult;
}

function playerMaxHealth() {
  return BASE_MAX_HEALTH + (game.meta.upgrades.maxHealth || 0) + cosmeticBonuses().maxHpBonus;
}

function playerMoveSpeed() {
  const base = BASE_MOVE * (1 + (game.meta.upgrades.moveSpeed || 0) * 0.08);
  return base * cosmeticBonuses().moveMult;
}

function playerJumpPower() {
  const base = BASE_JUMP * (1 + (game.meta.upgrades.jumpPower || 0) * 0.07);
  return base * cosmeticBonuses().jumpMult;
}

function playerDashLengthMultiplier() {
  const base = 1 + (game.meta.upgrades.dashLength || 0) * 0.12;
  return base * cosmeticBonuses().dashMult;
}

function playerStartLives() {
  return BASE_LIVES + (game.meta.upgrades.extraLife || 0);
}

function currentModeInfo() {
  return MODE_INFO[game.mode] || MODE_INFO.level;
}

function modeDifficultyMultiplier(levelNumber) {
  const modeMult = currentModeInfo().difficultyMult;
  const ramp = 1 + (Math.max(1, levelNumber) - 1) * 0.008;
  return modeMult * ramp;
}

function livesForCurrentMode() {
  const info = currentModeInfo();
  const baseLives = playerStartLives();
  return Math.max(1, Math.round(baseLives * info.lifeMult));
}

function saveModeProgress(levelIndex) {
  const maxIdx = game.mode === 'endless' ? 9998 : (LEVELS.length - 1);
  const idx = clamp(Number(levelIndex || 0), 0, maxIdx);
  game.meta.mode = game.mode;
  if (!game.meta.progressByMode || typeof game.meta.progressByMode !== 'object') {
    game.meta.progressByMode = { level: 1, endless: 1, hardcore: 1, chaos: 1, rush: 1 };
  }
  game.meta.progressByMode[game.mode] = idx + 1;
  saveMeta();
}

function levelCountForMode() {
  return game.mode === 'endless' ? 9999 : LEVELS.length;
}

function getModeLevelDef(levelIndex) {
  if (game.mode === 'endless') {
    const floor = Math.max(1, levelIndex + 1);
    const difficulty = modeDifficultyMultiplier(floor + 30);
    const built = buildProceduralLevel(game.meta.endlessSeed + floor * 23, floor, difficulty, game.mode);
    built.name = `Endless Floor ${String(floor).padStart(3, '0')}`;
    return built;
  }

  if (game.mode === 'chaos' || game.mode === 'rush' || game.mode === 'hardcore') {
    const runLevel = Math.max(1, levelIndex + 1);
    const seed = 400000 + runLevel * 97 + game.mode.charCodeAt(0) * 17;
    const built = buildProceduralLevel(seed, runLevel, modeDifficultyMultiplier(runLevel), game.mode);
    const pctBonus = game.mode === 'rush' ? 0.2 : (game.mode === 'chaos' ? 0.08 : 0.05);
    built.requiredCoinPct = clamp((built.requiredCoinPct || 0.42) + pctBonus, 0.46, 0.88);
    built.name = `${currentModeInfo().name} ${String(runLevel).padStart(3, '0')}`;
    return built;
  }

  const def = LEVELS[clamp(levelIndex, 0, LEVELS.length - 1)];
  return {
    ...def,
    requiredCoinPct: clamp(def.requiredCoinPct || 0.4, 0.35, 0.84),
    name: `${currentModeInfo().name} ${String(levelIndex + 1).padStart(3, '0')}`
  };
}

function applyModeVisualState() {
  if (el.modeLabel) el.modeLabel.textContent = currentModeInfo().name;
  if (!el.modePills) return;
  el.modePills.querySelectorAll('.mode-pill').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === game.mode);
  });
}

function switchMode(modeKey) {
  if (!MODE_INFO[modeKey]) return;
  if (game.mode === modeKey && game.player) return;

  game.mode = modeKey;
  applyModeVisualState();
  setStatus(`${currentModeInfo().name} mode active. ${currentModeInfo().objective}`, 2.8);

  const maxIdx = modeKey === 'endless' ? 9998 : (LEVELS.length - 1);
  const startLevel = clamp(Number(game.meta.progressByMode?.[modeKey] || 1) - 1, 0, maxIdx);
  parseLevel(startLevel, getModeLevelDef(startLevel));
}

function showOverlay(text, duration = 1.4) {
  game.overlayText = text;
  game.overlayTimer = duration;
  if (el.overlay) {
    el.overlay.textContent = text;
    el.overlay.classList.add('show');
  }
}

function setStatus(text, duration = 1.6) {
  game.statusText = text;
  game.statusTimer = duration;
}

function clearLevel() {
  game.solids = [];
  game.lava = [];
  game.spikes = [];
  game.coins = [];
  game.enemies = [];
  game.enemyShots = [];
  game.particles = [];
  game.powerups = [];
  game.exit = null;
}

function addEnemy(type, x, y) {
  const diff = modeDifficultyMultiplier(game.levelIndex + 1);
  const hpBoost = diff >= 1.35 ? 1 : 0;
  const rushMode = game.mode === 'rush';
  const chaosMode = game.mode === 'chaos';
  let speedBoost = 1 + Math.min(0.55, (diff - 1) * 0.28);
  if (rushMode) speedBoost *= 1.28;
  if (chaosMode) speedBoost *= 1.12;

  if (type === 'walker') {
    game.enemies.push({
      type,
      x,
      y,
      w: 28,
      h: 28,
      vx: 90 * speedBoost,
      minX: x - 160,
      maxX: x + 160,
      hp: 2 + hpBoost,
      hurtCd: 0
    });
  } else if (type === 'flyer') {
    game.enemies.push({
      type,
      x,
      y,
      w: 30,
      h: 24,
      baseY: y,
      phase: Math.random() * Math.PI * 2,
      dir: Math.random() < 0.5 ? -1 : 1,
      speed: 70 * speedBoost,
      hp: 2 + hpBoost,
      hurtCd: 0
    });
  } else if (type === 'shooter') {
    game.enemies.push({
      type,
      x,
      y,
      w: 30,
      h: 30,
      fireCd: clamp(1.1 - (diff - 1) * 0.18, 0.58, 1.1),
      hp: 3 + hpBoost,
      hurtCd: 0
    });
  }
}

function parseLevel(index, customDef = null) {
  clearLevel();
  const maxIdx = game.mode === 'endless' ? 9998 : (LEVELS.length - 1);
  game.levelIndex = clamp(index, 0, maxIdx);

  const def = customDef || getModeLevelDef(game.levelIndex);
  game.activeLevelDef = def;
  const rows = def.map;
  game.worldW = rows[0].length * TILE;
  game.worldH = rows.length * TILE;

  rows.forEach((row, ry) => {
    [...row].forEach((ch, rx) => {
      const x = rx * TILE;
      const y = ry * TILE;

      if (ch === '#') game.solids.push({ x, y, w: TILE, h: TILE });
      if (ch === 'L') game.lava.push({ x, y, w: TILE, h: TILE });
      if (ch === '^') game.spikes.push({ x: x + 4, y: y + 12, w: TILE - 8, h: TILE - 12 });
      if (ch === 'C') game.coins.push({ x: x + 10, y: y + 10, w: 20, h: 20, taken: false, bob: Math.random() * Math.PI * 2 });
      if (ch === 'S') game.start = { x: x + 4, y: y + 4 };
      if (ch === 'E') game.exit = { x: x + 4, y: y + 4, w: 32, h: 32 };

      if (ch === 'G') addEnemy('walker', x + 6, y + 8);
      if (ch === 'B') addEnemy('flyer', x + 4, y + 8);
      if (ch === 'R') addEnemy('shooter', x + 5, y + 5);

      if (ch === 'H' || ch === 'J' || ch === 'V' || ch === 'M') {
        game.powerups.push({ x: x + 8, y: y + 8, w: 24, h: 24, code: ch, taken: false, bob: Math.random() * Math.PI * 2 });
      }
    });
  });

  game.totalCoins = game.coins.length;
  if (game.totalCoins <= 0) {
    game.requiredCoins = 0;
  } else {
    const byPercent = Math.ceil(game.totalCoins * def.requiredCoinPct);
    game.requiredCoins = clamp(byPercent, 1, game.totalCoins);
  }
  game.collectedCoins = 0;
  game.runCoins = 0;

  game.player = {
    x: game.start.x,
    y: game.start.y,
    w: 30,
    h: 34,
    vx: 0,
    vy: 0,
    facing: 1,
    onGround: false,
    airJumpsUsed: 0,
    coyote: 0,
    jumpBuffer: 0,
    dashCd: 0,
    dashTime: 0,
    dashCharges: MAX_DASH_CHARGES,
    dashRecharge: 0,
    hp: game.mode === 'hardcore' ? BASE_MAX_HEALTH : playerMaxHealth(),
    maxHp: game.mode === 'hardcore' ? BASE_MAX_HEALTH : playerMaxHealth(),
    lives: game.mode === 'hardcore' ? 1 : livesForCurrentMode(),
    invuln: 0,
    buffs: {
      shield: 0,
      speed: 0,
      jump: 0,
      magnet: 0
    }
  };

  saveModeProgress(game.levelIndex);
  setStatus(`${currentModeInfo().name} ${game.levelIndex + 1}: ${def.name}`, 2.5);
  showOverlay(def.name, 1.4);
}

function levelSolidCollision(rect) {
  for (const tile of game.solids) {
    if (rectsIntersect(rect, tile)) return tile;
  }
  return null;
}

function handleInputDown(e) {
  const key = e.key.toLowerCase();
  if (['arrowleft', 'arrowright', 'arrowup', ' '].includes(key)) e.preventDefault();
  if (key === 'a' || key === 'arrowleft') KEYS.left = true;
  if (key === 'd' || key === 'arrowright') KEYS.right = true;
  if (key === 'w' || key === 'arrowup' || key === ' ') {
    if (!KEYS.up) KEYS.upPressed = true;
    KEYS.up = true;
  }
  if (key === 'shift') KEYS.dash = true;

  if (key === 'r') restartLevel();
  if (key === 'b') toggleShop();
}

function handleInputUp(e) {
  const key = e.key.toLowerCase();
  if (['arrowleft', 'arrowright', 'arrowup', ' '].includes(key)) e.preventDefault();
  if (key === 'a' || key === 'arrowleft') KEYS.left = false;
  if (key === 'd' || key === 'arrowright') KEYS.right = false;
  if (key === 'w' || key === 'arrowup' || key === ' ') {
    KEYS.up = false;
    KEYS.upPressed = false;
  }
  if (key === 'shift') KEYS.dash = false;
}

function applyBuff(code) {
  const scale = durationScale();
  if (code === 'H') {
    game.player.buffs.shield = 10 * scale;
    setStatus('Temp Power-Up: Shield online.', 2);
  } else if (code === 'J') {
    game.player.buffs.jump = 12 * scale;
    setStatus('Temp Power-Up: Jump boost active.', 2);
  } else if (code === 'V') {
    game.player.buffs.speed = 11 * scale;
    setStatus('Temp Power-Up: Speed boost active.', 2);
  } else if (code === 'M') {
    game.player.buffs.magnet = 14 * scale;
    setStatus('Temp Power-Up: Coin magnet active.', 2);
  }
}

function emitParticles(x, y, count, color, speed = 150, life = 0.55, size = 3.5) {
  const pMult = cosmeticBonuses().particleMult;
  const finalCount = Math.max(1, Math.round(count * pMult));
  for (let i = 0; i < finalCount; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.35 + Math.random() * 0.85);
    game.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life,
      maxLife: life,
      size: size * pMult * (0.6 + Math.random() * 0.8),
      color
    });
  }
}

function gainCoin(amount = 1) {
  const value = Math.max(0.01, amount * coinValue());
  game.runCoins += value;
  game.meta.wallet += value;
}

function hurtPlayer(amount = 1) {
  const scaledDamage = Math.max(1, Math.ceil(amount * clamp(currentModeInfo().difficultyMult * 0.92, 1, 2.2)));
  if (game.player.invuln > 0) return;
  if (game.player.buffs.shield > 0) {
    game.player.buffs.shield = Math.max(0, game.player.buffs.shield - 2.4);
    game.player.invuln = 0.45;
    setStatus('Shield absorbed damage.', 0.85);
    return;
  }

  game.player.hp -= scaledDamage;
  game.player.invuln = 1.0 + cosmeticBonuses().invulnBonus;
  game.camera.shakeT = 0.2;
  game.camera.shakeMag = 9;
  emitParticles(game.player.x + game.player.w / 2, game.player.y + game.player.h / 2, 10, '#ff9f9f', 200, 0.45, 3.4);
  setStatus('You took damage!', 0.9);

  if (game.player.hp <= 0) {
    game.player.lives -= 1;
    if (game.player.lives > 0) {
      respawnPlayer();
      setStatus(`Life lost. ${game.player.lives} left.`, 1.5);
    } else {
      game.state = 'gameover';
      showOverlay('Run Failed', 2.2);
      setStatus('Out of lives. Press R to retry this level.', 4);
    }
  }
}

function respawnPlayer() {
  game.player.x = game.start.x;
  game.player.y = game.start.y;
  game.player.vx = 0;
  game.player.vy = 0;
  game.player.airJumpsUsed = 0;
  game.player.dashCharges = MAX_DASH_CHARGES;
  game.player.dashRecharge = 0;
  game.player.hp = game.player.maxHp;
  game.player.invuln = 1.2;
  game.player.trail = [];
}

function restartLevel() {
  parseLevel(game.levelIndex, getModeLevelDef(game.levelIndex));
}

function nextLevel() {
  if (game.mode !== 'endless' && game.levelIndex + 1 >= LEVELS.length) {
    game.state = 'victory';
    showOverlay('Campaign Cleared', 2.8);
    setStatus('You beat all levels. Replay for more wallet coins.', 4);
    return;
  }

  const next = game.levelIndex + 1;
  if (game.mode !== 'endless' && next + 1 > game.meta.unlockedLevel) {
    game.meta.unlockedLevel = next + 1;
    saveMeta();
  }

  parseLevel(next, getModeLevelDef(next));
}

function updatePlayer(dt) {
  const p = game.player;
  if (!p || game.state !== 'running') return;

  p.invuln = Math.max(0, p.invuln - dt);
  p.coyote = Math.max(0, p.coyote - dt);
  p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.dashTime = Math.max(0, p.dashTime - dt);
  p.dashRecharge = Math.max(0, p.dashRecharge - dt);

  p.buffs.shield = Math.max(0, p.buffs.shield - dt);
  p.buffs.speed = Math.max(0, p.buffs.speed - dt);
  p.buffs.jump = Math.max(0, p.buffs.jump - dt);
  p.buffs.magnet = Math.max(0, p.buffs.magnet - dt);

  const moveSpeed = playerMoveSpeed() * (p.buffs.speed > 0 ? 1.45 : 1);
  const jumpPower = playerJumpPower() * (p.buffs.jump > 0 ? 1.28 : 1);
  p.animT = (p.animT || 0) + dt * (Math.abs(p.vx) > 20 ? 11 : 5);
  p.trail = p.trail || [];

  const dir = (KEYS.right ? 1 : 0) - (KEYS.left ? 1 : 0);
  if (dir !== 0) {
    p.vx = clamp(p.vx + dir * 2000 * dt, -moveSpeed, moveSpeed);
    p.facing = dir;
  } else {
    p.vx *= Math.pow(0.0001, dt);
    if (Math.abs(p.vx) < 2) p.vx = 0;
  }

  if (KEYS.upPressed) {
    p.jumpBuffer = 0.14;
    KEYS.upPressed = false;
  }

  if (p.jumpBuffer > 0) {
    const groundedJump = p.onGround || p.coyote > 0;
    const maxAirJumps = p.buffs.jump > 0 ? 2 : 1;
    const airJump = !groundedJump && p.airJumpsUsed < maxAirJumps;

    if (groundedJump || airJump) {
      p.vy = -jumpPower;
      p.onGround = false;
      p.coyote = 0;
      p.jumpBuffer = 0;

      if (groundedJump) {
        p.airJumpsUsed = 0;
        emitParticles(p.x + p.w / 2, p.y + p.h - 2, 7, '#d7f0ff', 120, 0.35, 2.8);
      } else {
        p.airJumpsUsed += 1;
        emitParticles(p.x + p.w / 2, p.y + p.h / 2, 7, '#aef1ff', 130, 0.35, 2.8);
      }
    }
  }

  if (!KEYS.up && p.vy < -120 && p.dashTime <= 0) {
    p.vy += GRAVITY * 1.55 * dt;
  }

  if (KEYS.dash && p.dashCd <= 0 && p.dashCharges > 0) {
    p.dashCd = 0.9;
    p.dashTime = 0.15;
    p.dashCharges -= 1;
    p.dashRecharge = DASH_RECHARGE_SEC;
    p.vx = p.facing * BASE_DASH_FORCE * playerDashLengthMultiplier();
    p.vy *= 0.35;
    emitParticles(p.x + p.w / 2, p.y + p.h / 2, 12, '#95ffe8', 260, 0.35, 3.3);
  }

  if (p.dashTime <= 0) {
    p.vy = Math.min(TERMINAL_VY, p.vy + GRAVITY * dt);
  }

  // Horizontal move and collide.
  p.x += p.vx * dt;
  let hit = levelSolidCollision(p);
  if (hit) {
    if (p.vx > 0) p.x = hit.x - p.w;
    else if (p.vx < 0) p.x = hit.x + hit.w;
    p.vx = 0;
  }

  // Vertical move and collide.
  p.y += p.vy * dt;
  hit = levelSolidCollision(p);
  if (hit) {
    if (p.vy > 0) {
      p.y = hit.y - p.h;
      p.vy = 0;
      p.onGround = true;
      p.airJumpsUsed = 0;
      p.coyote = 0.1;
      if (p.dashCharges < MAX_DASH_CHARGES && p.dashRecharge <= 0) {
        p.dashCharges = MAX_DASH_CHARGES;
      }
    } else if (p.vy < 0) {
      p.y = hit.y + hit.h;
      p.vy = 0;
    }
  } else {
    if (p.onGround) p.coyote = 0.1;
    p.onGround = false;
  }

  // Keep in world.
  p.x = clamp(p.x, 0, game.worldW - p.w);
  if (p.y > game.worldH + 120) {
    hurtPlayer(99);
  }

  // Hazards.
  for (const lava of game.lava) {
    if (rectsIntersect(p, lava)) {
      hurtPlayer(2);
      break;
    }
  }

  for (const spike of game.spikes) {
    if (rectsIntersect(p, spike)) {
      hurtPlayer(1);
      break;
    }
  }

  // Coins and magnet.
  for (const coin of game.coins) {
    if (coin.taken) continue;

    if (p.buffs.magnet > 0) {
      const cx = coin.x + coin.w / 2;
      const cy = coin.y + coin.h / 2;
      const px = p.x + p.w / 2;
      const py = p.y + p.h / 2;
      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < 180 * cosmeticBonuses().magnetMult && dist > 0.1) {
        coin.x += (dx / dist) * 230 * dt;
        coin.y += (dy / dist) * 230 * dt;
      }
    }

    if (rectsIntersect(p, coin)) {
      coin.taken = true;
      game.collectedCoins += 1;
      gainCoin(1);
      emitParticles(coin.x + coin.w / 2, coin.y + coin.h / 2, 9, '#ffd77e', 160, 0.45, 2.8);
      setStatus('Coin collected.', 0.55);
    }
  }

  // Power-ups.
  for (const item of game.powerups) {
    if (item.taken) continue;
    if (rectsIntersect(p, item)) {
      item.taken = true;
      const pColors = { H: '#8af7ff', J: '#89ff9f', V: '#ffd591', M: '#dcb3ff' };
      emitParticles(item.x + item.w / 2, item.y + item.h / 2, 12, pColors[item.code] || '#ffffff', 190, 0.52, 3.2);
      applyBuff(item.code);
    }
  }

  if (p.dashTime > 0 || Math.abs(p.vx) > moveSpeed * 0.65) {
    p.trail.unshift({ x: p.x, y: p.y, life: 0.22 });
  }
  p.trail = p.trail
    .map((t) => ({ ...t, life: t.life - dt }))
    .filter((t) => t.life > 0)
    .slice(0, 8);

  // Exit.
  if (game.exit && rectsIntersect(p, game.exit)) {
    if (game.collectedCoins >= game.requiredCoins) {
      showOverlay('Level Clear', 1.3);
      nextLevel();
    } else {
      setStatus(`Portal locked: ${game.requiredCoins - game.collectedCoins} more coin(s) needed.`, 1);
    }
  }
}

function updateEnemies(dt) {
  if (game.state !== 'running') return;

  for (const e of game.enemies) {
    e.hurtCd = Math.max(0, e.hurtCd - dt);

    if (e.type === 'walker') {
      e.x += e.vx * dt;
      if (e.x < e.minX || e.x > e.maxX) {
        e.vx *= -1;
        e.x = clamp(e.x, e.minX, e.maxX);
      }
    } else if (e.type === 'flyer') {
      e.phase += dt * 2;
      e.x += e.dir * e.speed * dt;
      e.y = e.baseY + Math.sin(e.phase) * 24;
      if (e.x < 0 || e.x + e.w > game.worldW) e.dir *= -1;
    } else if (e.type === 'shooter') {
      e.fireCd -= dt;
      if (e.fireCd <= 0) {
        const rushAttackMult = game.mode === 'rush' ? 0.65 : 1;
        e.fireCd = (1.2 + Math.random() * 0.5) * rushAttackMult;
        const px = game.player.x + game.player.w / 2;
        const py = game.player.y + game.player.h / 2;
        const ex = e.x + e.w / 2;
        const ey = e.y + e.h / 2;
        const dx = px - ex;
        const dy = py - ey;
        const dist = Math.hypot(dx, dy) || 1;
        game.enemyShots.push({
          x: ex,
          y: ey,
          vx: (dx / dist) * 240,
          vy: (dy / dist) * 240,
          r: 5,
          life: 4
        });
      }
    }

    if (rectsIntersect(game.player, e)) {
      const stomp = game.player.vy > 120 && game.player.y + game.player.h - 8 < e.y + e.h * 0.5;
      if (stomp && e.hurtCd <= 0) {
        e.hp -= 1;
        e.hurtCd = 0.3;
        game.player.vy = -420;
        if (e.hp <= 0) {
          e.dead = true;
          gainCoin(3);
          emitParticles(e.x + e.w / 2, e.y + e.h / 2, 12, '#ffb3a6', 220, 0.55, 3.6);
          setStatus('Enemy defeated: +3 coins.', 0.75);
        }
      } else {
        hurtPlayer(1);
      }
    }
  }

  game.enemies = game.enemies.filter((e) => !e.dead);

  for (const shot of game.enemyShots) {
    shot.life -= dt;
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;

    const rect = { x: shot.x - shot.r, y: shot.y - shot.r, w: shot.r * 2, h: shot.r * 2 };
    if (levelSolidCollision(rect)) shot.dead = true;
    if (rectsIntersect(rect, game.player)) {
      shot.dead = true;
      hurtPlayer(1);
    }
    if (shot.life <= 0) shot.dead = true;
  }

  game.enemyShots = game.enemyShots.filter((s) => !s.dead);
}

function updateParticles(dt) {
  for (const pt of game.particles) {
    pt.life -= dt;
    pt.vy += 480 * dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.985;
  }
  game.particles = game.particles.filter((pt) => pt.life > 0);
}

function updateCamera(dt) {
  const p = game.player;
  const viewW = el.canvas.width;
  const viewH = el.canvas.height;
  const targetX = clamp(p.x + p.w / 2 - viewW / 2, 0, Math.max(0, game.worldW - viewW));
  const targetY = clamp(p.y + p.h / 2 - viewH / 2, 0, Math.max(0, game.worldH - viewH));

  game.camera.x += (targetX - game.camera.x) * 0.2;
  game.camera.y += (targetY - game.camera.y) * 0.2;

  if (game.camera.shakeT > 0) {
    game.camera.shakeT = Math.max(0, game.camera.shakeT - dt);
    const amp = game.camera.shakeMag * (game.camera.shakeT / 0.2);
    game.camera.x = clamp(game.camera.x + (Math.random() - 0.5) * amp, 0, Math.max(0, game.worldW - viewW));
    game.camera.y = clamp(game.camera.y + (Math.random() - 0.5) * amp * 0.6, 0, Math.max(0, game.worldH - viewH));
  }
}

function updateHud(dt = 0) {
  if (!game.player) return;
  if (game.mode === 'endless') {
    el.level.textContent = `Floor ${game.levelIndex + 1}`;
  } else {
    el.level.textContent = `${game.levelIndex + 1} / ${levelCountForMode()}`;
  }
  el.health.textContent = `${Math.max(0, game.player.hp)} / ${game.player.maxHp}`;
  el.lives.textContent = game.player.lives;
  if (el.dashes) el.dashes.textContent = `${game.player.dashCharges}/${MAX_DASH_CHARGES}`;
  el.runCoins.textContent = Math.round(game.runCoins);
  el.wallet.textContent = Math.round(game.meta.wallet);
  const modeObj = currentModeInfo().objective;
  el.objective.textContent = `Coins ${game.collectedCoins}/${game.requiredCoins} required (${game.totalCoins} total) | ${modeObj}`;
  el.status.textContent = game.statusText;
  applyModeVisualState();

  const active = [];
  if (game.player.buffs.shield > 0) active.push(`Shield ${game.player.buffs.shield.toFixed(1)}s`);
  if (game.player.buffs.speed > 0) active.push(`Speed ${game.player.buffs.speed.toFixed(1)}s`);
  if (game.player.buffs.jump > 0) active.push(`Jump ${game.player.buffs.jump.toFixed(1)}s`);
  if (game.player.buffs.magnet > 0) active.push(`Magnet ${game.player.buffs.magnet.toFixed(1)}s`);
  SHOP.filter((item) => item.kind === 'cosmetic' && accessoryEquipped(item.key))
    .slice(0, 6)
    .forEach((item) => active.push(`Cosmetic: ${item.name}`));

  if (el.accessoryCount) {
    el.accessoryCount.textContent = `${equippedAccessories().length}/${MAX_EQUIPPED_ACCESSORIES}`;
  }

  el.buffs.innerHTML = active.map((txt) => `<span class="buff-chip">${txt}</span>`).join('');

  if (game.overlayTimer > 0) {
    game.overlayTimer -= dt;
    if (game.overlayTimer <= 0 && el.overlay) el.overlay.classList.remove('show');
  }

  if (game.statusTimer > 0) {
    game.statusTimer -= dt;
    if (game.statusTimer <= 0) game.statusText = 'Running';
  }
}

function drawBackground(ctx) {
  const t = game.time;
  ctx.fillStyle = '#081221';
  ctx.fillRect(0, 0, el.canvas.width, el.canvas.height);

  for (let i = 0; i < 4; i += 1) {
    const y = 140 + i * 90 + Math.sin(t * 0.4 + i) * 10;
    const alpha = 0.1 + i * 0.05;
    ctx.fillStyle = `rgba(102, 170, 255, ${alpha})`;
    ctx.fillRect(-200 - game.camera.x * (0.2 + i * 0.05), y, 2200, 14);
  }
}

function drawWorld(ctx) {
  const cam = game.camera;
  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  // Tiles.
  for (const tile of game.solids) {
    ctx.fillStyle = '#2a4568';
    ctx.fillRect(tile.x, tile.y, tile.w, tile.h);
    ctx.strokeStyle = 'rgba(180, 228, 255, 0.18)';
    ctx.strokeRect(tile.x + 0.5, tile.y + 0.5, tile.w - 1, tile.h - 1);
  }

  // Lava.
  for (const lava of game.lava) {
    const pulse = 0.5 + 0.5 * Math.sin(game.time * 6 + lava.x * 0.02);
    ctx.fillStyle = `rgba(255, 80, 50, ${0.45 + pulse * 0.4})`;
    ctx.fillRect(lava.x, lava.y, lava.w, lava.h);
    ctx.fillStyle = 'rgba(255, 170, 80, 0.45)';
    ctx.fillRect(lava.x, lava.y + 3, lava.w, 6);
  }

  // Spikes.
  for (const s of game.spikes) {
    ctx.fillStyle = '#c8d7e8';
    const count = 4;
    const step = s.w / count;
    for (let i = 0; i < count; i += 1) {
      const bx = s.x + i * step;
      ctx.beginPath();
      ctx.moveTo(bx, s.y + s.h);
      ctx.lineTo(bx + step / 2, s.y);
      ctx.lineTo(bx + step, s.y + s.h);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Coins.
  for (const coin of game.coins) {
    if (coin.taken) continue;
    coin.bob += 0.06;
    const yOff = Math.sin(coin.bob) * 4;
    ctx.fillStyle = '#ffd86f';
    ctx.beginPath();
    ctx.arc(coin.x + coin.w / 2, coin.y + coin.h / 2 + yOff, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 247, 185, 0.7)';
    ctx.beginPath();
    ctx.arc(coin.x + coin.w / 2 - 2, coin.y + coin.h / 2 + yOff - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Power-ups.
  const pColors = { H: '#8af7ff', J: '#89ff9f', V: '#ffd591', M: '#dcb3ff' };
  const pLabels = { H: 'S', J: 'J', V: 'V', M: 'M' };
  for (const p of game.powerups) {
    if (p.taken) continue;
    p.bob += 0.07;
    const yo = Math.sin(p.bob) * 5;
    ctx.fillStyle = pColors[p.code] || '#ffffff';
    ctx.fillRect(p.x, p.y + yo, p.w, p.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.strokeRect(p.x + 0.5, p.y + yo + 0.5, p.w - 1, p.h - 1);
    ctx.fillStyle = '#10243d';
    ctx.font = 'bold 14px Orbitron, sans-serif';
    ctx.fillText(pLabels[p.code] || '?', p.x + 7, p.y + yo + 16);
  }

  // Exit portal.
  if (game.exit) {
    const ready = game.collectedCoins >= game.requiredCoins;
    const c = ready ? '#9affce' : '#5f89bf';
    const pulse = 0.6 + 0.4 * Math.sin(game.time * 5);
    ctx.fillStyle = ready ? `rgba(154, 255, 206, ${0.24 + pulse * 0.3})` : 'rgba(90, 130, 195, 0.33)';
    ctx.beginPath();
    ctx.ellipse(game.exit.x + 16, game.exit.y + 16, 18, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = c;
    ctx.lineWidth = 3;
    ctx.strokeRect(game.exit.x, game.exit.y, game.exit.w, game.exit.h);
    ctx.lineWidth = 1;
  }

  // Enemies.
  for (const e of game.enemies) {
    if (e.type === 'walker') {
      const step = Math.sin(game.time * 13 + e.x * 0.07) * 2.4;
      ctx.fillStyle = '#ff8f7f';
      ctx.fillRect(e.x + 2, e.y + 5, e.w - 4, e.h - 5);
      ctx.fillStyle = '#ffc6bb';
      ctx.fillRect(e.x + 6, e.y + 9, e.w - 12, 4);
      ctx.fillStyle = '#3a111c';
      ctx.fillRect(e.x + 5, e.y + 12, 5, 5);
      ctx.fillRect(e.x + e.w - 10, e.y + 12, 5, 5);
      ctx.fillStyle = '#80222f';
      ctx.fillRect(e.x + 4, e.y + e.h - 5, 7, 4 + step * 0.2);
      ctx.fillRect(e.x + e.w - 11, e.y + e.h - 5, 7, 4 - step * 0.2);
    } else if (e.type === 'flyer') {
      const wing = Math.sin(game.time * 18 + e.phase) * 0.7;
      ctx.fillStyle = '#88bcff';
      ctx.beginPath();
      ctx.ellipse(e.x + e.w / 2, e.y + e.h / 2, e.w / 2, e.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#bfe0ff';
      ctx.beginPath();
      ctx.ellipse(e.x + 6, e.y + 7 + wing, 6, 3, -0.4, 0, Math.PI * 2);
      ctx.ellipse(e.x + e.w - 6, e.y + 7 - wing, 6, 3, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#112338';
      ctx.fillRect(e.x + 9, e.y + 8, 4, 4);
      ctx.fillRect(e.x + e.w - 13, e.y + 8, 4, 4);
    } else if (e.type === 'shooter') {
      const spin = game.time * 2.2;
      ctx.fillStyle = '#e8a8ff';
      ctx.fillRect(e.x + 1, e.y + 1, e.w - 2, e.h - 2);
      ctx.save();
      ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
      ctx.rotate(spin);
      ctx.fillStyle = '#472154';
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = '#ffddff';
      ctx.fillRect(-2, -2, 4, 4);
      ctx.restore();
    }
  }

  for (const shot of game.enemyShots) {
    ctx.fillStyle = '#ffb371';
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, shot.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player (square style + cosmetics).
  const p = game.player;
  for (const t of p.trail || []) {
    const a = t.life / 0.22;
    const trailColor = accessoryEquipped('ionTrailSkin')
      ? `rgba(186, 161, 255, ${0.42 * a})`
      : `rgba(132, 255, 220, ${0.35 * a})`;
    ctx.fillStyle = trailColor;
    ctx.fillRect(t.x + 4, t.y + 4, p.w - 8, p.h - 8);
  }

  ctx.save();
  if (p.invuln > 0) {
    const blink = Math.sin(game.time * 24) > 0 ? 0.35 : 1;
    ctx.globalAlpha = blink;
  }

  const bob = Math.sin((p.animT || 0) * 0.9) * (p.onGround ? 1.1 : 0.2);
  const bodyColor = p.buffs.shield > 0 ? '#9cf5ff' : '#92ffce';
  const trimColor = accessoryEquipped('plasmaTrim') ? '#ffba6e' : '#c9fff0';

  // Core square body.
  ctx.fillStyle = bodyColor;
  ctx.fillRect(p.x + 2, p.y + 2 + bob, p.w - 4, p.h - 4);
  ctx.strokeStyle = 'rgba(9, 35, 54, 0.92)';
  ctx.lineWidth = 2;
  ctx.strokeRect(p.x + 2, p.y + 2 + bob, p.w - 4, p.h - 4);
  ctx.lineWidth = 1;

  // Cool trim and paneling.
  ctx.fillStyle = trimColor;
  ctx.fillRect(p.x + 5, p.y + 5 + bob, p.w - 10, 3);
  ctx.fillRect(p.x + 5, p.y + p.h - 8 + bob, p.w - 10, 3);
  ctx.fillStyle = '#1f3d53';
  ctx.fillRect(p.x + 6, p.y + 11 + bob, p.w - 12, p.h - 20);

  // Face / visor.
  if (accessoryEquipped('neoVisor')) {
    const g = 0.65 + Math.sin(game.time * 9) * 0.35;
    ctx.fillStyle = `rgba(103, 219, 255, ${0.55 + g * 0.3})`;
    ctx.fillRect(p.x + 6, p.y + 11 + bob, p.w - 12, 6);
  } else {
    const eyeX = p.facing > 0 ? p.x + p.w - 12 : p.x + 7;
    ctx.fillStyle = '#072437';
    ctx.fillRect(eyeX, p.y + 11 + bob, 5, 5);
  }

  // Crown antenna cosmetic.
  if (accessoryEquipped('crownAntenna')) {
    ctx.strokeStyle = '#ffe18c';
    ctx.beginPath();
    ctx.moveTo(p.x + p.w / 2, p.y + 2 + bob);
    ctx.lineTo(p.x + p.w / 2, p.y - 7 + bob);
    ctx.stroke();
    ctx.fillStyle = '#ffe18c';
    ctx.beginPath();
    ctx.arc(p.x + p.w / 2, p.y - 9 + bob, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (p.buffs.shield > 0) {
    ctx.strokeStyle = 'rgba(158, 254, 255, 0.75)';
    ctx.beginPath();
    ctx.arc(p.x + p.w / 2, p.y + p.h / 2 + bob, 24, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Particles.
  for (const pt of game.particles) {
    const alpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.fillStyle = `${pt.color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }

  ctx.restore();
}

function render() {
  if (!game.ctx) return;
  drawBackground(game.ctx);
  drawWorld(game.ctx);
}

function toggleShop(forceOpen) {
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : el.shop.hidden;
  el.shop.hidden = !shouldOpen;
  game.paused = shouldOpen;
  if (shouldOpen) {
    renderShop();
    setStatus('Shop open. Buy upgrades.', 999);
  } else {
    setStatus('Running', 0.3);
  }
}

function buyUpgrade(key) {
  const item = SHOP.find((s) => s.key === key);
  if (!item) return;

  const level = game.meta.upgrades[key] || 0;
  if (level >= item.max) return;

  const cost = shopCost(item);
  if (game.meta.wallet < cost) {
    setStatus('Not enough wallet coins.', 0.9);
    return;
  }

  game.meta.wallet -= cost;
  game.meta.upgrades[key] = level + 1;
  if (item.kind === 'cosmetic' && equippedAccessories().length < MAX_EQUIPPED_ACCESSORIES && !accessoryEquipped(key)) {
    game.meta.equippedAccessories.push(key);
    sanitizeEquippedAccessories();
  }
  saveMeta();

  if (game.player) {
    const prevMax = game.player.maxHp;
    game.player.maxHp = playerMaxHealth();
    if (game.player.maxHp > prevMax) {
      game.player.hp = game.player.maxHp;
    }
  }

  renderShop();
  if (item.kind === 'cosmetic') {
    setStatus(`${item.name} cosmetic unlocked.`, 1.3);
  } else {
    setStatus(`${item.name} upgraded to Lv${game.meta.upgrades[key]}.`, 1.3);
  }
}

function renderShop() {
  el.wallet.textContent = Math.round(game.meta.wallet);
  sanitizeEquippedAccessories();
  const equippedCount = equippedAccessories().length;
  const renderItems = (items) => items.map((item) => {
    const lvl = game.meta.upgrades[item.key] || 0;
    const maxed = lvl >= item.max;
    const cost = shopCost(item);
    const disabled = maxed || game.meta.wallet < cost;
    const isCosmetic = item.kind === 'cosmetic';
    const owned = lvl > 0;
    const isEquipped = isCosmetic && accessoryEquipped(item.key);
    const equipDisabled = !owned || (!isEquipped && equippedCount >= MAX_EQUIPPED_ACCESSORIES);
    const equipText = isEquipped ? 'Unequip' : 'Equip';

    return `
      <article class="shop-item">
        <div>
          <strong>${item.name} (Lv ${lvl}/${item.max})${isCosmetic ? ' • Cosmetic' : ''}</strong>
          <p>${item.desc}</p>
        </div>
        <div class="shop-actions">
          <button data-upgrade="${item.key}" ${disabled ? 'disabled' : ''}>
            ${maxed ? 'MAX' : `${isCosmetic ? 'Unlock' : 'Buy'} (${cost})`}
          </button>
          ${isCosmetic ? `<button data-equip="${item.key}" ${equipDisabled ? 'disabled' : ''}>${equipText}</button>` : ''}
        </div>
      </article>
    `;
  }).join('');

  if (el.upgradeList) {
    el.upgradeList.innerHTML = renderItems(SHOP.filter((item) => item.kind !== 'cosmetic'));
  }
  if (el.cosmeticList) {
    el.cosmeticList.innerHTML = renderItems(SHOP.filter((item) => item.kind === 'cosmetic'));
  }
}

function step(dt) {
  if (game.paused) return;
  if (game.state !== 'running') return;

  game.time += dt;
  updatePlayer(dt);
  updateEnemies(dt);
  updateParticles(dt);
  updateCamera(dt);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  step(dt);
  render();
  updateHud(dt);

  requestAnimationFrame(frame);
}

function bindEvents() {
  window.addEventListener('keydown', handleInputDown);
  window.addEventListener('keyup', handleInputUp);

  if (el.modePills) {
    el.modePills.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-mode]');
      if (!btn) return;
      switchMode(btn.dataset.mode);
    });
  }

  if (el.closeShop) {
    el.closeShop.addEventListener('click', () => toggleShop(false));
  }

  if (el.shop) {
    el.shop.addEventListener('click', (event) => {
      const equipBtn = event.target.closest('[data-equip]');
      if (equipBtn) {
        toggleAccessoryEquip(equipBtn.dataset.equip);
        return;
      }
      const btn = event.target.closest('[data-upgrade]');
      if (!btn) return;
      buyUpgrade(btn.dataset.upgrade);
    });
  }

  const touchMap = {
    left: ['left'],
    right: ['right'],
    jump: ['up', 'upPressed'],
    dash: ['dash']
  };

  document.querySelectorAll('[data-touch]').forEach((btn) => {
    const action = btn.getAttribute('data-touch');
    if (!action || !touchMap[action]) return;

    const setState = (isDown) => {
      if (action === 'left') KEYS.left = isDown;
      if (action === 'right') KEYS.right = isDown;
      if (action === 'dash') KEYS.dash = isDown;
      if (action === 'jump') {
        if (isDown && !KEYS.up) KEYS.upPressed = true;
        KEYS.up = isDown;
        if (!isDown) KEYS.upPressed = false;
      }
      btn.classList.toggle('active', isDown);
    };

    btn.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      setState(true);
    });
    btn.addEventListener('pointerup', () => setState(false));
    btn.addEventListener('pointercancel', () => setState(false));
    btn.addEventListener('pointerleave', () => setState(false));
  });
}

function boot() {
  if (!el.canvas) return;

  game.ctx = el.canvas.getContext('2d');
  loadMeta();
  applyModeVisualState();
  bindEvents();

  const startMode = MODE_INFO[game.meta.mode] ? game.meta.mode : 'level';
  game.mode = startMode;
  const maxIdx = startMode === 'endless' ? 9998 : (LEVELS.length - 1);
  const startLevel = clamp(Number(game.meta.progressByMode?.[startMode] || 1) - 1, 0, maxIdx);
  parseLevel(startLevel, getModeLevelDef(startLevel));

  updateCamera(0);
  renderShop();
  updateHud(0);
  requestAnimationFrame(frame);
}

boot();
