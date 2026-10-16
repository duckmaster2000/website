/*
 * Training drills: short, repeatable situations against a scripted opponent, each with one clear
 * objective and 1-3 stars. No AI, no rewards, no trophies, no records; best stars are kept in
 * progress.training so there's something to improve on.
 *
 * A drill lists a fixed deck, the enemy waves (card, where, when), how long it runs, and how it's
 * judged: `win(m, t)` / `fail(m, t)` are checked every frame against the real match, `stars(m, t)`
 * once it's won. Loaded before prototype_v4.js; uses its globals at call time.
 */

const LEFT = 3.5;
const RIGHT = 14.5;
const BRIDGE_Y = 13; // just over the river on the enemy side
const ENEMY_LEVEL = 7; // drill attackers are free, so they're two levels below your level-9 cards
const towerFrac = (m, side) => Math.min(...m.towers.filter((t) => t.owner === side && t.tower === 'princess').map((t) => Math.max(0, t.hp) / t.hpMax));
const towersLost = (m, side) => m.towers.filter((t) => t.owner === side && t.hp <= 0).length;
const enemiesLeft = (m) => m.units.some((u) => u.owner === 'B' && u.hp > 0 && !u.building);
const threeStars = (frac, a, b) => (frac >= a ? 3 : frac >= b ? 2 : 1);

const DRILLS = [
  {
    id: 'bridge', icon: '🐗', name: 'Hold the Bridge', level: 'Defence',
    goal: 'Three Ram Hog pushes hit your right tower. Don\'t lose a tower; stars for how much health it keeps.',
    tip: 'Ram Hog only hits buildings: a Bolt Turret or Guardian in its path, plus cheap damage, stops it cold.',
    deck: ['boltturret', 'guardian', 'mechmice', 'voltbug', 'shock', 'drillcat', 'scout', 'firebomb'],
    secs: 45, elixir: 10, rate: 1.5,
    waves: [{ at: 3, units: [['ramhog', RIGHT]] }, { at: 18, units: [['ramhog', RIGHT], ['mechmice', RIGHT]] }, { at: 33, units: [['ramhog', RIGHT]] }],
    fail: (m) => towersLost(m, 'A') > 0,
    win: (m, t) => t.time >= 38 && !enemiesLeft(m),
    stars: (m) => threeStars(towerFrac(m, 'A'), 0.9, 0.7),
  },
  {
    id: 'skies', icon: '🦅', name: 'Clear the Skies', level: 'Anti-air',
    goal: 'Air waves fly at both towers, ending with a Fly Bomber swarm. Keep both towers standing; stars for their health.',
    tip: 'Ground-only troops can\'t touch flyers. Volt Bug, Flare Pod and Cryo Caster hit the air; Rocket Rain clears groups.',
    deck: ['voltbug', 'flarepod', 'cryocaster', 'flakgunner', 'rocketrain', 'brawler', 'scout', 'shock'],
    secs: 40, elixir: 10, rate: 1.5,
    waves: [{ at: 3, units: [['hawkstrike', LEFT]] }, { at: 12, units: [['beeblitz', RIGHT]] }, { at: 20, units: [['hawkstrike', RIGHT], ['beeblitz', LEFT]] }, { at: 28, units: [['flybombers', LEFT]] }],
    fail: (m) => towersLost(m, 'A') > 0,
    win: (m, t) => t.time >= 36 && !enemiesLeft(m),
    stars: (m) => threeStars(towerFrac(m, 'A'), 0.85, 0.6),
  },
  {
    id: 'titan', icon: '🗿', name: 'Topple the Titan', level: 'Tank killing',
    goal: 'A Rock Titan with Flare Pod support marches down the left. Kill the Titan before it hits a tower; stars for speed.',
    tip: 'High single-target damage (Drill Cat, Inferno Spire) melts tanks. Deal with the support with a spell.',
    deck: ['drillcat', 'infernospire', 'brawler', 'mechmice', 'firebomb', 'shock', 'voltbug', 'scout'],
    secs: 45, elixir: 10, rate: 2,
    waves: [{ at: 1, units: [['rocktitan', LEFT, 9]] }, { at: 4, units: [['flarepod', LEFT, 9]] }],
    // Fails the moment the Titan is close enough to swing at one of your towers
    fail: (m) => towersLost(m, 'A') > 0 || m.units.some((u) => u.owner === 'B' && u.cardId === 'rocktitan' && u.hp > 0 && m.towers.some((t) => t.owner === 'A' && t.hp > 0 && Math.max(Math.abs(u.x - t.x), Math.abs(u.y - t.y)) - t.half <= u.radius + 0.8)),
    win: (m, t) => t.time > 3 && !m.units.some((u) => u.owner === 'B' && u.cardId === 'rocktitan' && u.hp > 0),
    stars: (m, t) => (t.time <= 22 ? 3 : t.time <= 30 ? 2 : 1),
  },
  {
    id: 'breach', icon: '🏯', name: 'Break Through', level: 'Offence',
    goal: 'The enemy keeps a Bolt Turret and defenders on its left tower. Destroy that tower within 60 s; stars for speed.',
    tip: 'A tank in front, damage behind it. Spells can finish a tower or clear the defenders.',
    deck: ['ramhog', 'brawler', 'flarepod', 'mechmice', 'firebomb', 'rocketrain', 'guardian', 'scout'],
    secs: 60, elixir: 8, rate: 1,
    setup: (m) => { m.towers.filter((t) => t.owner === 'B').forEach((t) => { t.hp = Math.round(t.hpMax * 0.7); }); },
    waves: [{ at: 0.5, units: [['boltturret', LEFT, 9.5]] }, { at: 10, units: [['junkpack', LEFT, 9]] }, { at: 22, units: [['boltturret', LEFT, 9.5]] }, { at: 30, units: [['cryocaster', LEFT, 9]] }, { at: 42, units: [['junkpack', LEFT, 9]] }],
    fail: (m, t) => t.time >= 60,
    win: (m) => m.towers.some((t) => t.owner === 'B' && t.tower === 'princess' && t.hp <= 0),
    stars: (m, t) => (t.time <= 30 ? 3 : t.time <= 45 ? 2 : 1),
  },
  {
    id: 'swarm', icon: '🐜', name: 'Swarm Storm', level: 'Splash',
    goal: 'Swarm after swarm, on both lanes, every few seconds. Survive 45 s without losing a tower; stars for tower health.',
    tip: 'Splash damage (Flare Pod, Bomb Beetles, Fire Bomb) answers many small units at once; one-target troops get overwhelmed.',
    deck: ['flarepod', 'bombbeetles', 'firebomb', 'shock', 'brawler', 'voltbug', 'boltturret', 'scout'],
    secs: 48, elixir: 8, rate: 1.5,
    waves: [6, 12, 18, 24, 30, 36, 42].map((at, i) => ({ at, units: [[['junkpack', 'mechmice', 'goblinbikers', 'antmarch'][i % 4], i % 2 ? RIGHT : LEFT]] })),
    fail: (m) => towersLost(m, 'A') > 0,
    win: (m, t) => t.time >= 45,
    stars: (m) => threeStars(towerFrac(m, 'A'), 0.85, 0.6),
  },
];
const DRILL_MAP = Object.fromEntries(DRILLS.map((d) => [d.id, d]));
const trainUi = { el: null };

function trainingStars(id) { return (state.progress.training && state.progress.training[id]) || 0; }

function startDrill(id) {
  const d = DRILL_MAP[id];
  if (!d) return;
  closeTrainingHub();
  state.training = { id, time: 0, nextWave: 0, done: false };
  const m = beginScriptedMatch({ deck: d.deck, level: 9, towerLevel: 9, elixir: d.elixir, training: true, tag: `🎯 Training · ${d.name}`, seed: 777, rules: { regulation: d.secs + 5, overtime: 0, evo: { disabled: true }, maxElixir: 10, startElixir: d.elixir, elixirPhases: [{ at: 0, mult: d.rate || 1 }] } });
  if (!m) { state.training = null; toast('⚠️', 'The drill could not start', 'Please try again.'); return; }
  m.players.B.elixir = 0;
  if (d.setup) d.setup(m);
  state.snapCur = Sim.snapshot(m);
  state.view = state.snapCur;
  presentScriptedMatch();
  writeLog(`🎯 ${d.name}: ${d.goal}`);
}

// Per frame (from the local loop): scripted waves, then the drill's own win/fail checks
function updateTraining() {
  const tr = state.training;
  const m = state.match;
  if (!tr || !m || tr.done) return;
  const d = DRILL_MAP[tr.id];
  tr.time = m.time;
  while (tr.nextWave < d.waves.length && m.time >= d.waves[tr.nextWave].at) {
    d.waves[tr.nextWave].units.forEach(([card, x, y]) => {
      // A swarm card arrives as its whole group, spread a little like a real deploy
      const n = (Sim.CARD_MAP[card] && Sim.CARD_MAP[card].swarmCount) || 1;
      for (let i = 0; i < n; i++) Sim.spawnDirect(m, 'B', card, x + (n > 1 ? Math.cos(i * 2.4) * 0.6 : 0), (y || BRIDGE_Y) + (n > 1 ? Math.sin(i * 2.4) * 0.4 : 0), ENEMY_LEVEL);
    });
    tr.nextWave++;
  }
  if (d.fail(m, tr)) finishDrill(false);
  else if (d.win(m, tr)) finishDrill(true);
}

function finishDrill(won) {
  const tr = state.training;
  if (!tr || tr.done) return;
  tr.done = true;
  const d = DRILL_MAP[tr.id];
  const m = state.match;
  const stars = won ? d.stars(m, tr) : 0;
  if (!state.progress.training) state.progress.training = {};
  const best = trainingStars(d.id);
  if (stars > best) { state.progress.training[d.id] = stars; saveProgress(); }
  state.running = false;
  state.winner = won ? 'A' : 'B';
  m.running = false;
  Sound.play(won ? 'win' : 'lose');
  presentResult(won ? 'win' : 'loss', won ? 'DRILL CLEARED' : 'DRILL FAILED', () => showDrillResult(d, won, stars, best));
}

// The engine ended the match first (time, or a King Tower): judge the drill from where it stands
function trainingFinished() {
  const tr = state.training;
  if (!tr || tr.done) return;
  const d = DRILL_MAP[tr.id];
  finishDrill(!d.fail(state.match, tr) && d.win(state.match, tr));
}

function showDrillResult(d, won, stars, best) {
  const i = DRILLS.indexOf(d);
  const next = DRILLS[i + 1];
  showTrainingPanel(`<p class="tut-step">TRAINING · ${escapeHtml(d.level.toUpperCase())}</p>
    <h4>${d.icon} ${escapeHtml(d.name)}: ${won ? 'cleared' : 'failed'}</h4>
    <p class="train-stars" aria-label="${stars} of 3 stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}${stars > best ? ' <b>New best!</b>' : ''}</p>
    <p>${won ? escapeHtml(d.goal) : `Tip: ${escapeHtml(d.tip)}`}</p>
    <div class="tut-actions"><button type="button" data-train="hub">All drills</button><button type="button" data-train-start="${d.id}">↻ Retry</button>${next ? `<button type="button" class="btn-primary" data-train-start="${next.id}">Next: ${escapeHtml(next.name)} ›</button>` : ''}</div>`);
}

// ─── The drill list ─────────────────────────────────────────────────────────

function openTrainingHub() {
  showTrainingPanel(`<p class="tut-step">TRAINING</p><h4>🎯 Practice drills</h4>
    <p>Short situations with one goal each. No trophies or rewards: just practice, and up to 3 stars to chase.</p>
    <ul class="train-list">${DRILLS.map((d) => `<li><button type="button" data-train-start="${d.id}"><span class="train-ic">${d.icon}</span><span><b>${escapeHtml(d.name)}</b> <small>${escapeHtml(d.level)}</small><em>${escapeHtml(d.goal)}</em></span><span class="train-stars">${'★'.repeat(trainingStars(d.id))}${'☆'.repeat(3 - trainingStars(d.id))}</span></button></li>`).join('')}</ul>
    <div class="tut-actions"><button type="button" data-train="close">Close</button></div>`);
}

function closeTrainingHub() { if (trainUi.el) trainUi.el.hidden = true; }

function showTrainingPanel(html) {
  if (!trainUi.el || !trainUi.el.isConnected) {
    const el = document.createElement('div');
    el.className = 'tut-coach train-panel';
    el.setAttribute('role', 'dialog');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.trainStart) { Sound.unlock(); startDrill(b.dataset.trainStart); }
      else if (b.dataset.train === 'hub') openTrainingHub();
      else if (b.dataset.train === 'close') closeTrainingHub();
    });
    document.body.appendChild(el);
    trainUi.el = el;
  }
  trainUi.el.hidden = false;
  trainUi.el.innerHTML = html;
  const f = trainUi.el.querySelector('.btn-primary, button');
  if (f) f.focus({ preventScroll: true });
}

// The opponent's panel during a drill: the goal and the clock
function trainingDeckNote() {
  const tr = state.training;
  const d = tr && DRILL_MAP[tr.id];
  if (!d) return '';
  const left = Math.max(0, Math.ceil(d.secs - tr.time));
  return `<div class="note train-note">🎯 <b>${escapeHtml(d.name)}</b> · ${left}s<br>${escapeHtml(d.goal)}</div>`;
}
