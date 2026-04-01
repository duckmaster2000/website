function parseParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    next: params.get('next') || 'index.html'
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
  const form = document.getElementById('saForm');
  const loginEl = document.getElementById('saLogin');
  const passEl = document.getElementById('saPassword');
  const registerLink = document.getElementById('saGoRegister');
  const submit = document.getElementById('saSubmit');

  if (registerLink) {
    registerLink.href = `site-register.html?next=${encodeURIComponent(cfg.next)}`;
  }

  const existing = window.SiteAuth?.getSession?.();
  if (existing) {
    window.location.href = cfg.next;
    return;
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const login = String(loginEl?.value || '').trim();
    const password = passEl?.value || '';

    if (!window.SiteAuth?.hasCookieConsent?.()) {
      showError('Please accept cookies first to continue.');
      window.SiteAuth?.ensureCookieBanner?.();
      return;
    }

    if (!login) {
      showError('Enter your email or username.');
      return;
    }
    if (!password || password.length < 6) {
      showError('Password must be at least 6 characters.');
      return;
    }

    submit.disabled = true;
    try {
      const user = await window.SiteAuth.findUserByLogin(login);
      if (!user) {
        if (login.includes('@')) {
          window.location.href = `site-register.html?next=${encodeURIComponent(cfg.next)}&email=${encodeURIComponent(login)}`;
          return;
        }
        showError('No account found. Try your email or register first.');
        return;
      }

      const ok = await window.SiteAuth.verifyPassword(user, password);
      if (!ok) {
        showError('Incorrect password.');
        return;
      }

      window.SiteAuth.createSession(user);
      showInfo('Login successful. Redirecting...');
      window.setTimeout(() => {
        window.location.href = cfg.next;
      }, 250);
    } catch (_) {
      showError('Login failed. Please try again.');
    } finally {
      submit.disabled = false;
    }
  });
}

boot();
