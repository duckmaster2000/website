/* ── Harker MS Track 2026 — Live Dashboard JS ── */

const SPREADSHEET_ID = '1otSAiM7Y8u5l0_ZxjA9snO2VV2XYGOOwWCAWFq-epR4';
const PINS_KEY      = 'tk_pins_v1';
const STANDARDS_KEY = 'tk_standards_v1';
const EXCHANGE_TIME = 0.2; // seconds per baton exchange

const SHEETS = [
  { key: '50 M',   label: '50 M' },
  { key: '100 M',  label: '100 M' },
  { key: '200 M',  label: '200 M' },
  { key: '400 M',  label: '400 M' },
  { key: '800 M',  label: '800 M' },
  { key: '1200 M (7th and 8th ONLY)', label: '1200 M' }
];

const GRADE_COLORS = { 6: '#85e89d', 7: '#b8a8ff', 8: '#7ee8ff' };
const STD_COLORS   = { conference: '#cd7f32', regionals: '#c0c0c0', state: '#ffd700' };
const CHART_HIT_RADIUS = 9;

/* ── State ── */
const cache = {};
let currentSheet  = '50 M';
let currentGrade  = 'all';
let currentSearch = '';
let currentView   = 'dashboard';
let sortCol  = null;
let sortAsc  = true;
let relayGrade   = 'all';
let athletesGrade  = 'all';
let athletesSearch = '';
let compareA = '';
let compareB = '';
let compareEventKey = '100 M';
let pinnedAthletes = [];
let standards = {};
let revealObserver = null;
let timelineDates = [];
let timelineFrame = 0;
let timelineTimer = null;
let timelineSpeedMs = 950;
let timelineGhostOn = true;
let timelineAnimRaf = null;
let timelineLastRenderedFrame = 0;
let timelineAthletes = [];
let timelineSheetData = null;
let timelinePlaying = false;

/* ── DOM refs ── */
const $ = (id) => document.getElementById(id);
const el = {
  tabs:          $('tkTabs'),
  views:         $('tkViews'),
  gradeFilters:  $('tkGradeFilters'),
  search:        $('tkSearch'),
  fastest:       $('tkFastest'),
  average:       $('tkAverage'),
  median:        $('tkMedian'),
  participation: $('tkParticipation'),
  improved:      $('tkImproved'),
  roster:        $('tkRoster'),
  tableHead:     $('tkTableHead'),
  tableBody:     $('tkTableBody'),
  chartTop10:    $('tkChartTop10'),
  chartGrade:    $('tkChartGrade'),
  chartHist:     $('tkChartHist'),
  chartPie:      $('tkChartPie'),
  chartProgress: $('tkChartProgress'),
  chartTimeline: $('tkChartTimeline'),
  athleteSelect: $('tkAthleteSelect'),
  timelineWrap:   $('tkTimelineWrap'),
  timelinePlay:   $('tkTimelinePlay'),
  timelineSpeed:  $('tkTimelineSpeed'),
  timelineGhost:  $('tkTimelineGhost'),
  timelineRange:  $('tkTimelineRange'),
  timelineLabel:  $('tkTimelineLabel'),
  modal:         $('tkModal'),
  modalContent:  $('tkModalContent'),
  modalClose:    $('tkModalClose'),
  loading:       $('tkLoading'),
  pinnedList:    $('tkPinnedList'),
  athTableWrap:  $('tkAthTableWrap'),
  athGradeFilters: $('tkAthGradeFilters'),
  athSearch:     $('tkAthSearch'),
  relayGrade:    $('tkRelayGrade'),
  relayResults:  $('tkRelayResults'),
  standardsForm: $('tkStandardsForm'),
  qualifierList: $('tkQualifierList'),
  cmpA:          $('tkCmpA'),
  cmpB:          $('tkCmpB'),
  compareResult: $('tkCompareResult'),
  compareChartWrap: $('tkCompareChartWrap'),
  compareChartTitle: $('tkCompareChartTitle'),
  chartCompare:  $('tkChartCompare'),
  cmpEventTabs:  $('tkCmpEventTabs'),
  eventPulse:    $('tkEventPulse'),
  powerRankings: $('tkPowerRankings'),
  watchlist:     $('tkWatchlist')
};

/* ── Chart interactivity (hover + click stats) ── */
const chartHotspots = new Map();
let chartTooltipEl = null;

function ensureChartTooltip() {
  if (chartTooltipEl) return chartTooltipEl;
  chartTooltipEl = document.createElement('div');
  chartTooltipEl.className = 'tk-chart-tooltip';
  chartTooltipEl.hidden = true;
  document.body.appendChild(chartTooltipEl);
  return chartTooltipEl;
}

function setChartHotspots(canvas, hotspots) {
  if (!canvas) return;
  chartHotspots.set(canvas.id, hotspots || []);
}

function isWithinArc(h, mx, my) {
  const dx = mx - h.cx;
  const dy = my - h.cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > h.r || dist < (h.innerR || 0)) return false;
  let ang = Math.atan2(dy, dx);
  if (ang < 0) ang += Math.PI * 2;
  let s = h.start;
  let e = h.end;
  if (s < 0) s += Math.PI * 2;
  if (e < 0) e += Math.PI * 2;
  if (s <= e) return ang >= s && ang <= e;
  return ang >= s || ang <= e;
}

function getHotspotAt(canvas, mx, my) {
  const hotspots = chartHotspots.get(canvas.id) || [];
  for (let i = hotspots.length - 1; i >= 0; i--) {
    const h = hotspots[i];
    if (h.type === 'rect') {
      if (mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h) return h;
    } else if (h.type === 'circle') {
      const dx = mx - h.x;
      const dy = my - h.y;
      const rr = (h.r || CHART_HIT_RADIUS);
      if (dx * dx + dy * dy <= rr * rr) return h;
    } else if (h.type === 'arc') {
      if (isWithinArc(h, mx, my)) return h;
    }
  }
  return null;
}

function hideChartTooltip() {
  if (!chartTooltipEl) return;
  chartTooltipEl.hidden = true;
}

function showChartTooltip(clientX, clientY, html) {
  const tip = ensureChartTooltip();
  tip.innerHTML = html;
  tip.hidden = false;
  const offset = 14;
  tip.style.left = `${clientX + offset}px`;
  tip.style.top = `${clientY + offset}px`;
}

function bindCanvasInteraction(canvas) {
  if (!canvas || canvas.dataset.tkInteractiveBound === '1') return;
  canvas.dataset.tkInteractiveBound = '1';
  canvas.classList.add('tk-interactive-canvas');

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const hit = getHotspotAt(canvas, x, y);
    if (!hit) {
      canvas.style.cursor = 'default';
      canvas.classList.remove('tk-canvas-active');
      hideChartTooltip();
      return;
    }
    canvas.classList.add('tk-canvas-active');
    canvas.style.cursor = hit.onClick ? 'pointer' : 'crosshair';
    showChartTooltip(e.clientX, e.clientY, hit.tooltip || hit.label || '');
  });

  canvas.addEventListener('mouseleave', () => {
    canvas.style.cursor = 'default';
    canvas.classList.remove('tk-canvas-active');
    hideChartTooltip();
  });

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const hit = getHotspotAt(canvas, x, y);
    if (hit) {
      canvas.classList.remove('tk-canvas-pop');
      void canvas.offsetWidth;
      canvas.classList.add('tk-canvas-pop');
      window.setTimeout(() => canvas.classList.remove('tk-canvas-pop'), 260);
    }
    if (hit && typeof hit.onClick === 'function') hit.onClick();
  });
}

function bindStaticChartInteractions() {
  [el.chartTop10, el.chartGrade, el.chartHist, el.chartPie, el.chartProgress, el.chartTimeline, el.chartCompare].forEach(bindCanvasInteraction);
}

function setupRevealObserver() {
  if (revealObserver || !('IntersectionObserver' in window)) return;
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('is-visible');
    });
  }, { threshold: 0.15 });
}

function applyRevealAnimation(scope = document) {
  setupRevealObserver();
  const targets = scope.querySelectorAll('.tk-card,.tk-chart-wrap,.tk-table-wrap,.tk-insight-card,.tk-pinned-card,.tk-relay-card,.tk-modal-chart-card');
  targets.forEach((node, idx) => {
    node.classList.add('tk-reveal');
    node.style.setProperty('--tk-delay', `${Math.min(idx * 40, 360)}ms`);
    if (revealObserver) revealObserver.observe(node);
    else node.classList.add('is-visible');
  });
}

function pulseViewTransition() {
  document.body.classList.remove('tk-view-swapping');
  void document.body.offsetWidth;
  document.body.classList.add('tk-view-swapping');
  window.setTimeout(() => document.body.classList.remove('tk-view-swapping'), 480);
}

/* ── View management ── */
const VIEW_SHOW = {
  dashboard:  ['tk-section-dl', 'tk-section-d'],
  leaderboard:['tk-section-dl', 'tk-section-l'],
  athletes:   ['tk-section-a'],
  relay:      ['tk-section-r'],
  standards:  ['tk-section-s'],
  compare:    ['tk-section-c']
};

function switchView(view) {
  currentView = view;
  if (view !== 'dashboard') stopTimelinePlayback();
  const show = VIEW_SHOW[view] || [];
  document.querySelectorAll('.tk-section-dl,.tk-section-d,.tk-section-l,.tk-section-a,.tk-section-r,.tk-section-s,.tk-section-c,.tk-view-panel').forEach((node) => {
    const visible = show.some((cls) => node.classList.contains(cls));
    node.hidden = !visible;
  });
  document.querySelectorAll('.tk-view').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  pulseViewTransition();
  render();
}

/* ── Persistence: pins ── */
function loadPins() {
  try { const r = localStorage.getItem(PINS_KEY); if (r) pinnedAthletes = JSON.parse(r); } catch (_) {}
}
function savePins() {
  localStorage.setItem(PINS_KEY, JSON.stringify(pinnedAthletes));
}
function togglePin(name) {
  const i = pinnedAthletes.indexOf(name);
  if (i >= 0) pinnedAthletes.splice(i, 1); else pinnedAthletes.push(name);
  savePins();
}
function isPinned(name) { return pinnedAthletes.includes(name); }

/* ── Persistence: standards ── */
function loadStandards() {
  try { const r = localStorage.getItem(STANDARDS_KEY); if (r) standards = JSON.parse(r); } catch (_) {}
}
function saveStandards() {
  localStorage.setItem(STANDARDS_KEY, JSON.stringify(standards));
}

function getStandardLabel(sheetKey, t) {
  if (t == null) return null;
  const s = standards[sheetKey];
  if (!s) return null;
  const sv = s.state    ? parseTimeStr(s.state)    : null;
  const rv = s.regionals? parseTimeStr(s.regionals): null;
  const cv = s.conference?parseTimeStr(s.conference):null;
  if (sv != null && t <= sv) return 'state';
  if (rv != null && t <= rv) return 'regionals';
  if (cv != null && t <= cv) return 'conference';
  return null;
}

/* ── Fetch from Google Sheets gviz endpoint ── */
function sheetUrl(sheetName) {
  return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
}

async function fetchSheet(sheetName) {
  if (cache[sheetName]) return cache[sheetName];
  try {
    const resp = await fetch(sheetUrl(sheetName));
    const text = await resp.text();
    const jsonStart = text.indexOf('{');
    const jsonEnd   = text.lastIndexOf('}');
    if (jsonStart < 0 || jsonEnd < 0) return null;
    const data  = JSON.parse(text.substring(jsonStart, jsonEnd + 1));
    const table = data.table;
    const cols  = table.cols.map((c) => c.label || c.id);
    const rows  = (table.rows || []).map((r) => {
      const row = {};
      cols.forEach((colName, i) => {
        const cell = r.c ? r.c[i] : null;
        row[colName] = cell ? (cell.v != null ? cell.v : null) : null;
      });
      return row;
    });
    const dateCols = cols.filter((c) => c !== 'Last Name' && c !== 'First Name' && c !== 'Grade');
    const result = { cols, dateCols, rows };
    cache[sheetName] = result;
    return result;
  } catch (_) { return null; }
}

/* ── Time parsing / formatting ── */
function parseTimeStr(val) {
  if (val == null) return null;
  if (typeof val === 'number') return val;
  const s = String(val).trim();
  if (!s) return null;
  // M:SS.cc format (1:10.00)
  const colonMatch = s.match(/^(\d+):(\d+)(?:\.(\d+))?$/);
  if (colonMatch) {
    const m = parseInt(colonMatch[1], 10);
    const sec = parseInt(colonMatch[2], 10);
    const frac = colonMatch[3] ? parseFloat('0.' + colonMatch[3]) : 0;
    return m * 60 + sec + frac;
  }
  // M.SS.cc format (1.10.00)
  const parts = s.split('.');
  if (parts.length === 3) {
    const mins = parseInt(parts[0], 10);
    const secs = parseInt(parts[1], 10);
    const cent = parseInt(parts[2], 10);
    if (!isNaN(mins) && !isNaN(secs)) return mins * 60 + secs + (isNaN(cent) ? 0 : cent / 100);
  }
  const num = parseFloat(s);
  return isNaN(num) ? null : num;
}

function formatTime(seconds) {
  if (seconds == null) return '—';
  if (seconds >= 60) {
    const m  = Math.floor(seconds / 60);
    const rem = seconds - m * 60;
    const s  = Math.floor(rem);
    const cs = Math.round((rem - s) * 100);
    return `${m}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
  }
  return seconds.toFixed(2);
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function stdDev(values) {
  if (!values.length) return null;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + ((v - mean) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function computeTrendProjection(points) {
  if (!points || points.length < 2) return null;
  const n = points.length;
  const xs = points.map((_, i) => i + 1);
  const ys = points.map((p) => p.time);
  const sumX = xs.reduce((s, v) => s + v, 0);
  const sumY = ys.reduce((s, v) => s + v, 0);
  const sumXY = xs.reduce((s, x, i) => s + (x * ys[i]), 0);
  const sumXX = xs.reduce((s, x) => s + (x * x), 0);
  const denom = (n * sumXX) - (sumX * sumX);
  if (!denom) return null;

  const slope = ((n * sumXY) - (sumX * sumY)) / denom;
  const intercept = (sumY - (slope * sumX)) / n;
  const nextX = n + 1;
  const predicted = intercept + (slope * nextX);
  const residuals = ys.map((y, i) => y - (intercept + slope * xs[i]));
  const sigma = stdDev(residuals) || 0;
  const lower = Math.max(0, predicted - sigma);
  const upper = predicted + sigma;
  return { predicted, lower, upper, sigma, slope };
}

function stopTimelinePlayback() {
  timelinePlaying = false;
  if (timelineTimer) {
    window.clearTimeout(timelineTimer);
    timelineTimer = null;
  }
  if (timelineAnimRaf) {
    window.cancelAnimationFrame(timelineAnimRaf);
    timelineAnimRaf = null;
  }
  if (el.timelinePlay) el.timelinePlay.textContent = '▶ Play';
}

function startTimelinePlayback() {
  if (!timelineSheetData || !timelineDates.length || !timelineAthletes.length) return;
  if (timelineDates.length <= 1) return;
  timelinePlaying = true;
  if (el.timelinePlay) el.timelinePlay.textContent = '⏸ Pause';

  const runStep = () => {
    if (!timelinePlaying || !timelineSheetData || !timelineAthletes.length || timelineDates.length <= 1) return;
    const from = timelineLastRenderedFrame;
    const to = (from + 1) % timelineDates.length;
    animateTimelineTransition(timelineAthletes, timelineSheetData, from, to, {
      durationMs: Math.max(260, Math.min(900, Math.round(timelineSpeedMs * 0.92))),
      onComplete: () => {
        if (!timelinePlaying) return;
        timelineTimer = window.setTimeout(runStep, 40);
      }
    });
  };

  runStep();
}

/* ── Data processing ── */
function processData(sheetData) {
  if (!sheetData) return [];
  return sheetData.rows.map((row) => {
    const lastName  = row['Last Name']  || '';
    const firstName = row['First Name'] || '';
    const grade     = row['Grade'] != null ? Math.round(row['Grade']) : 0;
    const times = {};
    let best = null, bestDate = null, first = null, firstDate = null, last = null, lastDate = null;
    sheetData.dateCols.forEach((dc) => {
      const t = parseTimeStr(row[dc]);
      times[dc] = t;
      if (t != null) {
        if (best === null || t < best) { best = t; bestDate = dc; }
        if (first === null) { first = t; firstDate = dc; }
        last = t; lastDate = dc;
      }
    });
    const improvement = (first !== null && last !== null && firstDate !== lastDate) ? first - last : null;
    return { lastName, firstName, grade, times, best, bestDate, first, last, improvement, name: `${firstName} ${lastName}` };
  });
}

function filterAthletes(athletes) {
  return athletes.filter((a) => {
    if (currentGrade !== 'all' && a.grade !== parseInt(currentGrade, 10)) return false;
    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      if (!a.name.toLowerCase().includes(q) && !a.lastName.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

function timedAthletes(athletes) { return athletes.filter((a) => a.best !== null); }

/* ── Stats ── */
function computeStats(athletes) {
  const timed = timedAthletes(athletes);
  const bests = timed.map((a) => a.best).sort((a, b) => a - b);
  const fastest = bests.length > 0 ? bests[0] : null;
  const avg     = bests.length > 0 ? bests.reduce((s, v) => s + v, 0) / bests.length : null;
  const median  = bests.length > 0 ? bests[Math.floor(bests.length / 2)] : null;
  let mostImproved = null, bestImprovement = -Infinity;
  timed.forEach((a) => { if (a.improvement !== null && a.improvement > bestImprovement) { bestImprovement = a.improvement; mostImproved = a; } });
  return { fastest, avg, median, timedCount: timed.length, total: athletes.length, mostImproved, bestImprovement };
}

function renderStats(stats) {
  el.fastest.textContent       = formatTime(stats.fastest);
  el.average.textContent       = formatTime(stats.avg);
  el.median.textContent        = formatTime(stats.median);
  el.participation.textContent = `${stats.timedCount}`;
  el.roster.textContent        = `${stats.total}`;
  if (stats.mostImproved && stats.bestImprovement > 0)
    el.improved.textContent = `${stats.mostImproved.name} (−${stats.bestImprovement.toFixed(2)}s)`;
  else el.improved.textContent = '—';
}

/* ── Leaderboard table (with top-3, pins, standards) ── */
function renderTable(athletes, sheetData) {
  const dateCols = sheetData.dateCols;
  const headers  = ['#', 'Athlete', 'Grade', ...dateCols, 'Best', 'Δ PR', ''];

  el.tableHead.innerHTML = headers.map((h, i) => {
    const arrow = sortCol === i ? (sortAsc ? ' ▲' : ' ▼') : '';
    return `<th data-col="${i}">${h}${arrow}</th>`;
  }).join('');

  // Sort
  let sorted = [...athletes];
  if (sortCol !== null) {
    sorted.sort((a, b) => {
      let va, vb;
      if (sortCol === 1) { va = a.name; vb = b.name; }
      else if (sortCol === 2) { va = a.grade; vb = b.grade; }
      else if (sortCol === headers.length - 3) { va = a.best; vb = b.best; }
      else if (sortCol === headers.length - 2) { va = a.improvement; vb = b.improvement; }
      else {
        const dc = dateCols[sortCol - 3];
        va = dc ? a.times[dc] : null; vb = dc ? b.times[dc] : null;
      }
      if (va == null && vb == null) return 0;
      if (va == null) return 1; if (vb == null) return -1;
      if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortAsc ? va - vb : vb - va;
    });
  } else {
    sorted.sort((a, b) => { if (a.best == null && b.best == null) return 0; if (a.best == null) return 1; if (b.best == null) return -1; return a.best - b.best; });
  }

  // Top-3 per grade
  const top3ByGrade = {};
  [6, 7, 8].forEach((g) => {
    const grp = timedAthletes(sorted.filter((a) => a.grade === g)).sort((a, b) => a.best - b.best);
    top3ByGrade[g] = new Set(grp.slice(0, 3).map((a) => a.name));
  });

  let rank = 0;
  el.tableBody.innerHTML = sorted.map((a) => {
    if (a.best != null) rank++;
    const gradeClass = `tk-grade-${a.grade}`;
    const isTop3     = top3ByGrade[a.grade]?.has(a.name);
    const stdLabel   = getStandardLabel(currentSheet, a.best);
    const stdBadge   = stdLabel ? `<span class="tk-std-badge tk-std-${stdLabel}">${stdLabel[0].toUpperCase()}</span>` : '';
    const starBadge  = isTop3 && a.best != null ? '<span class="tk-qual-star" title="Top 3 in grade">⭐</span>' : '';
    const pinBtn     = `<button class="tk-pin${isPinned(a.name) ? ' pinned' : ''}" data-pin="${encodeURIComponent(a.name)}" title="${isPinned(a.name) ? 'Unpin' : 'Pin athlete'}">${isPinned(a.name) ? '★' : '☆'}</button>`;
    const impStr     = a.improvement != null && a.improvement > 0 ? `<span class="tk-delta-pos">−${a.improvement.toFixed(2)}s</span>` : (a.improvement != null && a.improvement < 0 ? `<span class="tk-delta-neg">+${Math.abs(a.improvement).toFixed(2)}s</span>` : '');

    const timeCells = dateCols.map((dc) => {
      const t   = a.times[dc];
      const isPr = t !== null && t === a.best;
      return `<td>${t !== null ? (isPr ? `<span class="tk-pr">${formatTime(t)}</span>` : formatTime(t)) : ''}</td>`;
    }).join('');

    return `<tr>
      <td>${a.best != null ? rank : ''}</td>
      <td><span class="tk-clickable" data-athlete="${encodeURIComponent(a.name)}">${a.name}</span>${starBadge}${stdBadge}</td>
      <td class="${gradeClass}">${a.grade}</td>
      ${timeCells}
      <td><strong>${formatTime(a.best)}</strong></td>
      <td>${impStr}</td>
      <td>${pinBtn}</td>
    </tr>`;
  }).join('');
}

/* ── Pinned athletes panel ── */
async function renderPinnedSection() {
  if (!el.pinnedList) return;
  if (pinnedAthletes.length === 0) {
    el.pinnedList.innerHTML = '<p class="tk-empty-msg">No athletes pinned. Click ☆ in the Leaderboard.</p>';
    return;
  }
  const data = await fetchSheet(currentSheet);
  if (!data) return;
  const allAthletes = processData(data);

  const cards = pinnedAthletes.map((name) => {
    const a = allAthletes.find((at) => at.name === name);
    if (!a) return `<div class="tk-pinned-card"><strong>${name}</strong><br><small>No data in ${currentSheet}</small><button class="tk-pin pinned" data-pin="${encodeURIComponent(name)}" title="Unpin">★ Unpin</button></div>`;
    const stdLabel = getStandardLabel(currentSheet, a.best);
    const stdBadge = stdLabel ? `<span class="tk-std-badge tk-std-${stdLabel}">${stdLabel[0].toUpperCase()}</span>` : '';
    return `<div class="tk-pinned-card">
      <div class="tk-pinned-name"><span class="tk-clickable" data-athlete="${encodeURIComponent(name)}">${name}</span> ${stdBadge}</div>
      <div class="tk-pinned-grade tk-grade-${a.grade}">Grade ${a.grade}</div>
      <div class="tk-pinned-time">${currentSheet} Best: <strong>${formatTime(a.best)}</strong></div>
      ${a.improvement != null && a.improvement > 0 ? `<div class="tk-pinned-imp">↑ Improved ${a.improvement.toFixed(2)}s</div>` : ''}
      <button class="tk-pin pinned" data-pin="${encodeURIComponent(name)}" title="Unpin">★ Unpin</button>
    </div>`;
  }).join('');
  el.pinnedList.innerHTML = `<div class="tk-pinned-cards">${cards}</div>`;
}

async function renderEventPulse(athletes, sheetData) {
  if (!el.eventPulse) return;
  const timed = timedAthletes(athletes);
  if (!sheetData || !timed.length) {
    el.eventPulse.innerHTML = '<p class="tk-empty-msg">Not enough data for pulse insights yet.</p>';
    return;
  }

  const gradeSummary = [6, 7, 8].map((grade) => {
    const group = timed.filter((a) => a.grade === grade);
    if (!group.length) return null;
    const avg = group.reduce((sum, a) => sum + a.best, 0) / group.length;
    return { grade, avg, count: group.length };
  }).filter(Boolean).sort((a, b) => a.avg - b.avg);

  const improvedCount = timed.filter((a) => a.improvement != null && a.improvement > 0).length;
  const mostActive = sheetData.dateCols.map((dc) => {
    const count = athletes.filter((a) => a.times[dc] != null).length;
    return { date: dc, count };
  }).sort((a, b) => b.count - a.count)[0];

  const bestGrade = gradeSummary[0];
  const improvementRate = timed.length ? ((improvedCount / timed.length) * 100) : 0;

  el.eventPulse.innerHTML = `
    <div class="tk-pulse-grid">
      <div class="tk-pulse-item">
        <span class="tk-pulse-label">Fastest Grade Average</span>
        <strong>${bestGrade ? `Grade ${bestGrade.grade}` : '—'}</strong>
        <small>${bestGrade ? `${formatTime(bestGrade.avg)} avg (${bestGrade.count} athletes)` : 'No graded data'}</small>
      </div>
      <div class="tk-pulse-item">
        <span class="tk-pulse-label">Improvement Rate</span>
        <strong>${improvementRate.toFixed(1)}%</strong>
        <small>${improvedCount} of ${timed.length} timed athletes are trending faster</small>
      </div>
      <div class="tk-pulse-item">
        <span class="tk-pulse-label">Most Active Date</span>
        <strong>${mostActive?.date || '—'}</strong>
        <small>${mostActive ? `${mostActive.count} recorded marks` : 'No mark density yet'}</small>
      </div>
    </div>`;
}

async function renderPowerRankings() {
  if (!el.powerRankings) return;
  const athleteMap = {};

  for (const sheet of SHEETS) {
    const data = await fetchSheet(sheet.key);
    if (!data) continue;
    const timed = timedAthletes(processData(data)).sort((a, b) => a.best - b.best);
    timed.forEach((athlete, index) => {
      if (!athleteMap[athlete.name]) {
        athleteMap[athlete.name] = { name: athlete.name, grade: athlete.grade, scores: [], events: 0 };
      }
      const score = timed.length === 1 ? 100 : ((timed.length - 1 - index) / (timed.length - 1)) * 100;
      athleteMap[athlete.name].scores.push(score);
      athleteMap[athlete.name].events += 1;
    });
  }

  const rankings = Object.values(athleteMap)
    .filter((a) => a.events > 0)
    .map((a) => ({
      ...a,
      rating: a.scores.reduce((sum, v) => sum + v, 0) / a.scores.length
    }))
    .sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      if (b.events !== a.events) return b.events - a.events;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 10);

  if (!rankings.length) {
    el.powerRankings.innerHTML = '<p class="tk-empty-msg">No timed data yet across events.</p>';
    return;
  }

  const rows = rankings.map((athlete, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td><span class="tk-clickable" data-athlete="${encodeURIComponent(athlete.name)}">${athlete.name}</span></td>
      <td class="tk-grade-${athlete.grade}">${athlete.grade}</td>
      <td>${athlete.events}</td>
      <td>${athlete.rating.toFixed(1)}</td>
    </tr>`).join('');

  el.powerRankings.innerHTML = `
    <div class="tk-insight-table-wrap">
      <table class="tk-insight-table">
        <thead><tr><th>#</th><th>Athlete</th><th>Grade</th><th>Events</th><th>Rating</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="tk-insight-note">Rating is the average percentile score across all timed events (higher is better).</p>`;
}

function renderWatchlist(athletes) {
  if (!el.watchlist) return;
  const sheetStandards = standards[currentSheet] || {};
  const levels = [
    { key: 'state', label: 'State' },
    { key: 'regionals', label: 'Regionals' },
    { key: 'conference', label: 'Conference' }
  ].map((level) => ({
    ...level,
    threshold: parseTimeStr(sheetStandards[level.key])
  })).filter((level) => level.threshold != null).sort((a, b) => a.threshold - b.threshold);

  if (!levels.length) {
    el.watchlist.innerHTML = '<p class="tk-empty-msg">Set standards in the Standards tab to unlock who is close.</p>';
    return;
  }

  const watch = timedAthletes(athletes).map((athlete) => {
    const gaps = levels
      .map((level) => ({
        ...level,
        gap: athlete.best - level.threshold
      }))
      .filter((item) => item.gap > 0);
    if (!gaps.length) return null;
    const next = gaps.sort((a, b) => a.gap - b.gap)[0];
    return {
      name: athlete.name,
      grade: athlete.grade,
      level: next.label,
      gap: next.gap,
      pct: (next.gap / next.threshold) * 100,
      best: athlete.best
    };
  }).filter(Boolean)
    .filter((row) => row.pct <= 3.5)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 8);

  if (!watch.length) {
    el.watchlist.innerHTML = `<p class="tk-empty-msg">No athletes are within 3.5% of the next ${currentSheet} standard right now.</p>`;
    return;
  }

  el.watchlist.innerHTML = `<div class="tk-watchlist">${watch.map((row) => `
    <button class="tk-watch-chip" data-athlete="${encodeURIComponent(row.name)}">
      <span class="tk-watch-name tk-grade-${row.grade}">${row.name}</span>
      <span class="tk-watch-meta">${row.level}: +${row.gap.toFixed(2)}s (${row.pct.toFixed(2)}%)</span>
    </button>`).join('')}</div>`;
}

/* ── Athletes overview (cross-event table) ── */
async function renderAthletesView() {
  if (!el.athTableWrap) return;
  el.athTableWrap.innerHTML = '<p class="tk-empty-msg">Loading…</p>';

  const allData = {};
  for (const sheet of SHEETS) {
    const d = await fetchSheet(sheet.key);
    if (d) allData[sheet.key] = d;
  }

  const athleteMap = {};
  SHEETS.forEach((sheet) => {
    const athletes = processData(allData[sheet.key]);
    athletes.forEach((a) => {
      if (!athleteMap[a.name]) athleteMap[a.name] = { name: a.name, grade: a.grade, events: {} };
      athleteMap[a.name].events[sheet.key] = a.best;
    });
  });

  let athletes = Object.values(athleteMap);

  if (athletesGrade !== 'all') athletes = athletes.filter((a) => a.grade === parseInt(athletesGrade, 10));
  if (athletesSearch) { const q = athletesSearch.toLowerCase(); athletes = athletes.filter((a) => a.name.toLowerCase().includes(q)); }

  athletes.sort((a, b) => { if (a.grade !== b.grade) return a.grade - b.grade; return a.name.localeCompare(b.name); });

  const eventsRun = (a) => SHEETS.filter((s) => a.events[s.key] != null).length;

  const thead = `<tr>
    <th data-asort="name">Name</th>
    <th data-asort="grade">Grade</th>
    ${SHEETS.map((s) => `<th data-asort="${s.key}">${s.label}</th>`).join('')}
    <th>Events Run</th>
  </tr>`;

  const tbody = athletes.map((a) => {
    const gradeClass = `tk-grade-${a.grade}`;
    const eventCells = SHEETS.map((s) => {
      const t = a.events[s.key];
      const stdLabel = getStandardLabel(s.key, t);
      const badge = stdLabel ? `<span class="tk-std-badge tk-std-${stdLabel}">${stdLabel[0].toUpperCase()}</span>` : '';
      return `<td>${t != null ? formatTime(t) + badge : ''}</td>`;
    }).join('');
    return `<tr>
      <td><span class="tk-clickable" data-athlete="${encodeURIComponent(a.name)}">${a.name}</span></td>
      <td class="${gradeClass}">${a.grade}</td>
      ${eventCells}
      <td>${eventsRun(a)}</td>
    </tr>`;
  }).join('');

  el.athTableWrap.innerHTML = `<table class="tk-ath-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
}

/* ── Relay builder ── */
async function renderRelayView() {
  if (!el.relayResults) return;
  el.relayResults.innerHTML = '<p class="tk-empty-msg">Loading 100M data…</p>';
  const data = await fetchSheet('100 M');
  if (!data) { el.relayResults.innerHTML = '<p class="tk-empty-msg">No 100M data available.</p>'; return; }

  let athletes = timedAthletes(processData(data));
  if (relayGrade !== 'all') athletes = athletes.filter((a) => a.grade === parseInt(relayGrade, 10));
  athletes.sort((a, b) => a.best - b.best);

  const buildTeam = (pool, size = 4) => {
    const team = pool.slice(0, size);
    const legTimes = team.map((a) => a.best);
    const totalRaw = legTimes.reduce((s, v) => s + v, 0);
    const exchanges = Math.max(0, team.length - 1) * EXCHANGE_TIME;
    return { team, legTimes, totalRaw, totalEstimate: totalRaw + exchanges };
  };

  const renderTeam = (label, team, exchanges) => {
    if (team.team.length === 0) return `<div class="tk-relay-card"><h3>${label}</h3><p class="tk-empty-msg">Not enough athletes.</p></div>`;
    const rows = team.team.map((a, i) => `
      <div class="tk-relay-runner">
        <span class="tk-relay-leg">Leg ${i + 1}</span>
        <span class="tk-relay-name tk-grade-${a.grade}"><span class="tk-clickable" data-athlete="${encodeURIComponent(a.name)}">${a.name}</span></span>
        <span class="tk-relay-grade">(Gr ${a.grade})</span>
        <span class="tk-relay-split">${formatTime(a.best)}</span>
      </div>`).join('');
    return `<div class="tk-relay-card">
      <h3>${label}</h3>
      ${rows}
      <div class="tk-relay-total">
        <span>Raw legs total: <strong>${formatTime(team.totalRaw)}</strong></span>
        <span>Est. relay time (+${exchanges}×0.2s exchange): <strong>${formatTime(team.totalEstimate)}</strong></span>
      </div>
    </div>`;
  };

  let html = '';
  if (relayGrade === 'all') {
    html += renderTeam('Combined Best 4×100m Team', buildTeam(athletes), 3);
    [6, 7, 8].forEach((g) => {
      const pool = athletes.filter((a) => a.grade === g);
      html += renderTeam(`Grade ${g} 4×100m Team`, buildTeam(pool), 3);
    });
  } else {
    html = renderTeam(`Grade ${relayGrade} 4×100m Team`, buildTeam(athletes), 3);
  }
  el.relayResults.innerHTML = html;
}

/* ── Standards panel ── */
function renderStandardsPanel() {
  if (!el.standardsForm) return;

  const rows = SHEETS.map((sheet) => {
    const s   = standards[sheet.key] || {};
    return `<div class="tk-std-row">
      <div class="tk-std-event">${sheet.label}</div>
      <div class="tk-std-inputs">
        <label>Conference<input class="tk-std-input" data-sheet="${sheet.key}" data-level="conference" value="${s.conference || ''}" placeholder="e.g. 8.00" /></label>
        <label>Regionals<input class="tk-std-input" data-sheet="${sheet.key}" data-level="regionals"  value="${s.regionals  || ''}" placeholder="e.g. 7.50" /></label>
        <label>State<input class="tk-std-input" data-sheet="${sheet.key}" data-level="state"       value="${s.state       || ''}" placeholder="e.g. 7.00" /></label>
      </div>
    </div>`;
  }).join('');
  el.standardsForm.innerHTML = `<div class="tk-std-form">${rows}</div>`;
  el.standardsForm.querySelectorAll('.tk-std-input').forEach((input) => {
    input.addEventListener('input', () => {
      const { sheet, level } = input.dataset;
      if (!standards[sheet]) standards[sheet] = {};
      standards[sheet][level] = input.value.trim();
      saveStandards();
      renderQualifiers();
    });
  });
  renderQualifiers();
}

async function renderQualifiers() {
  if (!el.qualifierList) return;
  const hasAny = SHEETS.some((s) => { const v = standards[s.key]; return v && (v.conference || v.regionals || v.state); });
  if (!hasAny) { el.qualifierList.innerHTML = '<p class="tk-empty-msg">Set standards above to see qualifier lists.</p>'; return; }

  el.qualifierList.innerHTML = '<p class="tk-empty-msg">Computing qualifiers…</p>';
  let html = '<h3 style="margin:.8rem 0 .4rem;color:#8fb8dc">Qualifiers</h3>';

  for (const sheet of SHEETS) {
    const s = standards[sheet.key];
    if (!s || (!s.conference && !s.regionals && !s.state)) continue;
    const data = await fetchSheet(sheet.key);
    if (!data) continue;
    const athletes = timedAthletes(processData(data)).sort((a, b) => a.best - b.best);

    const levels = ['state', 'regionals', 'conference'];
    levels.forEach((lvl) => {
      if (!s[lvl]) return;
      const threshold = parseTimeStr(s[lvl]);
      if (threshold == null) return;
      const qualifiers = athletes.filter((a) => a.best <= threshold);
      if (qualifiers.length === 0) return;
      const badgeHtml = `<span class="tk-std-badge tk-std-${lvl}">${lvl[0].toUpperCase()}</span>`;
      html += `<div class="tk-qual-group"><h4>${sheet.label} — ${lvl.charAt(0).toUpperCase()+lvl.slice(1)} ${badgeHtml} (≤ ${formatTime(threshold)})</h4><div class="tk-qual-chips">${qualifiers.map((a) => `<span class="tk-qual-chip tk-grade-${a.grade}" data-athlete="${encodeURIComponent(a.name)}">${a.name} (${formatTime(a.best)})</span>`).join('')}</div></div>`;
    });
  }
  el.qualifierList.innerHTML = html;
}

/* ── Compare view ── */
async function populateCompareSelects() {
  const allNames = new Set();
  for (const sheet of SHEETS) {
    const d = await fetchSheet(sheet.key);
    if (!d) continue;
    timedAthletes(processData(d)).forEach((a) => allNames.add(a.name));
  }
  const names = [...allNames].sort();
  const opts  = names.map((n) => `<option value="${n}">${n}</option>`).join('');
  const aOpts = `<option value="">Select…</option>${opts}`;
  el.cmpA.innerHTML = aOpts;
  el.cmpB.innerHTML = aOpts;
  if (compareA) el.cmpA.value = compareA;
  if (compareB) el.cmpB.value = compareB;
}

async function renderCompareView() {
  const nameA = el.cmpA?.value;
  const nameB = el.cmpB?.value;
  if (!nameA || !nameB) { el.compareResult.innerHTML = '<p class="tk-empty-msg">Select two athletes above.</p>'; el.compareChartWrap.hidden = true; return; }
  if (nameA === nameB) { el.compareResult.innerHTML = '<p class="tk-empty-msg">Choose two different athletes.</p>'; el.compareChartWrap.hidden = true; return; }

  el.compareResult.innerHTML = '<p class="tk-empty-msg">Loading…</p>';

  const dataA = {}, dataB = {};
  for (const sheet of SHEETS) {
    const d = await fetchSheet(sheet.key);
    if (!d) continue;
    const athletes = processData(d);
    const a = athletes.find((x) => x.name === nameA);
    const b = athletes.find((x) => x.name === nameB);
    if (a) dataA[sheet.key] = a;
    if (b) dataB[sheet.key] = b;
  }

  const gradeA = Object.values(dataA)[0]?.grade || '?';
  const gradeB = Object.values(dataB)[0]?.grade || '?';

  const rows = SHEETS.map((sheet) => {
    const a = dataA[sheet.key];
    const b = dataB[sheet.key];
    const ta = a?.best ?? null;
    const tb = b?.best ?? null;
    let winner = '';
    if (ta != null && tb != null) winner = ta < tb ? 'A' : tb < ta ? 'B' : 'TIE';
    const aCls = winner === 'A' ? 'tk-cmp-winner' : '';
    const bCls = winner === 'B' ? 'tk-cmp-winner' : '';
    return `<tr>
      <td><strong>${sheet.label}</strong></td>
      <td class="${aCls}">${formatTime(ta)}</td>
      <td class="${bCls}">${formatTime(tb)}</td>
      <td class="tk-cmp-winner-cell">${winner === 'A' ? nameA.split(' ')[0] : winner === 'B' ? nameB.split(' ')[0] : winner}</td>
    </tr>`;
  }).join('');

  const winsA = SHEETS.filter((s) => { const a = dataA[s.key]?.best ?? null; const b = dataB[s.key]?.best ?? null; return a != null && b != null && a < b; }).length;
  const winsB = SHEETS.filter((s) => { const a = dataA[s.key]?.best ?? null; const b = dataB[s.key]?.best ?? null; return b != null && a != null && b < a; }).length;

  el.compareResult.innerHTML = `
    <div class="tk-cmp-header">
      <div class="tk-cmp-athlete-a"><span class="tk-grade-${gradeA}">${nameA}</span><small>Grade ${gradeA}</small></div>
      <div class="tk-cmp-score"><span>${winsA}</span><small>wins</small></div>
      <div class="tk-cmp-score-vs">vs</div>
      <div class="tk-cmp-score"><span>${winsB}</span><small>wins</small></div>
      <div class="tk-cmp-athlete-b"><span class="tk-grade-${gradeB}">${nameB}</span><small>Grade ${gradeB}</small></div>
    </div>
    <div class="tk-table-wrap tk-compare-table-wrap"><table class="tk-compare-table">
      <thead><tr><th>Event</th><th>${nameA}</th><th>${nameB}</th><th>Faster</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;

  // Progress comparison chart
  el.compareChartWrap.hidden = false;
  const availableSheets = SHEETS.filter((s) => (dataA[s.key]?.best ?? null) != null || (dataB[s.key]?.best ?? null) != null);
  el.cmpEventTabs.innerHTML = availableSheets.map((s) => `<button class="tk-grade${s.key === compareEventKey ? ' active' : ''}" data-cev="${s.key}">${s.label}</button>`).join('');
  await drawCompareChart(dataA[compareEventKey], dataB[compareEventKey], await fetchSheet(compareEventKey), nameA, nameB);
}

async function drawCompareChart(athleteA, athleteB, sheetData, nameA, nameB) {
  const canvas = el.chartCompare;
  if (!canvas || !sheetData) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const dateCols = sheetData.dateCols;
  const ptsA = dateCols.map((dc) => ({ date: dc, time: athleteA?.times?.[dc] ?? null })).filter((p) => p.time != null);
  const ptsB = dateCols.map((dc) => ({ date: dc, time: athleteB?.times?.[dc] ?? null })).filter((p) => p.time != null);
  const hotspots = [];

  if (ptsA.length === 0 && ptsB.length === 0) {
    setChartHotspots(canvas, []);
    ctx.fillStyle = '#556a88'; ctx.font = '13px Inter'; ctx.fillText('No recorded times for either athlete in this event', 60, H / 2); return;
  }

  const allTimes = [...ptsA, ...ptsB].map((p) => p.time);
  const minT = Math.min(...allTimes) * 0.96;
  const maxT = Math.max(...allTimes) * 1.04 || 1;
  const range = maxT - minT || 1;

  const allDates = [...new Set([...ptsA.map((p) => p.date), ...ptsB.map((p) => p.date)])].sort();
  const pad = { top: 24, bottom: 44, left: 64, right: 30 };
  const areaW = W - pad.left - pad.right;
  const areaH = H - pad.top - pad.bottom;

  ctx.strokeStyle = 'rgba(100,180,255,.08)';
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (areaH / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    const val = maxT - (range / 4) * i;
    ctx.fillStyle = '#556a88'; ctx.font = '10px Inter'; ctx.textAlign = 'right';
    ctx.fillText(formatTime(val), pad.left - 8, y + 4);
  }

  const drawLine = (pts, color) => {
    if (pts.length === 0) return;
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.beginPath();
    pts.forEach((p, i) => {
      const x = pad.left + (allDates.indexOf(p.date) / Math.max(allDates.length - 1, 1)) * areaW;
      const y = pad.top + ((maxT - p.time) / range) * areaH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    pts.forEach((p) => {
      const x = pad.left + (allDates.indexOf(p.date) / Math.max(allDates.length - 1, 1)) * areaW;
      const y = pad.top + ((maxT - p.time) / range) * areaH;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = '#0c1a32'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px Inter'; ctx.textAlign = 'center';
      ctx.fillText(formatTime(p.time), x, y - 9);
      hotspots.push({
        type: 'circle',
        x,
        y,
        r: 9,
        tooltip: `<strong>${p.date}</strong><br>${formatTime(p.time)}`
      });
    });
    ctx.lineWidth = 1;
  };

  drawLine(ptsA, GRADE_COLORS[athleteA?.grade] || '#7ee8ff');
  drawLine(ptsB, GRADE_COLORS[athleteB?.grade] || '#f97316');

  // Date labels
  allDates.forEach((d, i) => {
    const x = pad.left + (i / Math.max(allDates.length - 1, 1)) * areaW;
    ctx.fillStyle = '#8fb8dc'; ctx.font = '10px Inter'; ctx.textAlign = 'center';
    ctx.fillText(d, x, H - pad.bottom + 16);
  });

  // Legend
  ctx.fillStyle = GRADE_COLORS[athleteA?.grade] || '#7ee8ff'; ctx.fillRect(W - 180, 8, 12, 12);
  ctx.fillStyle = '#d4e0f0'; ctx.font = '11px Inter'; ctx.textAlign = 'left'; ctx.fillText(nameA, W - 164, 19);
  ctx.fillStyle = GRADE_COLORS[athleteB?.grade] || '#f97316'; ctx.fillRect(W - 180, 26, 12, 12);
  ctx.fillStyle = '#d4e0f0'; ctx.fillText(nameB, W - 164, 37);
  setChartHotspots(canvas, hotspots);
}

/* ── Athlete modal (cross-event profile) ── */
async function showAthleteModal(name) {
  const bundles = [];
  for (const sheet of SHEETS) {
    const data = await fetchSheet(sheet.key);
    if (!data) continue;
    const all = processData(data);
    const athlete = all.find((at) => at.name === name);
    if (!athlete || athlete.best == null) continue;
    const timedAll = timedAthletes(all).sort((a, b) => a.best - b.best);
    const gradeAll = timedAll.filter((a) => a.grade === athlete.grade);
    const attempts = data.dateCols
      .map((dc) => ({ date: dc, time: athlete.times[dc] }))
      .filter((p) => p.time != null);
    const values = attempts.map((a) => a.time);
    const avg = values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
    const med = median(values);
    const sd = stdDev(values);
    const worst = values.length ? Math.max(...values) : null;
    const rankOverall = Math.max(1, timedAll.findIndex((a) => a.name === name) + 1);
    const rankGrade = Math.max(1, gradeAll.findIndex((a) => a.name === name) + 1);
    const percentile = timedAll.length <= 1 ? 100 : ((timedAll.length - rankOverall) / (timedAll.length - 1)) * 100;
    const leader = timedAll[0]?.best ?? athlete.best;
    bundles.push({
      sheet,
      data,
      athlete,
      attempts,
      values,
      avg,
      med,
      sd,
      worst,
      rankOverall,
      rankGrade,
      percentile,
      leaderGap: athlete.best - leader,
      stdLabel: getStandardLabel(sheet.key, athlete.best)
    });
  }

  if (!bundles.length) {
    el.modalContent.innerHTML = `<h2>${name}</h2><p class="tk-empty-msg">No timed marks found yet across tracked events.</p>`;
    el.modal.hidden = false;
    return;
  }

  const grade = bundles[0].athlete.grade;
  const eventsRun = bundles.length;
  const totalAttempts = bundles.reduce((sum, b) => sum + b.attempts.length, 0);
  const podiumEvents = bundles.filter((b) => b.rankGrade <= 3).length;
  const avgPercentile = bundles.reduce((sum, b) => sum + b.percentile, 0) / bundles.length;
  const strongest = [...bundles].sort((a, b) => b.percentile - a.percentile)[0];
  const mostImproved = [...bundles]
    .filter((b) => b.athlete.improvement != null)
    .sort((a, b) => (b.athlete.improvement || 0) - (a.athlete.improvement || 0))[0];

  const summaryCards = `
    <div class="tk-modal-stat-grid">
      <div class="tk-modal-stat"><span class="tk-modal-stat-label">Grade</span><strong>${grade}</strong></div>
      <div class="tk-modal-stat"><span class="tk-modal-stat-label">Events Run</span><strong>${eventsRun}</strong></div>
      <div class="tk-modal-stat"><span class="tk-modal-stat-label">Total Timed Marks</span><strong>${totalAttempts}</strong></div>
      <div class="tk-modal-stat"><span class="tk-modal-stat-label">Grade Podium Events</span><strong>${podiumEvents}</strong></div>
      <div class="tk-modal-stat"><span class="tk-modal-stat-label">Avg Event Percentile</span><strong>${avgPercentile.toFixed(1)}%</strong></div>
      <div class="tk-modal-stat"><span class="tk-modal-stat-label">Best Event</span><strong>${strongest.sheet.label}</strong></div>
    </div>`;

  const insights = `
    <div class="tk-modal-insights">
      <h3>Performance Insights</h3>
      <ul>
        <li>Strongest ranking is <strong>${strongest.sheet.label}</strong> at top ${Math.max(0.1, (100 - strongest.percentile)).toFixed(1)}% of all athletes for that event.</li>
        <li>${mostImproved ? `Largest event improvement is <strong>${mostImproved.sheet.label}</strong> by <strong>${(mostImproved.athlete.improvement || 0).toFixed(2)}s</strong>.` : 'Improvement trend will appear once multiple dates are recorded per event.'}</li>
        <li>${podiumEvents > 0 ? `Currently in grade top 3 for <strong>${podiumEvents}</strong> event${podiumEvents === 1 ? '' : 's'}.` : 'Not yet in grade top 3; closest events are highlighted in the table below.'}</li>
      </ul>
    </div>`;

  const eventRows = bundles.map((b) => {
    const std = b.stdLabel ? `<span class="tk-std-badge tk-std-${b.stdLabel}">${b.stdLabel[0].toUpperCase()}</span>` : '';
    const improve = b.athlete.improvement != null ? `${b.athlete.improvement > 0 ? '−' : '+'}${Math.abs(b.athlete.improvement).toFixed(2)}s` : '—';
    return `<tr>
      <td><strong>${b.sheet.label}</strong> ${std}</td>
      <td>${formatTime(b.athlete.best)}</td>
      <td>${formatTime(b.avg)}</td>
      <td>${formatTime(b.med)}</td>
      <td>${formatTime(b.worst)}</td>
      <td>${b.sd != null ? b.sd.toFixed(2) : '—'}s</td>
      <td>#${b.rankOverall}</td>
      <td>#${b.rankGrade}</td>
      <td>${b.leaderGap > 0 ? `+${b.leaderGap.toFixed(2)}s` : 'Leader'}</td>
      <td>${improve}</td>
    </tr>`;
  }).join('');

  const chartBlocks = bundles.map((b, idx) => `
    <article class="tk-modal-chart-card">
      <div class="tk-modal-chart-head">
        <h4>${b.sheet.label}</h4>
        <span>${b.attempts.length} mark${b.attempts.length === 1 ? '' : 's'}</span>
      </div>
      <canvas id="tkModalChart${idx}" width="440" height="190"></canvas>
    </article>
  `).join('');

  el.modalContent.innerHTML = `
    <section class="tk-modal-hero">
      <h2>${name}</h2>
      <p>Comprehensive athlete profile with ranking, trend, consistency, and per-event breakdowns.</p>
    </section>
    ${summaryCards}
    ${insights}
    <section class="tk-modal-table-block">
      <h3>Event Analytics</h3>
      <div class="tk-modal-table-wrap">
        <table class="tk-modal-analytics-table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Best</th>
              <th>Average</th>
              <th>Median</th>
              <th>Worst</th>
              <th>Consistency</th>
              <th>Overall Rank</th>
              <th>Grade Rank</th>
              <th>Gap to Leader</th>
              <th>Improvement</th>
            </tr>
          </thead>
          <tbody>${eventRows}</tbody>
        </table>
      </div>
    </section>
    <section class="tk-modal-charts-grid">
      ${chartBlocks}
    </section>
  `;
  el.modal.hidden = false;

  bundles.forEach((b, idx) => {
    const canvas = document.getElementById(`tkModalChart${idx}`);
    drawModalEventChart(canvas, b, name);
  });
  applyRevealAnimation(el.modalContent);
}

function drawModalEventChart(canvas, bundle, athleteName) {
  if (!canvas || !bundle) return;
  bindCanvasInteraction(canvas);
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  if (!bundle.attempts.length) {
    ctx.fillStyle = '#556a88';
    ctx.font = '12px Inter';
    ctx.fillText('No timed marks for this event yet', 20, H / 2);
    setChartHotspots(canvas, []);
    return;
  }

  const pad = { top: 20, bottom: 32, left: 56, right: 20 };
  const areaW = W - pad.left - pad.right;
  const areaH = H - pad.top - pad.bottom;
  const minT = Math.min(...bundle.values) * 0.96;
  const maxT = Math.max(...bundle.values) * 1.04;
  const range = (maxT - minT) || 1;
  const hotspots = [];

  ctx.strokeStyle = 'rgba(100,180,255,.08)';
  for (let i = 0; i <= 3; i++) {
    const y = pad.top + (areaH / 3) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(W - pad.right, y);
    ctx.stroke();
    const value = maxT - (range / 3) * i;
    ctx.fillStyle = '#556a88';
    ctx.font = '10px Inter';
    ctx.textAlign = 'right';
    ctx.fillText(formatTime(value), pad.left - 7, y + 4);
  }

  const color = GRADE_COLORS[bundle.athlete.grade] || '#7ee8ff';
  const projection = computeTrendProjection(bundle.attempts);

  if (projection) {
    const projX = pad.left + areaW;
    const predY = pad.top + ((maxT - projection.predicted) / range) * areaH;
    const lowY = pad.top + ((maxT - projection.lower) / range) * areaH;
    const highY = pad.top + ((maxT - projection.upper) / range) * areaH;

    ctx.fillStyle = 'rgba(126,232,255,.16)';
    ctx.beginPath();
    ctx.rect(projX - 12, Math.min(lowY, highY), 24, Math.abs(highY - lowY));
    ctx.fill();
    ctx.strokeStyle = 'rgba(126,232,255,.45)';
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(projX - 12, predY);
    ctx.lineTo(projX + 12, predY);
    ctx.stroke();
    ctx.setLineDash([]);

    hotspots.push({
      type: 'rect',
      x: projX - 14,
      y: Math.min(lowY, highY) - 4,
      w: 28,
      h: Math.abs(highY - lowY) + 8,
      tooltip: `<strong>${athleteName}</strong><br>Projected next: ${formatTime(projection.predicted)}<br>Band: ${formatTime(projection.lower)} - ${formatTime(projection.upper)}`
    });
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.3;
  ctx.beginPath();
  bundle.attempts.forEach((pt, i) => {
    const x = pad.left + (bundle.attempts.length === 1 ? areaW / 2 : (i / (bundle.attempts.length - 1)) * areaW);
    const y = pad.top + ((maxT - pt.time) / range) * areaH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  bundle.attempts.forEach((pt, i) => {
    const x = pad.left + (bundle.attempts.length === 1 ? areaW / 2 : (i / (bundle.attempts.length - 1)) * areaW);
    const y = pad.top + ((maxT - pt.time) / range) * areaH;
    ctx.beginPath();
    ctx.arc(x, y, 4.8, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#08162c';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.fillStyle = '#8fb8dc';
    ctx.font = '10px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(pt.date, x, H - 10);

    hotspots.push({
      type: 'circle',
      x,
      y,
      r: 10,
      tooltip: `<strong>${athleteName}</strong><br>${bundle.sheet.label} • ${pt.date}<br>Time: ${formatTime(pt.time)}`
    });
  });

  setChartHotspots(canvas, hotspots);
}

/* ── Charts ── */
function drawTop10(athletes) {
  const canvas = el.chartTop10;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const timed = timedAthletes(athletes).sort((a, b) => a.best - b.best).slice(0, 10);
  if (timed.length === 0) { setChartHotspots(canvas, []); ctx.fillStyle = '#556a88'; ctx.font = '13px Inter'; ctx.fillText('No data', W / 2 - 20, H / 2); return; }
  const maxTime = Math.max(...timed.map((a) => a.best));
  const pad = { top: 10, bottom: 20, left: 130, right: 50 };
  const barH = Math.min(22, (H - pad.top - pad.bottom) / timed.length - 4);
  const areaW = W - pad.left - pad.right;
  const hotspots = [];
  timed.forEach((a, i) => {
    const y = pad.top + i * (barH + 4);
    const w = (a.best / maxTime) * areaW;
    const color = GRADE_COLORS[a.grade] || '#7ee8ff';
    ctx.fillStyle = color; ctx.globalAlpha = 0.7; ctx.fillRect(pad.left, y, w, barH); ctx.globalAlpha = 1;
    ctx.fillStyle = '#d4e0f0'; ctx.font = '11px Inter'; ctx.textAlign = 'right';
    ctx.fillText(a.name, pad.left - 6, y + barH / 2 + 4);
    ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff'; ctx.font = 'bold 11px Inter';
    ctx.fillText(formatTime(a.best), pad.left + w + 5, y + barH / 2 + 4);
    hotspots.push({
      type: 'rect',
      x: pad.left,
      y,
      w,
      h: barH,
      tooltip: `<strong>${a.name}</strong><br>Best: ${formatTime(a.best)}<br>Grade: ${a.grade}<br>Click for full profile`,
      onClick: () => showAthleteModal(a.name)
    });
  });
  setChartHotspots(canvas, hotspots);
}

function drawGradeChart(athletes) {
  const canvas = el.chartGrade;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const grades = [6, 7, 8];
  const gradeData = grades.map((g) => {
    const timed = athletes.filter((a) => a.grade === g && a.best !== null);
    if (timed.length === 0) return { grade: g, avg: 0, best: 0, count: 0 };
    const bests = timed.map((a) => a.best);
    return { grade: g, avg: bests.reduce((s, v) => s + v, 0) / bests.length, best: Math.min(...bests), count: timed.length };
  });
  const maxVal = Math.max(...gradeData.map((d) => d.avg), 1);
  const pad = { top: 20, bottom: 38, left: 56, right: 20 };
  const areaW = W - pad.left - pad.right, areaH = H - pad.top - pad.bottom;
  const groupW = areaW / grades.length;
  const hotspots = [];
  ctx.strokeStyle = 'rgba(100,180,255,.08)';
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (areaH / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    ctx.fillStyle = '#556a88'; ctx.font = '10px Inter'; ctx.textAlign = 'right';
    ctx.fillText(formatTime(maxVal - (maxVal / 4) * i), pad.left - 6, y + 4);
  }
  gradeData.forEach((d, i) => {
    const x = pad.left + groupW * i;
    const bW = groupW * 0.3, gapW = groupW * 0.08;
    const avgH = d.avg > 0 ? (d.avg / maxVal) * areaH : 0;
    const bestH = d.best > 0 ? (d.best / maxVal) * areaH : 0;
    ctx.fillStyle = GRADE_COLORS[d.grade] || '#7ee8ff';
    ctx.globalAlpha = 0.5; ctx.fillRect(x + gapW, pad.top + areaH - avgH, bW, avgH);
    ctx.globalAlpha = 0.85; ctx.fillRect(x + gapW + bW + 4, pad.top + areaH - bestH, bW, bestH);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#d4e0f0'; ctx.font = '11px Inter'; ctx.textAlign = 'center';
    ctx.fillText(`Grade ${d.grade}`, x + groupW / 2, H - pad.bottom + 16);
    ctx.font = '9px Inter'; ctx.fillStyle = '#8fb8dc';
    ctx.fillText('avg', x + gapW + bW / 2, H - pad.bottom + 28);
    ctx.fillText('best', x + gapW + bW + 4 + bW / 2, H - pad.bottom + 28);
    hotspots.push({
      type: 'rect',
      x: x + gapW,
      y: pad.top + areaH - avgH,
      w: bW,
      h: avgH,
      tooltip: `<strong>Grade ${d.grade}</strong><br>Average: ${formatTime(d.avg)}<br>Timed Athletes: ${d.count}`
    });
    hotspots.push({
      type: 'rect',
      x: x + gapW + bW + 4,
      y: pad.top + areaH - bestH,
      w: bW,
      h: bestH,
      tooltip: `<strong>Grade ${d.grade}</strong><br>Best: ${formatTime(d.best)}<br>Timed Athletes: ${d.count}`
    });
  });
  setChartHotspots(canvas, hotspots);
}

function drawHistogram(athletes) {
  const canvas = el.chartHist;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const bests = timedAthletes(athletes).map((a) => a.best).sort((a, b) => a - b);
  if (bests.length < 2) { setChartHotspots(canvas, []); ctx.fillStyle = '#556a88'; ctx.font = '13px Inter'; ctx.fillText('Not enough data', W / 2 - 40, H / 2); return; }
  const min = bests[0], max = bests[bests.length - 1];
  const binCount = Math.min(16, Math.max(6, Math.ceil(Math.sqrt(bests.length))));
  const binSize = (max - min) / binCount || 1;
  const bins = new Array(binCount).fill(0);
  bests.forEach((v) => { let idx = Math.floor((v - min) / binSize); if (idx >= binCount) idx = binCount - 1; bins[idx]++; });
  const maxBin = Math.max(...bins);
  const pad = { top: 12, bottom: 34, left: 40, right: 14 };
  const areaW = W - pad.left - pad.right, areaH = H - pad.top - pad.bottom;
  const bW = areaW / binCount;
  const hotspots = [];
  bins.forEach((count, i) => {
    const h = maxBin > 0 ? (count / maxBin) * areaH : 0;
    const x = pad.left + i * bW, y = pad.top + areaH - h;
    ctx.fillStyle = 'rgba(110,198,255,0.55)'; ctx.fillRect(x + 1, y, bW - 2, h);
    if (count > 0) { ctx.fillStyle = '#ffffff'; ctx.font = '10px Inter'; ctx.textAlign = 'center'; ctx.fillText(count, x + bW / 2, y - 3); }
    ctx.fillStyle = '#556a88'; ctx.font = '9px Inter'; ctx.textAlign = 'center';
    if (i % 2 === 0 || binCount <= 8) ctx.fillText(formatTime(min + i * binSize), x + bW / 2, H - pad.bottom + 14);
    hotspots.push({
      type: 'rect',
      x: x + 1,
      y,
      w: bW - 2,
      h,
      tooltip: `<strong>Range:</strong> ${formatTime(min + i * binSize)} to ${formatTime(min + (i + 1) * binSize)}<br><strong>Athletes:</strong> ${count}`
    });
  });
  ctx.strokeStyle = 'rgba(100,180,255,.08)'; ctx.beginPath(); ctx.moveTo(pad.left, pad.top + areaH); ctx.lineTo(pad.left + areaW, pad.top + areaH); ctx.stroke();
  setChartHotspots(canvas, hotspots);
}

function drawPie(athletes) {
  const canvas = el.chartPie;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const grades = [6, 7, 8];
  const slices = grades.map((g) => { const grp = athletes.filter((a) => a.grade === g); return { grade: g, timed: grp.filter((a) => a.best !== null).length, total: grp.length }; });
  const totalAll = athletes.length || 1;
  const cx = W * 0.35, cy = H * 0.5, r = Math.min(cx - 20, cy - 20, 110);
  let angle = -Math.PI / 2;
  const hotspots = [];
  slices.forEach((sl) => {
    const startTimed = angle;
    const timedAngle   = (sl.timed / totalAll) * Math.PI * 2;
    const untimedAngle = ((sl.total - sl.timed) / totalAll) * Math.PI * 2;
    const gc = GRADE_COLORS[sl.grade];
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, angle, angle + timedAngle); ctx.closePath();
    ctx.fillStyle = gc; ctx.globalAlpha = 0.8; ctx.fill(); angle += timedAngle;
    hotspots.push({
      type: 'arc',
      cx,
      cy,
      r,
      start: startTimed,
      end: startTimed + timedAngle,
      tooltip: `<strong>Grade ${sl.grade}</strong><br>Timed: ${sl.timed}<br>Total: ${sl.total}`
    });
    const startUntimed = angle;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, angle, angle + untimedAngle); ctx.closePath();
    ctx.fillStyle = gc; ctx.globalAlpha = 0.2; ctx.fill(); angle += untimedAngle;
    hotspots.push({
      type: 'arc',
      cx,
      cy,
      r,
      start: startUntimed,
      end: startUntimed + untimedAngle,
      tooltip: `<strong>Grade ${sl.grade}</strong><br>Untimed: ${Math.max(0, sl.total - sl.timed)}<br>Total: ${sl.total}`
    });
  });
  ctx.globalAlpha = 1;
  const legendX = W * 0.68; let legendY = 40;
  slices.forEach((sl) => {
    ctx.fillStyle = GRADE_COLORS[sl.grade]; ctx.fillRect(legendX, legendY, 12, 12);
    ctx.fillStyle = '#d4e0f0'; ctx.font = '12px Inter'; ctx.textAlign = 'left';
    ctx.fillText(`Gr ${sl.grade}: ${sl.timed} timed / ${sl.total}`, legendX + 18, legendY + 10);
    legendY += 24;
  });
  setChartHotspots(canvas, hotspots);
}

function drawProgress(athletes, sheetData) {
  const canvas = el.chartProgress;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const selectedName = el.athleteSelect.value;
  const athlete = athletes.find((a) => a.name === selectedName);
  if (!athlete) { setChartHotspots(canvas, []); ctx.fillStyle = '#556a88'; ctx.font = '13px Inter'; ctx.textAlign = 'left'; ctx.fillText('Select an athlete above', W / 2 - 80, H / 2); return; }
  const points = sheetData.dateCols.map((dc) => ({ date: dc, time: athlete.times[dc] })).filter((p) => p.time !== null);
  const hotspots = [];
  if (points.length === 0) { setChartHotspots(canvas, []); ctx.fillStyle = '#556a88'; ctx.font = '13px Inter'; ctx.fillText('No times recorded in this event', W / 2 - 100, H / 2); return; }
  const pad = { top: 24, bottom: 40, left: 60, right: 30 };
  const areaW = W - pad.left - pad.right, areaH = H - pad.top - pad.bottom;
  const timesArr = points.map((p) => p.time);
  const minT = Math.min(...timesArr) * 0.96, maxT = Math.max(...timesArr) * 1.04 || 1;
  const range = maxT - minT || 1;
  ctx.strokeStyle = 'rgba(100,180,255,.08)';
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (areaH / 4) * i; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    ctx.fillStyle = '#556a88'; ctx.font = '10px Inter'; ctx.textAlign = 'right'; ctx.fillText(formatTime(maxT - (range / 4) * i), pad.left - 8, y + 4);
  }
  const color = GRADE_COLORS[athlete.grade] || '#7ee8ff';
  const projection = computeTrendProjection(points);

  if (projection) {
    const xLast = pad.left + (points.length === 1 ? areaW / 2 : ((points.length - 1) / (points.length - 1)) * areaW);
    const xPred = pad.left + areaW + 18;
    const yLast = pad.top + ((maxT - points[points.length - 1].time) / range) * areaH;
    const yPred = pad.top + ((maxT - projection.predicted) / range) * areaH;
    const yLow = pad.top + ((maxT - projection.lower) / range) * areaH;
    const yHigh = pad.top + ((maxT - projection.upper) / range) * areaH;

    ctx.strokeStyle = 'rgba(126,232,255,.45)';
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(xLast, yLast);
    ctx.lineTo(xPred, yPred);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(126,232,255,.16)';
    ctx.fillRect(xPred - 6, Math.min(yLow, yHigh), 12, Math.abs(yHigh - yLow));
    ctx.beginPath();
    ctx.arc(xPred, yPred, 4.8, 0, Math.PI * 2);
    ctx.fillStyle = '#9de7ff';
    ctx.fill();

    ctx.fillStyle = '#9ecdf6';
    ctx.font = '10px Inter';
    ctx.textAlign = 'left';
    ctx.fillText('Projected next', xPred + 8, yPred + 4);

    hotspots.push({
      type: 'rect',
      x: xPred - 8,
      y: Math.min(yLow, yHigh) - 4,
      w: 16,
      h: Math.abs(yHigh - yLow) + 8,
      tooltip: `<strong>${athlete.name}</strong><br>Projected next: ${formatTime(projection.predicted)}<br>Likely range: ${formatTime(projection.lower)} - ${formatTime(projection.upper)}`
    });
  }

  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.beginPath();
  points.forEach((p, i) => {
    const x = pad.left + (points.length === 1 ? areaW / 2 : (i / (points.length - 1)) * areaW);
    const y = pad.top + ((maxT - p.time) / range) * areaH;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  points.forEach((p, i) => {
    const x = pad.left + (points.length === 1 ? areaW / 2 : (i / (points.length - 1)) * areaW);
    const y = pad.top + ((maxT - p.time) / range) * areaH;
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = '#0c1a32'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Inter'; ctx.textAlign = 'center'; ctx.fillText(formatTime(p.time), x, y - 10);
    ctx.fillStyle = '#8fb8dc'; ctx.font = '10px Inter'; ctx.fillText(p.date, x, H - pad.bottom + 16);
    hotspots.push({
      type: 'circle',
      x,
      y,
      r: 9,
      tooltip: `<strong>${athlete.name}</strong><br>${p.date}: ${formatTime(p.time)}`
    });
  });
  ctx.lineWidth = 1;
  setChartHotspots(canvas, hotspots);
}

function getTimelineFrameModel(athletes, sheetData, frameIndex) {
  const dates = sheetData?.dateCols || [];
  if (!dates.length) return null;
  const idx = Math.min(Math.max(frameIndex, 0), dates.length - 1);
  const date = dates[idx];
  const leaders = athletes
    .map((athlete) => ({
      name: athlete.name,
      grade: athlete.grade,
      time: athlete.times[date] ?? null
    }))
    .filter((row) => row.time != null)
    .sort((a, b) => a.time - b.time)
    .slice(0, 8)
    .map((row, i) => ({ ...row, rank: i + 1 }));
  const maxT = leaders.length ? Math.max(...leaders.map((l) => l.time)) : 1;
  return { idx, date, leaders, maxT };
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

function drawTimelineChart(athletes, sheetData, frameIndex, opts = {}) {
  const canvas = el.chartTimeline;
  if (!canvas || !sheetData) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const dates = sheetData.dateCols || [];
  if (!dates.length) {
    setChartHotspots(canvas, []);
    ctx.fillStyle = '#556a88';
    ctx.font = '13px Inter';
    ctx.fillText('No date columns found for timeline replay', W / 2 - 130, H / 2);
    return;
  }

  const current = getTimelineFrameModel(athletes, sheetData, frameIndex);
  if (!current || !current.leaders.length) {
    setChartHotspots(canvas, []);
    const fallbackDate = dates[Math.min(Math.max(frameIndex, 0), dates.length - 1)] || 'this date';
    ctx.fillStyle = '#556a88';
    ctx.font = '13px Inter';
    ctx.fillText(`No recorded marks on ${fallbackDate}`, W / 2 - 82, H / 2);
    return;
  }

  const fromIdx = opts.fromIndex == null ? current.idx : opts.fromIndex;
  const prev = getTimelineFrameModel(athletes, sheetData, fromIdx) || current;
  const t = Math.min(Math.max(opts.t ?? 1, 0), 1);
  const ghostEnabled = opts.ghostEnabled !== false;
  const maxT = (prev.maxT * (1 - t)) + (current.maxT * t);

  if (el.timelineLabel) el.timelineLabel.textContent = current.date;
  if (el.timelineRange && String(el.timelineRange.value) !== String(current.idx)) el.timelineRange.value = String(current.idx);

  const pad = { top: 28, bottom: 28, left: 178, right: 48 };
  const areaW = W - pad.left - pad.right;
  const rowH = Math.min(24, (H - pad.top - pad.bottom) / current.leaders.length - 5);
  const hotspots = [];
  const prevMap = new Map(prev.leaders.map((row) => [row.name, row]));

  if (ghostEnabled) {
    prev.leaders.forEach((leader, i) => {
      const y = pad.top + i * (rowH + 5);
      const width = (leader.time / Math.max(prev.maxT, 0.001)) * areaW;
      const color = GRADE_COLORS[leader.grade] || '#7ee8ff';
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.22;
      ctx.fillRect(pad.left, y, width, rowH);
    });
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = '#8fb8dc';
  ctx.font = '11px Inter';
  ctx.textAlign = 'left';
  ctx.fillText(`Top marks on ${current.date}`, pad.left, 16);

  current.leaders.forEach((leader, i) => {
    const prevLeader = prevMap.get(leader.name) || leader;
    const rankA = (prevLeader.rank || (i + 1)) - 1;
    const rankB = i;
    const interpRank = rankA + (rankB - rankA) * t;
    const y = pad.top + interpRank * (rowH + 5);
    const interpTime = prevLeader.time + (leader.time - prevLeader.time) * t;
    const width = (interpTime / Math.max(maxT, 0.001)) * areaW;
    const color = GRADE_COLORS[leader.grade] || '#7ee8ff';

    if (ghostEnabled && prevMap.has(leader.name)) {
      const yFrom = pad.top + rankA * (rowH + 5) + rowH / 2;
      const yTo = y + rowH / 2;
      ctx.strokeStyle = 'rgba(126,232,255,.22)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(pad.left - 20, yFrom);
      ctx.lineTo(pad.left - 20, yTo);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.74;
    ctx.fillRect(pad.left, y, width, rowH);
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#d4e0f0';
    ctx.font = '11px Inter';
    ctx.textAlign = 'right';
    ctx.fillText(`#${i + 1} ${leader.name}`, pad.left - 8, y + rowH / 2 + 4);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(formatTime(leader.time), pad.left + width + 6, y + rowH / 2 + 4);

    hotspots.push({
      type: 'rect',
      x: pad.left,
      y,
      w: width,
      h: rowH,
      tooltip: `<strong>#${i + 1} ${leader.name}</strong><br>${current.date}: ${formatTime(leader.time)}<br>Grade: ${leader.grade}<br>Click for full profile`,
      onClick: () => showAthleteModal(leader.name)
    });
  });

  setChartHotspots(canvas, hotspots);
}

function animateTimelineTransition(athletes, sheetData, fromIndex, toIndex, options = {}) {
  const duration = options.durationMs || Math.max(220, Math.min(620, timelineSpeedMs * 0.55));
  const onComplete = typeof options.onComplete === 'function' ? options.onComplete : null;
  if (timelineAnimRaf) {
    window.cancelAnimationFrame(timelineAnimRaf);
    timelineAnimRaf = null;
  }

  if (fromIndex === toIndex) {
    drawTimelineChart(athletes, sheetData, toIndex, { ghostEnabled: timelineGhostOn });
    timelineLastRenderedFrame = toIndex;
    timelineFrame = toIndex;
    if (onComplete) onComplete();
    return;
  }
  const started = performance.now();

  const step = (now) => {
    const raw = Math.min(1, (now - started) / duration);
    const eased = easeInOutCubic(raw);
    drawTimelineChart(athletes, sheetData, toIndex, {
      fromIndex,
      t: eased,
      ghostEnabled: timelineGhostOn
    });

    if (raw < 1) {
      timelineAnimRaf = window.requestAnimationFrame(step);
      return;
    }
    timelineAnimRaf = null;
    timelineLastRenderedFrame = toIndex;
    timelineFrame = toIndex;
    if (onComplete) onComplete();
  };

  timelineAnimRaf = window.requestAnimationFrame(step);
}

function renderTimelineReplay(athletes, sheetData) {
  if (!el.timelineWrap || !el.timelineRange || !el.timelinePlay) return;
  const dates = sheetData?.dateCols || [];
  timelineDates = dates;
  timelineAthletes = athletes;
  timelineSheetData = sheetData;
  timelineGhostOn = el.timelineGhost ? el.timelineGhost.checked : timelineGhostOn;
  if (!dates.length) {
    el.timelineWrap.hidden = true;
    stopTimelinePlayback();
    return;
  }

  el.timelineWrap.hidden = false;
  el.timelineRange.max = String(Math.max(0, dates.length - 1));
  timelineFrame = Math.min(Math.max(timelineFrame, 0), dates.length - 1);
  timelineLastRenderedFrame = timelineFrame;
  drawTimelineChart(athletes, sheetData, timelineFrame, { ghostEnabled: timelineGhostOn });
  el.timelinePlay.disabled = dates.length <= 1;
  if (dates.length <= 1) {
    stopTimelinePlayback();
    el.timelinePlay.textContent = 'Only 1 Date';
  } else if (!timelinePlaying) {
    el.timelinePlay.textContent = '▶ Play';
  }
}

function populateAthleteSelect(athletes) {
  const prev = el.athleteSelect.value;
  const sorted = [...athletes].filter((a) => a.best !== null).sort((a, b) => a.name.localeCompare(b.name));
  el.athleteSelect.innerHTML = '<option value="">Select an athlete…</option>' +
    sorted.map((a) => `<option value="${a.name}"${a.name === prev ? ' selected' : ''}>${a.name} (Gr ${a.grade})</option>`).join('');
}

/* ── HUD update ── */
function updateHud(stats) {
  if (!el.fastest) return;
  el.fastest.textContent       = formatTime(stats.fastest);
  el.average.textContent       = formatTime(stats.avg);
  el.median.textContent        = formatTime(stats.median);
  el.participation.textContent = `${stats.timedCount}`;
  el.roster.textContent        = `${stats.total}`;
  if (stats.mostImproved && stats.bestImprovement > 0)
    el.improved.textContent = `${stats.mostImproved.name} (−${stats.bestImprovement.toFixed(2)}s)`;
  else el.improved.textContent = '—';
}

/* ── Main render dispatcher ── */
async function render() {
  el.loading.classList.remove('hidden');

  if (currentView === 'athletes') {
    await renderAthletesView();
    el.loading.classList.add('hidden');
    return;
  }
  if (currentView === 'relay') {
    await renderRelayView();
    el.loading.classList.add('hidden');
    return;
  }
  if (currentView === 'standards') {
    renderStandardsPanel();
    el.loading.classList.add('hidden');
    return;
  }
  if (currentView === 'compare') {
    if (el.cmpA.options.length <= 1) await populateCompareSelects();
    await renderCompareView();
    el.loading.classList.add('hidden');
    return;
  }

  // Dashboard + Leaderboard
  const data = await fetchSheet(currentSheet);
  if (!data) { el.loading.classList.add('hidden'); return; }

  const allAthletes = processData(data);
  const filtered    = filterAthletes(allAthletes);
  const stats       = computeStats(filtered);

  updateHud(stats);
  renderTable(filtered, data);

  if (currentView === 'dashboard') {
    drawTop10(filtered);
    drawGradeChart(allAthletes);
    drawHistogram(filtered);
    drawPie(allAthletes);
    populateAthleteSelect(filtered);
    drawProgress(filtered, data);
    renderTimelineReplay(filtered, data);
    await renderEventPulse(filtered, data);
    await renderPowerRankings();
    renderWatchlist(filtered);
    await renderPinnedSection();
  } else {
    stopTimelinePlayback();
  }

  applyRevealAnimation(document);
  el.loading.classList.add('hidden');
}

/* ── Event bindings ── */
function bindEvents() {
  // View navigation
  el.views.addEventListener('click', (e) => {
    const btn = e.target.closest('.tk-view');
    if (!btn) return;
    switchView(btn.dataset.view);
  });

  // Event tabs
  el.tabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.tk-tab');
    if (!tab) return;
    el.tabs.querySelectorAll('.tk-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    stopTimelinePlayback();
    timelineFrame = 0;
    timelineLastRenderedFrame = 0;
    currentSheet = tab.dataset.sheet;
    sortCol = null; sortAsc = true;
    delete cache[currentSheet];
    render();
  });

  // Grade filters (main)
  el.gradeFilters.addEventListener('click', (e) => {
    const btn = e.target.closest('.tk-grade');
    if (!btn) return;
    el.gradeFilters.querySelectorAll('.tk-grade').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentGrade = btn.dataset.grade;
    render();
  });

  // Search (main)
  el.search.addEventListener('input', () => { currentSearch = el.search.value; render(); });

  // Table head sort
  el.tableHead.addEventListener('click', (e) => {
    const th = e.target.closest('th');
    if (!th) return;
    const col = parseInt(th.dataset.col, 10);
    if (sortCol === col) sortAsc = !sortAsc; else { sortCol = col; sortAsc = true; }
    render();
  });

  // Pin athlete button (delegated from table body + pinned section)
  document.body.addEventListener('click', (e) => {
    const pinBtn = e.target.closest('.tk-pin');
    if (pinBtn) {
      const name = decodeURIComponent(pinBtn.dataset.pin);
      togglePin(name);
      render();
      return;
    }
    const link = e.target.closest('.tk-clickable');
    if (link) { showAthleteModal(decodeURIComponent(link.dataset.athlete)); return; }
    const qualChip = e.target.closest('.tk-qual-chip');
    if (qualChip) { showAthleteModal(decodeURIComponent(qualChip.dataset.athlete)); return; }
    const watchChip = e.target.closest('[data-athlete]');
    if (watchChip && watchChip.classList.contains('tk-watch-chip')) {
      showAthleteModal(decodeURIComponent(watchChip.dataset.athlete));
      return;
    }
  });

  // Athlete select (progress chart)
  el.athleteSelect.addEventListener('change', async () => {
    const data = await fetchSheet(currentSheet);
    if (!data) return;
    const athletes = filterAthletes(processData(data));
    drawProgress(athletes, data);
  });

  // Timeline replay controls
  el.timelineRange?.addEventListener('input', async () => {
    stopTimelinePlayback();
    if (!timelineSheetData || !timelineAthletes.length) return;
    const nextFrame = parseInt(el.timelineRange.value, 10) || 0;
    animateTimelineTransition(timelineAthletes, timelineSheetData, timelineLastRenderedFrame, nextFrame);
  });

  el.timelinePlay?.addEventListener('click', () => {
    if (timelinePlaying) {
      stopTimelinePlayback();
      return;
    }
    startTimelinePlayback();
  });

  el.timelineSpeed?.addEventListener('change', () => {
    const nextMs = parseInt(el.timelineSpeed.value, 10);
    timelineSpeedMs = Number.isFinite(nextMs) ? Math.max(250, nextMs) : 950;
    if (!timelinePlaying) return;
    stopTimelinePlayback();
    startTimelinePlayback();
  });

  el.timelineGhost?.addEventListener('change', () => {
    timelineGhostOn = !!el.timelineGhost.checked;
    if (!timelineSheetData || !timelineAthletes.length) return;
    drawTimelineChart(timelineAthletes, timelineSheetData, timelineLastRenderedFrame, { ghostEnabled: timelineGhostOn });
  });

  // Modal close
  el.modalClose.addEventListener('click', () => { el.modal.hidden = true; });
  el.modal.addEventListener('click', (e) => { if (e.target === el.modal) el.modal.hidden = true; });

  // Athletes view — grade filter
  el.athGradeFilters.addEventListener('click', (e) => {
    const btn = e.target.closest('.tk-grade');
    if (!btn) return;
    el.athGradeFilters.querySelectorAll('.tk-grade').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    athletesGrade = btn.dataset.agrade;
    renderAthletesView();
  });

  // Athletes view — search
  el.athSearch.addEventListener('input', () => { athletesSearch = el.athSearch.value; renderAthletesView(); });

  // Relay grade filter
  el.relayGrade.addEventListener('click', (e) => {
    const btn = e.target.closest('.tk-grade');
    if (!btn) return;
    el.relayGrade.querySelectorAll('.tk-grade').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    relayGrade = btn.dataset.rgrade;
    renderRelayView();
  });

  // Compare selects
  el.cmpA.addEventListener('change', () => { compareA = el.cmpA.value; renderCompareView(); });
  el.cmpB.addEventListener('change', () => { compareB = el.cmpB.value; renderCompareView(); });

  // Compare event tabs (delegated)
  el.cmpEventTabs.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-cev]');
    if (!btn) return;
    compareEventKey = btn.dataset.cev;
    el.cmpEventTabs.querySelectorAll('[data-cev]').forEach((b) => b.classList.toggle('active', b.dataset.cev === compareEventKey));
    const [dataA, dataB] = await Promise.all([fetchSheet(compareEventKey), fetchSheet(compareEventKey)]);
    const athA = processData(dataA).find((a) => a.name === compareA);
    const athB = processData(dataB).find((a) => a.name === compareB);
    el.compareChartTitle.textContent = `Progress Comparison — ${compareEventKey}`;
    await drawCompareChart(athA, athB, dataA, compareA, compareB);
  });
}

/* ── Boot ── */
async function boot() {
  if (!el.tabs) return;

  loadPins();
  loadStandards();
  bindEvents();
  bindStaticChartInteractions();
  applyRevealAnimation(document);

  // Start with dashboard view active
  switchView('dashboard');
}

boot();
