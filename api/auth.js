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

async function redisCommand(cmd) {
  const base = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  const resp = await fetch(base, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ command: cmd })
  });

  if (!resp.ok) throw new Error('redis_http_error');
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

  const payload = JSON.stringify(normalized);
  await redisCommand(['SET', keyUserId(normalized.id), payload]);
  await redisCommand(['SET', keyEmail(normalized.email), payload]);
  await redisCommand(['SET', keyUsername(normalized.usernameLower), payload]);

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

    return json(res, 400, { ok: false, error: 'unknown_action' });
  } catch (_err) {
    return json(res, 500, { ok: false, error: 'server_error' });
  }
};
