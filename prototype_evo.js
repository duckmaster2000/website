/*
 * Card Evolutions in the browser: shard rewards, the unlock celebration, the Evolution collection,
 * deck-slot controls and the in-hand cycle indicator.
 * Loaded before prototype_v4.js and run later, using its globals (state, ui, Sim, Evo, CARD_MAP, ...).
 * The rules live in shared/evo-progress.js (progression) and shared/clash-sim.js (battle).
 */

const evoUi = { queue: [], showing: false, filter: 'all' };

function evoDef(slug) { return Sim.EVOLUTIONS[slug]; }
function evoNeed() { return Evo.RULES.SHARDS_TO_UNLOCK; }

// ─── Granting shards (Trophy Road, chests, achievements all come through here) ──────────────

/** Add shards of one Evolution and return a short description. Unlocks are celebrated once. */
function grantEvoShards(slug, n) {
  const def = evoDef(slug);
  if (!def) return '';
  const r = Evo.addShards(state.progress.evo, slug, n);
  if (r.gold) state.progress.gold += r.gold;
  if (r.unlocked) {
    state.progress.stats.evoUnlocks = (state.progress.stats.evoUnlocks || 0) + 1;
    queueEvoUnlock(slug);
  }
  const parts = [];
  if (r.shards) parts.push(`+${r.shards} ${def.name} shard${r.shards === 1 ? '' : 's'}`);
  if (r.unlocked) parts.push(`${def.name} unlocked!`);
  if (r.wild) parts.push(`+${r.wild} Wild Shard${r.wild === 1 ? '' : 's'}`);
  if (r.gold) parts.push(`+${r.gold} gold (shards were full)`);
  return parts.join(', ');
}

function grantWildShards(n) {
  const r = Evo.addWild(state.progress.evo, n);
  if (r.gold) state.progress.gold += r.gold;
  return `+${r.wild} Wild Shard${r.wild === 1 ? '' : 's'}${r.gold ? ` (+${r.gold} gold, Wild Shards full)` : ''}`;
}

// A chest's chance at shards: better chests, better odds. Prefers Evolutions of cards you own.
function chestEvoShards(tier) {
  if (Math.random() >= 0.12 * tier) return '';
  const owned = EVO_SLUGS.filter((slug) => cardProgress(slug).unlocked && !Evo.isUnlocked(state.progress.evo, slug));
  const amount = tier >= 4 ? 2 : 1;
  if (!owned.length) return grantWildShards(amount);
  return grantEvoShards(owned[Math.floor(Math.random() * owned.length)], amount);
}

// ─── Unlock celebration ──────────────────────────────────────────────────────────────────────

function queueEvoUnlock(slug) {
  evoUi.queue.push(slug);
  if (!evoUi.showing) setTimeout(showNextEvoUnlock, 400);
}

function showNextEvoUnlock() {
  const el = ui.evoOverlay;
  const slug = evoUi.queue.shift();
  if (!el || !slug) { evoUi.showing = false; return; }
  evoUi.showing = true;
  const def = evoDef(slug);
  const card = CARD_MAP[slug];
  el.querySelector('.evo-reveal').innerHTML = `
    <p class="evo-kicker">EVOLUTION UNLOCKED</p>
    <div class="evo-morph">
      <div class="evo-card base"><span>${card.icon}</span><small>${escapeHtml(card.name)}</small></div>
      <div class="evo-arrow">➜</div>
      <div class="evo-card evolved theme-evo-${def.theme}"><span>${card.icon}</span><i class="evo-crest">✦</i><small>${escapeHtml(def.name)}</small></div>
    </div>
    <h3>${escapeHtml(def.name)}</h3>
    <p class="evo-ability"><b>${escapeHtml(def.ability)}:</b> ${escapeHtml(def.desc)}</p>
    <p class="evo-cycle">${cyclePips(0, def.cycles, true)} Evolves after ${def.cycles} cycle${def.cycles > 1 ? 's' : ''}</p>
    <p class="evo-tip">Equip it on ${escapeHtml(card.name)} in your Battle Deck (tap ✦ on the slot).</p>`;
  el.hidden = false;
  el.classList.remove('play');
  void el.offsetWidth;
  el.classList.add('play');
  Sound.play('evoUnlock');
  state.progress.evo.seen[slug] = 1;
  saveProgress();
  renderEvoCollection();
  renderCollection();
}

function closeEvoUnlock() {
  if (ui.evoOverlay) ui.evoOverlay.hidden = true;
  evoUi.showing = false;
  if (evoUi.queue.length) setTimeout(showNextEvoUnlock, 250);
}

// ─── Small pieces ────────────────────────────────────────────────────────────────────────────

function cyclePips(charge, need, empty) {
  let html = '<span class="evo-pips">';
  for (let i = 0; i < need; i++) html += `<i class="${!empty && i < charge ? 'on' : ''}"></i>`;
  return `${html}</span>`;
}

// Battle hand: cycle progress, or the ready glow. Uses the snapshot, so it matches the server online.
function handEvoBadge(player, id) {
  const e = player && player.evo && player.evo[id];
  if (!e) return { cls: '', html: '' };
  const [charge, need] = e;
  const def = Sim.evolutionOf(id);
  if (charge >= need) return { cls: ' evo-ready', html: `<span class="card-evo ready" title="${escapeHtml(def.name)} is ready: the next play is evolved">✦ EVOLVE</span>` };
  return { cls: ' evo-charging', html: `<span class="card-evo" title="${escapeHtml(def.name)}: ${charge}/${need} cycles">✦${cyclePips(charge, need)}</span>` };
}

// Any of this player's Evolutions ready? (shown on the opponent's nameplate too)
function anyEvoReady(player) {
  const evo = player && player.evo;
  return !!evo && Object.keys(evo).some((id) => evo[id][0] >= evo[id][1]);
}

// Normal vs evolved comparison lines for the collection
function evoCompare(slug) {
  const def = evoDef(slug);
  const base = getCardStats(slug);
  if (!base) return '';
  const evolved = Sim.evolvedStats(base);
  const rows = [];
  if (!base.spell) {
    rows.push(['HP', base.hpScaled, evolved.hpScaled]);
    rows.push(['Damage', Math.round(base.dmgScaled), Math.round(evolved.dmgScaled)]);
  } else {
    rows.push(['Damage', Math.round(base.dmgScaled), Math.round(evolved.dmgScaled)]);
  }
  rows.push(['Ability', '—', def.ability]);
  return `<table class="evo-compare"><thead><tr><th></th><th>Normal</th><th>Evolved</th></tr></thead><tbody>${rows.map(([k, a, b]) => `<tr><td>${k}</td><td>${a}</td><td class="${a !== b ? 'up' : ''}">${escapeHtml(String(b))}</td></tr>`).join('')}</tbody></table>`;
}

// Which deck(s) have this Evolution switched on
function evoEquippedIn(slug) {
  const p = state.progress;
  const out = [];
  p.evo.equipped.forEach((list, i) => { if ((list || []).some((id) => evoSlug(id) === slug) && (p.decks[i] || []).some((id) => evoSlug(id) === slug)) out.push(i + 1); });
  return out;
}

// ─── Evolution collection ────────────────────────────────────────────────────────────────────

function renderEvoCollection() {
  const host = ui.evoCollection;
  if (!host) return;
  const evo = state.progress.evo;
  const unlockedCount = EVO_SLUGS.filter((s) => Evo.isUnlocked(evo, s)).length;
  if (ui.evoHeader) {
    ui.evoHeader.innerHTML = `<span class="evo-count">✦ ${unlockedCount}/${EVO_SLUGS.length} unlocked</span><span class="evo-wild" title="Wild Shards can go into any locked Evolution">🔮 ${evo.wild} Wild Shard${evo.wild === 1 ? '' : 's'}</span><span class="evo-slots-note">${evoSlotsFor('ai')} Evolution slots per deck</span>`;
  }
  const order = EVO_SLUGS.slice().sort((a, b) => (Evo.isUnlocked(evo, b) ? 1 : 0) - (Evo.isUnlocked(evo, a) ? 1 : 0) || Evo.shardsOf(evo, b) - Evo.shardsOf(evo, a));
  const deck = activeDeckIds();
  host.innerHTML = order.map((slug) => {
    const def = evoDef(slug);
    const card = CARD_MAP[slug];
    const unlocked = Evo.isUnlocked(evo, slug);
    const shards = Evo.shardsOf(evo, slug);
    const pct = Math.round((shards / evoNeed()) * 100);
    const inDeckId = deck.find((id) => evoSlug(id) === slug);
    const equippedHere = inDeckId && (evo.equipped[state.progress.activeDeck] || []).includes(inDeckId);
    const decks = evoEquippedIn(slug);
    let action = '';
    if (!unlocked) {
      action = evo.wild > 0 ? `<button type="button" data-evo-wild="${slug}">🔮 Use Wild Shard</button>` : '';
    } else if (inDeckId) {
      action = `<button type="button" data-evo-equip="${inDeckId}" class="${equippedHere ? 'on' : ''}">${equippedHere ? '✦ Equipped' : '✦ Equip'}</button>`;
    } else {
      action = `<span class="evo-hint">Put ${escapeHtml(card.name)} in your deck to equip</span>`;
    }
    const status = equippedHere ? 'equipped' : unlocked ? 'unlocked' : 'locked';
    return `<article class="evo-tile ${status} theme-evo-${def.theme} ${unlocked && !evo.seen[slug] ? 'new' : ''}">
      <header>
        <div class="evo-art"><span class="base">${card.icon}</span><span class="evolved">${card.icon}<i class="evo-crest">✦</i></span></div>
        <div class="evo-title"><b>${escapeHtml(def.name)}</b><small>${escapeHtml(card.name)} Evolution · ${escapeHtml(def.role)}</small></div>
        <span class="evo-status">${equippedHere ? '✦ EQUIPPED' : unlocked ? 'UNLOCKED' : '🔒 LOCKED'}</span>
      </header>
      <div class="evo-shards" title="${shards}/${evoNeed()} shards"><div class="evo-shards-fill" style="width:${pct}%"></div><span>${unlocked ? 'Unlocked' : `${shards}/${evoNeed()} shards`}</span></div>
      <p class="evo-ability"><b>${escapeHtml(def.ability)}:</b> ${escapeHtml(def.desc)}</p>
      <p class="evo-cycle">${cyclePips(def.cycles, def.cycles)} ${def.cycles} cycle${def.cycles > 1 ? 's' : ''} to evolve${decks.length ? ` · on in deck ${decks.join(', ')}` : ''}</p>
      ${evoCompare(slug)}
      <p class="evo-counter"><b>Counterplay:</b> ${escapeHtml(def.counter)}</p>
      <div class="evo-actions">${action}</div>
    </article>`;
  }).join('');
}

// Equip / unequip from anywhere (collection, deck slots), with clear feedback
function toggleEvoEquip(cardId) {
  const p = state.progress;
  const deck = activeDeckIds();
  const slots = evoSlotsFor('ai');
  const res = Evo.toggleEquip(p.evo, p.activeDeck, cardId, deck, evoSlug, slots);
  const def = Sim.evolutionOf(cardId);
  if (!res.ok) {
    const msg = {
      'no-evo': `${CARD_MAP[cardId].name} has no Evolution.`,
      locked: `${def ? def.name : 'This Evolution'} is locked: ${Evo.shardsOf(p.evo, evoSlug(cardId))}/${evoNeed()} shards.`,
      'not-in-deck': `Put ${CARD_MAP[cardId].name} in your deck first.`,
      full: `All ${slots} Evolution slots are in use. Switch one off first.`,
    }[res.reason];
    writeLog(msg);
    toast('✦', 'Can’t equip', msg);
    Sound.play('reject');
    return false;
  }
  saveProgress();
  Sound.play(res.equipped ? 'evolve' : 'select');
  writeLog(res.equipped ? `${def.name} equipped on ${CARD_MAP[cardId].name} (deck ${p.activeDeck + 1}).` : `${def.name} switched off.`);
  renderCollection();
  renderEvoCollection();
  renderDecks();
  return true;
}

function bindEvo() {
  ui.evoCollection?.addEventListener('click', (e) => {
    const wild = e.target.closest('[data-evo-wild]');
    const eq = e.target.closest('[data-evo-equip]');
    if (wild) {
      const slug = wild.dataset.evoWild;
      const r = Evo.useWild(state.progress.evo, slug);
      if (!r) return;
      if (r.unlocked) { state.progress.stats.evoUnlocks = (state.progress.stats.evoUnlocks || 0) + 1; queueEvoUnlock(slug); }
      saveProgress();
      Sound.play('claim');
      writeLog(`Wild Shard added to ${evoDef(slug).name}.`);
      checkAchievements();
      renderEvoCollection();
    } else if (eq) {
      toggleEvoEquip(eq.dataset.evoEquip);
    }
  });
  ui.evoOverlay?.addEventListener('click', (e) => {
    if (e.target.closest('[data-evo-close]') || e.target === ui.evoOverlay) closeEvoUnlock();
  });
}

// Deck slot extras: the ✦ toggle on cards that have an Evolution, and the slots summary
function deckSlotEvo(id) {
  const slug = evoSlug(id);
  if (!slug) return { cls: '', html: '' };
  const evo = state.progress.evo;
  const on = (evo.equipped[state.progress.activeDeck] || []).includes(id) && Evo.isUnlocked(evo, slug);
  const unlocked = Evo.isUnlocked(evo, slug);
  const label = on ? 'Evolution on' : unlocked ? 'Evolution available: tap to equip' : `Evolution locked (${Evo.shardsOf(evo, slug)}/${evoNeed()})`;
  return {
    cls: on ? ' evo-on' : unlocked ? ' evo-avail' : '',
    html: `<span class="ds-evo ${on ? 'on' : unlocked ? 'avail' : 'locked'}" data-evo-toggle="${id}" role="button" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">✦</span>`,
  };
}

function evoSlotsSummary(deck) {
  const list = equippedEvos(deck, 'ai');
  const slots = evoSlotsFor('ai');
  const avail = deck.filter((id) => evoSlug(id) && Evo.isUnlocked(state.progress.evo, evoSlug(id)) && !list.includes(id));
  const pips = Array.from({ length: slots }, (_, i) => `<i class="${i < list.length ? 'on' : ''}"></i>`).join('');
  const hint = avail.length && list.length < slots ? `<span class="evo-avail-hint">✦ ${escapeHtml(Sim.evolutionOf(avail[0]).name)} is available: tap ✦ on ${escapeHtml(CARD_MAP[avail[0]].name)}</span>` : '';
  return `<span class="evo-slot-summary" title="Evolution slots">✦ Evolutions <span class="evo-slot-pips">${pips}</span> ${list.length}/${slots}</span>${hint}`;
}
