/*
 * C.H.A.O.S. in the page: the deck builder (pool, deck, upgrade previews), the in-battle upgrade
 * choice, upgrade badges on cards in hand, the event-bar chip, the results summary and the admin
 * debug view.
 *
 * The rules live in the shared engine (clash-sim.js, "C.H.A.O.S. card upgrades") and events.js
 * (event `upgrades`, CHAOS_VARIANTS). This file only reads snapshots and sends picks: locally with
 * Sim.chooseUpgrade, online with the `upgrade_pick` socket message (the server decides).
 *
 * Loaded after prototype_events.js and before prototype_v4.js; uses their globals at call time.
 */

const CHAOS_ID = 'upgrades';
const chaosUi = { host: null, el: null, key: '', inspect: null };
const RARITY_LABEL = { common: 'Common', rare: 'Rare', epic: 'Epic' };

function isChaosEvent(id) { return id === CHAOS_ID; }

// ─── The C.H.A.O.S. deck (saved with event progress) ────────────────────────

function chaosDeckIds() { return Events.cleanChaosDeck(evProgress().chaosDeck); }

function setChaosDeck(ids) {
  evProgress().chaosDeck = Events.cleanChaosDeck(ids);
  saveProgress();
}

function chaosDeckCheck() {
  const ids = chaosDeckIds();
  const v = Events.validateDeck(CHAOS_ID, ids);
  return { ok: v.ok, ids, problems: v.problems };
}

// Sent to the server with Find Match / Create Room / Join Room (only a complete deck)
function chaosDeckPayload() {
  const ids = chaosDeckIds();
  return ids.length === MAX_DECK ? ids.map((id) => ({ id, level: Events.CHAOS_LEVEL })) : null;
}

function upgradeKindLabel(c) { return c.spell ? 'Spell' : c.building ? 'Building' : c.swarmCount > 1 ? `Troop ×${c.swarmCount}` : 'Troop'; }

function upgradeRowHtml(u) {
  return `<div class="upg-row r-${u.rarity}"><span class="upg-rar">${RARITY_LABEL[u.rarity]}</span><b>${escapeHtml(u.name)}</b><em>${escapeHtml(u.desc)}</em></div>`;
}

// The deck builder on the C.H.A.O.S. details screen
function chaosBuilderHtml(tier) {
  if (Events.deckKind(CHAOS_ID, tier) === 'draft') {
    return `<section class="ev-box wide"><h5>🃏 Deck</h5><p>Draft: before the battle you pick 8 cards from the C.H.A.O.S. pool, one round at a time (the card you pass goes to the AI). Every card plays at level ${Events.CHAOS_LEVEL}.</p>${chaosPoolHtml(null)}</section>`;
  }
  const check = chaosDeckCheck();
  const ids = check.ids;
  const slots = Array.from({ length: MAX_DECK }, (_, i) => {
    const id = ids[i];
    if (!id) return '<span class="cd-slot empty" aria-label="Empty slot"></span>';
    const c = CARD_MAP[id];
    return `<button type="button" class="cd-slot rarity-${c.rarity}" data-cd-toggle="${id}" title="Remove ${escapeHtml(c.name)}"><span class="cd-cost ${costClass(c.cost)}">${c.cost}</span><span class="cd-icon ${artCls(id)}">${c.icon}</span><small>${escapeHtml(c.name)}</small></button>`;
  }).join('');
  const avg = ids.length ? (ids.reduce((s, id) => s + CARD_MAP[id].cost, 0) / ids.length).toFixed(1) : '0.0';
  return `<section class="ev-box wide chaos-builder">
    <h5>🧬 Your C.H.A.O.S. deck <small>${ids.length}/${MAX_DECK} · avg ${avg} elixir · all level ${Events.CHAOS_LEVEL}</small></h5>
    <div class="cd-deck">${slots}</div>
    ${check.ok ? '<p class="ev-ok">✓ Deck ready.</p>' : `<p class="ev-bad">${ids.length < MAX_DECK ? `Add ${MAX_DECK - ids.length} more card${MAX_DECK - ids.length === 1 ? '' : 's'} from the pool below.` : escapeHtml(check.problems.join(' '))}</p>`}
    <div class="cd-actions"><button type="button" data-cd-auto>🎲 Fill randomly</button><button type="button" data-cd-clear ${ids.length ? '' : 'disabled'}>Clear</button></div>
    ${chaosPoolHtml(ids)}
  </section>`;
}

// The pool, with each card's upgrades a tap away
function chaosPoolHtml(deckIds) {
  const pick = !!deckIds;
  const pool = Sim.CHAOS_POOL.map((id) => CARD_MAP[id]).sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  const full = pick && deckIds.length >= MAX_DECK;
  const cards = pool.map((c) => {
    const inDeck = pick && deckIds.includes(c.id);
    const rar = Sim.upgradesFor(c.id).map((u) => `<i class="r-${u.rarity}" title="${RARITY_LABEL[u.rarity]}: ${escapeHtml(u.name)}"></i>`).join('');
    return `<div class="cd-card rarity-${c.rarity}${inDeck ? ' in' : ''}${chaosUi.inspect === c.id ? ' open' : ''}">
      ${pick ? `<button type="button" class="cd-add" data-cd-toggle="${c.id}" ${!inDeck && full ? 'disabled' : ''} aria-label="${inDeck ? 'Remove' : 'Add'} ${escapeHtml(c.name)}">${inDeck ? '✓' : '+'}</button>` : ''}
      <button type="button" class="cd-body" data-cd-inspect="${c.id}" aria-expanded="${chaosUi.inspect === c.id}">
        <span class="cd-cost ${costClass(c.cost)}">${c.cost}</span><span class="cd-icon ${artCls(c.id)}">${c.icon}</span>
        <b>${escapeHtml(c.name)}</b><small>${escapeHtml(upgradeKindLabel(c))} · ${escapeHtml(c.role)}</small><span class="cd-rar">${rar}</span>
      </button>
    </div>`;
  }).join('');
  const insp = chaosUi.inspect && CARD_MAP[chaosUi.inspect];
  const panel = insp ? `<div class="cd-inspect"><div class="cd-inspect-head"><span class="cd-icon ${artCls(insp.id)}">${insp.icon}</span><div><b>${escapeHtml(insp.name)}</b><small>Normal card: ${escapeHtml(insp.desc || insp.role)}</small></div><button type="button" data-cd-inspect="${insp.id}" aria-label="Close">✕</button></div>
    <p class="note">Possible C.H.A.O.S. upgrades (you get at most one per match, if it's offered):</p>${Sim.upgradesFor(insp.id).map(upgradeRowHtml).join('')}</div>` : '';
  return `<h5>Card pool <small>${pool.length} cards · tap a card to see its upgrades</small></h5>${panel}<div class="cd-pool">${cards}</div>`;
}

function chaosScheduleHtml(tier) {
  const v = Events.CHAOS_VARIANT_MAP[tier] || Events.CHAOS_VARIANTS[0];
  const t = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return `<section class="ev-box"><h5>🧬 Upgrade checkpoints (${escapeHtml(v.name)})</h5><ol class="upg-sched">${v.checkpoints.map((c) => `<li class="r-${c.rarity}"><b>${t(c.at)}</b> ${RARITY_LABEL[c.rarity]}${c.at >= 180 ? ' <small>(overtime)</small>' : ''}</li>`).join('')}</ol>
    <p class="note">The battle pauses at each checkpoint. Both offers have the listed rarity (the nearest rarity if your deck has none left). Your opponent picks from their own offers at the same time.</p>
    ${state.admin.active ? chaosDebugSummary() : ''}</section>`;
}

function chaosDebugSummary() {
  const problems = Sim.validateUpgrades();
  return `<p class="ev-dev">🔧 Debug: ${Sim.CHAOS_UPGRADES.length} upgrades on ${Sim.CHAOS_POOL.length} cards · ${problems.length ? `${problems.length} problems: ${escapeHtml(problems.join('; '))}` : 'table OK'}. In a C.H.A.O.S. match, run <code>chaosDebug()</code> in the console for offers, rejections and the next checkpoint.</p>`;
}

// Clicks inside the event overlay that belong to the builder. Returns true when handled.
function chaosOverlayClick(t) {
  if (t.dataset.cdToggle) {
    const id = t.dataset.cdToggle;
    const ids = chaosDeckIds();
    if (ids.includes(id)) setChaosDeck(ids.filter((x) => x !== id));
    else if (ids.length < MAX_DECK) setChaosDeck(ids.concat(id));
    Sound.play('select');
    renderEventsOverlay();
    return true;
  }
  if (t.dataset.cdInspect) {
    chaosUi.inspect = chaosUi.inspect === t.dataset.cdInspect ? null : t.dataset.cdInspect;
    renderEventsOverlay();
    return true;
  }
  if (t.matches('[data-cd-clear]')) { setChaosDeck([]); renderEventsOverlay(); return true; }
  if (t.matches('[data-cd-auto]')) {
    // Keep what's there and fill the rest legally
    const have = chaosDeckIds();
    const fill = Events.loanerDeck(CHAOS_ID, Math.floor(Math.random() * 1e9)).filter((id) => !have.includes(id));
    setChaosDeck(have.concat(fill).slice(0, MAX_DECK));
    Sound.play('select');
    renderEventsOverlay();
    return true;
  }
  return false;
}

// The hub's C.H.A.O.S. section: one tile per variant
function chaosHubHtml(rot) {
  const ev = Events.EVENT_MAP[CHAOS_ID];
  if (!ev) return '';
  const rec = evProgress().records[CHAOS_ID];
  const deck = chaosDeckIds();
  return `<section class="ev-section">
    <h4 class="ev-h">🧬 C.H.A.O.S. <small>Always open · upgrade your cards mid-battle · deck ${deck.length}/${MAX_DECK}</small></h4>
    <div class="chaos-tiers upg-tiers">${Events.CHAOS_VARIANTS.map((v, i) => {
      const won = rec && rec.firstWin && rec.firstWin[v.id];
      const modes = Events.modesFor(CHAOS_ID, v.id).map((m) => MODE_LABEL[m].split(' ')[0]).join(' ');
      return `<button type="button" class="chaos-tier upg-tier t${i}" data-ev-open="${CHAOS_ID}" data-tier="${v.id}" aria-label="C.H.A.O.S. ${escapeHtml(v.name)}"><b>${escapeHtml(v.name)}</b><small>${escapeHtml(v.blurb)}</small><small class="upg-modes">${modes}</small>${won ? '<i>✓ Won</i>' : ''}</button>`;
    }).join('')}</div>
  </section>`;
}

// ─── In battle ──────────────────────────────────────────────────────────────

// Which sides this screen picks for: you vs the AI, both players in local PvP, your side online
function chaosLocalSides() {
  if (state.viewSource === 'online') return mySide ? [mySide] : [];
  if (state.mode === 'ai') return ['A'];
  return ['B', 'A'];
}

function chaosPick(side, idx) {
  const v = state.view;
  const a = v && v.chaos && v.chaos.active;
  if (!a || !a.offers[side] || a.picked[side] != null) return;
  if (state.viewSource === 'online') {
    if (!socket) return;
    socket.emit('upgrade_pick', { idx });
    chaosUi.sent = { n: a.n, side, idx };
  } else {
    if (!state.match) return;
    const res = Sim.chooseUpgrade(state.match, side, idx);
    if (!res.ok) return;
    // Show the pick right away (the next snapshot confirms it)
    state.snapCur = Sim.snapshot(state.match);
    state.view = state.snapCur;
  }
  Sound.play('select');
  chaosUi.key = '';
}

function ensureChaosHost() {
  if (chaosUi.el && chaosUi.el.isConnected) return chaosUi.el;
  const canvas = ui.arena;
  const host = canvas && canvas.parentElement;
  if (!host) return null;
  host.classList.add('chaos-host');
  const el = document.createElement('div');
  el.className = 'chaos-choice';
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'false');
  el.setAttribute('aria-label', 'Choose an upgrade');
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-upg-pick]');
    if (!b || b.disabled) return;
    chaosPick(b.dataset.side, Number(b.dataset.upgPick));
  });
  host.appendChild(el);
  chaosUi.host = host;
  chaosUi.el = el;
  return el;
}

function offerCardHtml(side, offer, i, picked, rarity) {
  const c = CARD_MAP[offer.cardId];
  const u = Sim.CHAOS_UPGRADE_MAP[offer.upgradeId];
  if (!c || !u) return '';
  const chosen = picked === i;
  const dim = picked != null && picked !== i;
  return `<button type="button" class="upg-offer r-${u.rarity}${chosen ? ' chosen' : ''}${dim ? ' dim' : ''}" data-upg-pick="${i}" data-side="${side}" ${picked != null ? 'disabled' : ''} aria-label="${escapeHtml(`${u.name} for ${c.name}: ${u.desc}`)}">
    <span class="upg-tag">${RARITY_LABEL[u.rarity]}${i === 0 ? ' · default' : ''}</span>
    <span class="upg-card"><span class="cd-icon ${artCls(c.id)}">${c.icon}</span><span class="cd-cost ${costClass(c.cost)}">${c.cost}</span></span>
    <b class="upg-name">${escapeHtml(u.name)}</b>
    <span class="upg-for">${escapeHtml(c.name)} · ${escapeHtml(upgradeKindLabel(c))}</span>
    <span class="upg-desc">${escapeHtml(u.desc)}</span>
    <span class="upg-key">${chosen ? '✓ Chosen' : `Press ${i + 1}`}</span>
  </button>`;
}

// Called every frame: shows, updates or hides the choice panel from the snapshot
function renderChaosChoice() {
  const v = state.view;
  const a = v && v.running && v.chaos && v.chaos.active;
  const el = a ? ensureChaosHost() : chaosUi.el;
  if (!el) return;
  if (!a) { if (!el.hidden) { el.hidden = true; el.innerHTML = ''; chaosUi.key = ''; } return; }
  const sides = chaosLocalSides().filter((s) => a.offers[s]);
  const key = `${a.n}|${sides.map((s) => `${s}:${a.picked[s]}`).join(',')}|${JSON.stringify(sides.map((s) => a.offers[s].offers))}`;
  if (key !== chaosUi.key) {
    chaosUi.key = key;
    const total = v.chaos.total;
    const waitingFor = state.viewSource === 'online' || state.mode === 'ai' ? sides.every((s) => a.picked[s] != null) : false;
    el.innerHTML = `<div class="chaos-choice-inner">
      <p class="road-kicker">🧬 C.H.A.O.S. UPGRADE ${a.n + 1} OF ${total} · ${RARITY_LABEL[a.rarity].toUpperCase()}</p>
      ${sides.map((s) => {
        const o = a.offers[s];
        const who = sides.length > 1 ? `<h4>${escapeHtml(playerName(s))}</h4>` : '';
        return `<div class="upg-side side-${s}">${who}<div class="upg-pair">${o.offers.map((off, i) => offerCardHtml(s, off, i, a.picked[s], o.rarity)).join('<span class="upg-or">or</span>')}</div></div>`;
      }).join('')}
      ${sides.length === 0 ? '<p class="note">Nothing to upgrade this time.</p>' : ''}
      <p class="upg-wait">${waitingFor ? (v.chaos.pause ? 'Waiting for your opponent…' : '') : 'Pick one: it upgrades every copy of that card you play from now on. The battle is paused.'}</p>
      <div class="upg-timer" aria-hidden="true"><i></i></div>
    </div>`;
    if (sides.length && sides.every((s) => a.picked[s] == null)) Sound.play('warn');
  }
  el.hidden = false;
  const bar = el.querySelector('.upg-timer i');
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, (a.wait / a.total) * 100))}%`;
}

// Keyboard: 1 / 2 pick for the bottom player (or your side online)
function chaosKey(e) {
  const v = state.view;
  const a = v && v.chaos && v.chaos.active;
  if (!a || (e.key !== '1' && e.key !== '2')) return false;
  const side = state.viewSource === 'online' ? mySide : 'A';
  if (!side || !a.offers[side] || a.picked[side] != null) return false;
  chaosPick(side, e.key === '1' ? 0 : 1);
  return true;
}

// Battle effects: a chosen upgrade is announced on the arena
function chaosFx(f) {
  if (f.type !== 'upgrade' || !arena) return;
  const u = Sim.CHAOS_UPGRADE_MAP[f.upgradeId];
  const c = CARD_MAP[f.cardId];
  if (!u || !c) return;
  const me = state.viewSource === 'online' ? mySide : 'A';
  const mine = f.owner === me || (state.mode === 'pvp' && state.viewSource !== 'online');
  const col = { common: '#8fd3ff', rare: '#ffb347', epic: '#ff5ce1' }[u.rarity];
  const who = mine ? (state.mode === 'pvp' && state.viewSource !== 'online' ? `${playerName(f.owner)}: ` : '') : 'Opponent: ';
  arena.ribbon(`${who}${c.name} → ${u.name}${f.auto ? ' (auto)' : ''}`, { icon: '🧬', color: col, life: 3200 });
  Sound.play(u.rarity === 'epic' ? 'evolve' : 'select');
}

// A card in hand with an upgrade gets a badge (and its rarity colour)
function chaosHandBadge(owner, id) {
  const v = state.view;
  const upId = v && v.chaos && v.chaos.upgrades[owner] && v.chaos.upgrades[owner][id];
  const u = upId && Sim.CHAOS_UPGRADE_MAP[upId];
  if (!u) return { cls: '', html: '' };
  return { cls: ` upgraded upg-${u.rarity}`, html: `<span class="card-upg r-${u.rarity}" title="${escapeHtml(`${u.name}: ${u.desc}`)}">🧬 ${escapeHtml(u.name)}</span>` };
}

// Event bar: the next checkpoint and how many upgrades each side has
function chaosBarHtml(v, me) {
  const ch = v && v.chaos;
  if (!ch) return '';
  const foe = enemyOf(me);
  const mine = Object.keys(ch.upgrades[me] || {}).length;
  const theirs = Object.keys(ch.upgrades[foe] || {}).length;
  let next = '';
  if (ch.active) next = '<small>choosing…</small>';
  else if (ch.nextAt != null) {
    const inSec = Math.max(0, ch.nextAt - v.time);
    next = `<small>next ${RARITY_LABEL[ch.nextRarity]} in ${Math.ceil(inSec)}s</small>`;
  } else next = '<small>all upgrades chosen</small>';
  return `<span class="eb-chip upg-chip" title="Upgrades so far: you ${mine}, opponent ${theirs}">🧬 ${mine} vs ${theirs} ${next}</span>`;
}

// Results: what each side picked (and what they passed on)
function chaosResultsHtml(snap, me) {
  const ch = snap && snap.chaos;
  if (!ch || !ch.history.length) return '';
  const pvp = state.mode === 'pvp' && state.viewSource !== 'online';
  const line = (h) => {
    const u = Sim.CHAOS_UPGRADE_MAP[h.chosen.upgradeId];
    const o = Sim.CHAOS_UPGRADE_MAP[h.other.upgradeId];
    const c = CARD_MAP[h.chosen.cardId];
    if (!u || !c) return '';
    return `<li class="r-${u.rarity}"><span>${c.icon}</span><b>${escapeHtml(u.name)}</b> <em>${escapeHtml(c.name)} · ${RARITY_LABEL[u.rarity]}${h.auto ? ' · auto' : ''}</em>${o ? `<small>passed: ${escapeHtml(o.name)} (${escapeHtml(CARD_MAP[h.other.cardId].name)})</small>` : ''}</li>`;
  };
  const block = (side, title) => {
    const list = ch.history.filter((h) => h.side === side);
    return list.length ? `<div><b>${title}</b><ul class="we-upg">${list.map(line).join('')}</ul></div>` : '';
  };
  const foe = enemyOf(me);
  return `<div class="we-upgrades">${block(me, pvp ? playerName(me) : 'Your upgrades')}${block(foe, pvp ? playerName(foe) : 'Opponent')}</div>`;
}

function chaosEpicCount(snap, side) {
  const ch = snap && snap.chaos;
  if (!ch) return 0;
  return ch.history.filter((h) => h.side === side && Sim.CHAOS_UPGRADE_MAP[h.chosen.upgradeId] && Sim.CHAOS_UPGRADE_MAP[h.chosen.upgradeId].rarity === 'epic').length;
}

// Development: the engine's view of the running match (admin mode only)
window.chaosDebug = function chaosDebug() {
  if (!state.admin.active) { console.warn('chaosDebug() needs admin mode.'); return null; }
  if (!state.match || state.viewSource !== 'local') { console.warn('chaosDebug() works in local matches.'); return null; }
  const d = Sim.chaosDebug(state.match);
  console.log(d);
  return d;
};
