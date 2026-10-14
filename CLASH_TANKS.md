# Clash Tanks: work log and how it all fits together

Notes on the prototype tank game at `caleb-liu.com/prototype.html`: what was changed, how it's built, how to deploy it, and what's left.

---

## How it's built

| Piece | File(s) | Runs where |
|---|---|---|
| **Game engine**: arena, cards, movement, combat, towers, clock, AI | `clash-tanks-server/clash-tanks-server/shared/clash-sim.js` | Browser (Local PvP, vs AI) **and** server (Online) |
| **Trophy Road rules**: arenas, trophy gains/losses, milestones, anti-exploit guards | `clash-tanks-server/clash-tanks-server/shared/trophy-road.js` | Browser (tested in Node) |
| Arena renderer (canvas drawing, arena themes, effects, HUD, placement preview, announcements, emote bubbles) | `prototype_arena.js` | Browser |
| Trophy Road screen, rank display, deck editor | `prototype_road.js` | Browser |
| **Evolution progression rules**: shards, Wild Shards, unlocks, slot validation | `clash-tanks-server/clash-tanks-server/shared/evo-progress.js` | Browser (tested in Node) |
| Evolution collection, unlock celebration, deck-slot toggles, hand indicator | `prototype_evo.js` | Browser |
| **Special events rules**: catalog, Chaos scheduler, deck rules/draft, rotation, rewards, challenges, achievements, save clean-up | `clash-tanks-server/clash-tanks-server/shared/events.js` | Browser **and** server (Online) |
| Event Hub, event details, Draft screen, in-battle event bar, event results | `prototype_events.js` | Browser |
| Emote artwork (animated faces drawn with canvas paths) | `prototype_emotes.js` | Browser |
| Page logic (menus, progression, chests, decks, lobby, input, sound) | `prototype_v4.js`, `prototype.html`, `prototype.css` | Browser |
| Online server (matchmaking, rooms, runs the engine) | `clash-tanks-server/clash-tanks-server/server.js` | Render |
| Tests | `clash-tanks-server/clash-tanks-server/test/*.test.js` (sim, trophy, evolution, evo-progress, events, combat-ai) | `npm test` |

**One engine for every mode.** Local PvP, vs AI and Online all use the same `clash-sim.js`, so they always play by identical rules. Change gameplay **only** in that file. Don't put a second copy of the rules in the server.

The page loads the engine straight from the server folder (`<script src="clash-tanks-server/clash-tanks-server/shared/clash-sim.js">`), which works because GitHub Pages serves every file in the repo.

### Hosting
- **Website:** GitHub Pages from `duckmaster2000/website` (custom domain `caleb-liu.com`).
- **Online server:** Render web service `clash-tanks-server`
  - Root Directory: `clash-tanks-server/clash-tanks-server`
  - Build: `npm install`, Start: `npm start`
  - URL: `https://clash-tanks-server.onrender.com` (health check at `/health`)
  - Redeploys automatically when `main` is pushed.

---

## Deploying

1. Commit and push everything in GitHub Desktop. Make sure these are included:
   - `prototype_arena.js`
   - `prototype_emotes.js`
   - `prototype_road.js`
   - `prototype_evo.js`
   - `prototype_events.js` (new)
   - `clash-tanks-server/clash-tanks-server/shared/evo-progress.js`
   - `clash-tanks-server/clash-tanks-server/shared/events.js` (new; the server needs it too)
   - `clash-tanks-server/clash-tanks-server/shared/`
   - `clash-tanks-server/clash-tanks-server/test/`
2. Render redeploys the server by itself.
3. Hard-refresh the site (**Cmd+Shift+R**). Browsers can keep old files for up to 10 minutes.

**Keeping the server awake (optional):** Render's free plan sleeps after about 15 minutes with nobody connected, and waking takes up to a minute. A free UptimeRobot monitor that loads `/health` every 5 minutes keeps it awake.

### Running locally
```
cd clash-tanks-server/clash-tanks-server && npm install && npm start    # server on :3001
python3 -m http.server 5500                                             # from the website folder
```
Open `http://localhost:5500/prototype.html`. Off `caleb-liu.com`, the game connects to `localhost:3001` automatically.

### Tests
```
cd clash-tanks-server/clash-tanks-server && npm test
```

---

## What was done, in order

### 1. Getting online play working
- **No server:** the game pointed at `clash-tanks-server.onrender.com`, but no Render service existed (`x-render-routing: no-server`). The service was created with the settings above.
- **"Waiting for opponent":** this turned out to be normal. Matchmaking needs two people searching at the same time.

### 2. Online lag, decks and matchmaking speed
- **Lag:** units jumped 20 times a second. The client now draws about 0.1 s behind the server and smoothly blends between updates. It also stopped rebuilding the cards and units on every frame when nothing had changed.
- **Shots:** projectiles are now sent to clients, so shots show up online.
- **Your deck online:** the client sends your saved deck and card levels. The server checks it: unknown cards and duplicates are dropped, and an empty deck falls back to the starter deck.
- **Matchmaking:** two players are paired the moment both are waiting. It no longer waits 2 seconds or uses gold as a fake skill rating.
- **Earlier connection:** opening the Online lobby starts connecting right away, so a sleeping server begins waking up sooner.

### 3. Prototype password
- The prototype password in `prototype_v4.js` was changed to the requested value. The admin password and the passcodes in `citations.js` and `index.js` were left alone.
- Note: these passwords sit in the page's code, so anyone viewing the source can see them. They're a casual lock, not real security.

### 4. Deck reverting to the starter deck
- **Cause:** with two windows open, a window only read your deck when it first opened. It could play an old deck and later save it over your new one.
- **Fix:** windows now pick up deck and progress changes from each other instantly (`storage` event).

### 5. Merge conflict
- The conflicts were in the `platformer.*` files. GitHub's version already contained the local work plus about 2,000 more lines, so GitHub's version was kept.

### 6. Rebuild as a Clash Royale–style game
All of this applies to **Local PvP, vs AI and Online**.

**Arena**
- 18 × 32 tiles, with a river across the middle and **two bridges**.
- Each side has two **princess towers** and a **king tower**.
- You can only deploy on your own half. When an enemy princess tower falls, the area just past the river on that side (4 tiles deep) opens up for your troops, but not buildings.

**Movement and navigation**
- Half-tile grid with **A\*** pathfinding, smoothed with line-of-sight checks.
- Ground units cross the river only on bridges and route around towers and buildings. A* picks the sensible bridge.
- **Flying** units fly straight over everything. **River jumpers** (Ram Hog, Cricket Hop, Rabbit Rush) can cross anywhere.
- Units steer away from nearby allies and push apart if they overlap. Bigger units and units that are attacking get pushed less.
- **Stuck detection:** a unit that isn't making progress looks for a new path and sidesteps.

**Targeting**
- Each unit has a **sight radius** and re-checks for targets every ~0.3 s, not every frame.
- Targeting rules: ground only, air and ground, or **buildings only** (Giant-style units ignore troops).
- **Lock-on:** once a unit starts attacking, it stays on that target until the target dies or moves well out of range.
- **Hysteresis:** a unit only switches targets if the new one is clearly closer, so it doesn't flip-flop.
- Units prefer whatever is attacking them or their allies.
- With nothing in sight, a unit heads for the enemy princess tower on its side of the arena, then the king.

**Combat**
- Every attack has a wind-up (cancelled if the target is lost), then a cooldown.
- Ranged units stop at their range. Shots travel and home in on their target.
- Mortar shots are lobbed at a fixed spot and can be dodged.
- Splash damage only hits enemies inside its radius.
- Range to a tower is measured to its square edge, not its centre.

**Special abilities**

| Ability | Cards |
|---|---|
| Charge for double damage | Ram Hog |
| Lightning chains to 2 more enemies | Volt Bug |
| Shields nearby allies (−25% damage taken) | Guardian |
| Explodes on contact | Bomb Beetles |
| Drops a bomb when destroyed | Fly Bombers |
| Spin attack that hits everything around it | Dust Devils |
| Can't hit enemies that get too close | Mortar Fox |

**Card variants**
- **Twin** hits 2 targets.
- **Burst** fires a bonus follow-up shot.
- **Core** adds splash damage.

**New card:** **Bolt Turret**, a defensive building that decays over 30 s. It's unlocked for everyone.

**Towers and match flow**

| | Princess tower | King tower |
|---|---|---|
| HP (level 1) | 840 | 1300 |
| Damage | 30 every 0.8 s | 34 every 1.0 s |
| Range | 7.5 tiles | 7 tiles |
| Starts active? | Yes | No: wakes when a princess tower falls or the king is hit |

- **Upgrades:** tower and base upgrades raise these numbers. AI health multipliers apply to the AI's towers.
- **Crowns:** 1 per princess tower destroyed. Destroying the king wins instantly (3 crowns).
- **Clock:** 3:00 of regular time, with double elixir in the last minute.
  - If one side has more crowns at full time, it wins.
  - Otherwise there's 1:00 of sudden-death **overtime**, where the first crown wins.
  - If it's still tied, the side whose weakest tower is healthier wins. If that's equal too, it's a **draw**.
- **Elixir:** starts at 5, maxes at 10, regenerates 1 per 2.8 s, and can never go negative.
- **Hand:** 4 cards plus a "next" card, cycling through your 8-card deck.
- **Simulation:** runs in fixed 0.05 s steps everywhere.

**AI (vs AI mode)**
- Defends whichever side is under the most pressure, and picks counters:
  - splash against swarms
  - anti-air against flyers
  - high damage or the turret against tanks
- Places its defenders sensibly.
- Builds tank-plus-support pushes. Slow tanks start at the back; fast ones go straight to the bridge.
- Supports its pushes and avoids sitting at full elixir.
- Can't see your hand or your elixir.
- The difficulty setting changes how fast it reacts, how often it makes the smart choice, and how aggressive it is.

**Controls and interface**
- **Placing cards:** drag a card onto the arena, or tap a card and then tap the arena. Keys **1–4** select a card and **Esc** cancels.
- **Feedback:** red shading shows where you can't place the selected card. A preview shows the unit, its range, and why a spot is refused. Refused cards shake.
- **Elixir:** a 10-segment bar. Cards show how close you are to affording them.
- **Online:** your side is always at the bottom (player B sees the arena flipped). The opponent's elixir is hidden. If the server refuses a placement, it says why.
- **Effects:** deploy rings, hit flashes, splash circles, chain lightning, death puffs, tower explosions with screen shake, a sleeping indicator on inactive kings, a clock, crowns, and a win/draw/loss screen showing how the match ended.
- **Sound:** generated in the browser, with a mute button.
- **Layout:** the battle fits on one screen, including on phones.

**Balance**
- Stats are based on Clash Royale at about one-third scale.
- Several swarm and flying cards were toned down after AI-vs-AI testing (for example, Fly Bombers had about 2.6× the damage output of their Clash Royale counterpart, the Balloon).

### 7. Starter-copies bug
- Every page reload gave 3 free copies of each starter card. Now they're only given the first time a starter card is unlocked.

### 8. Emotes, spells, smarter AI and game feel
All of this applies to **Local PvP, vs AI and Online** (rules in `clash-sim.js`).

**Emotes**
- 💬 button on each player's nameplate (or press **E**) opens an emote wheel. 10 original animated emotes: Ha ha!, Nice!, Waaah, Grrr!, Whoa!, Good game, plus 4 unlockable ones (Party!, Too easy, Seriously?, King laugh).
- Emotes pop up in a speech bubble beside the sender's King Tower, animate, and fade after ~2.6 s.
- Rate limits live in the engine (`Sim.emote`): one every 2 s, at most 5 per 20 s. The server enforces them online (`emote` socket event); emotes sent after the final whistle are relayed with an `fx` event.
- "Mute opponent" in the wheel hides the other player's emotes (saved).
- The AI emotes about its own towers falling or taking yours, after wiping out a big push, sometimes in reply to yours, and once at the end. Each AI emote waits at least 6 s after its last one.

**Spells** (cast anywhere; crown towers take 30% damage)
| Spell | Cost | Effect |
|---|---|---|
| Fire Bomb | 4 | Flies from your King Tower, 200 damage in 2.5 tiles, knocks troops back |
| Shock | 2 | Instant, 75 damage in 2.5 tiles, stuns troops, buildings and towers for 0.6 s, resets charges and wind-ups |
| Rocket Rain | 3 | 3 waves, 120 total damage in 3.8 tiles; clears swarms |
- Unlocked for everyone. The default AI deck (if you never changed it) now includes Fire Bomb and Shock.

**AI**
- Casts spells only when the value is worth it (or to finish a tower), aiming ahead of moving troops.
- Estimates your elixir from what it sees you play (it can't see your elixir) and pushes when you've just overspent.
- Supports surviving defenders as a counter-push, and plays more aggressively during double elixir.

**Game feel**
- Arena: sandy lanes, grass and flowers, river foam, stone tower pads, brick towers with team platforms.
- Units drop in when deployed, bob while walking, flash when hit, and show stun sparks. Health bars leave a short trailing "recent damage" segment.
- Floating damage numbers on towers and heavy hits, "-N" elixir popups where cards land, king wake-up "!" with a horn.
- Banners: BATTLE!, 2× ELIXIR, OVERTIME, CROWN!, VICTORY/DEFEAT. A big countdown with ticks in the last 10 seconds.
- The match ends with a banner on the arena; the results sheet appears ~2 s later with crowns, damage dealt, cards played, match time, new achievements and confetti on a win. Local "Play Again" restarts immediately.
- Cards slide into the hand when they cycle in; spell cards have their own style; the elixir bar glows when full.
- New synthesized sounds for emotes, spells, crowns, banners and the countdown.

**Achievements** (Collection Progression panel): First Victory, Tower Breaker, Three-Crown Win, Veteran, Giant Slayer, Online Champion, Spell Slinger, Commander. Each gives gold; four unlock emotes. Stats are saved with your progress.

---

### 9. Trophy Road, 28 new cards, deck editor
All gameplay is in the shared engine, so it applies to **Local PvP, vs AI and Online**.

**Trophy Road** (`shared/trophy-road.js` rules, `prototype_road.js` screen; open it with the 🏆 button)
- 10 arenas, each with its own battlefield look: Boot Camp (0), Scrapyard (300), Frost Pass (700), Sunscorch Dunes (1100), Jungle Ruins (1500), Volcano Forge (2000, lava river), Neon Circuit (2600), Sky Citadel (3300), Royal Colosseum (4000), Legend Summit (5000). Ranks: "Frost Pass II" inside an arena; Legend → Champion → Grand Champion → Ultimate Champion above 5000. Max 7000.
- **Which matches count:** vs AI with **🏆 Ranked** on, and online **Find Match**. Local PvP, private rooms and rematches are friendly (no trophies).
- **Trophies:** online win +30; losses cost 5 (Boot Camp) rising to 30 (top arenas). vs AI: Easy +12, Normal +20, Hard +26, Insane +32 per win, and each difficulty has a ceiling (Easy 800, Normal 2000, Hard 3600), so an easy AI can't carry you up the road. Harder AIs also cost fewer trophies on a loss. You never drop below the gate of the arena you're in.
- **Ranked vs AI** uses an arena-appropriate AI deck (`Sim.buildAiDeck`) at your average card level, and the difficulty's own tower HP. The practice AI deck and HP sliders only apply when Ranked is off. "Custom" difficulty plays as Normal in ranked.
- **62 milestones:** every arena gate gives its first new card plus gold; 5 stops inside each arena give the rest of its cards, gold, chests (granted instantly), card copies and 4 new emotes (Love it, Hmm…, Zzz, Champion). Rewards stay claimable after losing trophies (they track your best). "Claim all" grabs everything waiting.
- **Unlocks:** chests and win rewards only drop cards from arenas you've reached. Locked cards say where they come from.
- **Battlefield theme:** pick any reached arena on the Trophy Road screen (Auto = current arena).
- **Exploit and duplicate protection:** each match result is applied once (by match id; the server sends a unique id per match). Each milestone is claimed once (marked before rewards are granted, then saved). Once you play a card in a ranked match, leaving (Start Match again, or closing/reloading the page) counts as a loss; closing the page is settled on the next load. An opponent leaving an online ranked match gives you the win. Saves are cleaned on load (bad numbers, unknown or unreached claims). Admin mode can't claim road rewards, and "Earn Chest" is now admin-only.

**28 new cards** (one version each, all with descriptions; arena in brackets)
| Type | Cards |
|---|---|
| Spells | Tar Trap (1, slow zone), Frost Nova (2, freezes troops/buildings/towers 3s), Boulder Roll (3, rolls 10 tiles, knockback), Acid Pool (3, damage over 6s + slow), Repair Wave (4, heals your troops/buildings, never towers), Overdrive (5, +40% speed for your troops), Gravity Well (6, pulls troops together, can't drag ground troops into the river), Paratroopers (7, drops 6 troopers anywhere over 4s), Orbital Laser (8, strikes the 3 toughest enemies after a lock-on) |
| Buildings | Bone Crypt (1, skeleton spawner), Flak Tower (2, air only), Mortar Bunker (3, 11.5-tile siege with a blind spot), Drone Hangar (4, air spawner), Siren Beacon (4, taunts nearby troops), Inferno Spire (5, beam ramps to 10×, reset by stuns), Elixir Pump (5, +1 elixir every 9s), Tesla Pit (6, hides underground until something's in range) |
| Troops | Flak Gunner (1, air only, holds position), Spark Spirit (1, stun chain kamikaze), Shield Knight (2, 280 shield), Cryo Caster (2, slows on hit), Mole Driller (3, deploys anywhere, 35% crown damage), Medic Bot (4, heals allies), Tesla Tank (5, charged blast, reset by stuns), Boomerang Bot (6, piercing blade out and back), Phantom Rider (6, invulnerable dash, double hit), Storm Zeppelin (7, flying tank, bursts into 4 sprites), Rock Titan (8, building-buster, shatters into 2 shards) |

New engine systems behind them: lingering zones (`state.zones`), status effects (freeze, slow, haste, shield, hidden, invulnerable), spawner and elixir buildings, death spawns, ramp-up beams, dashes, piercing blades, deploy-anywhere, air-only targeting, and token units (spawned troops that are never in a deck). The online preview check knows the deploy-anywhere rule.

**AI**
- Values every spell type on its own terms (damage, freezes, pulls, laser targets, boulder paths, slows, friendly heals/haste, troop drops on lightly defended towers).
- Defends with anti-air, ramp-up beams, decoys and spawners where they fit; places defensive buildings in the threatened lane toward the middle.
- Offense: Mortar Bunker sieges from beside the river, Mole Driller tunnels to the target tower, Elixir Pump only when things are quiet.
- Counts spells you cast (it now sees instant spells like Shock too) when estimating your elixir.

**Deck editor**
- 3 decks (tabs), cost bubbles, average elixir, troop/spell/building counts, and warnings (no win condition, no spell, nothing hits air, heavy deck).
- Filters (type, owned/locked, show variants), sorting (cost, rarity, arena, name), search across descriptions. Tap a card then a slot, or a slot then a card.

**Polish**
- Arena themes, drawings for every zone and status (frozen, slowed, hasted, shielded, burrowed, dashing, healing, Inferno beam), new projectiles and effects (laser beams, parachutes, elixir drops, shield shatter), a full-path preview for Boulder Roll, green previews for friendly spells.
- Results screen shows the trophy change counting up, the new rank, arena promotions, and why a gain was capped or a loss stopped at a gate. New sounds for the new effects, trophies and arenas.
- Nameplates show your rank, "🏆 Ranked · Hard AI" or "Practice / Friendly".

**Balance:** tuned from ~5,000 AI-vs-AI matches with random arena-9 decks. New cards land between about 42% and 64% win rate when included (the expensive tanks, Rock Titan and Storm Zeppelin, are at the top). Some older swarm cards (Bomb Beetles, Rabbit Rush, Goblin Bikers) sit at 35–40% and were left as they were.

### 11. Card Evolutions
All battle rules are in the shared engine, so Evolutions work identically in **Local PvP, vs AI and Online**, and online the server decides when a card evolves.

**How it works for the player**
- **Shards:** every Evolution has its own shard bar; **6 shards** unlock it (`EvoProgress.RULES.SHARDS_TO_UNLOCK`). **Wild Shards** go into any locked Evolution. Shards for an Evolution you already own become Wild Shards (cap 12); past the cap each converts to 150 gold, so nothing is lost or wasted.
- **Where shards come from:** 17 Trophy Road stops (a complete Juggernaut at 120 🏆 so everyone can try the system, then shards and Wild Shards up to 6000), chests (12% × tier chance, prefers Evolutions of cards you own), and two achievements (Evolved, Evolution Master) that pay Wild Shards.
- **Unlocking:** a celebration screen (base card morphs into the evolved card, ability shown). Several unlocks queue one after another. Unlocks are saved immediately and can only happen once.
- **Equipping:** each deck has **2 Evolution slots** (`Sim.EVO_RULES.slots`, per mode). Tap ✦ on a deck slot (or Equip in the Evolutions panel). Locked, not-in-deck and slots-full attempts are refused with a message. The deck summary shows the slots and points out unlocked-but-unequipped Evolutions.
- **In battle (the cycle):** an equipped card counts its plays. After `cycles` normal plays, the card in hand glows gold with **✦ EVOLVE**, and the next play is evolved; then it starts charging again. Charging pips show on the card. Only plays that pass every check count (no elixir, bad spot, recharging, not in hand, match over: no progress). Both players' charge is in the snapshot; the opponent's nameplate warns "✦ Evo ready!".

**The Evolutions** (all values live in `EVOLUTIONS` in `clash-sim.js`; mirror-match edge in brackets)
| Card → Evolution | Role | Cycles | What changes | Counterplay |
|---|---|---|---|---|
| Brawler → **Juggernaut** | melee | 2 | Every 3rd punch: splash + knockback quake around its target | Ranged/air troops; spread out |
| Drill Cat → **Diamond Drill** | melee | 1 | +45% per consecutive hit on one target (max +135%); resets on target swap or stun | Distractions, stuns |
| Guardian → **Bastion** | tank | 2 | On landing and every 8 s, 110 HP shields on the 4 nearest allies (not itself) | Splash/spells strip shields; kill the Bastion |
| Siege → **Earthshaker** | tank | 2 | Shells leave 3 s craters that slow enemies 50% | Flyers; swarm it |
| Volt Bug → **Storm Bug** | ranged | 1 | Chain to 3 (from 2); 0.25 s jolt on the first target | Spread out; tanky singles |
| Ray Lance → **Prism Lance** | ranged | 2 | Beam pierces every enemy in a line to full range (others take 60%) | Approach from the side; dive it |
| Flare Pod → **Cluster Pod** | ranged | 2 | Fireballs scatter 3 bomblets; one bomblet per enemy per shot | Tanks; reach it fast |
| Junk Pack → **Scrap Rally** | swarm | 1 | Survivors +35% speed per fallen packmate (max 2) | Splash that kills all at once |
| Hawk Strike → **Dive Hawks** | air | 2 | Opening dive for 2.5×, then a 4 s climb | Anti-air splash; cheap decoys |
| Bolt Turret → **Arc Turret** | building | 1 | Every 3rd shot also pulses: damage + knockback around it (ground) | Flyers, building-targeters, spells |
| Bone Crypt → **Crypt of Legions** | building | 1 | Dies into a 520 HP Bone Giant instead of 3 skeletons | Let it expire in a bad spot |
| Medic Bot → **Field Surgeon** | support | 1 | Triage (2.2× heal under 40% HP), clears slows, shortens stuns/freezes | Burst the push; snipe the Surgeon |
| Fire Bomb → **Napalm Bomb** | spell | 2 | Leaves burning ground for 3 s (35% more damage, towers 30%) | Walk out of the fire |
| Shock → **Overload** | spell | 2 | Aftershock 0.8 s later: 60% damage, 0.8 s stun | Leave the circle |
| Rocket Rain → **Homing Barrage** | spell | 2 | 6 rockets lock on to different enemies in the circle | Tough troops; it only locks on at cast |

Mirror matches (same deck both sides, only one side has the Evolution, 240 AI-vs-AI matches each) put the evolved side at roughly **50–60%**: a real upgrade, never an auto-win. Bastion started at 69% and was cut (shields allies only, smaller and slower).

**AI:** knows when its Evolutions are ready (prefers an evolved defender, leads pushes with an evolved win condition, values evolved spells 25% higher), cycles cheap cards to charge Evolutions when leaking, and treats enemy evolved units as 35% more threatening. Ranked AI gets 1 Evolution from Frost Pass and 2 from Volcano Forge. No hidden elixir or stat advantages.

**Online:** decks carry an `evo` flag per card; the server keeps it only for cards that have an Evolution and caps it at the online slot count, then tracks every cycle itself.

#### Adding an Evolution
1. Add an entry to `EVOLUTIONS` in `shared/clash-sim.js` (key = the card's slug): `name`, `cycles`, `ability`, `desc`, `counter`, `role`, `theme`, optional `hp`/`dmg` multipliers, and either `mech` (troops/buildings) or `spell`.
2. Reuse an existing mechanic if one fits: `shockwave`, `pulse`, `stackHits`, `dive`, `allyShield`, `impactZone`, `chain`, `pierceLine`, `cluster`, `rally`, `deathSummon`, `cleanse`/`triage` (troops and buildings); `afterZone`, `echo`, `seek` (spells). They're all in the "Evolution mechanics" section, called from the normal attack, projectile, death and heal code.
3. For a new mechanic, add a config key and handle it in that section (or the matching hook in `fireAttack`, `updateProjectiles`, `processDeaths`, `castSpell`). Route damage through `applyDamage`/`splashDamage` so shields, invulnerability, crown multipliers and hidden units still apply.
4. Optional: a `theme-evo-<theme>` colour in `prototype.css`, an effect in `prototype_arena.js` (`addFx`/`drawEffects`), and a sound in `Sound` (`prototype_v4.js`).
5. Optional: shards on the Trophy Road (`EVO_STOPS` in `shared/trophy-road.js`, at an unused trophy count).
6. Add a test in `test/evolution.test.js` and run the mirror-match check (see Testing) to keep it around 50–60%.

### 12. Special events (Chaos Mode, rotating events, boss, survival, weekly challenges)
Open them with **🎪 Events** in the top bar. Battle rules live in the shared engine, so every event that can be played in more than one mode plays identically in **vs AI, Local PvP and Online**.

#### How it is built
- **Per-match rules (engine).** `createMatch({ rules })` gives every match its own cleaned copy of `DEFAULT_RULES` (`normalizeRules`), stored on `state.rules`. The clock, elixir phases, max/start elixir, crown races, timeouts, card mods, Evolution rules, kill refunds, knockback, spell echoes, Size Roulette, deck swaps, the hill, waves, the boss and timed modifiers are all read from there. Nothing global changes, so a normal battle after an event is a normal battle. **Verified:** 180 normal AI-vs-AI matches play out identically (to 1/100) on the old and new engine, and a golden-result test locks this in.
- **Events are data** (`shared/events.js`, `EVENTS`): name, rules text, win/loss text, deck rules, modes, schedule, tiers, rewards, and a `build(ctx)` that returns engine rules (+ decks for draft/mirror/roulette). The engine never sees event names.
- **Timed modifiers** (`MODIFIERS` in `clash-sim.js`): 23 modifiers in 7 categories. Each has a duration, severity, weight, optional `group` (only one per group at a time), effect contributions (`fx`), optional mirrored zones and a one-off `start`. Effects combine through a fixed policy per effect (`MOD_STACK`: multiply / add / highest-wins) and are clamped (`MOD_CAPS`), and are re-read every step instead of saving and restoring stats. The same modifier again only refreshes its timer.
- **Chaos schedule** (`buildChaosSchedule`): picked before the match from the seed with weighted selection, max-active, one-per-group, ≤2 per category, excluded pairs, no recent repeats, a gentle first pick, Evolution modifiers only when someone has an Evolution, and nothing past full time. Online the **server** builds it (clients only see it through snapshots: active modifiers and the ones inside the 4 s warning window).
- **Fairness:** battlefield zones are point-mirrored, hazards land in mirrored pairs, global effects hit both sides, event towers are the same for both sides (no AI HP bonus), and decks the event hands out are at the same level for both sides (your average level; online, the average of both players).
- **Rotation** (`rotation(now)`): permanent events (Chaos, Boss Battle, Last Stand), 4 daily events from the rotating pool (different categories, never yesterday's events), a weekly challenge (alternates Chaos Gauntlet / Rising Ladder), Chaos featured at weekends, tomorrow's line-up shown. Derived from the UTC date.
- **Progress** (`state.progress.events`, saved with the rest): records per event, daily reward counters, settled match ids, the pending match, challenge runs, achievements, badges and the chosen title. `settleMatch` applies a result at most once per match id; `normalizeProgress` cleans old or broken saves (unknown events dropped, numbers clamped).

#### Events
| Event | Modes | What changes |
|---|---|---|
| 🌀 **Chaos Mode** (Mild / Wild / Extreme / Total) | AI, PvP, Online | Timed modifiers; higher tiers = more, overlapping, wilder ones; Total adds a match-long Chaos Law. Win a tier to unlock the next. |
| ⚗️ Elixir Overload | AI, PvP, Online | Start 7, 2× elixir, 3× in the last minute |
| ⚔️ Sudden Death | AI, PvP, Online | First tower wins; 2:30, 1.5× elixir, no overtime |
| 🃏 Draft Duel | AI | 8 rounds of 2 cards: keep one, the AI gets the other |
| 🪞 Mirror Match | AI, PvP, Online | Both sides get the same random deck (and Evolution) |
| 🎡 Deck Roulette | AI, PvP, Online | Random decks, both replaced at 2:00 and 1:00 left |
| 🦴 Scavenger | AI, PvP, Online | 0.55× elixir; kills refund 45% of the troop's cost |
| 🌩️ Spellstorm | AI, PvP, Online | 3+ spells, spells −1 cost, damage spells echo at 50% |
| 🐜 Swarm Wars | AI, PvP, Online | Swarm troops only, swarms +50% units, splash −25% |
| 🦣 Heavyweights | AI, PvP, Online | Nothing under 3 elixir, max elixir 14, tanks +15% speed |
| 🏯 Fortress Wars | AI, PvP, Online | 2+ buildings, buildings cheaper/tougher/longer, +12% elixir each |
| ⛰️ King of the Hill | AI, PvP, Online | Hold the hill (hops between bridges) to fill a meter worth a crown; 3 crowns wins |
| 🎱 Pinball Panic | AI, PvP, Online | Single-target hits knock ground troops back; troops +15% speed |
| 🎲 Size Roulette | AI, PvP, Online | Each troop card in hand rolls Tiny / Normal / Mega (shown on the card) |
| ✦ Evolution Frenzy | AI, PvP, Online | Every Evolution card evolved-capable for the match, cycles −1 |
| 🛡️ Last Stand | AI | 10 scripted waves (weekly), dwindling elixir, no enemy towers, scored |
| 🤖 Boss Battle (Normal / Hard / Nightmare) | AI | Iron Colossus: telegraphed slams, guard summons (½ damage while alive), enrage, resists stuns; scored |
| 🌪️ Chaos Gauntlet / 🪜 Rising Ladder | AI (weekly) | 5-round runs with 3 lives; round and final prizes once a week |

Boss and survival levels follow your average card level (boss Hard +3, Nightmare +4). Tuned with AI runs: the AI beats Last Stand ~75% of the time, the boss ~70% (Normal), ~20% (Hard), ~4% (Nightmare).

#### Rewards and the rules around them
- Gold for playing (6 a day per event) and for wins (3 rewarded wins a day per event, scaled by AI difficulty), a one-time first-win prize per event/tier (gold, chest, sometimes Wild Shards), win milestones, challenge prizes, 12 event achievements and 10 cosmetic badges (pick one as your nameplate title). Event matches replace the normal battle rewards (no double pay) and never touch trophies.
- **No rewards, records or unlocks:** local PvP events (one device), matches where an online opponent leaves in the first 30 s (shown as "No contest"). **No rewards or achievements:** admin mode and the `?events=all` dev override.
- **Leaving:** once you play a card, closing the page or starting something else counts as a loss (once). In a challenge that costs a life. Leaving before playing a card is free.
- **Online:** event queues are separate per event and tier (`join_queue` / `create_room` take `eventId`, `tier`). The server refuses events that aren't online events or aren't open by its own clock, builds the whole config itself, swaps illegal decks for a legal loaner (`deck_loaner`), and marks event matches casual.

#### Adding a special event
1. Add an entry to `EVENTS` in `shared/events.js`: `id`, `name`, `icon`, `art`, `category`, `difficulty`, `deck` (`own`/`draft`/`mirror`/`roulette`), `modes`, `schedule`, texts (`tagline`, `desc`, `rules`, `win`, `loss`, `random`, `fixed`), `rewards`, optional `deckRules`, `tiers`, `score`.
2. Write `build(c)` returning `{ rules }` using existing engine rules (see `DEFAULT_RULES`). Only add a new engine rule when nothing fits; add it to `DEFAULT_RULES` and `normalizeRules`, then implement it where the engine already handles that concern.
3. Add an `art-<name>` gradient in `prototype.css`.
4. Run `npm test`: the catalog test builds every event and tier; add a test for any new rule.

#### Adding a Chaos modifier
1. Add an entry to `MODIFIERS` in `shared/clash-sim.js`: `name`, `icon`, `cat`, `sev`, `dur`, `weight`, `desc`, optional `group`, `needs`, and its effect: `fx` (existing keys in `MOD_STACK`), `zones` (existing kinds `cHaste`, `cSlow`, `cHeal`, `storm`, `meteorField`; `mirror: true` for fairness) and/or `start`.
2. A new effect key needs a `MOD_STACK` policy, a `MOD_CAPS` range, and one hook where that value is used (look at how `move`, `dmgIn` or `towerAtk` are read).
3. Add conflicts to `CHAOS_EXCLUDE` in `shared/events.js` if it must never pair with something.
4. Optional: drawing in `drawEventZone` (`prototype_arena.js`) and a sound in `Sound`.
5. Run `npm test`: the schedule test checks every limit for every tier over 250 seeds.

#### Testing done (step 12)
- **130 automated tests** (`npm test`, 43 new in `test/events.test.js`): defaults and no-leak, rule clean-up, every elixir rule, card mods, spell echoes, Size Roulette, deck swaps, Evolution Frenzy, sudden death, the hill (filling, contesting, moving, crown race), survival waves/guard line/timeouts, the boss (telegraph, guards, enrage, immunities, both endings), modifier lifecycle/warnings/clean-up/stacking/caps, cost floors, meteors (mirrored, both sides, towers spared, nothing after the final whistle), bounded crowd fights, Aegis and Evolution Rush, deterministic AI-vs-AI Chaos at every tier, every PvP event in a full AI-vs-AI match with legal moves, the AI in survival/boss, hazard avoidance, the catalog, deck validation and loaners (60 seeds per event), the draft, Chaos schedule limits (250 seeds × 4 tiers), rotation (60 days), duplicate results, daily caps, PvP/void/abandon policies, tier unlocks, challenge runs and weekly prizes, achievements/badges/milestones, scores, save clean-up, performance (a ~110-unit fight costs ~0.5–0.6 ms per 50 ms step with or without four stacked modifiers), and the golden normal-battle regression.
- **Headless Chrome:** hub → details → Chaos match → modifiers in the event bar → engaged → win → rewards, save and tier unlock → next normal battle is clean; Total Chaos AI-vs-AI; boss (guard, bar), King of the Hill, Size Roulette badges, Last Stand, the draft flow, an illegal Spellstorm deck (explained, then a loaner), a challenge run with a reload mid-round (one life lost, once) and "next round" from the results, local PvP (nothing recorded), a failed event start (back to a normal battle), a corrupted save, rapid event switching, meteor telegraphs, and 375 px phone screens (no horizontal scrolling). No console errors.
- **Two-window online:** server refuses PvE/closed/unknown events; both players get the same server-built Chaos match and see the same modifier at the same time; card plays mark the match engaged; a forfeit after 30 s pays once, an early one is "No contest"; an illegal Fortress Wars deck gets a server loaner and the discounted building costs reach the client.
- **AI-vs-AI fairness (40 matches per event, decks swapped between sides):** no event or tier shows a side bias beyond what normal battles already have (the existing engine/AI favours side B slightly: 32–43 on the same seeds with the original engine).

#### Known limitations
- **No accounts:** event progress and rewards are client-side like everything else, so a determined player can edit their save. The server validates event availability, deck legality and the whole battle, but not rewards.
- **The schedule follows each device's clock** (UTC date). It is the same for everyone with a correct clock, but it is not pushed from a server, and changing the clock shows another day's line-up (one-time rewards still can't be claimed twice).
- **Draft Duel is vs AI only** (an online draft would need a synchronised draft phase). **Boss Battle, Last Stand and the challenges are single player**; there is no co-op mode.
- **No leaderboards:** scores and records are personal bests.
- Balance comes from AI-vs-AI runs, which don't play like people (they don't really dodge telegraphs or plan around announced modifiers beyond simple rules). Expect retuning from real play.
- The AI plays only the visible information (active and announced modifiers, telegraphs); it does not plan ahead for Deck Roulette swaps or Size Roulette forms.
- The AI has a pre-existing habit of idling at full elixir when its whole hand is spells; it's fixed for event matches only.

### 13. Combat precision, targeting diagnostics and a planning AI (2026-10-13)

Everything is in `shared/clash-sim.js`, so local PvP, vs AI and online all get it. Tests: `test/combat-ai.test.js` (21 new). No cards, stats, costs, arenas or victory rules changed.

#### Combat resolution fixes
| Problem found | Fix |
|---|---|
| Two units hitting each other on the same tick: only the one that happened to update first landed its hit (update order flips every tick, so results depended on tick parity) | Anything alive when the tick began still lands an attack that releases that tick (`releaseOnDeathTick`, `u.live`/`t.live`). Towers too: a tower destroyed on the tick its shot was due still fires it. Nothing else happens for them that tick. |
| A wind-up whose target died could land on a *different* unit (up to 0.5 tiles out of range), and a cancelled wind-up still used up the whole cooldown | A wind-up is bound to its target (`windupTarget`). If that target dies, changes, or gets away, the swing is called off and the attack timer is handed back. Stuns still cost the attack, as before. |
| Attack timers were compared with `<= 0` after float steps (0.3 − 6×0.05 ≈ 1e-17), so every wind-up and cooldown fired one tick (50 ms) late | `TIME_EPS` threshold, same idea zone ticks already used. Wind-up is cleared on release (an existing Cluster Pod test caught a double-fire while fixing this). |
| Both kings destroyed on the same tick: the winner was whichever tower comes first in the list (always B) | It's a draw (reason `king`), decided once. |
| A troop deployed between steps was invisible to a spell cast on the same tick (spatial hash only rebuilt each step) | New units join the hash immediately (`hashInsert`). |
| Knockback only checked where a troop lands, not the path | The whole shove must be on open ground (no hopping the river or a tower). Not reachable with today's knockback sizes; it's a guard. |

The damage pipeline order was audited and left as is (it's already one path: structure/crown multipliers → aura → modifiers → boss guard → shield → health). Shields that break lose the excess, by design.

#### Targeting
The existing rules were already sound (eligibility in `canTarget`, hysteresis, locks after attacking, taunt, tower retention) and are unchanged. Added:
- Each unit records **why** it picked its target and since when (`targetWhy`, `targetSince`).
- `Sim.explainTargeting(state, id)`: read-only report (target, why, ranges, lock, attack state, every enemy with its rejection reason). It makes no random draws, so it's safe for a debug overlay.

#### AI
The existing AI is kept (spells, events, offence, emotes). Defence now goes through a planner:
1. **Threats** (`Sim.assessThreats`): every visible enemy, its goal (what it's hitting, or the tower it's walking to), an ETA that includes the bridge detour, and a danger score (value + tower damage it would do, weighted by how soon).
2. **Placements** (`defenseSpots`, `spotScore`): several legal spots per card, scored with the real targeting rules. Does it cover the threat's route? Will the threat see it and turn before it reaches the tower (lure), and is that a pull toward the middle? Does it land in time? Swarm spots next to enemy splash, or under a splash spell the opponent may have back, are marked down.
3. **Look-ahead** (`rollout`): the top candidates and "play nothing" are played out in a private copy of the match (`structuredClone`, its own random stream) for 3–6 s, scored by elixir-equivalent material (units by health left, towers by health). It holds if nothing beats holding by 0.75 elixir. The work is capped by a deterministic budget of unit-steps, not by a timer.
4. **Card cycle** (`Sim.foeCycle`): built from the public play log (`state.playLog`). A card is known to be out of the opponent's hand only when the rules prove it (fewer plays since than the queue length implied by the cards seen). Unseen cards are never assumed absent. It's used to avoid swarms when a splash spell may be back, and to push harder when every answer they've shown is cycling.
5. **Elixir**: no push while a dangerous threat is less than 6 s out, unless the bar is nearly full.
6. Every planned play keeps its reasoning in `brain.lastPlan.why` (threat, eta, hold value, candidates tried and their scores). A refused spot is not retried for 2 s.

Difficulty presets (`AI_PRESETS` in `prototype_v4.js`) now set `lookahead`: easy 0, normal 2, hard/insane 3. The existing tower/HP multipliers of the presets are unchanged; the AI gets no hidden information. It never reads the opponent's hand or elixir (there's a test).

**Measured (AI vs AI, 100 random-deck pairs × both seats, level 5):** planner vs the old decision path: 95–80 (25 draws), crowns 290–235. Hard settings: 101–80, crowns 300–242. Decisions average ~0.12 ms; 99.97% under 8 ms; rare 20–50 ms spikes are garbage collection, not rollouts (a rollout step is ~0.05 ms).

#### Status
- **Implemented and tested:** everything in the two tables above; explainTargeting; threat ranking; card-cycle inference; look-ahead isolation (real match untouched, deep-compared); blind to the opponent's hidden hand and elixir; a Ram Hog answered with a legal play that pulls it off the tower (tower damage less than half of not answering); no retry of refused spots; bounded decision cost; building re-routing; knockback never leaves troops in the river or a tower.
- **Verified in Chrome:** vs AI (planner and rollouts running, max decision 20 ms), local PvP, and two-window online against this server (both deploys accepted). No console errors.
- **Implemented, lightly tested:** the "push harder when their answers are cycling" and "don't push into an incoming threat" rules (covered only by the AI-vs-AI benchmark).
- **Not implemented:** look-ahead for offence and spells (spells keep their value-based planner); modelling the opponent's replies inside rollouts (a rollout assumes they play nothing); bridge-choice hysteresis for troops chasing across the river (no oscillation was found in tests); tower-vs-troop collision uses a circle for the square tower (nav already blocks tower cells, so it's invisible in play); a visual overlay for `explainTargeting`.
- **Golden test re-recorded:** `normal battles play out exactly as recorded` pinned AI-vs-AI results from before the events system. These deliberate changes alter normal battles, so it was re-recorded once. It still catches any event change leaking into normal battles.

**Next step:** give the rollouts a simple opponent reply (e.g. the cheapest seen card that could still be in hand, placed by the same planner) so the AI stops over-trusting a defence that only works if the opponent does nothing. Then extend look-ahead to the offence choice.

### 10. Fix: placing a swarm froze the game
Swarm members land a moment apart, which made the drop-in animation compute a negative shadow size; the canvas threw and the frame loop stopped. The renderer now clamps it, and the frame loop keeps running even if a frame throws (the error is logged).

### 11. Fix: new cards hidden, few emotes
- **New cards:** the 28 new cards were all locked behind the Trophy Road (300–5000 🏆), so on a normal save they only appeared greyed out at the bottom of the collection. They're now unlocked for everyone on load (old saves too). Their Trophy Road milestones now give +4 copies instead.
- **Emotes:** all 14 original emotes are free, and 22 new animated emoji emotes were added (36 in total). The ids are in `Sim.EMOTE_IDS` (the server checks against them) and the art is in `prototype_emotes.js` (an `emoji` field draws an animated badge). The emote wheel scrolls.

## Testing done

- **Step 11 (Evolutions):** 87 automated tests (`npm test`): the cycle (exact evolve pattern, reset, independent charges, failed plays never advance it, unequipped never evolves, fresh per match), deck slot limits, one test per Evolution ability, core-rule interactions (air targeting, freeze, building expiry), a heavy battle with every Evolution at once (stays fast, no runaway spawns), shard/Wild Shard/unlock/overflow/equip rules, save clean-up, and Trophy Road shard stops. Headless Chrome: claim → unlock celebration → equip (locked, full and success feedback) → ranked match charging → ready glow → evolved deploy → saved across reload; a staged battle with all 15 Evolutions and evolved spells (no errors); an AI match with Evolutions on both sides; online: server caps a tampered 3-Evolution deck at 2, both clients see charges, and the third Brawler comes out evolved on the server. Earlier sweeps (Trophy Road, all cards, swarm freeze) re-run clean.

- **59 automated tests** (`npm test`). Added in step 9: one test per new card mechanic (freeze, damage-over-time, slow/haste, heal, pull, laser, boulder, paratroopers, anti-air, ramp-up, siege range, hidden building, spawners, elixir pump, taunt, healer, death spawns, charge reset, shield, slow on hit, dash, pierce, deploy-anywhere with matching online preview, stun chain), the AI deck builder at every arena, AI-vs-AI matches with the new cards (legal moves only, spells and buildings used), and 10 Trophy Road tests (trophy maths, floors, AI ceilings, duplicate results, milestone claims, abandoned matches, save clean-up, every new card on the road once in its own arena).
- **Headless Chrome (this round):** ranked AI win with arena promotion, forfeit by restarting and by reloading, practice and local PvP give no trophies, Trophy Road claim/claim-all/double-claim/theme switch, every card (all 191) deployed and drawn for both sides, a staged battle with every new effect, the deck editor (tabs, filters, slot swap, saved), two-window online (ranked queue start, forfeit win +30, friendly room with no trophies), and a 375 px phone screen (no horizontal scrolling). No console errors.
- Earlier tests:

  - 22 automated tests at step 8. Added in step 8: spells can be cast anywhere (and the online preview agrees), Fire Bomb flight/knockback/reduced tower damage, Shock stun and Rocket Rain swarm clear, an AI-vs-AI match with spell decks (legal moves only, spells used), emote validation and rate limits, and AI emotes. The original 16:
  1. Melee units find and attack nearby troops.
  2. Building-only units ignore distracting troops.
  3. Ranged units attack from range and stop there.
  4. Ground units cross only on bridges.
  5. Flying units cross the river directly.
  6. Units stop attacking dead targets.
  7. Units don't get permanently stuck (behind their own king, or in a crowd).
  8. Units don't pile up on each other.
  9. Towers target valid enemies, and the king wakes up correctly.
  10. Elixir never goes negative.
  11. Cards can't be played when unaffordable or in invalid spots (including the opened-up area after a tower falls).
  12. The match ends correctly: king kill, crowns, overtime, tiebreak and draw.
  13. A 120-unit battle runs at about 0.1 ms per simulation step.
  14. A full AI-vs-AI match makes only legal moves.
  15. **Every card** reaches and damages a tower from 3 starting spots (465 runs).
  16. The online placement preview agrees with the server's rules everywhere on the arena.
- **40 AI-vs-AI matches** with mixed decks: no crashes, no illegal moves.
- **Headless Chrome:** Local PvP (drag, tap-tap, invalid placement, Esc), vs AI, two-window Online (including player B's flipped placements), phone-sized screen, the victory screen, and a stress test with every unit type. No errors, 60 fps.

---

## Still to do

- **Evolution unlocks are client-side** (like all progress). The server checks that a card *has* an Evolution and enforces the slot limit, but it can't know whether you unlocked it. That needs accounts.
- **Evolution balance** comes from AI-vs-AI mirror matches, which don't play like people (they rarely save an Evolution for the right moment). Expect to retune from real play.
- **Evolved art** reuses the card's emoji with a violet/gold aura, rim and crest, plus ability-specific effects; there is no separate evolved sprite.

- **Trophies live in the browser** (localStorage), like the rest of progress. There are no accounts, so someone could edit their save, or play themselves online in two windows to farm wins. Real protection needs server-side accounts.
- **Online card levels** are whatever the client sends (unchanged from before).
- **Balance** needs tuning from real play. With spells and the new AI, AI-vs-AI matches average about 2:30 (60 random-deck matches: 28–26 with 6 draws).
- **Step 8 browser checks** (headless Chrome): vs AI (emote wheel, rate limit, locked emotes, spells, crown and victory banners, results sheet, achievements), two-window Online (emotes both ways, server rate limit, mute, spell sync, post-match emote), Local PvP (both emote wheels), a 375 px phone screen, and a ~100-unit stress test at 60 fps. No console errors.
- **Live server:** online play has only been tested against a local copy of the server. The real Render server only updates once this is pushed.
- **Leftover code:** an old, unused `prototype.js` and some old board CSS rules can be deleted.
