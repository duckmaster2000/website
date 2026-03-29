function parseParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    next: params.get('next') || 'index.html',
    email: params.get('email') || ''
  };
}

function showError(msg) {
  const err = document.getElementById('saError');
  const info = document.getElementById('saInfo');
  if (info) info.hidden = true;
  if (err) {
    err.textContent = msg;
    err.hidden = false;
  }
}

function showInfo(msg) {
  const err = document.getElementById('saError');
  const info = document.getElementById('saInfo');
  if (err) err.hidden = true;
  if (info) {
    info.textContent = msg;
    info.hidden = false;
  }
}

async function boot() {
  const cfg = parseParams();
  const fullNameEl = document.getElementById('saFullName');
  const birthdayEl = document.getElementById('saBirthday');
  const usernameEl = document.getElementById('saUsername');
  const emailEl = document.getElementById('saEmail');
  const passEl = document.getElementById('saPassword');
  const pass2El = document.getElementById('saPassword2');
  const form = document.getElementById('saForm');
  const submit = document.getElementById('saSubmit');
  const loginLink = document.getElementById('saGoLogin');

  if (cfg.email && emailEl) emailEl.value = cfg.email;
  if (loginLink) loginLink.href = `site-login.html?next=${encodeURIComponent(cfg.next)}`;

  const existing = window.SiteAuth?.getSession?.();
  if (existing) {
    window.location.href = cfg.next;
    return;
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const fullName = String(fullNameEl?.value || '').trim();
    const birthday = String(birthdayEl?.value || '').trim();
    const username = String(usernameEl?.value || '').trim();
    const email = String(emailEl?.value || '').trim();
    const password = passEl?.value || '';
    const password2 = pass2El?.value || '';

    if (!window.SiteAuth?.hasCookieConsent?.()) {
      showError('Please accept cookies first to continue.');
      window.SiteAuth?.ensureCookieBanner?.();
      return;
    }

    if (!fullName) return showError('Please enter your full name.');
    if (!birthday) return showError('Please enter your birthday.');
    if (!username || username.length < 3) return showError('Username must be at least 3 characters.');
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return showError('Enter a valid email address.');
    if (!password || password.length < 6) return showError('Password must be at least 6 characters.');
    if (password !== password2) return showError('Passwords do not match.');

    submit.disabled = true;
    try {
      const user = await window.SiteAuth.registerUser({ email, username, fullName, birthday, password });
      window.SiteAuth.createSession(user);
      showInfo('Registration complete. Redirecting...');
      window.setTimeout(() => {
        window.location.href = cfg.next;
      }, 280);
    } catch (err) {
      const msg = String(err?.message || '');
      if (msg.includes('Email already registered')) {
        showError('That email is already registered. Please log in.');
      } else if (msg.includes('Username already taken')) {
        showError('That username is taken. Please choose another one.');
      } else {
        showError('Registration failed. Please try again.');
      }
    } finally {
      submit.disabled = false;
    }
  });
}

boot();
