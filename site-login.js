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
  const backendStateEl = document.getElementById('saBackendState');

  if (registerLink) {
    registerLink.href = `site-register.html?next=${encodeURIComponent(cfg.next)}`;
  }

  const existing = window.SiteAuth?.getSession?.();
  if (existing) {
    window.location.href = cfg.next;
    return;
  }

  const authStatus = await window.SiteAuth?.getAuthStatus?.();
  if (backendStateEl) {
    if (authStatus?.globalAuth) {
      backendStateEl.textContent = 'Global auth backend: active.';
    } else {
      backendStateEl.textContent = 'Global auth backend: not active. Password login may be unavailable on production until deployed with env vars.';
    }
  }

  const gcid = authStatus?.googleClientId;
  if (gcid) {
    const setupGoogleButton = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: gcid,
        callback: async (resp) => {
          try {
            if (!window.SiteAuth?.hasCookieConsent?.()) {
              showError('Please accept cookies first to continue.');
              window.SiteAuth?.ensureCookieBanner?.();
              return;
            }
            if (!resp?.credential) {
              showError('Google sign-in failed. Missing credential.');
              return;
            }
            await window.SiteAuth.loginWithGoogleIdToken(resp.credential);
            showInfo('Google login successful. Redirecting...');
            window.setTimeout(() => {
              window.location.href = cfg.next;
            }, 220);
          } catch (err) {
            showError(String(err?.message || 'Google sign-in failed.'));
          }
        }
      });

      const btnWrap = document.getElementById('saGoogleBtn');
      if (btnWrap) {
        window.google.accounts.id.renderButton(btnWrap, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          width: 280
        });
      }
    };

    if (window.google?.accounts?.id) {
      setupGoogleButton();
    } else {
      // GIS loads async — run setup once it's ready.
      window.onGoogleLibraryLoad = setupGoogleButton;
    }
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
      await window.SiteAuth?.ensureGlobalAuthReady?.();
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
    } catch (err) {
      showError(String(err?.message || 'Login failed. Please try again.'));
    } finally {
      submit.disabled = false;
    }
  });
}

boot();
