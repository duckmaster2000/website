/*
 * Trophy Road screen, rank display, and the deck editor.
 * Loaded before prototype_v4.js; everything here runs later (at call time) and uses that file's
 * globals: state, ui, Sim, Road, CARD_MAP, cardProgress, saveProgress, toast, Sound, ...
 * The trophy and reward rules themselves live in shared/trophy-road.js.
 */

const roadUi = {
  filter: { type: 'all', own: 'all', variants: false, sort: 'cost' },
  pickSlot: null,   // deck slot chosen first (then a card)
  countRaf: 0,
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// ─── Rank display ─────────────────────────────────────────────────────────────

// Nameplate line under each player's name
function rankLine(side) {
  const road = state.progress.road;
  const online = state.viewSource === 'online';
  const isMe = online ? side === mySide : side === 'A';
  if (online) {
    if (!isMe) return onlineMatch && onlineMatch.ranked ? '🏆 Ranked' : 'Friendly';
    return `🏆 ${road.trophies} · ${Road.rankOf(road.trophies).label}`;
  }
  if (state.mode === 'pvp') return 'Friendly · no trophies';
  if (isMe) return `🏆 ${road.trophies} · ${Road.rankOf(road.trophies).label}`;
  return state.aiTag || '';
}

function claimableCount() {
  return Road.claimable(state.progress.road).length;
}

// Top-bar Trophy Road button: trophies, arena and a dot when rewards are waiting
function renderRoadBadge() {
  if (!ui.roadBtn) return;
  const road = state.progress.road;
  const arena = Road.arenaFor(road.trophies);
  const n = claimableCount();
  ui.roadBtn.innerHTML = `<span class="rb-trophy">🏆 <b>${road.trophies}</b></span><span class="rb-arena">${arena.icon} ${escapeHtml(arena.name)}</span>${n ? `<i class="road-dot" aria-label="${n} rewards ready">${n}</i>` : ''}`;
  ui.roadBtn.classList.toggle('has-rewards', n > 0);
}

// ─── Results screen: trophy change ────────────────────────────────────────────

function renderWinTrophies(trophy, friendly) {
  const el = ui.winTrophies;
  if (!el) return;
  cancelAnimationFrame(roadUi.countRaf);
  if (!trophy) {
    el.hidden = !friendly;
    el.className = 'win-trophies friendly';
    el.innerHTML = friendly ? '<span class="wt-note">Friendly match: no trophies</span>' : '';
    return;
  }
  el.hidden = false;
  const up = trophy.delta > 0;
  const down = trophy.delta < 0;
  el.className = `win-trophies ${up ? 'up' : down ? 'down' : 'flat'}`;
  const notes = [];
  if (trophy.capped) {
    const d = state.progress.aiDifficulty;
    const rules = Road.AI_RULES[d] || Road.AI_RULES.normal;
    notes.push(`${rules.label} AI can't take you past ${rules.cap} 🏆. Try a harder difficulty or play online.`);
  }
  if (trophy.floor) notes.push(`Arena gate: you can't drop below ${trophy.arena.min} 🏆.`);
  el.innerHTML = `
    <div class="wt-row"><span class="wt-icon">🏆</span><b class="wt-count">${trophy.before}</b><span class="wt-delta">${up ? '+' : ''}${trophy.delta}</span></div>
    <div class="wt-arena">${trophy.arena.icon} ${escapeHtml(Road.rankOf(trophy.after).label)}</div>
    ${trophy.arenaUp ? `<div class="wt-up">✨ NEW ARENA: ${trophy.arenaUp.icon} ${escapeHtml(trophy.arenaUp.name)}!</div>` : ''}
    ${notes.map((n) => `<div class="wt-note">${escapeHtml(n)}</div>`).join('')}`;
  // Count up (or down) to the new total
  const countEl = el.querySelector('.wt-count');
  const start = performance.now();
  const dur = 900;
  if (trophy.delta) Sound.play(up ? 'trophyUp' : 'trophyDown');
  const tick = (now) => {
    const k = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - k, 3);
    countEl.textContent = String(Math.round(trophy.before + (trophy.after - trophy.before) * eased));
    if (k < 1) roadUi.countRaf = requestAnimationFrame(tick);
  };
  roadUi.countRaf = requestAnimationFrame(tick);
}

// ─── Trophy Road screen ───────────────────────────────────────────────────────

function rewardLabel(r) {
  switch (r.type) {
    case 'gold': return { icon: '💰', text: `${r.amount} gold`, cls: 'gold' };
    case 'chest': return { icon: '🎁', text: `Tier ${r.tier} chest`, cls: `chest tier-${r.tier}` };
    case 'copies': return { icon: '🃏', text: `${r.amount} card copies`, cls: 'copies' };
    case 'card': {
      const c = CARD_MAP[r.id];
      return { icon: c ? c.icon : '❓', text: c ? c.name : r.id, cls: `card rarity-${c ? c.rarity : 'common'}`, sub: c ? `New ${c.spell ? 'spell' : c.building ? 'building' : 'troop'}` : '' };
    }
    case 'emote': {
      const e = EmoteArt.EMOTES.find((x) => x.id === r.id);
      return { icon: '', emote: r.id, text: `“${e ? e.name : r.id}” emote`, cls: 'emote' };
    }
    case 'arena': {
      const a = Road.ARENAS[r.arena];
      return { icon: a.icon, text: `${a.name} unlocked`, cls: 'arena' };
    }
    default: return { icon: '❔', text: '', cls: '' };
  }
}

function rewardPill(r) {
  const l = rewardLabel(r);
  const art = l.emote ? `<canvas class="rp-emote" width="64" height="64" data-emote="${l.emote}"></canvas>` : `<span class="rp-icon">${l.icon}</span>`;
  return `<span class="reward-pill ${l.cls}">${art}<span class="rp-text">${escapeHtml(l.text)}${l.sub ? `<small>${escapeHtml(l.sub)}</small>` : ''}</span></span>`;
}

function openRoad() {
  if (!ui.roadOverlay) return;
  renderRoad();
  ui.roadOverlay.hidden = false;
  document.body.classList.add('road-open');
  Sound.play('select');
  // Bring "you are here" into view
  requestAnimationFrame(() => {
    const me = ui.roadOverlay.querySelector('.road-you');
    if (me) me.scrollIntoView({ block: 'center' });
  });
}

function closeRoad() {
  if (!ui.roadOverlay) return;
  ui.roadOverlay.hidden = true;
  document.body.classList.remove('road-open');
}

function renderRoad() {
  const overlay = ui.roadOverlay;
  if (!overlay) return;
  const road = state.progress.road;
  const arena = Road.arenaFor(road.trophies);
  const next = Road.nextArena(road.trophies);
  const rank = Road.rankOf(road.trophies);
  const pct = next ? Math.round(((road.trophies - arena.min) / (next.min - arena.min)) * 100) : 100;
  const ready = Road.claimable(road);

  overlay.querySelector('#ptRoadHead').innerHTML = `
    <div class="road-badge theme-${arena.theme}"><span>${arena.icon}</span></div>
    <div class="road-headtext">
      <p class="road-kicker">TROPHY ROAD</p>
      <h3>${escapeHtml(arena.name)}</h3>
      <p class="road-rank">${escapeHtml(rank.label)} · Best ${road.best} 🏆</p>
      <div class="road-progress" aria-label="Progress to the next arena">
        <div class="road-progress-fill" style="width:${pct}%"></div>
        <span>${next ? `🏆 ${road.trophies} / ${next.min} · ${next.min - road.trophies} to ${escapeHtml(next.name)}` : `🏆 ${road.trophies} · Top arena reached!`}</span>
      </div>
    </div>
    <div class="road-trophies"><b>${road.trophies}</b><span>🏆</span></div>`;

  const themes = Road.unlockedThemes(road);
  overlay.querySelector('#ptRoadTools').innerHTML = `
    <button type="button" class="road-claim-all btn-primary" data-claim-all ${ready.length ? '' : 'disabled'}>${ready.length ? `🎁 Claim all (${ready.length})` : 'No rewards waiting'}</button>
    <div class="road-themes" role="radiogroup" aria-label="Battlefield theme">
      <span>Battlefield:</span>
      <button type="button" class="theme-chip ${road.theme ? '' : 'on'}" data-theme="">Auto</button>
      ${Road.ARENAS.filter((a) => themes.includes(a.theme)).map((a) => `<button type="button" class="theme-chip theme-${a.theme} ${road.theme === a.theme ? 'on' : ''}" data-theme="${a.theme}" title="${escapeHtml(a.name)}">${a.icon}</button>`).join('')}
    </div>
    <p class="road-howto">Win <b>ranked</b> battles (vs AI with 🏆 Ranked on, or Find Match online) to earn trophies. Friendly rooms and local matches don't count.</p>`;

  const owned = (id) => cardProgress(id).unlocked;
  let youPlaced = false;
  const youMarker = () => {
    youPlaced = true;
    return `<div class="road-you"><span>▶ You: 🏆 ${road.trophies}</span></div>`;
  };
  const html = Road.ARENAS.map((a, i) => {
    const nextA = Road.ARENAS[i + 1];
    const reached = road.best >= a.min;
    const inArena = Road.MILESTONES.filter((m) => m.trophies >= a.min && (!nextA || m.trophies < nextA.min));
    const cards = CARD_LIBRARY.filter((c) => c.arena === a.id && c.variant === 0);
    const nodes = inArena.map((m) => {
      let marker = '';
      if (!youPlaced && m.trophies > road.trophies) marker = youMarker();
      const claimed = Road.isClaimed(road, m.id);
      const can = !claimed && m.trophies <= road.best;
      const cls = claimed ? 'claimed' : can ? 'ready' : 'locked';
      return `${marker}<div class="road-node ${cls}" data-node="${m.id}">
        <span class="rn-trophies">🏆 ${m.trophies}</span>
        <div class="rn-rewards">${m.rewards.filter((r) => r.type !== 'arena').map(rewardPill).join('') || rewardPill(m.rewards[0])}</div>
        ${claimed ? '<span class="rn-state">✓ Claimed</span>' : can ? `<button type="button" class="rn-claim" data-claim="${m.id}">Claim</button>` : '<span class="rn-state">🔒</span>'}
      </div>`;
    }).join('');
    const last = !nextA && !youPlaced ? youMarker() : '';
    // The marker goes at the end of the arena you're in when no milestone above you is left there
    const tailMarker = !youPlaced && nextA && road.trophies < nextA.min && road.trophies >= a.min ? youMarker() : '';
    return `<section class="road-arena theme-${a.theme} ${reached ? 'reached' : 'locked'} ${a.id === arena.id ? 'current' : ''}">
      <div class="ra-banner">
        <span class="ra-icon">${a.icon}</span>
        <div><b>${escapeHtml(a.name)}</b><small>${a.min} 🏆 · ${escapeHtml(a.blurb)}</small></div>
        ${reached ? '' : '<span class="ra-lock">🔒</span>'}
      </div>
      ${cards.length ? `<div class="ra-cards">${cards.map((c) => `<span class="ra-card rarity-${c.rarity} ${owned(c.id) ? 'owned' : ''}" title="${escapeHtml(`${c.name}: ${c.desc}`)}">${c.icon}<small>${escapeHtml(c.name)}</small></span>`).join('')}</div>` : ''}
      <div class="ra-nodes">${nodes}${tailMarker}${last}</div>
    </section>`;
  }).join('');
  overlay.querySelector('#ptRoadTrack').innerHTML = html;
  overlay.querySelectorAll('canvas.rp-emote').forEach((c) => {
    const g = c.getContext('2d');
    EmoteArt.draw(g, c.dataset.emote, c.width / 2, c.height / 2 + 2, c.width * 0.3, 0.4);
  });
}

// Grant one reward and describe it. Card and chest rewards respect what you already own.
function grantRoadReward(r) {
  const p = state.progress;
  switch (r.type) {
    case 'gold':
      p.gold += r.amount;
      return `+${r.amount} gold`;
    case 'chest': {
      const g = grantTierRewards(r.tier);
      return `Tier ${r.tier} chest: +${g.gold} gold${g.unlockedName ? `, unlocked ${g.unlockedName}` : ''}`;
    }
    case 'card': {
      const c = CARD_MAP[r.id];
      if (!c) return '';
      const cp = cardProgress(r.id);
      if (!cp.unlocked) { cp.unlocked = true; cp.copies += 2; return `Unlocked ${c.name}!`; }
      cp.copies += 4;
      return `+4 ${c.name} copies`;
    }
    case 'copies': {
      // Spread across the cards you actually play
      const pool = deckFor('A').filter((id) => cardProgress(id).unlocked);
      const list = pool.length ? pool : CARD_LIBRARY.filter((c) => cardProgress(c.id).unlocked).map((c) => c.id);
      for (let i = 0; i < r.amount && list.length; i++) cardProgress(list[i % list.length]).copies += 1;
      return `+${r.amount} copies for your deck`;
    }
    case 'emote': {
      p.roadEmotes[r.id] = true;
      const e = EmoteArt.EMOTES.find((x) => x.id === r.id);
      return `New emote: ${e ? e.name : r.id}`;
    }
    case 'arena':
      return `${Road.ARENAS[r.arena].name} battlefield unlocked`;
    default:
      return '';
  }
}

// Claim one or more milestones. Road.claim marks each one before anything is granted, and the
// save happens right after, so a reward can't be collected twice (even with two tabs open).
function claimMilestones(ids) {
  if (state.admin.active) { toast('🛠️', 'Admin mode', 'Trophy Road rewards are paused in admin mode.'); return; }
  const lines = [];
  ids.forEach((id) => {
    const rewards = Road.claim(state.progress.road, id);
    if (!rewards) return;
    rewards.forEach((r) => { const t = grantRoadReward(r); if (t) lines.push(t); });
  });
  if (!lines.length) return;
  saveProgress();
  Sound.play('claim');
  toast('🎁', ids.length > 1 ? `${ids.length} rewards claimed` : 'Reward claimed', lines.slice(0, 4).join(' · ') + (lines.length > 4 ? ` · +${lines.length - 4} more` : ''));
  buildEmoteGrid();
  renderProgress();
  renderCollection();
  renderRoad();
  renderRoadBadge();
  renderDecks();
}

function bindRoad() {
  ui.roadBtn?.addEventListener('click', () => { Sound.unlock(); openRoad(); });
  const overlay = ui.roadOverlay;
  if (!overlay) return;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('#ptRoadClose')) { closeRoad(); return; }
    const one = e.target.closest('[data-claim]');
    if (one) { claimMilestones([one.dataset.claim]); return; }
    if (e.target.closest('[data-claim-all]')) { claimMilestones(Road.claimable(state.progress.road).map((m) => m.id)); return; }
    const chip = e.target.closest('[data-theme]');
    if (chip) {
      state.progress.road.theme = chip.dataset.theme || null;
      saveProgress();
      if (arena) arena.setTheme(Road.activeTheme(state.progress.road));
      renderRoad();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) closeRoad();
  });
}

// ─── Deck editor ──────────────────────────────────────────────────────────────

function cardType(c) {
  return c.spell ? 'spell' : c.building ? 'building' : 'troop';
}

// Where a locked card comes from
function unlockHint(c) {
  const m = Road.MILESTONES.find((x) => x.rewards.some((r) => r.type === 'card' && r.id === c.id));
  const a = Road.ARENAS[c.arena];
  if (m) return `🏆 Trophy Road reward at ${m.trophies}`;
  if (c.arena <= Road.cardArena(state.progress.road)) return '🎁 Drops from chests and wins';
  return `🔒 Unlocks in ${a.icon} ${a.name} (${a.min} 🏆)`;
}

function activeDeckIds() {
  const p = state.progress;
  const deck = (p.decks[p.activeDeck] || []).filter((id) => CARD_MAP[id] && cardProgress(id).unlocked).slice(0, MAX_DECK);
  // Top up an incomplete deck with unlocked starter cards so it's always playable
  for (const id of STARTER_DECK) {
    if (deck.length >= MAX_DECK) break;
    if (!deck.includes(id) && cardProgress(id).unlocked) deck.push(id);
  }
  for (const c of CARD_LIBRARY) {
    if (deck.length >= MAX_DECK) break;
    if (!deck.includes(c.id) && cardProgress(c.id).unlocked) deck.push(c.id);
  }
  p.decks[p.activeDeck] = deck;
  p.deck = deck;
  return deck;
}

function deckWarnings(ids) {
  const cards = ids.map((id) => CARD_MAP[id]).filter(Boolean);
  const out = [];
  if (!cards.some((c) => c.winCondition)) out.push('No win condition (a card that goes for towers)');
  if (!cards.some((c) => c.spell)) out.push('No spell');
  if (!cards.some((c) => c.targets === 'any' || c.targets === 'air' || (c.mech && c.mech.spawner && CARD_MAP[c.mech.spawner.card].targets === 'any'))) out.push('Nothing can hit air troops');
  const avg = cards.reduce((s, c) => s + c.cost, 0) / Math.max(1, cards.length);
  if (avg > 4.6) out.push('Heavy deck: average cost above 4.6');
  return out;
}

function setActiveDeck(i) {
  const p = state.progress;
  p.activeDeck = clamp(i, 0, 2);
  if (!p.decks[p.activeDeck] || !p.decks[p.activeDeck].length) p.decks[p.activeDeck] = [...p.deck];
  roadUi.pickSlot = null;
  activeDeckIds();
  saveProgress();
  renderCollection();
  renderDecks();
  writeLog(`Deck ${p.activeDeck + 1} selected.`);
}

function deckSlotHtml(id, idx, picked) {
  const c = CARD_MAP[id];
  const cp = cardProgress(id);
  return `<button type="button" class="deck-slot rarity-${c.rarity} ${picked ? 'picked' : ''}" data-slot="${idx}" title="${escapeHtml(`${c.name}: ${c.desc}`)}"><span class="ds-cost ${costClass(c.cost)}">${c.cost}</span><span class="ds-icon">${c.icon}</span><span class="ds-name">${escapeHtml(c.name)}</span><small>Lv ${cp.level}</small></button>`;
}

function statLineFor(c) {
  const s = getCardStats(c.id);
  if (!s) return '';
  if (s.spell) {
    const k = s.zone ? s.zone.kind : '';
    if (k === 'heal') return `Heals ${Math.round(s.dmgScaled)} over ${s.zone.dur}s • radius ${s.splash}`;
    if (k === 'haste') return `+${Math.round((s.zone.haste - 1) * 100)}% speed for ${s.zone.dur}s • radius ${s.splash}`;
    if (k === 'slow') return `${Math.round((1 - s.zone.slow) * 100)}% slow for ${s.zone.dur}s • radius ${s.splash}`;
    if (k === 'spawn') return `${s.zone.count} × ${CARD_MAP[s.zone.card].name} (HP ${Math.round(CARD_MAP[s.zone.card].hp * s.lvlScale)})`;
    if (k === 'laser') return `${Math.round(s.dmgScaled)} to each of ${s.zone.targets} targets (towers ${Math.round(s.dmgScaled * s.towerMult)})`;
    return `DMG ${Math.round(s.dmgScaled)}${s.towerMult > 0 ? ` (towers ${Math.round(s.dmgScaled * s.towerMult)})` : ''} • radius ${s.splash}`;
  }
  if (s.targets === 'none') return `HP ${s.hpScaled} • ${speedLabel(s)}`;
  const count = s.swarmCount > 1 ? `${s.swarmCount}× ` : '';
  return `${count}HP ${s.hpScaled} • DMG ${Math.round(s.dmgScaled)} / ${s.cd}s • ${s.proj === 'melee' ? 'melee' : `range ${s.range}`} • ${speedLabel(s)}`;
}

function filteredCollection() {
  const f = roadUi.filter;
  const q = String(ui.cardSearch?.value || '').trim().toLowerCase();
  let list = CARD_LIBRARY.filter((c) => {
    if (!f.variants && c.variant > 0 && !q) return false;
    if (f.type !== 'all' && cardType(c) !== f.type) return false;
    const owned = cardProgress(c.id).unlocked;
    if (f.own === 'owned' && !owned) return false;
    if (f.own === 'locked' && owned) return false;
    if (q && !(c.name.toLowerCase().includes(q) || c.rarity.includes(q) || c.role.includes(q) || c.style.includes(q) || (c.desc || '').toLowerCase().includes(q))) return false;
    return true;
  });
  const rarity = (c) => RARITY_ORDER.indexOf(c.rarity);
  const by = {
    cost: (a, b) => a.cost - b.cost || a.name.localeCompare(b.name),
    rarity: (a, b) => rarity(b) - rarity(a) || a.cost - b.cost,
    arena: (a, b) => a.arena - b.arena || a.cost - b.cost,
    name: (a, b) => a.name.localeCompare(b.name),
  }[f.sort] || ((a, b) => a.cost - b.cost);
  list = list.slice().sort(by);
  // Owned cards first
  return list.sort((a, b) => (cardProgress(b.id).unlocked ? 1 : 0) - (cardProgress(a.id).unlocked ? 1 : 0));
}

function renderDeckEditor() {
  const p = state.progress;
  const deck = activeDeckIds();

  if (ui.deckTabs) {
    ui.deckTabs.innerHTML = [0, 1, 2].map((i) => `<button type="button" class="deck-tab ${p.activeDeck === i ? 'on' : ''}" data-deck-tab="${i}">Deck ${i + 1}</button>`).join('');
  }
  if (ui.deckSummary) {
    const cards = deck.map((id) => CARD_MAP[id]);
    const n = (t) => cards.filter((c) => cardType(c) === t).length;
    const warn = deckWarnings(deck);
    ui.deckSummary.innerHTML = `${avgElixirBar(deck)}<span class="ds-counts">⚔️ ${n('troop')} troops · ✦ ${n('spell')} spells · 🏯 ${n('building')} buildings</span>${warn.length ? `<ul class="deck-warn">${warn.map((w) => `<li>⚠️ ${escapeHtml(w)}</li>`).join('')}</ul>` : '<span class="deck-ok">✓ Balanced deck</span>'}`;
  }
  if (ui.deckSlots) ui.deckSlots.innerHTML = deck.map((id, idx) => deckSlotHtml(id, idx, roadUi.pickSlot === idx)).join('');

  // Practice AI deck (only used when Ranked is off)
  const aiDeck = p.aiDeck.slice(0, MAX_DECK);
  while (aiDeck.length < MAX_DECK) aiDeck.push(STARTER_DECK[aiDeck.length % STARTER_DECK.length]);
  p.aiDeck = aiDeck;
  if (ui.aiDeckSlots) {
    ui.aiDeckSlots.innerHTML = aiDeck.map((id, idx) => {
      const c = CARD_MAP[id];
      return `<button type="button" class="deck-slot ai-deck-slot rarity-${c.rarity}" data-ai-slot="${idx}"><span class="ds-cost ${costClass(c.cost)}">${c.cost}</span><span class="ds-icon">${c.icon}</span><span class="ds-name">${escapeHtml(c.name)}</span><small>AI ${idx + 1}</small></button>`;
    }).join('');
  }

  if (ui.collFilters) {
    const f = roadUi.filter;
    const chip = (group, value, label) => `<button type="button" class="coll-chip ${f[group] === value ? 'on' : ''}" data-filter="${group}" data-value="${value}">${label}</button>`;
    ui.collFilters.innerHTML = `
      <div class="chip-row">${chip('type', 'all', 'All')}${chip('type', 'troop', '⚔️ Troops')}${chip('type', 'spell', '✦ Spells')}${chip('type', 'building', '🏯 Buildings')}</div>
      <div class="chip-row">${chip('own', 'all', 'Any')}${chip('own', 'owned', 'Owned')}${chip('own', 'locked', 'Locked')}
        <label class="coll-toggle"><input type="checkbox" data-variants ${f.variants ? 'checked' : ''}> Show variants</label>
        <label class="coll-sort">Sort <select data-sort>${['cost', 'rarity', 'arena', 'name'].map((k) => `<option value="${k}" ${f.sort === k ? 'selected' : ''}>${k[0].toUpperCase() + k.slice(1)}</option>`).join('')}</select></label>
      </div>`;
  }

  if (!ui.cardCollection) return;
  const list = filteredCollection();
  if (ui.collCount) {
    const owned = CARD_LIBRARY.filter((c) => cardProgress(c.id).unlocked).length;
    ui.collCount.textContent = `${owned}/${CARD_LIBRARY.length} owned`;
  }
  const picking = state.selectedCard && state.selectedCard.owner === 'collection' ? state.selectedCard.type : null;
  ui.cardCollection.innerHTML = list.map((c) => {
    const cp = cardProgress(c.id);
    const unlocked = cp.unlocked;
    const inDeck = deck.includes(c.id);
    const next = cp.level + 1;
    const need = copiesNeed(next);
    const upCost = cardUpgradeCost(c.id, next);
    const canUp = unlocked && cp.level < 14 && cp.copies >= need && state.progress.gold >= upCost;
    const canAbility = unlocked && !cp.abilityUnlocked && cp.level >= c.ability.minLevel && cp.mastery >= c.ability.minMastery && state.progress.gold >= 400;
    const type = cardType(c);
    const nextStats = unlocked && cp.level < 14 ? getCardStatsAtLevel(c.id, cp.level + 1, cp.abilityUnlocked, cp.mastery || 0) : null;
    const nextLine = nextStats ? (nextStats.spell ? `Next Lv: ${Math.round(nextStats.dmgScaled)}` : `Next Lv: HP ${nextStats.hpScaled} • DMG ${Math.round(nextStats.dmgScaled)}`) : '';
    return `<article class="collection-card rarity-edge-${c.rarity} ${unlocked ? '' : 'locked'} ${inDeck ? 'in-deck' : ''} ${picking === c.id ? 'picking' : ''} ${c.winCondition ? 'win-condition' : ''}" data-card="${c.id}">
      <header><span class="cc-cost ${costClass(c.cost)}">${c.cost}</span><strong>${c.icon} ${escapeHtml(c.name)}</strong><span class="rarity-${c.rarity}">${RARITY_STYLE[c.rarity].label}</span></header>
      <div class="cc-tags"><span class="type-badge type-${type}">${type === 'spell' ? '✦ Spell' : type === 'building' ? '🏯 Building' : '⚔️ Troop'}</span>${c.winCondition ? '<span class="wc-badge">👑 Win Condition</span>' : ''}${c.swarmCount > 1 ? `<span class="swarm-badge">×${c.swarmCount}</span>` : ''}${c.solo && c.arena > 0 ? `<span class="new-badge">${Road.ARENAS[c.arena].icon} ${escapeHtml(Road.ARENAS[c.arena].name)}</span>` : ''}</div>
      <p class="cc-desc">${escapeHtml(c.desc || c.role)}</p>
      ${unlocked ? `<p class="cc-stats">Lv ${cp.level} • ${statLineFor(c)}</p><p class="cc-traits">${cardTraits(c)}</p><p class="cc-own">Copies ${cp.copies} • Mastery ${Math.floor(cp.mastery)}${nextLine ? ` • ${nextLine}` : ''}</p>` : `<p class="cc-unlock">${unlockHint(c)}</p>`}
      <div class="collection-actions">${unlocked ? `<button type="button" data-select="${c.id}" class="${inDeck ? 'in' : ''}">${inDeck ? '✓ In Deck' : roadUi.pickSlot != null ? `Put in slot ${roadUi.pickSlot + 1}` : 'Use'}</button><button type="button" data-up="${c.id}" ${canUp ? '' : 'disabled'}>Level Up (${need} copies, ${upCost}g)</button><button type="button" data-ability="${c.id}" ${canAbility ? '' : 'disabled'}>${cp.abilityUnlocked ? `✓ ${c.ability.name}` : `${c.ability.name} (Lv${c.ability.minLevel}, ${c.ability.minMastery}M, 400g)`}</button>` : '<button type="button" disabled>Locked</button>'}</div>
    </article>`;
  }).join('') || '<p class="note">No cards match.</p>';
}

function bindDeckEditor() {
  ui.deckTabs?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-deck-tab]');
    if (b) setActiveDeck(Number(b.dataset.deckTab));
  });
  ui.deckSlots?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-slot]');
    if (!b) return;
    const slot = Number(b.dataset.slot);
    const sel = state.selectedCard;
    if (sel && sel.owner === 'collection') {
      setDeckSlot(slot, sel.type);
      state.selectedCard = null;
      roadUi.pickSlot = null;
      renderCollection();
      return;
    }
    roadUi.pickSlot = roadUi.pickSlot === slot ? null : slot;
    writeLog(roadUi.pickSlot == null ? 'Slot deselected.' : `Slot ${slot + 1} picked: choose a card below to put there.`);
    renderCollection();
  });
  ui.aiDeckSlots?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ai-slot]');
    if (!b) return;
    const sel = state.selectedCard;
    if (sel && sel.owner === 'collection') setAiDeckSlot(Number(b.dataset.aiSlot), sel.type);
    else writeLog('Pick a card below with “Use”, then tap a practice-AI slot.');
  });
  ui.collFilters?.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-filter]');
    if (!chip) return;
    roadUi.filter[chip.dataset.filter] = chip.dataset.value;
    renderCollection();
  });
  ui.collFilters?.addEventListener('change', (e) => {
    if (e.target.matches('[data-variants]')) roadUi.filter.variants = e.target.checked;
    if (e.target.matches('[data-sort]')) roadUi.filter.sort = e.target.value;
    renderCollection();
  });
  ui.cardCollection?.addEventListener('click', (e) => {
    const sel = e.target.closest('[data-select]');
    const up = e.target.closest('[data-up]');
    const ab = e.target.closest('[data-ability]');
    if (sel) {
      const id = sel.dataset.select;
      if (roadUi.pickSlot != null) {
        setDeckSlot(roadUi.pickSlot, id);
        roadUi.pickSlot = null;
        state.selectedCard = null;
        renderCollection();
        return;
      }
      const already = state.selectedCard && state.selectedCard.owner === 'collection' && state.selectedCard.type === id;
      state.selectedCard = already ? null : { owner: 'collection', type: id };
      writeLog(already ? 'Card deselected.' : `Selected ${CARD_MAP[id].name}: tap a deck slot to swap it in.`);
      renderCollection();
    } else if (up) {
      upgradeCard(up.dataset.up);
    } else if (ab) {
      unlockAbility(ab.dataset.ability);
    }
  });
}
