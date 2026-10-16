# C.H.A.O.S. mode: progress

Card upgrades chosen mid-battle. Event id `upgrades` (the older "Chaos Mode" event, id `chaos`, with timed global modifiers, is unchanged).

## Where it lives

| Part | File | Notes |
|---|---|---|
| Upgrade table, pool, choice engine, AI pick, snapshot | `clash-tanks-server/clash-tanks-server/shared/clash-sim.js`, section "C.H.A.O.S. card upgrades" | `CHAOS_UPGRADES`, `CHAOS_POOL`, `chooseUpgrade`, `updateChaos`, `scoreUpgrade`, `chaosDebug` |
| Event, variants, deck pool rule, saved deck | `shared/events.js` | `CHAOS_VARIANTS`, `deckRules.pool`, `deckKind`, `modesFor`, `cleanChaosDeck`, `P.chaosDeck` |
| Online | `server.js` | `upgrade_pick` message; each player only sees their own pending offers; C.H.A.O.S. deck sent as `chaosDeck` |
| Page | `prototype_events.js`, `prototype_v4.js`, `prototype_arena.js`, `prototype.css` | deck builder, choice screen, badges, Blackout, results |
| Tests | `test/chaos.test.js` | |

## How it works

- `rules.upgrades = { checkpoints: [{ at, rarity }], choiceSecs, pause, autoPick, perCard }`. At each checkpoint both sides get two offers of that rarity (falling back to the nearest rarity with offers). While a choice is open, `step()` only runs the choice timer: no battle time, elixir, movement or deploys. When the timer runs out, unanswered sides get the left offer (`autoPick: 0`). A pick resolves once; repeats and late picks are refused.
- A chosen upgrade is baked into that player's per-match card stats (`p.cards[id] = upgradedStats(...)`), so every later deployment of that card has it, units already on the field keep their old stats, and nothing touches `CARD_MAP` or the collection. Mechanics reuse the engine's own hooks (Evolution-style `em` and spell effects, plus card `mech`); an equipped Evolution wins a clash (Evolutions are off in C.H.A.O.S. anyway).
- `rules.cardLevel = 11` sets every card in both decks to level 11 for the match.
- AI: `aiChooseUpgrade` waits a moment, then scores both offers with `scoreUpgrade` (rarity, card role and cost, in hand, score, pressure, time left). It only reads its own offers.
- AI look-ahead copies of the match have `chaos = null`, so rollouts never open a choice.

## Variants

| Variant | What differs | Modes |
|---|---|---|
| Standard | 5 checkpoints: 0:01 Common, 0:45 Common, 1:30 Rare, 2:15 Rare, 3:00 Epic (overtime) | vs AI, local PvP, online |
| Draft | Deck drafted from the pool (Draft Duel's 8 rounds) | vs AI |
| Blackout | `rules.blackout`: the arena is dark outside your own troops' and towers' light (drawing only) | vs AI, online |
| Power Surge | A choice every 30 s (Rare, then Epic from 1:30); start with 7 elixir; 1.5× elixir, 2× in the last minute | vs AI, local PvP, online |

The official rules of Blackout and Power Surge weren't available while building this; both are this game's own interpretation and are pure configuration in `CHAOS_VARIANTS`.

## Status

- [x] Engine: upgrade table (27 cards × Common/Rare/Epic = 81), validation, choice phase, pause, timeout, AI, snapshot, debug view
- [x] Events: event + 4 variants, pool rule, level 11, saved deck, draft from pool, achievements
- [x] Server: pick message, private offers, C.H.A.O.S. deck, offline-only variants refused online
- [x] Page: deck builder with upgrade previews, choice screen (click, 1/2 keys, countdown, waiting state), hand and unit badges, event-bar chip, Blackout, results, online picks
- [x] Tests: `test/chaos.test.js` (19); full suite 176 passing
- [x] Browser: vs AI, Blackout, phone width, two-browser online against a local server

## Known limits

- Upgrades apply to copies played after the pick. Units already on the field keep their stats (by design, and stated in the rules).
- Online, chosen upgrades are public (they show on cards and units); only pending offers are private.
- Not yet balanced from play: AI-vs-AI shows every upgrade works, not that each one is worth its slot.
- The live Render server only gets this after a push to main.
