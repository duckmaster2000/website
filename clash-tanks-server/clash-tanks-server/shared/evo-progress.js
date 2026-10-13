/*
 * Evolution progression: shards, Wild Shards, unlocks and evolution slots.
 *
 * Pure rules (no DOM, no storage) shared by the browser and the tests. The page keeps an `evo`
 * object in saved progress:
 *   { shards: { slug: n }, unlocked: { slug: time }, wild: n, equipped: [[cardId], [cardId], [cardId]], seen: { slug: 1 } }
 * `equipped[i]` lists the cards of deck i whose Evolution is switched on.
 *
 * Rules:
 *   - SHARDS_TO_UNLOCK shards of an Evolution unlock it (once).
 *   - Shards for an Evolution you already own become Wild Shards, up to WILD_CAP; past that they
 *     convert to gold (GOLD_PER_SHARD each), so nothing is ever silently lost.
 *   - A Wild Shard can be put into any locked Evolution.
 *   - An Evolution can only be equipped on a card that is in the deck, whose Evolution is unlocked,
 *     and only while the deck has a free slot.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.EvoProgress = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const RULES = {
    SHARDS_TO_UNLOCK: 6,
    WILD_CAP: 12,
    GOLD_PER_SHARD: 150,
    DECKS: 3,
  };

  function clampInt(v, lo, hi) {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo;
  }

  function fresh() {
    return { shards: {}, unlocked: {}, wild: 0, equipped: [[], [], []], seen: {} };
  }

  /**
   * Clean saved data. `slugs` = the Evolutions that exist (Sim.EVOLUTIONS keys); `slugOf(cardId)`
   * maps a card to its family. Unknown Evolutions and junk values are dropped.
   */
  function normalize(raw, slugs, slugOf) {
    const evo = fresh();
    if (!raw || typeof raw !== 'object') return evo;
    const known = new Set(slugs);
    if (raw.shards && typeof raw.shards === 'object') {
      Object.keys(raw.shards).forEach((k) => {
        if (known.has(k)) evo.shards[k] = clampInt(raw.shards[k], 0, RULES.SHARDS_TO_UNLOCK);
      });
    }
    if (raw.unlocked && typeof raw.unlocked === 'object') {
      Object.keys(raw.unlocked).forEach((k) => {
        if (known.has(k) && raw.unlocked[k]) evo.unlocked[k] = Number(raw.unlocked[k]) || 1;
      });
    }
    // An Evolution with a full shard bar is unlocked (repairs a save interrupted mid-unlock)
    Object.keys(evo.shards).forEach((k) => {
      if (evo.shards[k] >= RULES.SHARDS_TO_UNLOCK) evo.unlocked[k] = evo.unlocked[k] || 1;
      if (evo.unlocked[k]) evo.shards[k] = RULES.SHARDS_TO_UNLOCK;
    });
    evo.wild = clampInt(raw.wild, 0, RULES.WILD_CAP);
    if (Array.isArray(raw.equipped)) {
      for (let i = 0; i < RULES.DECKS; i++) {
        const list = Array.isArray(raw.equipped[i]) ? raw.equipped[i] : [];
        evo.equipped[i] = [...new Set(list.filter((id) => typeof id === 'string' && slugOf && evo.unlocked[slugOf(id)]))];
      }
    }
    if (raw.seen && typeof raw.seen === 'object') Object.keys(raw.seen).forEach((k) => { if (known.has(k)) evo.seen[k] = 1; });
    return evo;
  }

  function isUnlocked(evo, slug) { return !!evo.unlocked[slug]; }
  function shardsOf(evo, slug) { return isUnlocked(evo, slug) ? RULES.SHARDS_TO_UNLOCK : (evo.shards[slug] || 0); }

  // Wild Shards past the cap turn into gold
  function addWild(evo, n) {
    const room = Math.max(0, RULES.WILD_CAP - evo.wild);
    const toWild = Math.min(room, n);
    evo.wild += toWild;
    return { wild: toWild, gold: (n - toWild) * RULES.GOLD_PER_SHARD };
  }

  /**
   * Add n shards of one Evolution. Returns { unlocked: bool, shards, wild, gold }:
   * `unlocked` is true only on the call that completes it, so the unlock fires exactly once.
   */
  function addShards(evo, slug, n) {
    const amount = Math.max(0, Math.floor(n || 0));
    const out = { unlocked: false, shards: 0, wild: 0, gold: 0 };
    if (!amount) return out;
    if (isUnlocked(evo, slug)) {
      const w = addWild(evo, amount);
      out.wild = w.wild;
      out.gold = w.gold;
      return out;
    }
    const have = evo.shards[slug] || 0;
    const used = Math.min(amount, RULES.SHARDS_TO_UNLOCK - have);
    evo.shards[slug] = have + used;
    out.shards = used;
    if (evo.shards[slug] >= RULES.SHARDS_TO_UNLOCK) {
      evo.unlocked[slug] = Date.now();
      out.unlocked = true;
    }
    if (amount > used) {
      const w = addWild(evo, amount - used);
      out.wild = w.wild;
      out.gold = w.gold;
    }
    return out;
  }

  /** Spend one Wild Shard on a locked Evolution. Returns addShards' result, or null if impossible. */
  function useWild(evo, slug) {
    if (evo.wild <= 0 || isUnlocked(evo, slug)) return null;
    evo.wild -= 1;
    return addShards(evo, slug, 1);
  }

  /**
   * Switch a card's Evolution on or off in deck `deckIdx`.
   * Returns { ok, equipped, reason } where reason is 'no-evo' | 'locked' | 'not-in-deck' | 'full'.
   */
  function toggleEquip(evo, deckIdx, cardId, deckIds, slugOf, slots) {
    const list = evo.equipped[deckIdx] || (evo.equipped[deckIdx] = []);
    const slug = slugOf(cardId);
    if (list.includes(cardId)) {
      evo.equipped[deckIdx] = list.filter((id) => id !== cardId);
      return { ok: true, equipped: false };
    }
    if (!slug) return { ok: false, reason: 'no-evo' };
    if (!isUnlocked(evo, slug)) return { ok: false, reason: 'locked' };
    if (!deckIds.includes(cardId)) return { ok: false, reason: 'not-in-deck' };
    if (validEquipped(evo, deckIdx, deckIds, slugOf, slots).length >= slots) return { ok: false, reason: 'full' };
    list.push(cardId);
    return { ok: true, equipped: true };
  }

  /** The equipped list for a deck, cleaned: in the deck, unlocked, one per family, within the slot limit. */
  function validEquipped(evo, deckIdx, deckIds, slugOf, slots) {
    const out = [];
    const families = new Set();
    for (const id of evo.equipped[deckIdx] || []) {
      const slug = slugOf(id);
      if (!slug || !isUnlocked(evo, slug) || !deckIds.includes(id) || families.has(slug)) continue;
      if (out.length >= slots) break;
      families.add(slug);
      out.push(id);
    }
    return out;
  }

  return { RULES, fresh, normalize, isUnlocked, shardsOf, addShards, addWild, useWild, toggleEquip, validEquipped };
});
