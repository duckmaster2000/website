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

// Map tile legend: # solid, L hazard pool, ^ spike, C coin, S start, E exit,
// G walker enemy, B flyer enemy, R shooter enemy, H/J/V/M temp power-ups,
// U spring pad (bouncy floor tile), P horizontal moving platform,
// Q vertical moving platform, X cracked wall (dash through to break).
const LEVELS_PER_BIOME = 30;
const BIOMES = [
  {
    name: 'Astro Ruins',
    accent: '#8dffd8',
    sky: ['#081221', '#0d2334', '#132c3f'],
    cloud: '102, 170, 255',
    tileTop: '#4c7aa8',
    tileBody: '#2a4568',
    tileEdge: 'rgba(180, 228, 255, 0.28)',
    hazardName: 'Coolant Surge',
    hazard1: '255, 80, 50',
    hazard2: '255, 170, 80',
    spike: '#c8d7e8',
    portal: '#9affce'
  },
  {
    name: 'Volcanic Core',
    accent: '#ff9f6e',
    sky: ['#1a0a08', '#301108', '#421709'],
    cloud: '255, 120, 70',
    tileTop: '#8a4a3a',
    tileBody: '#5a2a20',
    tileEdge: 'rgba(255, 190, 130, 0.3)',
    hazardName: 'Molten Lava',
    hazard1: '255, 70, 20',
    hazard2: '255, 200, 60',
    spike: '#ffd7b3',
    portal: '#ffcf8d'
  },
  {
    name: 'Cryo Wastes',
    accent: '#a6e8ff',
    sky: ['#050d18', '#0b1e30', '#123049'],
    cloud: '180, 225, 255',
    tileTop: '#6fa9c9',
    tileBody: '#2d5570',
    tileEdge: 'rgba(210, 245, 255, 0.32)',
    hazardName: 'Cryo Fracture',
    hazard1: '110, 210, 255',
    hazard2: '220, 250, 255',
    spike: '#eafcff',
    portal: '#c7f5ff'
  },
  {
    name: 'Toxic Marsh',
    accent: '#c4ff6e',
    sky: ['#0a1408', '#132110', '#182b14'],
    cloud: '150, 230, 90',
    tileTop: '#5d7a3a',
    tileBody: '#374d24',
    tileEdge: 'rgba(210, 255, 150, 0.28)',
    hazardName: 'Toxic Ooze',
    hazard1: '140, 230, 60',
    hazard2: '90, 255, 170',
    spike: '#dcffb0',
    portal: '#b8ff8a'
  },
  {
    name: 'Void Reaches',
    accent: '#e2a6ff',
    sky: ['#0a0714', '#160a29', '#20103b'],
    cloud: '190, 130, 255',
    tileTop: '#6b4a91',
    tileBody: '#3c2661',
    tileEdge: 'rgba(225, 190, 255, 0.32)',
    hazardName: 'Entropy Rift',
    hazard1: '180, 60, 255',
    hazard2: '255, 90, 220',
    spike: '#f0d6ff',
    portal: '#dcb3ff'
  },
  {
    name: 'Solar Array',
    accent: '#ffe27a',
    sky: ['#140f04', '#2a1e08', '#3a2a0a'],
    cloud: '255, 210, 110',
    tileTop: '#a98a45',
    tileBody: '#6b5323',
    tileEdge: 'rgba(255, 232, 170, 0.32)',
    hazardName: 'Plasma Flare',
    hazard1: '255, 190, 40',
    hazard2: '255, 240, 160',
    spike: '#fff2c8',
    portal: '#ffe89c'
  }
];

function biomeForLevel(levelIndex) {
  const idx = Math.floor(Math.max(0, levelIndex) / LEVELS_PER_BIOME) % BIOMES.length;
  return BIOMES[idx];
}

const KEYS = {
  left: false,
  right: false,
  up: false,
  upPressed: false,
  dash: false,
  grapple: false,
  grapplePressed: false,
  special: false,
  specialPressed: false
};

const el = {
  canvas: document.getElementById('pfCanvas'),
  overlay: document.getElementById('pfOverlay'),
  level: document.getElementById('pfLevel'),
  health: document.getElementById('pfHealth'),
  lives: document.getElementById('pfLives'),
  runCoins: document.getElementById('pfRunCoins'),
  wallet: document.getElementById('pfWallet'),
  objective: document.getElementById('pfObjective'),
  status: document.getElementById('pfStatus'),
  modeLabel: document.getElementById('pfModeLabel'),
  accessoryCount: document.getElementById('pfAccessoryCount'),
  modePills: document.getElementById('pfModePills'),
  buffs: document.getElementById('pfBuffs'),
  biome: document.getElementById('pfBiome'),
  hpBar: document.getElementById('pfHpBar'),
  dashPips: document.getElementById('pfDashPips'),
  coinFill: document.getElementById('pfCoinFill'),
  combo: document.getElementById('pfCombo'),
  comboText: document.getElementById('pfComboText'),
  shop: document.getElementById('pfShop'),
  upgradeList: document.getElementById('pfUpgradeList'),
  cosmeticList: document.getElementById('pfCosmeticList'),
  closeShop: document.getElementById('pfCloseShop'),
  toasts: document.getElementById('pfToasts'),
  muteBtn: document.getElementById('pfMuteBtn'),
  pauseBtn: document.getElementById('pfPauseBtn'),
  achBtn: document.getElementById('pfAchBtn'),
  achBadge: document.getElementById('pfAchBadge'),
  biomeTrack: document.getElementById('pfBiomeTrack'),
  pauseModal: document.getElementById('pfPauseModal'),
  pauseStats: document.getElementById('pfPauseStats'),
  resumeBtn: document.getElementById('pfResumeBtn'),
  pauseRestart: document.getElementById('pfPauseRestart'),
  settingSound: document.getElementById('pfSettingSound'),
  settingShake: document.getElementById('pfSettingShake'),
  settingParticles: document.getElementById('pfSettingParticles'),
  achModal: document.getElementById('pfAchModal'),
  achProgress: document.getElementById('pfAchProgress'),
  achList: document.getElementById('pfAchList'),
  closeAch: document.getElementById('pfCloseAch'),
  bossBar: document.getElementById('pfBossBar'),
  bossName: document.getElementById('pfBossName'),
  bossHpFill: document.getElementById('pfBossHpFill'),
  minimap: document.getElementById('pfMinimap'),
  styleFill: document.getElementById('pfStyleFill'),
  styleLabel: document.getElementById('pfStyleLabel'),
  loadoutBtn: document.getElementById('pfLoadoutBtn'),
  loadoutModal: document.getElementById('pfLoadoutModal'),
  classGrid: document.getElementById('pfClassGrid'),
  closeLoadout: document.getElementById('pfCloseLoadout'),
  vaultBtn: document.getElementById('pfVaultBtn'),
  vaultModal: document.getElementById('pfVaultModal'),
  vaultCrate: document.getElementById('pfVaultCrate'),
  vaultResult: document.getElementById('pfVaultResult'),
  openVaultBtn: document.getElementById('pfOpenVault'),
  vaultCount: document.getElementById('pfVaultCount'),
  closeVault: document.getElementById('pfCloseVault'),
  relicModal: document.getElementById('pfRelicModal'),
  relicGrid: document.getElementById('pfRelicGrid'),
  skipRelic: document.getElementById('pfSkipRelic')
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

const CLASSES = {
  scout: {
    name: 'Scout',
    desc: 'Light and fast, built for momentum and gaps.',
    moveMult: 1.12,
    jumpMult: 1.0,
    dashMult: 1.15,
    maxHpDelta: 0,
    extraAirJump: 0,
    special: 'Blink',
    specialDesc: 'Instantly dash forward to the nearest open ground.',
    specialCooldown: 6
  },
  tank: {
    name: 'Tank',
    desc: 'Slower but tougher, hits like a truck.',
    moveMult: 0.92,
    jumpMult: 0.95,
    dashMult: 0.85,
    maxHpDelta: 2,
    extraAirJump: 0,
    special: 'Ground Pound',
    specialDesc: 'Slam down, stomping every enemy below you.',
    specialCooldown: 5
  },
  ninja: {
    name: 'Ninja',
    desc: 'An extra air jump and a quicker dash.',
    moveMult: 1.05,
    jumpMult: 1.1,
    dashMult: 1.2,
    maxHpDelta: 0,
    extraAirJump: 1,
    special: 'Shadow Step',
    specialDesc: 'Brief invulnerability with a burst of speed.',
    specialCooldown: 8
  },
  pyro: {
    name: 'Pyro',
    desc: 'Fragile, but explosive up close.',
    moveMult: 1.0,
    jumpMult: 1.0,
    dashMult: 1.0,
    maxHpDelta: -1,
    extraAirJump: 0,
    special: 'Fire Nova',
    specialDesc: 'Radial blast that damages nearby enemies.',
    specialCooldown: 7
  }
};

function currentClass() {
  return CLASSES[game.meta.loadout] || CLASSES.scout;
}

const RELICS = [
  { key: 'glassCannon', name: 'Glass Cannon', desc: '+40% coin value, -1 max HP.' },
  { key: 'momentum', name: 'Momentum', desc: '+15% move speed while a combo is active.' },
  { key: 'vampiric', name: 'Vampiric', desc: 'Heal 1 HP every 10 enemies stomped.' },
  { key: 'secondWind', name: 'Second Wind', desc: '+1 extra life for this run.' },
  { key: 'coinRush', name: 'Coin Rush', desc: '+25% coin value, but hazards deal +1 damage.' },
  { key: 'ironSkin', name: 'Iron Skin', desc: '+2 max HP, -10% move speed.' },
  { key: 'featherweight', name: 'Featherweight', desc: '+20% jump power, -1 max HP.' },
  { key: 'adrenaline', name: 'Adrenaline', desc: '+15% move and dash speed for 5s after taking damage.' },
  { key: 'luckyDraw', name: 'Lucky Draw', desc: '30% chance for double coins on pickup.' },
  { key: 'overcharge', name: 'Overcharge', desc: 'Dash recharges 35% faster.' }
];

function hasRelic(key) {
  return game.runRelics.includes(key);
}

const WEATHER_TYPES = [
  { name: 'Meteor Shower', kind: 'fall', color: '255, 140, 90' },
  { name: 'Ash Fall', kind: 'fall', color: '255, 110, 60' },
  { name: 'Blizzard Gust', kind: 'wind', color: '190, 230, 255' },
  { name: 'Spore Cloud', kind: 'cloud', color: '150, 230, 90' },
  { name: 'Gravity Flux', kind: 'wind', color: '190, 130, 255' },
  { name: 'Solar Flare', kind: 'fall', color: '255, 210, 110' }
];

function weatherForBiome(biomeIdx) {
  return WEATHER_TYPES[biomeIdx % WEATHER_TYPES.length];
}

const BOSSES = [
  { name: 'Ruin Sentinel', color: '#7fb3ff', core: '#1c3450' },
  { name: 'Magma Titan', color: '#ff8a5c', core: '#4a1c10' },
  { name: 'Cryo Warden', color: '#9fe6ff', core: '#123244' },
  { name: 'Bog Behemoth', color: '#a6e26a', core: '#1f3612' },
  { name: 'Void Wraith', color: '#c58cff', core: '#2a1240' },
  { name: 'Solar Cannon', color: '#ffdb7a', core: '#402c08' }
];

function isBossLevel(levelIndex) {
  return game.mode === 'level' && (levelIndex + 1) % LEVELS_PER_BIOME === 0;
}

function bossForLevel(levelIndex) {
  const biomeIdx = Math.floor(levelIndex / LEVELS_PER_BIOME) % BOSSES.length;
  return BOSSES[biomeIdx];
}

function buildBossArena(levelIndex) {
  const grid = Array.from({ length: MAP_H }, () => Array.from({ length: MAP_W }, () => '.'));
  for (let x = 0; x < MAP_W; x += 1) {
    grid[0][x] = '#';
    grid[MAP_H - 1][x] = '#';
  }
  for (let y = 0; y < MAP_H; y += 1) {
    grid[y][0] = '#';
    grid[y][MAP_W - 1] = '#';
  }

  const floorY = MAP_H - 4;
  for (let x = 2; x < MAP_W - 2; x += 1) grid[floorY][x] = '#';
  for (let x = 14; x < 20; x += 1) grid[floorY - 3][x] = '#';
  for (let x = MAP_W - 20; x < MAP_W - 14; x += 1) grid[floorY - 3][x] = '#';

  grid[floorY - 1][4] = 'S';
  grid[floorY - 1][MAP_W - 5] = 'E';

  for (let i = 0; i < 6; i += 1) {
    const cx = 8 + i * 8;
    if (grid[floorY - 1][cx] === '.') grid[floorY - 1][cx] = 'C';
  }

  const map = grid.map((row) => row.join(''));
  const bossInfo = bossForLevel(levelIndex);
  return {
    name: `${bossInfo.name} Arena`,
    requiredCoinPct: 0,
    map,
    isBoss: true
  };
}

function spawnBoss(levelIndex) {
  const bossInfo = bossForLevel(levelIndex);
  const diff = 1 + Math.floor(levelIndex / LEVELS_PER_BIOME) * 0.35;
  const homeX = game.worldW - 220;
  const homeY = (MAP_H - 7) * TILE - 40;
  game.boss = {
    name: bossInfo.name,
    color: bossInfo.color,
    core: bossInfo.core,
    x: homeX,
    y: homeY,
    w: 70,
    h: 70,
    hp: Math.round(20 * diff),
    maxHp: Math.round(20 * diff),
    vx: 0,
    phase: 0,
    attackTimer: 1.8,
    state: 'idle',
    stateT: 0,
    telegraphed: false,
    dead: false,
    hurtCd: 0,
    homeX,
    homeY
  };
  if (el.bossBar) {
    el.bossBar.hidden = false;
    if (el.bossName) el.bossName.textContent = bossInfo.name;
    if (el.bossHpFill) el.bossHpFill.style.width = '100%';
  }
  showOverlay(bossInfo.name, 2, 'Boss Battle - stomp it and defeat it to unlock the portal');
}

function damageBoss(n) {
  const boss = game.boss;
  if (!boss || boss.dead) return;
  boss.hp -= n;
  boss.hurtCd = 0.4;
  sfx.bossHit();
  emitParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, 8, '#ffdede', 160, 0.4, 3);
  if (game.meta.settings.screenShake) {
    game.camera.shakeT = 0.1;
    game.camera.shakeMag = 4;
  }
  if (boss.hp <= 0) {
    boss.dead = true;
    const biomeIdx = Math.floor(game.levelIndex / LEVELS_PER_BIOME) % BOSSES.length;
    if (!game.meta.stats.bossesDefeated.includes(biomeIdx)) {
      game.meta.stats.bossesDefeated.push(biomeIdx);
    }
    checkAchievements();
    saveMeta();
    sfx.bossDefeat();
    vibrate([50, 60, 50, 60, 120]);
    const reward = 80 + biomeIdx * 20;
    game.meta.wallet += reward;
    game.runCoins += reward;
    emitParticles(boss.x + boss.w / 2, boss.y + boss.h / 2, 40, '#ffe27a', 300, 0.9, 5);
    spawnPopup(boss.x + boss.w / 2, boss.y - 10, `+${reward} coins!`, '#ffe27a');
    showToast('skull', 'Boss Defeated', `${boss.name} destroyed! +${reward} coins`);
    setStatus(`${boss.name} defeated! Portal unlocked.`, 3);
    if (el.bossBar) el.bossBar.hidden = true;
  }
}

function updateBoss(dt) {
  const boss = game.boss;
  if (!boss || boss.dead || game.state !== 'running') return;
  const p = game.player;
  boss.hurtCd = Math.max(0, boss.hurtCd - dt);
  boss.phase += dt;
  boss.attackTimer -= dt;

  if (boss.state === 'idle') {
    const targetY = boss.homeY + Math.sin(boss.phase * 1.4) * 18;
    boss.y += (targetY - boss.y) * Math.min(1, dt * 2);
    if (boss.attackTimer <= 0) {
      const patterns = ['charge', 'burst', 'slam'];
      boss.state = patterns[Math.floor(Math.random() * patterns.length)];
      boss.stateT = 0;
      boss.telegraphed = false;
    }
  } else if (boss.state === 'charge') {
    boss.stateT += dt;
    if (boss.stateT < 0.6) {
      boss.x = boss.homeX + Math.sin(boss.stateT * 40) * 3;
    } else if (boss.stateT < 1.4) {
      const dir = p && p.x < boss.x ? -1 : 1;
      boss.vx = dir * 620;
      boss.x = clamp(boss.x + boss.vx * dt, TILE, game.worldW - TILE - boss.w);
    } else {
      boss.vx = 0;
      boss.state = 'idle';
      boss.attackTimer = 1.8;
    }
  } else if (boss.state === 'burst') {
    boss.stateT += dt;
    if (boss.stateT > 0.7 && !boss.telegraphed) {
      boss.telegraphed = true;
      const bx = boss.x + boss.w / 2;
      const by = boss.y + boss.h / 2;
      const count = 10;
      for (let i = 0; i < count; i += 1) {
        const a = (i / count) * Math.PI * 2;
        game.enemyShots.push({ x: bx, y: by, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, r: 6, life: 3 });
      }
      sfx.bossHit();
    }
    if (boss.stateT > 1.2) {
      boss.state = 'idle';
      boss.attackTimer = 2.2;
    }
  } else if (boss.state === 'slam') {
    boss.stateT += dt;
    if (boss.stateT < 0.5) {
      boss.y -= 220 * dt;
    } else if (boss.stateT < 0.9) {
      // Hang at apex before slamming down.
    } else if (boss.stateT < 1.3) {
      boss.y += 900 * dt;
    } else if (!boss.telegraphed) {
      boss.telegraphed = true;
      if (game.meta.settings.screenShake) {
        game.camera.shakeT = 0.3;
        game.camera.shakeMag = 12;
      }
      emitParticles(boss.x + boss.w / 2, boss.y + boss.h, 20, '#ffb37a', 240, 0.5, 4);
      const cx = boss.x + boss.w / 2;
      const cy = boss.y + boss.h;
      if (p && Math.hypot((p.x + p.w / 2) - cx, (p.y + p.h / 2) - cy) < 190) hurtPlayer(1);
      boss.y = boss.homeY;
      boss.state = 'idle';
      boss.attackTimer = 2;
    }
  }

  if (p && rectsIntersect(p, boss)) {
    const stomp = p.vy > 120 && p.y + p.h - 10 < boss.y + boss.h * 0.35;
    if (stomp && boss.hurtCd <= 0) {
      damageBoss(1);
      p.vy = -420;
    } else if (boss.hurtCd <= 0) {
      hurtPlayer(1);
    }
  }
}

function drawBoss(ctx) {
  const boss = game.boss;
  if (!boss || boss.dead) return;
  const pulse = 0.6 + 0.4 * Math.sin(game.time * 4);
  ctx.fillStyle = boss.core;
  ctx.fillRect(boss.x, boss.y, boss.w, boss.h);
  ctx.fillStyle = boss.color;
  ctx.fillRect(boss.x + 6, boss.y + 6, boss.w - 12, boss.h - 12);
  ctx.fillStyle = `rgba(255,255,255,${0.4 + pulse * 0.3})`;
  ctx.beginPath();
  ctx.arc(boss.x + boss.w / 2, boss.y + boss.h / 2, 10 + pulse * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(boss.x + 0.5, boss.y + 0.5, boss.w - 1, boss.h - 1);
  ctx.lineWidth = 1;
}

const audioState = { ctx: null };

function ensureAudioCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioState.ctx) audioState.ctx = new AC();
  if (audioState.ctx.state === 'suspended') audioState.ctx.resume();
  return audioState.ctx;
}

function playTone({ freq = 440, type = 'sine', duration = 0.12, volume = 0.16, slideTo = null, delay = 0 }) {
  if (game.meta.settings.muted) return;
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + duration);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.03);
}

const sfx = {
  jump: () => playTone({ freq: 520, type: 'square', duration: 0.09, volume: 0.13, slideTo: 760 }),
  dash: () => playTone({ freq: 220, type: 'sawtooth', duration: 0.14, volume: 0.12, slideTo: 60 }),
  coin: () => playTone({ freq: 880, type: 'square', duration: 0.09, volume: 0.11, slideTo: 1320 }),
  hit: () => playTone({ freq: 160, type: 'sawtooth', duration: 0.18, volume: 0.17, slideTo: 55 }),
  enemyDown: () => playTone({ freq: 320, type: 'square', duration: 0.15, volume: 0.13, slideTo: 110 }),
  spring: () => playTone({ freq: 300, type: 'sine', duration: 0.2, volume: 0.16, slideTo: 920 }),
  powerup: () => {
    playTone({ freq: 440, type: 'triangle', duration: 0.12, volume: 0.13, slideTo: 660 });
    playTone({ freq: 660, type: 'triangle', duration: 0.12, volume: 0.11, slideTo: 880, delay: 0.06 });
  },
  portal: () => {
    playTone({ freq: 440, type: 'sine', duration: 0.3, volume: 0.13, slideTo: 880 });
    playTone({ freq: 660, type: 'sine', duration: 0.3, volume: 0.11, slideTo: 1100, delay: 0.08 });
  },
  achievement: () => {
    playTone({ freq: 520, type: 'triangle', duration: 0.14, volume: 0.14, slideTo: 780 });
    playTone({ freq: 780, type: 'triangle', duration: 0.18, volume: 0.12, slideTo: 1040, delay: 0.1 });
  },
  shop: () => playTone({ freq: 500, type: 'triangle', duration: 0.1, volume: 0.12, slideTo: 700 }),
  grapple: () => playTone({ freq: 700, type: 'sine', duration: 0.1, volume: 0.11, slideTo: 1100 }),
  grappleLatch: () => playTone({ freq: 900, type: 'square', duration: 0.06, volume: 0.1, slideTo: 900 }),
  special: () => {
    playTone({ freq: 300, type: 'square', duration: 0.1, volume: 0.15, slideTo: 500 });
    playTone({ freq: 500, type: 'square', duration: 0.14, volume: 0.13, slideTo: 800, delay: 0.05 });
  },
  bossHit: () => playTone({ freq: 220, type: 'square', duration: 0.1, volume: 0.14, slideTo: 140 }),
  bossDefeat: () => {
    playTone({ freq: 200, type: 'sawtooth', duration: 0.4, volume: 0.18, slideTo: 40 });
    playTone({ freq: 500, type: 'triangle', duration: 0.4, volume: 0.14, slideTo: 900, delay: 0.15 });
  },
  vault: () => {
    playTone({ freq: 300, type: 'triangle', duration: 0.18, volume: 0.13, slideTo: 600 });
    playTone({ freq: 600, type: 'triangle', duration: 0.22, volume: 0.13, slideTo: 1200, delay: 0.12 });
  },
  relic: () => playTone({ freq: 500, type: 'sine', duration: 0.2, volume: 0.13, slideTo: 900 }),
  trick: () => playTone({ freq: 700, type: 'triangle', duration: 0.1, volume: 0.1, slideTo: 1000 })
};

function vibrate(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (_e) {
    // Ignore unsupported vibration API.
  }
}

const ACHIEVEMENTS = [
  { key: 'first_steps', name: 'First Steps', desc: 'Clear your first sector.', check: (s) => s.levelsCleared >= 1 },
  { key: 'coin_collector', name: 'Coin Collector', desc: 'Collect 250 lifetime coins.', check: (s) => s.totalCoins >= 250 },
  { key: 'coin_hoarder', name: 'Coin Hoarder', desc: 'Collect 2500 lifetime coins.', check: (s) => s.totalCoins >= 2500 },
  { key: 'combo_starter', name: 'Chain Reaction', desc: 'Reach a x2 combo multiplier.', check: (s) => s.maxComboMult >= 2 },
  { key: 'combo_master', name: 'Combo Master', desc: 'Reach the max x3 combo multiplier.', check: (s) => s.maxComboMult >= 2.95 },
  { key: 'untouchable', name: 'Untouchable', desc: 'Clear a sector without taking damage.', check: (s) => s.noHitClears >= 1 },
  { key: 'speedrunner', name: 'Speedrunner', desc: 'Clear a sector in under 20 seconds.', check: (s) => s.fastestClear > 0 && s.fastestClear <= 20 },
  { key: 'dasher', name: 'Vector Ace', desc: 'Dash 100 times.', check: (s) => s.totalDashes >= 100 },
  { key: 'exterminator', name: 'Exterminator', desc: 'Defeat 100 enemies.', check: (s) => s.enemiesDefeated >= 100 },
  { key: 'biome_hopper', name: 'Biome Hopper', desc: 'Reach a second biome.', check: (s) => s.biomesVisited.length >= 2 },
  { key: 'globe_trotter', name: 'Globe Trotter', desc: 'Reach every biome.', check: (s) => s.biomesVisited.length >= BIOMES.length },
  { key: 'survivor', name: 'Survivor', desc: 'Lose 25 lives total. Keep going.', check: (s) => s.totalDeaths >= 25 },
  { key: 'big_spender', name: 'Big Spender', desc: 'Spend 1000 wallet coins in the shop.', check: (s) => s.walletSpent >= 1000 },
  { key: 'fully_loaded', name: 'Fully Loaded', desc: 'Equip 5 cosmetic accessories at once.', check: () => equippedAccessories().length >= MAX_EQUIPPED_ACCESSORIES },
  { key: 'completionist', name: 'Completionist', desc: 'Clear the entire 180-sector campaign.', check: (s) => s.campaignCleared },
  { key: 'endless_grinder', name: 'Endless Grinder', desc: 'Reach floor 25 in Endless mode.', check: (s) => s.bestEndlessFloor >= 25 },
  { key: 'hardcore_hero', name: 'Hardcore Hero', desc: 'Clear a Hardcore sector.', check: (s) => s.hardcoreClears >= 1 },
  { key: 'chaos_tamer', name: 'Chaos Tamer', desc: 'Clear a Chaos sector.', check: (s) => s.chaosClears >= 1 },
  { key: 'rush_hour', name: 'Rush Hour', desc: 'Clear a Rush sector.', check: (s) => s.rushClears >= 1 },
  { key: 'dedicated', name: 'Dedicated', desc: 'Play for a cumulative 30 minutes.', check: (s) => s.totalPlaytime >= 1800 },
  { key: 'boss_slayer', name: 'Boss Slayer', desc: 'Defeat a biome boss.', check: (s) => s.bossesDefeated.length >= 1 },
  { key: 'boss_master', name: 'Boss Master', desc: 'Defeat every biome boss.', check: (s) => s.bossesDefeated.length >= BOSSES.length },
  { key: 'gambler', name: 'High Roller', desc: 'Open the Mystery Vault 10 times.', check: (s) => s.vaultOpens >= 10 },
  { key: 'relic_hunter', name: 'Relic Hunter', desc: 'Hold 3 relics at once in a single run.', check: (s) => s.maxRelicsInRun >= 3 },
  { key: 'trickster', name: 'Trickster', desc: 'Trigger Style Overdrive 10 times.', check: (s) => s.overdriveCount >= 10 },
  { key: 'grappler', name: 'Grapple Ace', desc: 'Fire the grapple hook 50 times.', check: (s) => s.grappleUses >= 50 },
  { key: 'ghost_beater', name: 'Outrunner', desc: 'Beat your own ghost time.', check: (s) => s.ghostBeats >= 1 },
  { key: 'special_forces', name: 'Special Forces', desc: 'Use your class special ability 30 times.', check: (s) => s.specialUses >= 30 },
  { key: 'secret_seeker', name: 'Secret Seeker', desc: 'Open 5 hidden treasure chests.', check: (s) => s.secretsFound >= 5 },
  { key: 'secret_master', name: 'Secret Master', desc: 'Open 30 hidden treasure chests.', check: (s) => s.secretsFound >= 30 }
];

function showToast(iconId, title, body) {
  if (!el.toasts) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<svg class="icon"><use href="#icon-${iconId}"></use></svg><div><p class="toast-title">${escapeHtml(title)}</p><p class="toast-body">${escapeHtml(body)}</p></div>`;
  el.toasts.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function updateAchBadge() {
  if (!el.achBadge) return;
  const count = game.meta.achievementsUnlocked.length;
  el.achBadge.textContent = String(count);
  el.achBadge.hidden = count === 0;
}

function checkAchievements() {
  let changed = false;
  ACHIEVEMENTS.forEach((a) => {
    if (game.meta.achievementsUnlocked.includes(a.key)) return;
    if (a.check(game.meta.stats)) {
      game.meta.achievementsUnlocked.push(a.key);
      changed = true;
      showToast('trophy', 'Achievement Unlocked', a.name);
      sfx.achievement();
      vibrate([30, 40, 30]);
    }
  });
  if (changed) {
    saveMeta();
    updateAchBadge();
  }
}

function renderAchievements() {
  if (!el.achList) return;
  const unlocked = new Set(game.meta.achievementsUnlocked);
  el.achList.innerHTML = ACHIEVEMENTS.map((a) => {
    const done = unlocked.has(a.key);
    return `
      <article class="ach-item ${done ? '' : 'locked'}">
        <svg class="icon"><use href="#icon-${done ? 'trophy' : 'star'}"></use></svg>
        <div>
          <span class="ach-name">${escapeHtml(a.name)}</span>
          <span class="ach-desc">${escapeHtml(done ? a.desc : '???')}</span>
        </div>
      </article>
    `;
  }).join('');
  if (el.achProgress) el.achProgress.textContent = `${unlocked.size} / ${ACHIEVEMENTS.length} unlocked`;
}

function formatClock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

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
  checkAchievements();
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

    if (rng() < clamp(0.12 - danger * 0.008, 0.06, 0.12) && endX - x >= 3) {
      const spx = x + 1 + Math.floor(rng() * (endX - x - 1));
      if (grid[y][spx] === '#') grid[y][spx] = 'U';
    }

    segments.push({ x0: x, x1: endX, y });

    const gap = 2 + Math.floor(rng() * (2 + Math.min(3, Math.floor(danger))));
    const rise = Math.floor(rng() * 5) - 2;
    const boundedRise = clamp(rise, -2, 2);
    const prevSegY = y;
    x = endX + gap;
    y = clamp(y + boundedRise, 3, MAP_H - 4);

    if (gap >= 4 && rng() < clamp(0.18 + danger * 0.02, 0.18, 0.32)) {
      const midX = clamp(endX + Math.floor(gap / 2), 1, MAP_W - 2);
      const midY = clamp(Math.round((prevSegY + y) / 2), 2, MAP_H - 3);
      if (grid[midY][midX] === '.') {
        grid[midY][midX] = rng() < 0.5 ? 'P' : 'Q';
      }
    }

    if (x - prevX > 9) {
      const bridgeY = clamp(y + 1, 3, MAP_H - 4);
      const bridgeX = x - 2;
      grid[bridgeY][bridgeX] = '#';
      markSafe(bridgeX, bridgeY);
    }

    if (gap >= 4 && rng() < 0.34) {
      // Hidden treasure vault: a foyer you can drop into, a cracked wall that
      // looks like any other block of terrain, and a sealed chest room past it.
      const foyerX = endX + 1;
      const wallX = foyerX + 1;
      const roomX = wallX + 1;
      const vaultFloorY = clamp(prevSegY + 2, 2, MAP_H - 3);
      const aboveY = vaultFloorY - 1;
      let clear = aboveY > 1 && roomX < x;
      for (const cx of [foyerX, wallX, roomX]) {
        if (!clear) break;
        if (grid[vaultFloorY][cx] !== '.' || grid[aboveY][cx] !== '.') clear = false;
      }
      if (clear) {
        grid[vaultFloorY][foyerX] = '#';
        grid[vaultFloorY][wallX] = '#';
        grid[vaultFloorY][roomX] = '#';
        grid[aboveY][wallX] = 'X';
        grid[aboveY][roomX] = 'T';
      }
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
  springTiles: [],
  movingPlatforms: [],
  chests: [],
  exit: null,
  start: { x: 80, y: 80 },
  camera: { x: 0, y: 0 },
  biome: BIOMES[0],
  combo: { count: 0, timer: 0, mult: 1 },
  runRelics: [],
  vampiricCounter: 0,
  boss: null,
  weather: null,
  grapple: null,
  style: { points: 0, overdriveT: 0, wallChain: 0, lastWallDir: 0 },
  ghost: { recording: [], recordTimer: 0, playback: null, playbackT: 0 },
  pendingLevelTransition: null,
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
    },
    settings: {
      muted: false,
      screenShake: true,
      particleDensity: 'high'
    },
    stats: {
      totalCoins: 0,
      totalDeaths: 0,
      totalDashes: 0,
      enemiesDefeated: 0,
      maxComboMult: 1,
      noHitClears: 0,
      fastestClear: 0,
      biomesVisited: [],
      totalPlaytime: 0,
      walletSpent: 0,
      levelsCleared: 0,
      campaignCleared: false,
      bestEndlessFloor: 0,
      hardcoreClears: 0,
      chaosClears: 0,
      rushClears: 0,
      bossesDefeated: [],
      vaultOpens: 0,
      maxRelicsInRun: 0,
      overdriveCount: 0,
      grappleUses: 0,
      ghostBeats: 0,
      specialUses: 0,
      secretsFound: 0
    },
    achievementsUnlocked: [],
    loadout: 'scout',
    ghosts: {}
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

    if (parsed.settings && typeof parsed.settings === 'object') {
      game.meta.settings.muted = !!parsed.settings.muted;
      game.meta.settings.screenShake = parsed.settings.screenShake !== false;
      game.meta.settings.particleDensity = parsed.settings.particleDensity === 'low' ? 'low' : 'high';
    }

    if (parsed.stats && typeof parsed.stats === 'object') {
      Object.keys(game.meta.stats).forEach((k) => {
        if (typeof game.meta.stats[k] === 'boolean') {
          game.meta.stats[k] = !!parsed.stats[k];
        } else if (Array.isArray(game.meta.stats[k])) {
          game.meta.stats[k] = Array.isArray(parsed.stats[k]) ? parsed.stats[k].slice(0, 20) : [];
        } else {
          game.meta.stats[k] = Math.max(0, Number(parsed.stats[k] || 0));
        }
      });
    }

    if (Array.isArray(parsed.achievementsUnlocked)) {
      const validKeys = new Set(ACHIEVEMENTS.map((a) => a.key));
      game.meta.achievementsUnlocked = parsed.achievementsUnlocked.filter((k) => validKeys.has(k));
    }

    game.meta.loadout = CLASSES[parsed.loadout] ? parsed.loadout : 'scout';

    if (parsed.ghosts && typeof parsed.ghosts === 'object') {
      const cleanGhosts = {};
      Object.keys(parsed.ghosts).slice(0, 200).forEach((k) => {
        const g = parsed.ghosts[k];
        if (g && typeof g.time === 'number' && Array.isArray(g.points)) {
          cleanGhosts[k] = { time: g.time, points: g.points.slice(0, 180) };
        }
      });
      game.meta.ghosts = cleanGhosts;
    }
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
  let base = 1 + (game.meta.upgrades.coinBoost || 0) * 0.15;
  base *= cosmeticBonuses().coinMult;
  if (hasRelic('glassCannon')) base *= 1.4;
  if (hasRelic('coinRush')) base *= 1.25;
  if (game.style.overdriveT > 0) base *= 1.5;
  return base;
}

function playerMaxHealth() {
  let hp = BASE_MAX_HEALTH + (game.meta.upgrades.maxHealth || 0) + cosmeticBonuses().maxHpBonus + currentClass().maxHpDelta;
  if (hasRelic('glassCannon')) hp -= 1;
  if (hasRelic('ironSkin')) hp += 2;
  if (hasRelic('featherweight')) hp -= 1;
  return Math.max(1, hp);
}

function playerMoveSpeed() {
  let base = BASE_MOVE * (1 + (game.meta.upgrades.moveSpeed || 0) * 0.08);
  base *= cosmeticBonuses().moveMult * currentClass().moveMult;
  if (hasRelic('ironSkin')) base *= 0.9;
  if (hasRelic('momentum') && game.combo.count >= 2) base *= 1.15;
  if (hasRelic('adrenaline') && game.player && game.player.adrenalineT > 0) base *= 1.15;
  if (game.meta.loadout === 'ninja' && game.player && game.player.specialActiveT > 0) base *= 1.5;
  if (game.style.overdriveT > 0) base *= 1.2;
  if (game.weather && game.weather.info.kind === 'cloud' && game.weather.slowActive) base *= 0.7;
  return base;
}

function playerJumpPower() {
  let base = BASE_JUMP * (1 + (game.meta.upgrades.jumpPower || 0) * 0.07);
  base *= cosmeticBonuses().jumpMult * currentClass().jumpMult;
  if (hasRelic('featherweight')) base *= 1.2;
  return base;
}

function playerDashLengthMultiplier() {
  let base = 1 + (game.meta.upgrades.dashLength || 0) * 0.12;
  base *= cosmeticBonuses().dashMult * currentClass().dashMult;
  return base;
}

function playerStartLives() {
  let lives = BASE_LIVES + (game.meta.upgrades.extraLife || 0);
  if (hasRelic('secondWind')) lives += 1;
  return lives;
}

function playerDashRecharge() {
  return hasRelic('overcharge') ? DASH_RECHARGE_SEC * 0.65 : DASH_RECHARGE_SEC;
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

  if (isBossLevel(levelIndex)) {
    return buildBossArena(levelIndex);
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
  game.runRelics = [];
  game.vampiricCounter = 0;
  applyModeVisualState();
  setStatus(`${currentModeInfo().name} mode active. ${currentModeInfo().objective}`, 2.8);

  const maxIdx = modeKey === 'endless' ? 9998 : (LEVELS.length - 1);
  const startLevel = clamp(Number(game.meta.progressByMode?.[modeKey] || 1) - 1, 0, maxIdx);
  parseLevel(startLevel, getModeLevelDef(startLevel));
}

function showOverlay(text, duration = 1.4, subtitle = '') {
  game.overlayText = text;
  game.overlayTimer = duration;
  if (el.overlay) {
    el.overlay.innerHTML = subtitle
      ? `${escapeHtml(text)}<span class="overlay-sub">${escapeHtml(subtitle)}</span>`
      : escapeHtml(text);
    el.overlay.classList.add('show');
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
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
  game.springTiles = [];
  game.movingPlatforms = [];
  game.chests = [];
  game.exit = null;
  game.boss = null;
  game.weather = null;
  game.grapple = null;
  if (el.bossBar) el.bossBar.hidden = true;
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

function parseLevel(index, customDef = null, options = {}) {
  clearLevel();
  const maxIdx = game.mode === 'endless' ? 9998 : (LEVELS.length - 1);
  game.levelIndex = clamp(index, 0, maxIdx);

  const def = customDef || getModeLevelDef(game.levelIndex);
  game.activeLevelDef = def;
  const rows = def.map;
  game.worldW = rows[0].length * TILE;
  game.worldH = rows.length * TILE;

  game.biome = biomeForLevel(game.levelIndex);
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--accent', game.biome.accent);
  }
  const biomeIdx = BIOMES.indexOf(game.biome);
  if (biomeIdx >= 0 && !game.meta.stats.biomesVisited.includes(biomeIdx)) {
    game.meta.stats.biomesVisited.push(biomeIdx);
    checkAchievements();
  }
  game.combo.count = 0;
  game.combo.timer = 0;
  game.combo.mult = 1;
  game.levelElapsed = 0;
  game.hitsThisLevel = 0;
  game._dispRunCoins = 0;

  rows.forEach((row, ry) => {
    [...row].forEach((ch, rx) => {
      const x = rx * TILE;
      const y = ry * TILE;

      if (ch === '#') game.solids.push({ x, y, w: TILE, h: TILE });
      if (ch === 'U') {
        const tile = { x, y, w: TILE, h: TILE, spring: true, bounceT: 0 };
        game.solids.push(tile);
        game.springTiles.push(tile);
      }
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

      if (ch === 'X') {
        game.solids.push({ x, y, w: TILE, h: TILE, cracked: true });
      }

      if (ch === 'T') {
        game.chests.push({
          x: x + 4,
          y: y + 8,
          w: 32,
          h: 28,
          opened: false,
          openT: 0,
          bob: Math.random() * Math.PI * 2
        });
      }

      if (ch === 'P' || ch === 'Q') {
        const axis = ch === 'P' ? 'x' : 'y';
        const rect = { x, y, w: TILE * 1.6, h: 14, moving: true };
        game.movingPlatforms.push({
          rect,
          axis,
          baseX: x,
          baseY: y,
          range: axis === 'x' ? TILE * 2.2 : TILE * 1.5,
          speed: 1.1 + Math.random() * 0.6,
          phase: Math.random() * Math.PI * 2
        });
        game.solids.push(rect);
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
    grappleCd: 0,
    specialCd: 0,
    specialActiveT: 0,
    adrenalineT: 0,
    groundPoundT: 0,
    buffs: {
      shield: 0,
      speed: 0,
      jump: 0,
      magnet: 0
    }
  };

  if (def.isBoss) {
    spawnBoss(game.levelIndex);
  }

  initWeatherForLevel();
  loadGhostForLevel();

  saveModeProgress(game.levelIndex);
  setStatus(`${currentModeInfo().name} ${game.levelIndex + 1}: ${def.name}`, 2.5);
  const isBiomeStart = game.levelIndex % LEVELS_PER_BIOME === 0;
  const parts = [];
  if (options.clearedSummary) parts.push(options.clearedSummary);
  if (isBiomeStart) parts.push(`Entering: ${game.biome.name}`);
  if (!def.isBoss) showOverlay(def.name, options.clearedSummary ? 1.9 : 1.4, parts.join('  |  '));
}

function levelSolidCollision(rect) {
  for (const tile of game.solids) {
    if (rectsIntersect(rect, tile)) return tile;
  }
  return null;
}

function wallProbe(p, dir) {
  const rect = { x: dir > 0 ? p.x + p.w : p.x - 2, y: p.y + 4, w: 2, h: p.h - 8 };
  return levelSolidCollision(rect);
}

function handleInputDown(e) {
  ensureAudioCtx();
  const key = e.key.toLowerCase();
  if (['arrowleft', 'arrowright', 'arrowup', ' '].includes(key)) e.preventDefault();
  if (key === 'a' || key === 'arrowleft') KEYS.left = true;
  if (key === 'd' || key === 'arrowright') KEYS.right = true;
  if (key === 'w' || key === 'arrowup' || key === ' ') {
    if (!KEYS.up) KEYS.upPressed = true;
    KEYS.up = true;
  }
  if (key === 'shift') KEYS.dash = true;
  if (key === 'e') {
    if (!KEYS.grapple) KEYS.grapplePressed = true;
    KEYS.grapple = true;
  }
  if (key === 'q') {
    if (!KEYS.special) KEYS.specialPressed = true;
    KEYS.special = true;
  }

  const pauseOpen = el.pauseModal && !el.pauseModal.hidden;
  if (key === 'r' && !pauseOpen) restartLevel();
  if (key === 'b' && !pauseOpen) toggleShop();

  if (key === 'escape') {
    if (el.achModal && !el.achModal.hidden) {
      toggleAchievementsModal(false);
    } else if (el.shop && !el.shop.hidden) {
      toggleShop(false);
    } else {
      togglePauseMenu();
    }
  }
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
  if (key === 'e') KEYS.grapple = false;
  if (key === 'q') KEYS.special = false;
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
  const densityMult = game.meta.settings.particleDensity === 'low' ? 0.4 : 1;
  const pMult = cosmeticBonuses().particleMult * densityMult;
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

function spawnPopup(x, y, text, color = '#ffe9a8') {
  game.particles.push({
    x,
    y,
    vx: (Math.random() - 0.5) * 20,
    vy: -70,
    life: 0.85,
    maxLife: 0.85,
    isText: true,
    text,
    color
  });
}

const COMBO_WINDOW = 2.2;
const COMBO_MAX_MULT = 3;

function registerCombo() {
  game.combo.count += 1;
  game.combo.timer = COMBO_WINDOW;
  game.combo.mult = clamp(1 + (game.combo.count - 1) * 0.18, 1, COMBO_MAX_MULT);
  if (game.combo.mult > game.meta.stats.maxComboMult) {
    game.meta.stats.maxComboMult = game.combo.mult;
    checkAchievements();
  }
}

function updateCombo(dt) {
  if (game.combo.timer > 0) {
    game.combo.timer = Math.max(0, game.combo.timer - dt);
    if (game.combo.timer === 0) {
      game.combo.count = 0;
      game.combo.mult = 1;
    }
  }
}

function resetCombo() {
  game.combo.count = 0;
  game.combo.timer = 0;
  game.combo.mult = 1;
}

function gainCoin(amount = 1) {
  let amt = amount;
  if (hasRelic('luckyDraw') && Math.random() < 0.3) amt *= 2;
  const value = Math.max(0.01, amt * coinValue() * game.combo.mult);
  game.runCoins += value;
  game.meta.wallet += value;
  return value;
}

function applyVampiric(killCount) {
  if (!hasRelic('vampiric') || killCount <= 0 || !game.player) return;
  game.vampiricCounter = (game.vampiricCounter || 0) + killCount;
  while (game.vampiricCounter >= 10) {
    game.vampiricCounter -= 10;
    if (game.player.hp < game.player.maxHp) {
      game.player.hp = Math.min(game.player.maxHp, game.player.hp + 1);
      spawnPopup(game.player.x + game.player.w / 2, game.player.y - 10, '+1 HP', '#8dffd8');
    }
  }
}

function hurtPlayer(amount = 1) {
  let scaledDamage = Math.max(1, Math.ceil(amount * clamp(currentModeInfo().difficultyMult * 0.92, 1, 2.2)));
  if (hasRelic('coinRush')) scaledDamage += 1;
  if (game.player.invuln > 0) return;
  game.hitsThisLevel = (game.hitsThisLevel || 0) + 1;
  resetCombo();
  sfx.hit();
  vibrate(60);
  if (hasRelic('adrenaline')) game.player.adrenalineT = 5;
  if (game.player.buffs.shield > 0) {
    game.player.buffs.shield = Math.max(0, game.player.buffs.shield - 2.4);
    game.player.invuln = 0.45;
    setStatus('Shield absorbed damage.', 0.85);
    return;
  }

  game.player.hp -= scaledDamage;
  game.player.invuln = 1.0 + cosmeticBonuses().invulnBonus;
  if (game.meta.settings.screenShake) {
    game.camera.shakeT = 0.2;
    game.camera.shakeMag = 9;
  }
  emitParticles(game.player.x + game.player.w / 2, game.player.y + game.player.h / 2, 10, '#ff9f9f', 200, 0.45, 3.4);
  setStatus('You took damage!', 0.9);

  if (game.player.hp <= 0) {
    game.player.lives -= 1;
    game.meta.stats.totalDeaths += 1;
    checkAchievements();
    if (game.player.lives > 0) {
      respawnPlayer();
      setStatus(`Life lost. ${game.player.lives} left.`, 1.5);
    } else {
      game.state = 'gameover';
      game.runRelics = [];
      game.vampiricCounter = 0;
      showToast('shuffle', 'Relics Lost', 'Your run ended — relics reset.');
      showOverlay('Run Failed', 2.2, `Collected ${game.collectedCoins}/${game.totalCoins} coins - Press R to retry`);
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
  const elapsed = game.levelElapsed || 0;
  const hits = game.hitsThisLevel || 0;
  const fullCoins = game.totalCoins > 0 && game.collectedCoins >= game.totalCoins;
  const stars = 1 + (hits === 0 ? 1 : 0) + (fullCoins ? 1 : 0);
  const starGlyphs = `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`;

  game.meta.stats.levelsCleared += 1;
  if (hits === 0) game.meta.stats.noHitClears += 1;
  if (elapsed > 0 && (game.meta.stats.fastestClear === 0 || elapsed < game.meta.stats.fastestClear)) {
    game.meta.stats.fastestClear = elapsed;
  }
  if (game.mode === 'hardcore') game.meta.stats.hardcoreClears += 1;
  if (game.mode === 'chaos') game.meta.stats.chaosClears += 1;
  if (game.mode === 'rush') game.meta.stats.rushClears += 1;
  if (game.mode === 'endless') {
    game.meta.stats.bestEndlessFloor = Math.max(game.meta.stats.bestEndlessFloor, game.levelIndex + 1);
  }

  if (elapsed > 0) {
    const ghostKey = ghostKeyForLevel(game.levelIndex);
    const prevGhost = game.meta.ghosts[ghostKey];
    if (!prevGhost || elapsed < prevGhost.time) {
      if (prevGhost) {
        game.meta.stats.ghostBeats += 1;
        showToast('map', 'Ghost Beaten', `New best time: ${formatClock(elapsed)}`);
      }
      const pts = game.ghost.recording.length > 1 ? game.ghost.recording : [];
      if (pts.length > 1) {
        game.meta.ghosts[ghostKey] = { time: elapsed, points: pts.slice(0, 180) };
      }
    }
  }
  sfx.portal();

  if (game.mode !== 'endless' && game.levelIndex + 1 >= LEVELS.length) {
    game.state = 'victory';
    game.meta.stats.campaignCleared = true;
    checkAchievements();
    saveMeta();
    showOverlay('Campaign Cleared', 2.8, `${LEVELS.length} sectors conquered across ${BIOMES.length} biomes - ${starGlyphs}`);
    setStatus('You beat all levels. Replay for more wallet coins.', 4);
    return;
  }

  checkAchievements();
  saveMeta();

  const clearedCoins = game.collectedCoins;
  const clearedTotal = game.totalCoins;
  const next = game.levelIndex + 1;
  if (game.mode !== 'endless' && next + 1 > game.meta.unlockedLevel) {
    game.meta.unlockedLevel = next + 1;
    saveMeta();
  }

  const transition = () => parseLevel(next, getModeLevelDef(next), {
    clearedSummary: `Sector Clear ${starGlyphs} - ${clearedCoins}/${clearedTotal} coins - ${formatClock(elapsed)}`
  });

  if ((next + 1) % 3 === 0) {
    game.pendingLevelTransition = transition;
    openRelicDraft();
  } else {
    transition();
  }
}

function triggerGroundPoundImpact() {
  const p = game.player;
  if (!p) return;
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h;
  if (game.meta.settings.screenShake) {
    game.camera.shakeT = 0.22;
    game.camera.shakeMag = 10;
  }
  emitParticles(cx, cy, 18, '#ffd79a', 220, 0.5, 3.6);
  sfx.bossHit();

  let killed = 0;
  for (const e of game.enemies) {
    const dist = Math.hypot((e.x + e.w / 2) - cx, (e.y + e.h / 2) - cy);
    if (dist < 150 && !e.dead) {
      e.dead = true;
      killed += 1;
    }
  }
  game.enemies = game.enemies.filter((e) => !e.dead);
  if (killed > 0) {
    registerCombo();
    const gained = gainCoin(killed * 3);
    spawnPopup(cx, cy - 10, `+${gained.toFixed(1)}`, '#ffb3a6');
    game.meta.stats.enemiesDefeated += killed;
    applyVampiric(killed);
    checkAchievements();
  }

  if (game.boss && !game.boss.dead) {
    const bdist = Math.hypot((game.boss.x + game.boss.w / 2) - cx, (game.boss.y + game.boss.h / 2) - cy);
    if (bdist < 180) damageBoss(2);
  }
}

function tryClassSpecial() {
  const p = game.player;
  const cls = currentClass();
  if (!p || game.state !== 'running' || p.specialCd > 0) return;
  p.specialCd = cls.specialCooldown;
  game.meta.stats.specialUses += 1;
  checkAchievements();
  sfx.special();
  vibrate(30);
  setStatus(`${cls.special} activated!`, 1.2);

  const loadout = game.meta.loadout;
  if (loadout === 'scout') {
    const dir = p.facing;
    let bestX = p.x;
    for (let dist = 20; dist <= 160; dist += 10) {
      const testRect = { x: p.x + dir * dist, y: p.y, w: p.w, h: p.h };
      if (levelSolidCollision(testRect)) break;
      bestX = testRect.x;
    }
    emitParticles(p.x + p.w / 2, p.y + p.h / 2, 10, '#8dffd8', 200, 0.3, 3);
    p.x = clamp(bestX, 0, game.worldW - p.w);
    p.invuln = Math.max(p.invuln, 0.25);
    emitParticles(p.x + p.w / 2, p.y + p.h / 2, 10, '#8dffd8', 200, 0.3, 3);
  } else if (loadout === 'tank') {
    p.vy = 1400;
    p.groundPoundT = 0.6;
    p.dashTime = 0;
    if (game.grapple) game.grapple = null;
    emitParticles(p.x + p.w / 2, p.y + p.h / 2, 8, '#ffb37a', 140, 0.3, 3);
  } else if (loadout === 'ninja') {
    p.specialActiveT = 1.2;
    p.invuln = Math.max(p.invuln, 1.2);
    p.vx = p.facing * playerMoveSpeed() * 1.4;
    emitParticles(p.x + p.w / 2, p.y + p.h / 2, 14, '#dcb3ff', 240, 0.4, 3.4);
  } else if (loadout === 'pyro') {
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    emitParticles(cx, cy, 24, '#ff9f6e', 260, 0.5, 4);
    if (game.meta.settings.screenShake) {
      game.camera.shakeT = 0.18;
      game.camera.shakeMag = 7;
    }
    let killed = 0;
    for (const e of game.enemies) {
      const dist = Math.hypot((e.x + e.w / 2) - cx, (e.y + e.h / 2) - cy);
      if (dist < 150 && !e.dead) {
        e.hp -= 2;
        if (e.hp <= 0) {
          e.dead = true;
          killed += 1;
          emitParticles(e.x + e.w / 2, e.y + e.h / 2, 10, '#ffb3a6', 200, 0.5, 3.2);
        }
      }
    }
    game.enemies = game.enemies.filter((e) => !e.dead);
    if (killed > 0) {
      registerCombo();
      const gained = gainCoin(killed * 3);
      spawnPopup(cx, cy - 10, `+${gained.toFixed(1)}`, '#ffb3a6');
      game.meta.stats.enemiesDefeated += killed;
      applyVampiric(killed);
      checkAchievements();
    }
    if (game.boss && !game.boss.dead) {
      const bdist = Math.hypot((game.boss.x + game.boss.w / 2) - cx, (game.boss.y + game.boss.h / 2) - cy);
      if (bdist < 170) damageBoss(2);
    }
  }
}

const STYLE_OVERDRIVE_THRESHOLD = 100;
const TRICK_INFO = {
  wallChain: { label: 'WALL CHAIN', points: 6, color: '#c68eff' },
  nearMiss: { label: 'CLOSE CALL', points: 5, color: '#ff8ee0' },
  airCombo: { label: 'AIR TAKEDOWN', points: 7, color: '#ffd77e' }
};

function registerTrick(kind, x, y) {
  if (!game.player || game.style.overdriveT > 0) return;
  const info = TRICK_INFO[kind];
  if (!info) return;
  game.style.points = Math.min(STYLE_OVERDRIVE_THRESHOLD, game.style.points + info.points);
  spawnPopup(x, y - 12, info.label, info.color);
  sfx.trick();
  if (game.style.points >= STYLE_OVERDRIVE_THRESHOLD) {
    activateOverdrive();
  }
}

function activateOverdrive() {
  game.style.points = 0;
  game.style.overdriveT = 8;
  game.meta.stats.overdriveCount += 1;
  checkAchievements();
  showToast('bolt', 'Style Overdrive!', '+20% speed and +50% coin value for 8s');
  sfx.achievement();
  if (game.player) {
    emitParticles(game.player.x + game.player.w / 2, game.player.y + game.player.h / 2, 20, '#ff8ee0', 220, 0.6, 4);
  }
}

function ghostKeyForLevel(levelIndex) {
  return `${game.mode}:${levelIndex}`;
}

function loadGhostForLevel() {
  const key = ghostKeyForLevel(game.levelIndex);
  const saved = game.meta.ghosts[key];
  game.ghost.recording = [];
  game.ghost.recordTimer = 0;
  game.ghost.playbackT = 0;
  game.ghost.playback = saved && Array.isArray(saved.points) && saved.points.length > 1 ? saved.points : null;
}

function updateGhost(dt) {
  if (game.state !== 'running' || !game.player) return;
  const g = game.ghost;
  g.recordTimer += dt;
  if (g.recordTimer >= 0.08) {
    g.recordTimer = 0;
    g.recording.push({ t: game.levelElapsed || 0, x: Math.round(game.player.x), y: Math.round(game.player.y) });
    if (g.recording.length > 260) g.recording.shift();
  }
  if (g.playback) {
    g.playbackT = game.levelElapsed || 0;
  }
}

function ghostPositionAt(t) {
  const pts = game.ghost.playback;
  if (!pts || pts.length === 0) return null;
  if (t <= pts[0].t) return pts[0];
  if (t >= pts[pts.length - 1].t) return pts[pts.length - 1];
  for (let i = 1; i < pts.length; i += 1) {
    if (pts[i].t >= t) {
      const a = pts[i - 1];
      const b = pts[i];
      const span = Math.max(0.0001, b.t - a.t);
      const frac = (t - a.t) / span;
      return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
    }
  }
  return pts[pts.length - 1];
}

let minimapFrameCounter = 0;

function drawMinimap() {
  if (!el.minimap) return;
  minimapFrameCounter += 1;
  if (minimapFrameCounter % 4 !== 0) return;
  const ctx = el.minimap.getContext('2d');
  if (!ctx || !game.worldW || !game.worldH) return;
  const w = el.minimap.width;
  const h = el.minimap.height;
  ctx.clearRect(0, 0, w, h);
  const scaleX = w / game.worldW;
  const scaleY = h / game.worldH;

  ctx.fillStyle = 'rgba(142, 218, 255, 0.35)';
  for (const tile of game.solids) {
    ctx.fillRect(tile.x * scaleX, tile.y * scaleY, Math.max(1, tile.w * scaleX), Math.max(1, tile.h * scaleY));
  }

  ctx.fillStyle = '#ffd77e';
  for (const coin of game.coins) {
    if (coin.taken) continue;
    ctx.fillRect(coin.x * scaleX, coin.y * scaleY, 2, 2);
  }

  ctx.fillStyle = '#ff8f7f';
  for (const e of game.enemies) {
    ctx.fillRect(e.x * scaleX, e.y * scaleY, 2, 2);
  }

  if (game.exit) {
    ctx.fillStyle = '#9affce';
    ctx.fillRect(game.exit.x * scaleX - 1, game.exit.y * scaleY - 1, 4, 4);
  }

  if (game.boss && !game.boss.dead) {
    ctx.fillStyle = '#ff6a5a';
    ctx.fillRect(game.boss.x * scaleX - 1, game.boss.y * scaleY - 1, 4, 4);
  }

  if (game.player) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(game.player.x * scaleX - 1, game.player.y * scaleY - 1, 3, 3);
  }
}

function drawGhost(ctx) {
  const pos = ghostPositionAt(game.ghost.playbackT);
  if (!pos || !game.player) return;
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#8dffd8';
  ctx.fillRect(pos.x + 2, pos.y + 2, game.player.w - 4, game.player.h - 4);
  ctx.strokeStyle = 'rgba(141, 255, 216, 0.7)';
  ctx.strokeRect(pos.x + 2, pos.y + 2, game.player.w - 4, game.player.h - 4);
  ctx.restore();
}

function initWeatherForLevel() {
  if (game.activeLevelDef && game.activeLevelDef.isBoss) {
    game.weather = null;
    return;
  }
  const biomeIdx = Math.max(0, BIOMES.indexOf(game.biome));
  const info = weatherForBiome(biomeIdx);
  game.weather = {
    info,
    timer: 1 + Math.random() * 2,
    particles: [],
    windPhase: Math.random() * Math.PI * 2,
    windDir: Math.random() < 0.5 ? -1 : 1,
    gustActive: false,
    slowActive: false
  };
}

function updateWeather(dt) {
  const w = game.weather;
  if (!w || game.state !== 'running') return;
  const p = game.player;

  if (w.info.kind === 'fall') {
    w.timer -= dt;
    if (w.timer <= 0) {
      w.timer = 1.3 + Math.random() * 1.1;
      w.particles.push({ x: Math.random() * game.worldW, y: -20, vy: 260 + Math.random() * 90, r: 8 });
    }
    for (const orb of w.particles) {
      orb.y += orb.vy * dt;
      if (p && !orb.hit) {
        const dist = Math.hypot((p.x + p.w / 2) - orb.x, (p.y + p.h / 2) - orb.y);
        if (dist < orb.r + 14) {
          orb.hit = true;
          hurtPlayer(1);
        }
      }
    }
    w.particles = w.particles.filter((o) => o.y < game.worldH + 40 && !o.hit);
  } else if (w.info.kind === 'wind') {
    w.windPhase += dt;
    w.gustActive = Math.sin(w.windPhase * 0.6) > 0.4;
    if (w.gustActive && p) {
      p.x = clamp(p.x + w.windDir * 90 * dt, 0, game.worldW - p.w);
    }
  } else if (w.info.kind === 'cloud') {
    w.timer -= dt;
    if (w.timer <= 0) {
      w.timer = 3 + Math.random() * 2;
      w.particles.push({ x: Math.random() * game.worldW, y: (MAP_H - 4) * TILE - 20, r: 60, life: 6 });
    }
    w.slowActive = false;
    for (const cloud of w.particles) {
      cloud.life -= dt;
      if (p) {
        const dist = Math.hypot((p.x + p.w / 2) - cloud.x, (p.y + p.h / 2) - cloud.y);
        if (dist < cloud.r) w.slowActive = true;
      }
    }
    w.particles = w.particles.filter((c) => c.life > 0);
  }
}

function drawWeather(ctx) {
  const w = game.weather;
  if (!w) return;
  if (w.info.kind === 'fall') {
    ctx.fillStyle = `rgba(${w.info.color}, 0.85)`;
    for (const orb of w.particles) {
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (w.info.kind === 'wind' && w.gustActive && game.player) {
    ctx.strokeStyle = `rgba(${w.info.color}, 0.5)`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const sx = game.player.x - w.windDir * 80 - i * 24;
      const sy = game.player.y - 30 + i * 14;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + w.windDir * 40, sy);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
  } else if (w.info.kind === 'cloud') {
    ctx.fillStyle = `rgba(${w.info.color}, 0.18)`;
    for (const cloud of w.particles) {
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, cloud.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function updateStyle(dt) {
  if (game.state !== 'running') return;
  if (game.style.overdriveT > 0) {
    game.style.overdriveT = Math.max(0, game.style.overdriveT - dt);
  } else if (game.style.points > 0) {
    game.style.points = Math.max(0, game.style.points - dt * 4);
  }
}

function updateSecretHints(dt) {
  if (game.state !== 'running' || !game.player) return;
  const p = game.player;
  for (const tile of game.solids) {
    if (!tile.cracked || tile.broken) continue;
    const cx = tile.x + tile.w / 2;
    const cy = tile.y + tile.h / 2;
    const dist = Math.hypot((p.x + p.w / 2) - cx, (p.y + p.h / 2) - cy);
    if (dist < 60 && Math.random() < dt * 0.7) {
      emitParticles(cx, cy, 1, '#e8dcc8', 16, 0.35, 1.4);
    }
  }
}

function breakCrackedWall(tile) {
  if (tile.broken) return;
  tile.broken = true;
  game.solids = game.solids.filter((t) => t !== tile);
  emitParticles(tile.x + tile.w / 2, tile.y + tile.h / 2, 12, '#cbb896', 180, 0.45, 2.8);
  sfx.trick();
  vibrate(20);
  setStatus('The wall gives way...', 1.2);
}

function rollChestReward() {
  const roll = Math.random() * 100;
  if (roll < 45) {
    const amt = 40 + Math.floor(Math.random() * 40);
    game.meta.wallet += amt;
    game.runCoins += amt;
    return { text: `+${amt} coins`, icon: 'coin' };
  }
  if (roll < 75) {
    const amt = 90 + Math.floor(Math.random() * 60);
    game.meta.wallet += amt;
    game.runCoins += amt;
    return { text: `+${amt} coins - a fine haul!`, icon: 'coin' };
  }
  if (roll < 92) {
    const unowned = SHOP.filter((item) => item.kind === 'cosmetic' && !cosmeticOwned(item.key));
    if (unowned.length > 0) {
      const item = unowned[Math.floor(Math.random() * unowned.length)];
      game.meta.upgrades[item.key] = 1;
      if (equippedAccessories().length < MAX_EQUIPPED_ACCESSORIES) {
        game.meta.equippedAccessories.push(item.key);
        sanitizeEquippedAccessories();
      }
      return { text: `Rare unlock: ${item.name}!`, icon: 'star' };
    }
    const amt = 150 + Math.floor(Math.random() * 50);
    game.meta.wallet += amt;
    game.runCoins += amt;
    return { text: `+${amt} coins (all cosmetics owned)`, icon: 'coin' };
  }
  const amt = 300 + Math.floor(Math.random() * 200);
  game.meta.wallet += amt;
  game.runCoins += amt;
  return { text: `JACKPOT! +${amt} coins`, icon: 'trophy' };
}

function openChest(chest) {
  if (chest.opened) return;
  chest.opened = true;
  chest.openT = 0.6;
  const reward = rollChestReward();
  emitParticles(chest.x + chest.w / 2, chest.y, 26, '#ffd77e', 240, 0.7, 4);
  spawnPopup(chest.x + chest.w / 2, chest.y - 8, reward.text, '#ffd77e');
  showToast(reward.icon, 'Treasure Found!', reward.text);
  sfx.achievement();
  vibrate([30, 40, 30, 40, 90]);
  if (game.meta.settings.screenShake) {
    game.camera.shakeT = 0.15;
    game.camera.shakeMag = 5;
  }
  game.meta.stats.secretsFound += 1;
  saveMeta();
  checkAchievements();
}

function updateChests(dt) {
  if (game.state !== 'running' || !game.player) return;
  const p = game.player;
  for (const chest of game.chests) {
    if (chest.opened) continue;
    if (rectsIntersect(p, chest)) openChest(chest);
  }
  for (const chest of game.chests) {
    if (chest.openT > 0) chest.openT = Math.max(0, chest.openT - dt);
  }
}

function drawChests(ctx) {
  for (const chest of game.chests) {
    const bob = chest.opened ? 0 : Math.sin(chest.bob + game.time * 2) * 2;
    const lidOpen = chest.opened ? clamp(1 - chest.openT / 0.6, 0, 1) : 0;

    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(chest.x, chest.y + 10 + bob, chest.w, chest.h - 10);
    ctx.strokeStyle = '#2c1c10';
    ctx.strokeRect(chest.x + 0.5, chest.y + 10.5 + bob, chest.w - 1, chest.h - 11);

    ctx.save();
    ctx.translate(chest.x + chest.w / 2, chest.y + 10 + bob);
    ctx.rotate(-lidOpen * 0.9);
    ctx.fillStyle = '#8a5a2e';
    ctx.fillRect(-chest.w / 2, -10, chest.w, 10);
    ctx.strokeStyle = '#2c1c10';
    ctx.strokeRect(-chest.w / 2 + 0.5, -9.5, chest.w - 1, 9);
    ctx.restore();

    if (!chest.opened) {
      ctx.fillStyle = '#ffd77e';
      ctx.fillRect(chest.x + chest.w / 2 - 3, chest.y + 14 + bob, 6, 7);
    } else if (chest.openT > 0) {
      const glowA = chest.openT / 0.6;
      ctx.fillStyle = `rgba(255, 215, 126, ${0.5 * glowA})`;
      ctx.beginPath();
      ctx.ellipse(chest.x + chest.w / 2, chest.y + bob, chest.w * 0.6, 14, 0, Math.PI, 0);
      ctx.fill();
    }
  }
}

function updateMovingPlatforms(dt) {
  if (game.state !== 'running') return;
  const p = game.player;
  for (const plat of game.movingPlatforms) {
    const prevX = plat.rect.x;
    const prevY = plat.rect.y;
    let carry = false;
    if (p && p.onGround) {
      const probe = { x: p.x, y: p.y + p.h, w: p.w, h: 4 };
      if (rectsIntersect(probe, plat.rect)) carry = true;
    }

    plat.phase += dt * plat.speed;
    const offset = Math.sin(plat.phase) * plat.range;
    if (plat.axis === 'x') {
      plat.rect.x = plat.baseX + offset;
    } else {
      plat.rect.y = plat.baseY + offset;
    }

    if (carry && p) {
      p.x += plat.rect.x - prevX;
      p.y += plat.rect.y - prevY;
    }
  }
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
  p.grappleCd = Math.max(0, (p.grappleCd || 0) - dt);
  p.specialCd = Math.max(0, (p.specialCd || 0) - dt);
  p.specialActiveT = Math.max(0, (p.specialActiveT || 0) - dt);
  p.adrenalineT = Math.max(0, (p.adrenalineT || 0) - dt);

  p.buffs.shield = Math.max(0, p.buffs.shield - dt);
  p.buffs.speed = Math.max(0, p.buffs.speed - dt);
  p.buffs.jump = Math.max(0, p.buffs.jump - dt);
  p.buffs.magnet = Math.max(0, p.buffs.magnet - dt);

  for (const spring of game.springTiles) {
    if (spring.bounceT > 0) spring.bounceT = Math.max(0, spring.bounceT - dt);
  }

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

  // Wall slide / wall jump detection: probe just outside the player's sides.
  p.wallDir = 0;
  if (!p.onGround) {
    if (KEYS.left && wallProbe(p, -1)) p.wallDir = -1;
    else if (KEYS.right && wallProbe(p, 1)) p.wallDir = 1;
  }
  const wallSliding = p.wallDir !== 0 && p.vy > 0 && p.dashTime <= 0;
  if (wallSliding) p.airJumpsUsed = 0;

  if (KEYS.upPressed) {
    p.jumpBuffer = 0.14;
    KEYS.upPressed = false;
  }

  if (p.jumpBuffer > 0) {
    const groundedJump = p.onGround || p.coyote > 0;
    const wallJump = !groundedJump && p.wallDir !== 0;
    const maxAirJumps = (p.buffs.jump > 0 ? 2 : 1) + currentClass().extraAirJump;
    const airJump = !groundedJump && !wallJump && p.airJumpsUsed < maxAirJumps;

    if (groundedJump || wallJump || airJump) {
      p.jumpBuffer = 0;

      if (groundedJump) {
        p.vy = -jumpPower;
        p.onGround = false;
        p.coyote = 0;
        p.airJumpsUsed = 0;
        emitParticles(p.x + p.w / 2, p.y + p.h - 2, 7, '#d7f0ff', 120, 0.35, 2.8);
      } else if (wallJump) {
        p.vy = -jumpPower * 0.94;
        p.vx = -p.wallDir * moveSpeed * 1.2;
        p.facing = -p.wallDir;
        p.wallDir = 0;
        p.airJumpsUsed = 0;
        emitParticles(p.x + (p.facing < 0 ? p.w : 0), p.y + p.h / 2, 10, '#c9f3ff', 190, 0.4, 3);
        game.style.wallChain += 1;
        if (game.style.wallChain >= 2) registerTrick('wallChain', p.x + p.w / 2, p.y);
      } else {
        p.vy = -jumpPower;
        p.airJumpsUsed += 1;
        emitParticles(p.x + p.w / 2, p.y + p.h / 2, 7, '#aef1ff', 130, 0.35, 2.8);
      }
      sfx.jump();
    }
  }

  if (!KEYS.up && p.vy < -120 && p.dashTime <= 0) {
    p.vy += GRAVITY * 1.55 * dt;
  }

  if (KEYS.dash && p.dashCd <= 0 && p.dashCharges > 0) {
    p.dashCd = 0.9;
    p.dashTime = 0.15;
    p.dashCharges -= 1;
    p.dashRecharge = playerDashRecharge();
    p.vx = p.facing * BASE_DASH_FORCE * playerDashLengthMultiplier();
    p.vy *= 0.35;
    emitParticles(p.x + p.w / 2, p.y + p.h / 2, 12, '#95ffe8', 260, 0.35, 3.3);
    sfx.dash();
    game.meta.stats.totalDashes += 1;
    checkAchievements();
    if (game.grapple && game.grapple.active) game.grapple = null;
  }

  // Grapple hook: fire/release on press, pull toward the anchor while active.
  if (KEYS.grapplePressed) {
    KEYS.grapplePressed = false;
    if (game.grapple && game.grapple.active) {
      game.grapple = null;
    } else if (p.grappleCd <= 0) {
      const angle = 0.62;
      const dirX = Math.cos(angle) * p.facing;
      const dirY = -Math.sin(angle);
      const originX = p.x + p.w / 2;
      const originY = p.y + p.h / 2;
      const maxRange = 340;
      let hitX = null;
      let hitY = null;
      for (let dist = 16; dist <= maxRange; dist += 8) {
        const probeX = originX + dirX * dist;
        const probeY = originY + dirY * dist;
        const probe = { x: probeX - 2, y: probeY - 2, w: 4, h: 4 };
        if (levelSolidCollision(probe)) {
          hitX = probeX;
          hitY = probeY;
          break;
        }
      }
      p.grappleCd = 0.5;
      if (hitX !== null) {
        game.grapple = { x: hitX, y: hitY, active: true, t: 0 };
        sfx.grappleLatch();
        game.meta.stats.grappleUses += 1;
        checkAchievements();
      } else {
        sfx.grapple();
      }
    }
  }

  if (game.grapple && game.grapple.active) {
    const g = game.grapple;
    g.t += dt;
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    const dx = g.x - cx;
    const dy = g.y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const pullSpeed = 920;
    p.vx = (dx / dist) * pullSpeed;
    p.vy = (dy / dist) * pullSpeed;
    p.onGround = false;
    p.airJumpsUsed = 0;
    if (Math.random() < dt * 20) emitParticles(cx, cy, 1, '#ffe27a', 20, 0.2, 2);
    if (dist < 26 || g.t > 1.1) {
      game.grapple = null;
      p.vx *= 0.85;
      p.vy = Math.min(p.vy, -140);
    }
  }

  if (KEYS.specialPressed) {
    KEYS.specialPressed = false;
    tryClassSpecial();
  }

  if (p.dashTime <= 0) {
    p.vy = Math.min(TERMINAL_VY, p.vy + GRAVITY * dt);
  }

  if (wallSliding) {
    p.vy = Math.min(p.vy, 130);
    if (Math.random() < dt * 14) {
      emitParticles(p.x + (p.wallDir > 0 ? p.w - 2 : 2), p.y + p.h * 0.6, 1, '#bfe6ff', 40, 0.3, 2);
    }
  }

  // Horizontal move and collide.
  const prevPX = p.x;
  p.x += p.vx * dt;

  if (p.dashTime > 0) {
    // Dashes can move faster than a tile is wide in a single frame, so a plain
    // end-position check can tunnel straight through a cracked wall without
    // ever registering a collision. Sweep the whole step instead.
    for (const tile of game.solids) {
      if (!tile.cracked || tile.broken) continue;
      if (p.y + p.h <= tile.y || p.y >= tile.y + tile.h) continue;
      const moveMin = Math.min(prevPX, p.x);
      const moveMax = Math.max(prevPX + p.w, p.x + p.w);
      if (moveMax > tile.x && moveMin < tile.x + tile.w) {
        breakCrackedWall(tile);
      }
    }
  }

  let hit = levelSolidCollision(p);
  if (hit) {
    if (hit.cracked && p.dashTime > 0) {
      breakCrackedWall(hit);
    } else {
      if (p.vx > 0) p.x = hit.x - p.w;
      else if (p.vx < 0) p.x = hit.x + hit.w;
      p.vx = 0;
    }
  }

  // Vertical move and collide.
  p.y += p.vy * dt;
  hit = levelSolidCollision(p);
  if (hit) {
    if (p.vy > 0 && hit.spring) {
      p.y = hit.y - p.h;
      p.vy = -playerJumpPower() * 1.7;
      p.onGround = false;
      p.airJumpsUsed = 0;
      p.dashCharges = MAX_DASH_CHARGES;
      p.dashRecharge = 0;
      hit.bounceT = 0.3;
      if (game.meta.settings.screenShake) {
        game.camera.shakeT = 0.12;
        game.camera.shakeMag = 5;
      }
      emitParticles(hit.x + hit.w / 2, hit.y, 14, '#8dffd8', 230, 0.4, 3.2);
      setStatus('Spring boost!', 0.7);
      sfx.spring();
    } else if (p.vy > 0) {
      p.y = hit.y - p.h;
      p.vy = 0;
      p.onGround = true;
      p.airJumpsUsed = 0;
      p.coyote = 0.1;
      if (p.dashCharges < MAX_DASH_CHARGES && p.dashRecharge <= 0) {
        p.dashCharges = MAX_DASH_CHARGES;
      }
      if (p.groundPoundT > 0) {
        p.groundPoundT = 0;
        triggerGroundPoundImpact();
      }
      game.style.wallChain = 0;
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

  game.nearMissCd = Math.max(0, (game.nearMissCd || 0) - dt);
  if (game.nearMissCd <= 0) {
    for (const spike of game.spikes) {
      const dx = (p.x + p.w / 2) - (spike.x + spike.w / 2);
      const dy = (p.y + p.h / 2) - (spike.y + spike.h / 2);
      if (Math.hypot(dx, dy) < 30 && !rectsIntersect(p, spike)) {
        registerTrick('nearMiss', p.x + p.w / 2, p.y);
        game.nearMissCd = 0.6;
        break;
      }
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
      game.meta.stats.totalCoins += 1;
      registerCombo();
      const gained = gainCoin(1);
      emitParticles(coin.x + coin.w / 2, coin.y + coin.h / 2, 9, '#ffd77e', 160, 0.45, 2.8);
      spawnPopup(coin.x + coin.w / 2, coin.y - 4, `+${gained.toFixed(gained < 10 ? 1 : 0)}`, '#ffe9a8');
      setStatus('Coin collected.', 0.55);
      sfx.coin();
      checkAchievements();
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
      sfx.powerup();
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
    const bossBlocking = game.boss && !game.boss.dead;
    if (bossBlocking) {
      setStatus('Defeat the boss to unlock the portal.', 1);
    } else if (game.collectedCoins >= game.requiredCoins) {
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
          registerCombo();
          const gained = gainCoin(3);
          emitParticles(e.x + e.w / 2, e.y + e.h / 2, 12, '#ffb3a6', 220, 0.55, 3.6);
          spawnPopup(e.x + e.w / 2, e.y - 4, `+${gained.toFixed(gained < 10 ? 1 : 0)}`, '#ffb3a6');
          setStatus(`Enemy defeated: +${gained.toFixed(1)} coins.`, 0.75);
          sfx.enemyDown();
          game.meta.stats.enemiesDefeated += 1;
          applyVampiric(1);
          registerTrick('airCombo', e.x + e.w / 2, e.y);
          checkAchievements();
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
    pt.vy += (pt.isText ? -30 : 480) * dt;
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
  const hp = Math.max(0, game.player.hp);
  el.health.textContent = `${hp} / ${game.player.maxHp}`;
  el.lives.textContent = game.player.lives;

  game._dispRunCoins = game._dispRunCoins ?? game.runCoins;
  game._dispWallet = game._dispWallet ?? game.meta.wallet;
  const lerpRate = clamp(dt * 9, 0, 1);
  game._dispRunCoins += (game.runCoins - game._dispRunCoins) * lerpRate;
  game._dispWallet += (game.meta.wallet - game._dispWallet) * lerpRate;
  if (Math.abs(game.runCoins - game._dispRunCoins) < 0.05) game._dispRunCoins = game.runCoins;
  if (Math.abs(game.meta.wallet - game._dispWallet) < 0.05) game._dispWallet = game.meta.wallet;
  el.runCoins.textContent = Math.round(game._dispRunCoins);
  el.wallet.textContent = Math.round(game._dispWallet);

  const modeObj = currentModeInfo().objective;
  el.objective.textContent = `Coins ${game.collectedCoins}/${game.requiredCoins} required (${game.totalCoins} total) | ${modeObj}`;
  el.status.textContent = game.statusText;
  if (el.biome) el.biome.textContent = game.biome.name;
  applyModeVisualState();
  renderBiomeTrack();

  if (el.hpBar) {
    if (game._lastMaxHpRendered !== game.player.maxHp) {
      el.hpBar.innerHTML = Array.from({ length: game.player.maxHp }, () => '<div class="hp-seg"></div>').join('');
      game._lastMaxHpRendered = game.player.maxHp;
    }
    const segs = el.hpBar.children;
    const prevHp = game._lastHpRendered != null ? game._lastHpRendered : hp;
    for (let i = 0; i < segs.length; i += 1) {
      segs[i].classList.toggle('filled', i < hp);
      if (i >= hp && i < prevHp) {
        segs[i].classList.add('hurt');
        setTimeout(() => segs[i].classList.remove('hurt'), 400);
      }
    }
    game._lastHpRendered = hp;
  }

  if (el.dashPips) {
    if (!el.dashPips.children.length) {
      el.dashPips.innerHTML = Array.from({ length: MAX_DASH_CHARGES }, () => '<div class="dash-pip"></div>').join('');
    }
    const pips = el.dashPips.children;
    for (let i = 0; i < pips.length; i += 1) {
      pips[i].classList.toggle('ready', i < game.player.dashCharges);
    }
  }

  if (el.coinFill) {
    const pct = game.requiredCoins > 0 ? clamp((game.collectedCoins / game.requiredCoins) * 100, 0, 100) : 100;
    el.coinFill.style.width = `${pct}%`;
    el.coinFill.classList.toggle('ready', game.collectedCoins >= game.requiredCoins);
  }

  if (el.combo && el.comboText) {
    if (game.combo.count >= 2) {
      el.combo.hidden = false;
      el.comboText.textContent = `x${game.combo.mult.toFixed(1)} COMBO`;
    } else {
      el.combo.hidden = true;
    }
  }

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

  if (el.bossHpFill && game.boss) {
    const pct = clamp((game.boss.hp / game.boss.maxHp) * 100, 0, 100);
    el.bossHpFill.style.width = `${pct}%`;
  }

  if (el.styleFill && el.styleLabel) {
    const pct = clamp((game.style.points / STYLE_OVERDRIVE_THRESHOLD) * 100, 0, 100);
    el.styleFill.style.width = `${pct}%`;
    el.styleFill.classList.toggle('overdrive', game.style.overdriveT > 0);
    el.styleLabel.textContent = game.style.overdriveT > 0
      ? `OVERDRIVE ${game.style.overdriveT.toFixed(1)}s`
      : `Style ${Math.round(game.style.points)}`;
  }

  drawMinimap();
}

function drawBackground(ctx) {
  const t = game.time;
  const biome = game.biome;
  const grad = ctx.createLinearGradient(0, 0, 0, el.canvas.height);
  grad.addColorStop(0, biome.sky[0]);
  grad.addColorStop(0.55, biome.sky[1]);
  grad.addColorStop(1, biome.sky[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, el.canvas.width, el.canvas.height);

  for (let i = 0; i < 4; i += 1) {
    const y = 140 + i * 90 + Math.sin(t * 0.4 + i) * 10;
    const alpha = 0.1 + i * 0.05;
    ctx.fillStyle = `rgba(${biome.cloud}, ${alpha})`;
    ctx.fillRect(-200 - game.camera.x * (0.2 + i * 0.05), y, 2200, 14);
  }
}

function drawWorld(ctx) {
  const cam = game.camera;
  const biome = game.biome;
  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  // Tiles.
  for (const tile of game.solids) {
    if (tile.spring) continue;
    ctx.fillStyle = biome.tileBody;
    ctx.fillRect(tile.x, tile.y, tile.w, tile.h);
    ctx.fillStyle = biome.tileTop;
    ctx.fillRect(tile.x, tile.y, tile.w, 4);
    ctx.strokeStyle = biome.tileEdge;
    ctx.strokeRect(tile.x + 0.5, tile.y + 0.5, tile.w - 1, tile.h - 1);
  }

  // Spring pads.
  for (const s of game.springTiles) {
    const squash = s.bounceT > 0 ? s.bounceT / 0.3 : 0;
    const padH = s.h - squash * 10;
    const glow = 0.55 + 0.45 * Math.sin(game.time * 5 + s.x * 0.04);
    ctx.fillStyle = biome.tileBody;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = `rgba(141, 255, 216, ${0.5 + glow * 0.35})`;
    ctx.fillRect(s.x + 3, s.y + (s.h - padH), s.w - 6, padH - 4);
    ctx.strokeStyle = biome.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x + 3, s.y + (s.h - padH), s.w - 6, padH - 4);
    ctx.lineWidth = 1;
  }

  // Moving platforms.
  for (const plat of game.movingPlatforms) {
    const r = plat.rect;
    ctx.fillStyle = biome.tileBody;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = biome.tileTop;
    ctx.fillRect(r.x, r.y, r.w, 3);
    ctx.strokeStyle = biome.accent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    ctx.lineWidth = 1;
  }

  // Lava.
  for (const lava of game.lava) {
    const pulse = 0.5 + 0.5 * Math.sin(game.time * 6 + lava.x * 0.02);
    ctx.fillStyle = `rgba(${biome.hazard1}, ${0.45 + pulse * 0.4})`;
    ctx.fillRect(lava.x, lava.y, lava.w, lava.h);
    ctx.fillStyle = `rgba(${biome.hazard2}, 0.45)`;
    ctx.fillRect(lava.x, lava.y + 3, lava.w, 6);
  }

  // Spikes.
  for (const s of game.spikes) {
    ctx.fillStyle = biome.spike;
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

  drawChests(ctx);

  // Exit portal.
  if (game.exit) {
    const ready = game.collectedCoins >= game.requiredCoins;
    const c = ready ? biome.portal : '#5f89bf';
    const pulse = 0.6 + 0.4 * Math.sin(game.time * 5);
    ctx.fillStyle = ready ? `${biome.portal}${Math.round((0.24 + pulse * 0.3) * 255).toString(16).padStart(2, '0')}` : 'rgba(90, 130, 195, 0.33)';
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

  drawWeather(ctx);
  drawBoss(ctx);
  drawGhost(ctx);

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

  // Grapple line.
  if (game.grapple && game.grapple.active) {
    const g = game.grapple;
    ctx.strokeStyle = 'rgba(255, 226, 122, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x + p.w / 2, p.y + p.h / 2);
    ctx.lineTo(g.x, g.y);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = '#ffe27a';
    ctx.beginPath();
    ctx.arc(g.x, g.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Particles.
  for (const pt of game.particles) {
    const alpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.fillStyle = `${pt.color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
    if (pt.isText) {
      ctx.font = 'bold 13px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pt.text, pt.x, pt.y);
      ctx.textAlign = 'left';
    } else {
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
  }

  ctx.restore();
}

function render() {
  if (!game.ctx) return;
  drawBackground(game.ctx);
  drawWorld(game.ctx);
}

const VAULT_COST = 60;

function rollVaultReward() {
  const roll = Math.random() * 100;
  if (roll < 50) {
    const amt = 10 + Math.floor(Math.random() * 30);
    game.meta.wallet += amt;
    return { text: `+${amt} coins`, icon: 'coin' };
  }
  if (roll < 72) {
    const amt = 50 + Math.floor(Math.random() * 70);
    game.meta.wallet += amt;
    return { text: `+${amt} coins (medium haul)`, icon: 'coin' };
  }
  if (roll < 90) {
    const unowned = SHOP.filter((item) => item.kind === 'cosmetic' && !cosmeticOwned(item.key));
    if (unowned.length > 0) {
      const item = unowned[Math.floor(Math.random() * unowned.length)];
      game.meta.upgrades[item.key] = 1;
      if (equippedAccessories().length < MAX_EQUIPPED_ACCESSORIES) {
        game.meta.equippedAccessories.push(item.key);
        sanitizeEquippedAccessories();
      }
      return { text: `Rare unlock: ${item.name}!`, icon: 'star' };
    }
    const amt = 90 + Math.floor(Math.random() * 40);
    game.meta.wallet += amt;
    return { text: `+${amt} coins (all cosmetics owned)`, icon: 'coin' };
  }
  const amt = 200 + Math.floor(Math.random() * 150);
  game.meta.wallet += amt;
  return { text: `JACKPOT! +${amt} coins`, icon: 'trophy' };
}

function renderVaultModal() {
  if (el.vaultCount) el.vaultCount.textContent = `Vaults opened: ${game.meta.stats.vaultOpens}`;
  if (el.openVaultBtn) {
    el.openVaultBtn.textContent = `Open Vault (${VAULT_COST})`;
    el.openVaultBtn.disabled = game.meta.wallet < VAULT_COST;
  }
}

function openVault() {
  if (game.meta.wallet < VAULT_COST) {
    setStatus('Not enough wallet coins for a Vault Key.', 1.2);
    return;
  }
  game.meta.wallet -= VAULT_COST;
  game.meta.stats.vaultOpens += 1;
  sfx.vault();
  vibrate(40);
  if (el.vaultCrate) {
    el.vaultCrate.classList.remove('opened');
    el.vaultCrate.classList.add('shaking');
  }
  if (el.openVaultBtn) el.openVaultBtn.disabled = true;
  setTimeout(() => {
    const reward = rollVaultReward();
    if (el.vaultCrate) {
      el.vaultCrate.classList.remove('shaking');
      el.vaultCrate.classList.add('opened');
    }
    if (el.vaultResult) el.vaultResult.textContent = reward.text;
    showToast(reward.icon, 'Vault Opened', reward.text);
    saveMeta();
    checkAchievements();
    renderVaultModal();
    renderShop();
  }, 420);
}

function toggleVaultModal(forceOpen) {
  if (!el.vaultModal) return;
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : el.vaultModal.hidden;
  el.vaultModal.hidden = !shouldOpen;
  if (shouldOpen) {
    if (el.vaultCrate) el.vaultCrate.classList.remove('opened', 'shaking');
    if (el.vaultResult) el.vaultResult.textContent = '';
    renderVaultModal();
  }
}

function renderClassGrid() {
  if (!el.classGrid) return;
  el.classGrid.innerHTML = Object.keys(CLASSES).map((key) => {
    const c = CLASSES[key];
    const active = game.meta.loadout === key;
    return `
      <button type="button" class="class-card ${active ? 'active' : ''}" data-class="${key}">
        <strong>${escapeHtml(c.name)}</strong>
        <p>${escapeHtml(c.desc)}</p>
        <span class="class-special">Special (Q): ${escapeHtml(c.special)} - ${escapeHtml(c.specialDesc)}</span>
      </button>
    `;
  }).join('');
}

function selectClass(key) {
  if (!CLASSES[key]) return;
  game.meta.loadout = key;
  saveMeta();
  renderClassGrid();
  sfx.shop();
  setStatus(`Loadout set to ${CLASSES[key].name}.`, 1.4);
  if (game.player) {
    game.player.maxHp = playerMaxHealth();
    game.player.hp = Math.min(game.player.hp, game.player.maxHp);
  }
}

function toggleLoadoutModal(forceOpen) {
  if (!el.loadoutModal) return;
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : el.loadoutModal.hidden;
  el.loadoutModal.hidden = !shouldOpen;
  if (shouldOpen) renderClassGrid();
}

function rollRelicChoices() {
  const available = RELICS.filter((r) => !hasRelic(r.key));
  const pool = available.length >= 3 ? available : RELICS;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

function openRelicDraft() {
  if (!el.relicModal) return;
  const choices = rollRelicChoices();
  game._relicChoices = choices;
  if (el.relicGrid) {
    el.relicGrid.innerHTML = choices.map((r, i) => `
      <article class="relic-card" data-relic-idx="${i}">
        <strong>${escapeHtml(r.name)}</strong>
        <p>${escapeHtml(r.desc)}</p>
      </article>
    `).join('');
  }
  el.relicModal.hidden = false;
  game.paused = true;
}

function closeRelicDraft() {
  if (el.relicModal) el.relicModal.hidden = true;
  game.paused = false;
  if (game.pendingLevelTransition) {
    const fn = game.pendingLevelTransition;
    game.pendingLevelTransition = null;
    fn();
  }
}

function pickRelic(idx) {
  const choice = game._relicChoices && game._relicChoices[idx];
  if (choice && !hasRelic(choice.key)) {
    game.runRelics.push(choice.key);
    game.meta.stats.maxRelicsInRun = Math.max(game.meta.stats.maxRelicsInRun, game.runRelics.length);
    checkAchievements();
    sfx.relic();
    showToast('shuffle', 'Relic Acquired', choice.name);
    if (game.player) {
      game.player.maxHp = playerMaxHealth();
      game.player.hp = Math.min(game.player.hp, game.player.maxHp);
    }
  }
  closeRelicDraft();
}

function toggleShop(forceOpen) {
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : el.shop.hidden;
  if (shouldOpen && el.pauseModal && !el.pauseModal.hidden) return;
  el.shop.hidden = !shouldOpen;
  game.paused = shouldOpen;
  if (shouldOpen) {
    renderShop();
    setStatus('Shop open. Buy upgrades.', 999);
  } else {
    setStatus('Running', 0.3);
  }
}

function syncMuteIcon() {
  if (!el.muteBtn) return;
  const use = el.muteBtn.querySelector('use');
  if (use) use.setAttribute('href', game.meta.settings.muted ? '#icon-mute' : '#icon-speaker');
}

function syncSettingButtons() {
  if (el.settingSound) {
    el.settingSound.textContent = game.meta.settings.muted ? 'Off' : 'On';
    el.settingSound.classList.toggle('off', game.meta.settings.muted);
  }
  if (el.settingShake) {
    el.settingShake.textContent = game.meta.settings.screenShake ? 'On' : 'Off';
    el.settingShake.classList.toggle('off', !game.meta.settings.screenShake);
  }
  if (el.settingParticles) {
    el.settingParticles.textContent = game.meta.settings.particleDensity === 'low' ? 'Low' : 'High';
    el.settingParticles.classList.toggle('off', game.meta.settings.particleDensity === 'low');
  }
  syncMuteIcon();
}

function renderPauseStats() {
  if (!el.pauseStats) return;
  const s = game.meta.stats;
  const rows = [
    ['Level Time', formatClock(game.levelElapsed || 0)],
    ['Run Coins', Math.round(game.runCoins)],
    ['Wallet', Math.round(game.meta.wallet)],
    ['Lifetime Coins', Math.round(s.totalCoins)],
    ['Deaths', s.totalDeaths],
    ['Achievements', `${game.meta.achievementsUnlocked.length}/${ACHIEVEMENTS.length}`],
    ['Total Playtime', formatClock(s.totalPlaytime)],
    ['Chests Opened', s.secretsFound]
  ];
  el.pauseStats.innerHTML = rows.map(([label, value]) => `
    <div class="pause-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>
  `).join('');
}

function togglePauseMenu(forceOpen) {
  if (!el.pauseModal) return;
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : el.pauseModal.hidden;
  if (shouldOpen && el.shop && !el.shop.hidden) return;
  el.pauseModal.hidden = !shouldOpen;
  game.paused = shouldOpen;
  if (shouldOpen) {
    renderPauseStats();
    syncSettingButtons();
  }
}

function toggleAchievementsModal(forceOpen) {
  if (!el.achModal) return;
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : el.achModal.hidden;
  el.achModal.hidden = !shouldOpen;
  if (shouldOpen) renderAchievements();
}

function renderBiomeTrack() {
  if (!el.biomeTrack) return;
  if (!el.biomeTrack.children.length) {
    el.biomeTrack.innerHTML = BIOMES.map((b) => `<div class="biome-dot" title="${escapeHtml(b.name)}"></div>`).join('');
  }
  const currentIdx = BIOMES.indexOf(game.biome);
  Array.from(el.biomeTrack.children).forEach((dot, i) => {
    dot.classList.toggle('current', i === currentIdx);
    dot.classList.toggle('done', i < currentIdx);
  });
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
  game.meta.stats.walletSpent += cost;
  if (item.kind === 'cosmetic' && equippedAccessories().length < MAX_EQUIPPED_ACCESSORIES && !accessoryEquipped(key)) {
    game.meta.equippedAccessories.push(key);
    sanitizeEquippedAccessories();
  }
  sfx.shop();
  checkAchievements();
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

let statsSaveTimer = 0;

function step(dt) {
  if (game.paused) return;
  if (game.state !== 'running') return;

  game.time += dt;
  game.levelElapsed = (game.levelElapsed || 0) + dt;
  game.meta.stats.totalPlaytime += dt;
  statsSaveTimer += dt;
  if (statsSaveTimer > 5) {
    statsSaveTimer = 0;
    saveMeta();
    checkAchievements();
  }
  updateMovingPlatforms(dt);
  updatePlayer(dt);
  updateSecretHints(dt);
  updateChests(dt);
  updateEnemies(dt);
  updateBoss(dt);
  updateWeather(dt);
  updateStyle(dt);
  updateGhost(dt);
  updateParticles(dt);
  updateCamera(dt);
  updateCombo(dt);
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

  if (el.muteBtn) {
    el.muteBtn.addEventListener('click', () => {
      ensureAudioCtx();
      game.meta.settings.muted = !game.meta.settings.muted;
      saveMeta();
      syncMuteIcon();
      syncSettingButtons();
      if (!game.meta.settings.muted) sfx.coin();
    });
  }

  if (el.pauseBtn) {
    el.pauseBtn.addEventListener('click', () => togglePauseMenu(true));
  }

  if (el.resumeBtn) {
    el.resumeBtn.addEventListener('click', () => togglePauseMenu(false));
  }

  if (el.pauseRestart) {
    el.pauseRestart.addEventListener('click', () => {
      togglePauseMenu(false);
      restartLevel();
    });
  }

  if (el.pauseModal) {
    el.pauseModal.addEventListener('click', (event) => {
      if (event.target === el.pauseModal) togglePauseMenu(false);
    });
  }

  if (el.achBtn) {
    el.achBtn.addEventListener('click', () => toggleAchievementsModal(true));
  }

  if (el.closeAch) {
    el.closeAch.addEventListener('click', () => toggleAchievementsModal(false));
  }

  if (el.achModal) {
    el.achModal.addEventListener('click', (event) => {
      if (event.target === el.achModal) toggleAchievementsModal(false);
    });
  }

  if (el.loadoutBtn) {
    el.loadoutBtn.addEventListener('click', () => toggleLoadoutModal(true));
  }
  if (el.closeLoadout) {
    el.closeLoadout.addEventListener('click', () => toggleLoadoutModal(false));
  }
  if (el.loadoutModal) {
    el.loadoutModal.addEventListener('click', (event) => {
      if (event.target === el.loadoutModal) {
        toggleLoadoutModal(false);
        return;
      }
      const card = event.target.closest('[data-class]');
      if (card) selectClass(card.dataset.class);
    });
  }

  if (el.vaultBtn) {
    el.vaultBtn.addEventListener('click', () => toggleVaultModal(true));
  }
  if (el.closeVault) {
    el.closeVault.addEventListener('click', () => toggleVaultModal(false));
  }
  if (el.openVaultBtn) {
    el.openVaultBtn.addEventListener('click', () => openVault());
  }
  if (el.vaultModal) {
    el.vaultModal.addEventListener('click', (event) => {
      if (event.target === el.vaultModal) toggleVaultModal(false);
    });
  }

  if (el.relicGrid) {
    el.relicGrid.addEventListener('click', (event) => {
      const card = event.target.closest('[data-relic-idx]');
      if (card) pickRelic(Number(card.dataset.relicIdx));
    });
  }
  if (el.skipRelic) {
    el.skipRelic.addEventListener('click', () => closeRelicDraft());
  }

  document.querySelectorAll('[data-setting]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const setting = btn.dataset.setting;
      if (setting === 'muted') {
        game.meta.settings.muted = !game.meta.settings.muted;
      } else if (setting === 'screenShake') {
        game.meta.settings.screenShake = !game.meta.settings.screenShake;
      } else if (setting === 'particleDensity') {
        game.meta.settings.particleDensity = game.meta.settings.particleDensity === 'low' ? 'high' : 'low';
      }
      saveMeta();
      syncSettingButtons();
    });
  });

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
    dash: ['dash'],
    grapple: ['grapple', 'grapplePressed'],
    special: ['special', 'specialPressed']
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
      if (action === 'grapple') {
        if (isDown && !KEYS.grapple) KEYS.grapplePressed = true;
        KEYS.grapple = isDown;
      }
      if (action === 'special') {
        if (isDown && !KEYS.special) KEYS.specialPressed = true;
        KEYS.special = isDown;
      }
      btn.classList.toggle('active', isDown);
    };

    btn.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      ensureAudioCtx();
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
  syncMuteIcon();
  updateAchBadge();
  checkAchievements();
  requestAnimationFrame(frame);
}

boot();
