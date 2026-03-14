const realQuotes = [
  "When life gives you lemmas, make lemmanade.",
  "When life gives you lemons, squeeze them in someone's eyes.",
  "Koala bears are not actually bears, strawberries are not berries, avocados are berries, bananas are berries, and raspberries are not.",
  "If fungus becomes fungi and cactus becomes cacti, should the plural of us be I?",
  "Did you know if you remove any one letter from seat, you still get a valid word?",
  "What is a monarchy? A butterfly thingy.",
  "The absolute value of 0 is lol.",
  "An apple a day can keep anyone away if you throw it hard enough.",
  "I will add more later. Email me if you have ideas."
];

const fakeQuotes = [
  "If homework had a snooze button, civilization would collapse by Tuesday.",
  "My keyboard knows all my secrets and still refuses to type my essay.",
  "I asked gravity for space, and it pulled me right back into math.",
  "The quickest way to become organized is to lose everything at once.",
  "A true warrior charges their phone before charging into battle.",
  "If time is money, naps are profitable investments.",
  "Every legend started as a person who forgot their password."
];

const els = {
  quoteList: document.getElementById('quoteList'),
  gameQuote: document.getElementById('gameQuote'),
  score: document.getElementById('scoreValue'),
  streak: document.getElementById('streakValue'),
  feedback: document.getElementById('feedback'),
  start: document.getElementById('startBtn'),
  real: document.getElementById('realBtn'),
  fake: document.getElementById('fakeBtn')
};

const state = {
  score: 0,
  streak: 0,
  currentIsReal: null,
  started: false
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function renderQuoteList() {
  const items = realQuotes.map((quote) => `<li>\"${quote}\"</li>`).join('');
  els.quoteList.innerHTML = items;
}

function nextRound() {
  const showReal = Math.random() < 0.5;
  state.currentIsReal = showReal;
  els.gameQuote.textContent = showReal ? pickRandom(realQuotes) : pickRandom(fakeQuotes);
}

function updateStats() {
  els.score.textContent = state.score;
  els.streak.textContent = state.streak;
}

function setFeedback(text, isGood) {
  els.feedback.textContent = text;
  els.feedback.classList.remove('good', 'bad');
  els.feedback.classList.add(isGood ? 'good' : 'bad');
}

function submitGuess(userThinksReal) {
  if (!state.started || state.currentIsReal === null) {
    return;
  }

  const correct = userThinksReal === state.currentIsReal;

  if (correct) {
    state.score += 1;
    state.streak += 1;
    setFeedback('Correct. Reactor stable.', true);
  } else {
    state.streak = 0;
    setFeedback('Not quite. Reactor got noisy.', false);
  }

  updateStats();
  nextRound();
}

function startGame() {
  state.started = true;
  state.score = 0;
  state.streak = 0;
  updateStats();
  nextRound();
  setFeedback('Game started. Identify each quote.', true);

  els.real.disabled = false;
  els.fake.disabled = false;
}

els.start.addEventListener('click', startGame);
els.real.addEventListener('click', () => submitGuess(true));
els.fake.addEventListener('click', () => submitGuess(false));

renderQuoteList();
