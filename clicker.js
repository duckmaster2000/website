const SAVE_KEY = 'caleb_clicker_save_v4_space';
const LEGACY_SAVE_KEY = 'caleb_clicker_save_v3';

const BUILDINGS = [
    { id: 'drone', name: 'Scout Drone', baseCost: 15, baseGps: 0.2, img: 'clicker-white.png', desc: 'Tiny orbit scouts gather crystal dust.' },
    { id: 'miner', name: 'Moon Miner', baseCost: 60, baseGps: 1.1, img: 'miner.png', desc: 'Old-school bots extract moon gems.' },
    { id: 'forge', name: 'Crystal Forge', baseCost: 260, baseGps: 6.5, img: 'factory.png', desc: 'Industrial smelters process star ore.' },
    { id: 'lab', name: 'Nebula Lab', baseCost: 1200, baseGps: 26, img: 'potion.png', desc: 'Chem-tech labs refine unstable matter.' },
    { id: 'rig', name: 'Asteroid Rig', baseCost: 6200, baseGps: 108, img: 'pickaxe.png', desc: 'Multi-arm rigs mine drifting asteroids.' },
    { id: 'port', name: 'Quantum Port', baseCost: 33000, baseGps: 430, img: 'clicker.png', desc: 'Warp ports trade gem cargo nonstop.' },
    { id: 'reactor', name: 'Dark Reactor', baseCost: 185000, baseGps: 1850, img: 'skill1.png', desc: 'Reactor stacks synthesize dense gems.' },
    { id: 'cluster', name: 'Dyson Cluster', baseCost: 1020000, baseGps: 7800, img: 'gem.png', desc: 'Solar swarms beam direct gem energy.' },
    { id: 'bakery', name: 'Star Bakery', baseCost: 5600000, baseGps: 31500, img: 'question.png', desc: 'Themed cosmic bakery lines print gems.' },
    { id: 'core', name: 'Singularity Core', baseCost: 30000000, baseGps: 128000, img: 'gem.png', desc: 'Endgame gravity engines bend matter.' }
];

function buildResearchData() {
    const out = [];
    BUILDINGS.forEach((b, idx) => {
        out.push({
            id: `${b.id}_chip_a`,
            name: `${b.name} Tuning Chip`,
            desc: `${b.name} output +40%`,
            target: b.id,
            mult: 1.4,
            cost: Math.round(b.baseCost * 13 + idx * 20),
            img: b.img
        });
        out.push({
            id: `${b.id}_chip_b`,
            name: `${b.name} Hyper Chip`,
            desc: `${b.name} output +90%`,
            target: b.id,
            mult: 1.9,
            cost: Math.round(b.baseCost * 68 + idx * 200),
            img: b.img
        });
    });

    out.push({
        id: 'global_grid_sync',
        name: 'Grid Sync Matrix',
        desc: 'All buildings +18% output',
        target: 'globalGps',
        amount: 1.18,
        cost: 22000,
        img: 'factory.png'
    });
    out.push({
        id: 'global_lucky_lens',
        name: 'Lucky Lens',
        desc: 'Golden gem chance +2.5%',
        target: 'goldenChance',
        amount: 0.025,
        cost: 91000,
        img: 'gem.png'
    });
    out.push({
        id: 'global_plasma_glove',
        name: 'Plasma Glove',
        desc: 'Gems per click +2 and crit +8%',
        target: 'clickAndCrit',
        amount: 1,
        cost: 360000,
        img: 'clicker-white.png'
    });
    out.push({
        id: 'global_defense_training',
        name: 'Defense Academy',
        desc: 'Tower defense starts with +4 tokens',
        target: 'tdTokens',
        amount: 4,
        cost: 1400000,
        img: 'skill1.png'
    });

    return out;
}

const RESEARCH = buildResearchData();

const el = {
    gem: document.querySelector('.gem-cost'),
    gpcValue: document.querySelector('.gpc-value'),
    gpsValue: document.querySelector('.gps-value'),
    buildingTotal: document.querySelector('.building-total'),
    researchTotal: document.querySelector('.research-total'),
    comboValue: document.querySelector('.combo-value'),
    frenzyValue: document.querySelector('.frenzy-value'),
    tdWins: document.querySelector('.td-wins'),
    comboFill: document.querySelector('.combo-fill'),
    gemButton: document.querySelector('.gem-button'),
    goldenGem: document.querySelector('.golden-gem'),
    floatingLayer: document.querySelector('.floating-layer'),
    buyFeedback: document.getElementById('buyFeedback'),

    buildingList: document.getElementById('buildingList'),
    researchList: document.getElementById('researchList'),

    secretInput: document.getElementById('secretCodeInput'),
    secretBtn: document.getElementById('secretCodeBtn'),
    secretFeedback: document.getElementById('secretFeedback'),

    achievementList: document.getElementById('achievementList'),

    tdStartBtn: document.getElementById('tdStartBtn'),
    tdResetBtn: document.getElementById('tdResetBtn'),
    tdCanvas: document.getElementById('tdCanvas'),
    tdBaseHp: document.getElementById('tdBaseHp'),
    tdWave: document.getElementById('tdWave'),
    tdTokens: document.getElementById('tdTokens'),
    tdKills: document.getElementById('tdKills'),
    tdFeedback: document.getElementById('tdFeedback'),

    clickSound: document.getElementById('click-sound'),
    upgradeSound: document.getElementById('upgrade-sound')
};

const DEFAULTS = {
    gems: 0,
    lifetimeGems: 0,
    gpc: 1,
    critChance: 0.04,
    critMultiplier: 2,
    goldenChance: 0.05,
    frenzyTime: 0,
    secretRedeemed: false,

    globalGpsMult: 1,
    tdBonusTokens: 0,
    tdWins: 0,
    tdBestKills: 0,

    buildings: {},
    buildingCosts: {},
    buildingMults: {},
    researchBought: {}
};

BUILDINGS.forEach((b) => {
    DEFAULTS.buildings[b.id] = 0;
    DEFAULTS.buildingCosts[b.id] = b.baseCost;
    DEFAULTS.buildingMults[b.id] = 1;
});

const state = {
    ...structuredClone(DEFAULTS),
    gps: 0,

    comboCount: 0,
    comboMultiplier: 1,
    lastClickTime: 0,
    goldenGemActive: false,

    researchCount: 0
};

const td = {
    running: false,
    width: 560,
    height: 220,
    cell: 35,
    cols: 16,
    rows: 6,
    pathRows: new Set([1, 2, 3, 4]),

    baseHp: 20,
    wave: 0,
    kills: 0,
    elapsed: 0,
    tokens: 0,

    spawnClock: 0,
    towers: [],
    enemies: [],
    shots: [],

    intervalId: null,
    secondId: null
};

const ACHIEVEMENTS = [
    { id: 'first_click', label: 'First Spark', check: () => state.lifetimeGems >= 10 },
    { id: 'starter_bank', label: 'Gem Pouch', check: () => state.gems >= 1000 },
    { id: 'combo_master', label: 'Combo Cadet', check: () => state.comboCount >= 20 },
    { id: 'small_fleet', label: 'Fleet Seeded', check: () => totalBuildings() >= 25 },
    { id: 'fleet_100', label: 'Fleet x100', check: () => totalBuildings() >= 100 },
    { id: 'fleet_300', label: 'Fleet x300', check: () => totalBuildings() >= 300 },
    { id: 'research_5', label: 'Chip Collector', check: () => state.researchCount >= 5 },
    { id: 'research_15', label: 'Tech Architect', check: () => state.researchCount >= 15 },
    { id: 'research_24', label: 'Full Catalog', check: () => state.researchCount >= 24 },
    { id: 'moon_miner_25', label: 'Moon Crew', check: () => state.buildings.miner >= 25 },
    { id: 'reactor_10', label: 'Reactor Works', check: () => state.buildings.reactor >= 10 },
    { id: 'core_1', label: 'Core Online', check: () => state.buildings.core >= 1 },
    { id: 'rich_1m', label: 'Seven Digits', check: () => state.lifetimeGems >= 1000000 },
    { id: 'rich_100m', label: 'Nine Digits', check: () => state.lifetimeGems >= 100000000 },
    { id: 'secret', label: 'Override Accepted', check: () => state.secretRedeemed },
    { id: 'td_win_1', label: 'First Defense', check: () => state.tdWins >= 1 },
    { id: 'td_win_5', label: 'Defense Veteran', check: () => state.tdWins >= 5 },
    { id: 'td_kills_80', label: 'Monster Sweeper', check: () => state.tdBestKills >= 80 }
];

let feedbackTimer = null;
let achievementTick = -1;

function fmt(n) {
    return Math.floor(n).toLocaleString();
}

function fmtDec(n, d = 1) {
    const out = Number(n).toFixed(d);
    return out.replace(/\.0+$/, '');
}

function safeSet(node, value) {
    if (node) node.textContent = value;
}

function totalBuildings() {
    return BUILDINGS.reduce((sum, b) => sum + state.buildings[b.id], 0);
}

function recomputeGps() {
    let total = 0;
    BUILDINGS.forEach((b) => {
        const count = state.buildings[b.id];
        const mult = state.buildingMults[b.id] * state.globalGpsMult;
        total += count * b.baseGps * mult;
    });
    state.gps = total;
}

function addGems(amount) {
    const safe = Number.isFinite(amount) ? amount : 0;
    state.gems += safe;
    state.lifetimeGems += safe;
}

function playSound(audioEl, volume) {
    if (!audioEl) return;
    audioEl.volume = volume;
    audioEl.currentTime = 0;
    audioEl.play().catch(() => {});
}

function showFloat(x, y, text, variant) {
    if (!el.floatingLayer) return;
    const node = document.createElement('span');
    node.className = variant ? `floating-text ${variant}` : 'floating-text';
    node.textContent = text;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    el.floatingLayer.appendChild(node);
    setTimeout(() => node.remove(), 900);
}

function showBuyFeedback(msg) {
    if (!el.buyFeedback) return;
    el.buyFeedback.textContent = msg;
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => {
        if (el.buyFeedback) el.buyFeedback.textContent = '';
    }, 2000);
}

function deepCopyDefaults() {
    return {
        ...structuredClone(DEFAULTS),
        buildings: { ...DEFAULTS.buildings },
        buildingCosts: { ...DEFAULTS.buildingCosts },
        buildingMults: { ...DEFAULTS.buildingMults },
        researchBought: {}
    };
}

function validateState() {
    const fresh = deepCopyDefaults();

    Object.keys(fresh).forEach((key) => {
        if (typeof fresh[key] === 'number') {
            if (!Number.isFinite(state[key])) state[key] = fresh[key];
            if (state[key] < 0 && key !== 'frenzyTime') state[key] = fresh[key];
        } else if (typeof fresh[key] === 'boolean') {
            if (typeof state[key] !== 'boolean') state[key] = fresh[key];
        }
    });

    BUILDINGS.forEach((b) => {
        if (!Number.isFinite(state.buildings[b.id]) || state.buildings[b.id] < 0) {
            state.buildings[b.id] = 0;
        }
        if (!Number.isFinite(state.buildingCosts[b.id]) || state.buildingCosts[b.id] < b.baseCost) {
            state.buildingCosts[b.id] = b.baseCost;
        }
        if (!Number.isFinite(state.buildingMults[b.id]) || state.buildingMults[b.id] < 1) {
            state.buildingMults[b.id] = 1;
        }
    });

    if (!state.researchBought || typeof state.researchBought !== 'object') {
        state.researchBought = {};
    }

    state.critChance = Math.min(Math.max(state.critChance, 0), 0.95);
    state.goldenChance = Math.min(Math.max(state.goldenChance, 0.01), 0.85);
    state.researchCount = Object.keys(state.researchBought).length;

    state.comboCount = 0;
    state.comboMultiplier = 1;
    state.lastClickTime = 0;
    state.goldenGemActive = false;

    recomputeGps();
}

function saveGame() {
    const toSave = {
        gems: state.gems,
        lifetimeGems: state.lifetimeGems,
        gpc: state.gpc,
        critChance: state.critChance,
        critMultiplier: state.critMultiplier,
        goldenChance: state.goldenChance,
        frenzyTime: state.frenzyTime,
        secretRedeemed: state.secretRedeemed,
        globalGpsMult: state.globalGpsMult,
        tdBonusTokens: state.tdBonusTokens,
        tdWins: state.tdWins,
        tdBestKills: state.tdBestKills,
        buildings: state.buildings,
        buildingCosts: state.buildingCosts,
        buildingMults: state.buildingMults,
        researchBought: state.researchBought
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(toSave));
}

function applyLegacyMigration(v3) {
    state.gems = Number(v3.gems || 0);
    state.lifetimeGems = Number(v3.lifetimeGems || state.gems);
    state.gpc = Number(v3.gpc || 1);
    state.critChance = Number(v3.critChance || 0.04);
    state.critMultiplier = Number(v3.critMultiplier || 2);
    state.goldenChance = Number(v3.goldenChance || 0.05);
    state.secretRedeemed = Boolean(v3.secretRedeemed);

    state.buildings.drone = Number(v3.clickerLevel || 0);
    state.buildings.miner = Number(v3.minerLevel || 0);
    state.buildings.forge = Number(v3.factoryLevel || 0);
    state.buildings.lab = Number(v3.alchemyLevel || 0);

    BUILDINGS.forEach((b) => {
        const count = state.buildings[b.id];
        state.buildingCosts[b.id] = Math.round(b.baseCost * Math.pow(1.15, count));
    });
}

function loadGame() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            Object.assign(state, parsed);
            state.buildings = { ...DEFAULTS.buildings, ...(parsed.buildings || {}) };
            state.buildingCosts = { ...DEFAULTS.buildingCosts, ...(parsed.buildingCosts || {}) };
            state.buildingMults = { ...DEFAULTS.buildingMults, ...(parsed.buildingMults || {}) };
            state.researchBought = { ...(parsed.researchBought || {}) };
            validateState();
            return;
        } catch (_e) {
            localStorage.removeItem(SAVE_KEY);
        }
    }

    const legacyRaw = localStorage.getItem(LEGACY_SAVE_KEY);
    if (!legacyRaw) {
        validateState();
        return;
    }

    try {
        const legacy = JSON.parse(legacyRaw);
        applyLegacyMigration(legacy);
        validateState();
        localStorage.removeItem(LEGACY_SAVE_KEY);
        saveGame();
    } catch (_e) {
        localStorage.removeItem(LEGACY_SAVE_KEY);
        validateState();
    }
}

function buildingProduction(b) {
    const mult = state.buildingMults[b.id] * state.globalGpsMult;
    return b.baseGps * mult;
}

function canAfford(cost) {
    return Number.isFinite(cost) && state.gems >= cost;
}

function renderBuildings() {
    if (!el.buildingList) return;

    const html = BUILDINGS.map((b) => {
        const count = state.buildings[b.id];
        const nextCost = state.buildingCosts[b.id];
        const eachGps = buildingProduction(b);
        const disabled = canAfford(nextCost) ? '' : 'disabled';
        const totalGps = eachGps * count;

        return `
            <button class="building ${disabled}" data-building="${b.id}" type="button">
                <div class="icon-wrap"><img src="${b.img}" alt="${b.name}" draggable="false"></div>
                <div class="building-main">
                    <h4>${b.name}</h4>
                    <p>${b.desc}</p>
                    <div class="meta-row">
                        <span>Cost: ${fmt(nextCost)}</span>
                        <span>Each: +${fmtDec(eachGps, 2)} gps</span>
                        <span>Total: +${fmtDec(totalGps, 2)} gps</span>
                    </div>
                </div>
                <div class="side-amount">
                    <span>Owned</span>
                    <strong>${fmt(count)}</strong>
                </div>
            </button>
        `;
    }).join('');

    el.buildingList.innerHTML = html;
}

function renderResearch() {
    if (!el.researchList) return;

    const html = RESEARCH.map((r) => {
        const bought = Boolean(state.researchBought[r.id]);
        const disabled = bought || !canAfford(r.cost) ? 'disabled' : '';
        const boughtClass = bought ? 'bought' : '';

        return `
            <button class="research ${disabled} ${boughtClass}" data-research="${r.id}" type="button">
                <div class="icon-wrap"><img src="${r.img}" alt="${r.name}" draggable="false"></div>
                <div class="research-main">
                    <h4>${r.name}</h4>
                    <p>${r.desc}</p>
                </div>
                <div class="side-amount">
                    <span>${bought ? 'Installed' : 'Cost'}</span>
                    <strong>${bought ? 'DONE' : fmt(r.cost)}</strong>
                </div>
            </button>
        `;
    }).join('');

    el.researchList.innerHTML = html;
}

function renderAchievements() {
    const now = Math.floor(Date.now() / 1000);
    if (now === achievementTick) return;
    achievementTick = now;

    if (!el.achievementList) return;
    el.achievementList.innerHTML = '';

    ACHIEVEMENTS.forEach((a) => {
        const unlocked = a.check();
        const badge = document.createElement('span');
        badge.className = unlocked ? 'badge' : 'badge locked';
        badge.textContent = a.label;
        el.achievementList.appendChild(badge);
    });
}

function renderCoreStats() {
    safeSet(el.gem, fmt(state.gems));
    safeSet(el.gpcValue, fmtDec(state.gpc, 2));
    safeSet(el.gpsValue, fmtDec(state.gps, 2));
    safeSet(el.buildingTotal, fmt(totalBuildings()));
    safeSet(el.researchTotal, fmt(state.researchCount));
    safeSet(el.comboValue, `x${fmtDec(state.comboMultiplier, 2)}`);
    safeSet(el.frenzyValue, state.frenzyTime > 0 ? `${Math.ceil(state.frenzyTime)}s` : 'OFF');
    safeSet(el.tdWins, fmt(state.tdWins));

    if (el.comboFill) {
        const width = Math.min((state.comboCount / 25) * 100, 100);
        el.comboFill.style.width = `${width}%`;
    }

    document.body.classList.toggle('frenzy', state.frenzyTime > 0);
}

function renderTdStats() {
    safeSet(el.tdBaseHp, td.baseHp);
    safeSet(el.tdWave, td.wave);
    safeSet(el.tdTokens, td.tokens);
    safeSet(el.tdKills, td.kills);
}

function renderAll() {
    recomputeGps();
    renderCoreStats();
    renderBuildings();
    renderResearch();
    renderAchievements();
    renderTdStats();
}

function pulseGem() {
    if (!el.gemButton) return;
    el.gemButton.classList.add('burst');
    setTimeout(() => el.gemButton.classList.remove('burst'), 120);
}

function clickGem(event) {
    const now = Date.now();
    if (now - state.lastClickTime < 520) {
        state.comboCount += 1;
    } else {
        state.comboCount = 1;
    }
    state.lastClickTime = now;

    state.comboMultiplier = 1 + Math.min(state.comboCount * 0.04, 1.8);

    const frenzyMult = state.frenzyTime > 0 ? 2 : 1;
    const isCrit = Math.random() < state.critChance;
    const critMult = isCrit ? state.critMultiplier : 1;
    const gain = state.gpc * state.comboMultiplier * frenzyMult * critMult;

    addGems(gain);
    playSound(el.clickSound, 0.35);
    pulseGem();

    if (event) {
        showFloat(event.clientX, event.clientY, `+${fmtDec(gain, 1)}`, isCrit ? 'crit' : '');
    }

    renderAll();
    saveGame();
}

function spawnGoldenGem() {
    if (state.goldenGemActive) return;
    state.goldenGemActive = true;
    if (el.goldenGem) el.goldenGem.classList.remove('hidden');

    setTimeout(() => {
        if (!state.goldenGemActive) return;
        state.goldenGemActive = false;
        if (el.goldenGem) el.goldenGem.classList.add('hidden');
    }, 7000);
}

function collectGoldenGem() {
    if (!state.goldenGemActive) return;

    const bonus = Math.max(100, state.gps * 8 + state.gpc * 20);
    addGems(bonus);
    state.frenzyTime += 8;
    state.goldenGemActive = false;
    if (el.goldenGem) el.goldenGem.classList.add('hidden');

    if (el.goldenGem) {
        const rect = el.goldenGem.getBoundingClientRect();
        showFloat(rect.left + rect.width / 2, rect.top + rect.height / 2, `+${fmt(bonus)} SOLAR`, 'golden');
    }

    playSound(el.upgradeSound, 0.56);
    renderAll();
    saveGame();
}

function buyBuilding(id) {
    const building = BUILDINGS.find((b) => b.id === id);
    if (!building) return;

    const cost = state.buildingCosts[id];
    if (!canAfford(cost)) {
        showBuyFeedback(`Need ${fmt(Math.ceil(cost - state.gems))} more gems for ${building.name}.`);
        return;
    }

    state.gems -= cost;
    state.buildings[id] += 1;
    state.buildingCosts[id] = Math.round(cost * 1.15 + state.buildings[id] * 0.25);

    showBuyFeedback(`${building.name} purchased. Fleet size is now ${fmt(totalBuildings())}.`);
    playSound(el.upgradeSound, 0.48);
    renderAll();
    saveGame();
}

function buyResearch(id) {
    const research = RESEARCH.find((r) => r.id === id);
    if (!research) return;

    if (state.researchBought[id]) {
        showBuyFeedback('Research already installed.');
        return;
    }

    if (!canAfford(research.cost)) {
        showBuyFeedback(`Need ${fmt(Math.ceil(research.cost - state.gems))} more gems for this research.`);
        return;
    }

    state.gems -= research.cost;
    state.researchBought[id] = true;
    state.researchCount += 1;

    if (research.target === 'globalGps') {
        state.globalGpsMult *= research.amount;
    } else if (research.target === 'goldenChance') {
        state.goldenChance = Math.min(0.85, state.goldenChance + research.amount);
    } else if (research.target === 'clickAndCrit') {
        state.gpc += 2;
        state.critChance = Math.min(0.95, state.critChance + 0.08);
    } else if (research.target === 'tdTokens') {
        state.tdBonusTokens += research.amount;
    } else {
        state.buildingMults[research.target] *= research.mult;
    }

    showBuyFeedback(`${research.name} installed.`);
    playSound(el.upgradeSound, 0.6);
    renderAll();
    saveGame();
}

function applySecretCode() {
    if (!el.secretInput) return;

    const code = el.secretInput.value.trim().toLowerCase();
    if (code !== 'caleb') {
        if (el.secretFeedback) el.secretFeedback.textContent = 'Invalid code.';
        return;
    }

    if (state.secretRedeemed) {
        if (el.secretFeedback) el.secretFeedback.textContent = 'Code already redeemed.';
        return;
    }

    state.secretRedeemed = true;
    addGems(9000);
    state.gpc += 8;
    state.critChance = Math.min(0.95, state.critChance + 0.12);
    state.goldenChance = Math.min(0.85, state.goldenChance + 0.05);
    state.frenzyTime += 30;

    state.buildings.drone += 5;
    state.buildings.miner += 3;
    state.buildings.forge += 2;

    BUILDINGS.forEach((b) => {
        const minCost = b.baseCost;
        state.buildingCosts[b.id] = Math.max(minCost, Math.round(b.baseCost * Math.pow(1.15, state.buildings[b.id])));
    });

    if (el.secretInput) el.secretInput.value = '';
    if (el.secretFeedback) el.secretFeedback.textContent = 'Override accepted. Hidden cache delivered.';

    playSound(el.upgradeSound, 0.72);
    renderAll();
    saveGame();
}

function passiveIncomeTick() {
    if (state.gps > 0) {
        addGems(state.gps / 5);
        safeSet(el.gem, fmt(state.gems));
    }
}

function timedTick() {
    if (state.frenzyTime > 0) {
        state.frenzyTime = Math.max(0, state.frenzyTime - 1);
    }

    if (!state.goldenGemActive && Math.random() < state.goldenChance) {
        spawnGoldenGem();
    }

    if (Date.now() - state.lastClickTime > 1400) {
        state.comboCount = Math.max(0, state.comboCount - 2);
        state.comboMultiplier = 1 + Math.min(state.comboCount * 0.04, 1.8);
    }

    renderAll();
    saveGame();
}

function tdResetState() {
    td.baseHp = 20;
    td.wave = 0;
    td.kills = 0;
    td.elapsed = 0;
    td.spawnClock = 0;
    td.towers = [];
    td.enemies = [];
    td.shots = [];
    td.tokens = Math.max(3, Math.floor(totalBuildings() / 4) + state.tdBonusTokens + Math.floor(state.tdWins / 2));
    renderTdStats();
}

function tdLaneY(row) {
    return row * td.cell + td.cell / 2;
}

function tdSpawnEnemy() {
    const laneRows = [1, 2, 3, 4];
    const lane = laneRows[Math.floor(Math.random() * laneRows.length)];
    const hp = 10 + td.wave * 1.4;
    const speed = 24 + td.wave * 1.8;

    td.enemies.push({
        x: -15,
        y: tdLaneY(lane),
        hp,
        maxHp: hp,
        speed
    });
}

function tdFindEnemyForTower(tower) {
    let best = null;
    let bestDist = Infinity;

    td.enemies.forEach((enemy) => {
        const dx = enemy.x - tower.x;
        const dy = enemy.y - tower.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= tower.range && dist < bestDist) {
            bestDist = dist;
            best = enemy;
        }
    });

    return best;
}

function tdUpdate(delta) {
    td.elapsed += delta;
    td.wave = 1 + Math.floor(td.elapsed / 6);

    td.spawnClock += delta;
    const spawnEvery = Math.max(0.32, 1.2 - td.wave * 0.02);
    if (td.spawnClock >= spawnEvery) {
        td.spawnClock = 0;
        tdSpawnEnemy();
    }

    td.towers.forEach((tower) => {
        tower.cooldown -= delta;
        if (tower.cooldown > 0) return;

        const target = tdFindEnemyForTower(tower);
        if (!target) return;

        tower.cooldown = tower.fireRate;
        td.shots.push({
            x: tower.x,
            y: tower.y,
            tx: target.x,
            ty: target.y,
            damage: tower.damage,
            speed: 280
        });
    });

    td.shots.forEach((shot) => {
        const dx = shot.tx - shot.x;
        const dy = shot.ty - shot.y;
        const dist = Math.hypot(dx, dy) || 1;
        const step = shot.speed * delta;
        shot.x += (dx / dist) * step;
        shot.y += (dy / dist) * step;
    });

    td.enemies.forEach((enemy) => {
        enemy.x += enemy.speed * delta;
    });

    for (let i = td.shots.length - 1; i >= 0; i -= 1) {
        const shot = td.shots[i];
        let hit = false;

        for (let j = td.enemies.length - 1; j >= 0; j -= 1) {
            const enemy = td.enemies[j];
            const dist = Math.hypot(enemy.x - shot.x, enemy.y - shot.y);
            if (dist < 10) {
                enemy.hp -= shot.damage;
                hit = true;
                if (enemy.hp <= 0) {
                    td.enemies.splice(j, 1);
                    td.kills += 1;
                }
                break;
            }
        }

        if (hit) {
            td.shots.splice(i, 1);
        }
    }

    for (let i = td.enemies.length - 1; i >= 0; i -= 1) {
        if (td.enemies[i].x > td.width - 15) {
            td.enemies.splice(i, 1);
            td.baseHp -= 1;
        }
    }

    if (td.baseHp <= 0) {
        tdFinish(false);
        return;
    }

    if (td.elapsed >= 60) {
        tdFinish(true);
        return;
    }

    renderTdStats();
    tdDraw();
}

function tdDraw() {
    if (!el.tdCanvas) return;
    const ctx = el.tdCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, td.width, td.height);

    ctx.fillStyle = '#0c203b';
    ctx.fillRect(0, 0, td.width, td.height);

    for (let r = 0; r < td.rows; r += 1) {
        const y = r * td.cell;
        if (td.pathRows.has(r)) {
            ctx.fillStyle = 'rgba(255, 150, 120, 0.12)';
            ctx.fillRect(0, y, td.width, td.cell);
        }
        ctx.strokeStyle = 'rgba(180, 220, 255, 0.12)';
        ctx.strokeRect(0, y, td.width, td.cell);
    }

    for (let c = 0; c <= td.cols; c += 1) {
        const x = c * td.cell;
        ctx.strokeStyle = 'rgba(180, 220, 255, 0.09)';
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, td.height);
        ctx.stroke();
    }

    ctx.fillStyle = '#7df59d';
    ctx.fillRect(td.width - 12, 0, 12, td.height);

    td.towers.forEach((tower) => {
        ctx.fillStyle = '#55f1ff';
        ctx.fillRect(tower.x - 9, tower.y - 9, 18, 18);
        ctx.fillStyle = '#b6ffea';
        ctx.fillRect(tower.x - 2, tower.y - 13, 4, 10);
    });

    td.enemies.forEach((enemy) => {
        ctx.fillStyle = '#ff7f74';
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, 8, 0, Math.PI * 2);
        ctx.fill();

        const ratio = Math.max(0, enemy.hp / enemy.maxHp);
        ctx.fillStyle = '#1b0d12';
        ctx.fillRect(enemy.x - 9, enemy.y - 13, 18, 3);
        ctx.fillStyle = '#87ff99';
        ctx.fillRect(enemy.x - 9, enemy.y - 13, 18 * ratio, 3);
    });

    td.shots.forEach((shot) => {
        ctx.fillStyle = '#ffe173';
        ctx.beginPath();
        ctx.arc(shot.x, shot.y, 3, 0, Math.PI * 2);
        ctx.fill();
    });
}

function tdFinish(victory) {
    td.running = false;

    if (td.intervalId) clearInterval(td.intervalId);
    if (td.secondId) clearInterval(td.secondId);
    td.intervalId = null;
    td.secondId = null;

    state.tdBestKills = Math.max(state.tdBestKills, td.kills);

    if (victory) {
        state.tdWins += 1;
        const reward = Math.round(state.gps * 14 + totalBuildings() * 42 + td.kills * 8 + 300);
        addGems(reward);
        state.frenzyTime += 10;
        if (el.tdFeedback) {
            el.tdFeedback.textContent = `Defense success! Reward +${fmt(reward)} gems.`;
        }
    } else if (el.tdFeedback) {
        el.tdFeedback.textContent = `Defense failed at wave ${td.wave}. Rebuild and try again.`;
    }

    renderAll();
    saveGame();
}

function tdStart() {
    if (td.running) {
        if (el.tdFeedback) el.tdFeedback.textContent = 'Defense already active.';
        return;
    }

    tdResetState();
    td.running = true;
    if (el.tdFeedback) el.tdFeedback.textContent = 'Defense started. Place towers by clicking open cells.';

    const frameMs = 50;
    td.intervalId = setInterval(() => tdUpdate(frameMs / 1000), frameMs);
    td.secondId = setInterval(() => renderTdStats(), 1000);
    tdDraw();
}

function tdResetGrid() {
    if (td.running) {
        if (el.tdFeedback) el.tdFeedback.textContent = 'Cannot reset while defense is active.';
        return;
    }
    tdResetState();
    tdDraw();
    if (el.tdFeedback) el.tdFeedback.textContent = 'Defense grid reset.';
}

function tdPlaceTower(evt) {
    if (!td.running || !el.tdCanvas) return;

    const rect = el.tdCanvas.getBoundingClientRect();
    const scaleX = td.width / rect.width;
    const scaleY = td.height / rect.height;

    const x = (evt.clientX - rect.left) * scaleX;
    const y = (evt.clientY - rect.top) * scaleY;

    const col = Math.floor(x / td.cell);
    const row = Math.floor(y / td.cell);

    if (col < 0 || col >= td.cols || row < 0 || row >= td.rows) return;

    if (td.pathRows.has(row)) {
        if (el.tdFeedback) el.tdFeedback.textContent = 'Cannot build on monster path rows.';
        return;
    }

    if (td.tokens <= 0) {
        if (el.tdFeedback) el.tdFeedback.textContent = 'No tower tokens left this run.';
        return;
    }

    const occupied = td.towers.some((t) => t.col === col && t.row === row);
    if (occupied) {
        if (el.tdFeedback) el.tdFeedback.textContent = 'Tower already exists on this cell.';
        return;
    }

    const tower = {
        col,
        row,
        x: col * td.cell + td.cell / 2,
        y: row * td.cell + td.cell / 2,
        range: 122,
        fireRate: 0.52,
        cooldown: 0,
        damage: 8 + Math.floor(totalBuildings() / 80)
    };

    td.towers.push(tower);
    td.tokens -= 1;
    renderTdStats();
    tdDraw();
}

function bindEvents() {
    if (el.gemButton) el.gemButton.addEventListener('click', clickGem);
    if (el.goldenGem) el.goldenGem.addEventListener('click', collectGoldenGem);

    if (el.buildingList) {
        el.buildingList.addEventListener('click', (event) => {
            const button = event.target.closest('[data-building]');
            if (!button) return;
            buyBuilding(button.dataset.building);
        });
    }

    if (el.researchList) {
        el.researchList.addEventListener('click', (event) => {
            const button = event.target.closest('[data-research]');
            if (!button) return;
            buyResearch(button.dataset.research);
        });
    }

    if (el.secretBtn) el.secretBtn.addEventListener('click', applySecretCode);
    if (el.secretInput) {
        el.secretInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') applySecretCode();
        });
    }

    if (el.tdStartBtn) el.tdStartBtn.addEventListener('click', tdStart);
    if (el.tdResetBtn) el.tdResetBtn.addEventListener('click', tdResetGrid);
    if (el.tdCanvas) el.tdCanvas.addEventListener('click', tdPlaceTower);
}

function boot() {
    loadGame();
    bindEvents();
    tdResetState();
    tdDraw();
    renderAll();

    setInterval(passiveIncomeTick, 200);
    setInterval(timedTick, 1000);
}

boot();
