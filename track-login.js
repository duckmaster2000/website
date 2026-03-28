const TARGET_CONFIG = {
  ms: {
    target: 'track.html',
    authKey: 'tk_auth_v1',
    title: 'Harker MS Track Login',
    subtitle: 'Log in to open your personalized middle school track dashboard.',
    spreadsheetId: '1otSAiM7Y8u5l0_ZxjA9snO2VV2XYGOOwWCAWFq-epR4',
    sheets: ['50 M', '100 M', '200 M', '400 M', '800 M', '1200 M (7th and 8th ONLY)']
  },
  ls: {
    target: 'track-ls.html',
    authKey: 'tk_ls_auth_v1',
    title: 'Harker Lower School Track Login',
    subtitle: 'Log in to open your personalized lower school track dashboard.',
    spreadsheetId: '1nbdgawiSOXC5fw18NYjsA4W_h0E0vNibUTQ4A4aSchg',
    sheets: ['50 M', '100 M', '200 M', '400 M', '800 M', '1200 M (4th and 5th ONLY)']
  }
};
const GENDER_OVERRIDES_KEY = 'tk_gender_overrides_v1';

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
  return v.replace(/\s+/g, ' ').trim();
}

function normalizeAthleteKey(name) {
  return normalizeSpaces(String(name || '')).toLowerCase();
}

function titleCaseName(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function generateUsername(fullName) {
  const compact = fullName.toLowerCase().replace(/[^a-z]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const suffix = String(Math.floor(Math.random() * 900 + 100));
  return `${compact}_${suffix}`;
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
      allNames.set(full.toLowerCase(), full);
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

async function boot() {
  const config = parseParams();
  const titleEl = document.getElementById('tkLoginTitle');
  const subEl = document.getElementById('tkLoginSub');
  const form = document.getElementById('tkLoginForm');
  const emailEl = document.getElementById('tkLoginEmail');
  const passEl = document.getElementById('tkLoginPassword');
  const nameEl = document.getElementById('tkLoginName');
  const genderEl = document.getElementById('tkLoginGender');
  const submitEl = document.getElementById('tkLoginSubmit');

  titleEl.textContent = config.title;
  subEl.textContent = config.subtitle;

  let knownNames = null;

  submitEl.disabled = true;
  submitEl.textContent = 'Loading names...';
  try {
    knownNames = await fetchAthleteNames(config);
    const sortedNames = [...knownNames.values()].sort((a, b) => a.localeCompare(b));
    if (!sortedNames.length) {
      showError('No athlete names were found yet. Try again later.');
      nameEl.innerHTML = '<option value="">No names found</option>';
      return;
    }
    nameEl.innerHTML = ['<option value="">Select your name...</option>']
      .concat(sortedNames.map((name) => `<option value="${encodeURIComponent(name)}">${name}</option>`))
      .join('');
    submitEl.disabled = false;
    submitEl.textContent = 'Log In';
  } catch (_) {
    showError('Unable to load athlete roster right now. Refresh and try again.');
    nameEl.innerHTML = '<option value="">Unable to load names</option>';
    submitEl.disabled = true;
    submitEl.textContent = 'Log In';
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = normalizeSpaces(emailEl.value);
    const password = passEl.value;
    const selectedName = nameEl.value ? decodeURIComponent(nameEl.value) : '';
    const selectedGender = genderEl.value;

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      showError('Enter a valid email address.');
      return;
    }
    if (!password || password.length < 4) {
      showError('Password must be at least 4 characters.');
      return;
    }
    if (!selectedName) {
      showError('Please select your name from the roster list.');
      return;
    }
    if (selectedGender !== 'female' && selectedGender !== 'male') {
      showError('Please choose your gender.');
      return;
    }

    submitEl.disabled = true;
    submitEl.textContent = 'Checking records...';

    try {
      const normalizedLookup = selectedName.toLowerCase();
      const canonicalName = knownNames.get(normalizedLookup) || selectedName;
      if (!canonicalName) {
        showError('Selected name is not available in the timing sheets.');
        return;
      }

      const username = generateUsername(titleCaseName(canonicalName));
      const auth = {
        email,
        password,
        name: canonicalName,
        gender: selectedGender,
        username,
        target: config.target,
        mode: config === TARGET_CONFIG.ls ? 'ls' : 'ms',
        loginAt: new Date().toISOString()
      };
      saveGenderOverride(canonicalName, selectedGender);
      localStorage.setItem(config.authKey, JSON.stringify(auth));
      showInfo(`Welcome ${canonicalName}. Username created: ${username}. Redirecting...`);
      window.setTimeout(() => {
        window.location.href = `${config.target}?athlete=${encodeURIComponent(canonicalName)}`;
      }, 450);
    } catch (err) {
      showError('Unable to verify your name right now. Please try again in a moment.');
    } finally {
      submitEl.disabled = false;
      submitEl.textContent = 'Log In';
    }
  });
}

boot();
