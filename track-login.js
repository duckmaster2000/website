const TARGET_CONFIG = {
  ms: {
    target: 'track.html',
    authKey: 'tk_auth_v1',
    title: 'Harker MS Track Athlete Selection',
    subtitle: 'Choose your name and gender to open your personalized middle school dashboard.',
    spreadsheetId: '1otSAiM7Y8u5l0_ZxjA9snO2VV2XYGOOwWCAWFq-epR4',
    sheets: ['50 M', '100 M', '200 M', '400 M', '800 M', '1200 M (7th and 8th ONLY)']
  },
  ls: {
    target: 'track-ls.html',
    authKey: 'tk_ls_auth_v1',
    title: 'Harker Lower School Track Athlete Selection',
    subtitle: 'Choose your name and gender to open your personalized lower school dashboard.',
    spreadsheetId: '1nbdgawiSOXC5fw18NYjsA4W_h0E0vNibUTQ4A4aSchg',
    sheets: ['50 M', '100 M', '200 M', '400 M', '800 M', '1200 M (4th and 5th ONLY)']
  }
};

const GENDER_OVERRIDES_KEY = 'tk_gender_overrides_v1';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function parseParams() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  const target = params.get('target');
  if (mode && TARGET_CONFIG[mode]) return TARGET_CONFIG[mode];
  if (target === 'track-ls.html') return TARGET_CONFIG.ls;
  return TARGET_CONFIG.ms;
}

function gvizUrl(spreadsheetId, sheetName) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
}

function parseGvizJson(raw) {
  const txt = raw.trim();
  const start = txt.indexOf('{');
  const end = txt.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) throw new Error('Unable to parse sheet response');
  return JSON.parse(txt.slice(start, end + 1));
}

function normalizeSpaces(v) {
  return String(v || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAthleteKey(name) {
  return normalizeSpaces(String(name || '')).toLowerCase();
}

function randomToken(bytes = 24) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function fetchAthleteNames(config) {
  const allNames = new Map();
  await Promise.all(config.sheets.map(async (sheetName) => {
    const response = await fetch(gvizUrl(config.spreadsheetId, sheetName));
    if (!response.ok) return;
    const text = await response.text();
    const json = parseGvizJson(text);
    const cols = (json.table?.cols || []).map((c) => c.label || '');
    const rows = json.table?.rows || [];
    const firstIdx = cols.findIndex((c) => c.toLowerCase() === 'first name');
    const lastIdx = cols.findIndex((c) => c.toLowerCase() === 'last name');
    if (firstIdx < 0 || lastIdx < 0) return;
    rows.forEach((row) => {
      const first = row.c?.[firstIdx]?.v ? String(row.c[firstIdx].v).trim() : '';
      const last = row.c?.[lastIdx]?.v ? String(row.c[lastIdx].v).trim() : '';
      if (!first || !last) return;
      const full = normalizeSpaces(`${first} ${last}`);
      allNames.set(normalizeAthleteKey(full), full);
    });
  }));
  return allNames;
}

function showError(msg) {
  const err = document.getElementById('tkLoginError');
  const info = document.getElementById('tkLoginInfo');
  info.hidden = true;
  err.textContent = msg;
  err.hidden = false;
}

function showInfo(msg) {
  const err = document.getElementById('tkLoginError');
  const info = document.getElementById('tkLoginInfo');
  err.hidden = true;
  info.textContent = msg;
  info.hidden = false;
}

function saveGenderOverride(name, gender) {
  const key = normalizeAthleteKey(name);
  if (!key || !gender) return;
  let map = {};
  try {
    const raw = localStorage.getItem(GENDER_OVERRIDES_KEY);
    if (raw) map = JSON.parse(raw) || {};
  } catch (_) {
    map = {};
  }
  map[key] = gender;
  localStorage.setItem(GENDER_OVERRIDES_KEY, JSON.stringify(map));
}

function createTrackSession(config, accountSession, athleteName, gender, options = {}) {
  const trackSession = {
    email: accountSession.email,
    username: accountSession.username,
    fullName: accountSession.fullName,
    birthday: accountSession.birthday,
    name: athleteName || '',
    gender: gender || 'unknown',
    anonymousTrack: !!options.anonymousTrack,
    target: config.target,
    mode: config === TARGET_CONFIG.ls ? 'ls' : 'ms',
    sessionToken: randomToken(24),
    loginAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString()
  };
  localStorage.setItem(config.authKey, JSON.stringify(trackSession));
}

function currentPageWithQuery() {
  const page = window.location.pathname.split('/').pop() || 'track-login.html';
  return `${page}${window.location.search || ''}`;
}

async function boot() {
  const accountSession = window.SiteAuth?.getSession?.();
  if (!accountSession) {
    window.location.href = `site-login.html?next=${encodeURIComponent(currentPageWithQuery())}`;
    return;
  }

  const config = parseParams();
  const titleEl = document.getElementById('tkLoginTitle');
  const subEl = document.getElementById('tkLoginSub');
  const form = document.getElementById('tkLoginForm');
  const nameEl = document.getElementById('tkLoginName');
  const genderEl = document.getElementById('tkLoginGender');
  const submitEl = document.getElementById('tkLoginSubmit');
  const anonModeEl = document.getElementById('tkAnonMode');

  titleEl.textContent = config.title;
  subEl.textContent = config.subtitle;

  let knownNames = null;

  const updateAnonModeUi = () => {
    const anonOn = !!anonModeEl?.checked;
    nameEl.disabled = anonOn;
    genderEl.disabled = anonOn;
    submitEl.textContent = anonOn ? 'Continue Anonymously' : 'Continue To Dashboard';
  };

  const continueAnonymous = () => {
    createTrackSession(config, accountSession, '', 'unknown', { anonymousTrack: true });
    showInfo('Continuing anonymously. Redirecting...');
    window.setTimeout(() => {
      window.location.href = config.target;
    }, 220);
  };

  anonModeEl?.addEventListener('change', updateAnonModeUi);
  updateAnonModeUi();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (anonModeEl?.checked) {
      try {
        continueAnonymous();
      } catch (_) {
        showError('Unable to continue anonymously right now. Please try again.');
      }
      return;
    }

    const selectedName = nameEl.value ? decodeURIComponent(nameEl.value) : '';
    const selectedGender = genderEl.value;

    if (!selectedName) {
      showError('Please select your name from the roster list, or choose anonymous mode.');
      return;
    }
    if (selectedGender !== 'female' && selectedGender !== 'male') {
      showError('Please choose your gender.');
      return;
    }
    if (!knownNames || !knownNames.size) {
      showError('Roster is unavailable right now. Please try again later or continue anonymously.');
      return;
    }

    submitEl.disabled = true;
    try {
      const canonicalName = knownNames.get(normalizeAthleteKey(selectedName));
      if (!canonicalName) {
        showError('Selected name is not available in the timing sheets.');
        return;
      }

      saveGenderOverride(canonicalName, selectedGender);
      createTrackSession(config, accountSession, canonicalName, selectedGender);
      showInfo(`Profile linked for ${canonicalName}. Redirecting...`);
      window.setTimeout(() => {
        window.location.href = `${config.target}?athlete=${encodeURIComponent(canonicalName)}`;
      }, 280);
    } catch (_) {
      showError('Unable to continue right now. Please try again.');
    } finally {
      submitEl.disabled = false;
      updateAnonModeUi();
    }
  });

  submitEl.disabled = true;
  submitEl.textContent = 'Loading names...';
  try {
    knownNames = await fetchAthleteNames(config);
    const sortedNames = [...knownNames.values()].sort((a, b) => a.localeCompare(b));
    if (!sortedNames.length) {
      showError('No athlete names were found yet. You can still continue anonymously.');
      nameEl.innerHTML = '<option value="">No names found</option>';
      submitEl.disabled = false;
      updateAnonModeUi();
      return;
    }
    nameEl.innerHTML = ['<option value="">Select your name...</option>']
      .concat(sortedNames.map((name) => `<option value="${encodeURIComponent(name)}">${name}</option>`))
      .join('');
    submitEl.disabled = false;
    updateAnonModeUi();
  } catch (_) {
    showError('Unable to load athlete roster right now. You can still continue anonymously.');
    nameEl.innerHTML = '<option value="">Unable to load names</option>';
    submitEl.disabled = false;
    updateAnonModeUi();
  }
}

boot();
