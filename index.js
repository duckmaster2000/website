const ACH_STORAGE_KEY = 'caleb_home_achievements_v1';
const SUGGEST_API_URL = '/api/suggestions';

// Change this passcode any time to keep edit access private.
const ACH_EDIT_PASSCODE = '1ydzpU1y!';

const el = {
  list: document.getElementById('achList'),
  input: document.getElementById('achInput'),
  addBtn: document.getElementById('achAddBtn'),
  unlockBtn: document.getElementById('achUnlockBtn'),
  status: document.getElementById('achStatus'),
  suggestName: document.getElementById('suggestName'),
  suggestEmail: document.getElementById('suggestEmail'),
  suggestTopic: document.getElementById('suggestTopic'),
  suggestText: document.getElementById('suggestText'),
  suggestSendEmail: document.getElementById('suggestSendEmail'),
  suggestAiPrep: document.getElementById('suggestAiPrep'),
  suggestStatus: document.getElementById('suggestStatus')
};

let editUnlocked = false;
let achievements = [];

function loadAchievements() {
  const raw = localStorage.getItem(ACH_STORAGE_KEY);
  if (!raw) {
    achievements = [
      { id: Date.now(), text: 'Built my personal website', done: true }
    ];
    saveAchievements();
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      achievements = parsed.filter((item) => item && typeof item.text === 'string').map((item) => ({
        id: Number.isFinite(item.id) ? item.id : Date.now() + Math.random(),
        text: item.text,
        done: Boolean(item.done)
      }));
      return;
    }
  } catch (_e) {
    // ignore bad local data and reset below
  }

  achievements = [];
  saveAchievements();
}

function saveAchievements() {
  localStorage.setItem(ACH_STORAGE_KEY, JSON.stringify(achievements));
}

function setEditState(unlocked) {
  editUnlocked = unlocked;
  if (el.input) el.input.disabled = !editUnlocked;
  if (el.addBtn) el.addBtn.disabled = !editUnlocked;

  if (el.status) {
    el.status.textContent = editUnlocked ? 'Edit mode unlocked' : 'View mode';
  }

  if (el.unlockBtn) {
    el.unlockBtn.textContent = editUnlocked ? 'Lock Edit' : 'Unlock Edit';
  }

  renderAchievements();
}

function addAchievement() {
  if (!editUnlocked || !el.input) return;

  const text = el.input.value.trim();
  if (!text) return;

  achievements.unshift({
    id: Date.now() + Math.floor(Math.random() * 1000),
    text,
    done: false
  });

  el.input.value = '';
  saveAchievements();
  renderAchievements();
}

function toggleAchievement(id) {
  if (!editUnlocked) return;
  const item = achievements.find((a) => a.id === id);
  if (!item) return;
  item.done = !item.done;
  saveAchievements();
  renderAchievements();
}

function deleteAchievement(id) {
  if (!editUnlocked) return;
  achievements = achievements.filter((a) => a.id !== id);
  saveAchievements();
  renderAchievements();
}

function renderAchievements() {
  if (!el.list) return;

  if (achievements.length === 0) {
    el.list.innerHTML = '<li class="ach-empty">No achievements yet. Unlock edit mode and add one with +</li>';
    return;
  }

  el.list.innerHTML = achievements.map((item) => `
    <li class="ach-item ${item.done ? 'done' : ''}">
      <input type="checkbox" data-ach-toggle="${item.id}" ${item.done ? 'checked' : ''} ${editUnlocked ? '' : 'disabled'} aria-label="Mark achievement complete">
      <span class="ach-text">${escapeHtml(item.text)}</span>
      <button class="ach-delete" data-ach-delete="${item.id}" type="button" ${editUnlocked ? '' : 'hidden'}>Delete</button>
    </li>
  `).join('');
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setSuggestStatus(msg, isError = false) {
  if (!el.suggestStatus) return;
  el.suggestStatus.textContent = msg;
  el.suggestStatus.style.color = isError ? '#ffd1d1' : '#d7ecff';
}

function collectSuggestion() {
  const name = (el.suggestName?.value || '').trim();
  const email = (el.suggestEmail?.value || '').trim();
  const topic = (el.suggestTopic?.value || 'Suggestion').trim();
  const text = (el.suggestText?.value || '').trim();
  return { name, email, topic, text };
}

function buildSuggestionBody(data) {
  return [
    `Topic: ${data.topic}`,
    `From: ${data.name || 'Anonymous'}`,
    `Email: ${data.email || 'Not provided'}`,
    '',
    data.text
  ].join('\n');
}

async function submitSuggestionToBackend(mode, data) {
  const response = await fetch(SUGGEST_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode,
      name: data.name,
      email: data.email,
      topic: data.topic,
      text: data.text
    })
  });

  let payload = null;
  try { payload = await response.json(); } catch (_e) {}
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || 'backend_error');
  }
  return payload;
}

async function sendSuggestionEmail() {
  const data = collectSuggestion();
  if (!data.text) {
    setSuggestStatus('Please write a suggestion first.', true);
    return;
  }

  try {
    const result = await submitSuggestionToBackend('email', data);
    setSuggestStatus(result.message || 'Suggestion sent successfully.');
    return;
  } catch (_e) {
    // Fallback to client email flow below when backend is unavailable.
  }

  const subject = encodeURIComponent(`[Website Suggestion] ${data.topic}`);
  const body = encodeURIComponent(buildSuggestionBody(data));
  window.location.href = `mailto:hicalebliu@gmail.com?subject=${subject}&body=${body}`;
  setSuggestStatus('Backend unavailable, opening your email app instead...');
}

async function prepareAiSuggestion() {
  const data = collectSuggestion();
  if (!data.text) {
    setSuggestStatus('Please write a suggestion first.', true);
    return;
  }

  try {
    const result = await submitSuggestionToBackend('ai', data);
    setSuggestStatus(result.message || 'Suggestion submitted for AI triage.');
    return;
  } catch (_e) {
    // Fallback to prompt-copy flow below.
  }

  const prompt = [
    'Please review this website suggestion and propose practical code changes:',
    '',
    buildSuggestionBody(data),
    '',
    'Return: 1) summary, 2) feasibility, 3) concrete implementation steps.'
  ].join('\n');

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(prompt);
      setSuggestStatus('AI-ready prompt copied. Paste it into your AI assistant.');
    } else {
      setSuggestStatus('Clipboard unavailable. Copy your suggestion manually.', true);
    }
  } catch (_e) {
    setSuggestStatus('Could not copy prompt. Copy your suggestion manually.', true);
  }
}

function bindEvents() {
  if (el.unlockBtn) {
    el.unlockBtn.addEventListener('click', () => {
      if (editUnlocked) {
        setEditState(false);
        return;
      }

      const attempt = window.prompt('Enter edit passcode:');
      if (attempt === ACH_EDIT_PASSCODE) {
        setEditState(true);
        if (el.input) el.input.focus();
      } else if (attempt !== null && el.status) {
        el.status.textContent = 'Wrong passcode';
      }
    });
  }

  if (el.addBtn) {
    el.addBtn.addEventListener('click', addAchievement);
  }

  if (el.input) {
    el.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') addAchievement();
    });
  }

  if (el.list) {
    el.list.addEventListener('click', (event) => {
      const deleteEl = event.target.closest('[data-ach-delete]');
      if (deleteEl) {
        deleteAchievement(Number(deleteEl.dataset.achDelete));
      }
    });
  }

  if (el.list) {
    el.list.addEventListener('change', (event) => {
      const toggleEl = event.target.closest('[data-ach-toggle]');
      if (!toggleEl) return;
      toggleAchievement(Number(toggleEl.dataset.achToggle));
    });
  }

  if (el.suggestSendEmail) {
    el.suggestSendEmail.addEventListener('click', sendSuggestionEmail);
  }

  if (el.suggestAiPrep) {
    el.suggestAiPrep.addEventListener('click', prepareAiSuggestion);
  }
}

function boot() {
  loadAchievements();
  bindEvents();
  setEditState(false);
}

boot();
