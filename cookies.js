function getCookieValue(name) {
  const pairs = document.cookie ? document.cookie.split(';') : [];
  for (const pairRaw of pairs) {
    const pair = pairRaw.trim();
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = eq >= 0 ? pair.slice(0, eq) : pair;
    const val = eq >= 0 ? pair.slice(eq + 1) : '';
    if (key === name) return decodeURIComponent(val);
  }
  return '';
}

function boolText(v) {
  return v ? 'Used on this site' : 'Not currently used on this site';
}

function li(text, used) {
  return `<li><strong>${text}</strong>: ${boolText(used)}</li>`;
}

function render() {
  const must = document.getElementById('cookieMustList');
  const should = document.getElementById('cookieShouldList');
  const may = document.getElementById('cookieMayList');
  const raw = document.getElementById('cookieRaw');
  const storage = document.getElementById('cookieStorage');

  const consentCookie = getCookieValue('site_cookie_consent') === 'accepted';
  const consentLocal = localStorage.getItem('site_cookie_consent_v1') === 'accepted';
  const sessionLocal = !!localStorage.getItem('site_session_v1');

  if (must) {
    must.innerHTML = [
      li('Session ID / session token (site_session_v1 local storage)', sessionLocal),
      li('Security (CSRF) cookie', false),
      li('Shopping cart cookie', false),
      li('Cookie consent status (site_cookie_consent and site_cookie_consent_v1)', consentCookie || consentLocal)
    ].join('');
  }

  if (should) {
    should.innerHTML = [
      li('Google Analytics or similar', false),
      li('Load balancing cookie', false),
      li('Error tracking cookie', false)
    ].join('');
  }

  const hasTheme = !!localStorage.getItem('site_theme_preference');
  const hasLang = !!localStorage.getItem('site_language_preference');
  const hasPrefs = !!localStorage.getItem('caleb_home_achievements_v1') || !!localStorage.getItem('caleb_citations_page_v1');

  if (may) {
    may.innerHTML = [
      li('Language/region preference', hasLang),
      li('Theme preference', hasTheme),
      li('Saved user preferences (local storage)', hasPrefs)
    ].join('');
  }

  if (raw) {
    raw.textContent = document.cookie ? document.cookie : 'No browser cookies currently set.';
  }

  if (storage) {
    const keys = Object.keys(localStorage).sort();
    storage.textContent = keys.length ? keys.join(', ') : 'No local storage keys found.';
  }
}

render();
