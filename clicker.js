
const IS_TD_STANDALONE = Boolean(document.getElementById('tdCanvas')) && !document.querySelector('.gem-button');

const SAVE_KEY = IS_TD_STANDALONE
    ? 'caleb_td_standalone_save_v1'
    : 'caleb_clicker_save_v6_space';
const LEGACY_V5_KEY = 'caleb_clicker_save_v5_space';
const LEGACY_V4_KEY = 'caleb_clicker_save_v4_space';
const LEGACY_V3_KEY = 'caleb_clicker_save_v3';
const LEADERBOARD_KEY = IS_TD_STANDALONE
    ? 'caleb_td_standalone_leaderboard_v1'
    : 'calyx_space_global_leaderboard_v1';
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
        canHitAir: true,
        burnDps: 0,
        burnTime: 0,
        color: '#5cf5ff'
    },
    cannon: {
        name: 'Cannon Tower',
        tokenCost: 2,
        range: 105,
        fireRate: 0.8,
        damage: 17,
        splash: 26,
        stunChance: 0,
        stunTime: 0,
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
        canHitAir: true,
        armorShred: 0.08,
        armorShredTime: 2.3,
        color: '#c6b4ff'
    },
    missile: {
        name: 'Missile Tower',
        tokenCost: 4,
        range: 160,
        fireRate: 1.15,
        damage: 28,
        splash: 38,
        canHitAir: true,
        antiAirBonus: 0.35,
        color: '#ff9c90'
    },
    relay: {
        name: 'Relay Tower',
        tokenCost: 3,
        range: 98,
        fireRate: 1.08,
        damage: 3,
        auraRadius: 88,
        auraDamage: 0.12,
        auraRate: 0.08,
        color: '#9dff92'
    },
    investment: {
        name: 'Venture Tower',
        tokenCost: 1,
        range: 0,
        fireRate: 2.6,
        damage: 0,
        ventureEnergy: 2,
        ventureGems: 36,
        ventureTokenChance: 0.03,
        color: '#ffe28e'
    }
};

const ENEMY_TYPES = {
    scout: { hpMult: 0.85, speedMult: 1.45, reward: 1, radius: 7, color: '#ff8c74' },
    runner: { hpMult: 0.62, speedMult: 1.95, reward: 1, radius: 6, color: '#ffd28a' },
    flyer: { hpMult: 0.95, speedMult: 1.32, reward: 2, radius: 8, color: '#8fd3ff', airborne: true },
    brute: { hpMult: 2.4, speedMult: 0.67, reward: 3, radius: 10, color: '#ff596d' },
    bulwark: { hpMult: 3.2, speedMult: 0.58, reward: 5, radius: 11, color: '#b8ffb2', armor: 0.42 },
    splitter: { hpMult: 1.2, speedMult: 1.05, reward: 2, radius: 8, color: '#d98eff', split: true },
    shield: { hpMult: 1.8, speedMult: 0.9, reward: 3, radius: 9, color: '#9eff90', armor: 0.24 },
    boss: { hpMult: 7.4, speedMult: 0.55, reward: 14, radius: 13, color: '#ffd16e', armor: 0.12 }
};

const TD_DIFFICULTIES = {
    easy: {
        label: 'Easy',
        enemyHpMult: 1.08,
        enemySpeedMult: 1.04,
        spawnCountMult: 1.05,
        spawnRateMult: 1.02,
        playerHpMult: 1,
        tokenMult: 1,
        energyGainMult: 1.05,
        baseLeakDamage: 1,
        bossEvery: 5,
        victoryWave: 18,
        strikeCost: 24
    },
    medium: {
        label: 'Medium',
        enemyHpMult: 1.65,
        enemySpeedMult: 1.2,
        spawnCountMult: 1.38,
        spawnRateMult: 1.28,
        playerHpMult: 1,
        tokenMult: 1,
        energyGainMult: 0.88,
        baseLeakDamage: 2,
        bossEvery: 4,
        victoryWave: 24,
        strikeCost: 30
    },
    hard: {
        label: 'Hard',
        enemyHpMult: 2.25,
        enemySpeedMult: 1.34,
        spawnCountMult: 1.78,
        spawnRateMult: 1.46,
        playerHpMult: 1,
        tokenMult: 1,
        energyGainMult: 0.76,
        baseLeakDamage: 2,
        bossEvery: 3,
        victoryWave: 28,
        strikeCost: 34
    },
    veryhard: {
        label: 'Very Hard',
        enemyHpMult: 3.15,
        enemySpeedMult: 1.52,
        spawnCountMult: 2.25,
        spawnRateMult: 1.72,
        playerHpMult: 1,
        tokenMult: 1,
        energyGainMult: 0.68,
        baseLeakDamage: 3,
        bossEvery: 3,
        victoryWave: 32,
        strikeCost: 38
    },
    insane: {
        label: 'Insane',
        enemyHpMult: 4.25,
        enemySpeedMult: 1.8,
        spawnCountMult: 2.65,
        spawnRateMult: 2.05,
        playerHpMult: 1,
        tokenMult: 1,
        energyGainMult: 0.56,
        baseLeakDamage: 4,
        bossEvery: 2,
        victoryWave: 36,
        strikeCost: 44
    }
};

const TD_MAP_LAYOUTS = {
    serpent: {
        name: 'Serpent Corridor',
        routes: [
            [
                { x: -18, y: 52.5 },
                { x: 525, y: 52.5 },
                { x: 525, y: 87.5 },
                { x: 35, y: 87.5 },
                { x: 35, y: 122.5 },
                { x: 525, y: 122.5 },
                { x: 525, y: 157.5 },
                { x: 580, y: 157.5 }
            ]
        ]
    },
    canyon: {
        name: 'Twin Canyon',
        routes: [
            [
                { x: -18, y: 35 },
                { x: 210, y: 35 },
                { x: 210, y: 105 },
                { x: 420, y: 105 },
                { x: 420, y: 157.5 },
                { x: 580, y: 157.5 }
            ],
            [
                { x: -18, y: 175 },
                { x: 175, y: 175 },
                { x: 175, y: 122.5 },
                { x: 385, y: 122.5 },
                { x: 385, y: 70 },
                { x: 580, y: 70 }
            ]
        ]
    },
    choke: {
        name: 'Iron Chokepoint',
        routes: [
            [
                { x: -18, y: 35 },
                { x: 140, y: 35 },
                { x: 140, y: 105 },
                { x: 280, y: 105 },
                { x: 280, y: 175 },
                { x: 420, y: 175 },
                { x: 420, y: 105 },
                { x: 560, y: 105 },
                { x: 580, y: 105 }
            ]
        ]
    }
};

const TD_MODES = {
    classic: { label: 'Classic', endless: false, mutatorRush: false, maze: false, baseLives: 3, trapCost: 18, dashCost: 32, victoryBonusWave: 0, forcedMutator: false },
    endless: { label: 'Endless', endless: true, mutatorRush: false, maze: false, baseLives: 2, trapCost: 20, dashCost: 34, victoryBonusWave: 0, forcedMutator: false },
    mutator: { label: 'Mutator Rush', endless: false, mutatorRush: true, maze: false, baseLives: 3, trapCost: 19, dashCost: 33, victoryBonusWave: 3, forcedMutator: true },
    maze: { label: 'Maze Mode', endless: false, mutatorRush: false, maze: true, baseLives: 4, trapCost: 16, dashCost: 30, victoryBonusWave: 2, forcedMutator: false }
};

const TD_OBJECTIVE_POOL = [
    { id: 'no_tesla', label: 'Win without Tesla Towers.' },
    { id: 'no_orbital', label: 'Win without Orbital Strike.' },
    { id: 'trap_kills', label: 'Get 12 trap kills in a run.' },
    { id: 'economy_push', label: 'Build 2 Venture Towers.' },
    { id: 'high_hp', label: 'Finish with at least 60% base HP.' }
];

const TD_TARGET_MODES = ['first', 'strong', 'armor', 'last'];
const TD_KILLS_PER_TOKEN = 14;
const TD_WAVE_TOKEN_REWARD = 1;

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
    tdWinsPreview: document.getElementById('tdWinsPreview'),
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
    tdRangeBtn: document.getElementById('tdRangeBtn'),
    tdUpgradeA: document.getElementById('tdUpgradeA'),
    tdUpgradeB: document.getElementById('tdUpgradeB'),
    tdTargetBtn: document.getElementById('tdTargetBtn'),
    tdSellTower: document.getElementById('tdSellTower'),
    tdSelectedLabel: document.getElementById('tdSelectedLabel'),
    tdTowerTypes: document.getElementById('tdTowerTypes'),
    tdDifficultyModes: document.getElementById('tdDifficultyModes'),
    tdModeRow: document.getElementById('tdModeRow'),

    tdCanvas: document.getElementById('tdCanvas'),
    tdBaseHp: document.getElementById('tdBaseHp'),
    tdWave: document.getElementById('tdWave'),
    tdTokens: document.getElementById('tdTokens'),
    tdKills: document.getElementById('tdKills'),
    tdEnergy: document.getElementById('tdEnergy'),
    tdMutator: document.getElementById('tdMutator'),
    tdMapLabel: document.getElementById('tdMapLabel'),
    tdWaveIntel: document.getElementById('tdWaveIntel'),
    tdIncomingList: document.getElementById('tdIncomingList'),
    tdEnemyLegend: document.getElementById('tdEnemyLegend'),
    tdEnemyTooltip: document.getElementById('tdEnemyTooltip'),
    tdObjectiveList: document.getElementById('tdObjectiveList'),
    tdTrapBtn: document.getElementById('tdTrapBtn'),
    tdDashBtn: document.getElementById('tdDashBtn'),
    tdActiveHint: document.getElementById('tdActiveHint'),
    tdFeedback: document.getElementById('tdFeedback'),
    tdMetaModes: document.getElementById('tdMetaModes'),
    tdMetaPoints: document.getElementById('tdMetaPoints'),
    tdMetaStatus: document.getElementById('tdMetaStatus'),
    tdLives: document.getElementById('tdLives'),
    tdPermadeathBtn: document.getElementById('tdPermadeathBtn'),

    tdBestWaveReadout: document.getElementById('tdBestWaveReadout'),
    tdBestKillsReadout: document.getElementById('tdBestKillsReadout'),

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
    tdMode: 'classic',
    tdPermadeath: false,
    tdBestEndlessWave: 0,
    tdMetaPoints: 0,
    tdMetaSpent: 0,
    tdMetaTree: {
        control: 0,
        burst: 0,
        economy: 0
    },
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

    mapKey: 'serpent',
    mapName: 'Serpent Corridor',
    modeKey: 'classic',
    routes: [],
    pathCells: new Set(),
    mazeStart: { col: 0, row: 2 },
    mazeEnd: { col: 15, row: 3 },

    baseHp: 20,
    maxHp: 20,
    lives: 3,
    wave: 0,
    kills: 0,
    tokens: 0,
    energy: 0,
    speedMult: 1,
    victoryWave: 20,
    difficultyKey: 'medium',
    currentMutator: {
        label: 'Stable Orbit',
        hpMult: 1,
        speedMult: 1,
        rewardMult: 1,
        energyMult: 1,
        spawnMult: 1,
        leakBonus: 0
    },
    currentBossMode: null,

    waveActive: false,
    enemiesToSpawn: 0,
    spawnDelay: 0.8,
    spawnClock: 0,
    nextWaveClock: 0,
    damageThisSecond: 0,
    damageSecondClock: 0,
    dpsNow: 0,
    dpsTarget: 0,
    dpsPressureTimer: 0,
    dpsPressure: 0,

    selectedTowerType: 'laser',
    selectedTowerId: null,

    towers: [],
    enemies: [],
    shots: [],
    traps: [],
    objectives: [],
    objectiveState: {
        teslaPlaced: false,
        orbitalUsed: false,
        trapKills: 0,
        venturePlaced: 0
    },
    activeAbility: null,
    particles: [],
    shockwaves: [],

    intervalId: null,
    secondId: null,
    uidSeed: 1,
    frameClock: 0,
    showRanges: true,
    hoverCell: null,
    cursorX: null,
    cursorY: null,
    shakeTime: 0,
    shakePower: 0,
    audioCtx: null,
    lastShotSound: 0
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
    if (IS_TD_STANDALONE) return 0;
    return BUILDINGS.reduce((sum, b) => sum + state.buildings[b.id], 0);
}

function prestigeGpsMultiplier() {
    if (IS_TD_STANDALONE) return 1;
    return 1 + state.prestigeShards * 0.12;
}

function prestigeTdMultiplier() {
    if (IS_TD_STANDALONE) return 1;
    return 1 + state.prestigeShards * 0.08;
}

function prestigeClickMultiplier() {
    if (IS_TD_STANDALONE) return 1;
    return 1 + state.prestigeShards * 0.04;
}

function prestigeGoldenBonus() {
    if (IS_TD_STANDALONE) return 0;
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
    state.tdBestEndlessWave = Math.max(0, Number(state.tdBestEndlessWave || 0));
    if (!TD_DIFFICULTIES[state.tdDifficulty]) state.tdDifficulty = 'medium';
    if (!TD_MODES[state.tdMode]) state.tdMode = 'classic';
    if (typeof state.tdPermadeath !== 'boolean') state.tdPermadeath = false;
    if (typeof state.leaderboardSubmitted !== 'boolean') state.leaderboardSubmitted = false;

    if (!state.tdMetaTree || typeof state.tdMetaTree !== 'object') {
        state.tdMetaTree = { control: 0, burst: 0, economy: 0 };
    }
    state.tdMetaTree.control = Math.max(0, Math.min(3, Number(state.tdMetaTree.control || 0)));
    state.tdMetaTree.burst = Math.max(0, Math.min(3, Number(state.tdMetaTree.burst || 0)));
    state.tdMetaTree.economy = Math.max(0, Math.min(3, Number(state.tdMetaTree.economy || 0)));
    state.tdMetaSpent = Math.max(0, Number(state.tdMetaSpent || 0));
    state.tdMetaPoints = Math.max(0, Number(state.tdMetaPoints || 0));

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
        tdMode: state.tdMode,
        tdPermadeath: state.tdPermadeath,
        tdBestEndlessWave: state.tdBestEndlessWave,
        tdMetaPoints: state.tdMetaPoints,
        tdMetaSpent: state.tdMetaSpent,
        tdMetaTree: state.tdMetaTree,
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
    state.tdMode = String(v4.tdMode || 'classic');
    state.tdPermadeath = Boolean(v4.tdPermadeath);
    state.tdBestEndlessWave = Number(v4.tdBestEndlessWave || 0);
    state.tdMetaPoints = Number(v4.tdMetaPoints || 0);
    state.tdMetaSpent = Number(v4.tdMetaSpent || 0);
    state.tdMetaTree = { control: 0, burst: 0, economy: 0, ...(v4.tdMetaTree || {}) };
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

    if (IS_TD_STANDALONE) {
        validateState();
        return;
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
    safeSet(el.tdWinsPreview, fmt(state.tdWins));
    safeSet(el.tdBestWaveReadout, fmt(state.tdBestWave));
    safeSet(el.tdBestKillsReadout, fmt(state.tdBestKills));

    if (el.comboFill) {
        const width = Math.min((state.comboCount / 28) * 100, 100);
        el.comboFill.style.width = `${width}%`;
    }

    document.body.classList.toggle('frenzy', state.frenzyTime > 0);
    renderPrestige();
}

function renderTdStats() {
    const cfg = tdDifficultyConfig();
    const mode = tdModeConfig();
    const tokenSafe = Number.isFinite(td.tokens) ? Math.max(0, Math.floor(td.tokens)) : 0;
    const energySafe = Number.isFinite(td.energy) ? Math.max(0, td.energy) : 0;
    const killsSafe = Number.isFinite(td.kills) ? Math.max(0, Math.floor(td.kills)) : 0;
    const nextTokenIn = TD_KILLS_PER_TOKEN - (killsSafe % TD_KILLS_PER_TOKEN || TD_KILLS_PER_TOKEN);

    safeSet(el.tdBaseHp, `${td.baseHp}/${td.maxHp}`);
    safeSet(el.tdWave, td.wave);
    safeSet(el.tdTokens, `${tokenSafe} (next +1 in ${nextTokenIn})`);
    safeSet(el.tdKills, td.kills);
    const bestTag = mode.endless
        ? `Endless Best ${fmt(state.tdBestEndlessWave)}`
        : `Best Wave ${fmt(state.tdBestWave)}`;
    safeSet(el.tdEnergy, `${fmtDec(energySafe, 1)} | ${bestTag} | ${mode.label} | ${cfg.label}`);
    safeSet(el.tdMutator, `Mutator: ${td.currentMutator.label}`);
    safeSet(el.tdMapLabel, `Map: ${td.mapName}`);
    safeSet(el.tdWaveIntel, tdWaveIntel());
    safeSet(el.tdLives, td.lives);
    renderTdObjectives();
    renderTdIncomingPanel();
    if (el.tdRangeBtn) {
        el.tdRangeBtn.textContent = `Ranges: ${td.showRanges ? 'ON' : 'OFF'}`;
    }
    if (el.tdSpeedBtn) el.tdSpeedBtn.textContent = `Speed x${td.speedMult}`;
    if (el.tdAbilityBtn) el.tdAbilityBtn.textContent = `Orbital Strike (${cfg.strikeCost})`;
    if (el.tdTrapBtn) el.tdTrapBtn.textContent = `Place Mine Trap (${mode.trapCost})`;
    if (el.tdDashBtn) el.tdDashBtn.textContent = `Pilot Dash (${mode.dashCost})`;
    if (el.tdPermadeathBtn) el.tdPermadeathBtn.textContent = `Permadeath: ${state.tdPermadeath ? 'ON' : 'OFF'}`;
    if (el.tdActiveHint) {
        if (td.activeAbility === 'trap') el.tdActiveHint.textContent = 'Trap armed: click a cell to place a mine.';
        else if (td.activeAbility === 'dash') el.tdActiveHint.textContent = 'Dash armed: click near enemies to burst them.';
        else el.tdActiveHint.textContent = 'Click the battlefield after choosing an active ability target.';
    }
    renderTdTypeButtons();
}

function tdPlacementTokenCost(typeKey) {
    const base = (TOWER_TYPES[typeKey] && TOWER_TYPES[typeKey].tokenCost) || 1;
    const densityTax = Math.floor(td.towers.length / 4);
    const modeTax = state.tdMode === 'maze' ? 1 : 0;
    return Math.max(1, base + densityTax + modeTax);
}

function renderTdTypeButtons() {
    if (!el.tdTowerTypes) return;
    el.tdTowerTypes.querySelectorAll('.td-type').forEach((btn) => {
        const typeKey = btn.dataset.tdType;
        const type = TOWER_TYPES[typeKey];
        if (!type) return;
        btn.textContent = `${type.name} (${tdPlacementTokenCost(typeKey)} tok)`;
    });
}

function tdPoolForWave(waveNum) {
    if (waveNum < 3) return ['scout', 'runner'];
    if (waveNum < 6) return ['scout', 'runner', 'brute', 'flyer'];
    if (waveNum < 10) return ['scout', 'runner', 'brute', 'splitter', 'flyer'];
    if (waveNum < 15) return ['scout', 'runner', 'brute', 'splitter', 'shield', 'flyer', 'bulwark'];
    return ['scout', 'runner', 'brute', 'splitter', 'shield', 'flyer', 'bulwark', 'boss'];
}

function tdIncomingWaveLabel(waveNum) {
    const pool = tdPoolForWave(waveNum);
    const tags = [];
    if (pool.includes('runner')) tags.push('Fast');
    if (pool.includes('flyer')) tags.push('Air');
    if (pool.includes('bulwark')) tags.push('Armor');
    if (pool.includes('splitter')) tags.push('Split');
    const cfg = tdDifficultyConfig();
    if (waveNum % cfg.bossEvery === 0) tags.push('Boss');
    return tags.join(' | ') || 'Scouts';
}

function renderTdIncomingPanel() {
    if (!el.tdIncomingList) return;

    const rows = [];
    for (let i = 1; i <= 3; i += 1) {
        const waveNum = td.wave + i;
        rows.push(`<div class="td-incoming-row">Wave ${waveNum}: ${tdIncomingWaveLabel(waveNum)}</div>`);
    }
    el.tdIncomingList.innerHTML = rows.join('');
}

function tdEnemyVulnerabilityText(type) {
    const map = {
        scout: 'Scout: low HP. Weak to high fire rate and chain towers.',
        runner: 'Runner: very fast. Counter with Frost slows and fast Laser tracking.',
        flyer: 'Flyer: airborne. Needs Missile, Tesla, or Laser (anti-air capable).',
        bulwark: 'Bulwark: heavy armor. Strip armor with Tesla, then burst with Cannon/Missile.',
        shield: 'Shield: armored with sustain pressure. Use shred + AoE layering.',
        boss: 'Boss: high HP/armor + mechanics. Prepare stuns, armor shred, and reserve orbital strike.'
    };

    return map[type] || 'No intel available.';
}

function tdInitAudio() {
    if (td.audioCtx) return td.audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    td.audioCtx = new Ctx();
    return td.audioCtx;
}

function tdSfx(kind) {
    const ctx = tdInitAudio();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (kind === 'shot') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(420, now);
        osc.frequency.exponentialRampToValueAtTime(290, now + 0.04);
        gain.gain.setValueAtTime(0.03, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
        return;
    }

    if (kind === 'kill') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(170, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
        gain.gain.setValueAtTime(0.045, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
        osc.start(now);
        osc.stop(now + 0.09);
        return;
    }

    if (kind === 'victory') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(380, now);
        osc.frequency.exponentialRampToValueAtTime(640, now + 0.16);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    }
}

function tdTriggerShake(power, duration) {
    td.shakePower = Math.max(td.shakePower, power);
    td.shakeTime = Math.max(td.shakeTime, duration);
}

function tdMetaLevel(key) {
    return Number((state.tdMetaTree && state.tdMetaTree[key]) || 0);
}

function tdMetaCost(key) {
    return tdMetaLevel(key) + 1;
}

function renderTdMeta() {
    safeSet(el.tdMetaPoints, state.tdMetaPoints);

    if (!el.tdMetaModes) return;

    const labels = {
        control: 'Control Lab',
        burst: 'Siege Lab',
        economy: 'Venture Lab'
    };

    el.tdMetaModes.querySelectorAll('[data-td-tech]').forEach((btn) => {
        const key = btn.dataset.tdTech;
        const lvl = tdMetaLevel(key);
        const maxed = lvl >= 3;
        const cost = tdMetaCost(key);

        btn.disabled = maxed || state.tdMetaPoints < cost;
        btn.textContent = maxed
            ? `${labels[key]} Lv${lvl} (MAX)`
            : `${labels[key]} Lv${lvl} -> ${lvl + 1} (${cost} pts)`;
    });

    if (el.tdMetaStatus) {
        el.tdMetaStatus.textContent = 'Control boosts slows/DoT, Siege boosts burst/armor break, Venture boosts economy tower output.';
    }
}

function tdUnlockMeta(key) {
    if (!state.tdMetaTree || !(key in state.tdMetaTree)) return;

    const lvl = tdMetaLevel(key);
    if (lvl >= 3) {
        if (el.tdFeedback) el.tdFeedback.textContent = 'That lab path is already maxed.';
        return;
    }

    const cost = tdMetaCost(key);
    if (state.tdMetaPoints < cost) {
        if (el.tdFeedback) el.tdFeedback.textContent = `Need ${cost} meta point(s).`;
        return;
    }

    state.tdMetaPoints -= cost;
    state.tdMetaSpent += cost;
    state.tdMetaTree[key] = lvl + 1;
    renderTdMeta();
    renderSelectedTower();
    saveGame();

    if (el.tdFeedback) el.tdFeedback.textContent = `${key} lab upgraded to level ${state.tdMetaTree[key]}.`;
}

function tdRelayBoost(targetTower) {
    let bonusDamage = 0;
    let bonusRate = 0;

    td.towers.forEach((tower) => {
        if (tower.id === targetTower.id || tower.type !== 'relay') return;

        const relayCfg = TOWER_TYPES.relay;
        const auraRadius = relayCfg.auraRadius + tower.pathA * 10 + tower.pathB * 6;
        const auraDamage = relayCfg.auraDamage + tower.pathA * 0.04;
        const auraRate = relayCfg.auraRate + tower.pathB * 0.03;
        const dist = Math.hypot(targetTower.x - tower.x, targetTower.y - tower.y);

        if (dist <= auraRadius) {
            bonusDamage += auraDamage;
            bonusRate += auraRate;
        }
    });

    return {
        damage: Math.min(0.72, bonusDamage),
        rate: Math.min(0.48, bonusRate)
    };
}

function renderSelectedTower() {
    if (!el.tdSelectedLabel) return;

    const tower = td.towers.find((t) => t.id === td.selectedTowerId);
    if (!tower) {
        el.tdSelectedLabel.textContent = 'Select a tower on the grid to upgrade it.';
        if (el.tdTargetBtn) el.tdTargetBtn.textContent = 'Target Priority: n/a';
        return;
    }

    const costA = tdUpgradeCost(tower, 'A');
    const costB = tdUpgradeCost(tower, 'B');
    const targetMode = tower.targetMode || 'first';
    const targetLabel = targetMode.charAt(0).toUpperCase() + targetMode.slice(1);

    const stats = tdTowerStats(tower);
    const relayInfo = tower.type === 'relay'
        ? ` | Aura +${Math.round((stats.auraDamage || 0) * 100)}% dmg, +${Math.round((stats.auraRate || 0) * 100)}% rate`
        : '';
    const roleInfo = tower.type === 'laser'
        ? ' | Role: DoT + bonus vs slowed'
        : tower.type === 'tesla'
            ? ' | Role: Chain + armor shred'
            : tower.type === 'cannon'
                ? ' | Role: AoE + stun chance'
                : tower.type === 'missile'
                    ? ' | Role: Anti-air burst'
                    : tower.type === 'frost'
                        ? ' | Role: Crowd control + setup'
                        : tower.type === 'investment'
                            ? ' | Role: Risk-reward economy output'
                            : ' | Role: Team support';

    el.tdSelectedLabel.textContent = `${TOWER_TYPES[tower.type].name} | A:${tower.pathA} B:${tower.pathB}${relayInfo}${roleInfo} | Target:${targetLabel} | Upgrade A:${costA} energy | Upgrade B:${costB} energy`;
    if (el.tdTargetBtn) el.tdTargetBtn.textContent = `Target Priority: ${targetLabel}`;
}

function renderAll() {
    recomputeGps();
    renderCoreStats();
    renderBuildings();
    renderResearch();
    renderAchievements();
    renderTdStats();
    renderTdMeta();
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
    const fixedByDifficulty = {
        easy: 22,
        medium: 18,
        hard: 15,
        veryhard: 13,
        insane: 11
    };

    return fixedByDifficulty[state.tdDifficulty] || 18;
}

function tdTokenStartForRun() {
    const startByDifficulty = {
        easy: 3,
        medium: 2,
        hard: 2,
        veryhard: 1,
        insane: 1
    };

    const base = startByDifficulty[state.tdDifficulty] || 3;
    if (IS_TD_STANDALONE) {
        return base;
    }
    const researchBonus = Math.floor(state.tdBonusTokens * 0.34);
    const prestigeBonus = Math.floor(state.prestigeShards / 18);
    return Math.max(1, base + researchBonus + prestigeBonus);
}

function tdPathCellKey(col, row) {
    return `${col},${row}`;
}

function tdBuildPathCells(routes) {
    const cells = new Set();

    routes.forEach((route) => {
        for (let i = 1; i < route.length; i += 1) {
            const from = route[i - 1];
            const to = route[i];
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const steps = Math.max(Math.abs(Math.round(dx / 4)), Math.abs(Math.round(dy / 4)), 1);

            for (let s = 0; s <= steps; s += 1) {
                const t = s / steps;
                const x = from.x + dx * t;
                const y = from.y + dy * t;
                const col = Math.floor(x / td.cell);
                const row = Math.floor(y / td.cell);
                if (col >= 0 && col < td.cols && row >= 0 && row < td.rows) {
                    cells.add(tdPathCellKey(col, row));
                }
            }
        }
    });

    return cells;
}

function tdChooseLayoutKey() {
    const keys = Object.keys(TD_MAP_LAYOUTS);
    const cycleIndex = (state.tdWins + state.prestigeRuns) % keys.length;

    // Mostly predictable rotation, with occasional anomaly map.
    if (Math.random() < 0.18) {
        return keys[Math.floor(Math.random() * keys.length)];
    }

    return keys[cycleIndex];
}

function tdApplyMapLayout(mapKey) {
    const layout = TD_MAP_LAYOUTS[mapKey] || TD_MAP_LAYOUTS.serpent;
    td.mapKey = mapKey;
    td.mapName = layout.name;
    td.routes = layout.routes.map((route) => route.map((pt) => ({ ...pt })));
    td.pathCells = tdBuildPathCells(td.routes);
}

function tdWaveIntel() {
    const nextWave = td.wave + 1;
    const pool = tdWavePool();
    const anchors = [];

    if (pool.includes('runner')) anchors.push('fast runners');
    if (pool.includes('flyer')) anchors.push('air units');
    if (pool.includes('bulwark')) anchors.push('heavy armor');
    if (pool.includes('splitter')) anchors.push('splitters');

    const cfg = tdDifficultyConfig();
    const bossSoon = nextWave % cfg.bossEvery === 0;
    const surprise = Math.random() < 0.18 ? 'Unknown anomaly!' : 'Stable prediction';
    const label = anchors.length > 0 ? anchors.slice(0, 2).join(' + ') : 'scout pressure';
    const dpsText = td.dpsTarget > 0
        ? ` | DPS ${fmtDec(td.dpsNow, 0)}/${fmtDec(td.dpsTarget, 0)}`
        : '';
    const pressure = td.dpsPressure > 0.45 ? ' | Pressure rising' : '';

    return `Next Wave ${nextWave}: ${label}${bossSoon ? ' | Boss incoming' : ''} | ${surprise}${dpsText}${pressure}`;
}

function tdModeConfig() {
    return TD_MODES[state.tdMode] || TD_MODES.classic;
}

function tdApplyModeButtons() {
    if (!el.tdModeRow) return;
    el.tdModeRow.querySelectorAll('[data-td-mode]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.tdMode === state.tdMode);
    });
}

function tdSetMode(modeKey) {
    if (!TD_MODES[modeKey]) return;
    if (td.running) {
        if (el.tdFeedback) el.tdFeedback.textContent = 'Finish current run before changing mode.';
        return;
    }

    state.tdMode = modeKey;
    tdApplyModeButtons();
    tdResetState();
    tdDraw();
    saveGame();

    if (el.tdFeedback) el.tdFeedback.textContent = `Mode set to ${TD_MODES[modeKey].label}.`;
}

function tdTogglePermadeath() {
    if (td.running) {
        if (el.tdFeedback) el.tdFeedback.textContent = 'Cannot toggle permadeath mid-run.';
        return;
    }

    state.tdPermadeath = !state.tdPermadeath;
    tdResetState();
    tdDraw();
    renderTdStats();
    saveGame();
    if (el.tdFeedback) el.tdFeedback.textContent = `Permadeath ${state.tdPermadeath ? 'enabled' : 'disabled'}.`;
}

function tdPickObjectives() {
    const pool = [...TD_OBJECTIVE_POOL];
    const picks = [];

    while (pool.length > 0 && picks.length < 2) {
        const idx = Math.floor(Math.random() * pool.length);
        picks.push({ ...pool.splice(idx, 1)[0], done: false });
    }

    return picks;
}

function tdObjectiveDone(id) {
    if (id === 'no_tesla') return !td.objectiveState.teslaPlaced;
    if (id === 'no_orbital') return !td.objectiveState.orbitalUsed;
    if (id === 'trap_kills') return td.objectiveState.trapKills >= 12;
    if (id === 'economy_push') return td.objectiveState.venturePlaced >= 2;
    if (id === 'high_hp') return td.baseHp >= Math.ceil(td.maxHp * 0.6);
    return false;
}

function renderTdObjectives() {
    if (!el.tdObjectiveList) return;
    if (!td.objectives || td.objectives.length <= 0) {
        el.tdObjectiveList.innerHTML = '<div class="td-objective-item">Objectives load at run start.</div>';
        return;
    }

    el.tdObjectiveList.innerHTML = td.objectives.map((obj) => {
        const done = tdObjectiveDone(obj.id);
        return `<div class="td-objective-item ${done ? 'done' : ''}">${done ? 'DONE - ' : ''}${obj.label}</div>`;
    }).join('');
}

function tdBlockedCells(extraBlock = null, ignoreTowerId = null) {
    const blocked = new Set();
    td.towers.forEach((tower) => {
        if (ignoreTowerId && tower.id === ignoreTowerId) return;
        blocked.add(tdPathCellKey(tower.col, tower.row));
    });
    if (extraBlock) blocked.add(tdPathCellKey(extraBlock.col, extraBlock.row));
    return blocked;
}

function tdGridPathBfs(blocked) {
    const start = td.mazeStart;
    const end = td.mazeEnd;
    const queue = [{ col: start.col, row: start.row }];
    const seen = new Set([tdPathCellKey(start.col, start.row)]);
    const prev = new Map();
    const dirs = [
        { dc: 1, dr: 0 },
        { dc: -1, dr: 0 },
        { dc: 0, dr: 1 },
        { dc: 0, dr: -1 }
    ];

    while (queue.length > 0) {
        const cur = queue.shift();
        if (cur.col === end.col && cur.row === end.row) {
            const path = [];
            let k = tdPathCellKey(cur.col, cur.row);
            while (k) {
                const [c, r] = k.split(',').map(Number);
                path.push({ col: c, row: r });
                k = prev.get(k);
            }
            return path.reverse();
        }

        dirs.forEach((d) => {
            const nc = cur.col + d.dc;
            const nr = cur.row + d.dr;
            if (nc < 0 || nr < 0 || nc >= td.cols || nr >= td.rows) return;
            const nk = tdPathCellKey(nc, nr);
            if (seen.has(nk) || blocked.has(nk)) return;
            seen.add(nk);
            prev.set(nk, tdPathCellKey(cur.col, cur.row));
            queue.push({ col: nc, row: nr });
        });
    }

    return null;
}

function tdRouteFromGridPath(path) {
    if (!path || path.length <= 0) return [];
    const route = [{ x: -18, y: path[0].row * td.cell + td.cell / 2 }];
    path.forEach((node) => {
        route.push({
            x: node.col * td.cell + td.cell / 2,
            y: node.row * td.cell + td.cell / 2
        });
    });
    route.push({ x: td.width + 20, y: path[path.length - 1].row * td.cell + td.cell / 2 });
    return route;
}

function tdRebuildMazeRoute(extraBlock = null, ignoreTowerId = null) {
    const blocked = tdBlockedCells(extraBlock, ignoreTowerId);
    blocked.delete(tdPathCellKey(td.mazeStart.col, td.mazeStart.row));
    blocked.delete(tdPathCellKey(td.mazeEnd.col, td.mazeEnd.row));
    const path = tdGridPathBfs(blocked);
    if (!path) return false;

    td.routes = [tdRouteFromGridPath(path)];
    td.pathCells = tdBuildPathCells(td.routes);
    td.mapName = 'Maze Labyrinth';
    td.mapKey = 'maze';

    const activeRoute = td.routes[0];
    td.enemies.forEach((enemy) => {
        enemy.route = activeRoute;
        let bestIdx = 1;
        let bestDist = Infinity;
        for (let i = 1; i < activeRoute.length; i += 1) {
            const node = activeRoute[i];
            const d = Math.hypot(node.x - enemy.x, node.y - enemy.y);
            if (d < bestDist) {
                bestDist = d;
                bestIdx = i;
            }
        }
        enemy.pathIndex = bestIdx;
    });

    return true;
}

function tdResetState() {
    const cfg = tdDifficultyConfig();
    const mode = tdModeConfig();
    td.maxHp = tdBaseHpForRun();
    td.baseHp = td.maxHp;
    td.lives = state.tdPermadeath ? 1 : mode.baseLives;
    td.modeKey = state.tdMode;
    td.wave = 0;
    td.kills = 0;
    td.tokens = tdTokenStartForRun();
    td.energy = state.tdStartEnergy;
    td.speedMult = 1;
    td.victoryWave = mode.endless ? 999999 : cfg.victoryWave + (mode.victoryBonusWave || 0);
    td.difficultyKey = state.tdDifficulty;
    td.currentMutator = {
        label: 'Stable Orbit',
        hpMult: 1,
        speedMult: 1,
        rewardMult: 1,
        energyMult: 1,
        spawnMult: 1,
        leakBonus: 0
    };
    td.currentBossMode = null;

    td.waveActive = false;
    td.enemiesToSpawn = 0;
    td.spawnClock = 0;
    td.nextWaveClock = 0;
    td.damageThisSecond = 0;
    td.damageSecondClock = 0;
    td.dpsNow = 0;
    td.dpsTarget = 0;
    td.dpsPressureTimer = 0;
    td.dpsPressure = 0;

    td.selectedTowerId = null;
    td.towers = [];
    td.enemies = [];
    td.shots = [];
    td.traps = [];
    td.objectives = tdPickObjectives();
    td.objectiveState = {
        teslaPlaced: false,
        orbitalUsed: false,
        trapKills: 0,
        venturePlaced: 0
    };
    td.activeAbility = null;
    td.particles = [];
    td.shockwaves = [];
    td.frameClock = 0;
    if (mode.maze) {
        td.mazeStart = { col: 0, row: 2 };
        td.mazeEnd = { col: td.cols - 1, row: 3 };
        tdRebuildMazeRoute();
    } else {
        tdApplyMapLayout(tdChooseLayoutKey());
    }

    renderTdStats();
    renderSelectedTower();
    tdApplyModeButtons();
}

function tdIsOnPath(row, col) {
    if (!Number.isInteger(col)) return false;
    return td.pathCells.has(tdPathCellKey(col, row));
}

function tdTowerAtCell(col, row) {
    return td.towers.find((tower) => tower.col === col && tower.row === row) || null;
}

function tdEnemyBaseStats(typeName) {
    const cfg = tdDifficultyConfig();
    const type = ENEMY_TYPES[typeName];
    const waveScale = Math.pow(1.24, Math.max(0, td.wave - 1));
    const baseHp = 16 * waveScale * type.hpMult * cfg.enemyHpMult * td.currentMutator.hpMult;
    const baseSpeed = (30 + td.wave * 2.6) * type.speedMult * cfg.enemySpeedMult * td.currentMutator.speedMult;
    return {
        hp: baseHp,
        speed: baseSpeed
    };
}

function tdSpawnEnemy(typeName) {
    const type = ENEMY_TYPES[typeName];
    const stats = tdEnemyBaseStats(typeName);

    const routeIndex = td.routes.length > 1
        ? (td.currentBossMode ? 0 : Math.floor(Math.random() * td.routes.length))
        : 0;
    const route = td.routes[routeIndex] || td.routes[0] || [];
    if (route.length <= 1) return;

    td.enemies.push({
        id: td.uidSeed++,
        type: typeName,
        x: route[0].x,
        y: route[0].y,
        route,
        pathIndex: 1,
        hp: stats.hp,
        maxHp: stats.hp,
        speed: stats.speed,
        airborne: Boolean(type.airborne),
        slowFactor: 1,
        slowTimer: 0,
        dotDps: 0,
        dotTimer: 0,
        armorShred: 0,
        armorShredTimer: 0,
        stunTimer: 0,
        radius: type.radius
    });
}

function tdWavePool() {
    return tdPoolForWave(td.wave);
}

function tdRollMutator() {
    if (td.wave < 4) {
        return {
            label: 'Stable Orbit',
            hpMult: 1,
            speedMult: 1,
            rewardMult: 1,
            energyMult: 1,
            spawnMult: 1,
            leakBonus: 0
        };
    }

    const rolls = [
        { label: 'Meteor Rush', hpMult: 1.05, speedMult: 1.28, rewardMult: 1.15, energyMult: 1, spawnMult: 1.14, leakBonus: 0 },
        { label: 'Iron Convoy', hpMult: 1.36, speedMult: 0.95, rewardMult: 1.2, energyMult: 1.02, spawnMult: 1.08, leakBonus: 1 },
        { label: 'Energy Storm', hpMult: 1.18, speedMult: 1.12, rewardMult: 1.1, energyMult: 1.14, spawnMult: 1.05, leakBonus: 0 },
        { label: 'Void Pressure', hpMult: 1.22, speedMult: 1.18, rewardMult: 1.12, energyMult: 0.92, spawnMult: 1.16, leakBonus: 1 }
    ];

    if (Math.random() < 0.34) {
        return {
            label: 'Stable Orbit',
            hpMult: 1,
            speedMult: 1,
            rewardMult: 1,
            energyMult: 1,
            spawnMult: 1,
            leakBonus: 0
        };
    }

    return rolls[Math.floor(Math.random() * rolls.length)];
}

function tdBossModeForWave() {
    const cfg = tdDifficultyConfig();
    if (td.wave % cfg.bossEvery !== 0) return null;

    const cycle = Math.floor(td.wave / cfg.bossEvery);
    const modes = [
        { label: 'Juggernaut Protocol', hpMult: 1.7, speedMult: 1.06, spawnMult: 1.15, rewardMult: 1.28, leakBonus: 1, bossCount: 1 },
        { label: 'Swarm Overlord', hpMult: 1.45, speedMult: 1.24, spawnMult: 1.34, rewardMult: 1.22, leakBonus: 1, bossCount: 2 },
        { label: 'Siege Colossus', hpMult: 2, speedMult: 0.94, spawnMult: 1.08, rewardMult: 1.36, leakBonus: 2, bossCount: 1 }
    ];

    const mode = modes[(cycle - 1) % modes.length];
    return {
        ...mode,
        bossCount: mode.bossCount + Math.floor(cycle / 4)
    };
}

function tdStartNextWave() {
    const cfg = tdDifficultyConfig();
    const mode = tdModeConfig();
    td.wave += 1;
    state.tdBestWave = Math.max(state.tdBestWave, td.wave);
    if (mode.endless) state.tdBestEndlessWave = Math.max(state.tdBestEndlessWave, td.wave);
    td.currentMutator = tdRollMutator();
    if (mode.forcedMutator) {
        td.currentMutator = {
            label: `MODE: ${mode.label}`,
            hpMult: 1.14,
            speedMult: 1.12,
            rewardMult: 1.2,
            energyMult: 1,
            spawnMult: 1.18,
            leakBonus: 1
        };
    }
    td.currentBossMode = tdBossModeForWave();

    if (td.currentBossMode) {
        td.currentMutator = {
            label: `BOSS MODE: ${td.currentBossMode.label}`,
            hpMult: td.currentMutator.hpMult * td.currentBossMode.hpMult,
            speedMult: td.currentMutator.speedMult * td.currentBossMode.speedMult,
            rewardMult: td.currentMutator.rewardMult * td.currentBossMode.rewardMult,
            energyMult: td.currentMutator.energyMult,
            spawnMult: td.currentMutator.spawnMult * td.currentBossMode.spawnMult,
            leakBonus: td.currentMutator.leakBonus + td.currentBossMode.leakBonus
        };
    }

    td.waveActive = true;
    const endlessSpawn = mode.endless ? (1 + td.wave * 0.012) : 1;
    td.enemiesToSpawn = Math.max(8, Math.round((12 + td.wave * 5) * cfg.spawnCountMult * td.currentMutator.spawnMult * endlessSpawn));
    td.spawnClock = 0;
    td.spawnDelay = Math.max(0.06, ((0.78 - td.wave * 0.022) + Math.max(0, 0.14 - state.tdSpawnSlow)) / cfg.spawnRateMult);

    if (td.currentBossMode) {
        td.enemiesToSpawn += Math.round((4 + td.wave) * cfg.spawnCountMult * 0.75);
        for (let i = 0; i < td.currentBossMode.bossCount; i += 1) {
            tdSpawnEnemy('boss');
        }
        td.energy += Math.round(5 * cfg.energyGainMult * td.currentMutator.energyMult);
    }

    const towerLevels = td.towers.reduce((sum, tower) => sum + tower.pathA + tower.pathB, 0);
    const upkeep = Math.round(td.towers.length * 0.75 + towerLevels * 0.25);
    if (upkeep > 0) {
        const hadEnough = td.energy >= upkeep;
        td.energy = Math.max(0, td.energy - upkeep);
        if (!hadEnough) {
            td.currentMutator.speedMult *= 1.08;
        }
    }

    const pool = tdWavePool();
    const avgHp = pool.length > 0
        ? pool.reduce((sum, key) => sum + tdEnemyBaseStats(key).hp, 0) / pool.length
        : tdEnemyBaseStats('scout').hp;
    const bossBudget = td.currentBossMode ? tdEnemyBaseStats('boss').hp * td.currentBossMode.bossCount : 0;
    const hpBudget = avgHp * td.enemiesToSpawn + bossBudget;
    const estDuration = Math.max(10, td.enemiesToSpawn * td.spawnDelay * 1.05 + 4);
    td.dpsTarget = hpBudget / estDuration;
    td.damageThisSecond = 0;
    td.damageSecondClock = 0;
    td.dpsNow = 0;
    td.dpsPressureTimer = 0;
    td.dpsPressure = 0;

    if (el.tdFeedback) {
        const bossLabel = td.currentBossMode ? ` Bosses: ${td.currentBossMode.bossCount}.` : '';
        const upkeepMsg = upkeep > 0 ? ` Upkeep: -${upkeep} energy.` : '';
        el.tdFeedback.textContent = `Wave ${td.wave} started on ${td.mapName}. ${td.currentMutator.label} active. Incoming monsters: ${td.enemiesToSpawn}.${bossLabel}${upkeepMsg}`;
    }
}

function tdPickEnemyType() {
    const cfg = tdDifficultyConfig();
    const pool = tdWavePool();
    const roll = Math.random();

    const bossChance = cfg.label === 'Insane' ? 0.964 : cfg.label === 'Very Hard' ? 0.974 : cfg.label === 'Hard' ? 0.982 : 0.989;
    if (pool.includes('boss') && roll > bossChance) return 'boss';
    if (pool.includes('bulwark') && roll > 0.88) return 'bulwark';
    if (pool.includes('flyer') && roll > 0.76) return 'flyer';
    if (pool.includes('shield') && roll > 0.84) return 'shield';
    if (pool.includes('splitter') && roll > 0.7) return 'splitter';
    if (pool.includes('brute') && roll > 0.45) return 'brute';
    if (pool.includes('runner') && roll > 0.24) return 'runner';
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
    let canHitAir = Boolean(base.canHitAir);
    let burnDps = base.burnDps || 0;
    let burnTime = base.burnTime || 0;
    let armorShred = base.armorShred || 0;
    let armorShredTime = base.armorShredTime || 0;
    let stunChance = base.stunChance || 0;
    let stunTime = base.stunTime || 0;
    let antiAirBonus = base.antiAirBonus || 0;
    let ventureEnergy = base.ventureEnergy || 0;
    let ventureGems = base.ventureGems || 0;
    let ventureTokenChance = base.ventureTokenChance || 0;
    let auraRadius = base.auraRadius || 0;
    let auraDamage = base.auraDamage || 0;
    let auraRate = base.auraRate || 0;

    for (let i = 0; i < tower.pathA; i += 1) {
        damage *= 1.35;
        range += 7;
        if (tower.type === 'cannon') splash += 6;
        if (tower.type === 'frost') slowTime += 0.2;
        if (tower.type === 'tesla') chain += 1;
        if (tower.type === 'missile') splash += 10;
        if (tower.type === 'laser') {
            burnDps += 1.8;
            burnTime += 0.55;
        }
        if (tower.type === 'tesla') {
            armorShred += 0.05;
            armorShredTime += 0.35;
        }
        if (tower.type === 'relay') {
            auraRadius += 10;
            auraDamage += 0.05;
        }
    }

    for (let i = 0; i < tower.pathB; i += 1) {
        fireRate *= 0.82;
        if (tower.type === 'laser') range += 10;
        if (tower.type === 'cannon') {
            fireRate *= 0.88;
            splash += 8;
            stunChance = Math.min(0.52, stunChance + 0.11);
            stunTime += 0.22;
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
            antiAirBonus += 0.08;
        }
        if (tower.type === 'relay') {
            auraRate += 0.05;
        }
    }

    const relayBuff = tdRelayBoost(tower);
    const controlLv = tdMetaLevel('control');
    const burstLv = tdMetaLevel('burst');
    const economyLv = tdMetaLevel('economy');

    if (controlLv > 0) {
        if (tower.type === 'frost') {
            slowAmount = Math.min(0.82, slowAmount + controlLv * 0.04);
            slowTime += controlLv * 0.22;
        }
        if (tower.type === 'laser') {
            burnDps += controlLv * 0.9;
            burnTime += controlLv * 0.28;
        }
    }

    if (burstLv > 0) {
        if (tower.type === 'cannon') damage *= 1 + burstLv * 0.08;
        if (tower.type === 'tesla') armorShred = Math.min(0.6, armorShred + burstLv * 0.04);
        if (tower.type === 'missile') antiAirBonus += burstLv * 0.12;
    }

    if (economyLv > 0 && tower.type === 'investment') {
        ventureEnergy += economyLv * 0.9;
        ventureGems += 24 * economyLv;
        ventureTokenChance += 0.016 * economyLv;
        fireRate = Math.max(1.45, fireRate - economyLv * 0.2);
    }

    if (tower.type === 'laser' && tower.pathA >= 3) {
        chain += 1;
        burnDps += 1.8;
    }
    if (tower.type === 'cannon' && tower.pathB >= 3) {
        stunChance = Math.min(0.74, stunChance + 0.2);
        stunTime += 0.35;
        splash += 12;
    }
    if (tower.type === 'frost' && tower.pathA >= 3) {
        stunChance = Math.min(0.5, stunChance + 0.16);
        stunTime += 0.45;
    }
    if (tower.type === 'missile' && tower.pathA >= 3) {
        splash += 20;
        chain += 1;
    }

    damage *= 1 + relayBuff.damage;
    fireRate *= 1 - relayBuff.rate;
    fireRate = Math.max(0.14, fireRate);

    return {
        damage,
        fireRate,
        range,
        splash,
        slowAmount,
        slowTime,
        chain,
        canHitAir,
        burnDps,
        burnTime,
        armorShred,
        armorShredTime,
        stunChance,
        stunTime,
        antiAirBonus,
        ventureEnergy,
        ventureGems,
        ventureTokenChance,
        auraRadius,
        auraDamage,
        auraRate
    };
}

function tdUpgradeCost(tower, path) {
    const base = 12 + td.wave;
    if (path === 'A') return Math.round(base + tower.pathA * 7 + tower.pathB * 3);
    return Math.round(base + tower.pathB * 7 + tower.pathA * 3);
}

function tdEnemyProgress(enemy) {
    const route = enemy.route || td.routes[0] || [];
    if (!route.length) return 0;
    const idx = Math.max(0, Math.min(route.length - 1, enemy.pathIndex || 0));
    const target = route[idx] || route[route.length - 1];
    const toNext = Math.hypot(target.x - enemy.x, target.y - enemy.y);
    return idx + Math.max(0, 1 - toNext / td.cell);
}

function tdRegisterDamage(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    td.damageThisSecond += amount;
}

function tdCycleTargetMode() {
    const tower = td.towers.find((t) => t.id === td.selectedTowerId);
    if (!tower) {
        if (el.tdFeedback) el.tdFeedback.textContent = 'Select a tower first.';
        return;
    }

    const current = TD_TARGET_MODES.includes(tower.targetMode) ? tower.targetMode : 'first';
    const idx = TD_TARGET_MODES.indexOf(current);
    tower.targetMode = TD_TARGET_MODES[(idx + 1) % TD_TARGET_MODES.length];
    renderSelectedTower();
    if (el.tdFeedback) el.tdFeedback.textContent = `${TOWER_TYPES[tower.type].name} targeting set to ${tower.targetMode}.`;
}

function tdFindTarget(tower, stats) {
    if (tower.type === 'investment') return null;

    let best = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    const mode = TD_TARGET_MODES.includes(tower.targetMode) ? tower.targetMode : 'first';

    td.enemies.forEach((enemy) => {
        if (enemy.airborne && !stats.canHitAir) return;

        const dx = enemy.x - tower.x;
        const dy = enemy.y - tower.y;
        const dist = Math.hypot(dx, dy);
        if (dist > stats.range) return;

        const armor = Math.max(0, (ENEMY_TYPES[enemy.type].armor || 0) - (enemy.armorShred || 0));
        const progress = tdEnemyProgress(enemy);
        let score = 0;

        if (mode === 'strong') {
            score = enemy.hp;
        } else if (mode === 'armor') {
            score = armor * 500 + enemy.hp * 0.1;
        } else if (mode === 'last') {
            score = -progress * 100 - enemy.hp * 0.02;
        } else {
            score = progress * 100 + enemy.hp * 0.02;
        }

        if (tower.type === 'missile' && enemy.airborne) score += 18;
        if (tower.type === 'tesla' && armor > 0.2) score += 14;
        if (tower.type === 'cannon' && (enemy.armorShred || 0) > 0) score += 10;
        score -= dist * 0.01;

        if (score > bestScore) {
            bestScore = score;
            best = enemy;
        }
    });

    return best;
}

function tdShotHit(shot) {
    const primary = td.enemies.find((e) => e.id === shot.targetId);
    if (!primary) return false;

    if (Math.hypot(primary.x - shot.x, primary.y - shot.y) > primary.radius + 4) return false;

    const armorBase = ENEMY_TYPES[primary.type].armor || 0;
    const effectiveArmor = Math.max(0, armorBase - (primary.armorShred || 0));
    let dealt = shot.damage * (1 - effectiveArmor);

    if (shot.towerType === 'laser' && primary.slowTimer > 0) dealt *= 1.35;
    if (shot.towerType === 'missile' && (primary.armorShred || 0) > 0) dealt *= 1.3;
    if (primary.airborne) dealt *= 1 + (shot.antiAirBonus || 0);

    primary.hp -= dealt;
    tdRegisterDamage(dealt);
    tdEmitImpact(primary.x, primary.y, shot.color, shot.chain > 0 ? 8 : 5);

    if (shot.slowAmount > 0) {
        primary.slowFactor = Math.min(primary.slowFactor, 1 - shot.slowAmount);
        primary.slowTimer = Math.max(primary.slowTimer, shot.slowTime);

        if ((primary.dotTimer || 0) > 0) {
            primary.stunTimer = Math.max(primary.stunTimer || 0, 0.28);
        }
    }

    if (shot.burnDps > 0) {
        primary.dotDps = Math.max(primary.dotDps || 0, shot.burnDps);
        primary.dotTimer = Math.max(primary.dotTimer || 0, shot.burnTime || 0);
    }

    if (shot.armorShred > 0) {
        primary.armorShred = Math.min(0.7, (primary.armorShred || 0) + shot.armorShred);
        primary.armorShredTimer = Math.max(primary.armorShredTimer || 0, shot.armorShredTime || 0);
    }

    if (shot.stunChance > 0 && Math.random() < shot.stunChance) {
        primary.stunTimer = Math.max(primary.stunTimer || 0, shot.stunTime || 0);
    }

    if (shot.splash > 0) {
        td.enemies.forEach((enemy) => {
            if (enemy.id === primary.id) return;
            const d = Math.hypot(enemy.x - primary.x, enemy.y - primary.y);
            if (d <= shot.splash) {
                const enemyArmor = Math.max(0, (ENEMY_TYPES[enemy.type].armor || 0) - (enemy.armorShred || 0));
                let splashDamage = shot.damage * 0.55 * (1 - enemyArmor);
                if (shot.towerType === 'cannon' && (enemy.armorShred || 0) > 0) splashDamage *= 1.25;
                enemy.hp -= splashDamage;
                tdRegisterDamage(splashDamage);
            }
        });
    }

    if (shot.chain > 0) {
        const nearby = td.enemies
            .filter((enemy) => enemy.id !== primary.id)
            .sort((a, b) => Math.hypot(a.x - primary.x, a.y - primary.y) - Math.hypot(b.x - primary.x, b.y - primary.y))
            .slice(0, shot.chain);

        nearby.forEach((enemy, idx) => {
            const enemyArmor = Math.max(0, (ENEMY_TYPES[enemy.type].armor || 0) - (enemy.armorShred || 0));
            const chainFalloff = 1 - Math.min(0.6, idx * 0.22);
            const chainDamage = shot.damage * 0.62 * chainFalloff * (1 - enemyArmor);
            enemy.hp -= chainDamage;
            tdRegisterDamage(chainDamage);
            if (shot.armorShred > 0) {
                enemy.armorShred = Math.min(0.6, (enemy.armorShred || 0) + shot.armorShred * 0.55);
                enemy.armorShredTimer = Math.max(enemy.armorShredTimer || 0, (shot.armorShredTime || 0) * 0.8);
            }
        });
    }

    return true;
}

function tdEmitImpact(x, y, color, count = 6) {
    for (let i = 0; i < count; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 34 + Math.random() * 130;
        td.particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 1.4 + Math.random() * 2.3,
            life: 0.22 + Math.random() * 0.25,
            maxLife: 0.45,
            color
        });
    }

    td.shockwaves.push({
        x,
        y,
        radius: 4,
        growth: 95,
        life: 0.18,
        maxLife: 0.18,
        color
    });
}

function tdHandleEnemyDeath(enemy) {
    const cfg = tdDifficultyConfig();
    const type = ENEMY_TYPES[enemy.type];
    td.kills += 1;
    if (td.kills % TD_KILLS_PER_TOKEN === 0) {
        td.tokens += 1;
        if (el.tdFeedback) {
            el.tdFeedback.textContent = `Kill milestone reached: +1 token (${TD_KILLS_PER_TOKEN} kills).`;
        }
    }

    const energyGain = type.reward * (1 + state.tdEnergyBonus) * cfg.energyGainMult * td.currentMutator.energyMult;
    td.energy += energyGain;
    if (enemy.killSource === 'trap') {
        td.objectiveState.trapKills += 1;
    }
    tdEmitImpact(enemy.x, enemy.y, '#ffeeb3', enemy.type === 'boss' ? 16 : 9);
    if (enemy.type === 'boss') tdTriggerShake(7, 0.22);
    tdSfx('kill');

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
                airborne: false,
                slowFactor: 1,
                slowTimer: 0,
                dotDps: 0,
                dotTimer: 0,
                armorShred: 0,
                armorShredTimer: 0,
                stunTimer: 0,
                radius: 5
            });
        }
    }
}

function tdMoveEnemy(enemy, delta) {
    const route = enemy.route || td.routes[0] || [];
    if (enemy.pathIndex >= route.length) return;

    if ((enemy.stunTimer || 0) > 0) {
        enemy.stunTimer -= delta;
        return;
    }

    const target = route[enemy.pathIndex];
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;

    const pressureMult = 1 + td.dpsPressure * 0.32;
    const speed = enemy.speed * enemy.slowFactor * pressureMult;
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

    if ((enemy.airborne || false) && enemy.pathIndex < route.length) {
        enemy.y += Math.sin(td.frameClock * 6 + enemy.id * 0.35) * 0.55;
    }
}

function tdUpdate(delta) {
    if (!td.running) return;
    const cfg = tdDifficultyConfig();
    const simDelta = delta * td.speedMult;
    td.frameClock += simDelta;
    td.damageSecondClock += simDelta;
    if (td.shakeTime > 0) {
        td.shakeTime = Math.max(0, td.shakeTime - simDelta);
    }

    if (td.damageSecondClock >= 1) {
        td.dpsNow = td.damageThisSecond / td.damageSecondClock;
        td.damageThisSecond = 0;
        td.damageSecondClock = 0;
    }

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
            const waveReward = Math.round((125 + td.wave * 30 + totalBuildings() * 1.6) * (0.88 + cfg.spawnCountMult * 0.25) * td.currentMutator.rewardMult);
            addGems(waveReward);
            td.tokens += TD_WAVE_TOKEN_REWARD;
            if (td.currentBossMode) {
                const tokenGain = Math.max(1, Math.floor(td.currentBossMode.bossCount * 0.8));
                td.tokens += tokenGain;
                if (el.tdFeedback) el.tdFeedback.textContent = `Boss wave ${td.wave} cleared. +${TD_WAVE_TOKEN_REWARD + tokenGain} token(s), +${fmt(waveReward)} gems.`;
            }
            if (td.wave >= td.victoryWave) {
                tdWinRun();
                return;
            }
            if (!td.currentBossMode && el.tdFeedback) el.tdFeedback.textContent = `Wave ${td.wave} cleared. +${TD_WAVE_TOKEN_REWARD} token, +${fmt(waveReward)} gems.`;
        }

        if (td.dpsTarget > 0) {
            const ratio = td.dpsNow / td.dpsTarget;
            if (ratio < 0.85) {
                td.dpsPressureTimer += simDelta;
            } else {
                td.dpsPressureTimer = Math.max(0, td.dpsPressureTimer - simDelta * 1.6);
            }
            td.dpsPressure = Math.max(0, Math.min(1, (td.dpsPressureTimer - 2) / 6));
        } else {
            td.dpsPressure = 0;
            td.dpsPressureTimer = 0;
        }
    }

    td.towers.forEach((tower) => {
        const stats = tdTowerStats(tower);
        tower.flash = Math.max(0, (tower.flash || 0) - simDelta * 5.2);
        tower.cooldown -= simDelta;
        if (tower.cooldown > 0) return;

        if (tower.type === 'investment') {
            tower.cooldown = stats.fireRate;
            tower.flash = 0.6;
            td.energy += stats.ventureEnergy;
            addGems(stats.ventureGems);
            if (Math.random() < stats.ventureTokenChance) {
                td.tokens += 1;
                if (el.tdFeedback) el.tdFeedback.textContent = 'Venture Tower payout: +1 token.';
            }
            tdEmitImpact(tower.x, tower.y, '#ffe28e', 5);
            return;
        }

        const target = tdFindTarget(tower, stats);
        if (!target) return;

        tower.cooldown = stats.fireRate;
        tower.flash = 1;
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
            burnDps: stats.burnDps,
            burnTime: stats.burnTime,
            armorShred: stats.armorShred,
            armorShredTime: stats.armorShredTime,
            stunChance: stats.stunChance,
            stunTime: stats.stunTime,
            antiAirBonus: stats.antiAirBonus,
            towerType: tower.type,
            color: TOWER_TYPES[tower.type].color
        });

        if (Date.now() - td.lastShotSound > 45) {
            tdSfx('shot');
            td.lastShotSound = Date.now();
        }
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

        if (Math.random() > 0.45) {
            td.particles.push({
                x: shot.x,
                y: shot.y,
                vx: (Math.random() - 0.5) * 16,
                vy: (Math.random() - 0.5) * 16,
                size: 1.1,
                life: 0.08,
                maxLife: 0.1,
                color: shot.color
            });
        }

        if (tdShotHit(shot)) {
            shot.dead = true;
        }
    });

    for (let i = td.traps.length - 1; i >= 0; i -= 1) {
        const trap = td.traps[i];
        trap.life -= simDelta;
        let triggered = false;

        td.enemies.forEach((enemy) => {
            if (triggered) return;
            const d = Math.hypot(enemy.x - trap.x, enemy.y - trap.y);
            if (d <= trap.radius) {
                enemy.hp -= trap.damage;
                tdRegisterDamage(trap.damage);
                enemy.killSource = 'trap';
                triggered = true;
            }
        });

        if (triggered) {
            tdEmitImpact(trap.x, trap.y, '#ffe6a3', 14);
            tdTriggerShake(4, 0.12);
            td.traps.splice(i, 1);
            continue;
        }

        if (trap.life <= 0) {
            td.traps.splice(i, 1);
        }
    }

    td.enemies.forEach((enemy) => {
        if ((enemy.dotTimer || 0) > 0) {
            enemy.dotTimer -= simDelta;
            const dotTick = (enemy.dotDps || 0) * simDelta;
            enemy.hp -= dotTick;
            tdRegisterDamage(dotTick);
            if (enemy.dotTimer <= 0) {
                enemy.dotDps = 0;
            }
        }

        if ((enemy.armorShredTimer || 0) > 0) {
            enemy.armorShredTimer -= simDelta;
            if (enemy.armorShredTimer <= 0) {
                enemy.armorShred = 0;
            }
        }

        tdMoveEnemy(enemy, simDelta);
    });

    for (let i = td.enemies.length - 1; i >= 0; i -= 1) {
        const enemy = td.enemies[i];

        if (enemy.hp <= 0) {
            tdHandleEnemyDeath(enemy);
            td.enemies.splice(i, 1);
            continue;
        }

        const route = enemy.route || td.routes[0] || [];
        if (enemy.pathIndex >= route.length) {
            const leakDamage = cfg.baseLeakDamage + (td.currentMutator.leakBonus || 0);
            td.baseHp -= leakDamage;
            tdEmitImpact(td.width - 14, enemy.y, '#ff8c8c', 10);
            td.enemies.splice(i, 1);
        }
    }

    for (let i = td.particles.length - 1; i >= 0; i -= 1) {
        const p = td.particles[i];
        p.life -= simDelta;
        p.x += p.vx * simDelta;
        p.y += p.vy * simDelta;
        p.vx *= 0.92;
        p.vy *= 0.92;
        if (p.life <= 0) td.particles.splice(i, 1);
    }

    for (let i = td.shockwaves.length - 1; i >= 0; i -= 1) {
        const ring = td.shockwaves[i];
        ring.life -= simDelta;
        ring.radius += ring.growth * simDelta;
        if (ring.life <= 0) td.shockwaves.splice(i, 1);
    }

    td.shots = td.shots.filter((s) => !s.dead);

    if (td.baseHp <= 0) {
        td.lives -= 1;
        if (td.lives > 0) {
            td.baseHp = td.maxHp;
            td.enemies = [];
            td.waveActive = false;
            td.enemiesToSpawn = 0;
            td.nextWaveClock = 1.2;
            if (el.tdFeedback) el.tdFeedback.textContent = `Core breached. Life lost (${td.lives} left).`;
            tdTriggerShake(9, 0.2);
        } else {
            tdFinishRun();
            return;
        }
    }

    renderTdStats();
    renderSelectedTower();
    tdDraw();
}

function tdDraw() {
    if (!el.tdCanvas) return;
    const ctx = el.tdCanvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    if (td.shakeTime > 0) {
        const mag = td.shakePower * (td.shakeTime / Math.max(0.001, td.shakeTime + 0.12));
        const ox = (Math.random() - 0.5) * mag;
        const oy = (Math.random() - 0.5) * mag;
        ctx.translate(ox, oy);
    }

    ctx.clearRect(0, 0, td.width, td.height);

    const scanX = (td.frameClock * 75) % (td.width + 80) - 40;
    const bg = ctx.createLinearGradient(0, 0, td.width, td.height);
    bg.addColorStop(0, '#0b1a33');
    bg.addColorStop(0.55, '#12284a');
    bg.addColorStop(1, '#0b1a33');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, td.width, td.height);

    ctx.fillStyle = 'rgba(132, 208, 255, 0.08)';
    ctx.fillRect(scanX, 0, 38, td.height);

    if (Number.isFinite(td.cursorX) && Number.isFinite(td.cursorY)) {
        const spotlight = ctx.createRadialGradient(td.cursorX, td.cursorY, 12, td.cursorX, td.cursorY, 95);
        spotlight.addColorStop(0, 'rgba(149, 255, 216, 0.14)');
        spotlight.addColorStop(1, 'rgba(149, 255, 216, 0)');
        ctx.fillStyle = spotlight;
        ctx.fillRect(0, 0, td.width, td.height);
    }

    for (let r = 0; r < td.rows; r += 1) {
        const y = r * td.cell;
        for (let c = 0; c < td.cols; c += 1) {
            if (tdIsOnPath(r, c)) {
                ctx.fillStyle = 'rgba(255, 153, 119, 0.12)';
                ctx.fillRect(c * td.cell, y, td.cell, td.cell);
            }
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

    td.routes.forEach((route, idx) => {
        if (!route || route.length <= 1) return;
        ctx.strokeStyle = idx === 0 ? 'rgba(255, 200, 140, 0.4)' : 'rgba(255, 165, 125, 0.28)';
        ctx.lineWidth = idx === 0 ? 5 : 4;
        ctx.beginPath();
        ctx.moveTo(route[0].x, route[0].y);
        for (let i = 1; i < route.length; i += 1) {
            ctx.lineTo(route[i].x, route[i].y);
        }
        ctx.stroke();

        if (idx === 0) {
            const pulseIdx = Math.floor((td.frameClock * 3.1) % (route.length - 1)) + 1;
            const p = route[pulseIdx];
            ctx.fillStyle = 'rgba(255, 216, 162, 0.7)';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    ctx.lineWidth = 1;

    td.towers.forEach((tower) => {
        const color = TOWER_TYPES[tower.type].color;
        const selected = tower.id === td.selectedTowerId;
        const hovered = td.hoverCell && tower.col === td.hoverCell.col && tower.row === td.hoverCell.row;
        const bob = Math.sin(td.frameClock * 4 + tower.id * 0.37) * 1.1;
        const spin = td.frameClock * 2.2 + tower.id * 0.3;
        const recoil = Math.min(1, tower.flash || 0) * 2.4;
        const nearest = td.enemies.reduce((best, enemy) => {
            const d = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
            if (!best || d < best.dist) return { enemy, dist: d };
            return best;
        }, null);
        const aimAngle = nearest ? Math.atan2(nearest.enemy.y - tower.y, nearest.enemy.x - tower.x) : -Math.PI / 2;

        // Platform and energy ring
        ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
        ctx.beginPath();
        ctx.ellipse(tower.x, tower.y + 11.5, 10.2, 3.8, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(8, 16, 28, 0.84)';
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = hovered ? 'rgba(153, 244, 255, 0.7)' : 'rgba(153, 224, 255, 0.28)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, 11.5, 0, Math.PI * 2);
        ctx.stroke();

        const coreGlow = ctx.createRadialGradient(tower.x, tower.y, 2, tower.x, tower.y, 15);
        coreGlow.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
        coreGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = coreGlow;
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, 15, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(tower.x, tower.y + bob * 0.25, 7.8, 0, Math.PI * 2);
        ctx.fill();

        const metallic = ctx.createLinearGradient(tower.x - 8, tower.y - 8, tower.x + 8, tower.y + 8);
        metallic.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        metallic.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = metallic;
        ctx.beginPath();
        ctx.arc(tower.x - 1.2, tower.y - 1.2 + bob * 0.15, 5.5, 0, Math.PI * 2);
        ctx.fill();

        if (tower.type === 'laser') {
            const pulse = 1 + Math.sin(td.frameClock * 12 + tower.id) * 0.12;
            ctx.save();
            ctx.translate(tower.x, tower.y + bob * 0.4);
            ctx.rotate(aimAngle);
            ctx.fillStyle = '#d8fcff';
            ctx.fillRect(-2.2 * pulse, -3.5, 9.8 - recoil, 7);
            ctx.fillStyle = 'rgba(188, 251, 255, 0.7)';
            ctx.fillRect(5.2 - recoil, -1.25, 4.8, 2.5);
            ctx.restore();
        } else if (tower.type === 'cannon') {
            ctx.save();
            ctx.translate(tower.x, tower.y + bob * 0.35);
            ctx.rotate(aimAngle);
            ctx.fillStyle = '#ffe4b0';
            ctx.fillRect(-4.8, -4, 11 - recoil, 8);
            ctx.fillStyle = '#ffd08c';
            ctx.fillRect(5.5 - recoil, -2.2, 5.2, 4.4);
            ctx.restore();
            ctx.fillStyle = 'rgba(255, 228, 176, 0.55)';
            ctx.beginPath();
            ctx.arc(tower.x, tower.y + bob * 0.2, 3.2, 0, Math.PI * 2);
            ctx.fill();
        } else if (tower.type === 'tesla') {
            ctx.fillStyle = '#f1e7ff';
            ctx.beginPath();
            ctx.moveTo(tower.x, tower.y - 15 + bob);
            ctx.lineTo(tower.x + 4, tower.y - 7 + bob);
            ctx.lineTo(tower.x - 1, tower.y - 7 + bob);
            ctx.lineTo(tower.x + 2, tower.y + 1 + bob);
            ctx.lineTo(tower.x - 6, tower.y - 7 + bob);
            ctx.lineTo(tower.x - 2, tower.y - 7 + bob);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(221, 198, 255, 0.8)';
            ctx.beginPath();
            ctx.arc(tower.x, tower.y + bob * 0.4, 10 + Math.sin(td.frameClock * 8 + tower.id) * 1.5, 0, Math.PI * 2);
            ctx.stroke();
        } else if (tower.type === 'missile') {
            ctx.save();
            ctx.translate(tower.x, tower.y + bob * 0.45);
            ctx.rotate(aimAngle);
            ctx.fillStyle = '#ffe2dc';
            ctx.fillRect(-4, -2.8, 10.8 - recoil, 5.6);
            ctx.fillStyle = '#ff9c90';
            ctx.beginPath();
            ctx.moveTo(7.8 - recoil, 0);
            ctx.lineTo(2.4, 3.2);
            ctx.lineTo(2.4, -3.2);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            ctx.fillStyle = 'rgba(255, 208, 170, 0.7)';
            ctx.beginPath();
            ctx.arc(tower.x - Math.cos(aimAngle) * 2.8, tower.y - Math.sin(aimAngle) * 2.8 + bob * 0.45, 1.7, 0, Math.PI * 2);
            ctx.fill();
        } else if (tower.type === 'relay') {
            ctx.fillStyle = '#d6ffbe';
            ctx.beginPath();
            ctx.moveTo(tower.x, tower.y - 13 + bob);
            ctx.lineTo(tower.x + 8, tower.y + bob);
            ctx.lineTo(tower.x, tower.y + 13 + bob);
            ctx.lineTo(tower.x - 8, tower.y + bob);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(214, 255, 190, 0.7)';
            ctx.beginPath();
            ctx.moveTo(tower.x + Math.cos(spin) * 4, tower.y + Math.sin(spin) * 4);
            ctx.lineTo(tower.x + Math.cos(spin + 2.09) * 8, tower.y + Math.sin(spin + 2.09) * 8);
            ctx.lineTo(tower.x + Math.cos(spin + 4.18) * 8, tower.y + Math.sin(spin + 4.18) * 8);
            ctx.closePath();
            ctx.stroke();
            for (let orb = 0; orb < 3; orb += 1) {
                const t = spin + orb * (Math.PI * 2 / 3);
                const ox = tower.x + Math.cos(t) * 11.5;
                const oy = tower.y + Math.sin(t) * 11.5;
                ctx.fillStyle = 'rgba(214, 255, 190, 0.7)';
                ctx.beginPath();
                ctx.arc(ox, oy, 1.8, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (tower.type === 'investment') {
            ctx.fillStyle = '#fff0be';
            ctx.beginPath();
            ctx.arc(tower.x, tower.y - 3 + bob, 5.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 226, 142, 0.9)';
            ctx.strokeRect(tower.x - 7, tower.y - 7 + bob, 14, 14);
            ctx.fillStyle = 'rgba(255, 226, 142, 0.7)';
            ctx.fillRect(tower.x - 0.8, tower.y - 11 + bob, 1.6, 8);
            const blink = 0.4 + 0.6 * Math.max(0, Math.sin(td.frameClock * 6 + tower.id));
            ctx.fillStyle = `rgba(255, 232, 150, ${0.35 * blink})`;
            ctx.beginPath();
            ctx.arc(tower.x, tower.y + bob * 0.2, 9.8, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = '#d8e9ff';
            ctx.beginPath();
            ctx.arc(tower.x, tower.y - 5 + bob, 5, 0, Math.PI * 2);
            ctx.fill();
        }

        if (selected) {
            ctx.strokeStyle = '#ffffff';
            ctx.strokeRect(tower.x - 12, tower.y - 12, 24, 24);
        }

        if ((tower.flash || 0) > 0.01) {
            const alpha = Math.min(0.72, tower.flash * 0.62);
            const flare = ctx.createRadialGradient(tower.x, tower.y, 3, tower.x, tower.y, 24);
            flare.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
            flare.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = flare;
            ctx.beginPath();
            ctx.arc(tower.x, tower.y, 24, 0, Math.PI * 2);
            ctx.fill();
        }

        if (td.showRanges && (selected || hovered)) {
            const stats = tdTowerStats(tower);
            if (stats.range > 0) {
                ctx.strokeStyle = selected ? 'rgba(156, 248, 255, 0.7)' : 'rgba(156, 248, 255, 0.38)';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.arc(tower.x, tower.y, stats.range, 0, Math.PI * 2);
                ctx.stroke();
                ctx.lineWidth = 1;
            }
        }
    });

    td.traps.forEach((trap) => {
        ctx.fillStyle = 'rgba(255, 230, 143, 0.85)';
        ctx.beginPath();
        ctx.arc(trap.x, trap.y, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 230, 143, 0.26)';
        ctx.beginPath();
        ctx.arc(trap.x, trap.y, trap.radius, 0, Math.PI * 2);
        ctx.stroke();
    });

    if (td.showRanges && td.hoverCell) {
        const tType = TOWER_TYPES[td.selectedTowerType];
        const ghostX = td.hoverCell.col * td.cell + td.cell / 2;
        const ghostY = td.hoverCell.row * td.cell + td.cell / 2;
        ctx.fillStyle = 'rgba(154, 238, 255, 0.09)';
        ctx.fillRect(td.hoverCell.col * td.cell + 1, td.hoverCell.row * td.cell + 1, td.cell - 2, td.cell - 2);
        ctx.strokeStyle = 'rgba(154, 238, 255, 0.34)';
        ctx.strokeRect(td.hoverCell.col * td.cell + 1.5, td.hoverCell.row * td.cell + 1.5, td.cell - 3, td.cell - 3);
        if (tType && tType.range > 0 && !tdTowerAtCell(td.hoverCell.col, td.hoverCell.row)) {
            ctx.strokeStyle = tdIsOnPath(td.hoverCell.row, td.hoverCell.col)
                ? 'rgba(255, 140, 140, 0.55)'
                : 'rgba(120, 255, 210, 0.42)';
            ctx.beginPath();
            ctx.arc(ghostX, ghostY, tType.range, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    td.enemies.forEach((enemy) => {
        const eType = ENEMY_TYPES[enemy.type] || ENEMY_TYPES.scout;

        ctx.fillStyle = eType.color;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        ctx.fill();

        if (enemy.airborne) {
            ctx.strokeStyle = 'rgba(143, 211, 255, 0.72)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.radius + 3, 0, Math.PI * 2);
            ctx.stroke();
        }

        if ((enemy.dotTimer || 0) > 0) {
            ctx.strokeStyle = 'rgba(255, 148, 102, 0.85)';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.radius + 1, 0, Math.PI * 2);
            ctx.stroke();
        }

        const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
        ctx.fillStyle = '#210d16';
        ctx.fillRect(enemy.x - 12, enemy.y - enemy.radius - 7, 24, 4);
        ctx.fillStyle = '#8fff9c';
        ctx.fillRect(enemy.x - 12, enemy.y - enemy.radius - 7, 24 * hpRatio, 4);
    });

    td.shockwaves.forEach((ring) => {
        const alpha = Math.max(0, ring.life / ring.maxLife);
        ctx.strokeStyle = `rgba(255, 236, 176, ${alpha * 0.65})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
        ctx.stroke();
    });

    td.particles.forEach((p) => {
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    });

    td.shots.forEach((shot) => {
        const trailLen = 5 + Math.sin(td.frameClock * 10 + shot.x * 0.05) * 2.5;
        ctx.fillStyle = shot.color;
        ctx.beginPath();
        ctx.arc(shot.x, shot.y, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        ctx.moveTo(shot.x, shot.y);
        ctx.lineTo(shot.x - trailLen, shot.y - 2.2);
        ctx.stroke();
    });

    ctx.restore();
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

function tdObjectiveCompletionCount() {
    if (!td.objectives || td.objectives.length <= 0) return 0;
    return td.objectives.reduce((sum, obj) => sum + (tdObjectiveDone(obj.id) ? 1 : 0), 0);
}

function tdFinishRun() {
    const cfg = tdDifficultyConfig();
    const mode = tdModeConfig();
    state.tdBestKills = Math.max(state.tdBestKills, td.kills);
    state.tdBestWave = Math.max(state.tdBestWave, td.wave);
    if (mode.endless) state.tdBestEndlessWave = Math.max(state.tdBestEndlessWave, td.wave);

    const objectiveDone = tdObjectiveCompletionCount();
    const objectiveGemBonus = objectiveDone * 900;
    const objectiveMetaBonus = objectiveDone;

    const reward = Math.round((td.kills * 16 + td.wave * 72 + totalBuildings() * 2.1) * (0.84 + cfg.spawnCountMult * 0.25));
    const metaGain = Math.max(1, Math.floor(td.wave / 10) + Math.floor(td.kills / 160)) + objectiveMetaBonus;
    addGems(reward + objectiveGemBonus);
    state.tdMetaPoints += metaGain;

    tdStopRun(`Defense failed at wave ${td.wave}. Reward: +${fmt(reward + objectiveGemBonus)} gems, +${metaGain} meta point(s). Objectives: ${objectiveDone}/${td.objectives.length}.`);
    renderAll();
    renderTdMeta();
    saveGame();
}

function tdWinRun() {
    const cfg = tdDifficultyConfig();
    const mode = tdModeConfig();
    state.tdBestKills = Math.max(state.tdBestKills, td.kills);
    state.tdBestWave = Math.max(state.tdBestWave, td.wave);
    if (mode.endless) state.tdBestEndlessWave = Math.max(state.tdBestEndlessWave, td.wave);
    state.tdWins += 1;

    const objectiveDone = tdObjectiveCompletionCount();
    const objectiveGemBonus = objectiveDone * 1400;
    const objectiveMetaBonus = objectiveDone;

    const reward = Math.round((2500 + td.kills * 22 + td.wave * 210 + totalBuildings() * 3.8) * (0.88 + cfg.spawnCountMult * 0.35));
    const metaGain = Math.max(2, 2 + Math.floor(td.wave / 8) + Math.floor(td.kills / 140)) + objectiveMetaBonus;
    addGems(reward + objectiveGemBonus);
    state.tdMetaPoints += metaGain;
    tdTriggerShake(11, 0.35);
    tdSfx('victory');

    tdStopRun(`Victory! You cleared wave ${td.wave}. Reward: +${fmt(reward + objectiveGemBonus)} gems, +${metaGain} meta point(s). Objectives: ${objectiveDone}/${td.objectives.length}.`);
    renderAll();
    renderTdMeta();
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
        const mode = tdModeConfig();
        const winText = mode.endless ? 'Push your highest endless wave.' : `Survive to wave ${td.victoryWave}.`;
        el.tdFeedback.textContent = `Defense started on ${cfg.label} (${mode.label}). ${winText}`;
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
    td.objectiveState.orbitalUsed = true;
    td.enemies.forEach((enemy) => {
        const strikeDamage = (38 + td.wave * 1.2) * prestigeTdMultiplier();
        enemy.hp -= strikeDamage;
        tdRegisterDamage(strikeDamage);
    });

    if (el.tdFeedback) {
        el.tdFeedback.textContent = 'Orbital strike deployed!';
    }

    renderTdStats();
    tdDraw();
}

function tdArmAbility(kind) {
    if (!td.running) {
        if (el.tdFeedback) el.tdFeedback.textContent = 'Start defense first.';
        return;
    }

    td.activeAbility = kind;
    renderTdStats();
}

function tdUseActiveAbility(col, row) {
    const mode = tdModeConfig();
    const x = col * td.cell + td.cell / 2;
    const y = row * td.cell + td.cell / 2;

    if (td.activeAbility === 'trap') {
        if (td.energy < mode.trapCost) {
            if (el.tdFeedback) el.tdFeedback.textContent = `Need ${mode.trapCost} energy for trap.`;
            td.activeAbility = null;
            renderTdStats();
            return;
        }
        if (tdTowerAtCell(col, row)) {
            if (el.tdFeedback) el.tdFeedback.textContent = 'Cannot place trap on tower cell.';
            td.activeAbility = null;
            renderTdStats();
            return;
        }

        td.energy -= mode.trapCost;
        td.traps.push({
            id: td.uidSeed++,
            col,
            row,
            x,
            y,
            radius: 24,
            damage: (120 + td.wave * 4) * prestigeTdMultiplier(),
            life: 32
        });
        if (el.tdFeedback) el.tdFeedback.textContent = 'Mine trap deployed.';
    } else if (td.activeAbility === 'dash') {
        if (td.energy < mode.dashCost) {
            if (el.tdFeedback) el.tdFeedback.textContent = `Need ${mode.dashCost} energy for dash.`;
            td.activeAbility = null;
            renderTdStats();
            return;
        }

        td.energy -= mode.dashCost;
        td.enemies.forEach((enemy) => {
            const d = Math.hypot(enemy.x - x, enemy.y - y);
            if (d <= 72) {
                const dashDamage = (75 + td.wave * 2.1) * prestigeTdMultiplier();
                enemy.hp -= dashDamage;
                tdRegisterDamage(dashDamage);
                enemy.stunTimer = Math.max(enemy.stunTimer || 0, 0.45);
            }
        });
        tdEmitImpact(x, y, '#9df2ff', 18);
        tdTriggerShake(5, 0.14);
        if (el.tdFeedback) el.tdFeedback.textContent = 'Pilot dash strike executed.';
    }

    td.activeAbility = null;
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
    const speedSteps = [1, 2, 3, 5, 10, 20, 50, 100];
    const idx = speedSteps.indexOf(td.speedMult);
    td.speedMult = speedSteps[(idx + 1) % speedSteps.length];

    renderTdStats();
    if (el.tdFeedback) el.tdFeedback.textContent = `Defense speed set to x${td.speedMult}.`;
}

function tdToggleRanges() {
    td.showRanges = !td.showRanges;
    renderTdStats();
    tdDraw();
}

function tdHandleCanvasMove(evt) {
    if (!el.tdCanvas) return;
    const rect = el.tdCanvas.getBoundingClientRect();
    const scaleX = td.width / rect.width;
    const scaleY = td.height / rect.height;
    const x = (evt.clientX - rect.left) * scaleX;
    const y = (evt.clientY - rect.top) * scaleY;
    td.cursorX = x;
    td.cursorY = y;
    const col = Math.floor(x / td.cell);
    const row = Math.floor(y / td.cell);

    if (col < 0 || col >= td.cols || row < 0 || row >= td.rows) {
        td.hoverCell = null;
    } else {
        td.hoverCell = { col, row };
    }

    tdDraw();
}

function tdHandleCanvasLeave() {
    td.hoverCell = null;
    td.cursorX = null;
    td.cursorY = null;
    tdDraw();
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

    if (td.activeAbility) {
        tdUseActiveAbility(col, row);
        return;
    }

    const existing = tdTowerAtCell(col, row);
    if (existing) {
        td.selectedTowerId = existing.id;
        renderSelectedTower();
        tdDraw();
        return;
    }

    if (tdIsOnPath(row, col) && td.modeKey !== 'maze') {
        if (el.tdFeedback) el.tdFeedback.textContent = 'Cannot place tower on active path tiles.';
        return;
    }

    const tType = TOWER_TYPES[td.selectedTowerType];
    if (!tType) return;

    const tokenCost = tdPlacementTokenCost(td.selectedTowerType);

    if (td.tokens < tokenCost) {
        if (el.tdFeedback) el.tdFeedback.textContent = `Need ${tokenCost} tokens for ${tType.name}.`;
        return;
    }

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
        flash: 0,
        spentEnergy: 0,
        targetMode: td.selectedTowerType === 'tesla'
            ? 'armor'
            : td.selectedTowerType === 'cannon'
                ? 'strong'
                : td.selectedTowerType === 'frost'
                    ? 'first'
                    : 'first'
    };

    if (td.modeKey === 'maze' && !tdRebuildMazeRoute({ col, row })) {
        if (el.tdFeedback) el.tdFeedback.textContent = 'Placement blocks all routes to exit.';
        return;
    }

    td.tokens -= tokenCost;

    td.towers.push(newTower);
    td.selectedTowerId = newTower.id;
    if (newTower.type === 'tesla') td.objectiveState.teslaPlaced = true;
    if (newTower.type === 'investment') td.objectiveState.venturePlaced += 1;

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

    if (td.modeKey === 'maze') {
        tdRebuildMazeRoute(null, tower.id);
    }

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
    if (el.tdRangeBtn) el.tdRangeBtn.addEventListener('click', tdToggleRanges);
    if (el.tdAbilityBtn) el.tdAbilityBtn.addEventListener('click', tdActivateOrbitalStrike);
    if (el.tdUpgradeA) el.tdUpgradeA.addEventListener('click', () => tdUpgradeTower('A'));
    if (el.tdUpgradeB) el.tdUpgradeB.addEventListener('click', () => tdUpgradeTower('B'));
    if (el.tdTargetBtn) el.tdTargetBtn.addEventListener('click', tdCycleTargetMode);
    if (el.tdSellTower) el.tdSellTower.addEventListener('click', tdSellSelectedTower);

    if (el.tdTowerTypes) {
        el.tdTowerTypes.addEventListener('click', (event) => {
            const button = event.target.closest('[data-td-type]');
            if (!button) return;
            tdSelectTowerType(button.dataset.tdType);
        });
    }

    if (el.tdMetaModes) {
        el.tdMetaModes.addEventListener('click', (event) => {
            const button = event.target.closest('[data-td-tech]');
            if (!button) return;
            tdUnlockMeta(button.dataset.tdTech);
        });
    }

    if (el.tdDifficultyModes) {
        el.tdDifficultyModes.addEventListener('click', (event) => {
            const button = event.target.closest('[data-td-difficulty]');
            if (!button) return;
            tdSetDifficulty(button.dataset.tdDifficulty);
        });
    }

    if (el.tdModeRow) {
        el.tdModeRow.addEventListener('click', (event) => {
            const button = event.target.closest('[data-td-mode]');
            if (!button) return;
            tdSetMode(button.dataset.tdMode);
        });
    }

    if (el.tdTrapBtn) el.tdTrapBtn.addEventListener('click', () => tdArmAbility('trap'));
    if (el.tdDashBtn) el.tdDashBtn.addEventListener('click', () => tdArmAbility('dash'));
    if (el.tdPermadeathBtn) el.tdPermadeathBtn.addEventListener('click', tdTogglePermadeath);

    if (el.tdCanvas) {
        el.tdCanvas.addEventListener('click', tdPlaceOrSelect);
        el.tdCanvas.addEventListener('mousemove', tdHandleCanvasMove);
        el.tdCanvas.addEventListener('mouseleave', tdHandleCanvasLeave);
    }

    if (el.tdEnemyLegend) {
        const showTip = (event) => {
            const btn = event.target.closest('[data-td-enemy]');
            if (!btn) return;
            safeSet(el.tdEnemyTooltip, tdEnemyVulnerabilityText(btn.dataset.tdEnemy));
        };
        el.tdEnemyLegend.addEventListener('mouseover', showTip);
        el.tdEnemyLegend.addEventListener('click', showTip);
    }

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
    if (IS_TD_STANDALONE) {
        loadGame();
        bindEvents();
        tdApplyDifficultyButtons();
        tdApplyModeButtons();
        tdResetState();
        tdDraw();
        renderTdStats();
        renderTdMeta();
        renderSelectedTower();A
        return;
    }

    loadGame();
    loadLeaderboard();
    bindEvents();
    tdApplyDifficultyButtons();
    tdResetState();
    tdDraw();
    renderAll();
    renderTdMeta();
    renderLeaderboard();
    refreshLeaderboardSubmitUi();

    if (el.lbNameInput) {
        el.lbNameInput.value = normalizeCommanderName(state.playerName);
    }

    setInterval(passiveIncomeTick, 200);
    setInterval(timedTick, 1000);
}

boot();
