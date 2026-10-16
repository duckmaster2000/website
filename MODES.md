# Game modes: inventory and status

Rule: modes are only ever **added**. Every mode below that existed before 2026-10-15 stays, with its id, rules, rewards and saves.

## Existing modes (before this expansion)

| Mode | Id / entry point | Implementation | Rewards / progress |
|---|---|---|---|
| Local PvP | Battle tab, Mode = Local PvP (`setupMatch`) | shared engine, two humans on one screen | friendly (no rewards since 2026-10-15) |
| vs AI, Ranked | Battle tab, Mode = vs AI, 🏆 Ranked on | engine + AI presets; arena AI deck | Trophy Road (`shared/trophy-road.js`), gold, chests |
| vs AI, Practice | same, 🏆 Ranked off | engine + your AI deck | gold/chests (not with a weakened AI) |
| Online ranked / rooms | Battle tab, Mode = Online (server.js queue / rooms) | server-authoritative engine | queue = trophies; rooms friendly |
| Trophy Road | 🏆 Road button | trophies, arenas, milestones | `progress.road` |
| Tutorial | Settings → 📘 / first visit | `prototype_tutorial.js` | one-time 150 gold |
| Training drills (5) | 🎯 Training | `prototype_training.js` | stars only |
| Events (18) | 🎪 Events hub (`shared/events.js` catalog) | engine rules per event | `progress.events` |
| … C.H.A.O.S. (`upgrades`) Standard / Draft / Blackout / Power Surge | events | card-upgrade draft | |
| … Chaos Mode (`chaos`) 4 tiers | events | timed global modifiers | |
| … Elixir Overload, Sudden Death, Draft Duel, Mirror Match, Deck Roulette, Scavenger, Spellstorm, Swarm Wars, Heavyweights, Fortress Wars, King of the Hill, Pinball Panic, Size Roulette, Evolution Frenzy | events (rotating daily) | | |
| … Last Stand (`survival`), Boss Battle (`boss`, 3 tiers) | events (permanent) | scripted side | |
| Weekly challenges: Chaos Gauntlet, Rising Ladder | events (`CHALLENGES`) | runs with lives | weekly prizes |

## Status of the requested additions

Legend: ✅ playable and tested · 🚧 in progress · ⏳ not started

(Updated as work lands.)
