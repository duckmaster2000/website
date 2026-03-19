const SAVE_KEY = 'caleb_clicker_save_v6_space';
const LEGACY_V5_KEY = 'caleb_clicker_save_v5_space';
const LEGACY_V4_KEY = 'caleb_clicker_save_v4_space';
const LEGACY_V3_KEY = 'caleb_clicker_save_v3';
const LEADERBOARD_KEY = 'calyx_space_global_leaderboard_v1';
const LEADERBOARD_LIMIT = 30;

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
    { id: 'core', name: 'Singularity Core', baseCost: 30000000, baseGps: 128000, img: 'gem.png', desc: 'Endgame gravity engines bend matter.' },
    { id: 'mirror', name: 'Prism Mirror Array', baseCost: 170000000, baseGps: 520000, img: 'gem.png', desc: 'Hyper prisms split starlight into gem streams.' },
    { id: 'harvester', name: 'Comet Harvester', baseCost: 980000000, baseGps: 2100000, img: 'pickaxe.png', desc: 'Autonomous hooks mine comet tails mid-warp.' },
    { id: 'chrono', name: 'Chrono Vault', baseCost: 5600000000, baseGps: 8600000, img: 'question.png', desc: 'Time loops compound production windows.' },
    { id: 'hive', name: 'Void Hive', baseCost: 31000000000, baseGps: 34500000, img: 'skill1.png', desc: 'Nanite swarms convert dark matter into gems.' },
    { id: 'temple', name: 'Aurora Temple', baseCost: 180000000000, baseGps: 140000000, img: 'potion.png', desc: 'Solar chants stabilize rare aurora crystals.' },
    { id: 'anchor', name: 'Gravity Anchor', baseCost: 1000000000000, baseGps: 565000000, img: 'factory.png', desc: 'Planetary anchors compress ore at absurd pressure.' },
    { id: 'citadel', name: 'Starlord Citadel', baseCost: 5800000000000, baseGps: 2250000000, img: 'clicker.png', desc: 'Command citadels orchestrate sector-wide extraction.' },
    { id: 'engine', name: 'Entropy Engine', baseCost: 34000000000000, baseGps: 9000000000, img: 'gem.png', desc: 'Controlled collapse yields pure entropy shards.' },
    { id: 'archive', name: 'Archive Planet', baseCost: 195000000000000, baseGps: 36000000000, img: 'question.png', desc: 'Entire worlds catalog and print gem formulas.' },
    { id: 'rift', name: 'Rift Conduit', baseCost: 1120000000000000, baseGps: 146000000000, img: 'skill1.png', desc: 'Interdimensional funnels route exotic gem matter.' },
    { id: 'throne', name: 'Cosmic Throne', baseCost: 6500000000000000, baseGps: 590000000000, img: 'gem.png', desc: 'Dominion cores mint gems from stellar law.' }
];

const TOWER_TYPES = {
    laser: {
        name: 'Laser Tower',
        tokenCost: 1,
        range: 120,
        fireRate: 0.36,
        damage: 6,
        color: '#5cf5ff'
    },
    cannon: {
        name: 'Cannon Tower',
        tokenCost: 2,
        range: 105,
        fireRate: 0.8,
        damage: 17,
        splash: 26,
        color: '#ffbc66'
    },
    frost: {
        name: 'Frost Tower',
        tokenCost: 2,
        range: 116,
        fireRate: 0.58,
        damage: 4,
        slowAmount: 0.32,
        slowTime: 1.15,
        color: '#95d1ff'
    },
    tesla: {
        name: 'Tesla Tower',
        tokenCost: 3,
        range: 125,
        fireRate: 0.62,
        damage: 9,
        chain: 2,
        color: '#c6b4ff'
    },
    missile: {
        name: 'Missile Tower',
        tokenCost: 4,
        range: 160,
        fireRate: 1.15,
        damage: 28,
        splash: 38,
        color: '#ff9c90'
    }
};

const ENEMY_TYPES = {
    scout: { hpMult: 0.85, speedMult: 1.45, reward: 1, radius: 7, color: '#ff8c74' },
    brute: { hpMult: 2.4, speedMult: 0.67, reward: 3, radius: 10, color: '#ff596d' },
    splitter: { hpMult: 1.2, speedMult: 1.05, reward: 2, radius: 8, color: '#d98eff', split: true },
    shield: { hpMult: 1.8, speedMult: 0.9, reward: 3, radius: 9, color: '#9eff90', armor: 0.24 },
    boss: { hpMult: 7.4, speedMult: 0.55, reward: 14, radius: 13, color: '#ffd16e', armor: 0.12 }
};

const TD_DIFFICULTIES = {
    easy: {
        label: 'Easy',
        enemyHpMult: 0.9,
        enemySpeedMult: 0.92,
        spawnCountMult: 0.9,
        spawnRateMult: 0.88,
        playerHpMult: 1.2,
        tokenMult: 1.18,
        energyGainMult: 1.2,
        baseLeakDamage: 1,
        bossEvery: 6,
        victoryWave: 16,
        strikeCost: 20
    },
    medium: {
        label: 'Medium',
        enemyHpMult: 1.35,
        enemySpeedMult: 1.08,
        spawnCountMult: 1.2,
        spawnRateMult: 1.12,
        playerHpMult: 0.92,
        tokenMult: 0.94,
        energyGainMult: 0.95,
        baseLeakDamage: 1,
        bossEvery: 5,
        victoryWave: 20,
        strikeCost: 25
    },
    hard: {
        label: 'Hard',
        enemyHpMult: 1.9,
        enemySpeedMult: 1.22,
        spawnCountMult: 1.5,
        spawnRateMult: 1.32,
        playerHpMult: 0.82,
        tokenMult: 0.85,
        energyGainMult: 0.82,
        baseLeakDamage: 2,
        bossEvery: 4,
        victoryWave: 24,
        strikeCost: 29
    },
    veryhard: {
        label: 'Very Hard',
        enemyHpMult: 2.7,
        enemySpeedMult: 1.38,
        spawnCountMult: 1.95,
        spawnRateMult: 1.55,
        playerHpMult: 0.72,
        tokenMult: 0.74,
        energyGainMult: 0.72,
        baseLeakDamage: 2,
        bossEvery: 3,
        victoryWave: 28,
        strikeCost: 34
    },
    insane: {
        label: 'Insane',
        enemyHpMult: 3.6,
        enemySpeedMult: 1.62,
        spawnCountMult: 2.3,
        spawnRateMult: 1.85,
        playerHpMult: 0.62,
        tokenMult: 0.64,
        energyGainMult: 0.62,
        baseLeakDamage: 3,
        bossEvery: 3,
        victoryWave: 32,
        strikeCost: 40
    }
};

function buildResearchData() {
    const list = [];
    const tiers = [
        { suffix: 'Mk-I', mult: 1.25, cost: 11 },
        { suffix: 'Mk-II', mult: 1.45, cost: 22 },
        { suffix: 'Mk-III', mult: 1.7, cost: 46 },
        { suffix: 'Mk-IV', mult: 2.05, cost: 98 },
        { suffix: 'Mk-V', mult: 2.45, cost: 190 },
        { suffix: 'Mk-VI', mult: 2.95, cost: 360 },
        { suffix: 'Mk-VII', mult: 3.55, cost: 700 }
    ];

    BUILDINGS.forEach((b, idx) => {
        tiers.forEach((tier, tierIdx) => {
            list.push({
                id: `${b.id}_chip_${tierIdx + 1}`,
                name: `${b.name} ${tier.suffix}`,
                desc: `${b.name} output x${tier.mult.toFixed(2)}`,
                target: b.id,
                mult: tier.mult,
                cost: Math.round(b.baseCost * tier.cost + idx * 180 * (tierIdx + 1)),
                img: b.img
            });
        });
    });

    const globals = [
        { id: 'global_grid_sync_1', name: 'Grid Sync Matrix', desc: 'All buildings +15%', target: 'globalGps', amount: 1.15, cost: 24000, img: 'factory.png' },
        { id: 'global_grid_sync_2', name: 'Grid Sync Matrix II', desc: 'All buildings +22%', target: 'globalGps', amount: 1.22, cost: 190000, img: 'factory.png' },
        { id: 'global_grid_sync_3', name: 'Grid Sync Matrix III', desc: 'All buildings +35%', target: 'globalGps', amount: 1.35, cost: 2400000, img: 'factory.png' },
        { id: 'global_lucky_lens', name: 'Lucky Lens', desc: 'Golden gem chance +2.5%', target: 'goldenChance', amount: 0.025, cost: 85000, img: 'gem.png' },
        { id: 'global_lucky_lens_2', name: 'Lucky Lens II', desc: 'Golden gem chance +3.5%', target: 'goldenChance', amount: 0.035, cost: 900000, img: 'gem.png' },
        { id: 'global_plasma_glove', name: 'Plasma Glove', desc: 'Gems per click +3 and crit +7%', target: 'clickAndCrit', amount: 1, cost: 370000, img: 'clicker-white.png' },
        { id: 'global_plasma_glove_2', name: 'Plasma Glove II', desc: 'Gems per click +8 and crit +8%', target: 'clickAndCrit2', amount: 1, cost: 4200000, img: 'clicker-white.png' },
        { id: 'global_combo_relay', name: 'Combo Relay', desc: 'Combo cap raised and decay slowed', target: 'combo', amount: 1, cost: 1200000, img: 'clicker.png' },
        { id: 'global_defense_training', name: 'Defense Academy', desc: 'Tower defense starts with +5 tokens', target: 'tdTokens', amount: 5, cost: 1400000, img: 'skill1.png' },
        { id: 'global_defense_ai', name: 'Defense AI', desc: 'Tower damage +10% permanently', target: 'tdDamage', amount: 0.1, cost: 3200000, img: 'skill1.png' },
        { id: 'global_defense_ai_2', name: 'Defense AI II', desc: 'Tower damage +14% permanently', target: 'tdDamage', amount: 0.14, cost: 41000000, img: 'skill1.png' },
        { id: 'global_energy_core', name: 'Energy Core', desc: 'TD energy gain +25%', target: 'tdEnergy', amount: 0.25, cost: 7200000, img: 'gem.png' },
        { id: 'global_energy_core_2', name: 'Energy Core II', desc: 'TD energy gain +35%', target: 'tdEnergy', amount: 0.35, cost: 92000000, img: 'gem.png' },
        { id: 'global_wave_divider', name: 'Wave Divider', desc: 'Enemies spawn slightly slower', target: 'tdSpawnSlow', amount: 0.08, cost: 9800000, img: 'question.png' },
        { id: 'global_wave_divider_2', name: 'Wave Divider II', desc: 'Enemies spawn slower again', target: 'tdSpawnSlow', amount: 0.12, cost: 145000000, img: 'question.png' },
        { id: 'global_orbital_reactor', name: 'Orbital Reactor', desc: 'Start each defense with +20 energy', target: 'tdStartEnergy', amount: 20, cost: 65000000, img: 'factory.png' },
        { id: 'global_tower_logistics', name: 'Tower Logistics', desc: 'Start each defense with +3 tokens', target: 'tdTokens', amount: 3, cost: 72000000, img: 'clicker.png' },
        { id: 'global_photon_glove', name: 'Photon Glove', desc: 'Gems per click +22 and crit +5%', target: 'clickAndCrit3', amount: 1, cost: 138000000, img: 'clicker-white.png' },
        { id: 'global_combo_core', name: 'Combo Core', desc: 'Combo cap +0.7 and slower decay', target: 'combo2', amount: 1, cost: 84000000, img: 'clicker.png' }
    ];

    return list.concat(globals);
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
    prestigeShardsMini: document.querySelector('.prestige-shards'),
    prestigeMultMini: document.querySelector('.prestige-mult'),
    comboFill: document.querySelector('.combo-fill'),
    gemButton: document.querySelector('.gem-button'),
    goldenGem: document.querySelector('.golden-gem'),
    floatingLayer: document.querySelector('.floating-layer'),
    buyFeedback: document.getElementById('buyFeedback'),

    buildingList: document.getElementById('buildingList'),
    buildingBulkMode: document.getElementById('buildingBulkMode'),
    researchList: document.getElementById('researchList'),
    buyAllUpgradesBtn: document.getElementById('buyAllUpgradesBtn'),

    prestigeShards: document.getElementById('prestigeShards'),
    prestigeGain: document.getElementById('prestigeGain'),
    prestigeGpsBonus: document.getElementById('prestigeGpsBonus'),
    prestigeTdBonus: document.getElementById('prestigeTdBonus'),
    prestigeBtn: document.getElementById('prestigeBtn'),

    secretInput: document.getElementById('secretCodeInput'),
    secretBtn: document.getElementById('secretCodeBtn'),
    secretFeedback: document.getElementById('secretFeedback'),

    achievementList: document.getElementById('achievementList'),

    tdStartBtn: document.getElementById('tdStartBtn'),
    tdResetBtn: document.getElementById('tdResetBtn'),
    tdAbilityBtn: document.getElementById('tdAbilityBtn'),
    tdNextWaveBtn: document.getElementById('tdNextWaveBtn'),
    tdSpeedBtn: document.getElementById('tdSpeedBtn'),
    tdUpgradeA: document.getElementById('tdUpgradeA'),
    tdUpgradeB: document.getElementById('tdUpgradeB'),
    tdSellTower: document.getElementById('tdSellTower'),
    tdSelectedLabel: document.getElementById('tdSelectedLabel'),
    tdTowerTypes: document.getElementById('tdTowerTypes'),
    tdDifficultyModes: document.getElementById('tdDifficultyModes'),

    tdCanvas: document.getElementById('tdCanvas'),
    tdBaseHp: document.getElementById('tdBaseHp'),
    tdWave: document.getElementById('tdWave'),
    tdTokens: document.getElementById('tdTokens'),
    tdKills: document.getElementById('tdKills'),
    tdEnergy: document.getElementById('tdEnergy'),
    tdFeedback: document.getElementById('tdFeedback'),

    lbNameInput: document.getElementById('lbNameInput'),
    lbSubmitBtn: document.getElementById('lbSubmitBtn'),
    lbRefreshBtn: document.getElementById('lbRefreshBtn'),
    lbStatus: document.getElementById('lbStatus'),
    leaderboardList: document.getElementById('leaderboardList'),

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
    comboDecayDelay: 1400,
    comboSoftCap: 1.8,

    tdBonusTokens: 0,
    tdWins: 0,
    tdBestKills: 0,
    tdBestWave: 0,
    tdDamageBonus: 0,
    tdEnergyBonus: 0,
    tdStartEnergy: 0,
    tdSpawnSlow: 0,
    tdDifficulty: 'medium',
    playerName: 'Pilot',
    leaderboardSubmitted: false,

    prestigeShards: 0,
    prestigeRuns: 0,

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

    waypoints: [
        { x: -18, y: 52.5 },
        { x: 525, y: 52.5 },
        { x: 525, y: 87.5 },
        { x: 35, y: 87.5 },
        { x: 35, y: 122.5 },
        { x: 525, y: 122.5 },
        { x: 525, y: 157.5 },
        { x: 580, y: 157.5 }
    ],

    baseHp: 20,
    maxHp: 20,
    wave: 0,
    kills: 0,
    tokens: 0,
    energy: 0,
    speedMult: 1,
    victoryWave: 20,
    difficultyKey: 'medium',

    waveActive: false,
    enemiesToSpawn: 0,
    spawnDelay: 0.8,
    spawnClock: 0,
    nextWaveClock: 0,

    selectedTowerType: 'laser',
    selectedTowerId: null,

    towers: [],
    enemies: [],
    shots: [],

    intervalId: null,
    secondId: null,
    uidSeed: 1
};

const ACHIEVEMENTS = [
    { id: 'first_click', label: 'First Spark', check: () => state.lifetimeGems >= 10 },
    { id: 'starter_bank', label: 'Gem Pouch', check: () => state.gems >= 1000 },
    { id: 'combo_master', label: 'Combo Cadet', check: () => state.comboCount >= 20 },
    { id: 'combo_elite', label: 'Combo Marshal', check: () => state.comboCount >= 60 },
    { id: 'small_fleet', label: 'Fleet Seeded', check: () => totalBuildings() >= 25 },
    { id: 'fleet_100', label: 'Fleet x100', check: () => totalBuildings() >= 100 },
    { id: 'fleet_300', label: 'Fleet x300', check: () => totalBuildings() >= 300 },
    { id: 'fleet_1000', label: 'Fleet x1000', check: () => totalBuildings() >= 1000 },
    { id: 'research_10', label: 'Chip Collector', check: () => state.researchCount >= 10 },
    { id: 'research_30', label: 'Tech Architect', check: () => state.researchCount >= 30 },
    { id: 'research_60', label: 'Omnitech', check: () => state.researchCount >= 60 },
    { id: 'core_1', label: 'Core Online', check: () => state.buildings.core >= 1 },
    { id: 'rich_1m', label: 'Seven Digits', check: () => state.lifetimeGems >= 1000000 },
    { id: 'rich_1b', label: 'Ten Digits', check: () => state.lifetimeGems >= 1000000000 },
    { id: 'secret', label: 'Override Accepted', check: () => state.secretRedeemed },
    { id: 'td_win_1', label: 'First Defense', check: () => state.tdWins >= 1 },
    { id: 'td_win_10', label: 'Defense Veteran', check: () => state.tdWins >= 10 },
    { id: 'td_kills_200', label: 'Monster Sweeper', check: () => state.tdBestKills >= 200 },
    { id: 'prestige_1', label: 'Ascended Once', check: () => state.prestigeRuns >= 1 },
    { id: 'prestige_10', label: 'Ascended Tenfold', check: () => state.prestigeRuns >= 10 }
];

let feedbackTimer = null;
let achievementTick = -1;
let leaderboardEntries = [];

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

function prestigeGpsMultiplier() {
    return 1 + state.prestigeShards * 0.12;
}

function prestigeTdMultiplier() {
    return 1 + state.prestigeShards * 0.08;
}

function prestigeClickMultiplier() {
    return 1 + state.prestigeShards * 0.04;
}

function prestigeGoldenBonus() {
    return Math.min(0.18, state.prestigeShards * 0.002);
}

function recomputeGps() {
    let total = 0;
    BUILDINGS.forEach((b) => {
        const count = state.buildings[b.id];
        const mult = state.buildingMults[b.id] * state.globalGpsMult * prestigeGpsMultiplier();
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
    }, 2200);
}

function normalizeCommanderName(raw) {
    const safe = String(raw || '').replace(/[^a-zA-Z0-9 _-]/g, '').trim();
    return (safe || 'Pilot').slice(0, 16);
}

function leaderboardScorePack() {
    const economy = Math.floor(
        state.lifetimeGems * 0.7 +
        state.gps * 260 +
        totalBuildings() * 3200 +
        state.researchCount * 14000 +
        state.prestigeShards * 50000
    );
    const defense = Math.floor(
        state.tdBestKills * 420 +
        state.tdBestWave * 2100 +
        state.tdWins * 5200 +
        state.prestigeShards * 1400
    );
    const overall = economy + defense;
    return { economy, defense, overall };
}

function loadLeaderboard() {
    try {
        const raw = localStorage.getItem(LEADERBOARD_KEY);
        if (!raw) {
            leaderboardEntries = [];
            return;
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            leaderboardEntries = [];
            return;
        }
        leaderboardEntries = parsed.slice(0, LEADERBOARD_LIMIT);
    } catch (_e) {
        leaderboardEntries = [];
    }
}

function saveLeaderboard() {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboardEntries.slice(0, LEADERBOARD_LIMIT)));
}

function addLeaderboardEntry(entry) {
    leaderboardEntries.push(entry);
    leaderboardEntries.sort((a, b) => b.score - a.score);
    leaderboardEntries = leaderboardEntries.slice(0, LEADERBOARD_LIMIT);
    saveLeaderboard();
}

function refreshLeaderboardSubmitUi() {
    if (!el.lbSubmitBtn) return;
    el.lbSubmitBtn.disabled = state.leaderboardSubmitted;
    el.lbSubmitBtn.classList.toggle('disabled-submit', state.leaderboardSubmitted);
    el.lbSubmitBtn.textContent = state.leaderboardSubmitted ? 'Submitted' : 'Submit Score';
}

function submitLeaderboardEntry(mode = 'manual') {
    if (state.leaderboardSubmitted) {
        if (el.lbStatus) el.lbStatus.textContent = 'You already submitted your score. Only one submission is allowed.';
        refreshLeaderboardSubmitUi();
        return false;
    }

    const name = normalizeCommanderName(state.playerName);
    const scores = leaderboardScorePack();
    const stamp = Date.now();

    const entries = [
        {
            name,
            category: 'overall',
            score: scores.overall,
            wave: state.tdBestWave,
            kills: state.tdBestKills,
            shards: state.prestigeShards,
            createdAt: stamp
        },
        {
            name,
            category: 'economy',
            score: scores.economy,
            wave: state.tdBestWave,
            kills: state.tdBestKills,
            shards: state.prestigeShards,
            createdAt: stamp
        },
        {
            name,
            category: 'defense',
            score: scores.defense,
            wave: state.tdBestWave,
            kills: state.tdBestKills,
            shards: state.prestigeShards,
            createdAt: stamp
        }
    ];

    entries.forEach(addLeaderboardEntry);
    state.leaderboardSubmitted = true;
    refreshLeaderboardSubmitUi();
    renderLeaderboard();

    if (el.lbStatus) {
        el.lbStatus.textContent = mode === 'manual'
            ? 'Score submitted. Further submissions are locked for this save.'
            : 'Score submitted.';
    }

    return true;
}

function renderLeaderboard() {
    if (!el.leaderboardList) return;

    const top = leaderboardEntries.slice(0, 12);
    if (top.length <= 0) {
        el.leaderboardList.innerHTML = '<div class="lb-row"><span class="lb-rank">#--</span><div class="lb-main"><strong>No scores yet</strong><span class="lb-sub">Play and submit your first run.</span></div><span class="lb-score">0</span></div>';
        return;
    }

    el.leaderboardList.innerHTML = top.map((row, idx) => {
        const cat = row.category === 'overall'
            ? 'Overall'
            : row.category === 'economy'
                ? 'Economy'
                : 'Defense';

        return `
            <div class="lb-row">
                <span class="lb-rank">#${idx + 1}</span>
                <div class="lb-main">
                    <strong>${row.name}</strong>
                    <span class="lb-sub">${cat} | Wave ${fmt(row.wave || 0)} | Kills ${fmt(row.kills || 0)} | Shards ${fmt(row.shards || 0)}</span>
                </div>
                <span class="lb-score">${fmt(row.score || 0)}</span>
            </div>
        `;
    }).join('');
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
        } else if (typeof fresh[key] === 'string') {
            if (typeof state[key] !== 'string' || !state[key].trim()) state[key] = fresh[key];
        }
    });

    BUILDINGS.forEach((b) => {
        if (!Number.isFinite(state.buildings[b.id]) || state.buildings[b.id] < 0) state.buildings[b.id] = 0;
        if (!Number.isFinite(state.buildingCosts[b.id]) || state.buildingCosts[b.id] < b.baseCost) state.buildingCosts[b.id] = b.baseCost;
        if (!Number.isFinite(state.buildingMults[b.id]) || state.buildingMults[b.id] < 1) state.buildingMults[b.id] = 1;
    });

    if (!state.researchBought || typeof state.researchBought !== 'object') {
        state.researchBought = {};
    }

    state.critChance = Math.min(Math.max(state.critChance, 0), 0.95);
    state.goldenChance = Math.min(Math.max(state.goldenChance, 0.01), 0.95);
    state.playerName = state.playerName.trim().slice(0, 16) || 'Pilot';
    state.tdBestWave = Math.max(state.tdBestWave, 0);
    if (!TD_DIFFICULTIES[state.tdDifficulty]) state.tdDifficulty = 'medium';
    if (typeof state.leaderboardSubmitted !== 'boolean') state.leaderboardSubmitted = false;

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
        comboDecayDelay: state.comboDecayDelay,
        comboSoftCap: state.comboSoftCap,

        tdBonusTokens: state.tdBonusTokens,
        tdWins: state.tdWins,
        tdBestKills: state.tdBestKills,
        tdBestWave: state.tdBestWave,
        tdDamageBonus: state.tdDamageBonus,
        tdEnergyBonus: state.tdEnergyBonus,
        tdStartEnergy: state.tdStartEnergy,
        tdSpawnSlow: state.tdSpawnSlow,
        tdDifficulty: state.tdDifficulty,
        playerName: state.playerName,
        leaderboardSubmitted: state.leaderboardSubmitted,

        prestigeShards: state.prestigeShards,
        prestigeRuns: state.prestigeRuns,

        buildings: state.buildings,
        buildingCosts: state.buildingCosts,
        buildingMults: state.buildingMults,
        researchBought: state.researchBought
    };

    localStorage.setItem(SAVE_KEY, JSON.stringify(toSave));
}

function applyV3LegacyMigration(v3) {
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

function applyV4LegacyMigration(v4) {
    state.gems = Number(v4.gems || 0);
    state.lifetimeGems = Number(v4.lifetimeGems || state.gems);
    state.gpc = Number(v4.gpc || 1);
    state.critChance = Number(v4.critChance || 0.04);
    state.critMultiplier = Number(v4.critMultiplier || 2);
    state.goldenChance = Number(v4.goldenChance || 0.05);
    state.frenzyTime = Number(v4.frenzyTime || 0);
    state.secretRedeemed = Boolean(v4.secretRedeemed);

    state.globalGpsMult = Number(v4.globalGpsMult || 1);
    state.tdBonusTokens = Number(v4.tdBonusTokens || 0);
    state.tdWins = Number(v4.tdWins || 0);
    state.tdBestKills = Number(v4.tdBestKills || 0);
    state.tdBestWave = Number(v4.tdBestWave || 0);
    state.tdStartEnergy = Number(v4.tdStartEnergy || 0);
    state.tdDifficulty = String(v4.tdDifficulty || 'medium');
    state.playerName = String(v4.playerName || 'Pilot');
    state.leaderboardSubmitted = Boolean(v4.leaderboardSubmitted);

    state.buildings = { ...DEFAULTS.buildings, ...(v4.buildings || {}) };
    state.buildingCosts = { ...DEFAULTS.buildingCosts, ...(v4.buildingCosts || {}) };
    state.buildingMults = { ...DEFAULTS.buildingMults, ...(v4.buildingMults || {}) };
    state.researchBought = { ...(v4.researchBought || {}) };
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

    const rawV5 = localStorage.getItem(LEGACY_V5_KEY);
    if (rawV5) {
        try {
            const parsed = JSON.parse(rawV5);
            Object.assign(state, parsed);
            state.buildings = { ...DEFAULTS.buildings, ...(parsed.buildings || {}) };
            state.buildingCosts = { ...DEFAULTS.buildingCosts, ...(parsed.buildingCosts || {}) };
            state.buildingMults = { ...DEFAULTS.buildingMults, ...(parsed.buildingMults || {}) };
            state.researchBought = { ...(parsed.researchBought || {}) };
            validateState();
            localStorage.removeItem(LEGACY_V5_KEY);
            saveGame();
            return;
        } catch (_e) {
            localStorage.removeItem(LEGACY_V5_KEY);
        }
    }

    const rawV4 = localStorage.getItem(LEGACY_V4_KEY);
    if (rawV4) {
        try {
            applyV4LegacyMigration(JSON.parse(rawV4));
            validateState();
            localStorage.removeItem(LEGACY_V4_KEY);
            saveGame();
            return;
        } catch (_e) {
            localStorage.removeItem(LEGACY_V4_KEY);
        }
    }

    const rawV3 = localStorage.getItem(LEGACY_V3_KEY);
    if (rawV3) {
        try {
            applyV3LegacyMigration(JSON.parse(rawV3));
            validateState();
            localStorage.removeItem(LEGACY_V3_KEY);
            saveGame();
            return;
        } catch (_e) {
            localStorage.removeItem(LEGACY_V3_KEY);
        }
    }

    validateState();
}

function buildingProduction(building) {
    const mult = state.buildingMults[building.id] * state.globalGpsMult * prestigeGpsMultiplier();
    return building.baseGps * mult;
}

function canAfford(cost) {
    return Number.isFinite(cost) && state.gems >= cost;
}

function renderBuildings() {
    if (!el.buildingList) return;

    el.buildingList.innerHTML = BUILDINGS.map((b) => {
        const count = state.buildings[b.id];
        const cost = state.buildingCosts[b.id];
        const eachGps = buildingProduction(b);
        const disabled = canAfford(cost) ? '' : 'disabled';
        const ten = previewBulkCost(b.id, 10);
        const hundred = previewBulkCost(b.id, 100);
        const all = previewBulkCost(b.id, 'all');

        return `
            <div class="building-card ${disabled}">
                <div class="building-top">
                    <div class="icon-wrap"><img src="${b.img}" alt="${b.name}" draggable="false"></div>
                    <div class="building-main">
                        <h4>${b.name}</h4>
                        <p>${b.desc}</p>
                        <div class="meta-row">
                            <span>Next Cost: ${fmt(cost)}</span>
                            <span>Each: +${fmtDec(eachGps, 2)} gps</span>
                            <span>Total: +${fmtDec(eachGps * count, 2)} gps</span>
                        </div>
                    </div>
                    <div class="side-amount">
                        <span>Owned</span>
                        <strong>${fmt(count)}</strong>
                    </div>
                </div>
                <div class="building-buy-controls">
                    <button data-building-buy="${b.id}" data-amount="1" type="button">Buy 1 (${fmt(cost)})</button>
                    <button data-building-buy="${b.id}" data-amount="10" type="button">Buy 10 (${ten.count > 0 ? fmt(ten.totalCost) : 'N/A'})</button>
                    <button data-building-buy="${b.id}" data-amount="100" type="button">Buy 100 (${hundred.count > 0 ? fmt(hundred.totalCost) : 'N/A'})</button>
                    <button data-building-buy="${b.id}" data-amount="all" type="button">Buy All (${all.count > 0 ? all.count : 0})</button>
                </div>
            </div>
        `;
    }).join('');

    if (el.buildingBulkMode) {
        el.buildingBulkMode.textContent = 'Use each building card for 1x, 10x, 100x, or All';
    }
}

function renderResearch() {
    if (!el.researchList) return;

    el.researchList.innerHTML = RESEARCH.map((r) => {
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

function calculatePrestigeGain() {
    const fromLifetime = Math.floor(Math.pow(state.lifetimeGems / 2000000, 0.5));
    return Math.max(0, fromLifetime - state.prestigeShards);
}

function renderPrestige() {
    const gain = calculatePrestigeGain();
    const gpsBonusPct = Math.round((prestigeGpsMultiplier() - 1) * 100);
    const tdBonusPct = Math.round((prestigeTdMultiplier() - 1) * 100);

    safeSet(el.prestigeShards, fmt(state.prestigeShards));
    safeSet(el.prestigeGain, fmt(gain));
    safeSet(el.prestigeGpsBonus, `${gpsBonusPct}%`);
    safeSet(el.prestigeTdBonus, `${tdBonusPct}%`);

    safeSet(el.prestigeShardsMini, fmt(state.prestigeShards));
    safeSet(el.prestigeMultMini, `x${fmtDec(prestigeGpsMultiplier(), 2)}`);
}

function renderCoreStats() {
    safeSet(el.gem, fmt(state.gems));
    safeSet(el.gpcValue, fmtDec(state.gpc * prestigeClickMultiplier(), 2));
    safeSet(el.gpsValue, fmtDec(state.gps, 2));
    safeSet(el.buildingTotal, fmt(totalBuildings()));
    safeSet(el.researchTotal, fmt(state.researchCount));
    safeSet(el.comboValue, `x${fmtDec(state.comboMultiplier, 2)}`);
    safeSet(el.frenzyValue, state.frenzyTime > 0 ? `${Math.ceil(state.frenzyTime)}s` : 'OFF');
    safeSet(el.tdWins, fmt(state.tdWins));

    if (el.comboFill) {
        const width = Math.min((state.comboCount / 28) * 100, 100);
        el.comboFill.style.width = `${width}%`;
    }

    document.body.classList.toggle('frenzy', state.frenzyTime > 0);
    renderPrestige();
}

function renderTdStats() {
    const cfg = tdDifficultyConfig();
    safeSet(el.tdBaseHp, `${td.baseHp}/${td.maxHp}`);
    safeSet(el.tdWave, td.wave);
    safeSet(el.tdTokens, td.tokens);
    safeSet(el.tdKills, td.kills);
    safeSet(el.tdEnergy, `${fmt(td.energy)} | Best Wave ${fmt(state.tdBestWave)} | ${cfg.label}`);
    if (el.tdSpeedBtn) el.tdSpeedBtn.textContent = `Speed x${td.speedMult}`;
    if (el.tdAbilityBtn) el.tdAbilityBtn.textContent = `Orbital Strike (${cfg.strikeCost})`;
}

function renderSelectedTower() {
    if (!el.tdSelectedLabel) return;

    const tower = td.towers.find((t) => t.id === td.selectedTowerId);
    if (!tower) {
        el.tdSelectedLabel.textContent = 'Select a tower on the grid to upgrade it.';
        return;
    }

    const costA = tdUpgradeCost(tower, 'A');
    const costB = tdUpgradeCost(tower, 'B');

    el.tdSelectedLabel.textContent = `${TOWER_TYPES[tower.type].name} | A:${tower.pathA} B:${tower.pathB} | Upgrade A:${costA} energy | Upgrade B:${costB} energy`;
}

function renderAll() {
    recomputeGps();
    renderCoreStats();
    renderBuildings();
    renderResearch();
    renderAchievements();
    renderTdStats();
    renderSelectedTower();
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

    state.comboMultiplier = 1 + Math.min(state.comboCount * 0.04, state.comboSoftCap);

    const frenzyMult = state.frenzyTime > 0 ? 2 : 1;
    const isCrit = Math.random() < state.critChance;
    const critMult = isCrit ? state.critMultiplier : 1;
    const gain = state.gpc * prestigeClickMultiplier() * state.comboMultiplier * frenzyMult * critMult;

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

    const bonus = Math.max(160, state.gps * 10 + state.gpc * 24);
    addGems(bonus);
    state.frenzyTime += 10;
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
    state.buildingCosts[id] = Math.round(cost * 1.15 + state.buildings[id] * 0.35);

    showBuyFeedback(`${building.name} purchased. Fleet size: ${fmt(totalBuildings())}.`);
    playSound(el.upgradeSound, 0.48);
    renderAll();
    saveGame();
}

function previewBulkCost(id, amount) {
    let countBought = 0;
    let totalCost = 0;
    let simulatedGems = state.gems;
    let simulatedCost = state.buildingCosts[id];
    let simulatedOwned = state.buildings[id];
    const max = amount === 'all' ? Number.POSITIVE_INFINITY : Number(amount);

    while (countBought < max && simulatedGems >= simulatedCost) {
        simulatedGems -= simulatedCost;
        totalCost += simulatedCost;
        simulatedOwned += 1;
        simulatedCost = Math.round(simulatedCost * 1.15 + simulatedOwned * 0.35);
        countBought += 1;
    }

    return {
        count: countBought,
        totalCost,
        nextCost: simulatedCost,
        gemsLeft: simulatedGems,
        owned: simulatedOwned
    };
}

function buyBuildingBulk(id, amount) {
    const building = BUILDINGS.find((b) => b.id === id);
    if (!building) return;

    const preview = previewBulkCost(id, amount);
    if (preview.count <= 0) {
        showBuyFeedback(`Not enough gems to buy ${building.name}.`);
        return;
    }

    state.gems -= preview.totalCost;
    state.buildings[id] = preview.owned;
    state.buildingCosts[id] = preview.nextCost;

    const amountLabel = amount === 'all' ? `ALL (${preview.count})` : amount;
    showBuyFeedback(`${building.name}: bought ${amountLabel}.`);
    playSound(el.upgradeSound, 0.5);
    renderAll();
    saveGame();
}

function buyAllAffordableResearch() {
    let purchased = 0;
    let progressed = true;

    while (progressed) {
        progressed = false;

        for (const research of RESEARCH) {
            if (state.researchBought[research.id]) continue;
            if (state.gems < research.cost) continue;

            state.gems -= research.cost;
            state.researchBought[research.id] = true;
            state.researchCount += 1;
            purchased += 1;

            if (research.target === 'globalGps') {
                state.globalGpsMult *= research.amount;
            } else if (research.target === 'goldenChance') {
                state.goldenChance = Math.min(0.95, state.goldenChance + research.amount);
            } else if (research.target === 'clickAndCrit') {
                state.gpc += 3;
                state.critChance = Math.min(0.95, state.critChance + 0.07);
            } else if (research.target === 'clickAndCrit2') {
                state.gpc += 8;
                state.critChance = Math.min(0.95, state.critChance + 0.08);
            } else if (research.target === 'clickAndCrit3') {
                state.gpc += 22;
                state.critChance = Math.min(0.95, state.critChance + 0.05);
            } else if (research.target === 'tdTokens') {
                state.tdBonusTokens += research.amount;
            } else if (research.target === 'tdDamage') {
                state.tdDamageBonus += research.amount;
            } else if (research.target === 'tdEnergy') {
                state.tdEnergyBonus += research.amount;
            } else if (research.target === 'tdStartEnergy') {
                state.tdStartEnergy += research.amount;
            } else if (research.target === 'tdSpawnSlow') {
                state.tdSpawnSlow += research.amount;
            } else if (research.target === 'combo') {
                state.comboSoftCap += 0.5;
                state.comboDecayDelay += 350;
            } else if (research.target === 'combo2') {
                state.comboSoftCap += 0.7;
                state.comboDecayDelay += 500;
            } else {
                state.buildingMults[research.target] *= research.mult;
            }

            progressed = true;
        }
    }

    if (purchased <= 0) {
        showBuyFeedback('No affordable upgrades right now.');
        return;
    }

    showBuyFeedback(`Installed ${purchased} upgrade(s).`);
    playSound(el.upgradeSound, 0.64);
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
        state.goldenChance = Math.min(0.95, state.goldenChance + research.amount);
    } else if (research.target === 'clickAndCrit') {
        state.gpc += 3;
        state.critChance = Math.min(0.95, state.critChance + 0.07);
    } else if (research.target === 'clickAndCrit2') {
        state.gpc += 8;
        state.critChance = Math.min(0.95, state.critChance + 0.08);
    } else if (research.target === 'clickAndCrit3') {
        state.gpc += 22;
        state.critChance = Math.min(0.95, state.critChance + 0.05);
    } else if (research.target === 'tdTokens') {
        state.tdBonusTokens += research.amount;
    } else if (research.target === 'tdDamage') {
        state.tdDamageBonus += research.amount;
    } else if (research.target === 'tdEnergy') {
        state.tdEnergyBonus += research.amount;
    } else if (research.target === 'tdStartEnergy') {
        state.tdStartEnergy += research.amount;
    } else if (research.target === 'tdSpawnSlow') {
        state.tdSpawnSlow += research.amount;
    } else if (research.target === 'combo') {
        state.comboSoftCap += 0.5;
        state.comboDecayDelay += 350;
    } else if (research.target === 'combo2') {
        state.comboSoftCap += 0.7;
        state.comboDecayDelay += 500;
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
    addGems(12000);
    state.gpc += 10;
    state.critChance = Math.min(0.95, state.critChance + 0.12);
    state.goldenChance = Math.min(0.95, state.goldenChance + 0.05);
    state.frenzyTime += 35;

    state.buildings.drone += 6;
    state.buildings.miner += 4;
    state.buildings.forge += 3;

    BUILDINGS.forEach((b) => {
        state.buildingCosts[b.id] = Math.max(b.baseCost, Math.round(b.baseCost * Math.pow(1.15, state.buildings[b.id])));
    });

    if (el.secretInput) el.secretInput.value = '';
    if (el.secretFeedback) el.secretFeedback.textContent = 'Override accepted. Hidden cache delivered.';

    playSound(el.upgradeSound, 0.72);
    renderAll();
    saveGame();
}

function performPrestige() {
    const gain = calculatePrestigeGain();
    if (gain <= 0) {
        showBuyFeedback('Not enough lifetime gems for prestige shards yet.');
        return;
    }

    const ok = window.confirm(`Prestige reset now? You gain ${gain} shards and restart economy progress.`);
    if (!ok) return;

    state.prestigeShards += gain;
    state.prestigeRuns += 1;

    state.gems = 0;
    state.lifetimeGems = 0;
    state.gpc = 1;
    state.critChance = 0.04;
    state.critMultiplier = 2;
    state.goldenChance = 0.05;
    state.frenzyTime = 0;
    state.secretRedeemed = false;

    state.globalGpsMult = 1;
    state.comboDecayDelay = 1400;
    state.comboSoftCap = 1.8;

    state.tdBonusTokens = 0;
    state.tdDamageBonus = 0;
    state.tdEnergyBonus = 0;
    state.tdStartEnergy = 0;
    state.tdSpawnSlow = 0;

    state.researchBought = {};
    state.researchCount = 0;

    BUILDINGS.forEach((b) => {
        state.buildings[b.id] = 0;
        state.buildingCosts[b.id] = b.baseCost;
        state.buildingMults[b.id] = 1;
    });

    tdStopRun('Defense bay reset by prestige.');

    showBuyFeedback(`Prestige complete. +${gain} permanent shards earned.`);
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

    const goldenChanceEffective = Math.min(0.95, state.goldenChance + prestigeGoldenBonus());
    if (!state.goldenGemActive && Math.random() < goldenChanceEffective) {
        spawnGoldenGem();
    }

    if (Date.now() - state.lastClickTime > state.comboDecayDelay) {
        state.comboCount = Math.max(0, state.comboCount - 2);
        state.comboMultiplier = 1 + Math.min(state.comboCount * 0.04, state.comboSoftCap);
    }

    renderAll();
    saveGame();
}

function tdDifficultyConfig() {
    return TD_DIFFICULTIES[state.tdDifficulty] || TD_DIFFICULTIES.medium;
}

function tdApplyDifficultyButtons() {
    if (!el.tdDifficultyModes) return;
    el.tdDifficultyModes.querySelectorAll('[data-td-difficulty]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.tdDifficulty === state.tdDifficulty);
    });
}

function tdSetDifficulty(key) {
    if (!TD_DIFFICULTIES[key]) return;
    if (td.running) {
        if (el.tdFeedback) el.tdFeedback.textContent = 'Finish current run before changing difficulty.';
        return;
    }

    state.tdDifficulty = key;
    tdApplyDifficultyButtons();
    tdResetState();
    tdDraw();
    saveGame();

    const cfg = tdDifficultyConfig();
    if (el.tdFeedback) el.tdFeedback.textContent = `Difficulty set to ${cfg.label}.`;
}

function tdBaseHpForRun() {
    const cfg = tdDifficultyConfig();
    const base = 20 + Math.floor(totalBuildings() / 80) + Math.floor(state.prestigeShards / 2);
    return Math.max(6, Math.floor(base * cfg.playerHpMult));
}

function tdTokenStartForRun() {
    const cfg = tdDifficultyConfig();
    const base = Math.max(4, Math.floor(totalBuildings() / 7) + state.tdBonusTokens + Math.floor(state.prestigeShards / 3));
    return Math.max(2, Math.floor(base * cfg.tokenMult));
}

function tdResetState() {
    const cfg = tdDifficultyConfig();
    td.maxHp = tdBaseHpForRun();
    td.baseHp = td.maxHp;
    td.wave = 0;
    td.kills = 0;
    td.tokens = tdTokenStartForRun();
    td.energy = state.tdStartEnergy;
    td.speedMult = 1;
    td.victoryWave = cfg.victoryWave;
    td.difficultyKey = state.tdDifficulty;

    td.waveActive = false;
    td.enemiesToSpawn = 0;
    td.spawnClock = 0;
    td.nextWaveClock = 0;

    td.selectedTowerId = null;
    td.towers = [];
    td.enemies = [];
    td.shots = [];

    renderTdStats();
    renderSelectedTower();
}

function tdIsOnPath(row) {
    return row >= 1 && row <= 4;
}

function tdTowerAtCell(col, row) {
    return td.towers.find((tower) => tower.col === col && tower.row === row) || null;
}

function tdEnemyBaseStats(typeName) {
    const cfg = tdDifficultyConfig();
    const type = ENEMY_TYPES[typeName];
    const waveScale = Math.pow(1.24, Math.max(0, td.wave - 1));
    const baseHp = 16 * waveScale * type.hpMult * cfg.enemyHpMult;
    const baseSpeed = (30 + td.wave * 2.6) * type.speedMult * cfg.enemySpeedMult;
    return {
        hp: baseHp,
        speed: baseSpeed
    };
}

function tdSpawnEnemy(typeName) {
    const type = ENEMY_TYPES[typeName];
    const stats = tdEnemyBaseStats(typeName);

    td.enemies.push({
        id: td.uidSeed++,
        type: typeName,
        x: td.waypoints[0].x,
        y: td.waypoints[0].y,
        pathIndex: 1,
        hp: stats.hp,
        maxHp: stats.hp,
        speed: stats.speed,
        slowFactor: 1,
        slowTimer: 0,
        radius: type.radius
    });
}

function tdWavePool() {
    if (td.wave < 3) return ['scout'];
    if (td.wave < 6) return ['scout', 'brute'];
    if (td.wave < 10) return ['scout', 'brute', 'splitter'];
    if (td.wave < 15) return ['scout', 'brute', 'splitter', 'shield'];
    return ['scout', 'brute', 'splitter', 'shield', 'boss'];
}

function tdStartNextWave() {
    const cfg = tdDifficultyConfig();
    td.wave += 1;
    state.tdBestWave = Math.max(state.tdBestWave, td.wave);
    td.waveActive = true;
    td.enemiesToSpawn = Math.max(8, Math.round((12 + td.wave * 5) * cfg.spawnCountMult));
    td.spawnClock = 0;
    td.spawnDelay = Math.max(0.06, ((0.78 - td.wave * 0.022) + Math.max(0, 0.14 - state.tdSpawnSlow)) / cfg.spawnRateMult);

    if (td.wave % cfg.bossEvery === 0) {
        td.enemiesToSpawn += Math.round((3 + td.wave) * cfg.spawnCountMult * 0.55);
        tdSpawnEnemy('boss');
        td.energy += Math.round(6 * cfg.energyGainMult);
    } else {
        td.baseHp = Math.min(td.maxHp, td.baseHp + (cfg.baseLeakDamage <= 1 ? 1 : 0));
    }

    td.tokens += td.wave % 3 === 0 ? 1 : 0;
    if (el.tdFeedback) {
        el.tdFeedback.textContent = `Wave ${td.wave} started. Incoming monsters: ${td.enemiesToSpawn}.`;
    }
}

function tdPickEnemyType() {
    const cfg = tdDifficultyConfig();
    const pool = tdWavePool();
    const roll = Math.random();

    const bossChance = cfg.label === 'Insane' ? 0.964 : cfg.label === 'Very Hard' ? 0.974 : cfg.label === 'Hard' ? 0.982 : 0.989;
    if (pool.includes('boss') && roll > bossChance) return 'boss';
    if (pool.includes('shield') && roll > 0.84) return 'shield';
    if (pool.includes('splitter') && roll > 0.7) return 'splitter';
    if (pool.includes('brute') && roll > 0.45) return 'brute';
    return 'scout';
}

function tdTowerStats(tower) {
    const base = TOWER_TYPES[tower.type];

    let damage = base.damage * (1 + state.tdDamageBonus) * prestigeTdMultiplier();
    let fireRate = base.fireRate;
    let range = base.range;
    let splash = base.splash || 0;
    let slowAmount = base.slowAmount || 0;
    let slowTime = base.slowTime || 0;
    let chain = base.chain || 0;

    for (let i = 0; i < tower.pathA; i += 1) {
        damage *= 1.35;
        range += 7;
        if (tower.type === 'cannon') splash += 6;
        if (tower.type === 'frost') slowTime += 0.2;
        if (tower.type === 'tesla') chain += 1;
        if (tower.type === 'missile') splash += 10;
    }

    for (let i = 0; i < tower.pathB; i += 1) {
        fireRate *= 0.82;
        if (tower.type === 'laser') range += 10;
        if (tower.type === 'cannon') {
            fireRate *= 0.88;
            splash += 8;
        }
        if (tower.type === 'frost') {
            slowAmount = Math.min(0.72, slowAmount + 0.11);
            slowTime += 0.3;
        }
        if (tower.type === 'tesla') {
            fireRate *= 0.9;
            damage *= 1.1;
        }
        if (tower.type === 'missile') {
            range += 12;
            damage *= 1.12;
        }
    }

    return { damage, fireRate, range, splash, slowAmount, slowTime, chain };
}

function tdUpgradeCost(tower, path) {
    const base = 12 + td.wave;
    if (path === 'A') return Math.round(base + tower.pathA * 7 + tower.pathB * 3);
    return Math.round(base + tower.pathB * 7 + tower.pathA * 3);
}

function tdFindTarget(tower, stats) {
    let best = null;
    let bestDist = Infinity;

    td.enemies.forEach((enemy) => {
        const dx = enemy.x - tower.x;
        const dy = enemy.y - tower.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= stats.range && dist < bestDist) {
            bestDist = dist;
            best = enemy;
        }
    });

    return best;
}

function tdShotHit(shot) {
    const primary = td.enemies.find((e) => e.id === shot.targetId);
    if (!primary) return false;

    if (Math.hypot(primary.x - shot.x, primary.y - shot.y) > primary.radius + 4) return false;

    const armor = ENEMY_TYPES[primary.type].armor || 0;
    let dealt = shot.damage * (1 - armor);
    primary.hp -= dealt;

    if (shot.slowAmount > 0) {
        primary.slowFactor = Math.min(primary.slowFactor, 1 - shot.slowAmount);
        primary.slowTimer = Math.max(primary.slowTimer, shot.slowTime);
    }

    if (shot.splash > 0) {
        td.enemies.forEach((enemy) => {
            if (enemy.id === primary.id) return;
            const d = Math.hypot(enemy.x - primary.x, enemy.y - primary.y);
            if (d <= shot.splash) {
                const enemyArmor = ENEMY_TYPES[enemy.type].armor || 0;
                enemy.hp -= shot.damage * 0.55 * (1 - enemyArmor);
            }
        });
    }

    if (shot.chain > 0) {
        const nearby = td.enemies
            .filter((enemy) => enemy.id !== primary.id)
            .sort((a, b) => Math.hypot(a.x - primary.x, a.y - primary.y) - Math.hypot(b.x - primary.x, b.y - primary.y))
            .slice(0, shot.chain);

        nearby.forEach((enemy, idx) => {
            const enemyArmor = ENEMY_TYPES[enemy.type].armor || 0;
            const chainFalloff = 1 - Math.min(0.6, idx * 0.22);
            enemy.hp -= shot.damage * 0.62 * chainFalloff * (1 - enemyArmor);
        });
    }

    return true;
}

function tdHandleEnemyDeath(enemy) {
    const cfg = tdDifficultyConfig();
    const type = ENEMY_TYPES[enemy.type];
    td.kills += 1;

    const energyGain = type.reward * (1 + state.tdEnergyBonus) * cfg.energyGainMult;
    td.energy += energyGain;

    if (type.split) {
        for (let i = 0; i < 2; i += 1) {
            const tinyHp = enemy.maxHp * 0.35;
            td.enemies.push({
                id: td.uidSeed++,
                type: 'scout',
                x: enemy.x,
                y: enemy.y + (i === 0 ? -6 : 6),
                pathIndex: enemy.pathIndex,
                hp: tinyHp,
                maxHp: tinyHp,
                speed: enemy.speed * 1.3,
                slowFactor: 1,
                slowTimer: 0,
                radius: 5
            });
        }
    }
}

function tdMoveEnemy(enemy, delta) {
    if (enemy.pathIndex >= td.waypoints.length) return;

    const target = td.waypoints[enemy.pathIndex];
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;

    const speed = enemy.speed * enemy.slowFactor;
    const step = speed * delta;

    if (step >= dist) {
        enemy.x = target.x;
        enemy.y = target.y;
        enemy.pathIndex += 1;
    } else {
        enemy.x += (dx / dist) * step;
        enemy.y += (dy / dist) * step;
    }

    if (enemy.slowTimer > 0) {
        enemy.slowTimer -= delta;
        if (enemy.slowTimer <= 0) {
            enemy.slowFactor = 1;
        }
    }
}

function tdUpdate(delta) {
    if (!td.running) return;
    const cfg = tdDifficultyConfig();
    const simDelta = delta * td.speedMult;

    if (!td.waveActive && td.enemies.length === 0) {
        td.nextWaveClock -= simDelta;
        if (td.nextWaveClock <= 0) {
            tdStartNextWave();
        }
    }

    if (td.waveActive) {
        td.spawnClock += simDelta;
        if (td.enemiesToSpawn > 0 && td.spawnClock >= td.spawnDelay) {
            td.spawnClock = 0;
            tdSpawnEnemy(tdPickEnemyType());
            td.enemiesToSpawn -= 1;
        }

        if (td.enemiesToSpawn <= 0 && td.enemies.length === 0) {
            td.waveActive = false;
            td.nextWaveClock = 2.4;
            const waveReward = Math.round((125 + td.wave * 30 + totalBuildings() * 1.6) * (0.88 + cfg.spawnCountMult * 0.25));
            addGems(waveReward);
            if (td.wave % 4 === 0) td.tokens += 1;
            if (td.wave % 5 === 0) td.tokens += 2;
            if (td.wave >= td.victoryWave) {
                tdWinRun();
                return;
            }
            if (el.tdFeedback) el.tdFeedback.textContent = `Wave ${td.wave} cleared. +${fmt(waveReward)} gems.`;
        }
    }

    td.towers.forEach((tower) => {
        const stats = tdTowerStats(tower);
        tower.cooldown -= simDelta;
        if (tower.cooldown > 0) return;

        const target = tdFindTarget(tower, stats);
        if (!target) return;

        tower.cooldown = stats.fireRate;
        td.shots.push({
            x: tower.x,
            y: tower.y,
            targetId: target.id,
            speed: 320,
            damage: stats.damage,
            splash: stats.splash,
            slowAmount: stats.slowAmount,
            slowTime: stats.slowTime,
            chain: stats.chain,
            color: TOWER_TYPES[tower.type].color
        });
    });

    td.shots.forEach((shot) => {
        const target = td.enemies.find((e) => e.id === shot.targetId);
        if (!target) {
            shot.dead = true;
            return;
        }

        const dx = target.x - shot.x;
        const dy = target.y - shot.y;
        const dist = Math.hypot(dx, dy) || 1;
        const step = shot.speed * simDelta;

        shot.x += (dx / dist) * step;
        shot.y += (dy / dist) * step;

        if (tdShotHit(shot)) {
            shot.dead = true;
        }
    });

    td.enemies.forEach((enemy) => tdMoveEnemy(enemy, simDelta));

    for (let i = td.enemies.length - 1; i >= 0; i -= 1) {
        const enemy = td.enemies[i];

        if (enemy.hp <= 0) {
            tdHandleEnemyDeath(enemy);
            td.enemies.splice(i, 1);
            continue;
        }

        if (enemy.pathIndex >= td.waypoints.length) {
            td.baseHp -= cfg.baseLeakDamage;
            td.enemies.splice(i, 1);
        }
    }

    td.shots = td.shots.filter((s) => !s.dead);

    if (td.baseHp <= 0) {
        tdFinishRun();
        return;
    }

    renderTdStats();
    renderSelectedTower();
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
        if (tdIsOnPath(r)) {
            ctx.fillStyle = 'rgba(255, 153, 119, 0.12)';
            ctx.fillRect(0, y, td.width, td.cell);
        }
        ctx.strokeStyle = 'rgba(180, 220, 255, 0.14)';
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

    ctx.strokeStyle = 'rgba(255, 200, 140, 0.35)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(td.waypoints[0].x, td.waypoints[0].y);
    for (let i = 1; i < td.waypoints.length; i += 1) {
        ctx.lineTo(td.waypoints[i].x, td.waypoints[i].y);
    }
    ctx.stroke();
    ctx.lineWidth = 1;

    td.towers.forEach((tower) => {
        const color = TOWER_TYPES[tower.type].color;
        const selected = tower.id === td.selectedTowerId;

        ctx.fillStyle = color;
        ctx.fillRect(tower.x - 9, tower.y - 9, 18, 18);

        if (tower.type === 'laser') {
            ctx.fillStyle = '#d8fcff';
            ctx.fillRect(tower.x - 2, tower.y - 13, 4, 8);
        } else if (tower.type === 'cannon') {
            ctx.fillStyle = '#ffe4b0';
            ctx.fillRect(tower.x - 6, tower.y - 12, 12, 6);
        } else if (tower.type === 'tesla') {
            ctx.fillStyle = '#f1e7ff';
            ctx.beginPath();
            ctx.moveTo(tower.x, tower.y - 14);
            ctx.lineTo(tower.x + 4, tower.y - 6);
            ctx.lineTo(tower.x - 1, tower.y - 6);
            ctx.lineTo(tower.x + 2, tower.y + 1);
            ctx.lineTo(tower.x - 6, tower.y - 6);
            ctx.lineTo(tower.x - 2, tower.y - 6);
            ctx.closePath();
            ctx.fill();
        } else if (tower.type === 'missile') {
            ctx.fillStyle = '#ffe2dc';
            ctx.fillRect(tower.x - 3, tower.y - 14, 6, 10);
            ctx.fillStyle = '#ff9c90';
            ctx.beginPath();
            ctx.moveTo(tower.x, tower.y - 18);
            ctx.lineTo(tower.x + 4, tower.y - 12);
            ctx.lineTo(tower.x - 4, tower.y - 12);
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.fillStyle = '#d8e9ff';
            ctx.beginPath();
            ctx.arc(tower.x, tower.y - 5, 5, 0, Math.PI * 2);
            ctx.fill();
        }

        if (selected) {
            ctx.strokeStyle = '#ffffff';
            ctx.strokeRect(tower.x - 12, tower.y - 12, 24, 24);
        }
    });

    td.enemies.forEach((enemy) => {
        const eType = ENEMY_TYPES[enemy.type] || ENEMY_TYPES.scout;

        ctx.fillStyle = eType.color;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        ctx.fill();

        const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
        ctx.fillStyle = '#210d16';
        ctx.fillRect(enemy.x - 12, enemy.y - enemy.radius - 7, 24, 4);
        ctx.fillStyle = '#8fff9c';
        ctx.fillRect(enemy.x - 12, enemy.y - enemy.radius - 7, 24 * hpRatio, 4);
    });

    td.shots.forEach((shot) => {
        ctx.fillStyle = shot.color;
        ctx.beginPath();
        ctx.arc(shot.x, shot.y, 3, 0, Math.PI * 2);
        ctx.fill();
    });
}

function tdStopRun(message) {
    td.running = false;
    td.waveActive = false;

    if (td.intervalId) clearInterval(td.intervalId);
    if (td.secondId) clearInterval(td.secondId);
    td.intervalId = null;
    td.secondId = null;

    if (message && el.tdFeedback) {
        el.tdFeedback.textContent = message;
    }

    renderTdStats();
    renderSelectedTower();
    tdDraw();
}

function tdFinishRun() {
    const cfg = tdDifficultyConfig();
    state.tdBestKills = Math.max(state.tdBestKills, td.kills);
    state.tdBestWave = Math.max(state.tdBestWave, td.wave);

    const reward = Math.round((td.kills * 16 + td.wave * 72 + totalBuildings() * 2.1) * (0.84 + cfg.spawnCountMult * 0.25));
    addGems(reward);

    tdStopRun(`Defense failed at wave ${td.wave}. Reward: +${fmt(reward)} gems.`);
    renderAll();
    saveGame();
}

function tdWinRun() {
    const cfg = tdDifficultyConfig();
    state.tdBestKills = Math.max(state.tdBestKills, td.kills);
    state.tdBestWave = Math.max(state.tdBestWave, td.wave);
    state.tdWins += 1;

    const reward = Math.round((2500 + td.kills * 22 + td.wave * 210 + totalBuildings() * 3.8) * (0.88 + cfg.spawnCountMult * 0.35));
    addGems(reward);

    tdStopRun(`Victory! You cleared wave ${td.wave}. Reward: +${fmt(reward)} gems.`);
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
    td.nextWaveClock = 0.8;

    if (el.tdFeedback) {
        const cfg = tdDifficultyConfig();
        el.tdFeedback.textContent = `Defense started on ${cfg.label}. Survive to wave ${td.victoryWave}.`;
    }

    const frameMs = 50;
    td.intervalId = setInterval(() => tdUpdate(frameMs / 1000), frameMs);
    td.secondId = setInterval(() => renderTdStats(), 1000);
    tdDraw();
}

function tdResetGrid() {
    if (td.running) {
        if (el.tdFeedback) el.tdFeedback.textContent = 'Stop or lose the run before resetting.';
        return;
    }

    tdResetState();
    tdDraw();

    if (el.tdFeedback) {
        el.tdFeedback.textContent = 'Defense grid reset.';
    }
}

function tdActivateOrbitalStrike() {
    const cfg = tdDifficultyConfig();
    if (!td.running) {
        if (el.tdFeedback) el.tdFeedback.textContent = 'Start defense first.';
        return;
    }

    const cost = cfg.strikeCost;
    if (td.energy < cost) {
        if (el.tdFeedback) el.tdFeedback.textContent = `Need ${cost} strike energy.`;
        return;
    }

    td.energy -= cost;
    td.enemies.forEach((enemy) => {
        enemy.hp -= (38 + td.wave * 1.2) * prestigeTdMultiplier();
    });

    if (el.tdFeedback) {
        el.tdFeedback.textContent = 'Orbital strike deployed!';
    }

    renderTdStats();
    tdDraw();
}

function tdCallNextWave() {
    const cfg = tdDifficultyConfig();
    if (!td.running) {
        if (el.tdFeedback) el.tdFeedback.textContent = 'Start defense first.';
        return;
    }

    if (td.waveActive) {
        if (el.tdFeedback) el.tdFeedback.textContent = 'Current wave still active.';
        return;
    }

    td.nextWaveClock = 0;
    const rushEnergy = Math.max(2, Math.round(6 * cfg.energyGainMult));
    td.energy += rushEnergy;
    if (el.tdFeedback) el.tdFeedback.textContent = `Next wave called early. +${rushEnergy} energy bonus.`;
    renderTdStats();
}

function tdToggleSpeed() {
    if (td.speedMult === 1) td.speedMult = 2;
    else if (td.speedMult === 2) td.speedMult = 3;
    else td.speedMult = 1;

    renderTdStats();
    if (el.tdFeedback) el.tdFeedback.textContent = `Defense speed set to x${td.speedMult}.`;
}

function tdSelectTowerType(type) {
    if (!TOWER_TYPES[type]) return;
    td.selectedTowerType = type;

    if (!el.tdTowerTypes) return;
    el.tdTowerTypes.querySelectorAll('.td-type').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.tdType === type);
    });
}

function tdPlaceOrSelect(evt) {
    if (!el.tdCanvas || !td.running) return;

    const rect = el.tdCanvas.getBoundingClientRect();
    const scaleX = td.width / rect.width;
    const scaleY = td.height / rect.height;

    const x = (evt.clientX - rect.left) * scaleX;
    const y = (evt.clientY - rect.top) * scaleY;

    const col = Math.floor(x / td.cell);
    const row = Math.floor(y / td.cell);

    if (col < 0 || col >= td.cols || row < 0 || row >= td.rows) return;

    const existing = tdTowerAtCell(col, row);
    if (existing) {
        td.selectedTowerId = existing.id;
        renderSelectedTower();
        tdDraw();
        return;
    }

    if (tdIsOnPath(row)) {
        if (el.tdFeedback) el.tdFeedback.textContent = 'Cannot place tower on monster path rows.';
        return;
    }

    const tType = TOWER_TYPES[td.selectedTowerType];
    if (!tType) return;

    if (td.tokens < tType.tokenCost) {
        if (el.tdFeedback) el.tdFeedback.textContent = `Need ${tType.tokenCost} tokens for ${tType.name}.`;
        return;
    }

    td.tokens -= tType.tokenCost;

    const newTower = {
        id: td.uidSeed++,
        type: td.selectedTowerType,
        col,
        row,
        x: col * td.cell + td.cell / 2,
        y: row * td.cell + td.cell / 2,
        pathA: 0,
        pathB: 0,
        cooldown: 0,
        spentEnergy: 0
    };

    td.towers.push(newTower);
    td.selectedTowerId = newTower.id;

    if (el.tdFeedback) {
        el.tdFeedback.textContent = `${tType.name} placed.`;
    }

    renderTdStats();
    renderSelectedTower();
    tdDraw();
}

function tdUpgradeTower(path) {
    if (!td.running) {
        if (el.tdFeedback) el.tdFeedback.textContent = 'Start defense first.';
        return;
    }

    const tower = td.towers.find((t) => t.id === td.selectedTowerId);
    if (!tower) {
        if (el.tdFeedback) el.tdFeedback.textContent = 'Select a tower first.';
        return;
    }

    if (path === 'A' && tower.pathA >= 5) {
        if (el.tdFeedback) el.tdFeedback.textContent = 'Path A is maxed.';
        return;
    }
    if (path === 'B' && tower.pathB >= 5) {
        if (el.tdFeedback) el.tdFeedback.textContent = 'Path B is maxed.';
        return;
    }

    const cost = tdUpgradeCost(tower, path);
    if (td.energy < cost) {
        if (el.tdFeedback) el.tdFeedback.textContent = `Need ${cost} energy for upgrade.`;
        return;
    }

    td.energy -= cost;
    tower.spentEnergy += cost;

    if (path === 'A') tower.pathA += 1;
    else tower.pathB += 1;

    if (el.tdFeedback) {
        el.tdFeedback.textContent = `${TOWER_TYPES[tower.type].name} upgraded on Path ${path}.`;
    }

    renderTdStats();
    renderSelectedTower();
    tdDraw();
}

function tdSellSelectedTower() {
    const idx = td.towers.findIndex((t) => t.id === td.selectedTowerId);
    if (idx < 0) {
        if (el.tdFeedback) el.tdFeedback.textContent = 'Select a tower to sell.';
        return;
    }

    const tower = td.towers[idx];
    const tokenRefund = Math.max(1, Math.floor(TOWER_TYPES[tower.type].tokenCost * 0.75));
    const energyRefund = Math.floor(tower.spentEnergy * 0.45);

    td.tokens += tokenRefund;
    td.energy += energyRefund;

    td.towers.splice(idx, 1);
    td.selectedTowerId = null;

    if (el.tdFeedback) {
        el.tdFeedback.textContent = `Tower sold. +${tokenRefund} token(s), +${energyRefund} energy.`;
    }

    renderTdStats();
    renderSelectedTower();
    tdDraw();
}

function bindEvents() {
    if (el.gemButton) el.gemButton.addEventListener('click', clickGem);
    if (el.goldenGem) el.goldenGem.addEventListener('click', collectGoldenGem);

    if (el.buildingList) {
        el.buildingList.addEventListener('click', (event) => {
            const bulkButton = event.target.closest('[data-building-buy]');
            if (!bulkButton) return;

            const amount = bulkButton.dataset.amount === 'all'
                ? 'all'
                : Number(bulkButton.dataset.amount || '1');

            buyBuildingBulk(bulkButton.dataset.buildingBuy, amount);
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

    if (el.prestigeBtn) el.prestigeBtn.addEventListener('click', performPrestige);
    if (el.buyAllUpgradesBtn) el.buyAllUpgradesBtn.addEventListener('click', buyAllAffordableResearch);

    if (el.tdStartBtn) el.tdStartBtn.addEventListener('click', tdStart);
    if (el.tdResetBtn) el.tdResetBtn.addEventListener('click', tdResetGrid);
    if (el.tdNextWaveBtn) el.tdNextWaveBtn.addEventListener('click', tdCallNextWave);
    if (el.tdSpeedBtn) el.tdSpeedBtn.addEventListener('click', tdToggleSpeed);
    if (el.tdAbilityBtn) el.tdAbilityBtn.addEventListener('click', tdActivateOrbitalStrike);
    if (el.tdUpgradeA) el.tdUpgradeA.addEventListener('click', () => tdUpgradeTower('A'));
    if (el.tdUpgradeB) el.tdUpgradeB.addEventListener('click', () => tdUpgradeTower('B'));
    if (el.tdSellTower) el.tdSellTower.addEventListener('click', tdSellSelectedTower);

    if (el.tdTowerTypes) {
        el.tdTowerTypes.addEventListener('click', (event) => {
            const button = event.target.closest('[data-td-type]');
            if (!button) return;
            tdSelectTowerType(button.dataset.tdType);
        });
    }

    if (el.tdDifficultyModes) {
        el.tdDifficultyModes.addEventListener('click', (event) => {
            const button = event.target.closest('[data-td-difficulty]');
            if (!button) return;
            tdSetDifficulty(button.dataset.tdDifficulty);
        });
    }

    if (el.tdCanvas) el.tdCanvas.addEventListener('click', tdPlaceOrSelect);

    if (el.lbNameInput) {
        el.lbNameInput.addEventListener('change', () => {
            state.playerName = normalizeCommanderName(el.lbNameInput.value);
            el.lbNameInput.value = state.playerName;
            saveGame();
        });
    }

    if (el.lbSubmitBtn) {
        el.lbSubmitBtn.addEventListener('click', () => {
            state.playerName = normalizeCommanderName(el.lbNameInput ? el.lbNameInput.value : state.playerName);
            if (el.lbNameInput) el.lbNameInput.value = state.playerName;
            const didSubmit = submitLeaderboardEntry('manual');
            if (didSubmit) saveGame();
        });
    }

    if (el.lbRefreshBtn) {
        el.lbRefreshBtn.addEventListener('click', () => {
            loadLeaderboard();
            renderLeaderboard();
            if (el.lbStatus) el.lbStatus.textContent = 'Leaderboard refreshed.';
        });
    }
}

function boot() {
    loadGame();
    loadLeaderboard();
    bindEvents();
    tdApplyDifficultyButtons();
    tdResetState();
    tdDraw();
    renderAll();
    renderLeaderboard();
    refreshLeaderboardSubmitUi();

    if (el.lbNameInput) {
        el.lbNameInput.value = normalizeCommanderName(state.playerName);
    }

    setInterval(passiveIncomeTick, 200);
    setInterval(timedTick, 1000);
}

boot();
