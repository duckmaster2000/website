const PF_SAVE_KEY = 'caleb_platformer_meta_v1';

const TILE = 40;
const GRAVITY = 1780;
const TERMINAL_VY = 920;
const BASE_MOVE = 282;
const BASE_JUMP = 700;
const BASE_DASH_FORCE = 620;
const BASE_MAX_HEALTH = 3;
const BASE_LIVES = 3;

const KEYS = {
  left: false,
  right: false,
  up: false,
  dash: false
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
  buffs: document.getElementById('pfBuffs'),
  shop: document.getElementById('pfShop'),
  shopList: document.getElementById('pfShopList'),
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
  }
];

const BASE_LEVELS = [
  {
    name: 'Entry Cavern',
    requiredCoinPct: 0.42,
    map: [
      '####################################################################',
      '#.................C...............................C............E...#',
      '#....C.................###.........................................#',
      '#..........H....................L.L.L..............................#',
      '#.....#######..............C..............####...........G.........#',
      '#..S.................#####.............C...............#####........#',
      '#..........C....................................M..................#',
      '#.........#####..........^..^...^..............#####...............#',
      '#............................####...........C...............B.......#',
      '#....C...........J....................................C.............#',
      '#...........########...............R.............######.............#',
      '#.........................C.......................L.L.L.............#',
      '#..................######.............C.....................C.......#',
      '#......V............................#####.....................#######',
      '####################################################################'
    ]
  },
  {
    name: 'Molten Relay',
    requiredCoinPct: 0.44,
    map: [
      '####################################################################',
      '#S......C.............#####...............C.......................E#',
      '#..........#####...............L.L.L.L..............#####..........#',
      '#....H...................C.................G.......................#',
      '#...........C.....................#####..............C.............#',
      '#.......########......^..^..^..................M...................#',
      '#..C..............#####.....................########...........B....#',
      '#.............C.............R.......................................#',
      '#....#####......................L.L.L.....C......................###',
      '#..........J...........#####..........................C............##',
      '#..................C..............#####....................G.......##',
      '#......V......########.................C...........................##',
      '#.................C...............########.......C.................##',
      '#...........................C.........................#####........###',
      '####################################################################'
    ]
  },
  {
    name: 'Sky Forge',
    requiredCoinPct: 0.46,
    map: [
      '####################################################################',
      '#S....C...............#####...............C.......................E#',
      '#..............B....................#####.............C............#',
      '#....H....#####.............C............................#####......#',
      '#....................L.L.L....G............M.......................#',
      '#......########.............#####....................C..............#',
      '#............C...........R.............C...........#####............#',
      '#.......^..^..^.......#####....................C....................#',
      '#...C.............J..............#####...............B..............#',
      '#........#####.............C..............................#####......#',
      '#..............V.....C...............L.L.L..........G..............#',
      '#....######..................#####..............C...................#',
      '#.............C...............................########.......C......#',
      '#.....................C.............R....................#####......#',
      '####################################################################'
    ]
  },
  {
    name: 'Citadel Core',
    requiredCoinPct: 0.48,
    map: [
      '####################################################################',
      '#S....C...........#####.....................C.....................E#',
      '#..........G..................L.L.L.L.............#####............#',
      '#....H........#####....C.....................M.....................#',
      '#......................####..............C.............B...........#',
      '#......######................R....................######............#',
      '#..............C....^..^..^....#####........C......................#',
      '#..C.................#####.........................####.............#',
      '#.........J.....C..............L.L.L............C..............R....#',
      '#....#####..................########.................#####..........#',
      '#...............V....C....................G.................C.......#',
      '#..........########.................C....................########....#',
      '#...C.....................B.....................C...................#',
      '#.....................#####..............R.............C............#',
      '####################################################################'
    ]
  }
];

function mirrorRow(row) {
  return [...row].reverse().map((ch) => {
    if (ch === 'S') return 'E';
    if (ch === 'E') return 'S';
    return ch;
  }).join('');
}

function mirrorMap(map) {
  return map.map((row) => mirrorRow(row));
}

function softenMap(map, seed) {
  return map.map((row, ry) => [...row].map((ch, rx) => {
    const roll = (rx * 17 + ry * 11 + seed * 23) % 13;

    if ((ch === 'L' || ch === '^') && roll < 5) return '.';
    if ((ch === 'G' || ch === 'B' || ch === 'R') && roll < 6) return '.';
    if ((ch === 'H' || ch === 'J' || ch === 'V' || ch === 'M') && roll < 6) return 'C';

    return ch;
  }).join(''));
}

function powerupsToCoinsMap(map) {
  return map.map((row) => row.replace(/[HJVM]/g, 'C'));
}

function levelMinCoinPct(basePct, delta) {
  return clamp(basePct + delta, 0.24, 0.52);
}

function buildLevelVariants(levelDef, seed) {
  const easyPct = levelDef.requiredCoinPct;
  const softened = softenMap(levelDef.map, seed);
  const noPower = powerupsToCoinsMap(softened);

  return [
    {
      name: `${levelDef.name}`,
      requiredCoinPct: levelMinCoinPct(easyPct, 0),
      map: levelDef.map
    },
    {
      name: `${levelDef.name} Mirror`,
      requiredCoinPct: levelMinCoinPct(easyPct, -0.02),
      map: mirrorMap(levelDef.map)
    },
    {
      name: `${levelDef.name} Drift`,
      requiredCoinPct: levelMinCoinPct(easyPct, -0.05),
      map: softened
    },
    {
      name: `${levelDef.name} No-Power`,
      requiredCoinPct: levelMinCoinPct(easyPct, -0.09),
      map: noPower
    },
    {
      name: `${levelDef.name} Mirror No-Power`,
      requiredCoinPct: levelMinCoinPct(easyPct, -0.11),
      map: mirrorMap(noPower)
    }
  ];
}

const LEVELS = BASE_LEVELS.flatMap((levelDef, idx) => buildLevelVariants(levelDef, idx + 1));

const game = {
  ctx: null,
  levelIndex: 0,
  worldW: 0,
  worldH: 0,
  solids: [],
  lava: [],
  spikes: [],
  coins: [],
  enemies: [],
  enemyShots: [],
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
    if (parsed.upgrades && typeof parsed.upgrades === 'object') {
      SHOP.forEach((item) => {
        game.meta.upgrades[item.key] = clamp(Number(parsed.upgrades[item.key] || 0), 0, item.max);
      });
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
  return 1 + (game.meta.upgrades.tempDuration || 0) * 0.12;
}

function coinValue() {
  return 1 + (game.meta.upgrades.coinBoost || 0) * 0.15;
}

function playerMaxHealth() {
  return BASE_MAX_HEALTH + (game.meta.upgrades.maxHealth || 0);
}

function playerMoveSpeed() {
  return BASE_MOVE * (1 + (game.meta.upgrades.moveSpeed || 0) * 0.08);
}

function playerJumpPower() {
  return BASE_JUMP * (1 + (game.meta.upgrades.jumpPower || 0) * 0.07);
}

function playerStartLives() {
  return BASE_LIVES + (game.meta.upgrades.extraLife || 0);
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
  game.powerups = [];
  game.exit = null;
}

function addEnemy(type, x, y) {
  if (type === 'walker') {
    game.enemies.push({
      type,
      x,
      y,
      w: 28,
      h: 28,
      vx: 90,
      minX: x - 160,
      maxX: x + 160,
      hp: 2,
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
      speed: 70,
      hp: 2,
      hurtCd: 0
    });
  } else if (type === 'shooter') {
    game.enemies.push({
      type,
      x,
      y,
      w: 30,
      h: 30,
      fireCd: 1.1,
      hp: 3,
      hurtCd: 0
    });
  }
}

function parseLevel(index) {
  clearLevel();
  game.levelIndex = index;

  const def = LEVELS[index];
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
    coyote: 0,
    jumpBuffer: 0,
    dashCd: 0,
    dashTime: 0,
    hp: playerMaxHealth(),
    maxHp: playerMaxHealth(),
    lives: playerStartLives(),
    invuln: 0,
    buffs: {
      shield: 0,
      speed: 0,
      jump: 0,
      magnet: 0
    }
  };

  setStatus(`Level ${index + 1}: ${def.name}`, 2.5);
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
  if (key === 'a' || key === 'arrowleft') KEYS.left = true;
  if (key === 'd' || key === 'arrowright') KEYS.right = true;
  if (key === 'w' || key === 'arrowup' || key === ' ') KEYS.up = true;
  if (key === 'shift') KEYS.dash = true;

  if (key === 'r') restartLevel();
  if (key === 'b') toggleShop();
}

function handleInputUp(e) {
  const key = e.key.toLowerCase();
  if (key === 'a' || key === 'arrowleft') KEYS.left = false;
  if (key === 'd' || key === 'arrowright') KEYS.right = false;
  if (key === 'w' || key === 'arrowup' || key === ' ') KEYS.up = false;
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

function gainCoin(amount = 1) {
  const value = Math.max(1, Math.floor(amount * coinValue()));
  game.runCoins += value;
  game.meta.wallet += value;
}

function hurtPlayer(amount = 1) {
  if (game.player.invuln > 0) return;
  if (game.player.buffs.shield > 0) {
    game.player.buffs.shield = Math.max(0, game.player.buffs.shield - 2.4);
    game.player.invuln = 0.45;
    setStatus('Shield absorbed damage.', 0.85);
    return;
  }

  game.player.hp -= amount;
  game.player.invuln = 1.0;
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
  game.player.hp = game.player.maxHp;
  game.player.invuln = 1.2;
}

function restartLevel() {
  parseLevel(game.levelIndex);
}

function nextLevel() {
  if (game.levelIndex + 1 >= LEVELS.length) {
    game.state = 'victory';
    showOverlay('Campaign Cleared', 2.8);
    setStatus('You beat all levels. Replay for more wallet coins.', 4);
    return;
  }

  const next = game.levelIndex + 1;
  if (next + 1 > game.meta.unlockedLevel) {
    game.meta.unlockedLevel = next + 1;
    saveMeta();
  }

  parseLevel(next);
}

function updatePlayer(dt) {
  const p = game.player;
  if (!p || game.state !== 'running') return;

  p.invuln = Math.max(0, p.invuln - dt);
  p.coyote = Math.max(0, p.coyote - dt);
  p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.dashTime = Math.max(0, p.dashTime - dt);

  p.buffs.shield = Math.max(0, p.buffs.shield - dt);
  p.buffs.speed = Math.max(0, p.buffs.speed - dt);
  p.buffs.jump = Math.max(0, p.buffs.jump - dt);
  p.buffs.magnet = Math.max(0, p.buffs.magnet - dt);

  const moveSpeed = playerMoveSpeed() * (p.buffs.speed > 0 ? 1.45 : 1);
  const jumpPower = playerJumpPower() * (p.buffs.jump > 0 ? 1.35 : 1);

  const dir = (KEYS.right ? 1 : 0) - (KEYS.left ? 1 : 0);
  if (dir !== 0) {
    p.vx = clamp(p.vx + dir * 2000 * dt, -moveSpeed, moveSpeed);
    p.facing = dir;
  } else {
    p.vx *= Math.pow(0.0001, dt);
    if (Math.abs(p.vx) < 2) p.vx = 0;
  }

  if (KEYS.up) p.jumpBuffer = 0.13;

  if (p.jumpBuffer > 0 && (p.onGround || p.coyote > 0)) {
    p.vy = -jumpPower;
    p.onGround = false;
    p.coyote = 0;
    p.jumpBuffer = 0;
  }

  if (KEYS.dash && p.dashCd <= 0) {
    p.dashCd = 0.9;
    p.dashTime = 0.15;
    p.vx = p.facing * BASE_DASH_FORCE;
    p.vy *= 0.35;
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
      p.coyote = 0.1;
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
      if (dist < 180 && dist > 0.1) {
        coin.x += (dx / dist) * 230 * dt;
        coin.y += (dy / dist) * 230 * dt;
      }
    }

    if (rectsIntersect(p, coin)) {
      coin.taken = true;
      game.collectedCoins += 1;
      gainCoin(1);
      setStatus('Coin collected.', 0.55);
    }
  }

  // Power-ups.
  for (const item of game.powerups) {
    if (item.taken) continue;
    if (rectsIntersect(p, item)) {
      item.taken = true;
      applyBuff(item.code);
    }
  }

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
        e.fireCd = 1.2 + Math.random() * 0.5;
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

function updateCamera() {
  const p = game.player;
  const viewW = el.canvas.width;
  const viewH = el.canvas.height;
  game.camera.x = clamp(p.x + p.w / 2 - viewW / 2, 0, Math.max(0, game.worldW - viewW));
  game.camera.y = clamp(p.y + p.h / 2 - viewH / 2, 0, Math.max(0, game.worldH - viewH));
}

function updateHud() {
  if (!game.player) return;
  el.level.textContent = `${game.levelIndex + 1} / ${LEVELS.length}`;
  el.health.textContent = `${Math.max(0, game.player.hp)} / ${game.player.maxHp}`;
  el.lives.textContent = game.player.lives;
  el.runCoins.textContent = game.runCoins;
  el.wallet.textContent = Math.floor(game.meta.wallet);
  el.objective.textContent = `Coins ${game.collectedCoins}/${game.requiredCoins} required (${game.totalCoins} total) | Reach portal`;
  el.status.textContent = game.statusText;

  const active = [];
  if (game.player.buffs.shield > 0) active.push(`Shield ${game.player.buffs.shield.toFixed(1)}s`);
  if (game.player.buffs.speed > 0) active.push(`Speed ${game.player.buffs.speed.toFixed(1)}s`);
  if (game.player.buffs.jump > 0) active.push(`Jump ${game.player.buffs.jump.toFixed(1)}s`);
  if (game.player.buffs.magnet > 0) active.push(`Magnet ${game.player.buffs.magnet.toFixed(1)}s`);

  el.buffs.innerHTML = active.map((txt) => `<span class="buff-chip">${txt}</span>`).join('');

  if (game.overlayTimer > 0) {
    game.overlayTimer -= 1 / 60;
    if (game.overlayTimer <= 0 && el.overlay) el.overlay.classList.remove('show');
  }

  if (game.statusTimer > 0) {
    game.statusTimer -= 1 / 60;
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
      ctx.fillStyle = '#ff9f93';
      ctx.fillRect(e.x, e.y, e.w, e.h);
      ctx.fillStyle = '#2c0f17';
      ctx.fillRect(e.x + 5, e.y + 8, 6, 6);
      ctx.fillRect(e.x + e.w - 11, e.y + 8, 6, 6);
    } else if (e.type === 'flyer') {
      ctx.fillStyle = '#a2d6ff';
      ctx.beginPath();
      ctx.ellipse(e.x + e.w / 2, e.y + e.h / 2, e.w / 2, e.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'shooter') {
      ctx.fillStyle = '#f3b8ff';
      ctx.fillRect(e.x, e.y, e.w, e.h);
      ctx.fillStyle = '#3a1a44';
      ctx.fillRect(e.x + 8, e.y + 8, 14, 14);
    }
  }

  for (const shot of game.enemyShots) {
    ctx.fillStyle = '#ffb371';
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, shot.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player.
  const p = game.player;
  ctx.save();
  if (p.invuln > 0) {
    const blink = Math.sin(game.time * 24) > 0 ? 0.35 : 1;
    ctx.globalAlpha = blink;
  }
  ctx.fillStyle = p.buffs.shield > 0 ? '#9efeff' : '#92ffce';
  ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.fillStyle = '#0f2235';
  ctx.fillRect(p.x + (p.facing > 0 ? p.w - 10 : 4), p.y + 9, 6, 6);
  ctx.fillRect(p.x + 6, p.y + p.h - 7, p.w - 12, 4);
  if (p.buffs.shield > 0) {
    ctx.strokeStyle = 'rgba(158, 254, 255, 0.75)';
    ctx.beginPath();
    ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 24, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

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
  saveMeta();

  if (game.player) {
    const prevMax = game.player.maxHp;
    game.player.maxHp = playerMaxHealth();
    if (game.player.maxHp > prevMax) {
      game.player.hp = game.player.maxHp;
    }
  }

  renderShop();
  setStatus(`${item.name} upgraded to Lv${game.meta.upgrades[key]}.`, 1.3);
}

function renderShop() {
  el.wallet.textContent = Math.floor(game.meta.wallet);
  el.shopList.innerHTML = SHOP.map((item) => {
    const lvl = game.meta.upgrades[item.key] || 0;
    const maxed = lvl >= item.max;
    const cost = shopCost(item);
    const disabled = maxed || game.meta.wallet < cost;

    return `
      <article class="shop-item">
        <div>
          <strong>${item.name} (Lv ${lvl}/${item.max})</strong>
          <p>${item.desc}</p>
        </div>
        <button data-upgrade="${item.key}" ${disabled ? 'disabled' : ''}>
          ${maxed ? 'MAX' : `Buy (${cost})`}
        </button>
      </article>
    `;
  }).join('');
}

function step(dt) {
  if (game.paused) return;
  if (game.state !== 'running') return;

  game.time += dt;
  updatePlayer(dt);
  updateEnemies(dt);
  updateCamera();
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  step(dt);
  render();
  updateHud();

  requestAnimationFrame(frame);
}

function bindEvents() {
  window.addEventListener('keydown', handleInputDown);
  window.addEventListener('keyup', handleInputUp);

  if (el.closeShop) {
    el.closeShop.addEventListener('click', () => toggleShop(false));
  }

  if (el.shopList) {
    el.shopList.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-upgrade]');
      if (!btn) return;
      buyUpgrade(btn.dataset.upgrade);
    });
  }
}

function boot() {
  if (!el.canvas) return;

  game.ctx = el.canvas.getContext('2d');
  loadMeta();
  bindEvents();
  parseLevel(0);
  updateCamera();
  renderShop();
  updateHud();
  requestAnimationFrame(frame);
}

boot();
