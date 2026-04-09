const PROTOTYPE_PASSWORD = '1ydzpU1y!';
const PROTOTYPE_KEY = 'prototype_access_v1';
const PROTOTYPE_UPGRADE_KEY = 'prototype_upgrades_v1';

const UNIT_TYPES = {
  scout: { name: 'Scout', cost: 2, hp: 55, dmg: 10, range: 8, speed: 27, cd: 0.52, structureMult: 0.85, cool: 1.8 },
  brawler: { name: 'Brawler', cost: 4, hp: 145, dmg: 17, range: 9, speed: 13, cd: 0.78, structureMult: 1, cool: 2.8 },
  siege: { name: 'Siege', cost: 6, hp: 96, dmg: 37, range: 18, speed: 8, cd: 1.22, structureMult: 1.65, cool: 4.1 },
  guardian: { name: 'Guardian', cost: 5, hp: 120, dmg: 9, range: 10, speed: 10, cd: 0.95, structureMult: 1, cool: 3.4 }
};

const BOARD = {
  laneCount: 3,
  laneHeight: 100,
  spawnA: 6,
  spawnB: 94,
  towerX: { A: 24, B: 76 },
  baseX: { A: 2, B: 98 },
  width: 100
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
  nextId: 1,
  players: {
    A: null,
    B: null
  },
  meta: {
    gold: 0,
    upgrades: { baseHp: 0, towerDamage: 0, energyRegen: 0 }
  }
};

const ui = {
  lockPanel: null,
  content: null,
  password: null,
  unlock: null,
  error: null,
  board: null,
  units: null,
  structures: null,
  deckA: null,
  deckB: null,
  mode: null,
  start: null,
  resetUpgrades: null,
  log: null,
  status: {
    A: {
      name: null,
      base: null,
      tower: null,
      energy: null,
      gold: null
    },
    B: {
      name: null,
      base: null,
      tower: null,
      energy: null,
      gold: null
    }
  },
  costs: {
    base: null,
    tower: null,
    regen: null
  }
};

function $(id) {
  return document.getElementById(id);
}

function unlockPrototype() {
  if (ui.lockPanel) ui.lockPanel.hidden = true;
  if (ui.content) ui.content.hidden = false;
  bindGameEvents();
  loadUpgrades();
  setupMatch();
  requestAnimationFrame(gameLoop);
}

function createPlayer(id, mode) {
  const regenUpgrade = state.meta.upgrades.energyRegen;
  const isB = id === 'B';
  return {
    id,
    name: isB ? (mode === 'ai' ? 'Enemy AI' : 'Commander B') : 'Commander A',
    baseHpMax: 1300 + state.meta.upgrades.baseHp * 120,
    baseHp: 1300 + state.meta.upgrades.baseHp * 120,
    energyMax: 10,
    energy: 10,
    energyRegen: 2.2 + regenUpgrade * 0.25,
    towerDamage: 12 + state.meta.upgrades.towerDamage * 2,
    cooldowns: {
      scout: 0,
      brawler: 0,
      siege: 0,
      guardian: 0
    },
    rewardDamagePool: 0
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
  state.nextId = 1;
  state.players.A = createPlayer('A', state.mode);
  state.players.B = createPlayer('B', state.mode);

  for (let lane = 0; lane < BOARD.laneCount; lane += 1) {
    state.structures.push({
      id: `tower-A-${lane}`,
      owner: 'A',
      lane,
      x: BOARD.towerX.A,
      hpMax: 320,
      hp: 320,
      kind: 'tower',
      cd: 0
    });
    state.structures.push({
      id: `tower-B-${lane}`,
      owner: 'B',
      lane,
      x: BOARD.towerX.B,
      hpMax: 320,
      hp: 320,
      kind: 'tower',
      cd: 0
    });
  }

  state.structures.push({
    id: 'base-A',
    owner: 'A',
    lane: 1,
    x: BOARD.baseX.A,
    hpMax: state.players.A.baseHpMax,
    hp: state.players.A.baseHp,
    kind: 'base',
    cd: 0
  });
  state.structures.push({
    id: 'base-B',
    owner: 'B',
    lane: 1,
    x: BOARD.baseX.B,
    hpMax: state.players.B.baseHpMax,
    hp: state.players.B.baseHp,
    kind: 'base',
    cd: 0
  });

  writeLog(`Match started: ${state.mode === 'ai' ? '1v1 vs Enemy AI' : '1v1 Local PvP'}.`);
  renderDecks();
  renderStructures();
  renderStatus();
  renderUnits();
}

function laneY(lane) {
  return lane * BOARD.laneHeight + BOARD.laneHeight / 2;
}

function enemyOf(owner) {
  return owner === 'A' ? 'B' : 'A';
}

function livingStructures(owner, lane, kind) {
  return state.structures.filter((s) => s.owner === owner && s.hp > 0 && (lane == null || s.lane === lane) && (!kind || s.kind === kind));
}

function nearestEnemyUnit(unit) {
  const foe = enemyOf(unit.owner);
  let best = null;
  let bestDist = Infinity;
  state.units.forEach((other) => {
    if (other.owner !== foe || other.lane !== unit.lane || other.hp <= 0) return;
    const d = Math.abs(other.x - unit.x);
    if (d < bestDist) {
      best = other;
      bestDist = d;
    }
  });
  if (bestDist <= unit.stats.range) return best;
  return null;
}

function primaryEnemyStructure(unit) {
  const foe = enemyOf(unit.owner);
  const foeTowers = livingStructures(foe, unit.lane, 'tower');
  if (foeTowers.length > 0) {
    return foeTowers[0];
  }
  return livingStructures(foe, null, 'base')[0] || null;
}

function guardianReduction(owner, lane, x) {
  let reduce = 0;
  state.units.forEach((u) => {
    if (u.owner !== owner || u.type !== 'guardian' || u.lane !== lane || u.hp <= 0) return;
    if (Math.abs(u.x - x) <= 10) reduce = Math.max(reduce, 0.23);
  });
  return reduce;
}

function awardGold(owner, amount) {
  const add = Math.max(0, Math.floor(amount));
  state.meta.gold += add;
}

function dealDamage(attacker, target, amount, isStructure) {
  if (!target || target.hp <= 0 || amount <= 0) return;
  let dmg = amount;
  if (!isStructure) {
    const reduction = guardianReduction(target.owner, target.lane, target.x);
    dmg *= (1 - reduction);
  }
  target.hp -= dmg;
  if (attacker && attacker.owner === 'A') {
    attacker.rewardPool = (attacker.rewardPool || 0) + dmg * 0.018;
    if (attacker.rewardPool >= 1) {
      awardGold('A', attacker.rewardPool);
      attacker.rewardPool = 0;
    }
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function deployUnit(owner, type, lane) {
  if (!state.running) return false;
  const def = UNIT_TYPES[type];
  const player = state.players[owner];
  if (!def || !player) return false;
  if (lane < 0 || lane >= BOARD.laneCount) return false;
  if (player.energy < def.cost) return false;
  if (player.cooldowns[type] > state.time) return false;

  player.energy -= def.cost;
  player.cooldowns[type] = state.time + def.cool;

  state.units.push({
    id: `u-${state.nextId++}`,
    owner,
    lane,
    type,
    stats: def,
    hp: def.hp,
    x: owner === 'A' ? BOARD.spawnA : BOARD.spawnB,
    attackCd: 0,
    rewardPool: 0
  });

  renderDecks();
  renderStatus();
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
    const enemy = nearestEnemyUnit(u);
    const structure = primaryEnemyStructure(u);
    u.attackCd -= dt;

    if (enemy) {
      if (u.attackCd <= 0) {
        dealDamage(u, enemy, u.stats.dmg, false);
        u.attackCd = u.stats.cd;
      }
      return;
    }

    if (structure) {
      const dist = Math.abs(structure.x - u.x);
      if (dist <= u.stats.range) {
        if (u.attackCd <= 0) {
          const mult = structure.kind === 'base' || structure.kind === 'tower' ? u.stats.structureMult : 1;
          dealDamage(u, structure, u.stats.dmg * mult, true);
          u.attackCd = u.stats.cd;
        }
      } else {
        const dir = u.owner === 'A' ? 1 : -1;
        u.x += dir * u.stats.speed * dt;
      }
    }
  });

  state.units = state.units.filter((u) => u.hp > 0 && u.x >= -3 && u.x <= 103);
}

function updateStructures(dt) {
  state.structures.forEach((s) => {
    if (s.hp <= 0) return;
    s.cd -= dt;
    const foe = enemyOf(s.owner);
    let target = null;
    let bestDist = Infinity;
    const range = s.kind === 'base' ? 14 : 22;
    const dmg = s.kind === 'base' ? 16 : state.players[s.owner].towerDamage;

    state.units.forEach((u) => {
      if (u.owner !== foe || u.lane !== s.lane || u.hp <= 0) return;
      const dist = Math.abs(u.x - s.x);
      if (dist <= range && dist < bestDist) {
        bestDist = dist;
        target = u;
      }
    });

    if (target && s.cd <= 0) {
      dealDamage(null, target, dmg, false);
      s.cd = s.kind === 'base' ? 0.7 : 0.9;
    }
  });
}

function syncBaseHealth() {
  const baseA = state.structures.find((s) => s.id === 'base-A');
  const baseB = state.structures.find((s) => s.id === 'base-B');
  state.players.A.baseHp = baseA ? Math.max(0, baseA.hp) : 0;
  state.players.B.baseHp = baseB ? Math.max(0, baseB.hp) : 0;
}

function aiStep(dt) {
  if (!state.running || state.mode !== 'ai') return;
  state.aiTimer -= dt;
  if (state.aiTimer > 0) return;
  state.aiTimer = 0.55 + Math.random() * 0.55;

  const p = state.players.B;
  const options = Object.keys(UNIT_TYPES).filter((key) => {
    const def = UNIT_TYPES[key];
    return p.energy >= def.cost && p.cooldowns[key] <= state.time;
  });
  if (options.length === 0) return;

  const laneThreat = [0, 0, 0];
  state.units.forEach((u) => {
    if (u.owner !== 'A' || u.hp <= 0) return;
    laneThreat[u.lane] += (100 - u.x) * 0.1 + u.hp * 0.04;
  });

  let lane = 1;
  if (Math.random() < 0.72) {
    lane = laneThreat.indexOf(Math.max(...laneThreat));
  } else {
    lane = Math.floor(Math.random() * BOARD.laneCount);
  }

  const heavy = laneThreat[lane] > 11;
  const pref = heavy ? ['brawler', 'guardian', 'siege', 'scout'] : ['scout', 'brawler', 'siege', 'guardian'];
  const type = pref.find((key) => options.includes(key)) || options[0];
  deployUnit('B', type, lane);
}

function livingTowerCount(owner) {
  return livingStructures(owner, null, 'tower').length;
}

function renderStatus() {
  const A = state.players.A;
  const B = state.players.B;
  if (!A || !B) return;

  ui.status.A.name.textContent = A.name;
  ui.status.B.name.textContent = B.name;
  ui.status.A.base.textContent = `Base ${Math.ceil(A.baseHp)} / ${A.baseHpMax}`;
  ui.status.B.base.textContent = `Base ${Math.ceil(B.baseHp)} / ${B.baseHpMax}`;
  ui.status.A.tower.textContent = `Towers ${livingTowerCount('A')} / 3`;
  ui.status.B.tower.textContent = `Towers ${livingTowerCount('B')} / 3`;
  ui.status.A.energy.textContent = `Energy ${A.energy.toFixed(1)} / ${A.energyMax}`;
  ui.status.B.energy.textContent = `Energy ${B.energy.toFixed(1)} / ${B.energyMax}`;
  ui.status.A.gold.textContent = `Gold ${state.meta.gold}`;
  ui.status.B.gold.textContent = state.mode === 'ai' ? 'Enemy AI' : 'Gold local';

  const baseCost = 120 + state.meta.upgrades.baseHp * 80;
  const towerCost = 95 + state.meta.upgrades.towerDamage * 70;
  const regenCost = 110 + state.meta.upgrades.energyRegen * 90;
  ui.costs.base.textContent = baseCost;
  ui.costs.tower.textContent = towerCost;
  ui.costs.regen.textContent = regenCost;
}

function renderStructures() {
  const chunks = [];
  state.structures.forEach((s) => {
    const y = laneY(s.lane);
    const enemyClass = s.owner === 'B' ? 'enemy' : '';
    const kindClass = s.kind === 'base' ? 'base' : 'tower';
    const hpPercent = clamp((s.hp / s.hpMax) * 100, 0, 100);
    chunks.push(
      `<div class="structure ${enemyClass} ${kindClass}" style="left:${s.x}%;top:${y}px;opacity:${s.hp > 0 ? '1' : '0.25'}">` +
      `<span class="hp"><i style="width:${hpPercent}%"></i></span>` +
      '</div>'
    );
  });
  ui.structures.innerHTML = chunks.join('');
}

function renderUnits() {
  const chunks = [];
  state.units.forEach((u) => {
    const y = laneY(u.lane) + (u.owner === 'A' ? 14 : -14);
    const hpPercent = clamp((u.hp / u.stats.hp) * 100, 0, 100);
    chunks.push(
      `<div class="unit owner${u.owner}" data-type="${u.type}" style="left:${u.x}%;top:${y}px">` +
      `<span class="hp"><i style="width:${hpPercent}%"></i></span>` +
      '</div>'
    );
  });
  ui.units.innerHTML = chunks.join('');
}

function cardTemplate(owner, key) {
  const def = UNIT_TYPES[key];
  const p = state.players[owner];
  const onCd = p.cooldowns[key] > state.time;
  const disabled = !state.running || p.energy < def.cost || onCd;
  const cooldownText = onCd ? `${(p.cooldowns[key] - state.time).toFixed(1)}s` : 'Ready';
  const selected = state.selectedCard && state.selectedCard.owner === owner && state.selectedCard.type === key;
  return (
    `<button class="card" data-owner="${owner}" data-type="${key}" draggable="true" data-disabled="${disabled ? '1' : '0'}" data-selected="${selected ? '1' : '0'}">` +
    `<span class="name">${def.name}</span>` +
    `<span class="meta">Cost ${def.cost} | HP ${def.hp}</span>` +
    `<span class="meta">${cooldownText}</span>` +
    '</button>'
  );
}

function renderDecks() {
  if (!state.players.A || !state.players.B) return;
  const keys = Object.keys(UNIT_TYPES);
  ui.deckA.innerHTML = keys.map((key) => cardTemplate('A', key)).join('');
  if (state.mode === 'ai') {
    ui.deckB.innerHTML = '<div class="note">Enemy AI controls this deck in real time.</div>';
  } else {
    ui.deckB.innerHTML = keys.map((key) => cardTemplate('B', key)).join('');
  }
}

function writeLog(msg) {
  if (ui.log) ui.log.textContent = msg;
}

function handleVictory(winnerOwner) {
  if (!state.running || state.winner) return;
  state.winner = winnerOwner;
  state.running = false;
  const winnerName = state.players[winnerOwner].name;
  const bonus = winnerOwner === 'A' ? 140 : 0;
  if (bonus > 0) state.meta.gold += bonus;
  saveUpgrades();
  writeLog(`${winnerName} wins the duel.${bonus ? ` +${bonus} gold reward.` : ''} Press Start Match for rematch.`);
  renderDecks();
  renderStatus();
}

function resolveDeathsAndVictory() {
  state.structures.forEach((s) => {
    if (s.hp < 0) s.hp = 0;
  });
  syncBaseHealth();
  if (state.players.A.baseHp <= 0) handleVictory('B');
  if (state.players.B.baseHp <= 0) handleVictory('A');
}

function update(dt) {
  if (!state.running) return;
  state.time += dt;
  updateEnergy(dt);
  aiStep(dt);
  updateUnits(dt);
  updateStructures(dt);
  resolveDeathsAndVictory();
}

function gameLoop(ts) {
  if (!state.lastTick) state.lastTick = ts;
  const dt = clamp((ts - state.lastTick) / 1000, 0, 0.045);
  state.lastTick = ts;
  update(dt);
  renderStatus();
  renderDecks();
  renderUnits();
  renderStructures();
  requestAnimationFrame(gameLoop);
}

function tryDeployFromSelection(lane) {
  if (!state.selectedCard) return;
  const ok = deployUnit(state.selectedCard.owner, state.selectedCard.type, lane);
  if (ok) {
    writeLog(`${state.players[state.selectedCard.owner].name} deployed ${UNIT_TYPES[state.selectedCard.type].name} in ${['Top', 'Mid', 'Bot'][lane]} lane.`);
    state.selectedCard = null;
  }
}

function bindLaneDrops() {
  ui.board.querySelectorAll('.lane').forEach((laneEl) => {
    laneEl.addEventListener('dragover', (event) => {
      event.preventDefault();
      laneEl.dataset.drop = '1';
    });
    laneEl.addEventListener('dragleave', () => {
      laneEl.dataset.drop = '0';
    });
    laneEl.addEventListener('drop', (event) => {
      event.preventDefault();
      laneEl.dataset.drop = '0';
      const lane = Number(laneEl.dataset.lane);
      const owner = event.dataTransfer?.getData('text/owner');
      const type = event.dataTransfer?.getData('text/type');
      if (!owner || !type) return;
      if (state.mode === 'ai' && owner === 'B') return;
      const ok = deployUnit(owner, type, lane);
      if (ok) writeLog(`${state.players[owner].name} deployed ${UNIT_TYPES[type].name} in ${['Top', 'Mid', 'Bot'][lane]} lane.`);
    });
    laneEl.addEventListener('click', () => {
      const lane = Number(laneEl.dataset.lane);
      tryDeployFromSelection(lane);
      renderDecks();
    });
  });
}

function bindDeckInput() {
  const onDeckInteract = (event) => {
    const card = event.target.closest('.card');
    if (!card) return;
    const owner = card.dataset.owner;
    const type = card.dataset.type;
    if (!owner || !type) return;
    if (card.dataset.disabled === '1') return;
    if (state.mode === 'ai' && owner === 'B') return;
    state.selectedCard = { owner, type };
    renderDecks();
  };

  ui.deckA.addEventListener('click', onDeckInteract);
  ui.deckB.addEventListener('click', onDeckInteract);

  document.addEventListener('dragstart', (event) => {
    const card = event.target.closest('.card');
    if (!card || card.dataset.disabled === '1') return;
    const owner = card.dataset.owner;
    if (state.mode === 'ai' && owner === 'B') {
      event.preventDefault();
      return;
    }
    event.dataTransfer?.setData('text/owner', owner);
    event.dataTransfer?.setData('text/type', card.dataset.type || '');
  });
}

function loadUpgrades() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROTOTYPE_UPGRADE_KEY) || '{}');
    if (saved && typeof saved === 'object') {
      state.meta.gold = clamp(Number(saved.gold || 0), 0, 999999);
      state.meta.upgrades.baseHp = clamp(Number(saved.upgrades?.baseHp || 0), 0, 20);
      state.meta.upgrades.towerDamage = clamp(Number(saved.upgrades?.towerDamage || 0), 0, 20);
      state.meta.upgrades.energyRegen = clamp(Number(saved.upgrades?.energyRegen || 0), 0, 20);
    }
  } catch (_e) {
    // Ignore broken local save.
  }
}

function saveUpgrades() {
  try {
    localStorage.setItem(PROTOTYPE_UPGRADE_KEY, JSON.stringify(state.meta));
  } catch (_e) {
    // Ignore localStorage failures.
  }
}

function upgradeCost(key) {
  const lvl = state.meta.upgrades[key] || 0;
  if (key === 'baseHp') return 120 + lvl * 80;
  if (key === 'towerDamage') return 95 + lvl * 70;
  return 110 + lvl * 90;
}

function buyUpgrade(key) {
  const cost = upgradeCost(key);
  if (state.meta.gold < cost) {
    writeLog('Not enough gold for that upgrade.');
    return;
  }
  state.meta.gold -= cost;
  state.meta.upgrades[key] += 1;
  saveUpgrades();
  writeLog(`Upgrade purchased: ${key}.`);
  renderStatus();
}

function bindGameEvents() {
  bindLaneDrops();
  bindDeckInput();

  ui.start?.addEventListener('click', () => {
    setupMatch();
  });

  ui.resetUpgrades?.addEventListener('click', () => {
    state.meta = { gold: 0, upgrades: { baseHp: 0, towerDamage: 0, energyRegen: 0 } };
    saveUpgrades();
    setupMatch();
    writeLog('Upgrades and prototype gold reset.');
  });

  document.querySelectorAll('[data-upgrade]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.getAttribute('data-upgrade');
      if (!key) return;
      buyUpgrade(key);
    });
  });
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
  ui.costs.base = $('ptCostBase');
  ui.costs.tower = $('ptCostTower');
  ui.costs.regen = $('ptCostRegen');
}

function boot() {
  cacheUi();

  try {
    if (localStorage.getItem(PROTOTYPE_KEY) === 'ok') {
      unlockPrototype();
      return;
    }
  } catch (_) {}

  const tryUnlock = () => {
    const value = String(ui.password?.value || '');
    if (value !== PROTOTYPE_PASSWORD) {
      if (ui.error) ui.error.hidden = false;
      return;
    }
    try {
      localStorage.setItem(PROTOTYPE_KEY, 'ok');
    } catch (_) {}
    if (ui.error) ui.error.hidden = true;
    unlockPrototype();
  };

  ui.unlock?.addEventListener('click', tryUnlock);
  ui.password?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') tryUnlock();
  });
}

boot();
