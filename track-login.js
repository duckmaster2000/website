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
const USER_DB_KEY = 'tk_users_v1';
const VERIFY_TTL_MS = 10 * 60 * 1000;
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

function normalizeEmail(email) {
  return normalizeSpaces(email).toLowerCase();
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

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function randomToken(bytes = 24) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(base64) {
  return Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
}

function generateSaltBase64() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes);
}

async function hashPassword(password, saltBase64) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: base64ToBytes(saltBase64), iterations: 120000 },
    key,
    256
  );
  return bytesToBase64(new Uint8Array(bits));
}

function getUserDb() {
  try {
    const raw = localStorage.getItem(USER_DB_KEY);
    return raw ? (JSON.parse(raw) || {}) : {};
  } catch (_) {
    return {};
  }
}

function setUserDb(db) {
  localStorage.setItem(USER_DB_KEY, JSON.stringify(db));
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

function createSession(config, user) {
  const session = {
    email: user.email,
    name: user.name,
    gender: user.gender,
    username: user.username,
    target: config.target,
    mode: config === TARGET_CONFIG.ls ? 'ls' : 'ms',
    sessionToken: randomToken(24),
    loginAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString()
  };
  localStorage.setItem(config.authKey, JSON.stringify(session));
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
  const verifyWrap = document.getElementById('tkVerifyWrap');
  const codeEl = document.getElementById('tkLoginCode');
  const submitEl = document.getElementById('tkLoginSubmit');

  titleEl.textContent = config.title;
  subEl.textContent = config.subtitle;

  let knownNames = null;
  let pendingRegistration = null;

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
    submitEl.textContent = 'Log In / Register';
  } catch (_) {
    showError('Unable to load athlete roster right now. Refresh and try again.');
    nameEl.innerHTML = '<option value="">Unable to load names</option>';
    submitEl.disabled = true;
    submitEl.textContent = 'Log In / Register';
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = normalizeEmail(emailEl.value);
    const password = passEl.value;
    const selectedName = nameEl.value ? decodeURIComponent(nameEl.value) : '';
    const selectedGender = genderEl.value;
    const code = normalizeSpaces(codeEl?.value || '');

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      showError('Enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      showError('Password must be at least 6 characters.');
      return;
    }

    if (pendingRegistration && pendingRegistration.email !== email) {
      pendingRegistration = null;
      verifyWrap.hidden = true;
      if (codeEl) codeEl.value = '';
      submitEl.textContent = 'Log In / Register';
    }

    submitEl.disabled = true;

    try {
      const db = getUserDb();
      const user = db[email];

      if (user) {
        if (!selectedName || normalizeAthleteKey(selectedName) !== normalizeAthleteKey(user.name)) {
          showError('For login, choose the same name used when registering this email.');
          return;
        }
        const hashed = await hashPassword(password, user.salt);
        if (hashed !== user.passwordHash) {
          showError('Incorrect password for this email.');
          return;
        }
        const updated = {
          ...user,
          name: selectedName,
          gender: selectedGender === 'female' || selectedGender === 'male' ? selectedGender : user.gender,
          username: user.username || generateUsername(titleCaseName(user.name)),
          lastLoginAt: new Date().toISOString()
        };
        db[email] = updated;
        setUserDb(db);
        saveGenderOverride(updated.name, updated.gender);
        createSession(config, updated);
        showInfo(`Welcome back ${updated.name}. Redirecting...`);
        window.setTimeout(() => {
          window.location.href = `${config.target}?athlete=${encodeURIComponent(updated.name)}`;
        }, 350);
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

      const normalizedLookup = normalizeAthleteKey(selectedName);
      const canonicalName = knownNames.get(normalizedLookup);
      if (!canonicalName) {
        showError('Selected name is not available in the timing sheets.');
        return;
      }

      if (!pendingRegistration) {
        const salt = generateSaltBase64();
        const passwordHash = await hashPassword(password, salt);
        const verificationCode = generateCode();
        pendingRegistration = {
          email,
          name: canonicalName,
          gender: selectedGender,
          salt,
          passwordHash,
          verificationCode,
          expiresAt: Date.now() + VERIFY_TTL_MS
        };
        verifyWrap.hidden = false;
        submitEl.textContent = 'Verify & Create Account';
        showInfo(`Verification code sent to ${email}. Enter it below to finish registration. Dev code: ${verificationCode}`);
        return;
      }

      if (Date.now() > pendingRegistration.expiresAt) {
        pendingRegistration = null;
        verifyWrap.hidden = true;
        if (codeEl) codeEl.value = '';
        submitEl.textContent = 'Log In / Register';
        showError('Verification code expired. Submit again to get a new code.');
        return;
      }

      if (!/^\d{6}$/.test(code) || code !== pendingRegistration.verificationCode) {
        showError('Invalid verification code. Check the code and try again.');
        return;
      }

      const createdUser = {
        email: pendingRegistration.email,
        name: pendingRegistration.name,
        gender: pendingRegistration.gender,
        salt: pendingRegistration.salt,
        passwordHash: pendingRegistration.passwordHash,
        username: generateUsername(titleCaseName(pendingRegistration.name)),
        createdAt: new Date().toISOString(),
        verifiedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };
      db[email] = createdUser;
      setUserDb(db);
      saveGenderOverride(createdUser.name, createdUser.gender);
      createSession(config, createdUser);
      pendingRegistration = null;
      verifyWrap.hidden = true;
      if (codeEl) codeEl.value = '';
      submitEl.textContent = 'Log In / Register';

      showInfo(`Account created for ${createdUser.name}. Redirecting...`);
      window.setTimeout(() => {
        window.location.href = `${config.target}?athlete=${encodeURIComponent(createdUser.name)}`;
      }, 350);
    } catch (_err) {
      showError('Unable to complete auth right now. Please try again.');
    } finally {
      submitEl.disabled = false;
    }
  });
}

boot();
