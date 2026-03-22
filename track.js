/* ── Harker MS Track 2026 — Live Dashboard JS ── */

const SPREADSHEET_ID = '1otSAiM7Y8u5l0_ZxjA9snO2VV2XYGOOwWCAWFq-epR4';

const SHEETS = [
  { key: '50 M',   label: '50 M' },
  { key: '100 M',  label: '100 M' },
  { key: '200 M',  label: '200 M' },
  { key: '400 M',  label: '400 M' },
  { key: '800 M',  label: '800 M' },
  { key: '1200 M (7th and 8th ONLY)', label: '1200 M' }
];

const GRADE_COLORS = { 6: '#85e89d', 7: '#b8a8ff', 8: '#7ee8ff' };

/* ── State ── */
const cache = {};
let currentSheet = '50 M';
let currentGrade = 'all';
let currentSearch = '';
let sortCol = null;
let sortAsc = true;

/* ── DOM refs ── */
const $ = (id) => document.getElementById(id);
const el = {
  tabs:       $('tkTabs'),
  gradeFilters: $('tkGradeFilters'),
  search:     $('tkSearch'),
  fastest:    $('tkFastest'),
  average:    $('tkAverage'),
  median:     $('tkMedian'),
  participation: $('tkParticipation'),
  improved:   $('tkImproved'),
  roster:     $('tkRoster'),
  tableHead:  $('tkTableHead'),
  tableBody:  $('tkTableBody'),
  chartTop10: $('tkChartTop10'),
  chartGrade: $('tkChartGrade'),
  chartHist:  $('tkChartHist'),
  chartPie:   $('tkChartPie'),
  chartProgress: $('tkChartProgress'),
  athleteSelect: $('tkAthleteSelect'),
  modal:      $('tkModal'),
  modalContent: $('tkModalContent'),
  modalClose: $('tkModalClose'),
  loading:    $('tkLoading')
};

/* ── Fetch from Google Sheets gviz endpoint ── */
function sheetUrl(sheetName) {
  const encoded = encodeURIComponent(sheetName);
  return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encoded}`;
}

async function fetchSheet(sheetName) {
  if (cache[sheetName]) return cache[sheetName];

  const resp = await fetch(sheetUrl(sheetName));
  const text = await resp.text();

  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd < 0) return null;

  const data = JSON.parse(text.substring(jsonStart, jsonEnd + 1));
  const table = data.table;

  const cols = table.cols.map((c) => c.label || c.id);
  const rows = (table.rows || []).map((r) => {
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
}

/* ── Time parsing ── */
function parseTimeStr(val) {
  if (val == null) return null;
  if (typeof val === 'number') return val;
  const s = String(val).trim();
  if (!s) return null;

  const parts = s.split('.');
  if (parts.length === 3) {
    const mins = parseInt(parts[0], 10);
    const secs = parseInt(parts[1], 10);
    const cent = parseInt(parts[2], 10);
    if (isNaN(mins) || isNaN(secs)) return null;
    return mins * 60 + secs + (isNaN(cent) ? 0 : cent / 100);
  }

  const num = parseFloat(s);
  return isNaN(num) ? null : num;
}

function formatTime(seconds) {
  if (seconds == null) return '—';
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const remainder = seconds - m * 60;
    const s = Math.floor(remainder);
    const cs = Math.round((remainder - s) * 100);
    return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }
  return seconds.toFixed(2);
}

/* ── Data processing ── */
function processData(sheetData) {
  if (!sheetData) return [];

  return sheetData.rows.map((row) => {
    const lastName = row['Last Name'] || '';
    const firstName = row['First Name'] || '';
    const grade = row['Grade'] != null ? Math.round(row['Grade']) : 0;
    const times = {};
    let best = null;
    let bestDate = null;
    let first = null;
    let firstDate = null;
    let last = null;
    let lastDate = null;

    sheetData.dateCols.forEach((dc, i) => {
      const t = parseTimeStr(row[dc]);
      times[dc] = t;
      if (t != null) {
        if (best === null || t < best) { best = t; bestDate = dc; }
        if (first === null) { first = t; firstDate = dc; }
        last = t; lastDate = dc;
      }
    });

    const improvement = (first !== null && last !== null && firstDate !== lastDate)
      ? first - last
      : null;

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

function timedAthletes(athletes) {
  return athletes.filter((a) => a.best !== null);
}

/* ── Stats ── */
function computeStats(athletes) {
  const timed = timedAthletes(athletes);
  const bests = timed.map((a) => a.best).sort((a, b) => a - b);

  const fastest = bests.length > 0 ? bests[0] : null;
  const avg = bests.length > 0 ? bests.reduce((s, v) => s + v, 0) / bests.length : null;
  const median = bests.length > 0 ? bests[Math.floor(bests.length / 2)] : null;

  let mostImproved = null;
  let bestImprovement = -Infinity;
  timed.forEach((a) => {
    if (a.improvement !== null && a.improvement > bestImprovement) {
      bestImprovement = a.improvement;
      mostImproved = a;
    }
  });

  return { fastest, avg, median, timedCount: timed.length, total: athletes.length, mostImproved, bestImprovement };
}

function renderStats(stats) {
  el.fastest.textContent = formatTime(stats.fastest);
  el.average.textContent = formatTime(stats.avg);
  el.median.textContent = formatTime(stats.median);
  el.participation.textContent = `${stats.timedCount}`;
  el.roster.textContent = `${stats.total}`;

  if (stats.mostImproved && stats.bestImprovement > 0) {
    el.improved.textContent = `${stats.mostImproved.name} (−${stats.bestImprovement.toFixed(2)}s)`;
  } else {
    el.improved.textContent = '—';
  }
}

/* ── Table ── */
function renderTable(athletes, sheetData) {
  const dateCols = sheetData.dateCols;
  const headers = ['#', 'Name', 'Grade', ...dateCols, 'Best'];

  el.tableHead.innerHTML = headers.map((h, i) => {
    const arrow = sortCol === i ? (sortAsc ? ' ▲' : ' ▼') : '';
    return `<th data-col="${i}">${h}${arrow}</th>`;
  }).join('');

  let sorted = [...athletes];
  if (sortCol !== null) {
    sorted.sort((a, b) => {
      let va, vb;
      if (sortCol === 1) { va = a.name; vb = b.name; }
      else if (sortCol === 2) { va = a.grade; vb = b.grade; }
      else if (sortCol === headers.length - 1) { va = a.best; vb = b.best; }
      else {
        const dc = dateCols[sortCol - 3];
        va = dc ? a.times[dc] : null;
        vb = dc ? b.times[dc] : null;
      }
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortAsc ? va - vb : vb - va;
    });
  } else {
    sorted.sort((a, b) => {
      if (a.best == null && b.best == null) return 0;
      if (a.best == null) return 1;
      if (b.best == null) return -1;
      return a.best - b.best;
    });
  }

  el.tableBody.innerHTML = sorted.map((a, idx) => {
    const gradeClass = `tk-grade-${a.grade}`;
    const timeCells = dateCols.map((dc) => {
      const t = a.times[dc];
      const isPr = t !== null && t === a.best;
      return `<td>${t !== null ? (isPr ? `<span class="tk-pr">${formatTime(t)}</span>` : formatTime(t)) : ''}</td>`;
    }).join('');

    const impBadge = a.improvement != null && a.improvement > 0
      ? `<span class="tk-improved-badge">↑${a.improvement.toFixed(2)}s</span>`
      : '';

    return `<tr>
      <td>${a.best != null ? idx + 1 : ''}</td>
      <td><span class="tk-clickable" data-athlete="${encodeURIComponent(a.name)}">${a.name}</span>${impBadge}</td>
      <td class="${gradeClass}">${a.grade}</td>
      ${timeCells}
      <td><strong>${formatTime(a.best)}</strong></td>
    </tr>`;
  }).join('');
}

/* ── Charts ── */
function drawTop10(athletes) {
  const canvas = el.chartTop10;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const timed = timedAthletes(athletes).sort((a, b) => a.best - b.best).slice(0, 10);
  if (timed.length === 0) { ctx.fillStyle = '#556a88'; ctx.fillText('No data', W / 2 - 20, H / 2); return; }

  const maxTime = Math.max(...timed.map((a) => a.best));
  const pad = { top: 10, bottom: 20, left: 130, right: 30 };
  const barH = Math.min(22, (H - pad.top - pad.bottom) / timed.length - 4);
  const areaW = W - pad.left - pad.right;

  timed.forEach((a, i) => {
    const y = pad.top + i * (barH + 4);
    const w = (a.best / maxTime) * areaW;
    const color = GRADE_COLORS[a.grade] || '#7ee8ff';

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(pad.left, y, w, barH);
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#d4e0f0';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(a.name, pad.left - 6, y + barH / 2 + 4);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillText(formatTime(a.best), pad.left + w + 5, y + barH / 2 + 4);
  });
}

function drawGradeChart(athletes) {
  const canvas = el.chartGrade;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const grades = [6, 7, 8];
  const gradeData = grades.map((g) => {
    const timed = athletes.filter((a) => a.grade === g && a.best !== null);
    if (timed.length === 0) return { grade: g, avg: 0, best: 0, count: 0 };
    const bests = timed.map((a) => a.best);
    return {
      grade: g,
      avg: bests.reduce((s, v) => s + v, 0) / bests.length,
      best: Math.min(...bests),
      count: timed.length
    };
  });

  const maxVal = Math.max(...gradeData.map((d) => d.avg), 1);
  const pad = { top: 20, bottom: 38, left: 52, right: 20 };
  const areaW = W - pad.left - pad.right;
  const areaH = H - pad.top - pad.bottom;
  const groupW = areaW / grades.length;

  ctx.strokeStyle = 'rgba(100,180,255,.08)';
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (areaH / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    const val = maxVal - (maxVal / 4) * i;
    ctx.fillStyle = '#556a88';
    ctx.font = '10px Inter';
    ctx.textAlign = 'right';
    ctx.fillText(formatTime(val), pad.left - 6, y + 4);
  }

  gradeData.forEach((d, i) => {
    const x = pad.left + groupW * i;
    const barW = groupW * 0.3;
    const gapW = groupW * 0.08;

    const avgH = d.avg > 0 ? (d.avg / maxVal) * areaH : 0;
    const bestH = d.best > 0 ? (d.best / maxVal) * areaH : 0;

    ctx.fillStyle = GRADE_COLORS[d.grade] || '#7ee8ff';
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x + gapW, pad.top + areaH - avgH, barW, avgH);
    ctx.globalAlpha = 0.85;
    ctx.fillRect(x + gapW + barW + 4, pad.top + areaH - bestH, barW, bestH);
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#d4e0f0';
    ctx.font = '11px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(`Grade ${d.grade}`, x + groupW / 2, H - pad.bottom + 16);

    ctx.font = '9px Inter';
    ctx.fillStyle = '#8fb8dc';
    ctx.fillText(`avg`, x + gapW + barW / 2, H - pad.bottom + 28);
    ctx.fillText(`best`, x + gapW + barW + 4 + barW / 2, H - pad.bottom + 28);
  });
}

function drawHistogram(athletes) {
  const canvas = el.chartHist;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const bests = timedAthletes(athletes).map((a) => a.best).sort((a, b) => a - b);
  if (bests.length < 2) { ctx.fillStyle = '#556a88'; ctx.fillText('Not enough data', W / 2 - 40, H / 2); return; }

  const min = bests[0];
  const max = bests[bests.length - 1];
  const binCount = Math.min(16, Math.max(6, Math.ceil(Math.sqrt(bests.length))));
  const binSize = (max - min) / binCount || 1;
  const bins = new Array(binCount).fill(0);

  bests.forEach((v) => {
    let idx = Math.floor((v - min) / binSize);
    if (idx >= binCount) idx = binCount - 1;
    bins[idx]++;
  });

  const maxBin = Math.max(...bins);
  const pad = { top: 12, bottom: 34, left: 40, right: 14 };
  const areaW = W - pad.left - pad.right;
  const areaH = H - pad.top - pad.bottom;
  const bW = areaW / binCount;

  bins.forEach((count, i) => {
    const h = maxBin > 0 ? (count / maxBin) * areaH : 0;
    const x = pad.left + i * bW;
    const y = pad.top + areaH - h;

    ctx.fillStyle = 'rgba(110,198,255,0.55)';
    ctx.fillRect(x + 1, y, bW - 2, h);

    if (count > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(count, x + bW / 2, y - 3);
    }

    ctx.fillStyle = '#556a88';
    ctx.font = '9px Inter';
    ctx.textAlign = 'center';
    const label = formatTime(min + i * binSize);
    if (i % 2 === 0 || binCount <= 8) {
      ctx.fillText(label, x + bW / 2, H - pad.bottom + 14);
    }
  });

  ctx.strokeStyle = 'rgba(100,180,255,.08)';
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top + areaH);
  ctx.lineTo(pad.left + areaW, pad.top + areaH);
  ctx.stroke();
}

function drawPie(athletes) {
  const canvas = el.chartPie;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const grades = [6, 7, 8];
  const slices = grades.map((g) => {
    const grp = athletes.filter((a) => a.grade === g);
    const timed = grp.filter((a) => a.best !== null).length;
    return { grade: g, timed, untimed: grp.length - timed, total: grp.length };
  });

  const cx = W * 0.35;
  const cy = H * 0.5;
  const r = Math.min(cx - 20, cy - 20, 110);
  const totalAll = athletes.length || 1;

  let angle = -Math.PI / 2;
  slices.forEach((sl) => {
    const timedAngle = (sl.timed / totalAll) * Math.PI * 2;
    const untimedAngle = (sl.untimed / totalAll) * Math.PI * 2;
    const gc = GRADE_COLORS[sl.grade];

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + timedAngle);
    ctx.closePath();
    ctx.fillStyle = gc;
    ctx.globalAlpha = 0.8;
    ctx.fill();
    angle += timedAngle;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + untimedAngle);
    ctx.closePath();
    ctx.fillStyle = gc;
    ctx.globalAlpha = 0.2;
    ctx.fill();
    angle += untimedAngle;
  });
  ctx.globalAlpha = 1;

  const legendX = W * 0.68;
  let legendY = 40;
  slices.forEach((sl) => {
    ctx.fillStyle = GRADE_COLORS[sl.grade];
    ctx.fillRect(legendX, legendY, 12, 12);
    ctx.fillStyle = '#d4e0f0';
    ctx.font = '12px Inter';
    ctx.textAlign = 'left';
    ctx.fillText(`Gr ${sl.grade}: ${sl.timed} timed / ${sl.total} total`, legendX + 18, legendY + 10);
    legendY += 24;
  });
}

function drawProgress(athletes, sheetData) {
  const canvas = el.chartProgress;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const selectedName = el.athleteSelect.value;
  const athlete = athletes.find((a) => a.name === selectedName);
  if (!athlete) {
    ctx.fillStyle = '#556a88';
    ctx.font = '13px Inter';
    ctx.fillText('Select an athlete above to see their progress', W / 2 - 150, H / 2);
    return;
  }

  const dateCols = sheetData.dateCols;
  const points = dateCols.map((dc) => ({ date: dc, time: athlete.times[dc] })).filter((p) => p.time !== null);
  if (points.length === 0) {
    ctx.fillStyle = '#556a88';
    ctx.fillText('No times recorded for this athlete in this event', W / 2 - 150, H / 2);
    return;
  }

  const pad = { top: 24, bottom: 40, left: 60, right: 30 };
  const areaW = W - pad.left - pad.right;
  const areaH = H - pad.top - pad.bottom;

  const timesArr = points.map((p) => p.time);
  const minT = Math.min(...timesArr) * 0.96;
  const maxT = Math.max(...timesArr) * 1.04 || 1;
  const range = maxT - minT || 1;

  ctx.strokeStyle = 'rgba(100,180,255,.08)';
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (areaH / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    const val = maxT - (range / 4) * i;
    ctx.fillStyle = '#556a88';
    ctx.font = '10px Inter';
    ctx.textAlign = 'right';
    ctx.fillText(formatTime(val), pad.left - 8, y + 4);
  }

  const color = GRADE_COLORS[athlete.grade] || '#7ee8ff';

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = pad.left + (points.length === 1 ? areaW / 2 : (i / (points.length - 1)) * areaW);
    const y = pad.top + ((maxT - p.time) / range) * areaH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  points.forEach((p, i) => {
    const x = pad.left + (points.length === 1 ? areaW / 2 : (i / (points.length - 1)) * areaW);
    const y = pad.top + ((maxT - p.time) / range) * areaH;

    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#0c1a32';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(formatTime(p.time), x, y - 10);

    ctx.fillStyle = '#8fb8dc';
    ctx.font = '10px Inter';
    ctx.fillText(p.date, x, H - pad.bottom + 16);
  });

  ctx.lineWidth = 1;
}

function populateAthleteSelect(athletes) {
  const prev = el.athleteSelect.value;
  const sorted = [...athletes].filter((a) => a.best !== null).sort((a, b) => a.name.localeCompare(b.name));
  el.athleteSelect.innerHTML = '<option value="">Select an athlete…</option>' +
    sorted.map((a) => `<option value="${a.name}" ${a.name === prev ? 'selected' : ''}>${a.name} (Gr ${a.grade})</option>`).join('');
}

/* ── Athlete Modal ── */
async function showAthleteModal(name) {
  const content = [];
  content.push(`<h2>${name}</h2>`);

  for (const sheet of SHEETS) {
    const data = await fetchSheet(sheet.key);
    if (!data) continue;
    const athletes = processData(data);
    const a = athletes.find((at) => at.name === name);
    if (!a || a.best === null) continue;

    content.push(`<h3>${sheet.label}</h3>`);
    content.push('<table><tr><th>Date</th><th>Time</th></tr>');
    data.dateCols.forEach((dc) => {
      const t = a.times[dc];
      if (t !== null) {
        const pr = t === a.best ? ' class="tk-pr"' : '';
        content.push(`<tr><td>${dc}</td><td${pr}>${formatTime(t)}</td></tr>`);
      }
    });
    content.push(`<tr><td><strong>Best</strong></td><td><strong>${formatTime(a.best)}</strong></td></tr>`);
    if (a.improvement !== null && a.improvement > 0) {
      content.push(`<tr><td>Improvement</td><td style="color:#85e89d">−${a.improvement.toFixed(2)}s</td></tr>`);
    }
    content.push('</table>');
  }

  el.modalContent.innerHTML = content.join('');
  el.modal.hidden = false;
}

/* ── Main render ── */
async function render() {
  el.loading.classList.remove('hidden');

  const data = await fetchSheet(currentSheet);
  if (!data) {
    el.loading.classList.add('hidden');
    return;
  }

  const allAthletes = processData(data);
  const filtered = filterAthletes(allAthletes);

  const stats = computeStats(filtered);
  renderStats(stats);
  renderTable(filtered, data);
  drawTop10(filtered);
  drawGradeChart(allAthletes);
  drawHistogram(filtered);
  drawPie(allAthletes);
  populateAthleteSelect(filtered);
  drawProgress(filtered, data);

  el.loading.classList.add('hidden');
}

/* ── Events ── */
el.tabs.addEventListener('click', (e) => {
  const tab = e.target.closest('.tk-tab');
  if (!tab) return;
  el.tabs.querySelectorAll('.tk-tab').forEach((t) => t.classList.remove('active'));
  tab.classList.add('active');
  currentSheet = tab.dataset.sheet;
  sortCol = null;
  sortAsc = true;
  delete cache[currentSheet];
  render();
});

el.gradeFilters.addEventListener('click', (e) => {
  const btn = e.target.closest('.tk-grade');
  if (!btn) return;
  el.gradeFilters.querySelectorAll('.tk-grade').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  currentGrade = btn.dataset.grade;
  render();
});

el.search.addEventListener('input', () => {
  currentSearch = el.search.value;
  render();
});

$('tkTableHead').addEventListener('click', (e) => {
  const th = e.target.closest('th');
  if (!th) return;
  const col = parseInt(th.dataset.col, 10);
  if (sortCol === col) sortAsc = !sortAsc;
  else { sortCol = col; sortAsc = true; }
  render();
});

el.athleteSelect.addEventListener('change', async () => {
  const data = await fetchSheet(currentSheet);
  if (!data) return;
  const athletes = filterAthletes(processData(data));
  drawProgress(athletes, data);
});

$('tkTableBody').addEventListener('click', (e) => {
  const link = e.target.closest('.tk-clickable');
  if (!link) return;
  const name = decodeURIComponent(link.dataset.athlete);
  showAthleteModal(name);
});

el.modalClose.addEventListener('click', () => { el.modal.hidden = true; });
el.modal.addEventListener('click', (e) => { if (e.target === el.modal) el.modal.hidden = true; });

/* ── Boot ── */
render();
