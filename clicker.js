const SAVE_KEY = 'caleb_clicker_save_v2';

const el = {
    gem: document.querySelector('.gem-cost'),
    gpcValue: document.querySelector('.gpc-value'),
    gpsValue: document.querySelector('.gps-value'),
    gemButton: document.querySelector('.gem-button'),
    floatingLayer: document.querySelector('.floating-layer'),
    clickerCost: document.querySelector('.clicker-cost'),
    clickerLevel: document.querySelector('.clickerLevel'),
    clickerIncrease: document.querySelector('.clickerIncrease'),
    minerCost: document.querySelector('.miner-cost'),
    minerLevel: document.querySelector('.minerLevel'),
    minerIncrease: document.querySelector('.minerIncrease'),
    clickSound: document.getElementById('click-sound'),
    upgradeSound: document.getElementById('upgrade-sound'),
    upgrades: document.querySelectorAll('.upgrade')
};

const state = {
    gems: 0,
    gpc: 1,
    gps: 0,
    clickerCost: 10,
    clickerLevel: 0,
    clickerBaseIncrease: 1,
    minerCost: 30,
    minerLevel: 0,
    minerBaseIncrease: 1
};

function formatNum(value) {
    return Math.floor(value).toLocaleString();
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

function showFloatingText(x, y, amountText) {
    const node = document.createElement('span');
    node.className = 'floating-text';
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
    if (!raw) {
        return;
    }

    try {
        const parsed = JSON.parse(raw);
        Object.assign(state, parsed);
    } catch (_err) {
        localStorage.removeItem(SAVE_KEY);
    }
}

function refreshUpgradeStates() {
    el.upgrades.forEach((btn) => {
        const isClicker = btn.dataset.upgrade === 'clicker';
        const cost = isClicker ? state.clickerCost : state.minerCost;
        btn.classList.toggle('disabled', state.gems < cost);
    });
}

function render() {
    el.gem.textContent = formatNum(state.gems);
    el.gpcValue.textContent = state.gpc.toFixed(1).replace('.0', '');
    el.gpsValue.textContent = state.gps.toFixed(1).replace('.0', '');

    el.clickerCost.textContent = formatNum(state.clickerCost);
    el.clickerLevel.textContent = state.clickerLevel;
    el.clickerIncrease.textContent = state.clickerBaseIncrease.toFixed(1).replace('.0', '');

    el.minerCost.textContent = formatNum(state.minerCost);
    el.minerLevel.textContent = state.minerLevel;
    el.minerIncrease.textContent = state.minerBaseIncrease.toFixed(1).replace('.0', '');

    refreshUpgradeStates();
}

function incrementGem(event) {
    state.gems += state.gpc;
    render();
    saveGame();
    playSound(el.clickSound, 0.35);

    if (event) {
        showFloatingText(event.clientX, event.clientY, `+${state.gpc.toFixed(1).replace('.0', '')}`);
    }
}

function buyClicker() {
    if (state.gems < state.clickerCost) {
        return;
    }

    state.gems -= state.clickerCost;
    state.clickerLevel += 1;
    state.gpc += state.clickerBaseIncrease;
    state.clickerBaseIncrease = Number((state.clickerBaseIncrease * 1.12).toFixed(1));
    state.clickerCost = Math.round(state.clickerCost * 1.22);

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
    state.minerBaseIncrease = Number((state.minerBaseIncrease * 1.15).toFixed(1));
    state.minerCost = Math.round(state.minerCost * 1.25);

    render();
    saveGame();
    playSound(el.upgradeSound, 0.5);
}

function startPassiveIncome() {
    setInterval(() => {
        if (state.gps <= 0) {
            return;
        }

        state.gems += state.gps;
        render();
        saveGame();
    }, 1000);
}

function bindEvents() {
    el.gemButton.addEventListener('click', incrementGem);

    el.upgrades.forEach((btn) => {
        btn.addEventListener('click', () => {
            if (btn.dataset.upgrade === 'clicker') {
                buyClicker();
                return;
            }
            buyMiner();
        });
    });
}

loadGame();
bindEvents();
render();
startPassiveIncome();
