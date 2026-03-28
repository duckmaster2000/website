const ADMIN_PASSWORD = '2ydzpU2y!';
const GENDER_OVERRIDES_KEY = 'tk_gender_overrides_v1';

const MODE_CONFIG = {
  ms: {
    label: 'Middle School',
    target: 'track.html',
    spreadsheetId: '1otSAiM7Y8u5l0_ZxjA9snO2VV2XYGOOwWCAWFq-epR4',
    sheets: ['50 M', '100 M', '200 M', '400 M', '800 M', '1200 M (7th and 8th ONLY)']
  },
  ls: {
    label: 'Lower School',
    target: 'track-ls.html',
    spreadsheetId: '1nbdgawiSOXC5fw18NYjsA4W_h0E0vNibUTQ4A4aSchg',
    sheets: ['50 M', '100 M', '200 M', '400 M', '800 M', '1200 M (4th and 5th ONLY)']
  }
};

function normalizeSpaces(v) {
  return String(v || '').replace(/\s+/g, ' ').trim();
}

function keyForName(name) {
  return normalizeSpaces(name).toLowerCase();
}

function normalizeGender(value) {
  const raw = normalizeSpaces(value).toLowerCase();
  if (!raw) return 'unknown';
  if (['m', 'male', 'boy', 'boys', 'man', 'men'].includes(raw)) return 'male';
  if (['f', 'female', 'girl', 'girls', 'woman', 'women'].includes(raw)) return 'female';
  return 'unknown';
}

function gvizUrl(spreadsheetId, sheetName) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
}

function parseGviz(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('Bad response');
  return JSON.parse(text.slice(start, end + 1));
}

function getOverrides() {
  try {
    const raw = localStorage.getItem(GENDER_OVERRIDES_KEY);
    return raw ? (JSON.parse(raw) || {}) : {};
  } catch (_) {
    return {};
  }
}

function setOverrides(map) {
  localStorage.setItem(GENDER_OVERRIDES_KEY, JSON.stringify(map));
}

async function fetchRoster(config) {
  const athletes = new Map();

  await Promise.all(config.sheets.map(async (sheetName) => {
    const response = await fetch(gvizUrl(config.spreadsheetId, sheetName));
    if (!response.ok) return;
    const text = await response.text();
    const json = parseGviz(text);
    const cols = (json.table?.cols || []).map((c) => c.label || c.id || '');
    const rows = json.table?.rows || [];

    const firstIdx = cols.findIndex((c) => c.toLowerCase() === 'first name');
    const lastIdx = cols.findIndex((c) => c.toLowerCase() === 'last name');
    const gradeIdx = cols.findIndex((c) => c.toLowerCase() === 'grade');
    const genderIdx = cols.findIndex((c) => ['gender', 'sex', 'm/f', 'm\\f'].includes(c.toLowerCase()));

    if (firstIdx < 0 || lastIdx < 0) return;

    rows.forEach((row) => {
      const first = normalizeSpaces(row.c?.[firstIdx]?.v || '');
      const last = normalizeSpaces(row.c?.[lastIdx]?.v || '');
      if (!first || !last) return;
      const name = normalizeSpaces(`${first} ${last}`);
      const key = keyForName(name);
      if (!athletes.has(key)) {
        athletes.set(key, {
          key,
          name,
          grades: new Set(),
          sourceGenders: [],
          marks: 0
        });
      }
      const rec = athletes.get(key);
      const grade = row.c?.[gradeIdx]?.v;
      if (grade != null && grade !== '') rec.grades.add(String(Math.round(Number(grade))));
      const rawGender = genderIdx >= 0 ? row.c?.[genderIdx]?.v : null;
      rec.sourceGenders.push(normalizeGender(rawGender));
      rec.marks += 1;
    });
  }));

  return [...athletes.values()].map((a) => {
    const counts = { female: 0, male: 0, unknown: 0 };
    a.sourceGenders.forEach((g) => { counts[g] = (counts[g] || 0) + 1; });
    let inferred = 'unknown';
    if (counts.female > counts.male && counts.female > 0) inferred = 'female';
    if (counts.male > counts.female && counts.male > 0) inferred = 'male';
    return {
      ...a,
      gradeText: [...a.grades].sort().join(', ') || '—',
      inferred
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function summarize(roster, overrides) {
  let unresolved = 0;
  let female = 0;
  let male = 0;
  roster.forEach((r) => {
    const effective = normalizeGender(overrides[r.key] || r.inferred);
    if (effective === 'female') female += 1;
    else if (effective === 'male') male += 1;
    else unresolved += 1;
  });
  return { unresolved, female, male, total: roster.length };
}

function renderTable(roster, overrides, showUnknownOnly) {
  const host = document.getElementById('taTableWrap');
  if (!roster.length) {
    host.innerHTML = '<p class="ta-muted" style="padding:.8rem">No roster entries found.</p>';
    return;
  }

  const rows = roster
    .filter((r) => {
      if (!showUnknownOnly) return true;
      const effective = normalizeGender(overrides[r.key] || r.inferred);
      return effective === 'unknown';
    })
    .map((r) => {
      const override = normalizeGender(overrides[r.key] || '');
      const effective = normalizeGender(override !== 'unknown' ? override : r.inferred);
      const rowClass = effective === 'unknown' ? 'ta-row-unresolved' : 'ta-row-resolved';
      return `<tr class="${rowClass}" data-key="${r.key}">
        <td>${r.name}</td>
        <td>${r.gradeText}</td>
        <td>${r.marks}</td>
        <td>${r.inferred}</td>
        <td>
          <select class="ta-gender-select" data-gender-for="${r.key}">
            <option value="unknown"${effective === 'unknown' ? ' selected' : ''}>Unknown</option>
            <option value="female"${effective === 'female' ? ' selected' : ''}>Female</option>
            <option value="male"${effective === 'male' ? ' selected' : ''}>Male</option>
          </select>
        </td>
        <td class="ta-actions">
          <button class="ta-save" type="button" data-save="${r.key}">Save</button>
          <button class="ta-clear" type="button" data-clear="${r.key}">Clear Override</button>
        </td>
      </tr>`;
    })
    .join('');

  host.innerHTML = `<table class="ta-table">
    <thead>
      <tr>
        <th>Name</th>
        <th>Grade</th>
        <th>Rows</th>
        <th>Sheet Gender Guess</th>
        <th>Effective Gender</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="6" class="ta-muted">No unresolved athletes.</td></tr>'}</tbody>
  </table>`;
}

async function boot() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode') === 'ls' ? 'ls' : 'ms';
  const config = MODE_CONFIG[mode];

  const gateCard = document.getElementById('taGateCard');
  const adminCard = document.getElementById('taAdminCard');
  const gateForm = document.getElementById('taGateForm');
  const passwordEl = document.getElementById('taPassword');
  const gateError = document.getElementById('taGateError');
  const modeLabel = document.getElementById('taModeLabel');
  const adminMode = document.getElementById('taAdminMode');
  const dashboardLink = document.getElementById('taDashboardLink');
  const backLink = document.getElementById('taBackLink');
  const summaryEl = document.getElementById('taSummary');
  const showUnknownOnlyEl = document.getElementById('taShowUnknownOnly');
  const reloadBtn = document.getElementById('taReloadBtn');

  modeLabel.textContent = `Mode: ${config.label}`;
  adminMode.textContent = `Mode: ${config.label}`;
  dashboardLink.href = config.target;
  backLink.href = config.target;

  let roster = [];
  let overrides = getOverrides();

  async function refreshTable() {
    summaryEl.textContent = 'Loading roster...';
    roster = await fetchRoster(config);
    overrides = getOverrides();
    const s = summarize(roster, overrides);
    summaryEl.textContent = `Athletes: ${s.total} | Female: ${s.female} | Male: ${s.male} | Unresolved: ${s.unresolved}`;
    renderTable(roster, overrides, !!showUnknownOnlyEl.checked);
  }

  gateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pass = passwordEl.value;
    if (pass !== ADMIN_PASSWORD) {
      gateError.textContent = 'Incorrect password.';
      gateError.hidden = false;
      return;
    }
    gateError.hidden = true;
    gateCard.hidden = true;
    adminCard.hidden = false;
    await refreshTable();
  });

  showUnknownOnlyEl.addEventListener('change', () => {
    renderTable(roster, overrides, !!showUnknownOnlyEl.checked);
  });

  reloadBtn.addEventListener('click', async () => {
    await refreshTable();
  });

  document.body.addEventListener('click', (e) => {
    const saveBtn = e.target.closest('[data-save]');
    if (saveBtn) {
      const key = saveBtn.dataset.save;
      const select = document.querySelector(`[data-gender-for="${key}"]`);
      if (!select) return;
      const next = normalizeGender(select.value);
      const map = getOverrides();
      if (next === 'unknown') delete map[key];
      else map[key] = next;
      setOverrides(map);
      overrides = map;
      renderTable(roster, overrides, !!showUnknownOnlyEl.checked);
      const s = summarize(roster, overrides);
      summaryEl.textContent = `Athletes: ${s.total} | Female: ${s.female} | Male: ${s.male} | Unresolved: ${s.unresolved}`;
      return;
    }

    const clearBtn = e.target.closest('[data-clear]');
    if (clearBtn) {
      const key = clearBtn.dataset.clear;
      const map = getOverrides();
      delete map[key];
      setOverrides(map);
      overrides = map;
      renderTable(roster, overrides, !!showUnknownOnlyEl.checked);
      const s = summarize(roster, overrides);
      summaryEl.textContent = `Athletes: ${s.total} | Female: ${s.female} | Male: ${s.male} | Unresolved: ${s.unresolved}`;
    }
  });
}

boot();
