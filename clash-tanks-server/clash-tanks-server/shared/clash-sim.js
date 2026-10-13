/*
 * Clash Tanks shared game engine.
 *
 * One simulation used everywhere: the browser runs it for local PvP and vs-AI
 * matches, and the server runs it for online matches. Keeping a single copy means
 * every mode plays by exactly the same rules.
 *
 * Arena is measured in tiles: 18 wide x 32 tall. Side A sits at the bottom
 * (large y) and attacks upward; side B sits at the top and attacks downward.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ClashSim = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  // ─── Arena geometry ──────────────────────────────────────────────────────

  const W = 18;
  const H = 32;
  const MID_X = W / 2;
  const RIVER = { y0: 15, y1: 17 };
  const BRIDGES = [{ x0: 2, x1: 5, cx: 3.5 }, { x0: 13, x1: 16, cx: 14.5 }];
  const TOWER_LAYOUT = {
    princessX: [3.5, 14.5],
    princessY: { A: 25.5, B: 6.5 },
    kingX: 9,
    kingY: { A: 29.5, B: 2.5 },
  };
  // How far past the river you may deploy once the enemy princess tower on that side falls
  const POCKET_DEPTH = 4;

  const MATCH = {
    step: 0.05,             // fixed simulation timestep (seconds)
    regulation: 180,        // 3:00 regular time
    overtime: 60,           // 1:00 sudden-death overtime
    doubleElixirAt: 120,    // last minute of regulation (and overtime) is double elixir
    startElixir: 5,
    maxElixir: 10,
    elixirPerSec: 1 / 2.8,
    deployTime: 1,          // troops can't act for this long after landing
  };

  const PROJ_SPEED = { slug: 13, spark: 15, shell: 10, mortar: 6, beam: 26, flare: 11, arrow: 15, bolt: 13, pulse: 12, firebomb: 15, rocket: 17, flak: 16, ice: 13, zap: 30 };

  // Emotes: ids only (the art lives in the browser). Rate limits keep them fun, not spammy.
  const EMOTE_IDS = ['laugh', 'thumbs', 'cry', 'angry', 'surprised', 'celebrate', 'facepalm', 'cool', 'gg', 'king', 'trophy', 'sleepy', 'heart', 'thinking',
    'fire', 'skull', 'clap', 'wave', 'sweat', 'mindblown', 'rocket', 'crown', 'shield', 'boom', 'sad', 'wink', 'eyes', 'sorry', 'flex', 'zap', 'ice', 'ghost', 'popcorn', 'think2', 'lol', 'salute'];
  const EMOTE_RULES = { minGap: 2, window: 20, maxInWindow: 5 };

  // ─── Cards ───────────────────────────────────────────────────────────────
  //
  // Stats are per unit (swarm cards spawn `count` copies). Ranges, speeds and radii
  // are in tiles; speed is tiles per second. `targets` is 'ground' (troops on the
  // ground + buildings), 'any' (also air) or 'buildings' (towers and buildings only).

  const ab = (name, minLevel, minMastery, dmgBoost, hpBoost) => ({ name, minLevel, minMastery, dmgBoost, hpBoost });

  const ARCHETYPES = [
    { slug: 'scout', name: 'Scout', icon: '🏎️', rarity: 'common', cost: 2, role: 'raider', hp: 230, dmg: 45, cd: 1.0, range: 2.5, speed: 2.0, targets: 'buildings', proj: 'slug', radius: 0.45, deployCd: 1.0,
      ability: ab('Turbo Drive', 5, 10, 1.08, 1.07) },
    { slug: 'brawler', name: 'Brawler', icon: '🚛', rarity: 'common', cost: 4, role: 'tank', hp: 650, dmg: 75, cd: 1.2, range: 0.6, speed: 1.0, targets: 'ground', proj: 'melee', radius: 0.6, deployCd: 1.15,
      ability: ab('Iron Shell', 6, 12, 1.05, 1.12) },
    { slug: 'siege', name: 'Siege', icon: '🛞', rarity: 'rare', cost: 6, role: 'siege tank', hp: 1050, dmg: 105, cd: 1.7, range: 5.0, speed: 0.75, targets: 'buildings', proj: 'shell', radius: 0.7, deployCd: 1.45,
      ability: ab('Heavy Payload', 6, 12, 1.14, 1.05) },
    { slug: 'guardian', name: 'Guardian', icon: '🛡️', rarity: 'rare', cost: 5, role: 'shield support', hp: 800, dmg: 45, cd: 1.2, range: 0.8, speed: 0.9, targets: 'ground', proj: 'melee', radius: 0.65, special: 'aura', deployCd: 1.25,
      ability: ab('Forcefield', 5, 10, 1.07, 1.14) },
    { slug: 'voltbug', name: 'Volt Bug', icon: '⚡', rarity: 'common', cost: 3, role: 'chain zapper', hp: 240, dmg: 35, cd: 1.2, range: 4.5, speed: 1.25, targets: 'any', proj: 'spark', radius: 0.45, special: 'chain', deployCd: 1.0,
      ability: ab('Static Burst', 5, 10, 1.12, 1.05) },
    { slug: 'flarepod', name: 'Flare Pod', icon: '🔥', rarity: 'epic', cost: 4, role: 'splash caster', hp: 250, dmg: 90, cd: 1.4, range: 5.0, speed: 1.0, targets: 'any', proj: 'flare', splash: 1.3, radius: 0.45, deployCd: 1.2,
      ability: ab('Inferno Surge', 6, 12, 1.12, 1.07) },
    { slug: 'drillcat', name: 'Drill Cat', icon: '🚜', rarity: 'rare', cost: 4, role: 'tank killer', hp: 450, dmg: 240, cd: 1.6, range: 0.5, speed: 1.5, targets: 'ground', proj: 'melee', radius: 0.5, structureMult: 1.25, deployCd: 1.15,
      ability: ab('Diamond Drill', 6, 12, 1.14, 1.06) },
    { slug: 'raylance', name: 'Ray Lance', icon: '💠', rarity: 'legendary', cost: 5, role: 'sniper', hp: 270, dmg: 85, cd: 1.0, range: 6.5, speed: 1.0, targets: 'any', proj: 'beam', radius: 0.45, deployCd: 1.35,
      ability: ab('Overcharge', 7, 15, 1.16, 1.05) },
    { slug: 'mortarfox', name: 'Mortar Fox', icon: '🧨', rarity: 'epic', cost: 6, role: 'artillery', hp: 330, dmg: 110, cd: 2.6, range: 6.5, minRange: 2.5, speed: 0.75, targets: 'ground', proj: 'mortar', splash: 1.5, radius: 0.55, deployCd: 1.65,
      ability: ab('Barrage Mode', 7, 15, 1.14, 1.07) },
    { slug: 'ramhog', name: 'Ram Hog', icon: '🐗', rarity: 'rare', cost: 5, role: 'river-jumping charger', hp: 560, dmg: 105, cd: 1.6, range: 0.5, speed: 2.0, targets: 'buildings', proj: 'melee', radius: 0.55, special: 'jump charge', deployCd: 1.18,
      ability: ab('Rampage', 7, 15, 1.16, 1.08) },
    // ── Swarms ──
    { slug: 'junkpack', name: 'Junk Pack', icon: '🔧', rarity: 'common', cost: 3, role: 'melee swarm', count: 3, hp: 170, dmg: 45, cd: 1.3, range: 0.5, speed: 1.0, targets: 'ground', proj: 'melee', radius: 0.42, deployCd: 1.1,
      ability: ab('Mob Rush', 5, 10, 1.1, 1.08) },
    { slug: 'bugsquad', name: 'Bug Squad', icon: '🐛', rarity: 'rare', cost: 4, role: 'ranged swarm', count: 4, hp: 70, dmg: 30, cd: 1.2, range: 4.0, speed: 1.5, targets: 'any', proj: 'spark', radius: 0.35, deployCd: 1.2,
      ability: ab('Hive Mind', 6, 12, 1.12, 1.1) },
    { slug: 'mechmice', name: 'Mech Mice', icon: '🐭', rarity: 'common', cost: 2, role: 'cycle swarm', count: 2, hp: 110, dmg: 45, cd: 1.0, range: 0.4, speed: 2.0, targets: 'ground', proj: 'melee', radius: 0.35, deployCd: 0.95,
      ability: ab('Scuttle', 5, 10, 1.08, 1.1) },
    { slug: 'goblinbikers', name: 'Goblin Bikers', icon: '🏍️', rarity: 'epic', cost: 5, role: 'tower rushers', count: 5, hp: 90, dmg: 30, cd: 1.1, range: 0.5, speed: 2.0, targets: 'buildings', proj: 'melee', radius: 0.38, deployCd: 1.3,
      ability: ab('Turbo Gang', 7, 15, 1.12, 1.1) },
    { slug: 'nanodrones', name: 'Nano Drones', icon: '🤖', rarity: 'rare', cost: 4, role: 'air swarm', count: 3, air: true, hp: 95, dmg: 32, cd: 1.0, range: 2.0, speed: 1.5, targets: 'any', proj: 'spark', radius: 0.4, deployCd: 1.2,
      ability: ab('Network Link', 6, 12, 1.1, 1.08) },
    { slug: 'bombbeetles', name: 'Bomb Beetles', icon: '💣', rarity: 'legendary', cost: 6, role: 'kamikaze splash', count: 6, hp: 70, dmg: 60, cd: 1.0, range: 1.6, speed: 2.0, targets: 'any', proj: 'melee', splash: 1.5, radius: 0.35, special: 'kamikaze', deployCd: 1.5,
      ability: ab('Chain Detonation', 7, 15, 1.16, 1.08) },
    { slug: 'antmarch', name: 'Ant March', icon: '🐜', rarity: 'common', cost: 2, role: 'cheap swarm', count: 3, hp: 50, dmg: 40, cd: 1.0, range: 0.4, speed: 1.5, targets: 'ground', proj: 'melee', radius: 0.3, deployCd: 0.9,
      ability: ab('Column Charge', 5, 10, 1.08, 1.1) },
    { slug: 'crickethop', name: 'Cricket Hop', icon: '🦗', rarity: 'common', cost: 2, role: 'river jumpers', count: 2, hp: 130, dmg: 50, cd: 1.0, range: 0.5, speed: 2.0, targets: 'ground', proj: 'melee', radius: 0.38, special: 'jump', deployCd: 0.95,
      ability: ab('Leap Spring', 5, 10, 1.09, 1.09) },
    { slug: 'beeblitz', name: 'Bee Blitz', icon: '🐝', rarity: 'common', cost: 3, role: 'air swarm', count: 4, air: true, hp: 40, dmg: 30, cd: 1.1, range: 0.6, speed: 2.0, targets: 'any', proj: 'melee', radius: 0.32, deployCd: 1.0,
      ability: ab('Sting Flurry', 5, 10, 1.1, 1.07) },
    { slug: 'scrapbots', name: 'Scrap Bots', icon: '🪲', rarity: 'common', cost: 3, role: 'sturdy swarm', count: 3, hp: 180, dmg: 40, cd: 1.3, range: 0.5, speed: 0.9, targets: 'ground', proj: 'melee', radius: 0.42, deployCd: 1.1,
      ability: ab('Salvage Mode', 5, 10, 1.08, 1.12) },
    { slug: 'lizarddash', name: 'Lizard Dash', icon: '🦎', rarity: 'rare', cost: 3, role: 'fast swarm', count: 3, hp: 110, dmg: 40, cd: 1.0, range: 0.4, speed: 2.0, targets: 'ground', proj: 'melee', radius: 0.36, deployCd: 1.05,
      ability: ab('Cold Blooded', 6, 12, 1.12, 1.06) },
    { slug: 'toadtroop', name: 'Toad Troop', icon: '🐸', rarity: 'rare', cost: 4, role: 'splash swarm', count: 3, hp: 170, dmg: 45, cd: 1.4, range: 4.0, speed: 1.0, targets: 'ground', proj: 'shell', splash: 1.0, radius: 0.4, deployCd: 1.2,
      ability: ab('Leapfrog Volley', 6, 12, 1.1, 1.1) },
    { slug: 'wolfpack', name: 'Wolf Pack', icon: '🐺', rarity: 'rare', cost: 5, role: 'fast melee pack', count: 3, hp: 300, dmg: 80, cd: 1.2, range: 0.5, speed: 1.5, targets: 'ground', proj: 'melee', radius: 0.45, deployCd: 1.3,
      ability: ab('Pack Fury', 6, 12, 1.14, 1.08) },
    { slug: 'zombiemob', name: 'Zombie Mob', icon: '🧟', rarity: 'rare', cost: 4, role: 'slow horde', count: 5, hp: 140, dmg: 32, cd: 1.4, range: 0.5, speed: 0.75, targets: 'ground', proj: 'melee', radius: 0.4, deployCd: 1.2,
      ability: ab('Reanimate', 6, 12, 1.07, 1.16) },
    { slug: 'hawkstrike', name: 'Hawk Strike', icon: '🦅', rarity: 'epic', cost: 4, role: 'air hunters', count: 3, air: true, hp: 140, dmg: 45, cd: 1.1, range: 0.7, speed: 2.0, targets: 'any', proj: 'melee', radius: 0.42, deployCd: 1.2,
      ability: ab('Talon Dive', 7, 15, 1.14, 1.08) },
    { slug: 'crackergang', name: 'Cracker Gang', icon: '🎆', rarity: 'epic', cost: 5, role: 'ranged gang', count: 4, hp: 120, dmg: 45, cd: 1.4, range: 4.5, speed: 1.25, targets: 'any', proj: 'slug', radius: 0.38, deployCd: 1.3,
      ability: ab('Flashbang', 7, 15, 1.12, 1.1) },
    { slug: 'flybombers', name: 'Fly Bombers', icon: '🪰', rarity: 'epic', cost: 5, role: 'air tower bombers', count: 5, air: true, hp: 110, dmg: 45, cd: 2.0, range: 0.4, speed: 1.25, targets: 'buildings', proj: 'melee', splash: 1.0, radius: 0.42, special: 'deathBomb', deployCd: 1.3,
      ability: ab('Kamikaze Drop', 7, 15, 1.14, 1.06) },
    { slug: 'rabbitrush', name: 'Rabbit Rush', icon: '🐇', rarity: 'epic', cost: 5, role: 'burrowing rushers', count: 5, hp: 90, dmg: 28, cd: 1.0, range: 0.5, speed: 2.0, targets: 'buildings', proj: 'melee', radius: 0.36, special: 'jump', deployCd: 1.25,
      ability: ab('Burrow Blitz', 7, 15, 1.12, 1.1) },
    { slug: 'ufofleet', name: 'UFO Fleet', icon: '🛸', rarity: 'legendary', cost: 6, role: 'air siege', count: 4, air: true, hp: 170, dmg: 45, cd: 1.5, range: 4.0, speed: 1.0, targets: 'buildings', proj: 'beam', radius: 0.45, deployCd: 1.5,
      ability: ab('Abduction Ray', 7, 15, 1.16, 1.06) },
    { slug: 'dustdevils', name: 'Dust Devils', icon: '🌪️', rarity: 'legendary', cost: 6, role: 'spinning splash', count: 3, hp: 330, dmg: 75, cd: 1.5, range: 0.6, speed: 1.0, targets: 'ground', proj: 'melee', splash: 1.4, radius: 0.45, special: 'spin', deployCd: 1.45,
      ability: ab('Vortex Spin', 7, 15, 1.14, 1.1) },
    { slug: 'makoswarm', name: 'Mako Swarm', icon: '🦈', rarity: 'legendary', cost: 7, role: 'heavy horde', count: 6, hp: 220, dmg: 60, cd: 1.4, range: 0.5, speed: 1.0, targets: 'ground', proj: 'melee', radius: 0.45, deployCd: 1.6,
      ability: ab('Feeding Frenzy', 7, 15, 1.18, 1.1) },
    // ── Buildings ──
    { slug: 'boltturret', name: 'Bolt Turret', icon: '🏯', rarity: 'common', cost: 4, role: 'defensive building', building: true, lifetime: 30, hp: 1000, dmg: 70, cd: 0.9, range: 5.5, speed: 0, targets: 'ground', proj: 'bolt', radius: 0.95, deployCd: 1.2,
      ability: ab('Overclock', 5, 10, 1.1, 1.1) },
    // ── Spells: cast anywhere on the arena. Projectile spells fly from your king tower. ──
    // `splash` is the spell radius; crown towers take `towerMult` of the damage.
    { slug: 'firebomb', name: 'Fire Bomb', icon: '☄️', rarity: 'rare', cost: 4, role: 'area damage spell', spell: true, hp: 0, dmg: 200, cd: 1, range: 0, speed: 0, targets: 'any', proj: 'firebomb', splash: 2.5, radius: 0, towerMult: 0.3, knockback: 0.9, deployCd: 1.0,
      ability: ab('Inferno Core', 6, 12, 1.1, 1) },
    { slug: 'shock', name: 'Shock', icon: '🌩️', rarity: 'common', cost: 2, role: 'instant stun spell', spell: true, hp: 0, dmg: 75, cd: 1, range: 0, speed: 0, targets: 'any', proj: 'shock', splash: 2.5, radius: 0, towerMult: 0.3, stun: 0.6, deployCd: 0.9,
      ability: ab('Overvolt', 5, 10, 1.1, 1) },
    { slug: 'rocketrain', name: 'Rocket Rain', icon: '🚀', rarity: 'common', cost: 3, role: 'swarm-clearing spell', spell: true, hp: 0, dmg: 120, cd: 1, range: 0, speed: 0, targets: 'any', proj: 'rocket', splash: 3.8, radius: 0, towerMult: 0.3, waves: 3, deployCd: 1.0,
      ability: ab('Cluster Payload', 5, 10, 1.1, 1) },

    // ── Trophy Road cards: one version each (no Mk-II/Twin/Burst/Core variants) ──
    // `mech` holds the card's special mechanic; see the Mechanics section below.

    // Spells. `zone` spells leave a lingering area; `instant` ones land immediately.
    { slug: 'frostnova', name: 'Frost Nova', icon: '❄️', rarity: 'epic', cost: 4, role: 'freeze spell', spell: true, instant: true, hp: 0, dmg: 80, cd: 1, range: 0, speed: 0, targets: 'any', proj: 'frost', splash: 3.0, radius: 0, towerMult: 0.3, freeze: 3.0, deployCd: 1.1, arena: 2,
      desc: 'Freezes every enemy in the area (troops, buildings and towers) for 3 seconds.',
      ability: ab('Deep Freeze', 6, 12, 1.1, 1) },
    { slug: 'acidpool', name: 'Acid Pool', icon: '🧪', rarity: 'epic', cost: 4, role: 'damage-over-time spell', spell: true, instant: true, hp: 0, dmg: 300, cd: 1, range: 0, speed: 0, targets: 'any', proj: 'acid', splash: 3.0, radius: 0, towerMult: 0.3, deployCd: 1.1, arena: 3,
      zone: { kind: 'dot', dur: 6, tick: 1, slow: 0.8 },
      desc: 'A bubbling pool that burns enemies for 6 seconds and slows them while they stand in it.',
      ability: ab('Corrosion', 6, 12, 1.1, 1) },
    { slug: 'tartrap', name: 'Tar Trap', icon: '🛢️', rarity: 'rare', cost: 2, role: 'slowing spell', spell: true, instant: true, hp: 0, dmg: 0, cd: 1, range: 0, speed: 0, targets: 'any', proj: 'tar', splash: 3.0, radius: 0, towerMult: 0, deployCd: 0.9, arena: 1,
      zone: { kind: 'slow', dur: 6, slow: 0.4 },
      desc: 'Sticky tar: enemy troops and buildings inside move and attack 60% slower for 6 seconds.',
      ability: ab('Thick Tar', 5, 10, 1, 1) },
    { slug: 'overdrive', name: 'Overdrive', icon: '⏩', rarity: 'epic', cost: 3, role: 'friendly speed buff', spell: true, instant: true, friendly: true, hp: 0, dmg: 0, cd: 1, range: 0, speed: 0, targets: 'any', proj: 'haste', splash: 3.0, radius: 0, towerMult: 0, deployCd: 1.0, arena: 5,
      zone: { kind: 'haste', dur: 6, haste: 1.4 },
      desc: 'Your troops and buildings inside move and attack 40% faster for 6 seconds.',
      ability: ab('Redline', 6, 12, 1, 1) },
    { slug: 'repairwave', name: 'Repair Wave', icon: '💚', rarity: 'rare', cost: 3, role: 'friendly healing spell', spell: true, instant: true, friendly: true, hp: 0, dmg: 300, cd: 1, range: 0, speed: 0, targets: 'any', proj: 'repair', splash: 3.0, radius: 0, towerMult: 0, deployCd: 1.0, arena: 4,
      zone: { kind: 'heal', dur: 3, tick: 0.5 },
      desc: 'Heals your troops and buildings in the area by 300 over 3 seconds. Does not heal crown towers.',
      ability: ab('Nanite Swarm', 5, 10, 1.1, 1) },
    { slug: 'gravitywell', name: 'Gravity Well', icon: '🌀', rarity: 'epic', cost: 3, role: 'pulling spell', spell: true, instant: true, hp: 0, dmg: 120, cd: 1, range: 0, speed: 0, targets: 'any', proj: 'gravity', splash: 3.5, radius: 0, towerMult: 0.3, deployCd: 1.0, arena: 6,
      zone: { kind: 'pull', dur: 2.2, tick: 0.5, pull: 2.4 },
      desc: 'Drags enemy troops toward its centre for 2 seconds while damaging them. Great for grouping troops or pulling them into tower range.',
      ability: ab('Event Horizon', 6, 12, 1.1, 1) },
    { slug: 'orbitallaser', name: 'Orbital Laser', icon: '🛰️', rarity: 'legendary', cost: 6, role: 'heavy precision strike', spell: true, instant: true, hp: 0, dmg: 480, cd: 1, range: 0, speed: 0, targets: 'any', proj: 'laser', splash: 3.5, radius: 0, towerMult: 0.3, stun: 0.4, deployCd: 1.4, arena: 8,
      zone: { kind: 'laser', delay: 0.9, targets: 3 },
      desc: 'After a short lock-on, beams hit the 3 toughest enemies in the area for heavy damage.',
      ability: ab('Focused Lens', 7, 15, 1.1, 1) },
    { slug: 'boulder', name: 'Boulder Roll', icon: '🪨', rarity: 'rare', cost: 2, role: 'rolling knockback spell', spell: true, instant: true, hp: 0, dmg: 150, cd: 1, range: 0, speed: 0, targets: 'ground', proj: 'boulder', splash: 1.0, radius: 0, towerMult: 0.3, knockback: 1.2, deployCd: 0.9, arena: 3,
      zone: { kind: 'roll', length: 10, speed: 6 },
      desc: 'Rolls 10 tiles toward the enemy, hitting every ground troop in its path once and knocking it back.',
      ability: ab('Avalanche', 5, 10, 1.1, 1) },
    { slug: 'paratroopers', name: 'Paratroopers', icon: '🪂', rarity: 'legendary', cost: 5, role: 'troop-dropping spell', spell: true, instant: true, hp: 0, dmg: 0, cd: 1, range: 0, speed: 0, targets: 'any', proj: 'drop', splash: 2.5, radius: 0, towerMult: 0, deployCd: 1.3, arena: 7,
      zone: { kind: 'spawn', dur: 4.2, count: 6, card: 'paratrooper' },
      desc: 'Drops 6 paratroopers one by one anywhere on the arena, even right on top of an enemy tower.',
      ability: ab('Second Wave', 7, 15, 1.08, 1.08) },

    // Buildings
    { slug: 'flaktower', name: 'Flak Tower', icon: '🎯', rarity: 'rare', cost: 4, role: 'anti-air building', building: true, lifetime: 35, hp: 950, dmg: 115, cd: 0.9, range: 6.5, speed: 0, targets: 'air', proj: 'flak', splash: 1.0, radius: 0.9, deployCd: 1.2, arena: 2,
      desc: 'Shreds flying troops with splash flak. Cannot hit ground troops at all.',
      ability: ab('Proximity Fuse', 5, 10, 1.1, 1.1) },
    { slug: 'infernospire', name: 'Inferno Spire', icon: '🌋', rarity: 'epic', cost: 5, role: 'tank-melting building', building: true, lifetime: 35, hp: 1000, dmg: 22, cd: 0.4, range: 6.0, speed: 0, targets: 'any', proj: 'beam', radius: 0.9, deployCd: 1.3, arena: 5,
      mech: { ramp: 4 },
      desc: 'Its beam heats up the longer it stays on one target, reaching 10× damage after 4 seconds. Stuns and target swaps reset it.',
      ability: ab('Superheat', 6, 12, 1.1, 1.1) },
    { slug: 'mortarbunker', name: 'Mortar Bunker', icon: '💥', rarity: 'rare', cost: 4, role: 'long-range siege building', building: true, lifetime: 30, hp: 800, dmg: 110, cd: 4.5, range: 11.5, minRange: 3.5, speed: 0, targets: 'ground', proj: 'mortar', splash: 1.4, radius: 0.9, deployCd: 1.2, arena: 3,
      desc: 'Lobs slow splash shells 11.5 tiles. Placed near the river it can bombard an enemy tower, but it cannot hit anything close.',
      ability: ab('Heavy Shells', 6, 12, 1.1, 1.1) },
    { slug: 'teslapit', name: 'Tesla Pit', icon: '🗼', rarity: 'epic', cost: 4, role: 'hidden defense', building: true, lifetime: 35, hp: 750, dmg: 85, cd: 1.1, range: 5.5, speed: 0, targets: 'any', proj: 'zap', radius: 0.85, deployCd: 1.2, arena: 6,
      mech: { hide: true },
      desc: 'Hides underground (untargetable except by spells) until an enemy comes in range, then pops up and zaps air and ground.',
      ability: ab('Overcharge Coil', 6, 12, 1.1, 1.1) },
    { slug: 'dronehangar', name: 'Drone Hangar', icon: '🛩️', rarity: 'rare', cost: 5, role: 'air-spawning building', building: true, lifetime: 40, hp: 850, dmg: 0, cd: 1, range: 0, speed: 0, targets: 'none', proj: 'none', radius: 0.95, deployCd: 1.3, arena: 4,
      mech: { spawner: { card: 'hangardrone', every: 4.5, count: 1, onDeath: 1 } },
      desc: 'Launches a flying drone every 4.5 seconds, plus one more when destroyed.',
      ability: ab('Fast Assembly', 6, 12, 1.08, 1.1) },
    { slug: 'bonecrypt', name: 'Bone Crypt', icon: '⚰️', rarity: 'common', cost: 3, role: 'distraction spawner', building: true, lifetime: 35, hp: 450, dmg: 0, cd: 1, range: 0, speed: 0, targets: 'none', proj: 'none', radius: 0.85, deployCd: 1.1, arena: 1,
      mech: { spawner: { card: 'cryptskel', every: 2.9, count: 1, onDeath: 3 } },
      desc: 'Raises a skeleton every 2.9 seconds and 3 more when destroyed. Cheap bait for tanks and win conditions.',
      ability: ab('Restless Dead', 5, 10, 1.08, 1.1) },
    { slug: 'elixirpump', name: 'Elixir Pump', icon: '⛽', rarity: 'legendary', cost: 6, role: 'elixir generator', building: true, lifetime: 63, hp: 750, dmg: 0, cd: 1, range: 0, speed: 0, targets: 'none', proj: 'none', radius: 0.9, deployCd: 1.4, arena: 5,
      mech: { elixir: { every: 9, amount: 1, onDeath: 1 } },
      desc: 'Pumps 1 elixir every 9 seconds (7 over its life) and 1 more when destroyed. Pays off only if it survives.',
      ability: ab('Pressure Valve', 7, 15, 1, 1.1) },
    { slug: 'sirenbeacon', name: 'Siren Beacon', icon: '🚨', rarity: 'rare', cost: 3, role: 'taunt building', building: true, lifetime: 25, hp: 1800, dmg: 0, cd: 1, range: 0, speed: 0, targets: 'none', proj: 'none', radius: 0.9, deployCd: 1.1, arena: 4,
      mech: { taunt: 6.5 },
      desc: 'A loud, sturdy decoy. Enemy troops within 6.5 tiles drop what they are doing and attack it.',
      ability: ab('Louder Siren', 5, 10, 1, 1.12) },

    // Troops
    { slug: 'medicbot', name: 'Medic Bot', icon: '🩺', rarity: 'rare', cost: 4, role: 'healing support', hp: 450, dmg: 35, cd: 1.2, range: 3.5, speed: 1.0, targets: 'any', proj: 'spark', radius: 0.5, deployCd: 1.2, arena: 4,
      mech: { heal: { radius: 3.0, perSec: 26 } },
      desc: 'Heals nearby friendly troops by 26 HP per second while plinking at enemies.',
      ability: ab('Triage', 6, 12, 1.05, 1.1) },
    { slug: 'rocktitan', name: 'Rock Titan', icon: '🗿', rarity: 'legendary', cost: 8, role: 'giant building-buster', hp: 2000, dmg: 110, cd: 1.5, range: 0.6, speed: 0.6, targets: 'buildings', proj: 'melee', radius: 0.9, deployCd: 1.8, arena: 8,
      mech: { deathSpawn: { card: 'rockshard', count: 2 }, deathSplash: { radius: 2, dmg: 140 } },
      desc: 'Enormous and slow. Only attacks buildings. When it falls it shatters, damaging nearby enemies and splitting into 2 Rock Shards.',
      ability: ab('Bedrock', 7, 15, 1.06, 1.12) },
    { slug: 'teslatank', name: 'Tesla Tank', icon: '🔋', rarity: 'legendary', cost: 6, role: 'charged splash cannon', hp: 850, dmg: 260, cd: 5.0, range: 4.5, speed: 0.75, targets: 'ground', proj: 'pulse', splash: 1.5, radius: 0.7, deployCd: 1.5, arena: 5,
      mech: { chargeShot: true },
      desc: 'Charges a devastating splash blast every 5 seconds. Stuns and freezes reset its charge.',
      ability: ab('Capacitor Bank', 7, 15, 1.12, 1.06) },
    { slug: 'shieldknight', name: 'Shield Knight', icon: '🤺', rarity: 'rare', cost: 4, role: 'shielded melee', hp: 560, dmg: 90, cd: 1.2, range: 0.6, speed: 1.0, targets: 'ground', proj: 'melee', radius: 0.55, deployCd: 1.2, arena: 2,
      mech: { shield: 280 },
      desc: 'Carries a 280 HP shield that soaks damage first. Once the shield breaks, extra damage from that hit is lost.',
      ability: ab('Tower Shield', 6, 12, 1.05, 1.12) },
    { slug: 'stormzeppelin', name: 'Storm Zeppelin', icon: '🎈', rarity: 'legendary', cost: 7, role: 'flying tank', air: true, hp: 1750, dmg: 40, cd: 1.3, range: 2.5, speed: 0.75, targets: 'buildings', proj: 'spark', radius: 0.85, deployCd: 1.7, arena: 7,
      mech: { deathSpawn: { card: 'stormsprite', count: 4 } },
      desc: 'A huge flying tank that heads for buildings. When it pops, 4 Storm Sprites burst out and attack everything.',
      ability: ab('Thunderhead', 7, 15, 1.06, 1.12) },
    { slug: 'cryocaster', name: 'Cryo Caster', icon: '🧊', rarity: 'epic', cost: 4, role: 'slowing splash caster', hp: 370, dmg: 60, cd: 1.4, range: 5.0, speed: 1.0, targets: 'any', proj: 'ice', splash: 1.0, radius: 0.45, deployCd: 1.2, arena: 2,
      mech: { slowOnHit: { mult: 0.7, dur: 2.5 } },
      desc: 'Ice shards splash air and ground and slow whatever they hit by 30% for 2.5 seconds.',
      ability: ab('Permafrost', 6, 12, 1.1, 1.06) },
    { slug: 'phantomrider', name: 'Phantom Rider', icon: '👻', rarity: 'legendary', cost: 3, role: 'dashing assassin', hp: 380, dmg: 75, cd: 1.0, range: 0.5, speed: 1.5, targets: 'ground', proj: 'melee', radius: 0.45, deployCd: 1.0, arena: 6,
      mech: { dash: { min: 2.5, max: 6, speed: 10, cd: 3.5 } },
      desc: 'Dashes at targets 2.5 to 6 tiles away, untouchable during the dash, and hits for double damage when it lands.',
      ability: ab('Shadow Step', 7, 15, 1.1, 1.08) },
    { slug: 'flakgunner', name: 'Flak Gunner', icon: '🔭', rarity: 'common', cost: 3, role: 'anti-air troop', hp: 430, dmg: 105, cd: 0.9, range: 5.5, speed: 1.0, targets: 'air', proj: 'flak', splash: 0.8, radius: 0.45, deployCd: 1.0, arena: 1,
      desc: 'Shoots only flying troops, with splash. Holds its ground when no air target is in sight.',
      ability: ab('Tracer Rounds', 5, 10, 1.1, 1.08) },
    { slug: 'boomerang', name: 'Boomerang Bot', icon: '🪃', rarity: 'epic', cost: 5, role: 'piercing thrower', hp: 650, dmg: 70, cd: 2.4, range: 4.0, speed: 1.0, targets: 'ground', proj: 'blade', radius: 0.55, deployCd: 1.3, arena: 6,
      mech: { pierce: 1.5 },
      desc: 'Throws a blade that flies through every ground enemy in a line and back again, hitting each one twice.',
      ability: ab('Razor Edge', 6, 12, 1.1, 1.08) },
    { slug: 'moledriller', name: 'Mole Driller', icon: '🦫', rarity: 'epic', cost: 3, role: 'tunnelling raider', hp: 560, dmg: 80, cd: 1.2, range: 0.5, speed: 1.5, targets: 'ground', proj: 'melee', radius: 0.45, deployCd: 1.1, arena: 3,
      anywhere: true, crownMult: 0.35,
      desc: 'Can be deployed anywhere on the arena. Tunnels in (takes a little longer on the enemy side) and deals only 35% damage to crown towers.',
      ability: ab('Diamond Claws', 6, 12, 1.1, 1.08) },
    { slug: 'sparkspirit', name: 'Spark Spirit', icon: '✨', rarity: 'common', cost: 1, role: 'stunning kamikaze', hp: 90, dmg: 55, cd: 1.0, range: 2.0, speed: 2.0, targets: 'any', proj: 'melee', radius: 0.35, special: 'kamikaze', deployCd: 0.8, arena: 1,
      mech: { zap: { chain: 3, radius: 2.5, stun: 0.5 } },
      desc: 'Leaps onto an enemy, then arcs to up to 3 more nearby, stunning each for half a second.',
      ability: ab('Static Leap', 5, 10, 1.1, 1.1) },
  ];

  // Token units: spawned by other cards, never in a deck or the collection
  const TOKENS = [
    { slug: 'paratrooper', name: 'Paratrooper', icon: '🪖', rarity: 'common', cost: 0, role: 'dropped trooper', hp: 75, dmg: 55, cd: 1.0, range: 0.5, speed: 1.5, targets: 'ground', proj: 'melee', radius: 0.35 },
    { slug: 'hangardrone', name: 'Hangar Drone', icon: '🚁', rarity: 'common', cost: 0, role: 'spawned drone', air: true, hp: 110, dmg: 38, cd: 1.0, range: 2.5, speed: 1.6, targets: 'any', proj: 'spark', radius: 0.35 },
    { slug: 'cryptskel', name: 'Skeleton', icon: '💀', rarity: 'common', cost: 0, role: 'spawned skeleton', hp: 55, dmg: 50, cd: 1.0, range: 0.5, speed: 1.5, targets: 'ground', proj: 'melee', radius: 0.32 },
    { slug: 'rockshard', name: 'Rock Shard', icon: '🧱', rarity: 'common', cost: 0, role: 'titan fragment', hp: 650, dmg: 65, cd: 1.5, range: 0.6, speed: 0.75, targets: 'buildings', proj: 'melee', radius: 0.6 },
    { slug: 'bonegiant', name: 'Bone Giant', icon: '☠️', rarity: 'common', cost: 0, role: 'crypt guardian', hp: 520, dmg: 90, cd: 1.4, range: 0.6, speed: 0.9, targets: 'ground', proj: 'melee', radius: 0.6 },
    { slug: 'stormsprite', name: 'Storm Sprite', icon: '🌩', rarity: 'common', cost: 0, role: 'zeppelin sprite', air: true, hp: 110, dmg: 42, cd: 1.2, range: 2.0, speed: 1.5, targets: 'any', proj: 'spark', splash: 0.8, radius: 0.35 },
  ];

  // Which Trophy Road arena (0-9) unlocks each original card into chests and rewards.
  // Variants unlock with their base card (Mk-II), one arena later (Twin, Burst) or two (Core).
  const BASE_ARENA = {
    scout: 0, brawler: 0, siege: 0, guardian: 0, voltbug: 0, drillcat: 0, ramhog: 0, flarepod: 0,
    boltturret: 0, firebomb: 0, shock: 0, rocketrain: 0, junkpack: 0, mechmice: 0, antmarch: 0,
    scrapbots: 1, crickethop: 1, beeblitz: 1, bugsquad: 1,
    lizarddash: 2, nanodrones: 2, toadtroop: 2,
    wolfpack: 3, zombiemob: 3,
    hawkstrike: 4, crackergang: 4, mortarfox: 4,
    goblinbikers: 5, flybombers: 5,
    rabbitrush: 6, raylance: 6,
    ufofleet: 7, dustdevils: 7,
    bombbeetles: 8, makoswarm: 8,
  };
  const VARIANT_ARENA_SHIFT = [0, 0, 1, 1, 2];

  // ─── Card Evolutions ─────────────────────────────────────────────────────
  //
  // An Evolution is an upgraded form of a card family (keyed by slug, so it covers that card's
  // Mk-II/Twin/Burst/Core variants too). It changes how the card behaves, not just its numbers.
  //
  //   cycles   normal plays needed before the next play comes out evolved (then it resets)
  //   hp/dmg   small stat multipliers for the evolved form (most stay at 1)
  //   mech     troop/building mechanics, handled by the evolution hooks (see "Evolution mechanics")
  //   spell    spell mechanics, handled in castSpell
  //   counter  how an opponent beats it (shown in the collection)
  //
  // To add one: add an entry here, reuse an existing mechanic or add a new one to the hooks,
  // and add a test. See CLASH_TANKS.md, "Adding an Evolution".
  const EVO_RULES = {
    slots: { pvp: 2, ai: 2, online: 2 },   // evolution slots per deck, per mode
    maxSlots: 2,                           // the engine never allows more than this
    startCharged: false,                   // true = the first play of an evolved card is already evolved
  };

  const EVOLUTIONS = {
    brawler: {
      name: 'Juggernaut', cycles: 2, hp: 1.08, dmg: 1, role: 'melee', theme: 'steel',
      ability: 'Quake Fist',
      desc: 'Every 3rd punch slams the ground: splash damage around its target and a shockwave that knocks ground troops back.',
      counter: 'Fight it with ranged or air troops, or spread out. The quake only hits ground troops near its target.',
      mech: { shockwave: { every: 3, radius: 1.6, dmgMult: 0.6, knock: 1.0 } },
    },
    drillcat: {
      name: 'Diamond Drill', cycles: 1, hp: 1, dmg: 1, role: 'melee', theme: 'diamond',
      ability: 'Bore Through',
      desc: 'Each hit in a row on the same target drills 45% deeper (up to +135%). Switching targets or being stunned resets the drill.',
      counter: 'Distract it with cheap troops or a building to force target swaps; stuns and freezes reset the drill.',
      mech: { stackHits: { per: 0.45, max: 3 } },
    },
    guardian: {
      name: 'Bastion', cycles: 2, hp: 1, dmg: 1, role: 'tank', theme: 'shield',
      ability: 'Aegis Pulse',
      desc: 'When it lands and every 8 seconds, wraps the 4 nearest other friendly troops in a 110 HP energy shield, on top of its damage-reduction aura.',
      counter: 'Splash damage and spells strip shields fast. Kill the Bastion and the shields stop coming.',
      mech: { allyShield: { every: 8, amount: 110, radius: 3, max: 4 } },
    },
    siege: {
      name: 'Earthshaker', cycles: 2, hp: 1, dmg: 1, role: 'tank', theme: 'quake',
      ability: 'Crater Shells',
      desc: 'Every shell leaves a crater for 3 seconds that slows enemy troops and buildings in it by 50%.',
      counter: 'Flyers ignore craters. Swarm it up close, or freeze it.',
      mech: { impactZone: { kind: 'slow', slow: 0.5, dur: 3, radius: 1.8 } },
    },
    voltbug: {
      name: 'Storm Bug', cycles: 1, hp: 1, dmg: 1, role: 'ranged', theme: 'storm',
      ability: 'Thunderhead',
      desc: 'Its lightning arcs to 3 more enemies (instead of 2), and the first target is jolted for 0.25 s, cancelling its wind-up.',
      counter: 'Tanky single troops shrug it off; spread swarms so the arc runs out of jumps.',
      mech: { chain: { count: 3, stunPrimary: 0.25 } },
    },
    raylance: {
      name: 'Prism Lance', cycles: 2, hp: 1, dmg: 1, role: 'ranged', theme: 'prism',
      ability: 'Refraction',
      desc: 'Its beam pierces in a straight line to full range, hitting every enemy (air or ground) in the way. Enemies behind the first take 60%.',
      counter: 'Come at it from the side instead of in a line, or dive it with fast melee.',
      mech: { pierceLine: { width: 0.55, falloff: 0.6 } },
    },
    flarepod: {
      name: 'Cluster Pod', cycles: 2, hp: 1, dmg: 0.9, role: 'ranged', theme: 'ember',
      ability: 'Scatter Shot',
      desc: 'Each fireball bursts into 3 bomblets that scatter around the impact. No enemy can be hit by more than one bomblet per shot.',
      counter: 'Tanks barely notice the bomblets. Reach it with a fast troop or a spell.',
      mech: { cluster: { count: 3, spread: 1.5, dmgMult: 0.4, radius: 0.9 } },
    },
    junkpack: {
      name: 'Scrap Rally', cycles: 1, hp: 1, dmg: 1, role: 'swarm', theme: 'rage',
      ability: 'Grudge',
      desc: 'When a pack member falls, the survivors fight harder: +35% move and attack speed per fallen member, up to 2 stacks.',
      counter: 'Splash that kills the whole pack at once denies the rally.',
      mech: { rally: { per: 0.35, max: 2 } },
    },
    hawkstrike: {
      name: 'Dive Hawks', cycles: 2, hp: 1, dmg: 1, role: 'air', theme: 'sky',
      ability: 'Talon Dive',
      desc: 'Each hawk opens on a new target with a diving strike for 2.5× damage, then has to climb for 4 seconds before it can dive again.',
      counter: 'Anti-air splash (Flak, Flare Pod, Rocket Rain) catches the flock. Feed it a cheap decoy to waste the dives.',
      mech: { dive: { mult: 2.5, cd: 4 } },
    },
    boltturret: {
      name: 'Arc Turret', cycles: 1, hp: 1, dmg: 1, role: 'building', theme: 'arc',
      ability: 'Discharge',
      desc: 'Every 3rd shot also releases an electric pulse that damages and knocks back ground troops within 2.5 tiles.',
      counter: 'Building-only troops and flyers ignore the pulse; tanks soak it. Spell it from range.',
      mech: { pulse: { every: 3, radius: 2.5, dmgMult: 0.9, knock: 1.1 } },
    },
    bonecrypt: {
      name: 'Crypt of Legions', cycles: 1, hp: 1, dmg: 1, role: 'building', theme: 'bone',
      ability: 'Last Rites',
      desc: 'When destroyed or expired, a Bone Giant (520 HP) bursts out instead of 3 skeletons.',
      counter: 'Let it expire somewhere useless, or be ready for the Giant with a high-damage troop.',
      mech: { deathSummon: { card: 'bonegiant', count: 1, replaces: true } },
    },
    medicbot: {
      name: 'Field Surgeon', cycles: 1, hp: 1.1, dmg: 1, role: 'support', theme: 'medic',
      ability: 'Triage',
      desc: 'Heals badly hurt allies (under 40% HP) 2.2× faster, removes slows from allies and makes stuns and freezes on them wear off faster.',
      counter: 'Burst the push down fast, or snipe the Surgeon first: even evolved it is a 500 HP backliner.',
      mech: { cleanse: true, triage: { below: 0.4, mult: 2.2 } },
    },
    firebomb: {
      name: 'Napalm Bomb', cycles: 2, role: 'spell', theme: 'napalm',
      ability: 'Burning Ground',
      desc: 'After the blast, the ground burns for 3 seconds, dealing another 35% of the damage to enemies standing in it (towers 30%).',
      counter: 'Move troops out of the fire; fast units cross it quickly.',
      spell: { afterZone: { kind: 'dot', dur: 3, tick: 0.5, dmgMult: 0.35, radius: 2.0 } },
    },
    shock: {
      name: 'Overload', cycles: 2, role: 'spell', theme: 'storm',
      ability: 'Aftershock',
      desc: '0.8 s after the zap, a second pulse hits the same spot for 60% damage and a longer 0.8 s stun.',
      counter: 'Troops that walk out of the circle in time escape the aftershock.',
      spell: { echo: { delay: 0.8, dmgMult: 0.6, stun: 0.8 } },
    },
    rocketrain: {
      name: 'Homing Barrage', cycles: 2, role: 'spell', theme: 'rocket',
      ability: 'Lock-On',
      desc: 'Fires 6 rockets that each lock on to a different enemy in the area (spares fly to the centre). Small splash, great against scattered troops.',
      counter: 'Tough troops take little from each rocket; it can only lock on to what is in the circle when it is cast.',
      spell: { seek: { count: 6, dmgMult: 0.3, radius: 1.2 } },
    },
  };
  const MAX_ARENA = 9;

  // One-line descriptions for the original cards (the newer ones carry their own)
  const BASE_DESC = {
    scout: 'Fast, cheap raider that ignores troops and goes straight for buildings and towers.',
    brawler: 'Sturdy melee tank that hits ground troops and buildings.',
    siege: 'Slow, heavy cannon that shells buildings and towers from 5 tiles away.',
    guardian: 'Tough frontliner that shields nearby allies, cutting the damage they take by 25%.',
    voltbug: 'Ranged zapper whose lightning chains to 2 more enemies.',
    flarepod: 'Splash caster that lobs fire at air and ground groups.',
    drillcat: 'Hits very hard and slowly. Melts tanks and buildings up close.',
    raylance: 'Long-range sniper beam that can hit air and ground.',
    mortarfox: 'Artillery with huge range and splash, but it cannot hit anything within 2.5 tiles.',
    ramhog: 'Jumps the river and charges buildings for double damage.',
    junkpack: 'Three scrappy melee bots. Good value against single targets.',
    bugsquad: 'Four fragile ranged bugs that can hit air.',
    mechmice: 'Two very fast, cheap biters for cycling and chip damage.',
    goblinbikers: 'Five fast bikers that race at buildings and towers.',
    nanodrones: 'Three flying drones that zap air and ground.',
    bombbeetles: 'Six beetles that explode on contact with heavy splash.',
    antmarch: 'Three tiny, cheap ants. Distract and swarm.',
    crickethop: 'Two crickets that hop the river anywhere.',
    beeblitz: 'Four fast flying stingers. Fragile but hard to catch.',
    scrapbots: 'Three sturdy, slow melee bots.',
    lizarddash: 'Three fast melee lizards.',
    toadtroop: 'Three ranged toads with small splash.',
    wolfpack: 'Three strong, fast melee wolves.',
    zombiemob: 'Five slow, tough zombies that soak damage.',
    hawkstrike: 'Three fast flying hunters that hit air and ground.',
    crackergang: 'Four ranged gang members with long reach.',
    flybombers: 'Five flying bombers that hit buildings and drop a bomb when they die.',
    rabbitrush: 'Five fast rabbits that hop the river and rush buildings.',
    ufofleet: 'Four flying saucers that beam buildings from range.',
    dustdevils: 'Three spinners whose attacks hit everything around them.',
    makoswarm: 'Six heavy melee sharks. A huge, expensive horde.',
    boltturret: 'Defensive cannon building that pulls and shoots ground troops.',
    firebomb: 'Flies from your King Tower and blasts a cluster, knocking troops back.',
    shock: 'Instant zap that stuns everything for a moment and resets charges.',
    rocketrain: 'Three waves of rockets over a wide area. Clears swarms.',
  };

  // Variants scale the base unit; the pricier ones change how the unit attacks.
  const VARIANTS = [
    { suffix: 'Mk-I', hp: 1, dmg: 1, range: 0, speed: 0, cost: 0, cd: 1, deployCd: 0, rarityShift: 0, style: null },
    { suffix: 'Mk-II', hp: 1.06, dmg: 1.06, range: 0.3, speed: 0.05, cost: 0, cd: 0.97, deployCd: -0.05, rarityShift: 0, style: null },
    { suffix: 'Twin', hp: 0.94, dmg: 1.04, range: 0.5, speed: -0.05, cost: 1, cd: 1.02, deployCd: 0.03, rarityShift: 1, style: 'double' },
    { suffix: 'Burst', hp: 0.92, dmg: 1.08, range: 0, speed: 0, cost: 1, cd: 0.9, deployCd: -0.08, rarityShift: 1, style: 'burst' },
    { suffix: 'Core', hp: 1.12, dmg: 1.1, range: 0.3, speed: -0.1, cost: 1, cd: 1.08, deployCd: 0.08, rarityShift: 2, style: 'splash' },
  ];

  const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'champion'];

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function r2(v) { return Math.round(v * 100) / 100; }
  function rarityShift(base, shift) {
    const i = RARITY_ORDER.indexOf(base);
    return RARITY_ORDER[clamp(i + shift, 0, RARITY_ORDER.length - 1)] || base;
  }

  function makeCard(a, v, idx, token) {
    const id = idx === 0 ? a.slug : `${a.slug}-${v.suffix.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const style = v.style || a.style || 'single';
    const melee = a.proj === 'melee';
    const baseArena = a.arena != null ? a.arena : (BASE_ARENA[a.slug] || 0);
    return {
      id,
      slug: a.slug,
      name: idx === 0 ? a.name : `${a.name} ${v.suffix}`,
      icon: a.icon,
      rarity: rarityShift(a.rarity, v.rarityShift),
      cost: clamp(a.cost + v.cost, token ? 0 : 1, 9),
      hp: Math.round(a.hp * v.hp),
      dmg: Math.round(a.dmg * v.dmg),
      cd: r2(Math.max(0.4, a.cd * v.cd)),
      range: r2(a.range + (melee ? 0 : v.range)),
      minRange: a.minRange || 0,
      speed: a.building ? 0 : r2(Math.max(0.5, a.speed + v.speed)),
      sight: Math.max(5.5, a.range + 1.5),
      targets: a.targets,
      air: !!a.air,
      building: !!a.building,
      lifetime: a.lifetime || 0,
      splash: Math.max(a.splash || 0, style === 'splash' ? 1.0 : 0),
      style,
      proj: a.proj,
      role: a.role,
      radius: a.radius,
      swarmCount: a.count || 1,
      special: a.special || '',
      structureMult: a.structureMult || 1,
      crownMult: a.crownMult || 1,
      deployCd: Math.max(0.7, (a.deployCd || 1) + v.deployCd),
      winCondition: a.targets === 'buildings' || !!a.anywhere,
      ability: a.ability || null,
      spell: !!a.spell,
      instant: !!a.instant,
      friendly: !!a.friendly,
      zone: a.zone || null,
      freeze: a.freeze || 0,
      towerMult: a.towerMult != null ? a.towerMult : 1,
      knockback: a.knockback || 0,
      stun: a.stun || 0,
      waves: a.waves || 1,
      anywhere: !!a.anywhere,
      mech: a.mech || null,
      arena: Math.min(MAX_ARENA, baseArena + (VARIANT_ARENA_SHIFT[idx] || 0)),
      variant: idx,
      solo: !!(a.spell || a.arena != null),
      token: !!token,
      desc: a.desc || BASE_DESC[a.slug] || '',
    };
  }

  function buildCards() {
    const cards = [];
    ARCHETYPES.forEach((a) => {
      // Spells and the Trophy Road cards come in one version only
      const solo = a.spell || a.arena != null;
      VARIANTS.forEach((v, idx) => {
        if (solo && idx > 0) return;
        cards.push(makeCard(a, v, idx, false));
      });
    });
    return cards;
  }

  const CARD_LIBRARY = buildCards();
  const TOKEN_CARDS = TOKENS.map((t) => makeCard(t, VARIANTS[0], 0, true));
  // CARD_MAP includes tokens (the renderer needs their icons); CARD_LIBRARY does not
  const CARD_MAP = Object.fromEntries(CARD_LIBRARY.concat(TOKEN_CARDS).map((c) => [c.id, c]));
  const STARTER_DECK = ['scout', 'brawler', 'siege', 'guardian', 'voltbug', 'drillcat', 'ramhog', 'flarepod'];
  const MAX_DECK = 8;

  function getCardStatsAtLevel(id, level, abilityUnlocked, mastery) {
    const card = CARD_MAP[id];
    if (!card) return null;
    const lvl = clamp(level || 1, 1, 14);
    const scale = 1 + (lvl - 1) * 0.075;
    const abilityReady = !!abilityUnlocked && !!card.ability && lvl >= card.ability.minLevel && (mastery || 0) >= card.ability.minMastery;
    return {
      ...card,
      level: lvl,
      lvlScale: scale,
      hpScaled: Math.round(card.hp * scale * (abilityReady ? card.ability.hpBoost : 1)),
      dmgScaled: +(card.dmg * scale * (abilityReady ? card.ability.dmgBoost : 1)).toFixed(2),
      deployCdScaled: Math.max(0.62, card.deployCd - (lvl - 1) * 0.02),
      abilityReady,
    };
  }

  // Tower stats from the player's building levels (multipliers are for AI tuning)
  function towerStats(towerLevel, kingLevel, mults) {
    const tl = clamp(Math.floor(towerLevel || 1), 1, 20);
    const kl = clamp(Math.floor(kingLevel || 1), 1, 20);
    const m = mults || {};
    return {
      princessHp: Math.round((840 + (tl - 1) * 60) * (m.tower || 1)),
      princessDmg: 30 + (tl - 1) * 2,
      kingHp: Math.round((1300 + (kl - 1) * 120) * (m.king || 1)),
      kingDmg: 34 + (kl - 1) * 2,
    };
  }

  // Accepts ['id', ...] or [{ id, level, abilityUnlocked, mastery }, ...]; drops unknown
  // cards and duplicates, caps at 8, and falls back to the starter deck if nothing is valid.
  function evolutionOf(cardId) {
    const c = CARD_MAP[cardId];
    return c && !c.token ? EVOLUTIONS[c.slug] || null : null;
  }

  /**
   * Accepts ['id', ...] or [{ id, level, abilityUnlocked, mastery, evo }, ...]. `evo: true` equips the
   * card's Evolution; only cards that have one keep the flag, and at most `evoSlots` of them do.
   */
  function normalizeDeck(raw, evoSlots) {
    const out = [];
    const seen = new Set();
    const slots = clamp(Math.floor(evoSlots == null ? EVO_RULES.maxSlots : evoSlots), 0, EVO_RULES.maxSlots);
    let evos = 0;
    (Array.isArray(raw) ? raw : []).forEach((entry) => {
      if (out.length >= MAX_DECK || !entry) return;
      const e = typeof entry === 'string' ? { id: entry } : entry;
      const id = String(e.id || '');
      if (!CARD_MAP[id] || CARD_MAP[id].token || seen.has(id)) return;
      seen.add(id);
      const evo = !!e.evo && !!evolutionOf(id) && evos < slots;
      if (evo) evos++;
      out.push({
        id,
        level: clamp(Math.floor(Number(e.level) || 1), 1, 14),
        abilityUnlocked: !!e.abilityUnlocked,
        mastery: Math.max(0, Number(e.mastery) || 0),
        evo,
      });
    });
    if (out.length === 0) return STARTER_DECK.map((id) => ({ id, level: 1, abilityUnlocked: false, mastery: 0, evo: false }));
    return out;
  }

  // ─── Small helpers ───────────────────────────────────────────────────────

  function enemyOf(side) { return side === 'A' ? 'B' : 'A'; }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  // Distance from a point to a tower's square footprint
  function boxDist(px, py, t) {
    const dx = Math.max(Math.abs(px - t.x) - t.half, 0);
    const dy = Math.max(Math.abs(py - t.y) - t.half, 0);
    return Math.hypot(dx, dy);
  }
  // Gap between two bodies (negative when overlapping). Towers are squares, everything else circles.
  function edgeDist(a, b) {
    if (b.kind === 'tower') return boxDist(a.x, a.y, b) - a.radius;
    if (a.kind === 'tower') return boxDist(b.x, b.y, a) - b.radius;
    return dist(a.x, a.y, b.x, b.y) - a.radius - b.radius;
  }
  // How far from a target's centre a unit can stand and still be in range
  function targetExtent(t) { return t.kind === 'tower' ? t.half : t.radius; }

  // A spot just inside attack range, on the side of the target facing the unit
  function approachPoint(u, t) {
    const g = Math.max(0.05, u.range + u.radius - 0.15);
    let bx = t.x;
    let by = t.y;
    let pad = t.radius + g;
    if (t.kind === 'tower') {
      bx = clamp(u.x, t.x - t.half, t.x + t.half);
      by = clamp(u.y, t.y - t.half, t.y + t.half);
      pad = g;
    }
    const dx = u.x - bx;
    const dy = u.y - by;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) return { x: bx, y: by + (u.owner === 'A' ? pad : -pad) };
    return { x: bx + (dx / d) * pad, y: by + (dy / d) * pad };
  }

  // Deterministic RNG so the same inputs replay the same match
  function nextRandom(state) {
    let t = (state.seed = (state.seed + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function pushFx(state, fx) {
    if (state.fx.length < 300) state.fx.push(fx);
  }

  // ─── Navigation grid ─────────────────────────────────────────────────────
  //
  // Half-tile grid over the arena. River cells (outside the bridges) are blocked for
  // ground units unless they can jump; tower and building footprints are blocked for
  // all ground units. Paths come from A* and are then smoothed with line-of-sight checks.

  const NAV_CELL = 0.5;
  const COLS = W / NAV_CELL;
  const ROWS = H / NAV_CELL;
  const NAV_N = COLS * ROWS;
  const OBSTACLE_MARGIN = 0.15;

  function isRiverPoint(x, y) {
    if (y < RIVER.y0 || y >= RIVER.y1) return false;
    return !BRIDGES.some((b) => x > b.x0 && x < b.x1);
  }

  function createNav() {
    const nav = {
      river: new Uint8Array(NAV_N),
      blocked: new Uint8Array(NAV_N),
      version: 0,
      g: new Float32Array(NAV_N),
      from: new Int32Array(NAV_N),
      seen: new Uint32Array(NAV_N),
      closed: new Uint32Array(NAV_N),
      search: 0,
    };
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        nav.river[r * COLS + c] = isRiverPoint((c + 0.5) * NAV_CELL, (r + 0.5) * NAV_CELL) ? 1 : 0;
      }
    }
    return nav;
  }

  function rebuildObstacles(state) {
    const nav = state.nav;
    nav.blocked.fill(0);
    const mark = (cx, cy, half, round) => {
      const reach = half + OBSTACLE_MARGIN;
      const c0 = Math.max(0, Math.floor((cx - reach) / NAV_CELL));
      const c1 = Math.min(COLS - 1, Math.floor((cx + reach) / NAV_CELL));
      const r0 = Math.max(0, Math.floor((cy - reach) / NAV_CELL));
      const r1 = Math.min(ROWS - 1, Math.floor((cy + reach) / NAV_CELL));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const px = (c + 0.5) * NAV_CELL;
          const py = (r + 0.5) * NAV_CELL;
          const inside = round
            ? dist(px, py, cx, cy) <= reach
            : Math.abs(px - cx) <= reach && Math.abs(py - cy) <= reach;
          if (inside) nav.blocked[r * COLS + c] = 1;
        }
      }
    };
    state.towers.forEach((t) => { if (t.hp > 0) mark(t.x, t.y, t.half, false); });
    state.units.forEach((u) => { if (u.building && u.hp > 0) mark(u.x, u.y, u.radius, true); });
    nav.version++;
  }

  function cellIndex(x, y) {
    const c = Math.floor(x / NAV_CELL);
    const r = Math.floor(y / NAV_CELL);
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return -1;
    return r * COLS + c;
  }

  function walkableCell(nav, idx, jump) {
    if (idx < 0) return false;
    if (nav.blocked[idx]) return false;
    if (nav.river[idx] && !jump) return false;
    return true;
  }

  function walkablePoint(nav, x, y, jump) {
    if (x < 0.25 || y < 0.25 || x > W - 0.25 || y > H - 0.25) return false;
    return walkableCell(nav, cellIndex(x, y), jump);
  }

  function lineClear(nav, x0, y0, x1, y1, jump) {
    const d = dist(x0, y0, x1, y1);
    const steps = Math.max(1, Math.ceil(d / 0.25));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!walkablePoint(nav, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, jump)) return false;
    }
    return true;
  }

  // Binary min-heap of cell indices keyed by f-score
  function makeHeap() {
    const items = [];
    const keys = [];
    return {
      size: () => items.length,
      push(item, key) {
        items.push(item); keys.push(key);
        let i = items.length - 1;
        while (i > 0) {
          const p = (i - 1) >> 1;
          if (keys[p] <= keys[i]) break;
          [items[p], items[i]] = [items[i], items[p]];
          [keys[p], keys[i]] = [keys[i], keys[p]];
          i = p;
        }
      },
      pop() {
        const top = items[0];
        const lastItem = items.pop();
        const lastKey = keys.pop();
        if (items.length > 0) {
          items[0] = lastItem; keys[0] = lastKey;
          let i = 0;
          for (;;) {
            const l = i * 2 + 1;
            const r = l + 1;
            let m = i;
            if (l < items.length && keys[l] < keys[m]) m = l;
            if (r < items.length && keys[r] < keys[m]) m = r;
            if (m === i) break;
            [items[m], items[i]] = [items[i], items[m]];
            [keys[m], keys[i]] = [keys[i], keys[m]];
            i = m;
          }
        }
        return top;
      },
    };
  }

  const NEIGHBORS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

  // A* from (sx,sy) to any cell where a body of `radius` would be within `range` of `target`.
  // Returns smoothed waypoints or null.
  function findPath(state, sx, sy, target, range, radius, jump) {
    const tx = target.x;
    const ty = target.y;
    const far = range + radius + targetExtent(target) * Math.SQRT2;
    const nav = state.nav;
    let start = cellIndex(sx, sy);
    if (!walkableCell(nav, start, jump)) start = nearestWalkableCell(nav, sx, sy, jump);
    if (start < 0) return null;

    nav.search++;
    const s = nav.search;
    const heap = makeHeap();
    const cellX = (idx) => ((idx % COLS) + 0.5) * NAV_CELL;
    const cellY = (idx) => (Math.floor(idx / COLS) + 0.5) * NAV_CELL;
    const h = (idx) => Math.max(0, dist(cellX(idx), cellY(idx), tx, ty) - far);
    const isGoal = (idx) => edgeDist({ x: cellX(idx), y: cellY(idx), radius, kind: 'troop' }, target) <= range - 0.02;
    nav.g[start] = 0;
    nav.from[start] = -1;
    nav.seen[start] = s;
    heap.push(start, h(start));
    let goal = -1;
    let expansions = 0;
    while (heap.size() > 0 && expansions < 3000) {
      const cur = heap.pop();
      if (nav.closed[cur] === s) continue;
      nav.closed[cur] = s;
      expansions++;
      if (isGoal(cur)) { goal = cur; break; }
      const cc = cur % COLS;
      const cr = Math.floor(cur / COLS);
      for (const [dc, dr, cost] of NEIGHBORS) {
        const nc = cc + dc;
        const nr = cr + dr;
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
        const ni = nr * COLS + nc;
        if (!walkableCell(nav, ni, jump)) continue;
        // No cutting corners past blocked cells
        if (dc && dr && (!walkableCell(nav, cr * COLS + nc, jump) || !walkableCell(nav, nr * COLS + cc, jump))) continue;
        const g = nav.g[cur] + cost * NAV_CELL;
        if (nav.seen[ni] === s && g >= nav.g[ni]) continue;
        nav.seen[ni] = s;
        nav.g[ni] = g;
        nav.from[ni] = cur;
        heap.push(ni, g + h(ni));
      }
    }
    if (goal < 0) return null;

    const cells = [];
    for (let i = goal; i >= 0; i = nav.from[i]) cells.push(i);
    cells.reverse();
    const pts = cells.map((i) => ({ x: ((i % COLS) + 0.5) * NAV_CELL, y: (Math.floor(i / COLS) + 0.5) * NAV_CELL }));
    // String-pull: keep only the waypoints needed to stay on walkable ground
    const out = [];
    let ax = sx;
    let ay = sy;
    let i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !lineClear(nav, ax, ay, pts[j].x, pts[j].y, jump)) j--;
      out.push(pts[j]);
      ax = pts[j].x;
      ay = pts[j].y;
      i = j + 1;
    }
    return out;
  }

  function nearestWalkableCell(nav, x, y, jump) {
    const c0 = Math.floor(x / NAV_CELL);
    const r0 = Math.floor(y / NAV_CELL);
    for (let ring = 1; ring <= 8; ring++) {
      let best = -1;
      let bestD = Infinity;
      for (let dr = -ring; dr <= ring; dr++) {
        for (let dc = -ring; dc <= ring; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
          const c = c0 + dc;
          const r = r0 + dr;
          if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
          const idx = r * COLS + c;
          if (!walkableCell(nav, idx, jump)) continue;
          const d = dr * dr + dc * dc;
          if (d < bestD) { bestD = d; best = idx; }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  // ─── Spatial hash (neighbour queries without checking every pair) ────────

  const HASH_CELL = 2;
  const HASH_COLS = Math.ceil(W / HASH_CELL);
  const HASH_ROWS = Math.ceil(H / HASH_CELL);

  function buildHash(state) {
    const buckets = state.hash || (state.hash = Array.from({ length: HASH_COLS * HASH_ROWS }, () => []));
    for (const b of buckets) b.length = 0;
    const add = (e) => {
      const c = clamp(Math.floor(e.x / HASH_CELL), 0, HASH_COLS - 1);
      const r = clamp(Math.floor(e.y / HASH_CELL), 0, HASH_ROWS - 1);
      buckets[r * HASH_COLS + c].push(e);
    };
    for (const u of state.units) if (u.hp > 0) add(u);
    for (const t of state.towers) if (t.hp > 0) add(t);
  }

  // Calls fn(entity) for everything whose centre may lie within r (+ the largest body radius)
  function queryHash(state, x, y, r, fn) {
    const reach = r + 2;
    const c0 = clamp(Math.floor((x - reach) / HASH_CELL), 0, HASH_COLS - 1);
    const c1 = clamp(Math.floor((x + reach) / HASH_CELL), 0, HASH_COLS - 1);
    const r0 = clamp(Math.floor((y - reach) / HASH_CELL), 0, HASH_ROWS - 1);
    const r1 = clamp(Math.floor((y + reach) / HASH_CELL), 0, HASH_ROWS - 1);
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const bucket = state.hash[row * HASH_COLS + col];
        for (let i = 0; i < bucket.length; i++) fn(bucket[i]);
      }
    }
  }

  // ─── Match setup ─────────────────────────────────────────────────────────

  function createPlayer(side, deck) {
    const ids = deck.map((c) => c.id);
    const cards = {};
    const cooldowns = {};
    const evo = {}; // equipped Evolutions: cardId -> { need, charge }
    deck.forEach((c) => {
      cards[c.id] = getCardStatsAtLevel(c.id, c.level, c.abilityUnlocked, c.mastery);
      cooldowns[c.id] = 0;
      const def = c.evo && evolutionOf(c.id);
      if (def) evo[c.id] = { need: def.cycles, charge: EVO_RULES.startCharged ? def.cycles : 0 };
    });
    return {
      side,
      elixir: MATCH.startElixir,
      crowns: 0,
      hand: ids.slice(0, 4),
      queue: ids.slice(4),
      cards,
      cooldowns,
      damageDealt: 0,
      cardsPlayed: 0,
      evoPlayed: 0,
      evo,
      emoteLog: [],
    };
  }

  // Is this player's next play of cardId going to be evolved?
  function evoReady(p, cardId) {
    const e = p && p.evo[cardId];
    return !!e && e.charge >= e.need;
  }

  // Stats for the evolved form: the base card at its level, plus the Evolution's tweaks
  function evolvedStats(stats) {
    const def = EVOLUTIONS[stats.slug];
    if (!def) return stats;
    return {
      ...stats,
      hpScaled: Math.round(stats.hpScaled * (def.hp || 1)),
      dmgScaled: +(stats.dmgScaled * (def.dmg || 1)).toFixed(2),
      evo: def,
      evoSlug: stats.slug,
    };
  }

  function makeTower(side, kind, laneIdx, stats) {
    const princess = kind === 'princess';
    return {
      id: princess ? `T-${side}-${laneIdx ? 'R' : 'L'}` : `T-${side}-K`,
      kind: 'tower',
      tower: kind,
      lane: princess ? laneIdx : -1,
      owner: side,
      x: princess ? TOWER_LAYOUT.princessX[laneIdx] : TOWER_LAYOUT.kingX,
      y: princess ? TOWER_LAYOUT.princessY[side] : TOWER_LAYOUT.kingY[side],
      half: princess ? 1.5 : 2,
      radius: princess ? 1.5 : 2,
      hp: princess ? stats.princessHp : stats.kingHp,
      hpMax: princess ? stats.princessHp : stats.kingHp,
      dmg: princess ? stats.princessDmg : stats.kingDmg,
      cd: princess ? 0.8 : 1.0,
      range: princess ? 7.5 : 7,
      active: princess,
      air: false,
      atkCd: 0,
      targetId: null,
      lastAtkT: -9,
      hitT: -9,
      stunT: 0,
    };
  }

  /**
   * opts.decks.A / opts.decks.B: deck lists (see normalizeDeck)
   * opts.towers.A / opts.towers.B: { towerLevel, kingLevel, towerMult, kingMult }
   */
  function createMatch(opts) {
    const o = opts || {};
    const state = {
      time: 0,
      running: true,
      winner: null,
      endReason: null,
      phase: 'regular',
      seed: (o.seed >>> 0) || 12345,
      nextId: 1,
      units: [],
      towers: [],
      projectiles: [],
      zones: [],             // lingering spell areas (poison, tar, heal, pull, ...)
      castLog: [],           // recent spell casts { seq, owner, cost } (the AI reads what it could see)
      fx: [],
      lastEmote: null,
      players: {},
      nav: createNav(),
      hash: null,
      byId: new Map(),
    };
    ['A', 'B'].forEach((side) => {
      state.players[side] = createPlayer(side, normalizeDeck(o.decks && o.decks[side]));
      const t = (o.towers && o.towers[side]) || {};
      const stats = towerStats(t.towerLevel, t.kingLevel, { tower: t.towerMult, king: t.kingMult });
      state.towers.push(makeTower(side, 'princess', 0, stats));
      state.towers.push(makeTower(side, 'princess', 1, stats));
      state.towers.push(makeTower(side, 'king', -1, stats));
    });
    state.towers.forEach((t) => state.byId.set(t.id, t));
    rebuildObstacles(state);
    buildHash(state);
    return state;
  }

  // ─── Deployment ──────────────────────────────────────────────────────────

  function princessOf(state, side, laneIdx) {
    return state.towers.find((t) => t.owner === side && t.tower === 'princess' && t.lane === laneIdx);
  }

  // Own half is always allowed. Troops (not buildings) may also go into the enemy
  // "pocket" behind a destroyed enemy princess tower.
  function inDeployZone(state, side, x, y, card) {
    const own = side === 'A' ? y >= RIVER.y1 + 0.5 : y <= RIVER.y0 - 0.5;
    if (own) return true;
    if (card && card.building) return false;
    const lane = x < MID_X ? 0 : 1;
    const enemyPrincess = princessOf(state, enemyOf(side), lane);
    if (!enemyPrincess || enemyPrincess.hp > 0) return false;
    return side === 'A'
      ? y >= RIVER.y0 - POCKET_DEPTH && y <= RIVER.y0 - 0.5
      : y <= RIVER.y1 + POCKET_DEPTH && y >= RIVER.y1 + 0.5;
  }

  function canDeploy(state, side, x, y, card) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (x < 0.5 || x > W - 0.5 || y < 0.5 || y > H - 0.5) return false;
    if (card && card.spell) return true; // spells can be cast anywhere
    // Tunnelling troops can surface anywhere that isn't river or a tower/building
    if (!(card && card.anywhere) && !inDeployZone(state, side, x, y, card)) return false;
    return walkablePoint(state.nav, x, y, false);
  }

  // Same rules as canDeploy, checked against a snapshot. Online clients use this for the
  // placement preview; the server still makes the final call.
  function canDeployOnSnapshot(snap, side, x, y, card) {
    if (!snap || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (x < 0.5 || x > W - 0.5 || y < 0.5 || y > H - 0.5) return false;
    if (card && card.spell) return true;
    const own = side === 'A' ? y >= RIVER.y1 + 0.5 : y <= RIVER.y0 - 0.5;
    if (!own && !(card && card.anywhere)) {
      if (card && card.building) return false;
      const laneLeft = x < MID_X;
      const foe = enemyOf(side);
      const p = snap.towers.find((t) => t.owner === foe && t.tower === 'princess' && (t.x < MID_X) === laneLeft);
      if (!p || p.hp > 0) return false;
      const pocket = side === 'A'
        ? y >= RIVER.y0 - POCKET_DEPTH && y <= RIVER.y0 - 0.5
        : y <= RIVER.y1 + POCKET_DEPTH && y >= RIVER.y1 + 0.5;
      if (!pocket) return false;
    }
    // Mirror the nav grid: judge by the centre of the half-tile cell
    const cx = (Math.floor(x / NAV_CELL) + 0.5) * NAV_CELL;
    const cy = (Math.floor(y / NAV_CELL) + 0.5) * NAV_CELL;
    if (isRiverPoint(cx, cy)) return false;
    for (const t of snap.towers) {
      if (t.hp > 0 && Math.abs(cx - t.x) <= t.half + OBSTACLE_MARGIN && Math.abs(cy - t.y) <= t.half + OBSTACLE_MARGIN) return false;
    }
    for (const u of snap.units) {
      if (u.building && u.hp > 0 && dist(cx, cy, u.x, u.y) <= u.radius + OBSTACLE_MARGIN) return false;
    }
    return true;
  }

  function spawnUnit(state, side, stats, x, y, delay, costShare) {
    const u = {
      id: `u${state.nextId++}`,
      kind: stats.building ? 'building' : 'troop',
      owner: side,
      cardId: stats.id,
      x, y, px: x, py: y,
      vx: 0, vy: 0,
      face: side === 'A' ? -Math.PI / 2 : Math.PI / 2,
      hp: stats.hpScaled,
      hpMax: stats.hpScaled,
      dmg: stats.dmgScaled,
      cd: stats.cd,
      range: stats.range,
      minRange: stats.minRange || 0,
      sight: stats.sight,
      speed: stats.speed,
      targets: stats.targets,
      air: stats.air,
      building: stats.building,
      lifetime: stats.lifetime,
      splash: stats.splash,
      style: stats.style,
      proj: stats.proj,
      radius: stats.radius,
      special: stats.special || '',
      structureMult: stats.structureMult || 1,
      costShare,
      deployT: delay,
      targetId: null,
      locked: false,
      retargetT: 0,
      atkCd: 0,
      windupT: 0,
      lastAtkT: -9,
      hitT: -9,
      lastAttackerId: null,
      path: null,
      pathT: 0,
      pathTargetId: null,
      pathNav: -1,
      stuckT: 0,
      runDist: 0,
      charging: false,
      jumping: false,
      stunT: 0,
      // Mechanics and status effects (see the Mechanics section)
      mech: stats.mech || null,
      evo: stats.evo ? stats.evoSlug : null,     // evolved form (slug of its Evolution)
      em: stats.evo ? stats.evo.mech || null : null,
      evoHits: 0, stack: 0, stackTarget: null, diveCd: 0, divedAt: -9, rally: 0, pack: null, shieldT: 0,
      level: stats.level || 1,
      lvlScale: stats.lvlScale || 1,
      crownMult: stats.crownMult || 1,
      shield: stats.mech && stats.mech.shield ? Math.round(stats.mech.shield * (stats.lvlScale || 1)) : 0,
      shieldMax: stats.mech && stats.mech.shield ? Math.round(stats.mech.shield * (stats.lvlScale || 1)) : 0,
      frozenT: 0,
      slowT: 0, slowMult: 1,
      hasteT: 0, hasteMult: 1,
      hidden: !!(stats.mech && stats.mech.hide),
      idleT: 0,
      dashing: null,
      dashCd: 0,
      invuln: false,
      rampT: 0,
      rampTarget: null,
      spawnT: 0,
      genT: 0,
      healT: 0,
      healedAt: -9,
    };
    state.units.push(u);
    state.byId.set(u.id, u);
    return u;
  }

  // Spawn a token troop (skeleton, drone, ...) at the given level; tokens carry no elixir value
  function spawnToken(state, side, tokenId, x, y, level, delay) {
    const stats = getCardStatsAtLevel(tokenId, level || 1, false, 0);
    if (!stats) return null;
    return spawnUnit(state, side, stats, clamp(x, 0.4, W - 0.4), clamp(y, 0.4, H - 0.4), delay == null ? 0.3 : delay, 0);
  }

  // A free spot near (x, y) for a spawned ground troop (air troops can go anywhere)
  function spawnSpot(state, x, y, air, spread, k) {
    if (air) return { x, y };
    for (let i = 0; i < 10; i++) {
      const a = (k + i) * 2.399; // golden-angle spiral
      const r = spread * (0.35 + 0.65 * ((i + 1) / 10));
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (walkablePoint(state.nav, px, py, false)) return { x: px, y: py };
    }
    return walkablePoint(state.nav, x, y, false) ? { x, y } : null;
  }

  function cycleHand(p, cardId) {
    const idx = p.hand.indexOf(cardId);
    if (idx < 0 || p.queue.length === 0) return;
    p.hand[idx] = p.queue.shift();
    p.queue.push(cardId);
  }

  /** Play a card. Returns { ok: true, units } or { ok: false, reason }. */
  function deploy(state, side, cardId, x, y) {
    if (!state.running) return { ok: false, reason: 'Match is over' };
    const p = state.players[side];
    const stats = p && p.cards[cardId];
    if (!stats) return { ok: false, reason: 'Unknown card' };
    if (!p.hand.includes(cardId)) return { ok: false, reason: 'Card not in hand' };
    if (p.elixir < stats.cost) return { ok: false, reason: 'Not enough elixir' };
    if ((p.cooldowns[cardId] || 0) > state.time) return { ok: false, reason: 'Card is recharging' };
    const px = Number(x);
    const py = Number(y);
    if (!canDeploy(state, side, px, py, stats)) return { ok: false, reason: "Can't deploy there" };

    p.elixir = Math.max(0, p.elixir - stats.cost);
    p.cooldowns[cardId] = state.time + stats.deployCdScaled;
    p.cardsPlayed += 1;

    // Evolution cycle: only a play that passed every check above counts. A charged card comes
    // out evolved and starts charging again; otherwise this play adds one charge.
    const cycle = p.evo[cardId];
    let evolved = false;
    if (cycle) {
      if (cycle.charge >= cycle.need) { evolved = true; cycle.charge = 0; p.evoPlayed += 1; }
      else cycle.charge += 1;
    }
    const play = evolved ? evolvedStats(stats) : stats;
    if (evolved) pushFx(state, { type: 'evolve', x: px, y: py, owner: side, cardId, name: play.evo.name });

    if (stats.spell) {
      castSpell(state, side, play, px, py);
      state.castLog.push({ seq: state.nextId++, owner: side, cost: stats.cost, cardId });
      if (state.castLog.length > 24) state.castLog.shift();
      cycleHand(p, cardId);
      pushFx(state, { type: 'cast', x: px, y: py, owner: side, r: stats.splash, cardId, cost: stats.cost, evo: evolved ? 1 : 0 });
      return { ok: true, units: [], evolved };
    }

    const count = stats.swarmCount || 1;
    const units = [];
    // Tunnelling to the far side of the river takes a moment longer
    const tunnel = stats.anywhere && !ownHalf(side, py) ? 0.8 : 0;
    for (let i = 0; i < count; i++) {
      let sx = px;
      let sy = py;
      if (count > 1) {
        const ring = 0.45 + count * 0.1;
        const ang = (i / count) * Math.PI * 2 + 0.4;
        const cx = px + Math.cos(ang) * ring;
        const cy = py + Math.sin(ang) * ring;
        if (stats.air || walkablePoint(state.nav, cx, cy, false)) { sx = cx; sy = cy; }
      }
      units.push(spawnUnit(state, side, play, clamp(sx, 0.4, W - 0.4), clamp(sy, 0.4, H - 0.4), MATCH.deployTime + tunnel + i * 0.05, stats.cost / count));
    }
    // Swarm members of one play know each other (for pack mechanics like Scrap Rally)
    if (count > 1) units.forEach((u) => { u.pack = units[0].id; });
    if (stats.building) rebuildObstacles(state);
    cycleHand(p, cardId);
    pushFx(state, { type: 'deploy', x: px, y: py, owner: side, r: count > 1 ? 1.4 : 1, cardId, cost: stats.cost, evo: evolved ? 1 : 0 });
    return { ok: true, units, evolved };
  }

  // ─── Spells ──────────────────────────────────────────────────────────────

  function spellSpec(stats) {
    return { kind: stats.proj, towerMult: stats.towerMult, knockback: stats.knockback, stun: stats.stun, freeze: stats.freeze, cost: stats.cost };
  }

  function castSpell(state, side, stats, x, y) {
    if (stats.zone) { addZone(state, side, stats, x, y); return; }
    const spec = spellSpec(stats);
    const evoSpell = stats.evo && stats.evo.spell;
    if (evoSpell && evoSpell.seek) { castSeekingBarrage(state, side, stats, x, y, evoSpell.seek, spec); return; }
    if (evoSpell && evoSpell.afterZone) spec.afterZone = { ...evoSpell.afterZone, total: stats.dmgScaled * evoSpell.afterZone.dmgMult, level: stats.level };
    const waves = stats.waves || 1;
    const dmg = stats.dmgScaled / waves;
    if (stats.instant || stats.proj === 'shock') {
      applySpell(state, side, spec, x, y, stats.splash, dmg);
      if (evoSpell && evoSpell.echo) {
        // Overload: a second pulse after a short delay, at the same spot
        makeZone(state, { kind: 'echo', owner: side, cardId: stats.id, x, y, r: stats.splash, delay: evoSpell.echo.delay, total: dmg * evoSpell.echo.dmgMult, stun: evoSpell.echo.stun, towerMult: stats.towerMult, evo: 1 });
      }
      return;
    }
    const king = state.towers.find((t) => t.owner === side && t.tower === 'king');
    const fromX = king ? king.x : x;
    const fromY = king ? king.y : y;
    for (let i = 0; i < waves; i++) {
      state.projectiles.push({
        id: `p${state.nextId++}`,
        owner: side,
        source: { id: null, owner: side, structureMult: 1 },
        style: stats.proj,
        x: fromX, y: fromY, sx: fromX, sy: fromY, tx: x, ty: y,
        targetId: null,
        homing: false,
        lob: true,
        speed: PROJ_SPEED[stats.proj] || 15,
        dmg,
        splash: stats.splash,
        canHitAir: true,
        chain: false,
        delay: i * 0.22,
        spell: spec,
      });
    }
  }

  // Stun (or freeze) a troop, building or tower. Interrupts wind-ups, charges, dashes and ramp-ups.
  function stunEntity(e, dur, freeze) {
    if (!e || e.hp <= 0 || !(dur > 0)) return;
    e.stunT = Math.max(e.stunT || 0, dur);
    if (freeze) e.frozenT = Math.max(e.frozenT || 0, dur);
    e.windupT = 0;
    if (e.kind === 'tower') return;
    e.charging = false;
    e.runDist = 0;
    e.rampT = 0;
    e.stack = 0;
    if (e.mech && e.mech.chargeShot) e.atkCd = e.cd;
    if (e.dashing) { e.dashing = null; e.invuln = false; }
  }

  // Damage (and knock back / stun / freeze) every enemy in the radius. Crown towers take reduced damage.
  function applySpell(state, owner, spec, x, y, radius, dmg) {
    const hit = [];
    queryHash(state, x, y, radius, (e) => {
      if (e.hp <= 0 || e.owner === owner) return;
      const gap = e.kind === 'tower' ? boxDist(x, y, e) : dist(x, y, e.x, e.y) - e.radius;
      if (gap <= radius) hit.push(e);
    });
    const src = { id: null, owner, structureMult: 1 };
    for (const e of hit) {
      if (dmg > 0) applyDamage(state, src, e, e.kind === 'tower' ? dmg * spec.towerMult : dmg);
      if (spec.freeze > 0) stunEntity(e, spec.freeze, true);
      else if (spec.stun > 0) stunEntity(e, spec.stun, false);
      if (spec.knockback > 0 && e.kind === 'troop' && e.hp > 0) knockBack(state, e, x, y, spec.knockback * (1 - 0.4 * Math.min(1, dist(x, y, e.x, e.y) / radius)));
    }
    if (spec.afterZone) {
      // Napalm: the impact leaves burning ground (damage over time, enemies only)
      const az = spec.afterZone;
      makeZone(state, { kind: az.kind, owner, cardId: 'firebomb', x, y, r: az.radius, dur: az.dur, tick: az.tick, total: az.total, towerMult: spec.towerMult, level: az.level || 1, evo: 1 });
    }
    pushFx(state, { type: 'spell', kind: spec.kind, x, y, r: radius, owner, evo: spec.evo ? 1 : 0 });
  }

  // Homing Barrage: rockets lock on to different enemies in the area (toughest first); spares hit the centre
  function castSeekingBarrage(state, side, stats, x, y, cfg, spec) {
    const king = state.towers.find((t) => t.owner === side && t.tower === 'king');
    const fromX = king ? king.x : x;
    const fromY = king ? king.y : y;
    // Scan everything directly (not the spatial hash, which is only rebuilt each step and would
    // miss troops that arrived since)
    const targets = [];
    for (const e of state.units.concat(state.towers)) {
      if (e.hp <= 0 || e.owner === side || e.hidden) continue;
      const gap = e.kind === 'tower' ? boxDist(x, y, e) : dist(x, y, e.x, e.y) - e.radius;
      if (gap <= stats.splash) targets.push(e);
    }
    targets.sort((a, b) => b.hp - a.hp);
    const dmg = stats.dmgScaled * cfg.dmgMult;
    for (let i = 0; i < cfg.count; i++) {
      const t = targets[i] || null;
      state.projectiles.push({
        id: `p${state.nextId++}`, owner: side, source: { id: null, owner: side, structureMult: 1 }, style: 'rocket',
        x: fromX, y: fromY, sx: fromX, sy: fromY, tx: t ? t.x : x, ty: t ? t.y : y,
        targetId: t ? t.id : null, homing: !!t, lob: true, speed: PROJ_SPEED.rocket,
        dmg, splash: cfg.radius, canHitAir: true, chain: false, delay: i * 0.12,
        spell: { ...spec, evo: 1 }, evo: true,
      });
    }
  }

  function knockBack(state, e, fromX, fromY, amount) {
    let dx = e.x - fromX;
    let dy = e.y - fromY;
    const d = Math.hypot(dx, dy);
    if (d < 1e-3) { dx = 0; dy = e.owner === 'A' ? 1 : -1; } else { dx /= d; dy /= d; }
    const jump = e.special.includes('jump');
    for (const k of [1, 0.5, 0.25]) {
      const nx = clamp(e.x + dx * amount * k, e.radius, W - e.radius);
      const ny = clamp(e.y + dy * amount * k, e.radius, H - e.radius);
      if (e.air || walkablePoint(state.nav, nx, ny, jump)) {
        e.x = nx;
        e.y = ny;
        e.path = null;
        return;
      }
    }
  }

  // ─── Lingering areas (zones) ─────────────────────────────────────────────
  //
  // dot: damage ticks (+ optional slow)     slow: slows enemies inside
  // haste: speeds up allies inside           heal: heals allied troops/buildings (never towers)
  // pull: drags enemy troops to the centre   laser: after a delay, strikes the toughest enemies
  // roll: a boulder rolling toward the enemy  blade: a thrown blade that flies out and back
  // spawn: drops token troops over time

  function addZone(state, owner, stats, x, y) {
    const z = stats.zone;
    const zone = {
      id: `z${state.nextId++}`,
      kind: z.kind,
      owner,
      cardId: stats.id,
      x, y,
      r: stats.splash,
      dur: z.dur || 0,
      age: 0,
      delay: z.delay || 0,
      tick: z.tick || 0,
      tickT: 0,
      ticks: 0,
      total: stats.dmgScaled,
      towerMult: stats.towerMult,
      slow: z.slow || 0,
      haste: z.haste || 0,
      pull: z.pull || 0,
      stun: stats.stun || 0,
      knockback: stats.knockback || 0,
      maxTargets: z.targets || 0,
      count: z.count || 0,
      card: z.card || null,
      spawned: 0,
      level: stats.level || 1,
      hit: null,
      done: false,
    };
    if (z.kind === 'roll') {
      // Rolls straight toward the enemy's back line
      zone.vx = 0;
      zone.vy = owner === 'A' ? -z.speed : z.speed;
      zone.length = z.length;
      zone.travelled = 0;
      zone.dur = z.length / z.speed;
      zone.hit = new Set();
    }
    state.zones.push(zone);
    return zone;
  }

  // A unit's thrown blade: flies through enemies in a line to just past the target, then comes back
  function throwBlade(state, u, t) {
    const dx = t.x - u.x;
    const dy = t.y - u.y;
    const d = Math.hypot(dx, dy) || 1;
    const speed = 9;
    const length = d + (u.mech.pierce || 1.5);
    state.zones.push({
      id: `z${state.nextId++}`,
      kind: 'blade',
      owner: u.owner,
      cardId: u.cardId,
      x: u.x, y: u.y, sx: u.x, sy: u.y,
      vx: (dx / d) * speed, vy: (dy / d) * speed, speed,
      r: 0.7,
      length,
      travelled: 0,
      returning: false,
      throwerId: u.id,
      hit: new Set(),
      source: damageSource(u),
      dmgEach: u.dmg,
      canHitAir: u.targets === 'any',
      dur: (length * 2) / speed,
      age: 0,
      delay: 0,
      done: false,
    });
  }

  function inZone(z, e) {
    const gap = e.kind === 'tower' ? boxDist(z.x, z.y, e) : dist(z.x, z.y, e.x, e.y) - e.radius;
    return gap <= z.r;
  }

  // fn(e) for each living entity inside the zone: enemies of the caster, or allies when `friendly`
  function eachInZone(state, z, friendly, fn) {
    const list = [];
    queryHash(state, z.x, z.y, z.r, (e) => {
      if (e.hp <= 0) return;
      if (friendly ? e.owner !== z.owner : e.owner === z.owner) return;
      if (inZone(z, e)) list.push(e);
    });
    list.forEach(fn);
  }

  function setSlow(e, mult, dur) {
    if (e.kind === 'tower') return;
    e.slowMult = e.slowT > 0 ? Math.min(e.slowMult, mult) : mult;
    e.slowT = Math.max(e.slowT || 0, dur);
  }

  function setHaste(e, mult, dur) {
    if (e.kind === 'tower') return;
    e.hasteMult = e.hasteT > 0 ? Math.max(e.hasteMult, mult) : mult;
    e.hasteT = Math.max(e.hasteT || 0, dur);
  }

  function healEntity(state, e, amount) {
    if (e.kind === 'tower' || e.hp <= 0 || e.hp >= e.hpMax) return 0;
    const add = Math.min(amount, e.hpMax - e.hp);
    e.hp += add;
    e.healedAt = state.time;
    return add;
  }

  function moveEntity(state, e, nx, ny) {
    const jump = e.special && e.special.includes('jump');
    const x = clamp(nx, e.radius, W - e.radius);
    const y = clamp(ny, e.radius, H - e.radius);
    if (e.air || walkablePoint(state.nav, x, y, jump)) { e.x = x; e.y = y; return true; }
    if (walkablePoint(state.nav, x, e.y, jump)) { e.x = x; return true; }
    if (walkablePoint(state.nav, e.x, y, jump)) { e.y = y; return true; }
    return false;
  }

  // Tick-based zones fire at the start of each interval: dur 6 / tick 1 = 6 ticks
  function zoneTicks(z, dt) {
    const want = Math.round(z.dur / z.tick);
    if (z.ticks >= want) return 0;
    z.tickT -= dt;
    if (z.ticks > 0 && z.tickT > 1e-6) return 0;
    z.tickT += z.ticks === 0 ? z.tick + dt : z.tick;
    z.ticks++;
    return z.total / want;
  }

  function updateZones(state, dt) {
    if (!state.zones.length) return;
    for (const z of state.zones) {
      if (z.done) continue;
      if (z.delay > 0) { z.delay -= dt; if (z.delay > 0) continue; }
      const src = z.source || { id: null, owner: z.owner, structureMult: 1 };
      switch (z.kind) {
        case 'dot': {
          const per = zoneTicks(z, dt);
          if (per > 0) eachInZone(state, z, false, (e) => applyDamage(state, src, e, e.kind === 'tower' ? per * z.towerMult : per));
          if (z.slow) eachInZone(state, z, false, (e) => setSlow(e, z.slow, 0.25));
          break;
        }
        case 'slow':
          eachInZone(state, z, false, (e) => setSlow(e, z.slow, 0.25));
          break;
        case 'haste':
          eachInZone(state, z, true, (e) => setHaste(e, z.haste, 0.25));
          break;
        case 'heal': {
          const per = zoneTicks(z, dt);
          if (per > 0) eachInZone(state, z, true, (e) => healEntity(state, e, per));
          break;
        }
        case 'pull': {
          eachInZone(state, z, false, (e) => {
            if (e.kind !== 'troop' || e.invuln) return;
            const d = dist(e.x, e.y, z.x, z.y);
            if (d < 0.2) return;
            const stepLen = Math.min(d - 0.1, z.pull * dt);
            if (moveEntity(state, e, e.x + ((z.x - e.x) / d) * stepLen, e.y + ((z.y - e.y) / d) * stepLen)) e.path = null;
          });
          const per = zoneTicks(z, dt);
          if (per > 0) eachInZone(state, z, false, (e) => applyDamage(state, src, e, e.kind === 'tower' ? per * z.towerMult : per));
          break;
        }
        case 'laser': {
          const pool = [];
          eachInZone(state, z, false, (e) => { if (!e.invuln) pool.push(e); });
          pool.sort((a, b) => b.hp - a.hp);
          const pts = [];
          pool.slice(0, z.maxTargets || 3).forEach((e) => {
            applyDamage(state, src, e, e.kind === 'tower' ? z.total * z.towerMult : z.total, true);
            if (z.stun) stunEntity(e, z.stun, false);
            pts.push({ x: r2(e.x), y: r2(e.y) });
          });
          pushFx(state, { type: 'laser', x: z.x, y: z.y, r: z.r, owner: z.owner, pts });
          z.done = true;
          break;
        }
        case 'roll':
        case 'blade': {
          if (z.kind === 'blade' && z.returning) {
            // Home in on the thrower (or where it stood)
            const thrower = state.byId.get(z.throwerId);
            const hx = thrower && thrower.hp > 0 ? thrower.x : z.sx;
            const hy = thrower && thrower.hp > 0 ? thrower.y : z.sy;
            const d = dist(z.x, z.y, hx, hy);
            if (d < 0.5) { z.done = true; break; }
            z.vx = ((hx - z.x) / d) * z.speed;
            z.vy = ((hy - z.y) / d) * z.speed;
          }
          z.x += z.vx * dt;
          z.y += z.vy * dt;
          z.travelled += Math.hypot(z.vx, z.vy) * dt;
          const sp = Math.hypot(z.vx, z.vy) || 1;
          const dirX = z.vx / sp;
          const dirY = z.vy / sp;
          eachInZone(state, z, false, (e) => {
            if (z.hit.has(e.id) || e.invuln || e.hidden) return;
            if (e.air && (z.kind === 'roll' || !z.canHitAir)) return;
            z.hit.add(e.id);
            if (z.kind === 'roll') {
              applyDamage(state, src, e, e.kind === 'tower' ? z.total * z.towerMult : z.total, true);
              if (z.knockback && e.kind === 'troop' && e.hp > 0) knockBack(state, e, e.x - dirX, e.y - dirY, z.knockback);
            } else {
              applyDamage(state, src, e, z.dmgEach);
              pushFx(state, { type: 'hit', x: e.x, y: e.y, owner: z.owner, style: 'blade' });
            }
          });
          if (z.kind === 'roll') {
            if (z.travelled >= z.length || z.y < 0 || z.y > H) z.done = true;
          } else if (!z.returning && z.travelled >= z.length) {
            z.returning = true;
            z.hit.clear(); // the way back hits everything again
          } else if (z.age > 4) {
            z.done = true; // safety net
          }
          break;
        }
        case 'echo': {
          // Overload's aftershock (fires once, after its delay)
          applySpell(state, z.owner, { kind: 'shock', towerMult: z.towerMult, knockback: 0, stun: z.stun, freeze: 0, cost: 0, evo: 1 }, z.x, z.y, z.r, z.total);
          z.done = true;
          break;
        }
        case 'spawn': {
          const interval = z.dur / Math.max(1, z.count);
          while (z.spawned < z.count && z.age >= z.spawned * interval) {
            const a = nextRandom(state) * Math.PI * 2;
            const rr = Math.sqrt(nextRandom(state)) * z.r * 0.85;
            const spot = spawnSpot(state, z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr, false, 0.8, z.spawned);
            if (spot) {
              spawnToken(state, z.owner, z.card, spot.x, spot.y, z.level, 0.6);
              pushFx(state, { type: 'drop', x: spot.x, y: spot.y, owner: z.owner });
            }
            z.spawned++;
          }
          if (z.spawned >= z.count) z.done = true;
          break;
        }
        default:
          z.done = true;
      }
      z.age += dt;
      if (z.dur && z.age >= z.dur && z.kind !== 'blade' && z.kind !== 'spawn') z.done = true;
    }
    state.zones = state.zones.filter((z) => !z.done);
  }

  // ─── Emotes ──────────────────────────────────────────────────────────────

  /** Send an emote. Rate limited per player: one every EMOTE_RULES.minGap s, at most maxInWindow per window. */
  function emote(state, side, emoteId) {
    const p = state.players[side];
    const id = String(emoteId || '');
    if (!p || !EMOTE_IDS.includes(id)) return { ok: false, reason: 'Unknown emote' };
    const now = state.time;
    p.emoteLog = p.emoteLog.filter((t) => now - t < EMOTE_RULES.window);
    const last = p.emoteLog[p.emoteLog.length - 1];
    if (last != null && now - last < EMOTE_RULES.minGap) return { ok: false, reason: 'Emote cooling down' };
    if (p.emoteLog.length >= EMOTE_RULES.maxInWindow) return { ok: false, reason: 'Too many emotes' };
    p.emoteLog.push(now);
    state.lastEmote = { side, id, time: now };
    pushFx(state, { type: 'emote', owner: side, emote: id });
    return { ok: true };
  }

  // ─── Targeting ───────────────────────────────────────────────────────────

  function canTarget(u, e) {
    if (!e || e.hp <= 0 || e.owner === u.owner) return false;
    if (e.hidden) return false; // burrowed buildings can only be hit by spells
    if (u.targets === 'none') return false;
    if (u.targets === 'air') return !!e.air;
    if (e.air && u.targets !== 'any') return false;
    if (u.targets === 'buildings' && e.kind === 'troop') return false;
    return true;
  }

  // Default objective when nothing is in sight: the enemy princess tower on this
  // unit's side of the arena, or the king tower once that princess is gone.
  function defaultTarget(state, u) {
    const foe = enemyOf(u.owner);
    const lane = u.x < MID_X ? 0 : 1;
    const princess = princessOf(state, foe, lane);
    if (princess && princess.hp > 0) return princess;
    const other = princessOf(state, foe, 1 - lane);
    const king = state.towers.find((t) => t.owner === foe && t.tower === 'king');
    if (king && king.hp > 0) {
      // Units still on their own side head for whichever enemy tower is actually closer
      if (other && other.hp > 0 && dist(u.x, u.y, other.x, other.y) < dist(u.x, u.y, king.x, king.y) - 4) return other;
      return king;
    }
    return other && other.hp > 0 ? other : null;
  }

  // Nearest valid enemy within sight (towers count, so units peel off to attack them too)
  const TAUNT_REACH = 7;

  function acquireTarget(state, u, radius) {
    let best = null;
    let bestScore = Infinity;
    const troop = u.kind === 'troop';
    queryHash(state, u.x, u.y, troop ? Math.max(radius, TAUNT_REACH) : radius, (e) => {
      if (!canTarget(u, e)) return;
      const d = edgeDist(u, e);
      // Taunting decoys pull enemy troops from further away than they would normally look
      const taunt = troop && e.mech && e.mech.taunt && d <= e.mech.taunt;
      if (d > radius && !taunt) return;
      if (u.minRange && dist(u.x, u.y, e.x, e.y) < u.minRange) return;
      // Prefer whoever is hitting us or our allies
      const score = d - (e.id === u.lastAttackerId ? 1 : 0) - (taunt ? 8 : 0);
      if (score < bestScore) { bestScore = score; best = e; }
    });
    return best;
  }

  function inAttackRange(u, t) {
    if (u.minRange && dist(u.x, u.y, t.x, t.y) < u.minRange) return false;
    return edgeDist(u, t) <= u.range;
  }

  function updateTargeting(state, u, dt) {
    let t = u.targetId ? state.byId.get(u.targetId) : null;
    if (t && !canTarget(u, t)) t = null;
    if (!t) u.locked = false;
    // Locked targets are kept until they die or step well out of range (no flip-flopping)
    if (u.locked && t) {
      const outOfReach = edgeDist(u, t) > u.range + 1.0;
      if (outOfReach || (u.minRange && dist(u.x, u.y, t.x, t.y) < u.minRange)) { u.locked = false; }
    }
    u.retargetT -= dt;
    if (!u.locked && (u.retargetT <= 0 || !t)) {
      u.retargetT = 0.3 + nextRandom(state) * 0.1;
      const sight = u.building ? u.range : u.sight;
      const seen = acquireTarget(state, u, sight);
      // Buildings only shoot what's in range; anti-air troops hold position until a flyer shows up
      const candidate = seen || (u.building || u.targets === 'air' ? null : defaultTarget(state, u));
      if (!t) {
        t = candidate;
      } else if (candidate && candidate !== t) {
        const tVisible = edgeDist(u, t) <= sight;
        // Hysteresis: only switch to a clearly closer target, or when the current one is out of sight
        if (!tVisible || edgeDist(u, candidate) < edgeDist(u, t) - 0.75) t = candidate;
      }
    }
    u.targetId = t ? t.id : null;
    return t;
  }

  // ─── Combat ──────────────────────────────────────────────────────────────

  function auraProtected(state, target) {
    let shielded = false;
    queryHash(state, target.x, target.y, 2.5, (e) => {
      if (shielded || e.owner !== target.owner || e.hp <= 0 || e.deployT > 0) return;
      if (e.special && e.special.includes('aura') && dist(e.x, e.y, target.x, target.y) <= 2.5) shielded = true;
    });
    return shielded;
  }

  function applyDamage(state, source, target, amount, showNumber) {
    if (!target || target.hp <= 0 || amount <= 0) return 0;
    if (target.invuln) return 0; // mid-dash
    let amt = amount;
    if (target.kind !== 'troop') amt *= source.structureMult || 1;
    if (target.kind === 'tower') amt *= source.crownMult || 1;
    if (target.kind === 'troop' && auraProtected(state, target)) amt *= 0.75;
    target.hitT = state.time;
    if (target.shield > 0) {
      // Shields soak the hit; whatever is left over when they break is lost
      target.shield = Math.max(0, target.shield - amt);
      if (source.id) target.lastAttackerId = source.id;
      const p = state.players[source.owner];
      if (p) p.damageDealt += amt;
      if (target.shield === 0) pushFx(state, { type: 'shieldBreak', x: target.x, y: target.y, owner: target.owner });
      return amt;
    }
    target.hp -= amt;
    if (source.id) target.lastAttackerId = source.id;
    const p = state.players[source.owner];
    if (p) p.damageDealt += amt;
    if (target.tower === 'king' && !target.active) wakeKing(state, target);
    // Floating damage numbers: towers, spells and heavy hits
    if (showNumber || target.kind === 'tower' || amt >= 150) {
      pushFx(state, { type: 'dmg', x: target.x, y: target.y - (target.half || target.radius || 0.4), amt: Math.round(amt), owner: source.owner, big: amt >= 150 });
    }
    return amt;
  }

  function wakeKing(state, king) {
    if (king.active) return;
    king.active = true;
    pushFx(state, { type: 'kingWake', x: king.x, y: king.y, owner: king.owner });
  }

  function splashDamage(state, source, x, y, radius, amount, canHitAir, exclude) {
    const hit = [];
    queryHash(state, x, y, radius, (e) => {
      if (e.hp <= 0 || e.owner === source.owner || e.hidden) return;
      if (exclude && exclude.has(e.id)) return;
      if (e.air && !canHitAir) return;
      const gap = e.kind === 'tower' ? boxDist(x, y, e) : dist(x, y, e.x, e.y) - e.radius;
      if (gap <= radius) hit.push(e);
    });
    hit.forEach((e) => applyDamage(state, source, e, amount));
    if (exclude) hit.forEach((e) => exclude.add(e.id));
    pushFx(state, { type: 'splash', x, y, r: radius, owner: source.owner });
    return hit;
  }

  function damageSource(u) {
    return { id: u.id, owner: u.owner, structureMult: u.structureMult, crownMult: u.crownMult || 1 };
  }

  // Spark Spirit: hit the target, then arc to nearby enemies, stunning each one
  function zapChain(state, u, first, dmg) {
    const z = u.mech.zap;
    const src = damageSource(u);
    const hit = new Set([first.id]);
    applyDamage(state, src, first, dmg, true);
    stunEntity(first, z.stun, false);
    pushFx(state, { type: 'chain', x: u.x, y: u.y, x2: first.x, y2: first.y, owner: u.owner });
    let from = first;
    for (let n = 0; n < z.chain; n++) {
      let next = null;
      let bestD = Infinity;
      queryHash(state, from.x, from.y, z.radius, (e) => {
        if (hit.has(e.id) || e.hp <= 0 || e.owner === u.owner || e.hidden) return;
        if (e.air && u.targets !== 'any') return;
        const d = dist(from.x, from.y, e.x, e.y);
        if (d <= z.radius && d < bestD) { bestD = d; next = e; }
      });
      if (!next) break;
      hit.add(next.id);
      applyDamage(state, src, next, dmg);
      stunEntity(next, z.stun, false);
      pushFx(state, { type: 'chain', x: from.x, y: from.y, x2: next.x, y2: next.y, owner: u.owner });
      from = next;
    }
  }

  function launchProjectile(state, shooter, target, dmg, opts) {
    const o = opts || {};
    const style = o.style || shooter.proj || 'slug';
    const lob = style === 'mortar';
    state.projectiles.push({
      id: `p${state.nextId++}`,
      owner: shooter.owner,
      source: damageSource(shooter),
      style,
      x: shooter.x, y: shooter.y,
      sx: shooter.x, sy: shooter.y,
      tx: target.x, ty: target.y,
      targetId: target.id,
      homing: !lob,
      lob,
      speed: PROJ_SPEED[style] || 13,
      dmg,
      splash: o.splash != null ? o.splash : (shooter.splash || 0),
      canHitAir: shooter.kind === 'tower' || shooter.targets === 'any' || shooter.targets === 'air',
      chain: !!o.chain,
      delay: o.delay || 0,
      slow: o.slow || null,
      chainN: o.chainN || 0,
      chainStun: o.chainStun || 0,
      impactZone: o.impactZone || null,
      cluster: o.cluster || null,
      exclude: o.exclude || null,   // shared hit set (cluster bomblets: one bomblet per enemy)
      evo: !!(shooter.evo),
    });
  }

  // The moment an attack lands (end of wind-up). Melee hits instantly; ranged fires a projectile.
  function fireAttack(state, u, t) {
    let dmg = u.dmg;
    let heavy = false;
    const m = u.mech;
    if (u.charging) { dmg *= 2; heavy = true; u.charging = false; u.runDist = 0; pushFx(state, { type: 'charge', x: t.x, y: t.y, owner: u.owner }); }
    u.lastAtkT = state.time;
    const src = damageSource(u);
    const canHitAir = u.targets === 'any' || u.targets === 'air';
    const em = u.em;
    if (em) {
      dmg *= evoDamageMult(state, u, t);
      if (u.divedAt === state.time) heavy = true;
      u.evoHits += 1;
      // Building pulse: every Nth shot also discharges around itself (the normal shot still fires)
      if (em.pulse && u.evoHits % em.pulse.every === 0) shockwave(state, u, u.x, u.y, em.pulse, 'pulse');
      if (em.pierceLine) { pierceLine(state, u, t, dmg); return; }
    }

    // Ramp-up beam: hits instantly, harder the longer it has held this target
    if (m && m.ramp) {
      dmg *= 1 + 9 * Math.min(1, u.rampT / m.ramp);
      applyDamage(state, src, t, dmg, dmg >= 150);
      return;
    }
    if (m && m.pierce) { throwBlade(state, u, t); return; }

    if (u.proj === 'melee') {
      if (u.special.includes('kamikaze') && m && m.zap) {
        zapChain(state, u, t, dmg);
        u.hp = 0;
        u.kamikazed = true;
        return;
      }
      if (u.special.includes('kamikaze')) {
        splashDamage(state, src, t.x, t.y, u.splash || 1.2, dmg, canHitAir);
        u.hp = 0;
        u.kamikazed = true;
        return;
      }
      if (u.special.includes('spin')) {
        splashDamage(state, src, u.x, u.y, u.splash || 1.4, dmg, canHitAir);
      } else if (u.splash > 0) {
        splashDamage(state, src, t.x, t.y, u.splash, dmg, canHitAir);
      } else {
        applyDamage(state, src, t, dmg, heavy);
        pushFx(state, { type: 'hit', x: t.x, y: t.y, owner: u.owner, style: 'melee' });
      }
      // Melee shockwave every Nth hit, centred on the target
      if (em && em.shockwave && u.evoHits % em.shockwave.every === 0) shockwave(state, u, t.x, t.y, em.shockwave, 'shockwave');
      if (u.style === 'double') {
        const second = secondTarget(state, u, t);
        if (second) applyDamage(state, src, second, dmg);
      }
      if (u.style === 'burst') applyDamage(state, src, t, dmg * 0.45);
      return;
    }

    launchProjectile(state, u, t, dmg, {
      chain: u.special.includes('chain'),
      slow: m && m.slowOnHit,
      chainN: em && em.chain ? em.chain.count : 0,
      chainStun: em && em.chain ? em.chain.stunPrimary : 0,
      impactZone: em && em.impactZone,
      cluster: em && em.cluster,
    });
    if (u.style === 'double') {
      const second = secondTarget(state, u, t);
      if (second) launchProjectile(state, u, second, dmg);
    }
    if (u.style === 'burst') launchProjectile(state, u, t, dmg * 0.45, { delay: 0.15 });
  }

  function secondTarget(state, u, primary) {
    let best = null;
    let bestD = Infinity;
    queryHash(state, u.x, u.y, u.range + u.radius + 1, (e) => {
      if (e === primary || !canTarget(u, e) || !inAttackRange(u, e)) return;
      const d = edgeDist(u, e);
      if (d < bestD) { bestD = d; best = e; }
    });
    return best;
  }

  function windupOf(u) {
    if (u.mech && u.mech.ramp) return 0; // continuous beam
    return Math.min(0.3, u.cd * 0.3);
  }

  // ─── Unit update ─────────────────────────────────────────────────────────

  // Slows and haste scale how fast a unit moves and attacks
  function timeScale(u) {
    return (u.slowT > 0 ? u.slowMult : 1) * (u.hasteT > 0 ? u.hasteMult : 1) * (1 + (u.rally || 0));
  }

  function updateUnit(state, u, dt) {
    u.px = u.x;
    u.py = u.y;
    if (u.hp <= 0) return;
    if (u.deployT > 0) { u.deployT -= dt; return; }

    if (u.building && u.lifetime > 0) {
      u.hp -= (u.hpMax / u.lifetime) * dt;
      if (u.hp <= 0) return;
    }
    if (u.slowT > 0) u.slowT -= dt;
    if (u.hasteT > 0) u.hasteT -= dt;
    if (u.frozenT > 0) u.frozenT -= dt;
    if (u.dashCd > 0) u.dashCd -= dt;
    if (u.diveCd > 0) u.diveCd -= dt;
    if (u.stunT > 0) {
      u.stunT -= dt;
      u.vx = 0;
      u.vy = 0;
      u.windupT = 0;
      return;
    }

    const k = timeScale(u);
    const m = u.mech;
    if (u.em) updateEvolvedUnit(state, u, dt);
    if (m) {
      if (m.spawner) updateSpawner(state, u, dt * k);
      if (m.elixir) updateElixirPump(state, u, dt);
      if (m.heal) updateHealer(state, u, dt);
      if (m.taunt) updateTaunt(state, u, dt);
    }
    if (u.targets === 'none') return; // spawners, pumps and decoys never attack

    u.atkCd -= dt * k;
    if (u.dashing) { updateDash(state, u, dt); return; }
    const t = updateTargeting(state, u, dt);

    // Burrowed buildings pop up when an enemy is in range, and dig back in when idle
    if (m && m.hide) {
      if (t && inAttackRange(u, t)) {
        if (u.hidden) { u.hidden = false; u.atkCd = Math.max(u.atkCd, 0.35); pushFx(state, { type: 'popup', x: u.x, y: u.y, owner: u.owner }); }
        u.idleT = 0;
      } else if (!u.hidden) {
        u.idleT += dt;
        if (u.idleT > 0.8) u.hidden = true;
      }
    }
    // Ramp-up beams start over whenever they switch targets
    if (m && m.ramp && (!t || t.id !== u.rampTarget)) { u.rampT = 0; u.rampTarget = t ? t.id : null; }

    if (u.windupT > 0) {
      // Wind-up can only be cancelled if the target is lost
      if (!t || edgeDist(u, t) > u.range + 0.5) {
        u.windupT = 0;
        return;
      }
      u.windupT -= dt * k;
      faceToward(u, t.x, t.y, dt);
      if (u.windupT <= 0) fireAttack(state, u, t);
      return;
    }

    if (t && inAttackRange(u, t)) {
      u.vx = 0;
      u.vy = 0;
      u.stuckT = 0;
      faceToward(u, t.x, t.y, dt);
      if (m && m.ramp) u.rampT += dt * k;
      if (u.atkCd <= 0) {
        u.locked = true;
        u.atkCd = u.cd;
        const w = windupOf(u);
        if (w > 0) u.windupT = w;
        else fireAttack(state, u, t);
      }
      return;
    }
    if (m && m.ramp) u.rampT = 0;
    if (m && m.dash && t && startDash(state, u, t)) return;

    if (!u.building && t) moveToward(state, u, t, dt, k);
  }

  // ─── Evolution mechanics ─────────────────────────────────────────────────
  //
  // Each evolved unit carries `u.em` (its Evolution's mech config). These hooks are called from the
  // normal update/attack/projectile/death code, so evolved behaviour goes through the same damage,
  // targeting and status rules as everything else.

  // Periodic effects of an evolved unit (called while it is active and not stunned)
  function updateEvolvedUnit(state, u, dt) {
    const em = u.em;
    if (em.allyShield) {
      u.shieldT -= dt;
      if (u.shieldT <= 0) {
        u.shieldT = em.allyShield.every;
        bastionPulse(state, u, em.allyShield);
      }
    }
  }

  // Bastion: shield the nearest friendly troops (never more than `max`, never stacking past `amount`)
  function bastionPulse(state, u, cfg) {
    const amount = Math.round(cfg.amount * u.lvlScale);
    const near = [];
    queryHash(state, u.x, u.y, cfg.radius, (e) => {
      if (e === u || e.owner !== u.owner || e.kind !== 'troop' || e.hp <= 0) return; // allies only
      const d = dist(u.x, u.y, e.x, e.y);
      if (d <= cfg.radius) near.push({ e, d });
    });
    near.sort((a, b) => a.d - b.d);
    const pts = [];
    near.slice(0, cfg.max).forEach(({ e }) => {
      e.shield = Math.max(e.shield || 0, amount);
      e.shieldMax = Math.max(e.shieldMax || 0, e.shield);
      pts.push({ x: r2(e.x), y: r2(e.y) });
    });
    pushFx(state, { type: 'bastion', x: u.x, y: u.y, owner: u.owner, r: cfg.radius, pts });
  }

  // Damage multiplier for this hit from stacking drills and opening dives
  function evoDamageMult(state, u, t) {
    const em = u.em;
    let mult = 1;
    if (em.stackHits) {
      if (u.stackTarget === t.id) u.stack = Math.min(em.stackHits.max, u.stack + 1);
      else { u.stack = 0; u.stackTarget = t.id; }
      mult *= 1 + em.stackHits.per * u.stack;
    }
    if (em.dive && u.diveCd <= 0) {
      mult *= em.dive.mult;
      u.diveCd = em.dive.cd;
      u.divedAt = state.time;
      pushFx(state, { type: 'dive', x: u.x, y: u.y, x2: t.x, y2: t.y, owner: u.owner });
    }
    return mult;
  }

  // Splash + knockback ring (Juggernaut's quake around its target, Arc Turret's pulse around itself).
  // Ground troops only; buildings and towers take the damage but don't move.
  function shockwave(state, u, x, y, cfg, fxType) {
    const hit = splashDamage(state, damageSource(u), x, y, cfg.radius, u.dmg * cfg.dmgMult, false);
    hit.forEach((e) => {
      if (e.kind === 'troop' && !e.air && e.hp > 0 && cfg.knock) knockBack(state, e, x, y, cfg.knock);
    });
    pushFx(state, { type: fxType, x, y, r: cfg.radius, owner: u.owner });
  }

  // Prism Lance: instant beam through every enemy on the line from the shooter to full range.
  // Each enemy is hit at most once; the first takes full damage, the rest `falloff`.
  function pierceLine(state, u, t, dmg) {
    const cfg = u.em.pierceLine;
    const dx = t.x - u.x;
    const dy = t.y - u.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    const len = u.range + u.radius + 0.6;
    const ex = u.x + ux * len;
    const ey = u.y + uy * len;
    const hits = [];
    queryHash(state, (u.x + ex) / 2, (u.y + ey) / 2, len / 2 + 1, (e) => {
      if (!canTarget(u, e)) return;
      const along = (e.x - u.x) * ux + (e.y - u.y) * uy;
      if (along < -0.3 || along > len + (e.half || e.radius)) return;
      const off = Math.abs((e.x - u.x) * uy - (e.y - u.y) * ux);
      if (off - (e.half || e.radius) > cfg.width) return;
      hits.push({ e, along });
    });
    hits.sort((a, b) => a.along - b.along);
    const src = damageSource(u);
    hits.forEach(({ e }, i) => applyDamage(state, src, e, i === 0 ? dmg : dmg * cfg.falloff));
    pushFx(state, { type: 'pierce', x: u.x, y: u.y, x2: ex, y2: ey, owner: u.owner });
  }

  // Cluster Pod: the fireball's impact scatters bomblets; a shared hit set means one bomblet per enemy
  function scatterCluster(state, p) {
    const cfg = p.cluster;
    const exclude = new Set();
    const base = Math.atan2(p.ty - p.sy, p.tx - p.sx);
    for (let i = 0; i < cfg.count; i++) {
      const a = base + ((i - (cfg.count - 1) / 2) * Math.PI * 2) / cfg.count;
      const tx = clamp(p.tx + Math.cos(a) * cfg.spread, 0.3, W - 0.3);
      const ty = clamp(p.ty + Math.sin(a) * cfg.spread, 0.3, H - 0.3);
      state.projectiles.push({
        id: `p${state.nextId++}`, owner: p.owner, source: p.source, style: 'bomblet',
        x: p.tx, y: p.ty, sx: p.tx, sy: p.ty, tx, ty, targetId: null,
        homing: false, lob: true, speed: 7, dmg: p.dmg * cfg.dmgMult / (1), splash: cfg.radius,
        canHitAir: p.canHitAir, chain: false, delay: 0, slow: null, chainN: 0, chainStun: 0,
        impactZone: null, cluster: null, exclude, evo: true,
      });
    }
  }

  // A zone made by an Evolution (craters, burning ground, aftershocks). Same fields as addZone.
  function makeZone(state, z) {
    const zone = Object.assign({
      id: `z${state.nextId++}`, kind: 'slow', owner: 'A', cardId: null, x: 0, y: 0, r: 1,
      dur: 0, age: 0, delay: 0, tick: 0, tickT: 0, ticks: 0, total: 0, towerMult: 0.3,
      slow: 0, haste: 0, pull: 0, stun: 0, knockback: 0, maxTargets: 0, count: 0, card: null,
      spawned: 0, level: 1, hit: null, done: false, evo: 0,
    }, z);
    state.zones.push(zone);
    return zone;
  }

  // Scrap Rally: when a pack member dies, its living packmates get a speed stack
  function rallyPack(state, dead) {
    const cfg = dead.em.rally;
    const mates = state.units.filter((o) => o.pack === dead.pack && o !== dead && o.hp > 0 && !o.dead);
    mates.forEach((o) => {
      const stacks = Math.min(cfg.max, Math.round((o.rally || 0) / cfg.per) + 1);
      o.rally = stacks * cfg.per;
    });
    if (mates.length) pushFx(state, { type: 'rally', x: dead.x, y: dead.y, owner: dead.owner, pts: mates.map((o) => ({ x: r2(o.x), y: r2(o.y) })) });
  }

  // ─── Mechanics ───────────────────────────────────────────────────────────

  // Spawner buildings: a token every `every` seconds (the first one comes a little sooner)
  function updateSpawner(state, u, dt) {
    const sp = u.mech.spawner;
    if (!u.spawnInit) { u.spawnInit = true; u.spawnT = sp.every * 0.6; }
    u.spawnT += dt;
    if (u.spawnT < sp.every) return;
    u.spawnT -= sp.every;
    const forward = u.owner === 'A' ? -1 : 1;
    const air = !!(CARD_MAP[sp.card] && CARD_MAP[sp.card].air);
    for (let i = 0; i < (sp.count || 1); i++) {
      const spot = spawnSpot(state, u.x, u.y + forward * (u.radius + 0.6), air, 0.9, state.nextId + i);
      if (spot) spawnToken(state, u.owner, sp.card, spot.x, spot.y, u.level, 0.25);
    }
  }

  function updateElixirPump(state, u, dt) {
    const g = u.mech.elixir;
    u.genT += dt;
    if (u.genT < g.every) return;
    u.genT -= g.every;
    giveElixir(state, u.owner, g.amount, u.x, u.y);
  }

  function giveElixir(state, side, amount, x, y) {
    const p = state.players[side];
    if (!p) return;
    p.elixir = clamp(p.elixir + amount, 0, MATCH.maxElixir);
    pushFx(state, { type: 'elixir', x, y, owner: side, amt: amount });
  }

  // Healers mend nearby friendly troops (not buildings) twice a second
  function updateHealer(state, u, dt) {
    u.healT -= dt;
    if (u.healT > 0) return;
    u.healT = 0.5;
    const h = u.mech.heal;
    const amount = h.perSec * 0.5 * u.lvlScale;
    const em = u.em;
    let healed = false;
    queryHash(state, u.x, u.y, h.radius, (e) => {
      if (e.owner !== u.owner || e.kind !== 'troop' || e.hp <= 0 || e.deployT > 0) return;
      if (dist(u.x, u.y, e.x, e.y) > h.radius) return;
      let amt = e === u ? amount * 0.5 : amount;
      // Field Surgeon: triage the badly hurt, clear slows, and shake off stuns/freezes faster
      if (em && em.triage && e.hp < e.hpMax * em.triage.below) amt *= em.triage.mult;
      if (em && em.cleanse && e !== u) {
        if (e.slowT > 0) { e.slowT = 0; healed = true; }
        if (e.stunT > 0) { e.stunT = Math.max(0, e.stunT - 0.25); e.frozenT = Math.max(0, (e.frozenT || 0) - 0.25); }
      }
      if (healEntity(state, e, amt) > 0) healed = true;
    });
    if (healed) u.healedAt = state.time;
  }

  // Decoys break enemy troops' lock-ons nearby every couple of seconds, so they come for it
  function updateTaunt(state, u, dt) {
    u.healT -= dt;
    if (u.healT > 0) return;
    u.healT = 2;
    queryHash(state, u.x, u.y, u.mech.taunt, (e) => {
      if (e.owner === u.owner || e.kind !== 'troop' || e.hp <= 0 || !canTarget(e, u)) return;
      if (edgeDist(e, u) > u.mech.taunt) return;
      e.locked = false;
      e.retargetT = 0;
    });
    pushFx(state, { type: 'taunt', x: u.x, y: u.y, owner: u.owner, r: u.mech.taunt });
  }

  // Dashers leap at targets a few tiles away, untouchable while dashing, and land a double hit
  function startDash(state, u, t) {
    const d = u.mech.dash;
    if (u.dashCd > 0 || u.air || u.locked) return false;
    const gap = edgeDist(u, t);
    if (gap < d.min || gap > d.max) return false;
    const ap = approachPoint(u, t);
    if (!lineClear(state.nav, u.x, u.y, ap.x, ap.y, false)) return false;
    u.dashing = { targetId: t.id, t: 0 };
    u.invuln = true;
    u.path = null;
    pushFx(state, { type: 'dash', x: u.x, y: u.y, owner: u.owner });
    return true;
  }

  function endDash(u) {
    u.dashing = null;
    u.invuln = false;
    u.dashCd = u.mech.dash.cd;
  }

  function updateDash(state, u, dt) {
    const t = state.byId.get(u.dashing.targetId);
    u.dashing.t += dt;
    if (!t || t.hp <= 0 || u.dashing.t > 1.2) { endDash(u); return; }
    const ap = approachPoint(u, t);
    const d = dist(u.x, u.y, ap.x, ap.y);
    const stepLen = u.mech.dash.speed * dt;
    faceToward(u, t.x, t.y, 1);
    if (d > stepLen && edgeDist(u, t) > u.range) {
      if (!moveEntity(state, u, u.x + ((ap.x - u.x) / d) * stepLen, u.y + ((ap.y - u.y) / d) * stepLen)) endDash(u);
      return;
    }
    if (d <= stepLen) moveEntity(state, u, ap.x, ap.y);
    endDash(u);
    u.lastAtkT = state.time;
    u.atkCd = u.cd;
    u.locked = true;
    u.targetId = t.id;
    applyDamage(state, damageSource(u), t, u.dmg * 2, true);
    pushFx(state, { type: 'charge', x: t.x, y: t.y, owner: u.owner });
  }

  function faceToward(u, x, y, dt) {
    const want = Math.atan2(y - u.y, x - u.x);
    let diff = want - u.face;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    u.face += diff * Math.min(1, dt * 10);
  }

  function moveToward(state, u, t, dt, rate) {
    const jump = u.special.includes('jump');
    let wx = t.x;
    let wy = t.y;

    if (!u.air) {
      const { x: ax, y: ay } = approachPoint(u, t);
      if (lineClear(state.nav, u.x, u.y, ax, ay, jump)) {
        u.path = null;
        wx = ax;
        wy = ay;
      } else {
        const stale = !u.path || u.pathTargetId !== t.id || state.time >= u.pathT || u.pathNav !== state.nav.version;
        if (stale) {
          u.path = findPath(state, u.x, u.y, t, u.range, u.radius, jump);
          u.pathTargetId = t.id;
          u.pathNav = state.nav.version;
          // Refresh paths to moving troops often; static objectives rarely. Failed searches wait too.
          u.pathT = state.time + (t.kind === 'troop' ? 0.5 : 2) + nextRandom(state) * 0.2;
        }
        if (u.path && u.path.length) {
          while (u.path.length > 1 && dist(u.x, u.y, u.path[0].x, u.path[0].y) < 0.35) u.path.shift();
          wx = u.path[0].x;
          wy = u.path[0].y;
        }
      }
    }

    let speed = u.speed * (rate || 1);
    if (u.special.includes('charge')) {
      if (u.charging) speed *= 1.7;
    }
    let dx = wx - u.x;
    let dy = wy - u.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;

    // Steer away from friends we're about to bump into (same layer only)
    let sx = 0;
    let sy = 0;
    queryHash(state, u.x, u.y, 1.5, (o) => {
      if (o === u || o.kind !== 'troop' || o.air !== u.air || o.owner !== u.owner) return;
      const ox = u.x - o.x;
      const oy = u.y - o.y;
      const od = Math.hypot(ox, oy);
      const min = u.radius + o.radius + 0.15;
      if (od > 0 && od < min) {
        const w = (min - od) / min;
        sx += (ox / od) * w;
        sy += (oy / od) * w;
      }
    });
    let desX = dx + sx * 0.8;
    let desY = dy + sy * 0.8;
    const dl = Math.hypot(desX, desY) || 1;
    desX = (desX / dl) * speed;
    desY = (desY / dl) * speed;

    // Smooth velocity so units turn instead of snapping direction
    const k = Math.min(1, dt * 8);
    u.vx += (desX - u.vx) * k;
    u.vy += (desY - u.vy) * k;
    faceToward(u, u.x + u.vx, u.y + u.vy, dt);

    const nx = clamp(u.x + u.vx * dt, u.radius, W - u.radius);
    const ny = clamp(u.y + u.vy * dt, u.radius, H - u.radius);
    const ox = u.x;
    const oy = u.y;
    if (u.air) {
      u.x = nx;
      u.y = ny;
    } else {
      // Ground units slide along walls; if we're somehow inside a blocked cell, let us out
      const freeHere = walkablePoint(state.nav, u.x, u.y, jump);
      if (!freeHere || walkablePoint(state.nav, nx, ny, jump)) { u.x = nx; u.y = ny; }
      else if (walkablePoint(state.nav, nx, u.y, jump)) u.x = nx;
      else if (walkablePoint(state.nav, u.x, ny, jump)) u.y = ny;
    }
    u.jumping = jump && isRiverPoint(u.x, u.y);

    const moved = dist(ox, oy, u.x, u.y);
    if (u.special.includes('charge')) {
      u.runDist += moved;
      if (!u.charging && u.runDist >= 2.5) u.charging = true;
    }
    // Stuck detection: barely moving while trying to move -> repath and sidestep
    if (moved < speed * dt * 0.25) {
      u.stuckT += dt;
      if (u.stuckT > 0.8) {
        u.stuckT = 0;
        u.pathT = Math.min(u.pathT, state.time + 0.3);
        const ang = nextRandom(state) * Math.PI * 2;
        const kx = u.x + Math.cos(ang) * 0.3;
        const ky = u.y + Math.sin(ang) * 0.3;
        if (u.air || walkablePoint(state.nav, kx, ky, jump)) { u.x = kx; u.y = ky; }
      }
    } else {
      u.stuckT = Math.max(0, u.stuckT - dt);
    }
  }

  // Push overlapping bodies apart. Heavier (bigger, attacking) units get pushed less.
  function resolveCollisions(state) {
    const nav = state.nav;
    for (const u of state.units) {
      if (u.hp <= 0 || u.building) continue;
      const jump = u.special.includes('jump');
      queryHash(state, u.x, u.y, 2.5, (o) => {
        if (o === u || o.hp <= 0 || o.air !== u.air) return;
        const isStatic = o.kind !== 'troop';
        if (!isStatic && o.id < u.id) return; // each troop pair once
        let dx = u.x - o.x;
        let dy = u.y - o.y;
        let d = Math.hypot(dx, dy);
        const min = u.radius + o.radius;
        if (d >= min) return;
        if (d < 1e-4) { const a = nextRandom(state) * Math.PI * 2; dx = Math.cos(a); dy = Math.sin(a); d = 1; }
        const nx = dx / d;
        const ny = dy / d;
        const overlap = min - Math.max(d, 1e-4);
        const mu = u.radius * u.radius * (u.locked ? 3 : 1);
        const mo = isStatic ? Infinity : o.radius * o.radius * (o.locked ? 3 : 1);
        const shareU = isStatic ? 1 : mo / (mu + mo);
        const shareO = isStatic ? 0 : 1 - shareU;
        const push = Math.min(overlap, 0.25);
        const ux = clamp(u.x + nx * push * shareU, u.radius, W - u.radius);
        const uy = clamp(u.y + ny * push * shareU, u.radius, H - u.radius);
        if (u.air || walkablePoint(nav, ux, uy, jump) || !walkablePoint(nav, u.x, u.y, jump)) { u.x = ux; u.y = uy; }
        if (shareO > 0) {
          const oj = o.special.includes('jump');
          const ox = clamp(o.x - nx * push * shareO, o.radius, W - o.radius);
          const oy = clamp(o.y - ny * push * shareO, o.radius, H - o.radius);
          if (o.air || walkablePoint(nav, ox, oy, oj) || !walkablePoint(nav, o.x, o.y, oj)) { o.x = ox; o.y = oy; }
        }
      });
    }
  }

  // ─── Towers ──────────────────────────────────────────────────────────────

  function updateTower(state, t, dt) {
    if (t.hp <= 0) return;
    if (t.frozenT > 0) t.frozenT -= dt;
    if (t.stunT > 0) { t.stunT -= dt; return; }
    t.atkCd -= dt;
    if (!t.active) return;
    let target = t.targetId ? state.byId.get(t.targetId) : null;
    const valid = (e) => e && e.hp > 0 && e.owner !== t.owner && e.kind !== 'tower' && !e.hidden && dist(t.x, t.y, e.x, e.y) - e.radius <= t.range;
    if (!valid(target)) {
      target = null;
      let bestD = Infinity;
      queryHash(state, t.x, t.y, t.range, (e) => {
        if (!valid(e)) return;
        const d = dist(t.x, t.y, e.x, e.y);
        if (d < bestD) { bestD = d; target = e; }
      });
    }
    t.targetId = target ? target.id : null;
    if (target && t.atkCd <= 0) {
      t.atkCd = t.cd;
      t.lastAtkT = state.time;
      launchProjectile(state, t, target, t.dmg, { style: t.tower === 'king' ? 'bolt' : 'arrow', splash: 0 });
    }
  }

  // ─── Projectiles ─────────────────────────────────────────────────────────

  function updateProjectiles(state, dt) {
    for (const p of state.projectiles) {
      if (p.done) continue;
      if (p.delay > 0) { p.delay -= dt; continue; }
      const t = state.byId.get(p.targetId);
      if (p.homing && t && t.hp > 0) { p.tx = t.x; p.ty = t.y; }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const d = Math.hypot(dx, dy);
      const stepLen = p.speed * dt;
      if (d > stepLen) {
        p.x += (dx / d) * stepLen;
        p.y += (dy / d) * stepLen;
        continue;
      }
      p.x = p.tx;
      p.y = p.ty;
      p.done = true;
      if (p.spell) {
        applySpell(state, p.owner, p.spell, p.tx, p.ty, p.splash, p.dmg);
      } else if (p.splash > 0) {
        const hit = splashDamage(state, p.source, p.tx, p.ty, p.splash, p.dmg, p.canHitAir, p.exclude);
        if (p.slow) hit.forEach((e) => setSlow(e, p.slow.mult, p.slow.dur));
        if (p.cluster) scatterCluster(state, p);
      } else if (t && t.hp > 0) {
        applyDamage(state, p.source, t, p.dmg);
        if (p.slow) setSlow(t, p.slow.mult, p.slow.dur);
        if (p.chainStun) stunEntity(t, p.chainStun, false);
        pushFx(state, { type: 'hit', x: p.tx, y: p.ty, owner: p.owner, style: p.style });
        if (p.chain) chainLightning(state, p, t);
      }
      if (p.impactZone) {
        const iz = p.impactZone;
        makeZone(state, { kind: iz.kind, owner: p.owner, cardId: 'siege', x: p.tx, y: p.ty, r: iz.radius, dur: iz.dur, slow: iz.slow, evo: 1 });
      }
    }
    state.projectiles = state.projectiles.filter((p) => !p.done);
  }

  function chainLightning(state, p, first) {
    const hit = new Set([first.id]);
    let from = first;
    for (let n = 0; n < (p.chainN || 2); n++) {
      let next = null;
      let bestD = Infinity;
      queryHash(state, from.x, from.y, 2.5, (e) => {
        if (hit.has(e.id) || e.hp <= 0 || e.owner === p.owner) return;
        if (e.air && !p.canHitAir) return;
        const d = dist(from.x, from.y, e.x, e.y);
        if (d <= 2.5 && d < bestD) { bestD = d; next = e; }
      });
      if (!next) break;
      hit.add(next.id);
      applyDamage(state, p.source, next, p.dmg * 0.7);
      pushFx(state, { type: 'chain', x: from.x, y: from.y, x2: next.x, y2: next.y, owner: p.owner });
      from = next;
    }
  }

  // ─── Deaths, crowns and the clock ────────────────────────────────────────

  function processDeaths(state) {
    let navDirty = false;
    // Death bombs can kill more units, so loop until nothing new dies
    for (let guard = 0; guard < 5; guard++) {
      let changed = false;
      const spawns = [];
      for (const u of state.units) {
        if (u.hp > 0 || u.dead) continue;
        u.dead = true;
        changed = true;
        if (u.building) navDirty = true;
        pushFx(state, { type: 'death', x: u.x, y: u.y, owner: u.owner, air: u.air, big: u.radius >= 0.6 || u.building, cardId: u.cardId });
        if (u.special.includes('deathBomb') && !u.kamikazed) {
          splashDamage(state, damageSource(u), u.x, u.y, 1.5, u.dmg * 0.6, false);
        }
        if (u.em && u.em.rally && u.pack) rallyPack(state, u);
        if (u.em && u.em.deathSummon) {
          spawns.push({ u, card: u.em.deathSummon.card, count: u.em.deathSummon.count });
          pushFx(state, { type: 'evolve', x: u.x, y: u.y, owner: u.owner, cardId: u.em.deathSummon.card, small: 1 });
        }
        const m = u.mech;
        if (!m) continue;
        if (m.deathSplash) splashDamage(state, damageSource(u), u.x, u.y, m.deathSplash.radius, m.deathSplash.dmg * u.lvlScale, false);
        if (m.deathSpawn) spawns.push({ u, card: m.deathSpawn.card, count: m.deathSpawn.count });
        if (m.spawner && m.spawner.onDeath && !(u.em && u.em.deathSummon && u.em.deathSummon.replaces)) spawns.push({ u, card: m.spawner.card, count: m.spawner.onDeath });
        if (m.elixir && m.elixir.onDeath) giveElixir(state, u.owner, m.elixir.onDeath, u.x, u.y);
      }
      // Spawn after the scan so the list isn't modified while we walk it. A destroyed building
      // still blocks the nav grid until it is rebuilt, so free its footprint first.
      if (spawns.length && navDirty) { rebuildObstacles(state); navDirty = false; }
      for (const s of spawns) {
        const air = !!(CARD_MAP[s.card] && CARD_MAP[s.card].air);
        for (let i = 0; i < s.count; i++) {
          const spot = spawnSpot(state, s.u.x, s.u.y, air, Math.max(0.9, s.u.radius + 0.4), i * 3 + 1);
          if (!spot) continue;
          const off = air ? { x: Math.cos(i * 2.4) * 0.5, y: Math.sin(i * 2.4) * 0.5 } : { x: 0, y: 0 };
          spawnToken(state, s.u.owner, s.card, spot.x + off.x, spot.y + off.y, s.u.level, 0.35);
        }
      }
      if (!changed) break;
    }
    state.units = state.units.filter((u) => {
      if (u.dead) { state.byId.delete(u.id); return false; }
      return true;
    });

    for (const t of state.towers) {
      if (t.hp > 0 || t.destroyed) continue;
      t.hp = 0;
      t.destroyed = true;
      navDirty = true;
      const foe = enemyOf(t.owner);
      pushFx(state, { type: 'tower', x: t.x, y: t.y, owner: t.owner, king: t.tower === 'king' });
      if (t.tower === 'king') {
        state.players[foe].crowns = 3;
        endMatch(state, foe, 'king');
      } else {
        state.players[foe].crowns += 1;
        const king = state.towers.find((k) => k.owner === t.owner && k.tower === 'king');
        if (king && king.hp > 0) wakeKing(state, king);
      }
      pushFx(state, { type: 'crown', owner: foe, crowns: state.players[foe].crowns });
    }
    if (navDirty) rebuildObstacles(state);
  }

  function endMatch(state, winner, reason) {
    if (!state.running) return;
    state.running = false;
    state.winner = winner;
    state.endReason = reason;
    state.projectiles = [];
    state.zones = [];
  }

  function lowestTowerFraction(state, side) {
    let low = 1;
    state.towers.forEach((t) => { if (t.owner === side) low = Math.min(low, t.hp / t.hpMax); });
    return low;
  }

  function updateClock(state) {
    if (!state.running) return;
    const a = state.players.A.crowns;
    const b = state.players.B.crowns;
    if (state.phase === 'regular' && state.time >= MATCH.regulation) {
      if (a !== b) { endMatch(state, a > b ? 'A' : 'B', 'crowns'); return; }
      state.phase = 'overtime';
    }
    if (state.phase === 'overtime') {
      if (a !== b) { endMatch(state, a > b ? 'A' : 'B', 'overtime'); return; }
      if (state.time >= MATCH.regulation + MATCH.overtime) {
        // Tiebreaker: whoever's weakest tower has more health left wins
        const la = lowestTowerFraction(state, 'A');
        const lb = lowestTowerFraction(state, 'B');
        if (Math.abs(la - lb) < 0.001) endMatch(state, 'draw', 'tiebreak');
        else endMatch(state, la > lb ? 'A' : 'B', 'tiebreak');
      }
    }
  }

  function elixirMultiplier(state) {
    return state.time >= MATCH.doubleElixirAt ? 2 : 1;
  }

  function timeLeft(state) {
    const end = state.phase === 'overtime' ? MATCH.regulation + MATCH.overtime : MATCH.regulation;
    return Math.max(0, end - state.time);
  }

  /** Advance the match by one fixed step (MATCH.step seconds). */
  function step(state, dtIn) {
    const dt = dtIn || MATCH.step;
    if (!state.running) return;
    state.time += dt;

    const mult = elixirMultiplier(state);
    ['A', 'B'].forEach((side) => {
      const p = state.players[side];
      p.elixir = clamp(p.elixir + MATCH.elixirPerSec * mult * dt, 0, MATCH.maxElixir);
    });

    buildHash(state);
    // Stagger update order each step so no side always moves first
    const order = state.units.slice();
    if (Math.floor(state.time / dt) % 2) order.reverse();
    for (const u of order) updateUnit(state, u, dt);
    buildHash(state);
    resolveCollisions(state);
    for (const t of state.towers) updateTower(state, t, dt);
    updateZones(state, dt);
    updateProjectiles(state, dt);
    processDeaths(state);
    updateClock(state);
  }

  // ─── Snapshot (what clients draw) ────────────────────────────────────────

  function snapshot(state) {
    const player = (p) => {
      const cooldownsRemaining = {};
      Object.keys(p.cooldowns).forEach((k) => { cooldownsRemaining[k] = r2(Math.max(0, p.cooldowns[k] - state.time)); });
      return {
        elixir: r2(p.elixir),
        crowns: p.crowns,
        hand: p.hand.slice(),
        next: p.queue[0] || null,
        cooldownsRemaining,
        dmg: Math.round(p.damageDealt),
        played: p.cardsPlayed,
        evoPlayed: p.evoPlayed,
        // Evolution charge per equipped card: [charge, need]. Both players see both (like the real game).
        evo: Object.fromEntries(Object.keys(p.evo).map((id) => [id, [p.evo[id].charge, p.evo[id].need]])),
      };
    };
    const since = (t) => r2(Math.min(9, state.time - t));
    return {
      time: r2(state.time),
      running: state.running,
      winner: state.winner,
      endReason: state.endReason,
      phase: state.phase,
      timeLeft: r2(timeLeft(state)),
      double: elixirMultiplier(state) > 1,
      units: state.units.map((u) => ({
        id: u.id, owner: u.owner, cardId: u.cardId,
        x: r2(u.x), y: r2(u.y),
        hp: Math.round(Math.max(0, u.hp)), hpMax: u.hpMax,
        radius: u.radius, air: u.air, building: u.building,
        face: r2(u.face),
        dep: r2(Math.max(0, u.deployT)),
        atk: since(u.lastAtkT),
        wind: u.windupT > 0 ? 1 : 0,
        hit: since(u.hitT),
        chg: u.charging ? 1 : 0,
        stn: u.stunT > 0 ? 1 : 0,
        jmp: u.jumping ? 1 : 0,
        melee: u.proj === 'melee' ? 1 : 0,
        // Status effects and mechanics (left out when not in use, to keep online updates small)
        frz: u.frozenT > 0 ? 1 : undefined,
        slw: u.slowT > 0 ? 1 : undefined,
        hst: u.hasteT > 0 ? 1 : undefined,
        shd: u.shieldMax ? r2(u.shield / u.shieldMax) : undefined,
        hid: u.hidden ? 1 : undefined,
        inv: u.invuln ? 1 : undefined,
        tgt: u.mech && u.mech.ramp && u.rampTarget && state.time - u.lastAtkT < 0.6 ? u.rampTarget : undefined,
        rmp: u.mech && u.mech.ramp ? r2(Math.min(1, u.rampT / u.mech.ramp)) : undefined,
        hl: state.time - u.healedAt < 0.5 ? 1 : undefined,
        evo: u.evo ? 1 : undefined,
        dv: u.evo && state.time - u.divedAt < 0.5 ? 1 : undefined,
        stk: u.em && u.em.stackHits && u.stack ? u.stack : undefined,
        rly: u.rally ? r2(u.rally) : undefined,
      })),
      towers: state.towers.map((t) => ({
        id: t.id, owner: t.owner, tower: t.tower, x: t.x, y: t.y,
        hp: Math.round(Math.max(0, t.hp)), hpMax: t.hpMax, active: t.active, half: t.half,
        atk: since(t.lastAtkT), hit: since(t.hitT), stn: t.stunT > 0 ? 1 : 0,
        frz: t.frozenT > 0 ? 1 : undefined,
      })),
      zones: state.zones.map((z) => ({
        id: z.id, kind: z.kind, owner: z.owner, cardId: z.cardId,
        x: r2(z.x), y: r2(z.y), r: z.r,
        age: r2(z.age), dur: r2(z.dur || 0), wait: z.delay > 0 ? r2(z.delay) : 0,
        back: z.returning ? 1 : undefined,
        evo: z.evo ? 1 : undefined,
      })),
      projectiles: state.projectiles.filter((p) => !(p.delay > 0)).map((p) => {
        const total = dist(p.sx, p.sy, p.tx, p.ty) || 1;
        return {
          id: p.id, owner: p.owner, style: p.style,
          x: r2(p.x), y: r2(p.y),
          lob: p.lob ? r2(clamp(1 - dist(p.x, p.y, p.tx, p.ty) / total, 0, 1)) : null,
          evo: p.evo ? 1 : undefined,
          tx: p.spell ? r2(p.tx) : undefined,
          ty: p.spell ? r2(p.ty) : undefined,
        };
      }),
      players: { A: player(state.players.A), B: player(state.players.B) },
    };
  }

  function takeFx(state) {
    const fx = state.fx;
    state.fx = [];
    return fx;
  }

  // ─── AI opponent (rule based, sees only what a player could see) ─────────

  function createAi(side, profile, seed) {
    let rng = Math.random;
    if (seed != null) {
      const box = { seed: seed | 0 };
      rng = () => nextRandom(box);
    }
    return {
      side,
      profile: Object.assign({ thinkMin: 0.5, thinkMax: 0.6, strategicChance: 0.7, aggression: 0.35, leakAt: 9.3, emoteChance: 0.55 }, profile || {}),
      thinkT: 1.5,
      rand: rng,
      // What the AI has *seen* the opponent spend (it can't see their elixir, so it estimates)
      foeElixir: MATCH.startElixir,
      seenSeq: 0,
      emo: { init: false, mine: 3, theirs: 3, scanT: 0, peakThreat: 0, queued: null, lastAt: -99, seenEmoteT: -1, endDone: false },
    };
  }

  function idSeq(id) { return Number(String(id).slice(1)) || 0; }

  // Track the opponent's elixir from what they visibly play (troops landing, spells flying)
  function trackFoeElixir(state, brain, dt) {
    const foe = enemyOf(brain.side);
    brain.foeElixir = clamp(brain.foeElixir + MATCH.elixirPerSec * elixirMultiplier(state) * dt, 0, MATCH.maxElixir);
    let maxSeq = brain.seenSeq;
    for (const u of state.units) {
      if (u.owner !== foe) continue;
      const n = idSeq(u.id);
      if (n <= brain.seenSeq) continue;
      if (n > maxSeq) maxSeq = n;
      brain.foeElixir -= u.costShare; // swarm members each carry their share of the card's cost
    }
    // Spells: every cast is visible (a projectile, a zone, or an instant blast)
    for (const c of state.castLog) {
      if (c.owner !== foe || c.seq <= brain.seenSeq) continue;
      if (c.seq > maxSeq) maxSeq = c.seq;
      brain.foeElixir -= c.cost;
    }
    brain.seenSeq = maxSeq;
    brain.foeElixir = Math.max(0, brain.foeElixir);
  }

  // Emotes that react to what just happened, with a human-ish delay and plenty of restraint
  function aiEmotes(state, brain, dt) {
    const em = brain.emo;
    const side = brain.side;
    const foe = enemyOf(side);
    const pick = (list) => list[Math.floor(brain.rand() * list.length)];
    const towersUp = (s) => state.towers.reduce((n, t) => n + (t.owner === s && t.hp > 0 ? 1 : 0), 0);
    if (!state.running) {
      if (em.endDone) return;
      em.endDone = true;
      const id = state.winner === side ? pick(['celebrate', 'king', 'laugh']) : state.winner === 'draw' ? 'gg' : pick(['gg', 'cry', 'facepalm']);
      emote(state, side, id);
      return;
    }
    const mine = towersUp(side);
    const theirs = towersUp(foe);
    if (!em.init) { em.init = true; em.mine = mine; em.theirs = theirs; }
    const chance = brain.profile.emoteChance;
    let want = null;
    if (theirs < em.theirs) want = pick(['laugh', 'celebrate', 'king', 'cool']);
    else if (mine < em.mine) want = pick(['angry', 'cry', 'surprised', 'facepalm']);
    em.mine = mine;
    em.theirs = theirs;

    // A big push that got wiped out without costing a tower: "nice try"
    em.scanT -= dt;
    if (!want && em.scanT <= 0) {
      em.scanT = 0.5;
      const threat = laneSummary(state, side, 0).threatValue + laneSummary(state, side, 1).threatValue;
      if (threat > em.peakThreat) em.peakThreat = threat;
      if (threat < 0.5 && em.peakThreat >= 6) { want = pick(['cool', 'thumbs', 'laugh']); em.peakThreat = 0; }
      else if (threat < 0.5) em.peakThreat = 0;
    }
    // Sometimes answer the opponent's emote
    const le = state.lastEmote;
    if (!want && le && le.side === foe && le.time > em.seenEmoteT) {
      em.seenEmoteT = le.time;
      if (brain.rand() < chance * 0.5) want = le.id === 'laugh' || le.id === 'king' ? pick(['angry', 'laugh', 'cool']) : pick(['thumbs', 'laugh', 'gg']);
    }
    if (want && !em.queued && state.time - em.lastAt > 6 && brain.rand() < chance) {
      em.queued = { id: want, at: state.time + 0.6 + brain.rand() * 0.9 };
    }
    if (em.queued && state.time >= em.queued.at) {
      if (emote(state, side, em.queued.id).ok) em.lastAt = state.time;
      em.queued = null;
    }
  }

  function ownHalf(side, y) { return side === 'A' ? y >= RIVER.y1 : y < RIVER.y0; }
  function toward(side, y, amount) { return side === 'A' ? y + amount : y - amount; } // toward own back line

  function laneSummary(state, side, laneIdx) {
    const foe = enemyOf(side);
    const inLane = (u) => (laneIdx === 0 ? u.x < MID_X : u.x >= MID_X);
    // Enemies that crossed the river or are about to
    const threats = state.units.filter((u) => u.owner === foe && u.hp > 0 && !u.building && inLane(u)
      && (side === 'A' ? u.y > RIVER.y0 - 3 : u.y < RIVER.y1 + 3));
    const defenders = state.units.filter((u) => u.owner === side && u.hp > 0 && inLane(u) && ownHalf(side, u.y) && u.targets !== 'buildings');
    // Evolved enemies are worth more attention than their elixir cost suggests
    const value = (list) => list.reduce((s, u) => s + u.costShare * (u.hp / u.hpMax) * (u.evo ? 1.35 : 1), 0);
    let lead = null;
    threats.forEach((u) => { if (!lead || (side === 'A' ? u.y > lead.y : u.y < lead.y)) lead = u; });
    return {
      threats,
      threatValue: value(threats),
      defenseValue: value(defenders),
      air: threats.filter((u) => u.air).length,
      ground: threats.filter((u) => !u.air).length,
      count: threats.length,
      tank: threats.some((u) => u.hpMax >= 500 || u.targets === 'buildings'),
      lead,
    };
  }

  function findDeploySpot(state, side, card, x, y) {
    if (canDeploy(state, side, x, y, card)) return { x, y };
    for (let ring = 0.5; ring <= 3; ring += 0.5) {
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        const px = clamp(x + Math.cos(ang) * ring, 0.6, W - 0.6);
        const py = clamp(y + Math.sin(ang) * ring, 0.6, H - 0.6);
        if (canDeploy(state, side, px, py, card)) return { x: px, y: py };
      }
    }
    return null;
  }

  // Rough damage per second a card brings (ramp-up beams counted near full heat)
  function dps(c) {
    if (c.targets === 'none') return 0;
    const ramp = c.mech && c.mech.ramp ? 6 : 1;
    return (c.dmgScaled * ramp * (c.swarmCount || 1)) / c.cd;
  }
  const isPump = (c) => !!(c.mech && c.mech.elixir);
  const isSiegeBuilding = (c) => c.building && c.range >= 9;
  const isSpawner = (c) => !!(c.mech && c.mech.spawner);
  const isTaunt = (c) => !!(c.mech && c.mech.taunt);
  const hitsAir = (c) => c.targets === 'any' || c.targets === 'air' || (isSpawner(c) && CARD_MAP[c.mech.spawner.card] && CARD_MAP[c.mech.spawner.card].targets === 'any');

  function chooseDefender(state, brain, options, lane) {
    const smart = brain.rand() < brain.profile.strategicChance;
    let best = null;
    let bestScore = -Infinity;
    options.forEach((c) => {
      if (c.spell || isPump(c) || isSiegeBuilding(c)) return;
      if (c.targets === 'buildings' && !c.building) return; // win conditions don't defend
      if (c.targets === 'air' && lane.air === 0) return;    // anti-air only troops need flyers
      // Pure air threats need something that can reach them (decoys still pull them away)
      if (lane.ground === 0 && lane.air > 0 && !hitsAir(c) && !isTaunt(c)) return;
      let s = 0;
      if (smart) {
        if (lane.air > 0 && hitsAir(c)) s += 3;
        if (lane.air > 0 && c.targets === 'air') s += 3;
        if (lane.air > 0 && !hitsAir(c)) s -= 3;
        if (lane.count >= 3 && c.splash > 0) s += 4;
        if (lane.tank && dps(c) >= 120) s += 3;
        if (lane.tank && c.building) s += 3;
        if (lane.tank && c.mech && c.mech.ramp) s += 4;
        if (lane.tank && (isTaunt(c) || isSpawner(c))) s += 2;
        if (lane.count >= 3 && c.swarmCount >= 3 && !c.splash) s -= 1;
        s -= Math.abs(c.cost - lane.threatValue) * 0.6;
      }
      s -= c.cost * 0.25;
      if (smart && evoReady(state.players[brain.side], c.id)) s += 1.2; // an evolved defender is worth more
      s += brain.rand() * (smart ? 0.8 : 4);
      if (s > bestScore) { bestScore = s; best = c; }
    });
    return best;
  }

  // Where a defensive building goes: in the threatened lane, a few tiles back from the river and
  // toward the middle, so attackers heading for the tower get pulled across
  function defenseBuildingSpot(side, laneIdx) {
    const laneX = TOWER_LAYOUT.princessX[laneIdx];
    return { x: laneX + (laneIdx === 0 ? 2.6 : -2.6), y: side === 'A' ? RIVER.y1 + 3.6 : RIVER.y0 - 3.6 };
  }

  // Damage-style value of hitting enemy e for `d`: kills are worth the unit's cost, chip less
  function hitValue(e, d) {
    return e.hp <= d ? e.costShare * (e.hp / e.hpMax + 0.3) : e.costShare * (Math.min(d, e.hp) / e.hpMax) * 0.6;
  }

  // How good would casting spell c at pt be? Returns { value, count }.
  function spellValue(state, brain, c, pt, ctx) {
    const side = brain.side;
    const kind = c.zone ? c.zone.kind : c.proj;
    const r = c.splash;
    const towerDmg = c.dmgScaled * c.towerMult;
    let value = 0;
    let count = 0;
    const near = (e) => dist(pt.x, pt.y, e.x, e.y) - e.radius <= r * 0.9;
    const towersIn = ctx.enemyTowers.filter((t) => boxDist(pt.x, pt.y, t) <= r);

    if (kind === 'haste' || kind === 'heal') {
      for (const u of ctx.mine) {
        if (!near(u) || u.building && kind === 'heal' && u.lifetime) continue;
        if (kind === 'heal') {
          const missing = u.hpMax - u.hp;
          if (missing < u.hpMax * 0.2) continue;
          value += (Math.min(missing, c.dmgScaled) / u.hpMax) * u.costShare * 1.1;
          count++;
        } else if (u.targetId) {
          // Haste pays off for troops already fighting or about to hit a tower
          const t = state.byId.get(u.targetId);
          if (!t || edgeDist(u, t) > u.range + 3) continue;
          value += u.costShare * (t.kind === 'tower' ? 0.9 : 0.5);
          count++;
        }
      }
      return { value, count };
    }

    if (kind === 'spawn') {
      // Offense only: drop on an enemy tower that has little protecting it
      const tower = towersIn[0];
      if (!tower) return { value: 0, count: 0 };
      const guard = ctx.enemies.filter((e) => dist(e.x, e.y, tower.x, tower.y) < 6).reduce((s, e) => s + e.costShare, 0);
      value = Math.max(0, 7 - guard * 1.5) + (brain.foeElixir < 3 ? 1.5 : 0) - (ctx.underThreat ? 4 : 0);
      return { value, count: value > 0 ? 3 : 0 };
    }

    if (kind === 'slow') {
      for (const e of ctx.enemies) {
        if (!near(e) || e.building) continue;
        if (!ownHalf(side, e.y) && !ctx.myPushNear(e)) continue;
        value += e.costShare * 0.45;
        count++;
      }
      return { value, count };
    }

    if (kind === 'roll') {
      const dir = side === 'A' ? -1 : 1;
      for (const e of ctx.enemies) {
        if (e.air || e.building) continue;
        const along = (e.y - pt.y) * dir;
        if (along < -0.5 || along > c.zone.length) continue;
        if (Math.abs(e.x - pt.x) > r + e.radius) continue;
        value += hitValue(e, c.dmgScaled) + 0.15;
        count++;
      }
      return { value, count };
    }

    if (kind === 'laser') {
      const pool = ctx.enemies.filter(near).sort((a, b) => b.hp - a.hp).slice(0, c.zone.targets);
      pool.forEach((e) => { value += hitValue(e, c.dmgScaled) * (e.hp > 600 ? 1.2 : 1); count++; });
      towersIn.forEach((t) => { value += t.hp <= towerDmg ? 20 : (towerDmg / t.hpMax) * 8; });
      return { value, count: count >= 1 ? Math.max(2, count) : 0 };
    }

    // Damage spells (Fire Bomb, Shock, Rocket Rain, Frost Nova, Acid Pool, Gravity Well)
    const dmg = c.dmgScaled * (kind === 'dot' ? 0.8 : 1);
    for (const e of ctx.enemies) {
      if (!near(e)) continue;
      count++;
      value += hitValue(e, dmg);
      if (c.stun && (e.charging || e.windupT > 0 || e.building || (e.mech && (e.mech.chargeShot || e.mech.ramp)))) value += 0.4;
      // A freeze buys time on defense, or a free window for our own push
      if (c.freeze) value += e.costShare * (ownHalf(side, e.y) ? 0.45 : 0.25);
      if (kind === 'pull' && !e.building) value += 0.25;
    }
    for (const t of towersIn) {
      value += t.hp <= towerDmg ? 20 : (towerDmg / t.hpMax) * 8;
      // Freezing a tower while our troops are on it is worth a lot
      if (c.freeze && ctx.mine.some((u) => !u.building && dist(u.x, u.y, t.x, t.y) < 5)) value += 4;
    }
    if (kind === 'pull' && count >= 3) value += 1.5;
    return { value, count };
  }

  // Best place (and spell) to cast: lead moving targets by the flight time; value what it would do
  function planSpell(state, brain, options, ctx) {
    const spells = options.filter((c) => c.spell);
    if (!spells.length) return null;
    const side = brain.side;
    const smart = brain.rand() < brain.profile.strategicChance;
    const king = state.towers.find((t) => t.owner === side && t.tower === 'king');
    let best = null;
    for (const c of spells) {
      const kind = c.zone ? c.zone.kind : c.proj;
      const flies = !c.instant && !c.zone && c.proj !== 'shock';
      const points = [];
      if (kind === 'haste' || kind === 'heal') {
        ctx.mine.forEach((u) => { if (!u.building || kind === 'haste') points.push({ x: u.x, y: u.y }); });
      } else if (kind === 'spawn') {
        ctx.enemyTowers.forEach((t) => points.push({ x: t.x, y: t.y + (side === 'A' ? 2.2 : -2.2) }));
      } else {
        for (const e of ctx.enemies) {
          const t = flies && king ? dist(king.x, king.y, e.x, e.y) / (PROJ_SPEED[c.proj] || 15) + (c.waves > 1 ? 0.2 : 0) : 0.1;
          const lead = kind === 'roll' ? (side === 'A' ? 0.9 : -0.9) : 0;
          points.push({ x: e.x + e.vx * t * 0.8, y: e.y + e.vy * t * 0.8 + lead });
        }
        const towerDmg = c.dmgScaled * c.towerMult;
        ctx.enemyTowers.forEach((t) => { if (t.hp <= towerDmg || c.freeze) points.push({ x: t.x, y: t.y }); });
      }
      for (const pt of points) {
        const { value: raw, count } = spellValue(state, brain, c, pt, ctx);
        // An evolved spell does more (burning ground, aftershock, homing rockets)
        let value = raw * (evoReady(state.players[side], c.id) ? 1.25 : 1);
        // Prefer clearing threats on our own side of the river
        if (ownHalf(side, pt.y) && kind !== 'spawn') value *= 1.15;
        const need = c.cost * (smart ? 1.05 : 1.5);
        const enough = kind === 'spawn' || kind === 'haste' || kind === 'heal' ? count >= 1 : (count >= 2 || value >= 20);
        if (enough && value >= need && (!best || value - c.cost > best.score)) {
          best = { cardId: c.id, x: clamp(pt.x, 0.6, W - 0.6), y: clamp(pt.y, 0.6, H - 0.6), score: value - c.cost };
        }
      }
    }
    return best;
  }

  function aiDecide(state, brain) {
    const side = brain.side;
    const foe = enemyOf(side);
    const p = state.players[side];
    const options = p.hand.map((id) => p.cards[id]).filter((c) => c && c.cost <= p.elixir && (p.cooldowns[c.id] || 0) <= state.time);
    if (options.length === 0) return null;
    const troops = options.filter((c) => !c.spell);

    const lanes = [laneSummary(state, side, 0), laneSummary(state, side, 1)];
    const mine = state.units.filter((u) => u.owner === side && u.hp > 0 && u.deployT <= 0.2);
    const ctx = {
      enemies: state.units.filter((u) => u.owner === foe && u.hp > 0 && u.deployT <= 0.2 && !u.hidden),
      enemyTowers: state.towers.filter((t) => t.owner === foe && t.hp > 0),
      mine,
      underThreat: lanes[0].threatValue + lanes[1].threatValue > 3,
      myPushNear: (e) => mine.some((u) => !u.building && dist(u.x, u.y, e.x, e.y) < 5),
    };

    // 0) A spell that pays for itself (or finishes a tower)
    const spell = planSpell(state, brain, options, ctx);
    if (spell) return spell;

    // 1) Defend the more dangerous lane if it isn't already covered
    const lanePick = lanes[0].threatValue - lanes[0].defenseValue >= lanes[1].threatValue - lanes[1].defenseValue ? 0 : 1;
    const lane = lanes[lanePick];
    const need = lane.threatValue - lane.defenseValue * 0.8;
    const leadDeep = lane.lead && (side === 'A' ? lane.lead.y > RIVER.y1 + 1 : lane.lead.y < RIVER.y0 - 1);
    if (lane.lead && (need >= 1.5 || (leadDeep && need > 0.5))) {
      const card = chooseDefender(state, brain, troops, lane);
      if (card) {
        const lead = lane.lead;
        const laneX = TOWER_LAYOUT.princessX[lanePick];
        let spot;
        if (isTaunt(card)) spot = { x: clamp(lead.x, 1.5, W - 1.5), y: toward(side, lead.y, 3.2) };
        else if (card.building) spot = defenseBuildingSpot(side, lanePick);
        else if (card.range >= 3 || card.targets === 'air') spot = { x: laneX, y: toward(side, TOWER_LAYOUT.princessY[side], 2.8) };
        else spot = { x: lead.x, y: toward(side, lead.y, 2.5) };
        spot.y = side === 'A' ? clamp(spot.y, RIVER.y1 + 0.6, H - 1) : clamp(spot.y, 1, RIVER.y0 - 0.6);
        const ok = findDeploySpot(state, side, card, spot.x, spot.y);
        if (ok) return { cardId: card.id, x: ok.x, y: ok.y };
      }
    }

    // 2) Offense: build a push in the weaker enemy lane; don't sit at full elixir
    const enemyPrincesses = [princessOf(state, foe, 0), princessOf(state, foe, 1)];
    let attackLane = 0;
    if (enemyPrincesses[0].hp <= 0) attackLane = 0;
    else if (enemyPrincesses[1].hp <= 0) attackLane = 1;
    else attackLane = enemyPrincesses[0].hp / enemyPrincesses[0].hpMax <= enemyPrincesses[1].hp / enemyPrincesses[1].hpMax ? 0 : 1;
    const laneX = TOWER_LAYOUT.princessX[attackLane];
    const bridgeY = side === 'A' ? RIVER.y1 + 0.8 : RIVER.y0 - 0.8;
    const myPush = state.units.filter((u) => u.owner === side && u.hp > 0 && !u.building && u.costShare > 0 && (attackLane === 0 ? u.x < MID_X : u.x >= MID_X));
    let tank = myPush.find((u) => u.hpMax >= 500 || u.targets === 'buildings');
    // Counter-push: surviving defenders heading for the bridge are worth backing up
    if (!tank) {
      const survivors = myPush.filter((u) => u.deployT <= 0 && (side === 'A' ? u.y < RIVER.y1 + 5 : u.y > RIVER.y0 - 5));
      if (survivors.reduce((sum, u) => sum + u.costShare * (u.hp / u.hpMax), 0) >= 3.5) tank = survivors[0];
    }

    const leaking = p.elixir >= brain.profile.leakAt;
    const doubleTime = elixirMultiplier(state) > 1;
    // Punish when the opponent has (visibly) just spent a lot
    const foeLow = brain.foeElixir < 3;
    const aggression = Math.min(0.95, brain.profile.aggression * (doubleTime ? 1.5 : 1) + (foeLow ? 0.3 : 0));
    const wantsPush = leaking || (p.elixir >= (foeLow ? 5 : 7) && brain.rand() < aggression);
    const calm = lanes[0].threatValue + lanes[1].threatValue < 0.5;

    // An elixir pump when things are quiet (and only one at a time)
    const pump = troops.find(isPump);
    if (pump && calm && p.elixir >= 7.5 && !mine.some((u) => u.mech && u.mech.elixir)) {
      const spot = findDeploySpot(state, side, pump, TOWER_LAYOUT.princessX[1 - attackLane] + (attackLane ? 1.5 : -1.5), side === 'A' ? H - 1.6 : 1.6);
      if (spot) return { cardId: pump.id, x: spot.x, y: spot.y };
    }

    // Support an existing tank that is heading over the river
    if (tank && p.elixir >= 4) {
      const support = troops
        .filter((c) => c.targets !== 'buildings' && c.targets !== 'air' && c.targets !== 'none' && !c.building && !c.anywhere)
        .sort((a, b) => (b.mech && b.mech.heal ? 1 : 0) - (a.mech && a.mech.heal ? 1 : 0) || (b.splash > 0) - (a.splash > 0) || b.range - a.range)[0];
      if (support) {
        const spot = findDeploySpot(state, side, support, tank.x, ownHalf(side, tank.y) ? toward(side, tank.y, 2) : bridgeY);
        if (spot) return { cardId: support.id, x: spot.x, y: spot.y };
      }
    }
    if (!wantsPush) return null;

    // Siege from our side of the river
    const siege = troops.find(isSiegeBuilding);
    if (siege && !mine.some((u) => u.building && u.range >= 9)) {
      const spot = findDeploySpot(state, side, siege, laneX + (attackLane === 0 ? 2.2 : -2.2), side === 'A' ? RIVER.y1 + 1.5 : RIVER.y0 - 1.5);
      if (spot) return { cardId: siege.id, x: spot.x, y: spot.y };
    }

    // Lead with an evolved win condition when one is ready
    const winCons = troops.filter((c) => !c.building && c.targets !== 'air' && (c.winCondition || c.hpScaled >= 600))
      .sort((a, b) => (evoReady(p, b.id) ? 1 : 0) - (evoReady(p, a.id) ? 1 : 0) || b.cost - a.cost);
    if (winCons.length && !tank) {
      const c = winCons[0];
      let spot;
      if (c.anywhere) {
        // Tunnel straight to the side of the target tower
        const target = enemyPrincesses[attackLane].hp > 0 ? enemyPrincesses[attackLane] : state.towers.find((t) => t.owner === foe && t.tower === 'king');
        spot = target ? findDeploySpot(state, side, c, target.x + (target.x < MID_X ? 2.2 : -2.2), target.y) : null;
      } else if (c.speed <= 1.0) {
        // Slow tanks start at the back to build elixir behind them; fast ones go straight to the bridge
        spot = findDeploySpot(state, side, c, laneX, side === 'A' ? H - 1.2 : 1.2);
      } else {
        spot = findDeploySpot(state, side, c, BRIDGES[attackLane].cx, bridgeY);
      }
      if (spot) return { cardId: c.id, x: spot.x, y: spot.y };
    }
    if (leaking) {
      // Avoid wasting elixir: cycle the cheapest useful card at the back
      // Prefer cards that charge an Evolution, so it comes round sooner
      const charging = (c) => (p.evo[c.id] && p.evo[c.id].charge < p.evo[c.id].need ? 1.5 : 0);
      const cheap = troops.filter((c) => !c.building && c.targets !== 'air').sort((a, b) => (a.cost - charging(a)) - (b.cost - charging(b)))[0];
      if (cheap) {
        const spot = findDeploySpot(state, side, cheap, cheap.targets === 'buildings' ? BRIDGES[attackLane].cx : laneX, cheap.targets === 'buildings' ? bridgeY : toward(side, TOWER_LAYOUT.princessY[side], 2.8));
        if (spot) return { cardId: cheap.id, x: spot.x, y: spot.y };
      }
      const spawner = troops.find((c) => isSpawner(c));
      if (spawner) {
        const s = defenseBuildingSpot(side, attackLane);
        const spot = findDeploySpot(state, side, spawner, s.x, s.y);
        if (spot) return { cardId: spawner.id, x: spot.x, y: spot.y };
      }
    }
    return null;
  }

  /**
   * A sensible 8-card deck for an AI opponent, using only cards available up to `maxArena`:
   * a win condition, a big and a small spell, usually a building, anti-air and splash, and a
   * reasonable average cost. `rand` is a () => [0,1) function.
   */
  function buildAiDeck(maxArena, rand) {
    const rnd = rand || Math.random;
    const bySlug = new Map();
    CARD_LIBRARY.forEach((c) => {
      if (c.token || c.arena > maxArena) return;
      const list = bySlug.get(c.slug) || [];
      list.push(c);
      bySlug.set(c.slug, list);
    });
    // One version per card family (the base version most of the time)
    const pool = [...bySlug.values()].map((list) => (list.length > 1 && rnd() < 0.4 ? list[1 + Math.floor(rnd() * (list.length - 1))] : list[0]));
    const deck = [];
    const used = new Set();
    const take = (list) => {
      const options = list.filter((c) => !used.has(c.slug));
      if (!options.length) return null;
      const c = options[Math.floor(rnd() * options.length)];
      used.add(c.slug);
      deck.push(c);
      return c;
    };
    const troops = pool.filter((c) => !c.spell && !c.building);
    take(troops.filter((c) => c.winCondition));
    take(pool.filter((c) => c.spell && !c.friendly && (c.dmg >= 150 || c.freeze || (c.zone && c.zone.kind === 'laser'))));
    take(pool.filter((c) => c.spell && !c.friendly && c.cost <= 3 && c.zone?.kind !== 'spawn'));
    if (rnd() < 0.75) take(pool.filter((c) => c.building && !isPump(c) && (rnd() < 0.7 ? !isSiegeBuilding(c) : true)));
    take(troops.filter((c) => c.targets === 'any' && c.splash > 0));
    take(troops.filter((c) => c.targets === 'any' || c.targets === 'air'));
    while (deck.length < MAX_DECK) {
      const extra = rnd() < 0.15 ? pool.filter((c) => c.spell || c.building) : troops.filter((c) => !c.winCondition || rnd() < 0.2);
      if (!take(extra) && !take(pool)) break;
    }
    // Keep the average cost playable
    const avg = () => deck.reduce((s, c) => s + c.cost, 0) / deck.length;
    for (let guard = 0; guard < 6 && avg() > 4.4; guard++) {
      const heavy = deck.filter((c) => !c.winCondition && !c.spell).sort((a, b) => b.cost - a.cost)[0];
      const cheap = troops.filter((c) => !used.has(c.slug) && c.cost <= 3).sort(() => rnd() - 0.5)[0];
      if (!heavy || !cheap) break;
      deck[deck.indexOf(heavy)] = cheap;
      used.delete(heavy.slug);
      used.add(cheap.slug);
    }
    return deck.map((c) => c.id);
  }

  // Which cards of an AI deck get Evolutions (the ones that have one, preferring the most impactful)
  function aiEvoPicks(deckIds, slots) {
    return deckIds.filter((id) => evolutionOf(id)).sort((a, b) => CARD_MAP[b].cost - CARD_MAP[a].cost).slice(0, Math.max(0, slots || 0));
  }

  /** Call every frame with the step size; returns the deploy result when the AI plays a card. */
  function aiUpdate(state, brain, dt) {
    aiEmotes(state, brain, dt);
    if (!state.running) return null;
    trackFoeElixir(state, brain, dt);
    brain.thinkT -= dt;
    if (brain.thinkT > 0) return null;
    const pr = brain.profile;
    brain.thinkT = pr.thinkMin + brain.rand() * (pr.thinkMax - pr.thinkMin);
    const plan = aiDecide(state, brain);
    if (!plan) return null;
    return deploy(state, brain.side, plan.cardId, plan.x, plan.y);
  }

  // Place a unit directly, skipping elixir/hand/zone rules (used by tests and sandboxes)
  function spawnDirect(state, side, cardId, x, y, level) {
    const stats = getCardStatsAtLevel(cardId, level || 1, false, 0);
    const u = spawnUnit(state, side, stats, x, y, 0, stats.cost / (stats.swarmCount || 1));
    if (u.building) rebuildObstacles(state);
    return u;
  }

  // Cast a spell directly, skipping elixir/hand rules (tests and sandboxes)
  function castDirect(state, side, cardId, x, y, level) {
    const stats = getCardStatsAtLevel(cardId, level || 1, false, 0);
    castSpell(state, side, stats, x, y);
    state.castLog.push({ seq: state.nextId++, owner: side, cost: stats.cost, cardId });
  }

  return {
    W, H, MID_X, RIVER, BRIDGES, TOWER_LAYOUT, MATCH, NAV_CELL, EMOTE_IDS, EMOTE_RULES,
    emote,
    spawnDirect,
    castDirect,
    ARCHETYPES, VARIANTS, CARD_LIBRARY, CARD_MAP, STARTER_DECK, MAX_DECK, RARITY_ORDER,
    getCardStatsAtLevel, towerStats, normalizeDeck,
    createMatch, step, deploy, canDeploy, canDeployOnSnapshot, inDeployZone, snapshot, takeFx, timeLeft,
    isRiverPoint, walkablePoint: (state, x, y, jump) => walkablePoint(state.nav, x, y, jump),
    findPath, enemyOf,
    createAi, aiUpdate, aiDecide, buildAiDeck, aiEvoPicks,
    TOKEN_CARDS, MAX_ARENA,
    EVOLUTIONS, EVO_RULES, evolutionOf, evoReady, evolvedStats,
  };
});
