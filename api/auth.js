// Shared auth endpoint for cross-device account storage.
// Requires Upstash Redis REST env vars in deployment:
// - UPSTASH_REDIS_REST_URL
// - UPSTASH_REDIS_REST_TOKEN

function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function normalizeEmail(v) {
  return String(v || '').trim().toLowerCase();
}

function normalizeUsername(v) {
  return String(v || '').trim().toLowerCase();
}

function hasRedisConfig() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function getGoogleClientId() {
  return String(process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim().replace(/^"(.*)"$/, '$1');
}

async function redisCommand(cmd) {
  const base = String(process.env.UPSTASH_REDIS_REST_URL || '').trim().replace(/^"(.*)"$/, '$1');
  const token = String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim().replace(/^"(.*)"$/, '$1');

  const resp = await fetch(base, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(cmd)
  });

  if (!resp.ok) throw new Error(`redis_http_error_${resp.status}`);
  const data = await resp.json();
  if (data.error) throw new Error(String(data.error));
  return data.result;
}

function keyEmail(email) {
  return `siteauth:user:email:${normalizeEmail(email)}`;
}

function keyUsername(username) {
  return `siteauth:user:username:${normalizeUsername(username)}`;
}

function keyUserId(userId) {
  return `siteauth:user:id:${String(userId || '').trim()}`;
}

function randomToken(bytes = 12) {
  const alphabet = 'abcdef0123456789';
  let out = '';
  for (let i = 0; i < bytes * 2; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function getByEmail(email) {
  const raw = await redisCommand(['GET', keyEmail(email)]);
  return raw ? JSON.parse(raw) : null;
}

async function getByUsername(username) {
  const raw = await redisCommand(['GET', keyUsername(username)]);
  return raw ? JSON.parse(raw) : null;
}

async function saveUser(user) {
  const payload = JSON.stringify(user);
  await redisCommand(['SET', keyUserId(user.id), payload]);
  await redisCommand(['SET', keyEmail(user.email), payload]);
  await redisCommand(['SET', keyUsername(user.usernameLower || user.username), payload]);
}

function slugifyUsername(v) {
  const base = String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  return base || 'user';
}

async function allocateUniqueUsername(base) {
  let candidate = slugifyUsername(base);
  let attempt = 0;
  while (attempt < 50) {
    const exists = await getByUsername(candidate);
    if (!exists) return candidate;
    attempt += 1;
    candidate = `${slugifyUsername(base).slice(0, 20)}_${attempt}`;
  }
  return `user_${randomToken(4)}`;
}

async function verifyGoogleIdToken(idToken) {
  const token = String(idToken || '').trim();
  if (!token) throw new Error('missing_google_token');

  const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
  if (!resp.ok) throw new Error('invalid_google_token');
  const data = await resp.json();

  const googleClientId = getGoogleClientId();
  if (googleClientId && data.aud !== googleClientId) throw new Error('google_audience_mismatch');
  if (String(data.email_verified || '').toLowerCase() !== 'true') throw new Error('google_email_not_verified');

  return {
    sub: String(data.sub || ''),
    email: normalizeEmail(data.email || ''),
    name: String(data.name || '').trim()
  };
}

async function findOrCreateGoogleUser(idToken) {
  const profile = await verifyGoogleIdToken(idToken);
  if (!profile.email) throw new Error('google_email_missing');

  const existing = await getByEmail(profile.email);
  if (existing) {
    const updated = {
      ...existing,
      fullName: profile.name || existing.fullName || '',
      googleSub: profile.sub || existing.googleSub || null,
      authProvider: existing.authProvider || 'password',
      lastLoginAt: new Date().toISOString()
    };
    await saveUser(updated);
    return updated;
  }

  const emailLocal = profile.email.split('@')[0] || 'user';
  const usernameLower = await allocateUniqueUsername(emailLocal);
  const user = {
    id: randomToken(10),
    email: profile.email,
    username: usernameLower,
    usernameLower,
    fullName: profile.name || '',
    birthday: '',
    salt: '',
    passwordHash: '',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    authProvider: 'google',
    googleSub: profile.sub || null
  };
  await saveUser(user);
  return user;
}

async function findByLogin(login) {
  const raw = String(login || '').trim();
  if (!raw) return null;

  const byEmail = raw.includes('@');
  if (byEmail) {
    const val = await redisCommand(['GET', keyEmail(raw)]);
    return val ? JSON.parse(val) : null;
  }

  const userByUsername = await redisCommand(['GET', keyUsername(raw)]);
  if (userByUsername) return JSON.parse(userByUsername);

  const userByEmail = await redisCommand(['GET', keyEmail(raw)]);
  return userByEmail ? JSON.parse(userByEmail) : null;
}

function validateIncomingUser(user) {
  if (!user || typeof user !== 'object') return 'invalid_user';
  const required = ['id', 'email', 'username', 'usernameLower', 'salt', 'passwordHash', 'createdAt'];
  for (const k of required) {
    if (!String(user[k] || '').trim()) return `missing_${k}`;
  }
  return '';
}

async function registerUser(user) {
  const normalizedEmail = normalizeEmail(user.email);
  const normalizedUsername = normalizeUsername(user.username);

  const existingEmail = await redisCommand(['GET', keyEmail(normalizedEmail)]);
  if (existingEmail) return { ok: false, code: 'email_exists' };

  const existingUsername = await redisCommand(['GET', keyUsername(normalizedUsername)]);
  if (existingUsername) return { ok: false, code: 'username_exists' };

  const normalized = {
    ...user,
    email: normalizedEmail,
    username: String(user.username || '').trim(),
    usernameLower: normalizedUsername,
    fullName: String(user.fullName || '').trim(),
    birthday: String(user.birthday || '').trim(),
    lastLoginAt: user.lastLoginAt || null
  };

  await saveUser(normalized);

  return { ok: true, user: normalized };
}

async function touchLastLogin(userId, lastLoginAt) {
  const raw = await redisCommand(['GET', keyUserId(userId)]);
  if (!raw) return { ok: false, code: 'user_not_found' };

  const user = JSON.parse(raw);
  user.lastLoginAt = String(lastLoginAt || new Date().toISOString());
  const payload = JSON.stringify(user);

  await redisCommand(['SET', keyUserId(user.id), payload]);
  await redisCommand(['SET', keyEmail(user.email), payload]);
  await redisCommand(['SET', keyUsername(user.usernameLower || user.username), payload]);

  return { ok: true };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  if (!hasRedisConfig()) {
    return json(res, 501, { ok: false, error: 'auth_backend_not_configured' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const action = String(body.action || '').trim();

    if (action === 'status') {
      return json(res, 200, {
        ok: true,
        backend: hasRedisConfig(),
        globalAuth: hasRedisConfig(),
        googleClientId: getGoogleClientId() || ''
      });
    }

    if (action === 'findByLogin') {
      const user = await findByLogin(body.login);
      return json(res, 200, { ok: true, user: user || null });
    }

    if (action === 'registerUser') {
      const user = body.user;
      const invalid = validateIncomingUser(user);
      if (invalid) return json(res, 400, { ok: false, error: invalid });

      const result = await registerUser(user);
      if (!result.ok && result.code === 'email_exists') {
        return json(res, 409, { ok: false, error: 'email_exists' });
      }
      if (!result.ok && result.code === 'username_exists') {
        return json(res, 409, { ok: false, error: 'username_exists' });
      }
      return json(res, 200, { ok: true, user: result.user });
    }

    if (action === 'touchLastLogin') {
      const result = await touchLastLogin(body.userId, body.lastLoginAt);
      if (!result.ok) return json(res, 404, { ok: false, error: result.code });
      return json(res, 200, { ok: true });
    }

    if (action === 'googleLogin') {
      try {
        const user = await findOrCreateGoogleUser(body.idToken);
        return json(res, 200, { ok: true, user });
      } catch (err) {
        return json(res, 400, { ok: false, error: String(err?.message || 'google_login_failed') });
      }
    }

    return json(res, 400, { ok: false, error: 'unknown_action' });
  } catch (_err) {
    return json(res, 500, { ok: false, error: 'server_error' });
  }
};
