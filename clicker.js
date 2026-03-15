const SAVE_KEY = 'caleb_clicker_save_v3';

const el = {
    gem: document.querySelector('.gem-cost'),
    gpcValue: document.querySelector('.gpc-value'),
    gpsValue: document.querySelector('.gps-value'),
    comboValue: document.querySelector('.combo-value'),
    frenzyValue: document.querySelector('.frenzy-value'),
    comboFill: document.querySelector('.combo-fill'),
    gemButton: document.querySelector('.gem-button'),
    goldenGem: document.querySelector('.golden-gem'),
    floatingLayer: document.querySelector('.floating-layer'),
    clickerCost: document.querySelector('.clicker-cost'),
    clickerLevel: document.querySelector('.clickerLevel'),
    clickerIncrease: document.querySelector('.clickerIncrease'),
    minerCost: document.querySelector('.miner-cost'),
    minerLevel: document.querySelector('.minerLevel'),
    minerIncrease: document.querySelector('.minerIncrease'),
    factoryCost: document.querySelector('.factory-cost'),
    factoryLevel: document.querySelector('.factoryLevel'),
    factoryIncrease: document.querySelector('.factoryIncrease'),
    alchemyCost: document.querySelector('.alchemy-cost'),
    alchemyLevel: document.querySelector('.alchemyLevel'),
    alchemyIncrease: document.querySelector('.alchemyIncrease'),
    secretInput: document.getElementById('secretCodeInput'),
    secretBtn: document.getElementById('secretCodeBtn'),
    secretFeedback: document.getElementById('secretFeedback'),
    achievementList: document.getElementById('achievementList'),
    clickSound: document.getElementById('click-sound'),
    upgradeSound: document.getElementById('upgrade-sound'),
    upgrades: document.querySelectorAll('.upgrade')
};

const state = {
    gems: 0,
    lifetimeGems: 0,
    gpc: 1,
    gps: 0,
    comboCount: 0,
    comboMultiplier: 1,
    lastClickTime: 0,
    critChance: 0.05,
    critMultiplier: 2,
    frenzyTime: 0,
    goldenChance: 0.04,
    goldenGemActive: false,
    secretRedeemed: false,

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
    alchemyCritIncrease: 0.02
};

const achievements = [
    { id: 'starter', label: 'Starter Miner', check: () => state.lifetimeGems >= 100 },
    { id: 'rich', label: 'Gem Tycoon', check: () => state.lifetimeGems >= 10000 },
    { id: 'combo', label: 'Combo Crafter', check: () => state.comboCount >= 15 },
    { id: 'builder', label: 'Factory Owner', check: () => state.factoryLevel >= 5 },
    { id: 'alchemist', label: 'Alchemist', check: () => state.alchemyLevel >= 5 },
    { id: 'hacker', label: 'Secret Hacker', check: () => state.secretRedeemed }
];

const unlocked = new Set();

function formatNum(value) {
    return Math.floor(value).toLocaleString();
}

function formatSmall(value, decimals = 2) {
    return Number(value).toFixed(decimals).replace(/\.00$/, '');
}

function playSound(audioEl, volume) {
    if (!audioEl) {
        return;
    }
    audioEl.volume = volume;
    audioEl.currentTime = 0;
    audioEl.play().catch(() => {
        // Ignore autoplay restrictions before first interaction.
    });
}

function addGems(amount) {
    state.gems += amount;
    state.lifetimeGems += amount;
}

function showFloatingText(x, y, amountText, variant = '') {
    const node = document.createElement('span');
    node.className = `floating-text ${variant}`.trim();
    node.textContent = amountText;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    el.floatingLayer.appendChild(node);
    setTimeout(() => node.remove(), 900);
}

function saveGame() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function loadGame() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            Object.assign(state, parsed);
            return;
        } catch (_err) {
            localStorage.removeItem(SAVE_KEY);
        }
    }

    const legacyRaw = localStorage.getItem('caleb_clicker_save_v2');
    if (!legacyRaw) {
        return;
    }

    try {
        const legacy = JSON.parse(legacyRaw);
        state.gems = Number(legacy.gems || 0);
        state.lifetimeGems = state.gems;
        state.gpc = Number(legacy.gpc || 1);
        state.gps = Number(legacy.gps || 0);
        state.clickerCost = Number(legacy.clickerCost || 10);
        state.clickerLevel = Number(legacy.clickerLevel || 0);
        state.clickerBaseIncrease = Number(legacy.clickerBaseIncrease || 1);
        state.minerCost = Number(legacy.minerCost || 30);
        state.minerLevel = Number(legacy.minerLevel || 0);
        state.minerBaseIncrease = Number(legacy.minerBaseIncrease || 1);
        localStorage.removeItem('caleb_clicker_save_v2');
    } catch (_err) {
        localStorage.removeItem('caleb_clicker_save_v2');
    }
}

function renderAchievements() {
    if (!el.achievementList) {
        return;
    }

    el.achievementList.innerHTML = '';
    achievements.forEach((item) => {
        const isUnlocked = item.check();
        if (isUnlocked) {
            unlocked.add(item.id);
        }

        const badge = document.createElement('span');
        badge.className = `badge ${isUnlocked ? '' : 'locked'}`.trim();
        badge.textContent = item.label;
        el.achievementList.appendChild(badge);
    });
}

function refreshUpgradeStates() {
    el.upgrades.forEach((btn) => {
        const type = btn.dataset.upgrade;
        const cost = state[`${type}Cost`];
        btn.classList.toggle('disabled', state.gems < cost);
    });
}

function render() {
    el.gem.textContent = formatNum(state.gems);
    el.gpcValue.textContent = formatSmall(state.gpc, 1);
    el.gpsValue.textContent = formatSmall(state.gps, 1);
    el.comboValue.textContent = `x${formatSmall(state.comboMultiplier)}`;
    el.frenzyValue.textContent = state.frenzyTime > 0 ? `${Math.ceil(state.frenzyTime)}s` : 'OFF';
    el.comboFill.style.width = `${Math.min((state.comboCount / 20) * 100, 100)}%`;

    el.clickerCost.textContent = formatNum(state.clickerCost);
    el.clickerLevel.textContent = state.clickerLevel;
    el.clickerIncrease.textContent = formatSmall(state.clickerBaseIncrease, 1);

    el.minerCost.textContent = formatNum(state.minerCost);
    el.minerLevel.textContent = state.minerLevel;
    el.minerIncrease.textContent = formatSmall(state.minerBaseIncrease, 1);

    el.factoryCost.textContent = formatNum(state.factoryCost);
    el.factoryLevel.textContent = state.factoryLevel;
    el.factoryIncrease.textContent = formatSmall(state.factoryBaseIncrease, 1);

    el.alchemyCost.textContent = formatNum(state.alchemyCost);
    el.alchemyLevel.textContent = state.alchemyLevel;
    el.alchemyIncrease.textContent = formatSmall(state.alchemyCritIncrease * 100, 1);

    document.body.classList.toggle('frenzy', state.frenzyTime > 0);

    renderAchievements();
    refreshUpgradeStates();
}

function pulseGem() {
    el.gemButton.classList.add('burst');
    setTimeout(() => el.gemButton.classList.remove('burst'), 120);
}

function spawnGoldenGem() {
    if (state.goldenGemActive) {
        return;
    }

    state.goldenGemActive = true;
    el.goldenGem.classList.remove('hidden');

    setTimeout(() => {
        state.goldenGemActive = false;
        el.goldenGem.classList.add('hidden');
    }, 6500);
}

function collectGoldenGem() {
    if (!state.goldenGemActive) {
        return;
    }

    const base = Math.max(65, state.gpc * 20 + state.gps * 10);
    const gain = Math.round(base * (1 + state.alchemyLevel * 0.05));
    addGems(gain);
    state.frenzyTime += 10;
    state.goldenGemActive = false;
    el.goldenGem.classList.add('hidden');

    const rect = el.goldenGem.getBoundingClientRect();
    showFloatingText(rect.left + rect.width / 2, rect.top + rect.height / 2, `+${formatNum(gain)} GOLD`, 'golden');
    playSound(el.upgradeSound, 0.55);
    render();
    saveGame();
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

    const frenzyMultiplier = state.frenzyTime > 0 ? 2 : 1;
    const isCrit = Math.random() < state.critChance;
    const critMultiplier = isCrit ? state.critMultiplier : 1;

    const gain = state.gpc * state.comboMultiplier * frenzyMultiplier * critMultiplier;
    addGems(gain);

    render();
    saveGame();
    pulseGem();
    playSound(el.clickSound, 0.35);

    if (event) {
        const label = `+${formatSmall(gain, 1)}`;
        showFloatingText(event.clientX, event.clientY, label, isCrit ? 'crit' : '');
    }
}

function buyClicker() {
    if (state.gems < state.clickerCost) {
        return;
    }

    state.gems -= state.clickerCost;
    state.clickerLevel += 1;
    state.gpc += state.clickerBaseIncrease;
    state.clickerBaseIncrease = Number((state.clickerBaseIncrease * 1.14).toFixed(1));
    state.clickerCost = Math.round(state.clickerCost * 1.24);

    render();
    saveGame();
    playSound(el.upgradeSound, 0.45);
}

function buyMiner() {
    if (state.gems < state.minerCost) {
        return;
    }

    state.gems -= state.minerCost;
    state.minerLevel += 1;
    state.gps += state.minerBaseIncrease;
    state.minerBaseIncrease = Number((state.minerBaseIncrease * 1.16).toFixed(1));
    state.minerCost = Math.round(state.minerCost * 1.26);

    render();
    saveGame();
    playSound(el.upgradeSound, 0.5);
}

function buyFactory() {
    if (state.gems < state.factoryCost) {
        return;
    }

    state.gems -= state.factoryCost;
    state.factoryLevel += 1;
    state.gps += state.factoryBaseIncrease;
    state.factoryBaseIncrease = Number((state.factoryBaseIncrease * 1.18).toFixed(1));
    state.factoryCost = Math.round(state.factoryCost * 1.29);

    render();
    saveGame();
    playSound(el.upgradeSound, 0.55);
}

function buyAlchemy() {
    if (state.gems < state.alchemyCost) {
        return;
    }

    state.gems -= state.alchemyCost;
    state.alchemyLevel += 1;
    state.critChance = Math.min(0.55, state.critChance + state.alchemyCritIncrease);
    state.goldenChance = Math.min(0.3, state.goldenChance + 0.012);
    state.alchemyCost = Math.round(state.alchemyCost * 1.31);

    render();
    saveGame();
    playSound(el.upgradeSound, 0.58);
}

function applySecretCode() {
    const code = el.secretInput.value.trim();

    if (code.toLowerCase() !== 'caleb') {
        el.secretFeedback.textContent = 'Invalid code.';
        return;
    }

    if (state.secretRedeemed) {
        el.secretFeedback.textContent = 'Code already redeemed.';
        return;
    }

    state.secretRedeemed = true;
    addGems(5000);
    state.gpc += 25;
    state.gps += 20;
    state.critChance = Math.min(0.7, state.critChance + 0.15);
    state.goldenChance = Math.min(0.45, state.goldenChance + 0.06);
    state.frenzyTime += 45;

    el.secretFeedback.textContent = 'CALYX override accepted. Hack unlocked!';
    playSound(el.upgradeSound, 0.7);
    render();
    saveGame();
}

function startPassiveIncome() {
    setInterval(() => {
        if (state.gps <= 0) {
            return;
        }

        addGems(state.gps / 5);
        render();
    }, 200);
}

function startTimers() {
    setInterval(() => {
        if (state.frenzyTime > 0) {
            state.frenzyTime = Math.max(0, state.frenzyTime - 1);
        }

        if (!state.goldenGemActive && Math.random() < state.goldenChance) {
            spawnGoldenGem();
        }

        if (Date.now() - state.lastClickTime > 1200) {
            state.comboCount = Math.max(0, state.comboCount - 2);
            state.comboMultiplier = 1 + Math.min(state.comboCount * 0.045, 1.5);
        }

        render();
        saveGame();
    }, 1000);
}

function bindEvents() {
    el.gemButton.addEventListener('click', incrementGem);
    el.goldenGem.addEventListener('click', collectGoldenGem);

    el.upgrades.forEach((btn) => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.upgrade;
            if (type === 'clicker') {
                buyClicker();
                return;
            }
            if (type === 'miner') {
                buyMiner();
                return;
            }
            if (type === 'factory') {
                buyFactory();
                return;
            }
            buyAlchemy();
        });
    });

    el.secretBtn.addEventListener('click', applySecretCode);
    el.secretInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            applySecretCode();
        }
    });
}

loadGame();
bindEvents();
render();
startPassiveIncome();
startTimers();
