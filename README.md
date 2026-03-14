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

## Next Suggested Improvements

1. Add a shared navigation header across all pages for consistent UX.
2. Add a global design token file for colors, spacing, and typography reuse.
3. Add accessibility passes for color contrast and keyboard interaction.
