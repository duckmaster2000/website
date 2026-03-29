const CT_STORAGE_KEY = 'caleb_citations_page_v1';

// Change this passcode any time to keep edit access private.
const CT_EDIT_PASSCODE = '1ydzpU1y!';

const el = {
  unlockBtn: document.getElementById('ctUnlockBtn'),
  status: document.getElementById('ctStatus'),

  citationInput: document.getElementById('ctCitationInput'),
  citationAddBtn: document.getElementById('ctCitationAddBtn'),
  citationList: document.getElementById('ctCitationList'),

  thanksInput: document.getElementById('ctThanksInput'),
  thanksAddBtn: document.getElementById('ctThanksAddBtn'),
  thanksList: document.getElementById('ctThanksList')
};

let editUnlocked = false;
let state = {
  citations: [],
  thanks: []
};

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function loadState() {
  const raw = localStorage.getItem(CT_STORAGE_KEY);
  if (!raw) {
    state = {
      citations: [
        { id: Date.now(), text: 'Example: xkcd - https://xkcd.com', done: false }
      ],
      thanks: [
        { id: Date.now() + 1, text: 'Example: Thanks to my teacher for feedback', done: false }
      ]
    };
    saveState();
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    const citations = Array.isArray(parsed?.citations) ? parsed.citations : [];
    const thanks = Array.isArray(parsed?.thanks) ? parsed.thanks : [];
    state = {
      citations: sanitizeItems(citations),
      thanks: sanitizeItems(thanks)
    };
  } catch (_) {
    state = { citations: [], thanks: [] };
    saveState();
  }
}

function sanitizeItems(items) {
  return items
    .filter((item) => item && typeof item.text === 'string')
    .map((item) => ({
      id: Number.isFinite(item.id) ? item.id : Date.now() + Math.random(),
      text: item.text,
      done: Boolean(item.done)
    }));
}

function saveState() {
  localStorage.setItem(CT_STORAGE_KEY, JSON.stringify(state));
}

function renderList(type) {
  const listEl = type === 'citations' ? el.citationList : el.thanksList;
  if (!listEl) return;

  const items = state[type];
  if (!items.length) {
    listEl.innerHTML = '<li class="empty">No entries yet. Unlock edit mode and add one with +</li>';
    return;
  }

  listEl.innerHTML = items.map((item) => `
    <li class="item ${item.done ? 'done' : ''}">
      <input type="checkbox" data-toggle="${type}" data-id="${item.id}" ${item.done ? 'checked' : ''} ${editUnlocked ? '' : 'disabled'} aria-label="Mark item complete" />
      <span class="item-text">${escapeHtml(item.text)}</span>
      <button class="item-delete" data-delete="${type}" data-id="${item.id}" type="button" ${editUnlocked ? '' : 'hidden'}>Delete</button>
    </li>
  `).join('');
}

function renderAll() {
  renderList('citations');
  renderList('thanks');
}

function setEditState(unlocked) {
  editUnlocked = unlocked;

  if (el.citationInput) el.citationInput.disabled = !unlocked;
  if (el.citationAddBtn) el.citationAddBtn.disabled = !unlocked;
  if (el.thanksInput) el.thanksInput.disabled = !unlocked;
  if (el.thanksAddBtn) el.thanksAddBtn.disabled = !unlocked;

  if (el.unlockBtn) el.unlockBtn.textContent = unlocked ? 'Lock Edit' : 'Unlock Edit';
  if (el.status) el.status.textContent = unlocked ? 'Edit mode unlocked' : 'View mode';

  renderAll();
}

function addItem(type, text) {
  if (!editUnlocked) return;
  const trimmed = String(text || '').trim();
  if (!trimmed) return;

  state[type].unshift({
    id: Date.now() + Math.floor(Math.random() * 1000),
    text: trimmed,
    done: false
  });

  saveState();
  renderList(type);
}

function toggleItem(type, id) {
  if (!editUnlocked) return;
  const item = state[type].find((entry) => entry.id === id);
  if (!item) return;
  item.done = !item.done;
  saveState();
  renderList(type);
}

function deleteItem(type, id) {
  if (!editUnlocked) return;
  state[type] = state[type].filter((entry) => entry.id !== id);
  saveState();
  renderList(type);
}

function bindEvents() {
  el.unlockBtn?.addEventListener('click', () => {
    if (editUnlocked) {
      setEditState(false);
      return;
    }

    const attempt = window.prompt('Enter edit passcode:');
    if (attempt === CT_EDIT_PASSCODE) {
      setEditState(true);
      el.citationInput?.focus();
    } else if (attempt !== null && el.status) {
      el.status.textContent = 'Wrong passcode';
    }
  });

  el.citationAddBtn?.addEventListener('click', () => {
    addItem('citations', el.citationInput?.value || '');
    if (el.citationInput) el.citationInput.value = '';
  });

  el.thanksAddBtn?.addEventListener('click', () => {
    addItem('thanks', el.thanksInput?.value || '');
    if (el.thanksInput) el.thanksInput.value = '';
  });

  el.citationInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      addItem('citations', el.citationInput?.value || '');
      if (el.citationInput) el.citationInput.value = '';
    }
  });

  el.thanksInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      addItem('thanks', el.thanksInput?.value || '');
      if (el.thanksInput) el.thanksInput.value = '';
    }
  });

  [el.citationList, el.thanksList].forEach((listEl) => {
    listEl?.addEventListener('click', (event) => {
      const del = event.target.closest('[data-delete]');
      if (!del) return;
      const type = del.dataset.delete;
      const id = Number(del.dataset.id);
      if ((type === 'citations' || type === 'thanks') && Number.isFinite(id)) {
        deleteItem(type, id);
      }
    });

    listEl?.addEventListener('change', (event) => {
      const toggle = event.target.closest('[data-toggle]');
      if (!toggle) return;
      const type = toggle.dataset.toggle;
      const id = Number(toggle.dataset.id);
      if ((type === 'citations' || type === 'thanks') && Number.isFinite(id)) {
        toggleItem(type, id);
      }
    });
  });
}

function boot() {
  loadState();
  bindEvents();
  setEditState(false);
}

boot();
