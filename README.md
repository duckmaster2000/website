# Caleb Liu Website

A personal multi-page website with custom mini-projects, media, and game pages.

## Project Overview

This repository contains a static website built with HTML, CSS, and JavaScript.

Current highlights:
- A redesigned sci-fi styled homepage
- A polished clicker game with upgrades and saved progress
- A redesigned quotes page with an interactive mini-game
- Additional experimental pages for layout practice and small demos

## Work Completed So Far

Recent improvements made in this session:

1. Repository setup and sync
- Pulled the remote repository into the local website workspace
- Verified the remote tracking configuration

2. Homepage redesign
- Reworked index layout into clean sections
- Applied a consistent sci-fi visual system
- Improved typography, spacing, and responsive behavior
- Reduced oversized photo presentation to better match text content scale

3. Clicker game polish
- Rebuilt the game UI into a modern sci-fi HUD
- Added clearer game stats and upgrade presentation
- Added floating click feedback effects
- Added audio feedback for clicks and upgrades
- Added second upgrade path with passive income
- Added local save/load using browser storage

4. Quotes page upgrade
- Replaced simple static list layout with a polished page design
- Added Quote Reactor mini-game: Real or Fake
- Added score and streak tracking
- Kept and improved quote archive display and contributor credits

## Website Structure

Top-level pages:
- index.html: Main homepage and site hub
- something.html: Quotes page and Real or Fake mini-game
- clicker.html: Gem clicker game
- coolstuff.html: Additional personal content page
- flexbox.html: Flexbox experiment page
- grid.html: Grid layout experiment page
- position.html: Positioning experiment page
- youtube.html: YouTube related page

Primary stylesheets:
- styles.css: Homepage styling
- something.css: Quotes page styling
- clicker.css: Clicker game styling
- 2048.css: 2048 page styling
- button.css: Button styling utility page
- contactinfo.css: Contact info styling

Primary scripts:
- something.js: Quotes mini-game logic
- clicker.js: Clicker game logic
- 2048.js: 2048 page logic

Media and assets:
- gem.png, miner.png, clicker-white.png, clicker.png, factory.png, pickaxe.png, potion.png, question.png, skill1.png
- image.jpeg, IMG_0390-1.jpg
- click.mp3, click.wav, upgrade.mp3

Infrastructure and domain:
- CNAME: Custom domain configuration for GitHub Pages

## How To Run Locally

1. Open the repository folder in VS Code.
2. Open index.html in your browser to access the homepage.
3. Navigate to linked pages from the homepage.

## Notes

- This is a static site, so no server build step is required.
- Browser local storage is used by the clicker game to persist progress.
- The quotes page game state is session based unless extended later.

## Update Log

Use this section to record each meaningful update.

Format:
- YYYY-MM-DD | Area | Summary

Entries:
- 2026-03-13 | coolstuff.html | Expanded Cool Stuff page from 1 toy to 10 total by adding 9 new interactive mini toys (color generator, dice, coin flip, magic 8 ball, rock-paper-scissors, guess number, fortune cookie, password generator, text scrambler), plus responsive card layout and styling.
- 2026-03-13 | coolstuff.html | Fixed layout bug where toys appeared oversized/off-screen and crowded right by removing global button.css dependency and scoping button effect styles locally in coolstuff page.
- 2026-03-13 | coolstuff.html | Added camera mini-game "Color Hunt Cam" using getUserMedia with Start/Stop camera controls, 15-second color matching round, score/timer tracking, and camera permission fallback messaging.
- 2026-03-13 | coolstuff.html | Added "Mini Mario Runner" canvas game with jump controls (keyboard + button), moving pipe obstacles, increasing speed, score tracking, and saved best score.
- 2026-03-13 | coolstuff.html | Upgraded Mini Mario Runner with sprite-based visuals, oscillator sound effects, collectible coins, star shield power-up, 3-life system, and level progression with scaling speed/difficulty.
- 2026-03-13 | coolstuff.html | Added Mario pause/resume system (button + P key), introduced enemy types (ground + flying with stomp interaction), and added animated level transition overlays between levels.
- 2026-03-14 | clicker.html/clicker.css/clicker.js | Major clicker overhaul: added combo/frenzy/crit systems, golden gem event clicks with bonus rewards, two new upgrades (Crystal Factory and Gem Alchemy), achievements panel, stronger VFX polish, save migration to v3, and a secret code console where typing "Caleb" unlocks a one-time hack boost.
- 2026-03-14 | clicker.js/clicker.css/clicker.html | Debugged and fixed all reported bugs: stale goldenGemActive save preventing golden gems from ever spawning after reload; silent upgrade failures replaced with "Need X gems" feedback message; full state validation on load to guard against NaN/corrupted saves; transient combo/frenzy state no longer persisted across reloads; achievement rendering throttled from 200 ms to once per second; buyFeedback element wired into all purchase paths.
- 2026-03-14 | clicker.html/clicker.css/clicker.js | Reworked clicker into a retro space cookie-clicker style economy with 10 production buildings, 24 research upgrades focused on building output, expanded achievement set, additional image-driven upgrade cards, and an integrated Astrobakery Defense tower-defense minigame that uses building progress to grant tower tokens and rewards.
- 2026-03-16 | clicker.html/clicker.css/clicker.js | Polished Astrobakery Defense with scaling wave difficulty, enemy variety (scout/brute/splitter/shield), multiple tower types (laser/cannon/frost), branch upgrades (Path A/Path B), tower selling, and orbital strike ability; added a prestige reset loop with permanent shard bonuses (GPS/click/TD) and restart flow; massively expanded upgrade catalog to 62 total research upgrades with many additional global and building-specific boosts.
- 2026-03-16 | clicker.html/clicker.css/clicker.js | Added bulk purchase systems: per-building Buy 1/10/100/All controls with simulated true cumulative costs, and a global "Buy All Affordable Upgrades" button for research; performed a balance pass to make tower-defense runs harder by increasing enemy scaling/spawn pressure and reducing token/reward inflation.
- 2026-03-16 | index.html/styles.css/index.js | Added a new "My Achievements" homepage section with an easy local checklist editor: plus-button add flow, persistent localStorage entries, check/uncheck completion states, delete controls, and passcode-based edit lock so only unlocked users can modify achievements.

## Next Suggested Improvements

1. Add a shared navigation header across all pages for consistent UX.
2. Add a global design token file for colors, spacing, and typography reuse.
3. Add accessibility passes for color contrast and keyboard interaction.
