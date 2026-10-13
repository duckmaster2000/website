# Clash Tanks: work log and how it all fits together

Notes on the prototype tank game at `caleb-liu.com/prototype.html`: what was changed, how it's built, how to deploy it, and what's left.

---

## How it's built

| Piece | File(s) | Runs where |
|---|---|---|
| **Game engine**: arena, cards, movement, combat, towers, clock, AI | `clash-tanks-server/clash-tanks-server/shared/clash-sim.js` | Browser (Local PvP, vs AI) **and** server (Online) |
| Arena renderer (canvas drawing, effects, HUD, placement preview, announcements, emote bubbles) | `prototype_arena.js` | Browser |
| Emote artwork (animated faces drawn with canvas paths) | `prototype_emotes.js` | Browser |
| Page logic (menus, progression, chests, decks, lobby, input, sound) | `prototype_v4.js`, `prototype.html`, `prototype.css` | Browser |
| Online server (matchmaking, rooms, runs the engine) | `clash-tanks-server/clash-tanks-server/server.js` | Render |
| Tests | `clash-tanks-server/clash-tanks-server/test/sim.test.js` | `npm test` |

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
   - `prototype_emotes.js` (new)
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

## Testing done

- **22 automated tests** (`npm test`), all passing. Added in step 8: spells can be cast anywhere (and the online preview agrees), Fire Bomb flight/knockback/reduced tower damage, Shock stun and Rocket Rain swarm clear, an AI-vs-AI match with spell decks (legal moves only, spells used), emote validation and rate limits, and AI emotes. The original 16:
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

- **Balance** needs tuning from real play. With spells and the new AI, AI-vs-AI matches average about 2:30 (60 random-deck matches: 28–26 with 6 draws).
- **Step 8 browser checks** (headless Chrome): vs AI (emote wheel, rate limit, locked emotes, spells, crown and victory banners, results sheet, achievements), two-window Online (emotes both ways, server rate limit, mute, spell sync, post-match emote), Local PvP (both emote wheels), a 375 px phone screen, and a ~100-unit stress test at 60 fps. No console errors.
- **Live server:** online play has only been tested against a local copy of the server. The real Render server only updates once this is pushed.
- **Leftover code:** an old, unused `prototype.js` and some old board CSS rules can be deleted.
