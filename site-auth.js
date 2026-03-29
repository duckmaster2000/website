const SiteAuth = (() => {
  const SITE_USERS_KEY = 'site_users_v1';
  const SITE_SESSION_KEY = 'site_session_v1';
  const COOKIE_CONSENT_KEY = 'site_cookie_consent_v1';
  const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
  const PUBLIC_PAGES = new Set(['site-login.html', 'site-register.html']);

    function pageName() {
      const p = window.location.pathname.split('/').pop();
      return p || 'index.html';
    }

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function normalizeUsername(username) {
    return String(username || '').trim().toLowerCase();
  }

  function getDb() {
    try {
      const raw = localStorage.getItem(SITE_USERS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && Array.isArray(parsed.users)) return parsed;
    } catch (_) {}
    return { users: [] };
  }

  function setDb(db) {
    localStorage.setItem(SITE_USERS_KEY, JSON.stringify(db));
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

  function findUserByEmail(email) {
    const e = normalizeEmail(email);
    if (!e) return null;
    return getDb().users.find((u) => normalizeEmail(u.email) === e) || null;
  }

  function findUserByUsername(username) {
    const un = normalizeUsername(username);
    if (!un) return null;
    return getDb().users.find((u) => normalizeUsername(u.username) === un) || null;
  }

  function findUserByLogin(login) {
    const raw = String(login || '').trim();
    if (!raw) return null;
    if (raw.includes('@')) return findUserByEmail(raw);
    return findUserByUsername(raw) || findUserByEmail(raw);
  }

  async function registerUser({ email, username, fullName, birthday, password }) {
    const normalizedEmail = normalizeEmail(email);
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedEmail || !normalizedUsername) throw new Error('Missing email or username');

    const db = getDb();
    if (db.users.some((u) => normalizeEmail(u.email) === normalizedEmail)) {
      throw new Error('Email already registered');
    }
    if (db.users.some((u) => normalizeUsername(u.username) === normalizedUsername)) {
      throw new Error('Username already taken');
    }

    const salt = generateSaltBase64();
    const passwordHash = await hashPassword(password, salt);
    const user = {
      id: randomToken(10),
      email: normalizedEmail,
      username: String(username || '').trim(),
      usernameLower: normalizedUsername,
      fullName: String(fullName || '').trim(),
      birthday: String(birthday || '').trim(),
      salt,
      passwordHash,
      createdAt: new Date().toISOString(),
      lastLoginAt: null
    };

    db.users.push(user);
    setDb(db);
    return user;
  }

  async function verifyPassword(user, password) {
    if (!user || !user.salt || !user.passwordHash) return false;
    const hash = await hashPassword(password, user.salt);
    return hash === user.passwordHash;
  }

  function createSession(user) {
    const session = {
      userId: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      birthday: user.birthday,
      sessionToken: randomToken(24),
      loginAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString()
    };
    localStorage.setItem(SITE_SESSION_KEY, JSON.stringify(session));

    const db = getDb();
    const idx = db.users.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      db.users[idx] = { ...db.users[idx], lastLoginAt: new Date().toISOString() };
      setDb(db);
    }
    return session;
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(SITE_SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session || typeof session.userId !== 'string' || typeof session.expiresAt !== 'string') {
        localStorage.removeItem(SITE_SESSION_KEY);
        return null;
      }
      const exp = Date.parse(session.expiresAt);
      if (!Number.isFinite(exp) || exp <= Date.now()) {
        localStorage.removeItem(SITE_SESSION_KEY);
        return null;
      }
      return session;
    } catch (_) {
      localStorage.removeItem(SITE_SESSION_KEY);
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(SITE_SESSION_KEY);
    localStorage.removeItem('tk_auth_v1');
    localStorage.removeItem('tk_ls_auth_v1');
  }

  function hasCookieConsent() {
    return localStorage.getItem(COOKIE_CONSENT_KEY) === 'accepted';
  }

  function setCookieConsentAccepted() {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    const banner = document.getElementById('siteCookieBanner');
    if (banner) banner.remove();
  }

  function ensureCookieBanner() {
    if (hasCookieConsent()) return;
    if (document.getElementById('siteCookieBanner')) return;

    const banner = document.createElement('div');
    banner.id = 'siteCookieBanner';
    banner.style.position = 'fixed';
    banner.style.left = '16px';
    banner.style.right = '16px';
    banner.style.bottom = '16px';
    banner.style.zIndex = '99999';
    banner.style.background = 'rgba(8,22,45,0.96)';
    banner.style.border = '1px solid rgba(113,196,255,0.45)';
    banner.style.borderRadius = '12px';
    banner.style.padding = '10px 12px';
    banner.style.color = '#dff1ff';
    banner.style.display = 'flex';
    banner.style.flexWrap = 'wrap';
    banner.style.alignItems = 'center';
    banner.style.gap = '10px';
    banner.innerHTML = '<span style="font-size:13px;line-height:1.35;flex:1;min-width:240px">This site uses cookies/local storage for login sessions and saved preferences. You must accept to continue.</span>';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Accept Cookies';
    btn.style.border = '1px solid rgba(117,225,255,0.62)';
    btn.style.background = 'linear-gradient(180deg, rgba(31,72,116,0.95), rgba(18,48,80,0.92))';
    btn.style.color = '#e7f4ff';
    btn.style.borderRadius = '8px';
    btn.style.padding = '8px 10px';
    btn.style.cursor = 'pointer';
    btn.style.fontWeight = '700';
    btn.addEventListener('click', setCookieConsentAccepted);
    banner.appendChild(btn);

    document.body.appendChild(banner);
  }

  function logout(redirect = true) {
    clearSession();
    if (redirect) {
      window.location.href = 'site-login.html';
    }
  }

  function redirectToLogin() {
    const next = `${window.location.pathname.split('/').pop() || 'index.html'}${window.location.search || ''}`;
    window.location.href = `site-login.html?next=${encodeURIComponent(next)}`;
  }

  function mountAuthWidget() {
    const session = getSession();
    if (!session || PUBLIC_PAGES.has(pageName())) return;
    if (document.getElementById('siteAuthWidget')) return;

    const wrap = document.createElement('div');
    wrap.id = 'siteAuthWidget';
    wrap.style.position = 'fixed';
    wrap.style.right = '12px';
    wrap.style.top = '12px';
    wrap.style.zIndex = '99998';
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '8px';
    wrap.style.background = 'rgba(8,22,45,0.88)';
    wrap.style.border = '1px solid rgba(113,196,255,0.4)';
    wrap.style.borderRadius = '999px';
    wrap.style.padding = '6px 8px';

    const who = document.createElement('span');
    who.textContent = session.username || session.email;
    who.style.fontSize = '12px';
    who.style.color = '#dff1ff';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Logout';
    btn.style.border = '1px solid rgba(117,225,255,0.62)';
    btn.style.background = 'rgba(18,48,80,0.9)';
    btn.style.color = '#e7f4ff';
    btn.style.borderRadius = '999px';
    btn.style.padding = '4px 8px';
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', () => logout(true));

    wrap.appendChild(who);
    wrap.appendChild(btn);
    document.body.appendChild(wrap);
  }

  function requireAuth() {
    if (PUBLIC_PAGES.has(pageName())) return true;
    if (!hasCookieConsent()) {
      redirectToLogin();
      return false;
    }
    const session = getSession();
    if (!session) {
      redirectToLogin();
      return false;
    }
    return true;
  }

  function bootGuard() {
    ensureCookieBanner();
    if (!requireAuth()) return;
    mountAuthWidget();
  }

  return {
    pageName,
    normalizeEmail,
    normalizeUsername,
    getDb,
    setDb,
    findUserByLogin,
    findUserByEmail,
    findUserByUsername,
    registerUser,
    verifyPassword,
    createSession,
    getSession,
    clearSession,
    logout,
    hasCookieConsent,
    setCookieConsentAccepted,
    ensureCookieBanner,
    requireAuth,
    mountAuthWidget,
    bootGuard
  };
})();

window.SiteAuth = SiteAuth;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => SiteAuth.bootGuard());
} else {
  SiteAuth.bootGuard();
}
