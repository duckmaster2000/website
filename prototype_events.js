/*
 * Special events in the page: the Event Hub, event details, the Draft screen, the event bar shown
 * during a battle, event match setup, and event results.
 *
 * Rules live elsewhere: the catalog, schedule, rewards and progress in shared/events.js, and
 * every battle rule in shared/clash-sim.js (the same engine the online server runs).
 *
 * Loaded before prototype_v4.js and uses its globals (state, ui, Sim, Road, Sound, toast,
 * saveProgress, deckFor, ...) at call time, like prototype_road.js.
 */
const Events = window.ClashEvents;

const evUi = { btn: null, overlay: null, modal: null, bar: null, draft: null, winEvent: null, winHub: null, lobbyEvent: null };
const hub = { screen: 'hub', id: null, tier: null, ai: 'normal', timer: null };
let onlineEvent = null;   // { eventId, tier } the online lobby queues / creates rooms for
let lastEventSpec = null; // what "Play again" replays
let draftSession = null;  // { spec, rounds, picks }

const AI_LEVELS = [
  { id: 'easy', name: 'Easy' }, { id: 'normal', name: 'Normal' }, { id: 'hard', name: 'Hard' }, { id: 'insane', name: 'Insane' },
];
const MODE_LABEL = { ai: '⚔️ vs AI', pvp: '👥 Local PvP', online: '🌐 Online' };

function evProgress() { return state.progress.events; }
function evNow() { return Date.now(); }
// Admin mode and ?events=all open every event for testing (and pay no rewards)
function evDevAll() { return state.admin.active || /[?&]events=all\b/.test(location.search); }
function evRotation() { return Events.rotation(evNow(), { forceAll: evDevAll() }); }
function evName(ev, tier) {
  const t = ev.tiers && tier ? ev.tiers.find((x) => x.id === tier) : null;
  return t && ev.id !== 'chaos' ? `${ev.name} · ${t.name}` : t ? t.name : ev.name;
}

function fmtLeft(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

function stars(n) { return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n)); }

// ─── Hub ─────────────────────────────────────────────────────────────────────

function openEvents(id) {
  if (!evUi.overlay) return;
  hub.screen = id ? 'details' : 'hub';
  hub.id = id || null;
  renderEventsOverlay();
  evUi.overlay.hidden = false;
  document.body.classList.add('road-open');
  Sound.play('select');
  clearInterval(hub.timer);
  // Timers on the cards tick while the hub is open
  hub.timer = setInterval(() => { if (!evUi.overlay.hidden) renderEventsOverlay(true); }, 1000);
  const P = evProgress();
  if (!P.seen.hub) { P.seen.hub = 1; saveProgress(); renderEventsButton(); }
}

function closeEvents() {
  if (!evUi.overlay) return;
  evUi.overlay.hidden = true;
  clearInterval(hub.timer);
  hub.timer = null;
  document.body.classList.remove('road-open');
}

function renderEventsOverlay(tick) {
  if (!evUi.modal) return;
  // Timer ticks only touch the countdown labels, so scrolling and focus stay put
  if (tick) {
    const rot = evRotation();
    evUi.modal.querySelectorAll('[data-ends]').forEach((el) => {
      const ends = Number(el.dataset.ends);
      el.textContent = ends - evNow() > 0 ? fmtLeft(ends - evNow()) : 'refreshing…';
    });
    if (rot.day !== hub.lastDay) renderEventsOverlay(false);
    return;
  }
  hub.lastDay = evRotation().day;
  let html;
  try {
    html = hub.screen === 'details' && hub.id ? (Events.CHALLENGE_MAP[hub.id] ? challengeDetailsHtml(hub.id) : detailsHtml(hub.id)) : hubHtml();
  } catch (err) {
    // A broken event must not take the whole hub down with it
    console.error(err);
    html = `<header class="ev-head"><button type="button" class="ev-back" data-ev-back>‹ Events</button><div class="ev-head-badge">⚠️</div><div><h3>Something went wrong</h3><p class="ev-sub">This screen couldn't be shown. Your progress is safe.</p></div></header>`;
  }
  evUi.modal.innerHTML = `<button type="button" class="road-close" data-ev-close aria-label="Close">✕</button>${html}`;
  if (hub.screen === 'details') evUi.modal.scrollTop = 0;
}

function eventState(ev, rot) {
  const P = evProgress();
  const open = Events.availability(ev.id, rot.now, { forceAll: rot.forceAll });
  const rec = P.records[ev.id];
  const winsToday = (P.daily.day === rot.day && P.daily.wins[ev.id]) || 0;
  return {
    open: open.ok,
    reason: open.reason,
    wins: rec ? rec.wins : 0,
    played: rec ? rec.played : 0,
    best: rec ? rec.best : 0,
    capped: winsToday >= Events.DAILY_WIN_CAP,
    winsToday,
  };
}

function rewardPreview(ev) {
  const r = ev.rewards;
  const firsts = ev.tiers ? ev.tiers.filter((t) => !(evProgress().records[ev.id] && evProgress().records[ev.id].firstWin[t.id])).length : (evProgress().records[ev.id] && evProgress().records[ev.id].firstWin.base ? 0 : 1);
  return `<span class="ev-reward">💰 ${r.win}/win</span>${firsts ? `<span class="ev-reward first">🎁 First win${r.first.wild ? ' + ✦' : ''}</span>` : ''}`;
}

function eventCardHtml(ev, rot, opts) {
  const o = opts || {};
  const st = eventState(ev, rot);
  const cls = !st.open ? 'unavailable' : st.capped ? 'completed' : 'playable';
  const status = !st.open ? `🔒 ${st.reason || 'Unavailable'}` : st.capped ? `✓ Daily rewards collected` : o.ends ? `⏳ <span data-ends="${o.ends}">${fmtLeft(o.ends - rot.now)}</span> left` : '♾️ Always open';
  return `<button type="button" class="ev-card art-${ev.art} ${cls}" data-ev-open="${ev.id}" aria-label="${escapeHtml(ev.name)}: ${escapeHtml(ev.tagline)}">
    <span class="ev-card-art" aria-hidden="true">${ev.icon}</span>
    <span class="ev-card-body">
      <span class="ev-card-cat">${escapeHtml(ev.category)} · <span class="ev-diff" title="Difficulty ${ev.difficulty}/5">${stars(ev.difficulty)}</span></span>
      <span class="ev-card-name">${escapeHtml(ev.name)}</span>
      <span class="ev-card-tag">${escapeHtml(ev.tagline)}</span>
      <span class="ev-card-foot"><span class="ev-status">${status}</span>${rewardPreview(ev)}</span>
      ${st.played ? `<span class="ev-card-rec">${st.wins}W · ${st.played - st.wins}L${st.best ? ` · best ${st.best}` : ''}</span>` : ''}
    </span>
  </button>`;
}

function hubHtml() {
  const rot = evRotation();
  const P = evProgress();
  const featured = Events.EVENT_MAP[rot.featured];
  const ch = Events.CHALLENGE_MAP[rot.challenge];
  const chs = Events.challengeState(P, ch.id, rot.now);
  const chaos = Events.EVENT_MAP.chaos;
  const chaosRec = P.records.chaos;
  const chaosTiles = chaos.tiers.map((t, i) => {
    const unlocked = Events.tierUnlocked(P, 'chaos', t.id) || rot.forceAll;
    const beaten = chaosRec && chaosRec.bestTier >= i;
    return `<button type="button" class="chaos-tier t${i} ${unlocked ? '' : 'locked'} ${beaten ? 'beaten' : ''}" data-ev-open="chaos" data-tier="${t.id}" aria-label="${escapeHtml(t.name)}${unlocked ? '' : ' (locked)'}">
      <b>${escapeHtml(t.name)}</b><small>${unlocked ? escapeHtml(t.blurb) : `🔒 Win ${escapeHtml(chaos.tiers[i - 1].name)} to unlock`}</small>${beaten ? '<i>✓ Won</i>' : ''}
    </button>`;
  }).join('');
  const st = P.stats;
  const winRate = st.matches ? Math.round((st.wins / st.matches) * 100) : 0;
  const badges = Object.keys(Events.BADGES).filter((b) => P.badges[b]);
  const achDone = Events.ACHIEVEMENTS.filter((a) => P.achievements[a.id]).length;
  return `
  <header class="ev-head">
    <div class="ev-head-badge" aria-hidden="true">🎪</div>
    <div><p class="road-kicker">SPECIAL EVENTS</p><h3>Event Hub</h3>
    <p class="ev-sub">New line-up in <b data-ends="${rot.dayEndsAt}">${fmtLeft(rot.dayEndsAt - rot.now)}</b>${rot.forceAll ? ' · <span class="ev-dev">dev: all events open, no rewards</span>' : ''}</p></div>
  </header>
  <div class="ev-scroll">
    <section class="ev-featured art-${featured.art}">
      <div class="ev-feat-art" aria-hidden="true">${featured.icon}</div>
      <div class="ev-feat-text">
        <p class="ev-feat-kicker">${rot.weekend ? '🌀 CHAOS WEEKEND' : '⭐ FEATURED TODAY'}</p>
        <h4>${escapeHtml(featured.name)}</h4>
        <p>${escapeHtml(featured.tagline)}</p>
        <p class="ev-feat-meta">${featured.schedule === 'permanent' ? '♾️ Always open' : `⏳ <span data-ends="${rot.dayEndsAt}">${fmtLeft(rot.dayEndsAt - rot.now)}</span> left`} · ${rewardPreview(featured)} · ${featured.modes.map((m) => MODE_LABEL[m]).join(' ')}</p>
        <div class="ev-feat-actions"><button type="button" class="btn-primary" data-ev-open="${featured.id}">Play</button><button type="button" data-ev-open="${featured.id}">Rules</button></div>
      </div>
    </section>

    <section class="ev-section">
      <h4 class="ev-h">🌀 Chaos Mode <small>Always open · win a tier to unlock the next</small></h4>
      <div class="chaos-tiers">${chaosTiles}</div>
    </section>

    <section class="ev-section">
      <h4 class="ev-h">📅 Today's Events <small>Change in <span data-ends="${rot.dayEndsAt}">${fmtLeft(rot.dayEndsAt - rot.now)}</span></small></h4>
      <div class="ev-grid">${rot.daily.map((id) => eventCardHtml(Events.EVENT_MAP[id], rot, { ends: rot.dayEndsAt })).join('')}</div>
    </section>

    <section class="ev-section">
      <h4 class="ev-h">🏁 Weekly Challenge <small>Ends in <span data-ends="${rot.weekEndsAt}">${fmtLeft(rot.weekEndsAt - rot.now)}</span></small></h4>
      <button type="button" class="ev-challenge art-${ch.art}" data-ev-open="${ch.id}">
        <span class="ev-card-art" aria-hidden="true">${ch.icon}</span>
        <span class="ev-card-body">
          <span class="ev-card-name">${escapeHtml(ch.name)}</span>
          <span class="ev-card-tag">${escapeHtml(ch.tagline)}</span>
          <span class="ch-track">${ch.rounds.map((r, i) => `<i class="${i < chs.round ? 'done' : i === chs.round && chs.active ? 'now' : ''}" title="Round ${i + 1}: ${escapeHtml(evName(Events.EVENT_MAP[r.event], r.tier))}">${i + 1}</i>`).join('')}</span>
          <span class="ev-card-foot"><span class="ev-status">${chs.active ? `▶ Round ${chs.round + 1} · ${'❤️'.repeat(ch.lives - chs.losses)}${'🖤'.repeat(chs.losses)}` : chs.claimed.final ? '✓ Completed this week' : 'Not started'}</span><span class="ev-reward first">🏆 ${ch.final.gold} + chest + badge</span></span>
        </span>
      </button>
    </section>

    <section class="ev-section">
      <h4 class="ev-h">⚔️ Boss & Survival <small>Always open · single player</small></h4>
      <div class="ev-grid">${['boss', 'survival'].map((id) => eventCardHtml(Events.EVENT_MAP[id], rot)).join('')}</div>
    </section>

    <section class="ev-section">
      <h4 class="ev-h">🔭 Coming Up</h4>
      <div class="ev-upcoming">${rot.tomorrow.map((id) => { const e = Events.EVENT_MAP[id]; return `<span class="ev-up" title="${escapeHtml(e.tagline)}">${e.icon} ${escapeHtml(e.name)}</span>`; }).join('')}
        <span class="ev-up dim">Tomorrow (UTC)</span>
        <span class="ev-up">${Events.CHALLENGE_MAP[rot.nextChallenge].icon} ${escapeHtml(Events.CHALLENGE_MAP[rot.nextChallenge].name)}</span><span class="ev-up dim">Next week</span>
      </div>
    </section>

    <section class="ev-section">
      <h4 class="ev-h">📊 Records & Badges <small>${achDone}/${Events.ACHIEVEMENTS.length} achievements</small></h4>
      <div class="ev-stats">
        <div><strong>${st.matches}</strong><span>Event matches</span></div>
        <div><strong>${winRate}%</strong><span>Win rate</span></div>
        <div><strong>${st.chaosWins}</strong><span>Chaos wins</span></div>
        <div><strong>${st.chaosTier >= 0 ? escapeHtml(Events.CHAOS_TIERS[st.chaosTier].name.split(' ')[0]) : '—'}</strong><span>Top Chaos tier</span></div>
        <div><strong>${st.bestWave || 0}/10</strong><span>Best Last Stand</span></div>
        <div><strong>${st.bestBossTime ? `${st.bestBossTime}s` : '—'}</strong><span>Boss time left</span></div>
        <div><strong>${st.bestStreak}</strong><span>Best streak</span></div>
        <div><strong>${st.challengeWins}</strong><span>Challenges won</span></div>
      </div>
      <div class="ev-badges">
        ${Object.keys(Events.BADGES).map((b) => { const B = Events.BADGES[b]; const own = !!P.badges[b]; return `<button type="button" class="ev-badge ${own ? 'own' : ''} ${P.title === b ? 'on' : ''}" data-ev-title="${b}" ${own ? '' : 'disabled'} title="${own ? (P.title === b ? 'Shown on your nameplate (tap to hide)' : 'Tap to show on your nameplate') : 'Not earned yet'}">${B.icon}<small>${escapeHtml(B.name)}</small></button>`; }).join('')}
      </div>
      ${badges.length ? '' : '<p class="note">Badges come from achievements, challenges and event milestones. Show one on your nameplate.</p>'}
      <ul class="ev-ach">${Events.ACHIEVEMENTS.map((a) => `<li class="${P.achievements[a.id] ? 'done' : ''}"><span>${a.icon}</span><b>${escapeHtml(a.name)}</b><em>${escapeHtml(a.desc)}</em><i>${P.achievements[a.id] ? '✓' : `+${a.gold}`}</i></li>`).join('')}</ul>
    </section>
    <p class="note ev-foot">The line-up follows the UTC date on this device (no account or server is involved), and progress is saved in this browser.</p>
  </div>`;
}

// ─── Event details ───────────────────────────────────────────────────────────

function deckRulesText(ev) {
  const r = ev.deckRules;
  if (ev.deck === 'draft') return 'You draft your deck before the battle (8 picks).';
  if (ev.deck === 'mirror') return 'Both players get the same random deck.';
  if (ev.deck === 'roulette') return 'Random decks, swapped twice during the match.';
  if (!r) return 'Your active deck, as it is.';
  const parts = [];
  if (r.minSpells) parts.push(`at least ${r.minSpells} spells`);
  if (r.minBuildings) parts.push(`at least ${r.minBuildings} buildings`);
  if (r.minEvo) parts.push(`at least ${r.minEvo} cards with an Evolution`);
  if (r.swarmTroopsOnly) parts.push('swarm troops only');
  if (r.minCost) parts.push(`no card under ${r.minCost} elixir`);
  return `Your active deck, with ${parts.join(', ')}.`;
}

function evoRulesText(ev, rules) {
  if (rules.evo.disabled) return 'Evolutions are off in this event.';
  if (rules.evo.all) return `Every card with an Evolution is evolved-capable this match, unlocked or not (no slot limit)${rules.evo.cycleDelta ? `, with ${-rules.evo.cycleDelta} fewer cycle` : ''}.`;
  if (ev.deck === 'mirror') return 'Both sides get the same Evolution (if the deck has a card with one).';
  if (ev.deck !== 'own') return 'Evolutions are off.';
  return 'Your equipped Evolutions work as normal.';
}

function elixirRulesText(rules) {
  const phases = rules.elixirPhases.map((p) => `${p.mult}× from ${Math.floor(p.at / 60)}:${String(p.at % 60).padStart(2, '0')}`).join(', ');
  const extra = [];
  if (rules.killRefund) extra.push(`kills refund ${Math.round(rules.killRefund * 100)}% of the troop's cost`);
  if (rules.buildingElixir) extra.push(`+${Math.round(rules.buildingElixir * 100)}% per living building (max 3)`);
  return `Start ${rules.startElixir}, max ${rules.maxElixir}. Generation ${phases}${rules.overtime ? `, ${rules.overtimeMult}× in overtime` : ''}.${extra.length ? ` Also: ${extra.join('; ')}.` : ''}`;
}

function myDeckCheck(ev) {
  const ids = deckFor('A');
  if (ev.deck !== 'own') return { ok: true, ids, problems: [] };
  const v = Events.validateDeck(ev.id, ids);
  return { ok: v.ok, ids, problems: v.problems };
}

function detailsHtml(id) {
  const ev = Events.EVENT_MAP[id];
  if (!ev) return '<p class="note">Unknown event.</p>';
  const rot = evRotation();
  const P = evProgress();
  const st = eventState(ev, rot);
  if (ev.tiers && !ev.tiers.some((t) => t.id === hub.tier)) {
    // Default to the highest unlocked tier
    hub.tier = ev.tiers.filter((t) => Events.tierUnlocked(P, ev.id, t.id) || rot.forceAll).pop().id;
  }
  const rules = Events.buildMatch(ev.id, { seed: 1, tier: hub.tier, decks: { A: STARTER_DECK, B: STARTER_DECK } }).rules;
  const rec = P.records[ev.id] || { played: 0, wins: 0, losses: 0, best: 0, bestTier: -1, fastest: 0, firstWin: {}, milestones: {} };
  const tierOk = !ev.tiers || Events.tierUnlocked(P, ev.id, hub.tier) || rot.forceAll;
  const deck = myDeckCheck(ev);
  const winsToday = st.winsToday;
  const ends = ev.schedule === 'permanent' ? null : rot.dayEndsAt;
  const r = ev.rewards;
  const firstKey = hub.tier || 'base';
  const canPlay = st.open && tierOk;
  const playBtn = (mode, label) => {
    if (!ev.modes.includes(mode)) return '';
    return `<button type="button" class="${mode === 'ai' ? 'btn-primary' : ''}" data-ev-play="${mode}" ${canPlay ? '' : 'disabled'}>${label}</button>`;
  };
  return `
  <header class="ev-head art-${ev.art}">
    <button type="button" class="ev-back" data-ev-back aria-label="Back to the Event Hub">‹ Events</button>
    <div class="ev-head-badge" aria-hidden="true">${ev.icon}</div>
    <div><p class="road-kicker">${escapeHtml(ev.category.toUpperCase())} · ${stars(ev.difficulty)}</p><h3>${escapeHtml(ev.name)}</h3>
    <p class="ev-sub">${ends ? `⏳ <b data-ends="${ends}">${fmtLeft(ends - rot.now)}</b> left` : '♾️ Always open'} · ${ev.modes.map((m) => MODE_LABEL[m]).join(' · ')}</p></div>
  </header>
  <div class="ev-scroll">
    <p class="ev-desc">${escapeHtml(ev.desc)}</p>
    ${ev.tiers ? `<div class="ev-tiers" role="radiogroup" aria-label="${ev.id === 'chaos' ? 'Intensity' : 'Difficulty'}">${ev.tiers.map((t, i) => {
      const un = Events.tierUnlocked(P, ev.id, t.id) || rot.forceAll;
      return `<button type="button" role="radio" aria-checked="${hub.tier === t.id}" class="ev-tier ${hub.tier === t.id ? 'on' : ''} ${un ? '' : 'locked'}" data-ev-tier="${t.id}">${un ? '' : '🔒 '}${escapeHtml(t.name)}${rec.bestTier >= i ? ' ✓' : ''}<small>${escapeHtml(un ? t.blurb : `Win ${ev.tiers[i - 1].name} first`)}</small></button>`;
    }).join('')}</div>` : ''}
    <div class="ev-cols">
      <section class="ev-box"><h5>📜 Rules</h5><ul>${ev.rules.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul></section>
      <section class="ev-box"><h5>🏆 Win</h5><p>${escapeHtml(ev.win)}</p><h5>💀 Lose</h5><p>${escapeHtml(ev.loss)}</p></section>
      <section class="ev-box"><h5>🃏 Deck</h5><p>${escapeHtml(deckRulesText(ev))}</p>
        ${ev.deck === 'own' ? (deck.ok ? '<p class="ev-ok">✓ Your active deck is legal.</p>' : `<p class="ev-bad">✕ ${deck.problems.map(escapeHtml).join(' ')}</p><p class="note">You can still play: you'll get a legal loaner deck for this match. Or fix your deck in the deck editor.</p>`) : ''}
        <h5>✦ Evolutions</h5><p>${escapeHtml(evoRulesText(ev, rules))}</p></section>
      <section class="ev-box"><h5>💧 Elixir & clock</h5><p>${escapeHtml(elixirRulesText(rules))}</p><p>Clock: ${Math.floor(rules.regulation / 60)}:${String(rules.regulation % 60).padStart(2, '0')}${rules.overtime ? ` + ${rules.overtime}s overtime` : ', no overtime'}.</p>
        <h5>🎲 Random vs fixed</h5><p><b>Random:</b> ${escapeHtml(ev.random || 'Nothing.')}<br><b>Fixed:</b> ${escapeHtml(ev.fixed || 'Everything.')}</p></section>
      ${ev.id === 'chaos' ? `<section class="ev-box wide"><h5>🌀 Modifiers that can appear (${escapeHtml((ev.tiers.find((t) => t.id === hub.tier) || ev.tiers[0]).name)})</h5><div class="mod-list">${Object.keys(Sim.MODIFIERS).filter((m) => { const d = Sim.MODIFIERS[m]; const tier = Events.CHAOS_TIERS.find((t) => t.id === hub.tier) || Events.CHAOS_TIERS[0]; return d.fixed ? tier.finale : d.sev <= tier.maxSev; }).map((m) => { const d = Sim.MODIFIERS[m]; return `<div class="mod-row cat-${d.cat}"><span class="mod-ic">${d.icon}</span><b>${escapeHtml(d.name)}</b><em>${escapeHtml(d.desc)}</em><i>${d.dur}s</i></div>`; }).join('')}</div>${hub.tier === 'total' ? `<h5>📜 Chaos Laws (one per match)</h5><div class="mod-list">${Events.CHAOS_LAWS.map((l) => `<div class="mod-row"><span class="mod-ic">📜</span><b>${escapeHtml(l.name)}</b><em>${escapeHtml(l.desc)}</em></div>`).join('')}</div>` : ''}</section>` : ''}
      <section class="ev-box"><h5>🎁 Rewards</h5><ul>
        <li>Win: 💰 ${r.win} gold (${Math.max(0, Events.DAILY_WIN_CAP - winsToday)}/${Events.DAILY_WIN_CAP} rewarded wins left today; scaled by AI difficulty)</li>
        <li>Playing: 💰 ${r.play} gold</li>
        <li>First win${ev.tiers ? ' on each tier' : ''}: 💰 ${r.first.gold}${r.first.chest ? ' + chest' : ''}${r.first.wild ? ` + ${r.first.wild} Wild Shard${r.first.wild > 1 ? 's' : ''}` : ''} ${rec.firstWin[firstKey] ? '<span class="ev-ok">✓ claimed</span>' : ''}</li>
        ${(r.milestones || []).map((m) => `<li>${m.wins} wins: ${[m.gold ? `💰 ${m.gold}` : '', m.chest ? 'chest' : '', m.badge ? `badge ${Events.BADGES[m.badge].icon}` : ''].filter(Boolean).join(' + ')} ${rec.milestones[`w${m.wins}`] ? '<span class="ev-ok">✓</span>' : `(${Math.min(rec.wins, m.wins)}/${m.wins})`}</li>`).join('')}
        <li class="note">Local PvP is friendly (no rewards, records or unlocks); admin/dev matches pay nothing.</li></ul></section>
      <section class="ev-box"><h5>📈 Your record</h5><p>${rec.played} played · ${rec.wins} won · ${rec.losses} lost${rec.best ? ` · best score ${rec.best}` : ''}${rec.fastest ? ` · fastest win ${rec.fastest}s` : ''}${rec.streak ? ` · streak ${rec.streak}` : ''}</p></section>
    </div>
  </div>
  <footer class="ev-foot-bar">
    ${ev.modes.includes('ai') ? `<label class="ev-ai">AI <select data-ev-ai ${(ev.id === 'boss' || ev.id === 'survival') ? 'disabled' : ''}>${AI_LEVELS.map((a) => `<option value="${a.id}" ${hub.ai === a.id ? 'selected' : ''}>${a.name}</option>`).join('')}</select></label>` : ''}
    ${!st.open ? `<span class="ev-bad">🔒 ${escapeHtml(st.reason || 'Not available')}</span>` : !tierOk ? '<span class="ev-bad">🔒 Locked tier</span>' : ''}
    ${playBtn('ai', ev.id === 'boss' || ev.id === 'survival' ? '⚔️ Play' : '⚔️ vs AI')}${playBtn('pvp', '👥 Local PvP')}${playBtn('online', '🌐 Online')}
  </footer>`;
}

function challengeDetailsHtml(id) {
  const ch = Events.CHALLENGE_MAP[id];
  const rot = evRotation();
  const P = evProgress();
  const s = Events.challengeState(P, id, rot.now);
  const open = Events.availability(id, rot.now, { forceAll: rot.forceAll });
  return `
  <header class="ev-head art-${ch.art}">
    <button type="button" class="ev-back" data-ev-back aria-label="Back to the Event Hub">‹ Events</button>
    <div class="ev-head-badge" aria-hidden="true">${ch.icon}</div>
    <div><p class="road-kicker">WEEKLY CHALLENGE · ${ch.lives} LIVES</p><h3>${escapeHtml(ch.name)}</h3>
    <p class="ev-sub">⏳ <b data-ends="${rot.weekEndsAt}">${fmtLeft(rot.weekEndsAt - rot.now)}</b> left this week · ${s.completions} completion${s.completions === 1 ? '' : 's'} · best round ${s.best}/${ch.rounds.length}</p></div>
  </header>
  <div class="ev-scroll">
    <p class="ev-desc">${escapeHtml(ch.desc)}</p>
    <ol class="ch-rounds">${ch.rounds.map((r, i) => {
      const ev = Events.EVENT_MAP[r.event];
      const state = i < s.round && (s.active || s.claimed[`r${i}`] || s.claimed.final) ? 'done' : i === s.round && s.active ? 'now' : '';
      const prize = i < ch.rounds.length - 1 ? `💰 ${ch.roundGold[i]}${s.claimed[`r${i}`] ? ' ✓' : ''}` : `🏆 ${ch.final.gold} + chest + ${ch.final.wild} ✦ + badge${s.claimed.final ? ' ✓' : ''}`;
      return `<li class="${state}"><span class="ch-n">${i + 1}</span><span class="ch-ev">${ev.icon} <b>${escapeHtml(evName(ev, r.tier))}</b><small>${escapeHtml(r.note)} · AI: ${escapeHtml(r.ai)}</small></span><span class="ch-prize">${prize}</span></li>`;
    }).join('')}</ol>
    <div class="ev-box"><h5>How it works</h5><ul>
      <li>Win a round to move on. Each loss costs a life; lose ${ch.lives} and the run ends.</li>
      <li>Round prizes and the final prize are paid once per week. You can start a new run any time.</li>
      <li>Leaving a round after you've played a card counts as a loss. A run started this week can be finished after the week ends.</li>
      <li>Rounds use each event's rules and your active deck (a legal loaner deck if it doesn't fit).</li>
    </ul></div>
  </div>
  <footer class="ev-foot-bar">
    ${s.active ? `<span class="ev-status">Round ${s.round + 1}/${ch.rounds.length} · ${'❤️'.repeat(ch.lives - s.losses)}${'🖤'.repeat(s.losses)}</span>` : ''}
    ${!open.ok && !s.active ? `<span class="ev-bad">🔒 ${escapeHtml(open.reason)}</span>` : ''}
    ${s.active ? '<button type="button" data-ch-abandon>Give up run</button>' : ''}
    <button type="button" class="btn-primary" data-ch-play="${id}" ${open.ok || s.active ? '' : 'disabled'}>${s.active ? `▶ Play round ${s.round + 1}` : '▶ Start run'}</button>
  </footer>`;
}

// ─── Starting an event ───────────────────────────────────────────────────────

function playEvent(spec) {
  const ev = Events.EVENT_MAP[spec.eventId];
  if (!ev) { toast('⚠️', 'Unknown event', 'That event no longer exists.'); return; }
  const rot = evRotation();
  const open = spec.challenge ? { ok: true } : Events.availability(ev.id, rot.now, { forceAll: rot.forceAll });
  if (!open.ok) { toast('🔒', `${ev.name} is closed`, open.reason || ''); renderEventsOverlay(); return; }
  if (ev.tiers && !spec.challenge && !Events.tierUnlocked(evProgress(), ev.id, spec.tier) && !rot.forceAll) { toast('🔒', 'Tier locked', 'Win the previous tier first.'); return; }
  if (!ev.modes.includes(spec.mode)) { toast('⚠️', `${ev.name} can't be played that way`, ''); return; }
  Sound.unlock();
  if (spec.mode === 'online') { startOnlineEvent(spec); return; }
  if (ev.deck === 'draft') { openDraft(spec); return; }
  setupEventMatch(spec, null);
}

// Same shape as setupMatch() in prototype_v4.js, for an event's config
function setupEventMatch(spec, picks) {
  const ev = Events.EVENT_MAP[spec.eventId];
  try {
    forfeitRunningRanked();
    forfeitRunningEvent();
    leaveQueue();
    closeEvents();
    closeDraft();
    onlineActive = false;
    lastMatchWasOnline = false;
    if (ui.lobbyPanel) ui.lobbyPanel.hidden = true;
    const vsAi = spec.mode === 'ai';
    state.mode = vsAi ? 'ai' : 'pvp';
    if (ui.mode) ui.mode.value = state.mode;
    document.body.classList.toggle('mode-ai', vsAi);
    const seed = Math.floor(Math.random() * 2147483647);
    const now = evNow();
    const b = state.progress.buildings;
    // Event towers are the same for both sides (no AI health bonus)
    const towers = { towerLevel: b.towerLevel, kingLevel: b.baseLevel };
    const own = deckFor('A');
    const level = averageDeckLevel(own);
    let ids = own;
    let loaner = false;
    if (ev.deck === 'own' && !Events.validateDeck(ev.id, own).ok) { ids = Events.loanerDeck(ev.id, seed); loaner = true; }
    const myEvos = loaner ? [] : state.admin.active ? ids.filter(evoSlug).slice(0, evoSlotsFor(state.mode)) : equippedEvos(ids, state.mode);
    const A = loaner ? ids.map((id) => ({ id, level, abilityUnlocked: false, mastery: 0, evo: false })) : deckEntries(ids, myEvos);
    let B = A;
    if (vsAi) {
      const aiIds = Events.aiDeckFor(ev.id, seed + 7, Road.arenaFor(state.progress.road.trophies).id);
      const evos = new Set(Sim.aiEvoPicks(aiIds, aiEvoSlots()));
      B = aiIds.map((id) => ({ id, level, abilityUnlocked: false, mastery: 0, evo: evos.has(id) }));
    }
    const cfg = Events.buildMatch(ev.id, { seed, tier: spec.tier, decks: { A, B }, hasEvo: A.concat(B).some((e) => e.evo), picks, rounds: spec.rounds, level, now });
    const match = Sim.createMatch({ seed, rules: cfg.rules, decks: cfg.decks, towers: { A: towers, B: towers } });
    // Only switch over once everything above worked
    state.match = match;
    state.ai = vsAi && !cfg.scripted ? Sim.createAi('B', presetProfile(spec.ai || 'normal')) : null;
    state.rankedMatch = null;
    const matchId = `ev-${ev.id}-${now.toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
    state.eventMatch = { matchId, eventId: ev.id, tier: cfg.tier, mode: spec.mode, ai: spec.ai || 'normal', challenge: spec.challenge || null, scripted: cfg.scripted, law: cfg.law, loaner, startedAt: now, engaged: false };
    state.aiTag = `${ev.icon} ${evName(ev, cfg.tier)}${vsAi && !cfg.scripted ? ` · ${(AI_LEVELS.find((a) => a.id === (spec.ai || 'normal')) || AI_LEVELS[1]).name} AI` : ''}`;
    if (spec.mode !== 'pvp') {
      const stale = Events.beginMatch(evProgress(), { matchId, eventId: ev.id, tier: cfg.tier, challenge: spec.challenge, ai: spec.ai }, now);
      if (stale && stale.applied) toast('🏳️', 'Unfinished event match', 'It was counted as a loss.');
    }
    saveProgress();
    lastEventSpec = { ...spec, rounds: undefined };
    state.viewSource = 'local';
    state.running = true;
    state.winner = null;
    state.selectedCard = null;
    state.acc = 0;
    state.damageSeen = 0;
    state.goldPool = 0;
    state.snapPrev = Sim.snapshot(state.match);
    state.snapCur = state.snapPrev;
    state.view = state.snapCur;
    beginMatchPresentation();
    announceEvent(ev, cfg.tier, cfg.law, loaner);
    renderDecks();
    renderStatus();
    writeLog(`${ev.icon} ${evName(ev, cfg.tier)} started.${loaner ? ' Your deck did not fit the rules, so you have a loaner deck.' : ''}`);
    scrollToBattle();
  } catch (err) {
    // Never leave the player stuck: back to a normal battle and the hub, with an explanation
    console.error(err);
    state.eventMatch = null;
    toast('⚠️', 'The event could not start', 'Nothing was counted. Please try again.');
    setupMatch();
    openEvents(spec.eventId);
  }
}

function announceEvent(ev, tier, law, loaner) {
  if (!arena) return;
  setTimeout(() => {
    if (!state.eventMatch && !(onlineMatch && onlineMatch.eventId)) return;
    arena.announce(evName(ev, tier).toUpperCase(), { sub: law ? `📜 ${law.name}: ${law.desc}` : ev.tagline, color: '#c38bff', dur: 2600 });
    if (loaner) arena.ribbon('Loaner deck: yours broke the event rules', { icon: '🃏', color: '#ffb36c', life: 3600 });
    Sound.play('chaos');
  }, 1450);
}

// Starting anything else in the middle of an event match you've played a card in counts as a loss
function forfeitRunningEvent() {
  const em = state.eventMatch;
  state.eventMatch = null;
  if (!em || em.mode === 'pvp' || em.mode === 'online' || !state.match || !state.match.running) return;
  const res = Events.resolvePending(evProgress(), evNow());
  saveProgress();
  if (res && res.applied) toast('🏳️', 'Event match abandoned', em.challenge ? 'Counted as a loss (one life gone).' : 'Counted as a loss.');
}

// Called after every successful card play by the local player
function eventEngaged() {
  const em = state.eventMatch || (onlineMatch && onlineMatch.eventId ? onlineMatch : null);
  if (!em || em.engaged) return;
  em.engaged = true;
  Events.markEngaged(evProgress(), em.matchId);
  saveProgress();
}

// ─── Draft ───────────────────────────────────────────────────────────────────

function openDraft(spec) {
  const rounds = Events.draftRounds(Math.floor(Math.random() * 2147483647));
  draftSession = { spec, rounds, picks: [] };
  closeEvents();
  renderDraft();
  if (evUi.draft) evUi.draft.hidden = false;
}

function closeDraft() {
  if (evUi.draft) evUi.draft.hidden = true;
}

function draftCardHtml(id, i) {
  const c = CARD_MAP[id];
  const type = c.spell ? 'Spell' : c.building ? 'Building' : c.swarmCount > 1 ? `Troop ×${c.swarmCount}` : 'Troop';
  return `<button type="button" class="draft-card rarity-${c.rarity}" data-draft-pick="${i}">
    <span class="dc-cost ${costClass(c.cost)}">${c.cost}</span><span class="dc-icon">${c.icon}</span>
    <b>${escapeHtml(c.name)}</b><small>${escapeHtml(type)} · ${escapeHtml(c.role)}</small><em>${escapeHtml(c.desc)}</em>
  </button>`;
}

function renderDraft() {
  if (!evUi.draft || !draftSession) return;
  const d = draftSession;
  const i = d.picks.length;
  const decks = Events.draftDecks(d.rounds.slice(0, i), d.picks);
  const round = d.rounds[i];
  evUi.draft.querySelector('.draft-modal').innerHTML = `
    <button type="button" class="road-close" data-draft-cancel aria-label="Cancel draft">✕</button>
    <p class="road-kicker">DRAFT DUEL · ROUND ${Math.min(i + 1, 8)} OF 8</p>
    ${round ? `<h3>${escapeHtml(round.role)}</h3><p class="note">Keep one. Your opponent gets the other.</p>
    <div class="draft-pair">${round.options.map((id, k) => draftCardHtml(id, k)).join('<span class="draft-vs">or</span>')}</div>` : '<h3>Draft complete!</h3>'}
    <div class="draft-decks">
      <div><b>Your deck</b><span>${decks.A.map((id) => `<i title="${escapeHtml(CARD_MAP[id].name)}">${CARD_MAP[id].icon}</i>`).join('')}${'<i class="empty"></i>'.repeat(8 - i)}</span></div>
      <div><b>AI's deck</b><span>${decks.B.map((id) => `<i title="${escapeHtml(CARD_MAP[id].name)}">${CARD_MAP[id].icon}</i>`).join('')}${'<i class="empty"></i>'.repeat(8 - i)}</span></div>
    </div>
    <p class="note">Leaving the draft costs nothing; a new draft starts next time.</p>`;
}

function pickDraft(k) {
  const d = draftSession;
  if (!d || d.picks.length >= 8) return;
  d.picks.push(k === 1 ? 1 : 0);
  Sound.play('select');
  if (d.picks.length < 8) { renderDraft(); return; }
  renderDraft();
  const spec = d.spec;
  const picks = d.picks.slice();
  setTimeout(() => { draftSession = null; closeDraft(); setupEventMatchFromDraft(spec, picks, d.rounds); }, 500);
}

// Build the match from exactly the rounds the player saw
function setupEventMatchFromDraft(spec, picks, rounds) {
  setupEventMatch({ ...spec, rounds }, picks);
}

// ─── Online events ───────────────────────────────────────────────────────────

function startOnlineEvent(spec) {
  onlineEvent = { eventId: spec.eventId, tier: spec.tier || null };
  closeEvents();
  if (ui.mode) ui.mode.value = 'online';
  showOnlineLobby();
  renderLobbyEvent();
  scrollToBattle();
}

function renderLobbyEvent() {
  if (!evUi.lobbyEvent) return;
  if (!onlineEvent) { evUi.lobbyEvent.hidden = true; return; }
  const ev = Events.EVENT_MAP[onlineEvent.eventId];
  evUi.lobbyEvent.hidden = false;
  evUi.lobbyEvent.innerHTML = `<span>${ev.icon} <b>${escapeHtml(evName(ev, onlineEvent.tier))}</b> · casual (no trophies). Find Match pairs you with someone in this event; a room you create uses it too.</span><button type="button" data-lobby-event-clear>Normal match instead</button>`;
}

// The extra fields the online lobby sends with Find Match / Create Room
function onlineEventPayload() {
  return onlineEvent ? { eventId: onlineEvent.eventId, tier: onlineEvent.tier } : {};
}

// match_start from the server: an event match the server configured
function onlineEventStarted(info) {
  if (!info || !info.eventId || !Events.EVENT_MAP[info.eventId]) return;
  const ev = Events.EVENT_MAP[info.eventId];
  const now = evNow();
  const stale = Events.beginMatch(evProgress(), { matchId: info.matchId, eventId: ev.id, tier: info.tier, ai: 'online' }, now);
  if (stale && stale.applied) toast('🏳️', 'Unfinished event match', 'It was counted as a loss.');
  saveProgress();
  const law = info.law ? Events.CHAOS_LAWS.find((l) => l.id === info.law) : null;
  announceEvent(ev, info.tier, law, false);
}

// ─── Results ─────────────────────────────────────────────────────────────────

function grantEventRewards(res) {
  let gold = 0;
  const lines = [];
  res.rewards.forEach((r) => {
    switch (r.kind) {
      case 'gold': state.progress.gold += r.amount; gold += r.amount; lines.push({ icon: '💰', text: `+${r.amount} gold`, sub: r.label }); break;
      case 'chest': { const g = grantTierRewards(2); gold += g.gold; lines.push({ icon: '🎁', text: `Chest: +${g.gold} gold${g.unlockedName ? `, ${g.unlockedName}` : ''}`, sub: r.label }); break; }
      case 'wild': lines.push({ icon: '✦', text: grantWildShards(r.amount), sub: r.label }); break;
      case 'badge': lines.push({ icon: Events.BADGES[r.id].icon, text: r.label, sub: 'Show it on your nameplate in the Event Hub' }); break;
      case 'note': lines.push({ icon: 'ℹ️', text: r.label, sub: '' }); break;
      default: break;
    }
  });
  return { gold, lines };
}

// What the engine snapshot says about the local player's match, for scoring
function eventResultDetails(snap, side, result) {
  const mine = snap ? snap.towers.filter((t) => t.owner === side) : [];
  const ev = snap && snap.ev ? snap.ev : {};
  let waves = 0;
  if (ev.wave) waves = result === 'win' ? ev.wave.total : Math.max(0, ev.wave.n - (ev.wave.left > 0 ? 1 : 0));
  return {
    towersLost: mine.filter((t) => t.hp <= 0).length,
    towersStanding: mine.filter((t) => t.hp > 0).length,
    waves,
    bossHpFrac: ev.boss && ev.boss.hpMax ? ev.boss.hp / ev.boss.hpMax : null,
    timeLeft: snap ? snap.timeLeft : 0,
    hillCrowns: snap ? snap.players[side].hill || 0 : 0,
    duration: snap ? snap.time : 0,
    cardsPlayed: snap ? snap.players[side].played : 0,
  };
}

const EVENT_END_TEXT = { firstCrown: 'First tower down', crownRace: 'First to 3 crowns', survived: 'Held the line', boss: 'The Colossus falls', timeout: 'Time ran out' };

// Local event match finished (called from onVictory)
function onEventVictory(winner) {
  const em = state.eventMatch;
  const ev = Events.EVENT_MAP[em.eventId];
  state.winner = winner;
  state.running = false;
  state.selectedCard = null;
  const snap = state.snapCur;
  const pvp = em.mode === 'pvp';
  const result = winner === 'draw' ? 'draw' : winner === 'A' ? 'win' : 'loss';
  const details = eventResultDetails(snap, 'A', result);
  const res = Events.settleMatch(evProgress(), {
    matchId: em.matchId, eventId: em.eventId, tier: em.tier, result, ai: em.ai, mode: em.mode, challenge: em.challenge,
    noRewards: evDevAll(), ...details,
  }, evNow());
  const granted = grantEventRewards(res);
  const newAch = recordMatch({
    result, crowns: snap ? snap.players.A.crowns : 0, kingKill: winner === 'A' && state.match.endReason === 'king',
    evoPlayed: snap ? snap.players.A.evoPlayed || 0 : 0, hardAi: !pvp && ['hard', 'insane'].includes(em.ai) && !em.scripted, online: false,
  });
  if (res.unlockedTier) setTimeout(() => toast(ev.icon, `Unlocked: ${res.unlockedTier.name}`, ev.name), 2600);
  res.achievements.forEach((a, i) => setTimeout(() => { toast(a.icon, `Event achievement: ${a.name}`, a.desc); Sound.play('achievement'); }, 2900 + i * 900));
  saveProgress();
  renderProgress();
  renderCollection();
  renderEventsButton();
  Sound.play(result === 'win' ? 'win' : result === 'draw' ? 'draw' : 'lose');
  const reason = EVENT_END_TEXT[state.match.endReason] || endReasonText(state.match.endReason);
  const headline = pvp && winner !== 'draw' ? `${playerName(winner).toUpperCase()} WINS!` : null;
  const banner = headline || (result === 'win' ? 'VICTORY!' : result === 'draw' ? 'DRAW' : 'DEFEAT');
  writeLog(`${ev.icon} ${evName(ev, em.tier)}: ${banner}. ${reason}.`);
  const crownSide = pvp && winner === 'B' ? 'B' : 'A';
  presentResult(result, banner, () => showWinOverlay(result, null, granted.gold, false, {
    headline,
    detail: `${evName(ev, em.tier)} · ${reason} · ${crownLine(snap)}`,
    crowns: snap ? snap.players[crownSide].crowns : 0,
    stats: matchStats(snap, crownSide).concat(res.score ? [[ev.scoreLabel || 'Score', res.score.toLocaleString()]] : []),
    achievements: newAch,
    event: { ev, em, res, lines: granted.lines, pvp },
  }));
}

// Online event match finished (called from handleOnlineVictory)
function onlineEventFinished(om, winner, last, forfeit) {
  const ev = Events.EVENT_MAP[om.eventId];
  const won = winner === mySide;
  const result = winner === 'draw' ? 'draw' : won ? 'win' : 'loss';
  const details = eventResultDetails(last, mySide, result);
  // An opponent leaving in the first 30 s voids the match: no win, no rewards, no unlocks
  // (otherwise a second window could farm them)
  const voided = !!forfeit && details.duration < 30;
  const res = Events.settleMatch(evProgress(), {
    matchId: om.matchId, eventId: om.eventId, tier: om.tier, result, mode: 'online', ai: 'online',
    noRewards: evDevAll(), void: voided, ...details,
  }, evNow());
  const granted = grantEventRewards(res);
  const newAch = voided ? [] : recordMatch({ result, crowns: last ? last.players[mySide].crowns : 0, kingKill: won && last?.endReason === 'king', hardAi: false, online: true, evoPlayed: last ? last.players[mySide].evoPlayed || 0 : 0 });
  res.achievements.forEach((a, i) => setTimeout(() => { toast(a.icon, `Event achievement: ${a.name}`, a.desc); Sound.play('achievement'); }, 2900 + i * 900));
  saveProgress();
  renderProgress();
  renderCollection();
  renderEventsButton();
  Sound.play(won ? 'win' : winner === 'draw' ? 'draw' : 'lose');
  const reason = voided ? 'Opponent left early: match not counted' : forfeit ? 'Opponent left the match' : EVENT_END_TEXT[last && last.endReason] || endReasonText(last && last.endReason);
  const crowns = last ? `👑 You ${last.players[mySide].crowns} – ${last.players[enemyOf(mySide)].crowns} Opponent` : '';
  presentResult(voided ? 'draw' : result, voided ? 'NO CONTEST' : won ? 'VICTORY!' : winner === 'draw' ? 'DRAW' : 'DEFEAT', () => showWinOverlay(voided ? 'draw' : result, null, granted.gold, true, {
    headline: voided ? 'NO CONTEST' : null,
    detail: `${evName(ev, om.tier)} · ${reason} · ${crowns}`,
    crowns: last ? last.players[mySide].crowns : 0,
    stats: matchStats(last, mySide),
    achievements: newAch,
    friendly: true,
    event: { ev, em: { ...om, mode: 'online' }, res, lines: granted.lines, pvp: false },
  }));
}

// The event block on the results sheet (hidden for normal battles)
function renderWinEvent(x) {
  const el = evUi.winEvent;
  if (evUi.winHub) evUi.winHub.hidden = !x;
  if (!el) return;
  if (!x) { el.hidden = true; el.innerHTML = ''; return; }
  const { ev, em, res, lines, pvp } = x;
  const ch = res.challenge;
  const chDef = ch ? Events.CHALLENGE_MAP[ch.id] : null;
  el.hidden = false;
  el.innerHTML = `
    <div class="we-head">${ev.icon} <b>${escapeHtml(evName(ev, em.tier))}</b>${res.score ? ` · ${escapeHtml(ev.scoreLabel || 'Score')} <b>${res.score.toLocaleString()}</b>${res.newBest ? ' <span class="we-best">NEW BEST!</span>' : ''}` : ''}</div>
    ${ch ? `<div class="we-ch">${chDef.icon} ${escapeHtml(chDef.name)}: ${ch.done ? '🏆 <b>Challenge complete!</b>' : ch.failed ? '💔 Out of lives: the run is over.' : ch.result === 'win' ? `Round ${ch.round + 1} cleared! Next: round ${ch.state.round + 1}.` : `Lost round ${ch.round + 1}. ${'❤️'.repeat(chDef.lives - ch.state.losses)} left.`}</div>` : ''}
    ${res.unlockedTier ? `<div class="we-unlock">🔓 Unlocked ${escapeHtml(res.unlockedTier.name)}!</div>` : ''}
    <div class="we-lines">${lines.length ? lines.map((l) => `<div><span>${l.icon}</span><b>${escapeHtml(l.text)}</b>${l.sub ? `<em>${escapeHtml(l.sub)}</em>` : ''}</div>`).join('') : `<div class="note">${res.void ? 'Your opponent left in the first 30 seconds, so this match does not count.' : pvp ? 'Local PvP is friendly: no rewards, records or unlocks.' : res.applied ? 'No rewards this time.' : 'Already counted.'}</div>`}</div>`;
  if (ui.winClaim) {
    const nextRound = ch && ch.state && ch.state.active;
    ui.winClaim.textContent = em.mode === 'online' ? 'Continue' : nextRound ? `▶ Round ${ch.state.round + 1}` : ch ? 'Challenge' : 'Play again';
  }
}

// "Play again" after an event: the same event, or the next challenge round
function replayEvent() {
  const spec = lastEventSpec;
  if (!spec) return false;
  if (spec.challenge) {
    const s = Events.challengeState(evProgress(), spec.challenge, evNow());
    if (!s.active) { openEvents(spec.challenge); return true; }
    playChallenge(spec.challenge);
    return true;
  }
  playEvent(spec);
  return true;
}

function playChallenge(id) {
  const P = evProgress();
  const ch = Events.CHALLENGE_MAP[id];
  const s = Events.challengeState(P, id, evNow());
  const rot = evRotation();
  if (!s.active && !Events.availability(id, rot.now, { forceAll: rot.forceAll }).ok) { toast('🔒', `${ch.name} is closed`, 'It returns in a later week.'); return; }
  const started = Events.startChallenge(P, id, evNow());
  saveProgress();
  const round = started.round;
  const ev = Events.EVENT_MAP[round.event];
  const spec = { eventId: round.event, tier: round.tier, mode: 'ai', ai: round.ai, challenge: id };
  if (ev.deck === 'draft') { openDraft(spec); return; }
  setupEventMatch(spec, null);
}

// ─── In-battle event bar (above the arena; never covers the fight) ───────────

function renderEventBar() {
  const bar = evUi.bar;
  if (!bar) return;
  const v = state.view;
  const ev = v && v.ev;
  const evDef = ev && ev.id ? Events.EVENT_MAP[ev.id] : null;
  if (!evDef) { if (!bar.hidden) { bar.hidden = true; setHtml(bar, ''); } return; }
  bar.hidden = false;
  const me = state.viewSource === 'online' && mySide ? mySide : 'A';
  const foe = enemyOf(me);
  const em = state.eventMatch || onlineMatch;
  const parts = [`<span class="eb-name">${evDef.icon} ${escapeHtml(evName(evDef, em && em.tier))}</span>`];
  const law = em && em.law && (typeof em.law === 'string' ? Events.CHAOS_LAWS.find((l) => l.id === em.law) : em.law);
  if (law) parts.push(`<button type="button" class="eb-chip law" data-mod-info="law:${law.id}" title="${escapeHtml(law.desc)}">📜 ${escapeHtml(law.name)}</button>`);
  (ev.mods || []).forEach((m) => {
    const d = Sim.MODIFIERS[m.id];
    const pct = Math.round((m.left / m.dur) * 20) * 5;
    parts.push(`<button type="button" class="eb-chip cat-${d.cat}${m.left < 3 ? ' ending' : ''}" data-mod-info="${m.id}" title="${escapeHtml(d.desc)}" aria-label="${escapeHtml(d.name)} active, ${Math.ceil(m.left)} seconds left">${d.icon} ${escapeHtml(d.name)} <small>${Math.ceil(m.left)}s</small><i style="width:${pct}%"></i></button>`);
  });
  (ev.next || []).forEach((m) => {
    const d = Sim.MODIFIERS[m.id];
    parts.push(`<button type="button" class="eb-chip incoming" data-mod-info="${m.id}" title="${escapeHtml(d.desc)}" aria-label="Coming up: ${escapeHtml(d.name)} in ${Math.ceil(m.in)} seconds">⚠️ ${d.icon} ${escapeHtml(d.name)} <small>in ${Math.ceil(m.in)}s</small></button>`);
  });
  if (ev.hill) {
    const pct = (s) => Math.round((ev.hill[s] / ev.hill.points) * 100);
    parts.push(`<span class="eb-hill" aria-label="Hill meters: you ${pct(me)}%, opponent ${pct(foe)}%">⛰️ <i class="me" style="--p:${pct(me)}%"></i><b>${pct(me)}%</b> vs <b>${pct(foe)}%</b><i class="foe" style="--p:${pct(foe)}%"></i>${ev.hill.moveIn != null ? `<small>moves in ${Math.ceil(ev.hill.moveIn)}s</small>` : ''}</span>`);
  }
  if (ev.wave) parts.push(`<span class="eb-wave">🌊 Wave <b>${ev.wave.n}/${ev.wave.total}</b>${ev.wave.nextIn != null ? ` · next in ${Math.ceil(ev.wave.nextIn)}s` : ' · last wave!'} · ${ev.wave.left} attackers</span>`);
  if (ev.boss) {
    const b = ev.boss;
    const pct = b.hpMax ? Math.round((b.hp / b.hpMax) * 100) : 100;
    parts.push(b.spawned
      ? `<span class="eb-boss${b.enraged ? ' enraged' : ''}" aria-label="Iron Colossus ${pct}% health">🤖 <b>Iron Colossus</b><span class="eb-bossbar"><i style="width:${pct}%"></i></span><b>${pct}%</b>${b.guard ? '<em>🛡 Guarded: ½ damage</em>' : ''}${b.enraged ? '<em>😡 Enraged</em>' : ''}</span>`
      : `<span class="eb-boss">🤖 Iron Colossus arrives in ${Math.ceil(b.inSec)}s</span>`);
  }
  if (ev.swapIn != null && ev.swapIn <= 15) parts.push(`<span class="eb-chip incoming">🎡 Decks swap in <small>${Math.ceil(ev.swapIn)}s</small></span>`);
  setHtml(bar, parts.join(''));
}

// ─── Top-bar button, binding ─────────────────────────────────────────────────

function renderEventsButton() {
  if (!evUi.btn) return;
  const rot = evRotation();
  const P = evProgress();
  const s = Events.challengeState(P, rot.challenge, rot.now);
  const fresh = !P.seen.hub || s.active;
  evUi.btn.innerHTML = `🎪 Events${fresh ? '<i class="road-dot" aria-label="Something new">!</i>' : ''}`;
}

// The nameplate line during event matches (and your badge as a title)
function eventRankLine(side) {
  const P = evProgress();
  const title = P.title && Events.BADGES[P.title] ? `${Events.BADGES[P.title].icon} ${Events.BADGES[P.title].name} · ` : '';
  const isMe = state.viewSource === 'online' ? side === mySide : side === 'A';
  if (isMe) return `${title}${state.aiTag || ''}`;
  return state.viewSource === 'online' ? 'Event · casual' : (state.mode === 'pvp' ? state.aiTag : state.aiTag || '');
}

function bindEvents() {
  evUi.btn = document.getElementById('ptEventsBtn');
  evUi.overlay = document.getElementById('ptEventsOverlay');
  evUi.modal = document.getElementById('ptEventsModal');
  evUi.bar = document.getElementById('ptEventBar');
  evUi.draft = document.getElementById('ptDraftOverlay');
  evUi.winEvent = document.getElementById('ptWinEvent');
  evUi.winHub = document.getElementById('ptWinHub');
  evUi.lobbyEvent = document.getElementById('ptLobbyEvent');
  evUi.btn?.addEventListener('click', () => openEvents());
  evUi.overlay?.addEventListener('click', (e) => {
    if (e.target === evUi.overlay) { closeEvents(); return; }
    const t = e.target.closest('button, select');
    if (!t || t.disabled) return;
    if (t.matches('[data-ev-close]')) { closeEvents(); return; }
    if (t.matches('[data-ev-back]')) { hub.screen = 'hub'; hub.id = null; renderEventsOverlay(); return; }
    if (t.dataset.evOpen) {
      if (t.dataset.tier) hub.tier = t.dataset.tier;
      else if (hub.id !== t.dataset.evOpen) hub.tier = null;
      hub.screen = 'details';
      hub.id = t.dataset.evOpen;
      Sound.play('select');
      renderEventsOverlay();
      return;
    }
    if (t.dataset.evTier) { hub.tier = t.dataset.evTier; Sound.play('select'); renderEventsOverlay(); return; }
    if (t.dataset.evPlay) { playEvent({ eventId: hub.id, tier: hub.tier, mode: t.dataset.evPlay, ai: hub.ai }); return; }
    if (t.dataset.chPlay) { playChallenge(t.dataset.chPlay); return; }
    if (t.matches('[data-ch-abandon]')) {
      const s = evProgress().challenges[hub.id];
      if (s && s.active && window.confirm('Give up this run? Rounds you already cleared stay paid, but the run ends.')) { s.active = false; saveProgress(); renderEventsOverlay(); }
      return;
    }
    if (t.dataset.evTitle) {
      const P = evProgress();
      Events.setTitle(P, P.title === t.dataset.evTitle ? null : t.dataset.evTitle);
      saveProgress();
      Sound.play('select');
      renderEventsOverlay();
    }
  });
  evUi.overlay?.addEventListener('change', (e) => {
    if (e.target.matches('[data-ev-ai]')) hub.ai = e.target.value;
  });
  evUi.draft?.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.matches('[data-draft-cancel]')) { draftSession = null; closeDraft(); openEvents('draft'); return; }
    if (t.dataset.draftPick != null) pickDraft(Number(t.dataset.draftPick));
  });
  evUi.bar?.addEventListener('click', (e) => {
    const t = e.target.closest('[data-mod-info]');
    if (!t) return;
    const id = t.dataset.modInfo;
    if (id.startsWith('law:')) { const l = Events.CHAOS_LAWS.find((x) => x.id === id.slice(4)); if (l) toast('📜', l.name, l.desc); return; }
    const d = Sim.MODIFIERS[id];
    if (d) toast(d.icon, d.name, d.desc);
  });
  evUi.winHub?.addEventListener('click', () => { closeWinOverlay(); openEvents(lastEventSpec && lastEventSpec.challenge ? lastEventSpec.challenge : null); });
  evUi.lobbyEvent?.addEventListener('click', (e) => {
    if (e.target.closest('[data-lobby-event-clear]')) { onlineEvent = null; renderLobbyEvent(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (evUi.overlay && !evUi.overlay.hidden) { if (hub.screen === 'details') { hub.screen = 'hub'; renderEventsOverlay(); } else closeEvents(); }
    else if (evUi.draft && !evUi.draft.hidden) { draftSession = null; closeDraft(); }
  });
  renderEventsButton();
}
