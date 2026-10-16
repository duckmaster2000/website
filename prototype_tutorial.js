/*
 * The interactive tutorial: a real match against a scripted opponent that teaches the basics one
 * step at a time. Info steps freeze the battle until "Next"; action steps wait for the player to
 * actually do the thing (deploy, cycle, defend, cast a spell, take a crown, win). Skippable at
 * any time, replayable from Settings. It never touches trophies, stats or achievements; finishing
 * it the first time pays a one-time 150 gold.
 *
 * Loaded before prototype_v4.js and uses its globals (state, ui, Sim, arena, ...) at call time.
 */

const TUTORIAL_DECK = ['brawler', 'scout', 'voltbug', 'flarepod', 'firebomb', 'shock', 'ramhog', 'guardian'];
const TUTORIAL_GOLD = 150;
const tut = { el: null, key: '' };

// Each step: text, what to highlight, and when it's done (checked every frame against the real match)
const TUTORIAL_STEPS = [
  { id: 'intro', title: 'Welcome, Commander!', text: 'Each side has two Princess Towers and a King Tower. Knock down towers to earn crowns 👑. Destroy the King Tower and you win on the spot; otherwise, more crowns when the clock runs out wins.', focus: 'arena', hold: true },
  { id: 'elixir', title: 'Elixir', text: 'Every card costs elixir (the number on the card). Your elixir bar refills on its own, up to 10. In the last minute it fills twice as fast.', focus: 'elixir', hold: true },
  { id: 'deploy', title: 'Play a card', text: 'Drag a card from your hand onto your half of the arena, or tap a card and then tap where it should go. Troops can only be placed on your side.', focus: 'hand', done: (m) => m.players.A.cardsPlayed >= 1 },
  { id: 'march', title: 'Troops fight on their own', text: 'Once placed, troops walk toward the nearest enemy building and attack whatever they target. Watch your troop head for the bridge.', focus: 'arena', done: (m, t) => t.stepTime > 6 || m.units.some((u) => u.owner === 'A' && u.y < 15) },
  { id: 'cycle', title: 'Your hand cycles', text: 'The card you played went to the back of your deck, and the NEXT card slid into your hand. Play another card.', focus: 'hand', done: (m, t) => m.players.A.cardsPlayed >= t.playsAtStep + 1 },
  { id: 'defend', title: 'Defend!', text: 'Enemy troops are coming down the left lane. Put a troop in their way, or cast a spell on them. Your towers shoot too.', focus: 'hand', enter: (m) => { Sim.spawnDirect(m, 'B', 'junkpack', 3.5, 13.5, 3); Sim.spawnDirect(m, 'B', 'junkpack', 4.5, 13.5, 3); m.players.A.elixir = Math.max(m.players.A.elixir, 7); }, done: (m, t) => t.stepTime > 2 && !m.units.some((u) => u.owner === 'B' && u.hp > 0) },
  { id: 'spell', title: 'Spells go anywhere', text: 'Cards marked ✦ Spell can be cast anywhere on the arena, even on enemy towers. Cast Fire Bomb or Shock on the enemy.', focus: 'hand', enter: (m) => giveCard(m, 'firebomb'), done: (m) => m.playLog.some((e) => e.owner === 'A' && Sim.CARD_MAP[e.cardId] && Sim.CARD_MAP[e.cardId].spell) },
  { id: 'crown', title: 'Take a crown', text: 'Send troops at a Princess Tower. Tanks like Brawler soak up tower shots while others deal the damage. Ram Hog only hits buildings.', focus: 'arena', enter: (m) => giveCard(m, 'ramhog'), done: (m) => m.players.A.crowns >= 1 },
  { id: 'king', title: 'Finish it', text: 'A tower is down! You can now place troops in the space it left on the enemy side. Destroy the King Tower to win.', focus: 'arena', done: (m) => !m.running },
];

// Put a card in hand (tutorial only), so the step can be done right away
function giveCard(m, id) {
  const p = m.players.A;
  if (p.hand.includes(id)) return;
  const i = p.queue.indexOf(id);
  if (i < 0) return;
  p.queue.splice(i, 1);
  p.queue.push(p.hand[0]);
  p.hand[0] = id;
  p.elixir = Math.max(p.elixir, 6);
}

function tutorialActive() { return !!state.tutorial; }

// The battle stands still while an explanation is on screen
function tutorialHolds() {
  const t = state.tutorial;
  return !!(t && TUTORIAL_STEPS[t.step] && TUTORIAL_STEPS[t.step].hold);
}

// A local match against a scripted opponent (tutorial and training drills): no AI, no rewards,
// no trophies, no records. Returns the match, or null if it could not start.
function beginScriptedMatch(o) {
  try {
    if (state.tutorial && !o.tutorial) endTutorial(false);
    if (state.training && !o.training) state.training = null;
    forfeitRunningRanked();
    forfeitRunningEvent();
    leaveQueue();
    if (typeof closeEvents === 'function') closeEvents();
    onlineActive = false;
    lastMatchWasOnline = false;
    if (ui.lobbyPanel) ui.lobbyPanel.hidden = true;
    showView('battle');
    state.mode = 'ai';
    if (ui.mode) ui.mode.value = 'ai';
    document.body.classList.add('mode-ai');
    const entries = o.deck.map((id) => ({ id, level: o.level || 3, abilityUnlocked: false, mastery: 0, evo: false }));
    const towers = { towerLevel: o.towerLevel || 1, kingLevel: o.towerLevel || 1 };
    state.match = Sim.createMatch({
      seed: o.seed || 4242,
      decks: { A: entries, B: entries },
      towers: { A: { ...towers, ...(o.towersA || {}) }, B: { ...towers, ...(o.towersB || {}) } },
      rules: o.rules,
    });
    state.match.players.A.elixir = o.elixir != null ? o.elixir : 7;
    state.ai = null;
    state.rankedMatch = null;
    state.eventMatch = null;
    state.matchPays = false;
    state.aiTag = o.tag;
    state.viewSource = 'local';
    state.running = true;
    state.winner = null;
    state.selectedCard = null;
    state.acc = 0;
    state.damageSeen = 0;
    state.goldPool = 0;
    state.snapPrev = Sim.snapshot(state.match);
    state.snapCur = state.snapPrev;
    state.view = state.snapCur;
    return state.match;
  } catch (err) {
    console.error(err);
    return null;
  }
}

function presentScriptedMatch() {
  beginMatchPresentation();
  renderDecks();
  renderStatus();
  scrollToBattle();
}

function startTutorial() {
  state.tutorial = { step: 0, stepTime: 0, playsAtStep: 0, entered: {} };
  // A short lesson: the scripted side never plays cards, and its towers are lighter (tutorial only)
  const m = beginScriptedMatch({ deck: TUTORIAL_DECK, tag: '📘 Tutorial', tutorial: true, towersB: { towerMult: 0.55, kingMult: 0.5 }, rules: { regulation: 300, overtime: 0, evo: { disabled: true } } });
  if (!m) {
    state.tutorial = null;
    toast('⚠️', 'The tutorial could not start', 'Try again from Settings.');
    return;
  }
  presentScriptedMatch();
  writeLog('📘 Tutorial started. Skip it any time.');
}

function endTutorial(completed) {
  const t = state.tutorial;
  if (!t) return;
  state.tutorial = null;
  hideCoach();
  const first = completed && !state.progress.tutorialDone;
  if (completed) state.progress.tutorialDone = true;
  else state.progress.tutorialSkipped = true;
  if (first) state.progress.gold += TUTORIAL_GOLD;
  saveProgress();
  renderProgress();
  if (completed) {
    toast('🎓', 'Tutorial complete!', first ? `+${TUTORIAL_GOLD} gold. Next: build your deck, then try a Ranked battle.` : 'Nicely done.');
    Sound.play('achievement');
  }
}

// Called from onVictory: the lesson ends instead of a normal result
function tutorialFinished(winner) {
  state.winner = winner;
  state.running = false;
  state.selectedCard = null;
  Sound.play(winner === 'A' ? 'win' : 'draw');
  const won = winner === 'A';
  endTutorial(true);
  presentResult(won ? 'win' : 'draw', won ? 'VICTORY!' : 'GOOD TRY', () => {
    showCoach({
      title: won ? 'You won your first battle!' : 'Lesson complete',
      text: 'That\'s the core of the game. Next steps: 🃏 Deck to build your own deck, 🏆 Ranked to climb the Trophy Road and unlock cards, 🎪 Events for special modes, and ✦ Evolutions for upgraded cards. You can replay this from Settings.',
      final: true,
    });
  });
}

// Per frame: advance steps from the real match state
function updateTutorial(dt) {
  const t = state.tutorial;
  const m = state.match;
  if (!t || !m) return;
  const step = TUTORIAL_STEPS[t.step];
  if (!step) return;
  if (!t.entered[step.id]) {
    t.entered[step.id] = true;
    t.stepTime = 0;
    t.playsAtStep = m.players.A.cardsPlayed;
    if (step.enter) step.enter(m);
    Sound.play('select');
  }
  if (!step.hold) t.stepTime += dt;
  if (step.done && step.done(m, t)) nextTutorialStep();
  renderCoach();
}

function nextTutorialStep() {
  const t = state.tutorial;
  if (!t) return;
  t.step = Math.min(t.step + 1, TUTORIAL_STEPS.length - 1);
}

// ─── The coach bubble ───────────────────────────────────────────────────────

function ensureCoach() {
  if (tut.el && tut.el.isConnected) return tut.el;
  const el = document.createElement('div');
  el.className = 'tut-coach';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-live', 'polite');
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.tut === 'next') { nextTutorialStep(); tut.key = ''; renderCoach(); }
    if (b.dataset.tut === 'skip') { if (window.confirm('Skip the tutorial? You can replay it from Settings.')) endTutorial(false); }
    if (b.dataset.tut === 'close') hideCoach();
    if (b.dataset.tut === 'deck') { hideCoach(); showView('deck'); }
  });
  document.body.appendChild(el);
  tut.el = el;
  return el;
}

function focusTarget(name) {
  if (name === 'hand') return ui.deckA;
  if (name === 'elixir') return document.getElementById('ptStatusBottom');
  return ui.arena;
}

function clearFocus() { document.querySelectorAll('.tut-focus').forEach((e) => e.classList.remove('tut-focus')); }

function renderCoach() {
  const t = state.tutorial;
  if (!t) return;
  const step = TUTORIAL_STEPS[t.step];
  const key = `${t.step}`;
  if (key === tut.key) return;
  tut.key = key;
  showCoach({ title: step.title, text: step.text, hold: step.hold, n: t.step + 1, total: TUTORIAL_STEPS.length });
  clearFocus();
  const f = focusTarget(step.focus);
  if (f) f.classList.add('tut-focus');
}

function showCoach(o) {
  const el = ensureCoach();
  el.hidden = false;
  el.classList.toggle('final', !!o.final);
  el.innerHTML = `
    ${o.n ? `<p class="tut-step">TUTORIAL · ${o.n}/${o.total}</p>` : '<p class="tut-step">TUTORIAL</p>'}
    <h4>${escapeHtml(o.title)}</h4>
    <p>${escapeHtml(o.text)}</p>
    <div class="tut-actions">
      ${o.final ? '<button type="button" data-tut="deck">🃏 Build my deck</button><button type="button" class="btn-primary" data-tut="close">Got it</button>'
        : `<button type="button" class="tut-skip" data-tut="skip">Skip tutorial</button>${o.hold ? '<button type="button" class="btn-primary" data-tut="next">Next ›</button>' : '<span class="tut-wait">Your move…</span>'}`}
    </div>`;
  const next = el.querySelector('[data-tut="next"], [data-tut="close"]');
  if (next) next.focus({ preventScroll: true });
}

function hideCoach() {
  clearFocus();
  tut.key = '';
  if (tut.el) tut.el.hidden = true;
}

// First visit: offer the tutorial once (it never forces itself on returning players)
function maybeOfferTutorial() {
  const p = state.progress;
  if (p.tutorialDone || p.tutorialSkipped || (p.stats && p.stats.matches > 0)) return;
  const el = ensureCoach();
  el.hidden = false;
  el.classList.remove('final');
  el.innerHTML = `<p class="tut-step">NEW HERE?</p><h4>Learn to play in 2 minutes</h4>
    <p>A short guided battle covers cards, elixir, defending, spells and towers. You can skip it now and play it later from Settings.</p>
    <div class="tut-actions"><button type="button" data-tut-offer="no">Skip</button><button type="button" class="btn-primary" data-tut-offer="yes">▶ Start tutorial</button></div>`;
  el.querySelector('[data-tut-offer="yes"]').addEventListener('click', () => { hideCoach(); startTutorial(); }, { once: true });
  el.querySelector('[data-tut-offer="no"]').addEventListener('click', () => { p.tutorialSkipped = true; saveProgress(); hideCoach(); }, { once: true });
}
