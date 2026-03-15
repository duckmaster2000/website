const SAVE_KEY = 'caleb_clicker_save_v3';

// ─── Element refs ────────────────────────────────────────────────────────────
const el = {
    gem:           document.querySelector('.gem-cost'),
    gpcValue:      document.querySelector('.gpc-value'),
    gpsValue:      document.querySelector('.gps-value'),
    comboValue:    document.querySelector('.combo-value'),
    frenzyValue:   document.querySelector('.frenzy-value'),
    comboFill:     document.querySelector('.combo-fill'),
    gemButton:     document.querySelector('.gem-button'),
    goldenGem:     document.querySelector('.golden-gem'),
    floatingLayer: document.querySelector('.floating-layer'),
    buyFeedback:   document.getElementById('buyFeedback'),

    clickerCost:     document.querySelector('.clicker-cost'),
    clickerLevel:    document.querySelector('.clickerLevel'),
    clickerIncrease: document.querySelector('.clickerIncrease'),

    minerCost:     document.querySelector('.miner-cost'),
    minerLevel:    document.querySelector('.minerLevel'),
    minerIncrease: document.querySelector('.minerIncrease'),

    factoryCost:     document.querySelector('.factory-cost'),
    factoryLevel:    document.querySelector('.factoryLevel'),
    factoryIncrease: document.querySelector('.factoryIncrease'),

    alchemyCost:     document.querySelector('.alchemy-cost'),
    alchemyLevel:    document.querySelector('.alchemyLevel'),
    alchemyIncrease: document.querySelector('.alchemyIncrease'),

    secretInput:    document.getElementById('secretCodeInput'),
    secretBtn:      document.getElementById('secretCodeBtn'),
    secretFeedback: document.getElementById('secretFeedback'),
    achievementList:document.getElementById('achievementList'),

    clickSound:   document.getElementById('click-sound'),
    upgradeSound: document.getElementById('upgrade-sound'),
    upgrades:     document.querySelectorAll('.upgrade')
};

// ─── State defaults ──────────────────────────────────────────────────────────
const DEFAULTS = {
    gems: 0,
    lifetimeGems: 0,
    gpc: 1,
    gps: 0,
    critChance: 0.05,
    critMultiplier: 2,
    frenzyTime: 0,
    goldenChance: 0.07,

    clickerCost: 10,
    clickerLevel: 0,
    clickerBaseIncrease: 1,

    minerCost: 30,
    minerLevel: 0,
    minerBaseIncrease: 1,

    factoryCost: 120,
    factoryLevel: 0,
    factoryBaseIncrease: 5,

    alchemyCost: 90,
    alchemyLevel: 0,
    alchemyCritIncrease: 0.02,

    secretRedeemed: false
};

const state = Object.assign({}, DEFAULTS, {
    // transient — never persisted between sessions
    comboCount: 0,
    comboMultiplier: 1,
    lastClickTime: 0,
    goldenGemActive: false
});

// ─── Achievements ────────────────────────────────────────────────────────────
const ACHIEVEMENTS = [
    { id: 'starter',  label: '⛏ Starter Miner',  check: () => state.lifetimeGems >= 100 },
    { id: 'rich',     label: '💎 Gem Tycoon',      check: () => state.lifetimeGems >= 10000 },
    { id: 'combo',    label: '🔥 Combo Crafter',   check: () => state.comboCount >= 15 },
    { id: 'builder',  label: '🏭 Factory Owner',   check: () => state.factoryLevel >= 5 },
    { id: 'alchemist',label: '⚗️ Alchemist',       check: () => state.alchemyLevel >= 5 },
    { id: 'hacker',   label: '🔓 Secret Hacker',   check: () => state.secretRedeemed }
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n) {
    return Math.floor(n).toLocaleString();
}

function fmtDec(n, d = 1) {
    const s = Number(n).toFixed(d);
    return s.replace(/\.0+$/, '');
}

function safeSet(elRef, value) {
    if (elRef) elRef.textContent = value;
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
    node.style.top  = `${y}px`;
    el.floatingLayer.appendChild(node);
    setTimeout(() => node.remove(), 900);
}

let buyFeedbackTimer = null;
function showBuyFeedback(msg) {
    if (!el.buyFeedback) return;
    el.buyFeedback.textContent = msg;
    clearTimeout(buyFeedbackTimer);
    buyFeedbackTimer = setTimeout(() => {
        if (el.buyFeedback) el.buyFeedback.textContent = '';
    }, 2200);
}

// ─── Save / Load ──────────────────────────────────────────────────────────────
function saveGame() {
    // Only persist durable state — never transient fields
    const toSave = {};
    Object.keys(DEFAULTS).forEach(k => { toSave[k] = state[k]; });
    localStorage.setItem(SAVE_KEY, JSON.stringify(toSave));
}

function validateState() {
    // Replace any NaN / Infinity / undefined with the default value
    Object.keys(DEFAULTS).forEach(k => {
        if (typeof DEFAULTS[k] === 'number') {
            if (!Number.isFinite(state[k])) state[k] = DEFAULTS[k];
            if (state[k] < 0 && k !== 'frenzyTime') state[k] = DEFAULTS[k];
        } else if (typeof DEFAULTS[k] === 'boolean') {
            if (typeof state[k] !== 'boolean') state[k] = DEFAULTS[k];
        }
    });

    // Ensure levels imply minimum cost (catch corrupted cost values)
    if (state.clickerCost < 10)  state.clickerCost  = 10;
    if (state.minerCost   < 30)  state.minerCost    = 30;
    if (state.factoryCost < 120) state.factoryCost  = 120;
    if (state.alchemyCost < 90)  state.alchemyCost  = 90;
}

function loadGame() {
    // Try loading v3 save
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            // Copy only known durable keys — ignore any transient junk
            Object.keys(DEFAULTS).forEach(k => {
                if (k in parsed) state[k] = parsed[k];
            });
            validateState();
            return;
        } catch (_e) {
            localStorage.removeItem(SAVE_KEY);
        }
    }

    // Try migrating old v2 save
    const rawV2 = localStorage.getItem('caleb_clicker_save_v2');
    if (!rawV2) return;
    try {
        const v2 = JSON.parse(rawV2);
        state.gems               = Number(v2.gems               || 0);
        state.lifetimeGems       = state.gems;
        state.gpc                = Number(v2.gpc                || 1);
        state.gps                = Number(v2.gps                || 0);
        state.clickerCost        = Number(v2.clickerCost        || 10);
        state.clickerLevel       = Number(v2.clickerLevel       || 0);
        state.clickerBaseIncrease= Number(v2.clickerBaseIncrease|| 1);
        state.minerCost          = Number(v2.minerCost          || 30);
        state.minerLevel         = Number(v2.minerLevel         || 0);
        state.minerBaseIncrease  = Number(v2.minerBaseIncrease  || 1);
        localStorage.removeItem('caleb_clicker_save_v2');
        validateState();
    } catch (_e) {
        localStorage.removeItem('caleb_clicker_save_v2');
    }
}

// ─── Render ────────────────────────────────────────────────────────────────────
let lastAchievementRender = -1;

function renderAchievements() {
    // Only re-render when the unlock set might have changed (once per second)
    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec === lastAchievementRender) return;
    lastAchievementRender = nowSec;

    if (!el.achievementList) return;
    el.achievementList.innerHTML = '';
    ACHIEVEMENTS.forEach(item => {
        const unlocked = item.check();
        const badge = document.createElement('span');
        badge.className = unlocked ? 'badge' : 'badge locked';
        badge.textContent = item.label;
        el.achievementList.appendChild(badge);
    });
}

function refreshUpgradeStates() {
    el.upgrades.forEach(btn => {
        const type = btn.dataset.upgrade;
        const cost = state[`${type}Cost`];
        const canAfford = Number.isFinite(cost) && state.gems >= cost;
        btn.classList.toggle('disabled', !canAfford);
    });
}

function render() {
    safeSet(el.gem,        fmt(state.gems));
    safeSet(el.gpcValue,   fmtDec(state.gpc));
    safeSet(el.gpsValue,   fmtDec(state.gps));
    safeSet(el.comboValue, `x${fmtDec(state.comboMultiplier)}`);
    safeSet(el.frenzyValue, state.frenzyTime > 0 ? `${Math.ceil(state.frenzyTime)}s` : 'OFF');

    if (el.comboFill) {
        el.comboFill.style.width = `${Math.min((state.comboCount / 20) * 100, 100)}%`;
    }

    safeSet(el.clickerCost,     fmt(state.clickerCost));
    safeSet(el.clickerLevel,    state.clickerLevel);
    safeSet(el.clickerIncrease, fmtDec(state.clickerBaseIncrease));

    safeSet(el.minerCost,     fmt(state.minerCost));
    safeSet(el.minerLevel,    state.minerLevel);
    safeSet(el.minerIncrease, fmtDec(state.minerBaseIncrease));

    safeSet(el.factoryCost,     fmt(state.factoryCost));
    safeSet(el.factoryLevel,    state.factoryLevel);
    safeSet(el.factoryIncrease, fmtDec(state.factoryBaseIncrease));

    safeSet(el.alchemyCost,     fmt(state.alchemyCost));
    safeSet(el.alchemyLevel,    state.alchemyLevel);
    safeSet(el.alchemyIncrease, fmtDec(state.alchemyCritIncrease * 100));

    document.body.classList.toggle('frenzy', state.frenzyTime > 0);

    renderAchievements();
    refreshUpgradeStates();
}

// ─── Click & Combo ────────────────────────────────────────────────────────────
function pulseGem() {
    if (!el.gemButton) return;
    el.gemButton.classList.add('burst');
    setTimeout(() => el.gemButton.classList.remove('burst'), 120);
}

function incrementGem(event) {
    const now = Date.now();
    if (now - state.lastClickTime < 550) {
        state.comboCount += 1;
    } else {
        state.comboCount = 1;
    }
    state.lastClickTime = now;
    state.comboMultiplier = 1 + Math.min(state.comboCount * 0.045, 1.5);

    const frenzyMult = state.frenzyTime > 0 ? 2 : 1;
    const isCrit     = Math.random() < state.critChance;
    const critMult   = isCrit ? state.critMultiplier : 1;
    const gain       = state.gpc * state.comboMultiplier * frenzyMult * critMult;

    addGems(gain);
    render();
    saveGame();
    pulseGem();
    playSound(el.clickSound, 0.35);

    if (event) {
        showFloat(event.clientX, event.clientY,
            `+${fmtDec(gain)}`,
            isCrit ? 'crit' : '');
    }
}

// ─── Golden Gem ────────────────────────────────────────────────────────────────
function spawnGoldenGem() {
    if (state.goldenGemActive) return;
    state.goldenGemActive = true;
    if (el.goldenGem) el.goldenGem.classList.remove('hidden');

    // Auto-expire after 7 seconds if not clicked
    setTimeout(() => {
        if (state.goldenGemActive) {
            state.goldenGemActive = false;
            if (el.goldenGem) el.goldenGem.classList.add('hidden');
        }
    }, 7000);
}

function collectGoldenGem() {
    if (!state.goldenGemActive) return;

    const base = Math.max(65, state.gpc * 20 + state.gps * 10);
    const gain = Math.round(base * (1 + state.alchemyLevel * 0.05));
    addGems(gain);
    state.frenzyTime += 10;
    state.goldenGemActive = false;
    if (el.goldenGem) el.goldenGem.classList.add('hidden');

    if (el.goldenGem) {
        const r = el.goldenGem.getBoundingClientRect();
        showFloat(r.left + r.width / 2, r.top + r.height / 2,
            `+${fmt(gain)} GOLD`, 'golden');
    }
    playSound(el.upgradeSound, 0.55);
    render();
    saveGame();
}

// ─── Upgrades ─────────────────────────────────────────────────────────────────
function tryBuy(costKey, fn, upgradeName) {
    const cost = state[costKey];
    if (!Number.isFinite(cost)) return;
    if (state.gems < cost) {
        const need = Math.ceil(cost - state.gems);
        showBuyFeedback(`Need ${fmt(need)} more gems for ${upgradeName}.`);
        return;
    }
    fn();
}

function buyClicker() {
    state.gems -= state.clickerCost;
    state.clickerLevel += 1;
    state.gpc += state.clickerBaseIncrease;
    state.clickerBaseIncrease = parseFloat((state.clickerBaseIncrease * 1.14).toFixed(2));
    state.clickerCost = Math.round(state.clickerCost * 1.24);
    render();
    saveGame();
    playSound(el.upgradeSound, 0.45);
    showBuyFeedback(`Quantum Clicker upgraded to Lv ${state.clickerLevel}!`);
}

function buyMiner() {
    state.gems -= state.minerCost;
    state.minerLevel += 1;
    state.gps += state.minerBaseIncrease;
    state.minerBaseIncrease = parseFloat((state.minerBaseIncrease * 1.16).toFixed(2));
    state.minerCost = Math.round(state.minerCost * 1.26);
    render();
    saveGame();
    playSound(el.upgradeSound, 0.5);
    showBuyFeedback(`Auto Miner upgraded to Lv ${state.minerLevel}!`);
}

function buyFactory() {
    state.gems -= state.factoryCost;
    state.factoryLevel += 1;
    state.gps += state.factoryBaseIncrease;
    state.factoryBaseIncrease = parseFloat((state.factoryBaseIncrease * 1.18).toFixed(2));
    state.factoryCost = Math.round(state.factoryCost * 1.29);
    render();
    saveGame();
    playSound(el.upgradeSound, 0.55);
    showBuyFeedback(`Crystal Factory upgraded to Lv ${state.factoryLevel}!`);
}

function buyAlchemy() {
    state.gems -= state.alchemyCost;
    state.alchemyLevel += 1;
    state.critChance  = Math.min(0.55, state.critChance  + state.alchemyCritIncrease);
    state.goldenChance= Math.min(0.35, state.goldenChance + 0.012);
    state.alchemyCost = Math.round(state.alchemyCost * 1.31);
    render();
    saveGame();
    playSound(el.upgradeSound, 0.58);
    showBuyFeedback(`Gem Alchemy upgraded to Lv ${state.alchemyLevel}! Crit chance ↑`);
}

// ─── Secret Code ──────────────────────────────────────────────────────────────
function applySecretCode() {
    if (!el.secretInput) return;
    const code = el.secretInput.value.trim().toLowerCase();

    if (code !== 'caleb') {
        if (el.secretFeedback) el.secretFeedback.textContent = '✗ Invalid code. Try again.';
        return;
    }
    if (state.secretRedeemed) {
        if (el.secretFeedback) el.secretFeedback.textContent = '✓ Code already redeemed.';
        return;
    }

    state.secretRedeemed = true;
    addGems(5000);
    state.gpc  += 25;
    state.gps  += 20;
    state.critChance   = Math.min(0.70, state.critChance   + 0.15);
    state.goldenChance = Math.min(0.45, state.goldenChance + 0.06);
    state.frenzyTime  += 45;

    if (el.secretFeedback) {
        el.secretFeedback.textContent = '✓ CALYX override accepted! Hack unlocked!';
    }
    if (el.secretInput) el.secretInput.value = '';
    playSound(el.upgradeSound, 0.7);
    render();
    saveGame();
}

// ─── Passive timers ───────────────────────────────────────────────────────────
function startPassiveIncome() {
    setInterval(() => {
        if (state.gps > 0) {
            addGems(state.gps / 5);
            // Only update the gem counter here — no full render to keep things fast
            safeSet(el.gem, fmt(state.gems));
            refreshUpgradeStates();
        }
    }, 200);
}

function startTimers() {
    setInterval(() => {
        // Decay frenzy
        if (state.frenzyTime > 0) {
            state.frenzyTime = Math.max(0, state.frenzyTime - 1);
        }

        // Spawn golden gem
        if (!state.goldenGemActive && Math.random() < state.goldenChance) {
            spawnGoldenGem();
        }

        // Decay combo if player stopped clicking
        if (Date.now() - state.lastClickTime > 1400) {
            state.comboCount      = Math.max(0, state.comboCount - 2);
            state.comboMultiplier = 1 + Math.min(state.comboCount * 0.045, 1.5);
        }

        render();
        saveGame();
    }, 1000);
}

// ─── Event binding ────────────────────────────────────────────────────────────
function bindEvents() {
    if (el.gemButton)  el.gemButton .addEventListener('click', incrementGem);
    if (el.goldenGem)  el.goldenGem .addEventListener('click', collectGoldenGem);

    el.upgrades.forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.upgrade;
            if (type === 'clicker')  { tryBuy('clickerCost',  buyClicker,  'Quantum Clicker'); return; }
            if (type === 'miner')    { tryBuy('minerCost',    buyMiner,    'Auto Miner');      return; }
            if (type === 'factory')  { tryBuy('factoryCost',  buyFactory,  'Crystal Factory'); return; }
            if (type === 'alchemy')  { tryBuy('alchemyCost',  buyAlchemy,  'Gem Alchemy');     return; }
        });
    });

    if (el.secretBtn) {
        el.secretBtn.addEventListener('click', applySecretCode);
    }
    if (el.secretInput) {
        el.secretInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') applySecretCode();
        });
    }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
loadGame();
bindEvents();
render();
startPassiveIncome();
startTimers();
