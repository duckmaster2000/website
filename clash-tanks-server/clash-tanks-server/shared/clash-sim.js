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

  // Timers run down in float steps of MATCH.step: 0.3 - 6 x 0.05 leaves ~1e-17, not 0. Comparing
  // against this instead of 0 makes a 0.3 s wind-up land on its 6th step, not a step late.
  const TIME_EPS = 1e-6;

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
    { slug: 'scout', name: 'Scout', icon: '🏎️', rarity: 'common', cost: 2, role: 'raider', hp: 248, dmg: 47, cd: 1.0, range: 2.5, speed: 2.0, targets: 'buildings', proj: 'slug', radius: 0.45, deployCd: 1.0,
      ability: ab('Turbo Drive', 5, 10, 1.08, 1.07) },
    { slug: 'brawler', name: 'Brawler', icon: '🚛', rarity: 'common', cost: 4, role: 'tank', hp: 650, dmg: 75, cd: 1.2, range: 0.6, speed: 1.0, targets: 'ground', proj: 'melee', radius: 0.6, deployCd: 1.15,
      ability: ab('Iron Shell', 6, 12, 1.05, 1.12) },
    { slug: 'siege', name: 'Siege', icon: '🛞', rarity: 'rare', cost: 6, role: 'siege tank', hp: 1300, dmg: 105, cd: 1.7, range: 5.0, speed: 0.75, targets: 'buildings', proj: 'shell', radius: 0.7, deployCd: 1.45,
      ability: ab('Heavy Payload', 6, 12, 1.14, 1.05) },
    { slug: 'guardian', name: 'Guardian', icon: '🛡️', rarity: 'rare', cost: 5, role: 'shield support', hp: 875, dmg: 48, cd: 1.2, range: 0.8, speed: 0.9, targets: 'ground', proj: 'melee', radius: 0.65, special: 'aura', deployCd: 1.25,
      ability: ab('Forcefield', 5, 10, 1.07, 1.14) },
    { slug: 'voltbug', name: 'Volt Bug', icon: '⚡', rarity: 'common', cost: 3, role: 'chain zapper', hp: 240, dmg: 35, cd: 1.2, range: 4.5, speed: 1.25, targets: 'any', proj: 'spark', radius: 0.45, special: 'chain', deployCd: 1.0,
      ability: ab('Static Burst', 5, 10, 1.12, 1.05) },
    { slug: 'flarepod', name: 'Flare Pod', icon: '🔥', rarity: 'epic', cost: 4, role: 'splash caster', hp: 215, dmg: 55, cd: 1.4, range: 5.0, speed: 1.0, targets: 'any', proj: 'flare', splash: 1.3, radius: 0.45, deployCd: 1.2,
      ability: ab('Inferno Surge', 6, 12, 1.12, 1.07) },
    { slug: 'drillcat', name: 'Drill Cat', icon: '🚜', rarity: 'rare', cost: 4, role: 'tank killer', hp: 401, dmg: 189, cd: 1.6, range: 0.5, speed: 1.5, targets: 'ground', proj: 'melee', radius: 0.5, structureMult: 1.25, deployCd: 1.15,
      ability: ab('Diamond Drill', 6, 12, 1.14, 1.06) },
    { slug: 'raylance', name: 'Ray Lance', icon: '💠', rarity: 'legendary', cost: 5, role: 'sniper', hp: 228, dmg: 60, cd: 1.0, range: 6.5, speed: 1.0, targets: 'any', proj: 'beam', radius: 0.45, deployCd: 1.35,
      ability: ab('Overcharge', 7, 15, 1.16, 1.05) },
    { slug: 'mortarfox', name: 'Mortar Fox', icon: '🧨', rarity: 'epic', cost: 6, role: 'artillery', hp: 330, dmg: 110, cd: 2.6, range: 6.5, minRange: 2.5, speed: 0.75, targets: 'ground', proj: 'mortar', splash: 1.5, radius: 0.55, deployCd: 1.65,
      ability: ab('Barrage Mode', 7, 15, 1.14, 1.07) },
    { slug: 'ramhog', name: 'Ram Hog', icon: '🐗', rarity: 'rare', cost: 5, role: 'river-jumping charger', hp: 560, dmg: 105, cd: 1.6, range: 0.5, speed: 2.0, targets: 'buildings', proj: 'melee', radius: 0.55, special: 'jump charge', deployCd: 1.18,
      ability: ab('Rampage', 7, 15, 1.16, 1.08) },
    // ── Swarms ──
    { slug: 'junkpack', name: 'Junk Pack', icon: '🔧', rarity: 'common', cost: 3, role: 'melee swarm', count: 3, hp: 184, dmg: 48, cd: 1.3, range: 0.5, speed: 1.0, targets: 'ground', proj: 'melee', radius: 0.42, deployCd: 1.1,
      ability: ab('Mob Rush', 5, 10, 1.1, 1.08) },
    { slug: 'bugsquad', name: 'Bug Squad', icon: '🐛', rarity: 'rare', cost: 4, role: 'ranged swarm', count: 4, hp: 95, dmg: 32, cd: 1.2, range: 4.0, speed: 1.5, targets: 'any', proj: 'spark', radius: 0.35, deployCd: 1.2,
      ability: ab('Hive Mind', 6, 12, 1.12, 1.1) },
    { slug: 'mechmice', name: 'Mech Mice', icon: '🐭', rarity: 'common', cost: 2, role: 'cycle swarm', count: 2, hp: 110, dmg: 45, cd: 1.0, range: 0.4, speed: 2.0, targets: 'ground', proj: 'melee', radius: 0.35, deployCd: 0.95,
      ability: ab('Scuttle', 5, 10, 1.08, 1.1) },
    { slug: 'goblinbikers', name: 'Goblin Bikers', icon: '🏍️', rarity: 'epic', cost: 5, role: 'tower rushers', count: 5, hp: 152, dmg: 46, cd: 1.1, range: 0.5, speed: 2.0, targets: 'buildings', proj: 'melee', radius: 0.38, deployCd: 1.3,
      ability: ab('Turbo Gang', 7, 15, 1.12, 1.1) },
    { slug: 'nanodrones', name: 'Nano Drones', icon: '🤖', rarity: 'rare', cost: 4, role: 'air swarm', count: 3, air: true, hp: 122, dmg: 34, cd: 1.0, range: 2.0, speed: 1.5, targets: 'any', proj: 'spark', radius: 0.4, deployCd: 1.2,
      ability: ab('Network Link', 6, 12, 1.1, 1.08) },
    { slug: 'bombbeetles', name: 'Bomb Beetles', icon: '💣', rarity: 'legendary', cost: 5, role: 'kamikaze splash', count: 6, hp: 145, dmg: 81, cd: 1.0, range: 1.6, speed: 2.0, targets: 'any', proj: 'melee', splash: 1.5, radius: 0.35, special: 'kamikaze', deployCd: 1.5,
      ability: ab('Chain Detonation', 7, 15, 1.16, 1.08) },
    { slug: 'antmarch', name: 'Ant March', icon: '🐜', rarity: 'common', cost: 2, role: 'cheap swarm', count: 3, hp: 70, dmg: 44, cd: 1.0, range: 0.4, speed: 1.5, targets: 'ground', proj: 'melee', radius: 0.3, deployCd: 0.9,
      ability: ab('Column Charge', 5, 10, 1.08, 1.1) },
    { slug: 'crickethop', name: 'Cricket Hop', icon: '🦗', rarity: 'common', cost: 2, role: 'river jumpers', count: 2, hp: 130, dmg: 50, cd: 1.0, range: 0.5, speed: 2.0, targets: 'ground', proj: 'melee', radius: 0.38, special: 'jump', deployCd: 0.95,
      ability: ab('Leap Spring', 5, 10, 1.09, 1.09) },
    { slug: 'beeblitz', name: 'Bee Blitz', icon: '🐝', rarity: 'common', cost: 3, role: 'air swarm', count: 4, air: true, hp: 65, dmg: 30, cd: 1.1, range: 0.6, speed: 2.0, targets: 'any', proj: 'melee', radius: 0.32, deployCd: 1.0,
      ability: ab('Sting Flurry', 5, 10, 1.1, 1.07) },
    { slug: 'scrapbots', name: 'Scrap Bots', icon: '🪲', rarity: 'common', cost: 3, role: 'sturdy swarm', count: 3, hp: 199, dmg: 43, cd: 1.3, range: 0.5, speed: 0.9, targets: 'ground', proj: 'melee', radius: 0.42, deployCd: 1.1,
      ability: ab('Salvage Mode', 5, 10, 1.08, 1.12) },
    { slug: 'lizarddash', name: 'Lizard Dash', icon: '🦎', rarity: 'rare', cost: 3, role: 'fast swarm', count: 3, hp: 125, dmg: 40, cd: 1.0, range: 0.4, speed: 2.0, targets: 'ground', proj: 'melee', radius: 0.36, deployCd: 1.05,
      ability: ab('Cold Blooded', 6, 12, 1.12, 1.06) },
    { slug: 'toadtroop', name: 'Toad Troop', icon: '🐸', rarity: 'rare', cost: 4, role: 'splash swarm', count: 3, hp: 155, dmg: 37, cd: 1.4, range: 4.0, speed: 1.0, targets: 'ground', proj: 'shell', splash: 1.0, radius: 0.4, deployCd: 1.2,
      ability: ab('Leapfrog Volley', 6, 12, 1.1, 1.1) },
    { slug: 'wolfpack', name: 'Wolf Pack', icon: '🐺', rarity: 'rare', cost: 5, role: 'fast melee pack', count: 3, hp: 268, dmg: 64, cd: 1.2, range: 0.5, speed: 1.5, targets: 'ground', proj: 'melee', radius: 0.45, deployCd: 1.3,
      ability: ab('Pack Fury', 6, 12, 1.14, 1.08) },
    { slug: 'zombiemob', name: 'Zombie Mob', icon: '🧟', rarity: 'rare', cost: 4, role: 'slow horde', count: 5, hp: 218, dmg: 38, cd: 1.4, range: 0.5, speed: 0.9, targets: 'ground', proj: 'melee', radius: 0.4, deployCd: 1.2,
      ability: ab('Reanimate', 6, 12, 1.07, 1.16) },
    { slug: 'hawkstrike', name: 'Hawk Strike', icon: '🦅', rarity: 'epic', cost: 4, role: 'air hunters', count: 3, air: true, hp: 140, dmg: 45, cd: 1.1, range: 0.7, speed: 2.0, targets: 'any', proj: 'melee', radius: 0.42, deployCd: 1.2,
      ability: ab('Talon Dive', 7, 15, 1.14, 1.08) },
    { slug: 'crackergang', name: 'Cracker Gang', icon: '🎆', rarity: 'epic', cost: 5, role: 'ranged gang', count: 4, hp: 116, dmg: 42, cd: 1.4, range: 4.5, speed: 1.25, targets: 'any', proj: 'slug', radius: 0.38, deployCd: 1.3,
      ability: ab('Flashbang', 7, 15, 1.12, 1.1) },
    { slug: 'flybombers', name: 'Fly Bombers', icon: '🪰', rarity: 'epic', cost: 5, role: 'air tower bombers', count: 5, air: true, hp: 165, dmg: 59, cd: 1.7, range: 0.4, speed: 1.25, targets: 'buildings', proj: 'melee', splash: 1.0, radius: 0.42, special: 'deathBomb', deployCd: 1.3,
      ability: ab('Kamikaze Drop', 7, 15, 1.14, 1.06) },
    { slug: 'rabbitrush', name: 'Rabbit Rush', icon: '🐇', rarity: 'epic', cost: 5, role: 'burrowing rushers', count: 5, hp: 156, dmg: 44, cd: 1.0, range: 0.5, speed: 2.0, targets: 'buildings', proj: 'melee', radius: 0.36, special: 'jump', deployCd: 1.25,
      ability: ab('Burrow Blitz', 7, 15, 1.12, 1.1) },
    { slug: 'ufofleet', name: 'UFO Fleet', icon: '🛸', rarity: 'legendary', cost: 6, role: 'air siege', count: 4, air: true, hp: 260, dmg: 48, cd: 1.5, range: 4.0, speed: 1.0, targets: 'buildings', proj: 'beam', radius: 0.45, deployCd: 1.5,
      ability: ab('Abduction Ray', 7, 15, 1.16, 1.06) },
    { slug: 'dustdevils', name: 'Dust Devils', icon: '🌪️', rarity: 'legendary', cost: 6, role: 'spinning splash', count: 3, hp: 359, dmg: 80, cd: 1.5, range: 0.6, speed: 1.0, targets: 'ground', proj: 'melee', splash: 1.4, radius: 0.45, special: 'spin', deployCd: 1.45,
      ability: ab('Vortex Spin', 7, 15, 1.14, 1.1) },
    { slug: 'makoswarm', name: 'Mako Swarm', icon: '🦈', rarity: 'legendary', cost: 7, role: 'heavy horde', count: 6, hp: 238, dmg: 64, cd: 1.4, range: 0.5, speed: 1.0, targets: 'ground', proj: 'melee', radius: 0.45, deployCd: 1.6,
      ability: ab('Feeding Frenzy', 7, 15, 1.18, 1.1) },
    // ── Buildings ──
    { slug: 'boltturret', name: 'Bolt Turret', icon: '🏯', rarity: 'common', cost: 4, role: 'defensive building', building: true, lifetime: 30, hp: 924, dmg: 60, cd: 0.9, range: 5.5, speed: 0, targets: 'ground', proj: 'bolt', radius: 0.95, deployCd: 1.2,
      ability: ab('Overclock', 5, 10, 1.1, 1.1) },
    // ── Spells: cast anywhere on the arena. Projectile spells fly from your king tower. ──
    // `splash` is the spell radius; crown towers take `towerMult` of the damage.
    { slug: 'firebomb', name: 'Fire Bomb', icon: '☄️', rarity: 'rare', cost: 4, role: 'area damage spell', spell: true, hp: 0, dmg: 165, cd: 1, range: 0, speed: 0, targets: 'any', proj: 'firebomb', splash: 2.5, radius: 0, towerMult: 0.3, knockback: 0.9, deployCd: 1.0,
      ability: ab('Inferno Core', 6, 12, 1.1, 1) },
    { slug: 'shock', name: 'Shock', icon: '🌩️', rarity: 'common', cost: 2, role: 'instant stun spell', spell: true, hp: 0, dmg: 62, cd: 1, range: 0, speed: 0, targets: 'any', proj: 'shock', splash: 2.5, radius: 0, towerMult: 0.3, stun: 0.6, deployCd: 0.9,
      ability: ab('Overvolt', 5, 10, 1.1, 1) },
    { slug: 'rocketrain', name: 'Rocket Rain', icon: '🚀', rarity: 'common', cost: 3, role: 'swarm-clearing spell', spell: true, hp: 0, dmg: 100, cd: 1, range: 0, speed: 0, targets: 'any', proj: 'rocket', splash: 3.8, radius: 0, towerMult: 0.3, waves: 3, deployCd: 1.0,
      ability: ab('Cluster Payload', 5, 10, 1.1, 1) },

    // ── Trophy Road cards: one version each (no Mk-II variant) ──
    // `mech` holds the card's special mechanic; see the Mechanics section below.

    // Spells. `zone` spells leave a lingering area; `instant` ones land immediately.
    { slug: 'frostnova', name: 'Frost Nova', icon: '❄️', rarity: 'epic', cost: 4, role: 'freeze spell', spell: true, instant: true, hp: 0, dmg: 78, cd: 1, range: 0, speed: 0, targets: 'any', proj: 'frost', splash: 3.0, radius: 0, towerMult: 0.3, freeze: 3.0, deployCd: 1.1, arena: 2,
      desc: 'Freezes every enemy in the area (troops, buildings and towers) for 3 seconds.',
      ability: ab('Deep Freeze', 6, 12, 1.1, 1) },
    { slug: 'acidpool', name: 'Acid Pool', icon: '🧪', rarity: 'epic', cost: 4, role: 'damage-over-time spell', spell: true, instant: true, hp: 0, dmg: 250, cd: 1, range: 0, speed: 0, targets: 'any', proj: 'acid', splash: 3.0, radius: 0, towerMult: 0.3, deployCd: 1.1, arena: 3,
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
    { slug: 'repairwave', name: 'Repair Wave', icon: '💚', rarity: 'rare', cost: 3, role: 'friendly healing spell', spell: true, instant: true, friendly: true, hp: 0, dmg: 324, cd: 1, range: 0, speed: 0, targets: 'any', proj: 'repair', splash: 3.0, radius: 0, towerMult: 0, deployCd: 1.0, arena: 4,
      zone: { kind: 'heal', dur: 3, tick: 0.5 },
      desc: 'Heals your troops and buildings in the area by 324 over 3 seconds. Does not heal crown towers.',
      ability: ab('Nanite Swarm', 5, 10, 1.1, 1) },
    { slug: 'gravitywell', name: 'Gravity Well', icon: '🌀', rarity: 'epic', cost: 3, role: 'pulling spell', spell: true, instant: true, hp: 0, dmg: 100, cd: 1, range: 0, speed: 0, targets: 'any', proj: 'gravity', splash: 3.5, radius: 0, towerMult: 0.3, deployCd: 1.0, arena: 6,
      zone: { kind: 'pull', dur: 2.2, tick: 0.5, pull: 2.4 },
      desc: 'Drags enemy troops toward its centre for 2 seconds while damaging them. Great for grouping troops or pulling them into tower range.',
      ability: ab('Event Horizon', 6, 12, 1.1, 1) },
    { slug: 'orbitallaser', name: 'Orbital Laser', icon: '🛰️', rarity: 'legendary', cost: 6, role: 'heavy precision strike', spell: true, instant: true, hp: 0, dmg: 464, cd: 1, range: 0, speed: 0, targets: 'any', proj: 'laser', splash: 3.5, radius: 0, towerMult: 0.3, stun: 0.4, deployCd: 1.4, arena: 8,
      zone: { kind: 'laser', delay: 0.9, targets: 3 },
      desc: 'After a short lock-on, beams hit the 3 toughest enemies in the area for heavy damage.',
      ability: ab('Focused Lens', 7, 15, 1.1, 1) },
    { slug: 'boulder', name: 'Boulder Roll', icon: '🪨', rarity: 'rare', cost: 2, role: 'rolling knockback spell', spell: true, instant: true, hp: 0, dmg: 97, cd: 1, range: 0, speed: 0, targets: 'ground', proj: 'boulder', splash: 1.0, radius: 0, towerMult: 0.3, knockback: 1.2, deployCd: 0.9, arena: 3,
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
    { slug: 'infernospire', name: 'Inferno Spire', icon: '🌋', rarity: 'epic', cost: 5, role: 'tank-melting building', building: true, lifetime: 35, hp: 713, dmg: 11, cd: 0.4, range: 6.0, speed: 0, targets: 'any', proj: 'beam', radius: 0.9, deployCd: 1.3, arena: 5,
      mech: { ramp: 4 },
      desc: 'Its beam heats up the longer it stays on one target, reaching 10× damage after 4 seconds. Stuns and target swaps reset it.',
      ability: ab('Superheat', 6, 12, 1.1, 1.1) },
    { slug: 'mortarbunker', name: 'Mortar Bunker', icon: '💥', rarity: 'rare', cost: 4, role: 'long-range siege building', building: true, lifetime: 30, hp: 873, dmg: 117, cd: 4.5, range: 11.5, minRange: 3.5, speed: 0, targets: 'ground', proj: 'mortar', splash: 1.4, radius: 0.9, deployCd: 1.2, arena: 3,
      desc: 'Lobs slow splash shells 11.5 tiles. Placed near the river it can bombard an enemy tower, but it cannot hit anything close.',
      ability: ab('Heavy Shells', 6, 12, 1.1, 1.1) },
    { slug: 'teslapit', name: 'Tesla Pit', icon: '🗼', rarity: 'epic', cost: 4, role: 'hidden defense', building: true, lifetime: 35, hp: 750, dmg: 85, cd: 1.1, range: 5.5, speed: 0, targets: 'any', proj: 'zap', radius: 0.85, deployCd: 1.2, arena: 6,
      mech: { hide: true },
      desc: 'Hides underground (untargetable except by spells) until an enemy comes in range, then pops up and zaps air and ground.',
      ability: ab('Overcharge Coil', 6, 12, 1.1, 1.1) },
    { slug: 'dronehangar', name: 'Drone Hangar', icon: '🛩️', rarity: 'rare', cost: 5, role: 'air-spawning building', building: true, lifetime: 40, hp: 819, dmg: 0, cd: 1, range: 0, speed: 0, targets: 'none', proj: 'none', radius: 0.95, deployCd: 1.3, arena: 4,
      mech: { spawner: { card: 'hangardrone', every: 4.5, count: 1, onDeath: 1 } },
      desc: 'Launches a flying drone every 4.5 seconds, plus one more when destroyed.',
      ability: ab('Fast Assembly', 6, 12, 1.08, 1.1) },
    { slug: 'bonecrypt', name: 'Bone Crypt', icon: '⚰️', rarity: 'common', cost: 3, role: 'distraction spawner', building: true, lifetime: 35, hp: 415, dmg: 0, cd: 1, range: 0, speed: 0, targets: 'none', proj: 'none', radius: 0.85, deployCd: 1.1, arena: 1,
      mech: { spawner: { card: 'cryptskel', every: 2.9, count: 1, onDeath: 3 } },
      desc: 'Raises a skeleton every 2.9 seconds and 3 more when destroyed. Cheap bait for tanks and win conditions.',
      ability: ab('Restless Dead', 5, 10, 1.08, 1.1) },
    { slug: 'elixirpump', name: 'Elixir Pump', icon: '⛽', rarity: 'legendary', cost: 6, role: 'elixir generator', building: true, lifetime: 63, hp: 750, dmg: 0, cd: 1, range: 0, speed: 0, targets: 'none', proj: 'none', radius: 0.9, deployCd: 1.4, arena: 5,
      mech: { elixir: { every: 9, amount: 1, onDeath: 1 } },
      desc: 'Pumps 1 elixir every 9 seconds (7 over its life) and 1 more when destroyed. Pays off only if it survives.',
      ability: ab('Pressure Valve', 7, 15, 1, 1.1) },
    { slug: 'sirenbeacon', name: 'Siren Beacon', icon: '🚨', rarity: 'rare', cost: 3, role: 'taunt building', building: true, lifetime: 25, hp: 1980, dmg: 0, cd: 1, range: 0, speed: 0, targets: 'none', proj: 'none', radius: 0.9, deployCd: 1.1, arena: 4,
      mech: { taunt: 6.5 },
      desc: 'A loud, sturdy decoy. Enemy troops within 6.5 tiles drop what they are doing and attack it.',
      ability: ab('Louder Siren', 5, 10, 1, 1.12) },

    // Troops
    { slug: 'medicbot', name: 'Medic Bot', icon: '🩺', rarity: 'rare', cost: 4, role: 'healing support', hp: 450, dmg: 35, cd: 1.2, range: 3.5, speed: 1.0, targets: 'any', proj: 'spark', radius: 0.5, deployCd: 1.2, arena: 4,
      mech: { heal: { radius: 3.0, perSec: 26 } },
      desc: 'Heals nearby friendly troops by 26 HP per second while plinking at enemies.',
      ability: ab('Triage', 6, 12, 1.05, 1.1) },
    { slug: 'rocktitan', name: 'Rock Titan', icon: '🗿', rarity: 'legendary', cost: 8, role: 'giant building-buster', hp: 1610, dmg: 70, cd: 1.5, range: 0.6, speed: 0.6, targets: 'buildings', proj: 'melee', radius: 0.9, deployCd: 1.8, arena: 8,
      mech: { deathSpawn: { card: 'rockshard', count: 2 }, deathSplash: { radius: 2, dmg: 140 } },
      desc: 'Enormous and slow. Only attacks buildings. When it falls it shatters, damaging nearby enemies and splitting into 2 Rock Shards.',
      ability: ab('Bedrock', 7, 15, 1.06, 1.12) },
    { slug: 'teslatank', name: 'Tesla Tank', icon: '🔋', rarity: 'legendary', cost: 6, role: 'charged splash cannon', hp: 779, dmg: 217, cd: 5.0, range: 4.5, speed: 0.75, targets: 'ground', proj: 'pulse', splash: 1.5, radius: 0.7, deployCd: 1.5, arena: 5,
      mech: { chargeShot: true },
      desc: 'Charges a devastating splash blast every 5 seconds. Stuns and freezes reset its charge.',
      ability: ab('Capacitor Bank', 7, 15, 1.12, 1.06) },
    { slug: 'shieldknight', name: 'Shield Knight', icon: '🤺', rarity: 'rare', cost: 4, role: 'shielded melee', hp: 533, dmg: 81, cd: 1.2, range: 0.6, speed: 1.0, targets: 'ground', proj: 'melee', radius: 0.55, deployCd: 1.2, arena: 2,
      mech: { shield: 280 },
      desc: 'Carries a 280 HP shield that soaks damage first. Once the shield breaks, extra damage from that hit is lost.',
      ability: ab('Tower Shield', 6, 12, 1.05, 1.12) },
    { slug: 'stormzeppelin', name: 'Storm Zeppelin', icon: '🎈', rarity: 'legendary', cost: 7, role: 'flying tank', air: true, hp: 1750, dmg: 40, cd: 1.3, range: 2.5, speed: 0.75, targets: 'buildings', proj: 'spark', radius: 0.85, deployCd: 1.7, arena: 7,
      mech: { deathSpawn: { card: 'stormsprite', count: 4 } },
      desc: 'A huge flying tank that heads for buildings. When it pops, 4 Storm Sprites burst out and attack everything.',
      ability: ab('Thunderhead', 7, 15, 1.06, 1.12) },
    { slug: 'cryocaster', name: 'Cryo Caster', icon: '🧊', rarity: 'epic', cost: 4, role: 'slowing splash caster', hp: 339, dmg: 42, cd: 1.4, range: 5.0, speed: 1.0, targets: 'any', proj: 'ice', splash: 1.0, radius: 0.45, deployCd: 1.2, arena: 2,
      mech: { slowOnHit: { mult: 0.7, dur: 1.5 } },
      desc: 'Ice shards splash air and ground and slow whatever they hit by 30% for 1.5 seconds.',
      ability: ab('Permafrost', 6, 12, 1.1, 1.06) },
    { slug: 'phantomrider', name: 'Phantom Rider', icon: '👻', rarity: 'legendary', cost: 3, role: 'dashing assassin', hp: 340, dmg: 60, cd: 1.0, range: 0.5, speed: 1.5, targets: 'ground', proj: 'melee', radius: 0.45, deployCd: 1.0, arena: 6,
      mech: { dash: { min: 2.5, max: 6, speed: 10, cd: 3.5 } },
      desc: 'Dashes at targets 2.5 to 6 tiles away, untouchable during the dash, and hits for double damage when it lands.',
      ability: ab('Shadow Step', 7, 15, 1.1, 1.08) },
    { slug: 'flakgunner', name: 'Flak Gunner', icon: '🔭', rarity: 'common', cost: 3, role: 'anti-air troop', hp: 430, dmg: 105, cd: 0.9, range: 5.5, speed: 1.0, targets: 'air', proj: 'flak', splash: 0.8, radius: 0.45, deployCd: 1.0, arena: 1,
      desc: 'Shoots only flying troops, with splash. Holds its ground when no air target is in sight.',
      ability: ab('Tracer Rounds', 5, 10, 1.1, 1.08) },
    { slug: 'boomerang', name: 'Boomerang Bot', icon: '🪃', rarity: 'epic', cost: 5, role: 'piercing thrower', hp: 585, dmg: 56, cd: 2.4, range: 4.0, speed: 1.0, targets: 'ground', proj: 'blade', radius: 0.55, deployCd: 1.3, arena: 6,
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
    // Mechanics no other card has (2026-10-15): damage reflection, lifesteal, a hidden trap, a damage aura
    { slug: 'thorngolem', name: 'Thorn Golem', icon: '🌵', rarity: 'epic', cost: 5, role: 'thorned tank', hp: 1300, dmg: 70, cd: 1.5, range: 0.6, speed: 0.75, targets: 'buildings', proj: 'melee', radius: 0.7, deployCd: 1.4, arena: 7,
      mech: { reflect: { pct: 0.35, cap: 60 } },
      desc: 'A slow tank that walks to buildings. Melee attackers take back 35% of every hit (up to 60 per hit). Ranged troops, spells and towers are not reflected.',
      ability: ab('Bramble Hide', 7, 15, 1.06, 1.1) },
    { slug: 'siphonpriest', name: 'Siphon Priest', icon: '🩸', rarity: 'epic', cost: 4, role: 'lifestealing caster', hp: 402, dmg: 58, cd: 1.1, range: 4.0, speed: 1.0, targets: 'any', proj: 'spark', radius: 0.45, deployCd: 1.2, arena: 8,
      mech: { lifesteal: 0.3 },
      desc: 'A ranged caster that heals itself for 30% of the damage it deals. Hard to wear down slowly; burst it or stun it.',
      ability: ab('Blood Rite', 7, 15, 1.08, 1.08) },
    { slug: 'snaremine', name: 'Snare Mine', icon: '🪤', rarity: 'rare', cost: 2, role: 'hidden trap', building: true, lifetime: 30, hp: 246, dmg: 185, cd: 1, range: 0, speed: 0, targets: 'none', proj: 'none', radius: 0.55, deployCd: 1.0, arena: 9,
      mech: { hide: true, trap: { trigger: 1.2, radius: 2.2, stun: 2.0 } },
      desc: 'Buried and untargetable. The first enemy ground troop to step near it sets it off: heavy damage and a 2 s root in a wide area. Flyers pass over it. Lasts 30 s.',
      ability: ab('Barbed Snare', 6, 12, 1.12, 1) },
    { slug: 'wardrum', name: 'War Drum', icon: '🥁', rarity: 'rare', cost: 2, role: 'damage aura', building: true, lifetime: 30, hp: 600, dmg: 0, cd: 1, range: 0, speed: 0, targets: 'none', proj: 'none', radius: 0.8, deployCd: 1.1, arena: 9,
      mech: { empower: { radius: 5, mult: 1.35 } },
      desc: 'Your troops within 5 tiles deal 35% more damage. Doesn\'t attack. Lasts 30 s; enemies can destroy it to end the beat.',
      ability: ab('Battle Rhythm', 6, 12, 1, 1.15) },
  ];

  // Token units: spawned by other cards, never in a deck or the collection
  const TOKENS = [
    { slug: 'paratrooper', name: 'Paratrooper', icon: '🪖', rarity: 'common', cost: 0, role: 'dropped trooper', hp: 75, dmg: 38, cd: 1.0, range: 0.5, speed: 1.5, targets: 'ground', proj: 'melee', radius: 0.35 },
    { slug: 'hangardrone', name: 'Hangar Drone', icon: '🚁', rarity: 'common', cost: 0, role: 'spawned drone', air: true, hp: 110, dmg: 38, cd: 1.0, range: 2.5, speed: 1.6, targets: 'any', proj: 'spark', radius: 0.35 },
    { slug: 'cryptskel', name: 'Skeleton', icon: '💀', rarity: 'common', cost: 0, role: 'spawned skeleton', hp: 55, dmg: 50, cd: 1.0, range: 0.5, speed: 1.5, targets: 'ground', proj: 'melee', radius: 0.32 },
    { slug: 'rockshard', name: 'Rock Shard', icon: '🧱', rarity: 'common', cost: 0, role: 'titan fragment', hp: 650, dmg: 65, cd: 1.5, range: 0.6, speed: 0.75, targets: 'buildings', proj: 'melee', radius: 0.6 },
    { slug: 'bonegiant', name: 'Bone Giant', icon: '☠️', rarity: 'common', cost: 0, role: 'crypt guardian', hp: 520, dmg: 90, cd: 1.4, range: 0.6, speed: 0.9, targets: 'ground', proj: 'melee', radius: 0.6 },
    { slug: 'stormsprite', name: 'Storm Sprite', icon: '🌩', rarity: 'common', cost: 0, role: 'zeppelin sprite', air: true, hp: 110, dmg: 42, cd: 1.2, range: 2.0, speed: 1.5, targets: 'any', proj: 'spark', splash: 0.8, radius: 0.35 },
    // Event boss and its summons (Boss Battle event). The boss's phases live in `mech.boss`, see "Bosses".
    // A troop-smasher: full damage to troops, 45% to buildings and towers (structureMult)
    { slug: 'colossus', name: 'Iron Colossus', icon: '🤖', rarity: 'legendary', cost: 0, role: 'event boss', hp: 4400, dmg: 135, cd: 1.8, range: 0.9, speed: 0.55, targets: 'ground', proj: 'melee', splash: 1.2, radius: 1.1, structureMult: 0.45,
      mech: { boss: { slamEvery: 7, slamEnraged: 4.5, slamDelay: 1.6, slamRadius: 2.2, slamDmg: 230, slamTower: 0.25, summonAt: [0.7, 0.4], summon: { card: 'ironling', count: 3 }, guardMult: 0.5, enrageBelow: 0.35, enrageMult: 1.35 } } },
    { slug: 'ironling', name: 'Ironling', icon: '⚙️', rarity: 'common', cost: 0, role: 'boss guard', hp: 240, dmg: 36, cd: 1.1, range: 0.5, speed: 1.2, targets: 'ground', proj: 'melee', radius: 0.42, structureMult: 0.3 },
    // Boss Rush bosses: the same boss mechanics with different weaknesses
    { slug: 'stonewarden', name: 'Stone Warden', icon: '🗿', rarity: 'legendary', cost: 0, role: 'event boss', hp: 5600, dmg: 120, cd: 2.0, range: 1.0, speed: 0.45, targets: 'ground', proj: 'melee', splash: 1.5, radius: 1.2, structureMult: 0.45,
      mech: { boss: { slamEvery: 8, slamEnraged: 5.5, slamDelay: 1.8, slamRadius: 3.0, slamDmg: 260, slamTower: 0.25, summonAt: [0.66, 0.33], summon: { card: 'rockshard', count: 2 }, guardMult: 0.5, enrageBelow: 0.3, enrageMult: 1.3 } } },
    { slug: 'hivequeen', name: 'Hive Queen', icon: '🐝', rarity: 'legendary', cost: 0, role: 'event boss', hp: 3600, dmg: 90, cd: 1.2, range: 0.9, speed: 0.75, targets: 'ground', proj: 'melee', splash: 1.0, radius: 1.0, structureMult: 0.45,
      mech: { boss: { slamEvery: 6, slamEnraged: 4, slamDelay: 1.4, slamRadius: 1.8, slamDmg: 170, slamTower: 0.25, summonAt: [0.75, 0.5, 0.25], summon: { card: 'hangardrone', count: 4 }, guardMult: 0.5, enrageBelow: 0.35, enrageMult: 1.4 } } },
  ];

  // Which Trophy Road arena (0-9) unlocks each original card into chests and rewards.
  // The Mk-II variant unlocks with its base card.
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
  const VARIANT_ARENA_SHIFT = [0, 0];

  // ─── Card Evolutions ─────────────────────────────────────────────────────
  //
  // An Evolution is an upgraded form of a card family (keyed by slug, so it covers that card's
  // Mk-II variant too). It changes how the card behaves, not just its numbers.
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

  // Variants scale the base unit. Twin, Burst and Core were removed on 2026-10-14; saves that
  // still hold them are folded into the base card (REMOVED_VARIANTS / migrateCardId).
  const VARIANTS = [
    { suffix: 'Mk-I', hp: 1, dmg: 1, range: 0, speed: 0, cost: 0, cd: 1, deployCd: 0, rarityShift: 0, style: null },
    { suffix: 'Mk-II', hp: 1.06, dmg: 1.06, range: 0.3, speed: 0.05, cost: 0, cd: 0.97, deployCd: -0.05, rarityShift: 0, style: null },
  ];
  const REMOVED_VARIANTS = ['twin', 'burst', 'core'];

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
      splash: a.splash || 0,
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
  /** A card id from an older save: removed Twin/Burst/Core versions become the base card; unknown ids give null. */
  function migrateCardId(id) {
    if (typeof id !== 'string') return null;
    if (CARD_MAP[id]) return id;
    const m = id.match(/^(.+)-([a-z]+)$/);
    return m && REMOVED_VARIANTS.includes(m[2]) && CARD_MAP[m[1]] ? m[1] : null;
  }
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

  // Which bridge a nav cell belongs to (-1: not on a bridge)
  const BRIDGE_STICK = 2;   // extra tiles a route must save before a unit switches to the other bridge
  const BRIDGE_COMMIT = 8;  // ...and much more once it is close to its bridge (within BRIDGE_NEAR tiles):
  const BRIDGE_NEAR = 5;    // turning back from there costs more than it could ever save
  const BRIDGE_HOLD = 4;    // seconds a newly chosen bridge is held with the same commitment
  function bridgeOfCell(idx) {
    const y = (Math.floor(idx / COLS) + 0.5) * NAV_CELL;
    if (y < RIVER.y0 || y >= RIVER.y1) return -1;
    const x = ((idx % COLS) + 0.5) * NAV_CELL;
    return BRIDGES.findIndex((b) => x > b.x0 && x < b.x1);
  }

  // A* from (sx,sy) to any cell where a body of `radius` would be within `range` of `target`.
  // Returns smoothed waypoints or null; `.bridge` on the result is the bridge it crosses (-1: none).
  // `stick` (a bridge index) makes stepping onto the OTHER bridge cost BRIDGE_STICK tiles more, so a
  // unit chasing something near the middle doesn't flip between two nearly equal routes.
  function findPath(state, sx, sy, target, range, radius, jump, stick, commit) {
    const tx = target.x;
    const ty = target.y;
    const far = range + radius + targetExtent(target) * Math.SQRT2;
    const nav = state.nav;
    let start = cellIndex(sx, sy);
    if (!walkableCell(nav, start, jump)) start = nearestWalkableCell(nav, sx, sy, jump);
    if (start < 0) return null;

    let stickCost = 0;
    if (stick != null && stick >= 0) {
      const near = dist(sx, sy, BRIDGES[stick].cx, (RIVER.y0 + RIVER.y1) / 2) < BRIDGE_NEAR;
      stickCost = BRIDGE_STICK + (near || commit ? BRIDGE_COMMIT : 0);
    }
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
        let g = nav.g[cur] + cost * NAV_CELL;
        if (stick != null && stick >= 0) {
          const nb = bridgeOfCell(ni);
          if (nb >= 0 && nb !== stick && bridgeOfCell(cur) !== nb) g += stickCost;
        }
        if (nav.seen[ni] === s && g >= nav.g[ni]) continue;
        nav.seen[ni] = s;
        nav.g[ni] = g;
        nav.from[ni] = cur;
        heap.push(ni, g + h(ni));
      }
    }
    if (goal < 0) return null;

    const cells = [];
    let crossed = -1;
    for (let i = goal; i >= 0; i = nav.from[i]) { cells.push(i); if (crossed < 0) crossed = bridgeOfCell(i); }
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
    out.bridge = crossed;
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

  // Something that appears between rebuilds (a troop deployed between steps, a token spawned
  // mid-step) joins the hash at once, so a spell cast on the same tick can still hit it
  function hashInsert(state, e) {
    if (!state.hash) return;
    const c = clamp(Math.floor(e.x / HASH_CELL), 0, HASH_COLS - 1);
    const r = clamp(Math.floor(e.y / HASH_CELL), 0, HASH_ROWS - 1);
    state.hash[r * HASH_COLS + c].push(e);
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

  // ─── Match rules ─────────────────────────────────────────────────────────
  //
  // Every match runs on its own rules object. A normal battle gets a fresh copy of DEFAULT_RULES;
  // special events (shared/events.js) build a different one. The engine only ever reads rules from
  // the match it is running (`state.rules`), so nothing an event changes can leak into the next
  // battle. Rules describe mechanics, never event names: an event is just a combination of these.
  const DEFAULT_RULES = {
    eventId: null,             // which event built these rules (for display and results only)
    regulation: 180,           // seconds of regular time
    overtime: 60,              // seconds of sudden-death overtime (0 = none)
    elixirPhases: [{ at: 0, mult: 1 }, { at: 120, mult: 2 }], // generation multiplier from each time on
    overtimeMult: 2,
    startElixir: 5,
    maxElixir: 10,
    crownsToWin: 0,            // >0: reaching this many crowns wins on the spot (1 = sudden death)
    timeout: 'crowns',         // when time runs out: 'crowns' (normal), 'survive' (A wins if its King stands), 'defend' (B wins)
    noTowers: [],              // sides that play without crown towers (survival / boss: the scripted side)
    guard: false,              // troops with nothing to attack hold a line in front of their own bridge
    cardMods: [],              // [{ when: {...}, cost, hp, dmg, speed, radius, splash, lifetime, count }] baked into the deck
    evo: { cycleDelta: 0, startCharged: false, disabled: false, all: false },
    killRefund: 0,             // fraction of a killed enemy troop's elixir paid to the side that killed it
    knockOnHit: 0,             // single-target hits knock ground troops back this far (tiles)
    spellEcho: 0,              // damage spells repeat at this fraction ~1 s after they land; lingering ones last longer
    sizeRoll: null,            // { tiny, mega } chances: each card in hand is rolled Tiny / Normal / Mega
    buildingElixir: 0,         // generation bonus per living friendly building (up to 3)
    deckSwaps: [],             // [{ at, A: [ids], B: [ids] }]: both hands are replaced at `at`
    deckLevel: 0,              // card level for swapped-in decks (0 = each side's average level)
    cardLevel: 0,              // >0: every card in both decks plays at this level (C.H.A.O.S.: 11); the collection is untouched
    blackout: false,           // C.H.A.O.S. Blackout: the arena is dark outside each side's own light (drawing only)
    upgrades: null,            // C.H.A.O.S.: { checkpoints: [{ at, rarity }], choiceSecs, pause, autoPick, perCard }
    // Game-mode library (see "Objective modes" and normalizeRules): all off in a normal battle
    infiniteElixir: false, towerLevel: 0, unitCap: 0, announceStages: false, deployDepth: 0, kingOnly: false, vault: null, towerHp: null,
    playLimit: null, defenses: [], scoreToWin: 0, touchdown: null, capture: null, payload: null, treasure: null, gambit: null,
    hill: null,                // { spots: [{x,y}], every, r, rate, points }: King of the Hill
    waves: null,               // [{ at, units: [{ card, n, lane, level }] }]: scripted attackers for side B
    boss: null,                // { at, card, lane, level }: a scripted boss for side B
    modifiers: [],             // [{ id, at, dur }]: timed modifiers (see MODIFIERS)
    modWarn: 4,                // seconds of warning before a modifier starts
  };

  const RULE_LIMITS = { regulation: [20, 600], overtime: [0, 180], startElixir: [0, 20], maxElixir: [4, 20] };
  const SIZE_FORMS = {
    tiny: { name: 'Tiny', hp: 0.6, dmg: 0.75, speed: 1.3, radius: 0.65, cost: -1 },
    mega: { name: 'Mega', hp: 1.6, dmg: 1.3, speed: 0.8, radius: 1.3, cost: 1 },
  };

  function num(v, def, lo, hi) {
    const n = Number(v);
    return Number.isFinite(n) ? clamp(n, lo, hi) : def;
  }

  /**
   * Clean up a rules object (from an event, the server, or a test): fill defaults, clamp numbers,
   * drop unknown modifiers and malformed entries. Always returns a brand-new object.
   */
  function normalizeRules(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const d = DEFAULT_RULES;
    const out = {
      eventId: r.eventId ? String(r.eventId).slice(0, 40) : null,
      label: r.label ? String(r.label).slice(0, 60) : null,
      regulation: num(r.regulation, d.regulation, ...RULE_LIMITS.regulation),
      overtime: num(r.overtime, d.overtime, ...RULE_LIMITS.overtime),
      overtimeMult: num(r.overtimeMult, d.overtimeMult, 0.25, 4),
      startElixir: num(r.startElixir, d.startElixir, ...RULE_LIMITS.startElixir),
      maxElixir: num(r.maxElixir, d.maxElixir, ...RULE_LIMITS.maxElixir),
      crownsToWin: Math.floor(num(r.crownsToWin, 0, 0, 3)),
      timeout: ['crowns', 'survive', 'defend'].includes(r.timeout) ? r.timeout : 'crowns',
      noTowers: (Array.isArray(r.noTowers) ? r.noTowers : []).filter((s) => s === 'A' || s === 'B'),
      guard: !!r.guard,
      killRefund: num(r.killRefund, 0, 0, 1),
      knockOnHit: num(r.knockOnHit, 0, 0, 1),
      spellEcho: num(r.spellEcho, 0, 0, 1),
      buildingElixir: num(r.buildingElixir, 0, 0, 0.5),
      deckLevel: Math.floor(num(r.deckLevel, 0, 0, 14)),
      modWarn: num(r.modWarn, d.modWarn, 0, 10),
      cardLevel: Math.floor(num(r.cardLevel, 0, 0, 14)),
      blackout: !!r.blackout,
    };
    out.upgrades = normalizeUpgradeRules(r.upgrades);
    out.startElixir = Math.min(out.startElixir, out.maxElixir);
    const phases = Array.isArray(r.elixirPhases) && r.elixirPhases.length ? r.elixirPhases : d.elixirPhases;
    out.elixirPhases = phases
      .map((p) => ({ at: num(p && p.at, 0, 0, 900), mult: num(p && p.mult, 1, 0.1, 5) }))
      .sort((a, b) => a.at - b.at);
    if (out.elixirPhases[0].at > 0) out.elixirPhases.unshift({ at: 0, mult: 1 });
    out.cardMods = (Array.isArray(r.cardMods) ? r.cardMods : []).slice(0, 12).filter((m) => m && typeof m === 'object').map((m) => ({
      when: m.when && typeof m.when === 'object' ? { ...m.when } : {},
      cost: Math.round(num(m.cost, 0, -3, 3)),
      hp: num(m.hp, 1, 0.2, 4), dmg: num(m.dmg, 1, 0.2, 4), speed: num(m.speed, 1, 0.3, 2.5),
      radius: num(m.radius, 1, 0.4, 2), splash: num(m.splash, 1, 0.5, 2), lifetime: num(m.lifetime, 1, 0.3, 3),
      count: num(m.count, 1, 1, 3),
      cd: num(m.cd, 1, 0.3, 3),   // attack interval multiplier (Rage: < 1 is faster)
    }));
    const e = r.evo && typeof r.evo === 'object' ? r.evo : {};
    out.evo = { cycleDelta: Math.round(num(e.cycleDelta, 0, -3, 3)), startCharged: !!e.startCharged, disabled: !!e.disabled, all: !!e.all };
    out.sizeRoll = r.sizeRoll && typeof r.sizeRoll === 'object'
      ? { tiny: num(r.sizeRoll.tiny, 0, 0, 0.5), mega: num(r.sizeRoll.mega, 0, 0, 0.5) }
      : null;
    const cleanIds = (list) => (Array.isArray(list) ? list : []).map(String).filter((id) => CARD_MAP[id] && !CARD_MAP[id].token).slice(0, MAX_DECK);
    out.deckSwaps = (Array.isArray(r.deckSwaps) ? r.deckSwaps : []).slice(0, 6)
      .map((s) => ({ at: num(s && s.at, 0, 1, 900), A: cleanIds(s && s.A), B: cleanIds(s && s.B) }))
      .filter((s) => s.A.length >= 4 && s.B.length >= 4)
      .sort((a, b) => a.at - b.at);
    if (r.hill && Array.isArray(r.hill.spots) && r.hill.spots.length) {
      out.hill = {
        spots: r.hill.spots.slice(0, 4).map((p) => ({ x: num(p.x, MID_X, 1, W - 1), y: num(p.y, H / 2, 1, H - 1) })),
        every: num(r.hill.every, 40, 5, 300),
        r: num(r.hill.r, 2.2, 1, 4),
        rate: num(r.hill.rate, 5, 0.5, 50),
        points: num(r.hill.points, 100, 10, 1000),
      };
    } else out.hill = null;
    out.waves = Array.isArray(r.waves) ? r.waves.slice(0, 40).map((w) => ({
      at: num(w && w.at, 0, 0, 900),
      units: (Array.isArray(w && w.units) ? w.units : []).slice(0, 8)
        .filter((u) => u && CARD_MAP[u.card])
        .map((u) => ({ card: String(u.card), n: Math.floor(num(u.n, 1, 1, 6)), lane: u.lane === 1 ? 1 : 0, level: Math.floor(num(u.level, 1, 1, 14)) })),
    })).filter((w) => w.units.length).sort((a, b) => a.at - b.at) : null;
    if (out.waves && !out.waves.length) out.waves = null;
    out.boss = r.boss && CARD_MAP[r.boss.card] && CARD_MAP[r.boss.card].mech && CARD_MAP[r.boss.card].mech.boss
      ? { at: num(r.boss.at, 3, 0, 120), card: String(r.boss.card), lane: r.boss.lane === 1 ? 1 : 0, level: Math.floor(num(r.boss.level, 1, 1, 14)), extraSummon: !!r.boss.extraSummon }
      : null;
    out.modifiers = (Array.isArray(r.modifiers) ? r.modifiers : []).slice(0, 40)
      .filter((m) => m && MODIFIERS[m.id])
      .map((m) => ({ id: m.id, at: num(m.at, 0, 0, 900), dur: num(m.dur, MODIFIERS[m.id].dur, 1, 900) }))
      .sort((a, b) => a.at - b.at);
    // ── Mode rules (game-mode library, 2026-10-15). All off by default. ──
    out.infiniteElixir = !!r.infiniteElixir;                       // elixir is always full
    out.towerLevel = Math.floor(num(r.towerLevel, 0, 0, 14));      // >0: both sides' towers at this level (standard-level modes)
    out.unitCap = Math.floor(num(r.unitCap, 0, 0, 200));            // per side, 0 = none
    out.announceStages = !!r.announceStages;                       // elixir-rate changes are announced (Ramp-Up)
    out.deployDepth = num(r.deployDepth, 0, 0, 8);                 // troops/buildings must be this far behind the river
    out.kingOnly = !!r.kingOnly;                                   // no Princess Towers (Heist): the King is the vault
    out.vault = r.vault && typeof r.vault === 'object' ? { hp: num(r.vault.hp, 1, 0.5, 6), shoots: !!r.vault.shoots } : null;
    out.towerHp = r.towerHp && typeof r.towerHp === 'object' ? { princess: num(r.towerHp.princess, 1, 0.1, 5), king: num(r.towerHp.king, 1, 0.1, 5) } : null;
    out.playLimit = r.playLimit && typeof r.playLimit === 'object' ? { A: Math.floor(num(r.playLimit.A, 0, 0, 99)), B: Math.floor(num(r.playLimit.B, 0, 0, 99)) } : null;
    out.defenses = (Array.isArray(r.defenses) ? r.defenses : []).slice(0, 16)
      .filter((d) => d && CARD_MAP[d.card] && CARD_MAP[d.card].building && (d.side === 'A' || d.side === 'B'))
      .map((d) => ({ card: String(d.card), side: d.side, x: num(d.x, MID_X, 1, W - 1), y: num(d.y, H / 2, 1, H - 1), level: Math.floor(num(d.level, 1, 1, 14)) }));
    out.scoreToWin = Math.floor(num(r.scoreToWin, 0, 0, 1000));
    out.touchdown = r.touchdown ? { depth: num(r.touchdown.depth, 2.5, 1, 6) } : null;
    out.capture = r.capture && Array.isArray(r.capture.spots) && r.capture.spots.length
      ? { spots: r.capture.spots.slice(0, 4).map((pt) => ({ x: num(pt.x, MID_X, 1, W - 1), y: num(pt.y, H / 2, 1, H - 1) })), r: num(r.capture.r, 2.2, 1, 4), rate: num(r.capture.rate, 4, 0.5, 50) }
      : null;
    out.payload = r.payload ? { x: num(r.payload.x, BRIDGES[0].cx, 1, W - 1), r: num(r.payload.r, 2.2, 1, 4), speed: num(r.payload.speed, 0.5, 0.1, 3), end: num(r.payload.end, 4, 2, 10) } : null;
    out.treasure = r.treasure ? { every: num(r.treasure.every, 18, 5, 120), life: num(r.treasure.life, 20, 5, 120), r: num(r.treasure.r, 1.4, 0.6, 3), hold: num(r.treasure.hold, 1.2, 0.2, 5), elixir: num(r.treasure.elixir, 2, 0, 10) } : null;
    out.gambit = r.gambit && Array.isArray(r.gambit.pool)
      ? { pool: [...new Set(r.gambit.pool.map(String))].filter((id) => CARD_MAP[id] && !CARD_MAP[id].token).slice(0, 60) }
      : null;
    if (out.gambit && out.gambit.pool.length < 8) out.gambit = null;
    return out;
  }

  // Does a card match a card-mod filter? (every listed condition must hold)
  function cardMatches(c, when) {
    const troop = !c.spell && !c.building;
    if (when.all) return true;
    if (when.spell != null && !!c.spell !== !!when.spell) return false;
    if (when.building != null && !!c.building !== !!when.building) return false;
    if (when.troop != null && troop !== !!when.troop) return false;
    if (when.swarm != null && (troop && c.swarmCount > 1) !== !!when.swarm) return false;
    if (when.tank && !(troop && c.hp >= 600)) return false;
    if (when.ranged && !(troop && c.range >= 3)) return false;
    if (when.splash && !(c.splash > 0 && !c.spell)) return false;
    if (when.minCost != null && c.cost < when.minCost) return false;
    if (when.maxCost != null && c.cost > when.maxCost) return false;
    return true;
  }

  // Card stats with the event's card mods baked in (per match; the shared card table is never touched)
  function applyCardMods(stats, mods) {
    if (!mods || !mods.length) return stats;
    let s = stats;
    for (const m of mods) {
      if (!cardMatches(s, m.when)) continue;
      s = {
        ...s,
        cost: clamp(s.cost + m.cost, 1, 10),
        hpScaled: Math.round(s.hpScaled * m.hp),
        dmgScaled: +(s.dmgScaled * m.dmg).toFixed(2),
        speed: s.building ? 0 : r2(s.speed * m.speed),
        radius: r2(s.radius * m.radius),
        splash: r2(s.splash * m.splash),
        lifetime: s.lifetime ? r2(s.lifetime * m.lifetime) : s.lifetime,
        swarmCount: s.swarmCount > 1 ? Math.min(10, Math.ceil(s.swarmCount * m.count)) : s.swarmCount,
        cd: m.cd && m.cd !== 1 ? r2(Math.max(0.3, s.cd * m.cd)) : s.cd,
      };
    }
    return s;
  }

  // ─── Timed modifiers (Chaos Mode and friends) ────────────────────────────
  //
  // A modifier is switched on and off at fixed match times (rules.modifiers, chosen before the
  // match by shared/events.js from a seed, so every client and the server agree). While active it
  // contributes to a small set of named effects. Effects from several modifiers are combined by a
  // fixed policy per effect (MOD_STACK) and clamped (MOD_CAPS), so two speed boosts can never
  // multiply into something absurd. Nothing saves and restores stats: the effects are re-read
  // every step, so switching a modifier off can't overwrite some other buff.
  //
  //   cat     battlefield | elixir | card | troop | evolution | tower | time
  //   sev     1 mild .. 3 wild (Chaos intensity caps the severity it may pick)
  //   group   only one modifier per group can be active at once (e.g. two elixir-rate changes)
  //   fx      effect contributions while active (see MOD_STACK)
  //   zones   lingering areas it places (removed when it ends); positions are mirrored for fairness
  //   start   one-off effect when it switches on
  //   needs   'evo': only picked when someone has an Evolution equipped
  const MODIFIERS = {
    jetstream: { name: 'Jet Stream', icon: '💨', cat: 'battlefield', sev: 1, dur: 20, weight: 3, group: 'zone',
      desc: 'Both bridges become speed lanes: troops on them move and attack 40% faster.',
      zones: [{ kind: 'cHaste', x: 3.5, y: 16, r: 2.4, mult: 1.4 }, { kind: 'cHaste', x: 14.5, y: 16, r: 2.4, mult: 1.4 }] },
    mudslide: { name: 'Mudslide', icon: '🟫', cat: 'battlefield', sev: 1, dur: 20, weight: 3, group: 'zone',
      desc: 'Four mud pits (two on each side, mirrored) slow troops and buildings inside by 40%.',
      zones: [{ kind: 'cSlow', x: 4.5, y: 20.5, r: 2.1, mult: 0.6, mirror: true }, { kind: 'cSlow', x: 13.5, y: 20.5, r: 2.1, mult: 0.6, mirror: true }] },
    springs: { name: 'Healing Springs', icon: '⛲', cat: 'battlefield', sev: 1, dur: 20, weight: 2, group: 'zone',
      desc: 'A spring on each side heals every troop standing in it by 30 HP a second, friend or foe.',
      zones: [{ kind: 'cHeal', x: MID_X, y: 21.5, r: 2.4, perSec: 30, mirror: true }] },
    meteors: { name: 'Meteor Shower', icon: '☄️', cat: 'battlefield', sev: 2, dur: 18, weight: 2, group: 'hazard',
      desc: 'Every 4 s a meteor marks a spot on each side (mirrored) and lands 1.5 s later: 150 damage and a knockback to troops and buildings. Towers are spared.',
      zones: [{ kind: 'meteorField', x: MID_X, y: H / 2, r: 0, every: 4, delay: 1.5, hitR: 1.6, dmg: 150 }] },
    storm: { name: 'Eye of the Storm', icon: '🌀', cat: 'battlefield', sev: 2, dur: 20, weight: 2, group: 'hazard',
      desc: 'A storm drifts back and forth along the river, dealing 40 damage a second to troops and buildings inside.',
      zones: [{ kind: 'storm', x: 3, y: 16, r: 2.3, perSec: 40, speed: 1.6 }] },
    surge: { name: 'Elixir Surge', icon: '💧', cat: 'elixir', sev: 1, dur: 10, weight: 3, group: 'elixir',
      desc: 'Both players get +3 elixir right away, then elixir flows twice as fast for 10 s.',
      fx: { elixir: 2 }, start: { elixir: 3 } },
    drought: { name: 'Drought', icon: '🏜️', cat: 'elixir', sev: 2, dur: 15, weight: 2, group: 'elixir',
      desc: 'Elixir flows at half speed for 15 s. Spend wisely.',
      fx: { elixir: 0.5 } },
    sale: { name: 'Clearance Sale', icon: '🏷️', cat: 'elixir', sev: 1, dur: 12, weight: 2, group: 'cost',
      desc: 'Every card costs 1 less (never below 1) for 12 s.',
      fx: { cost: -1 } },
    highroller: { name: 'High Rollers', icon: '🎰', cat: 'elixir', sev: 2, dur: 15, weight: 2, group: 'cost',
      desc: 'Cards that cost 5 or more cost 2 less for 15 s.',
      fx: { costHeavy: -2 } },
    bounty: { name: 'Bounty Hunters', icon: '💰', cat: 'elixir', sev: 1, dur: 20, weight: 2,
      desc: 'Killing an enemy troop refunds 30% of its elixir (at most 2 per kill).',
      fx: { refund: 0.3 } },
    arcane: { name: 'Arcane Surge', icon: '🔮', cat: 'card', sev: 1, dur: 20, weight: 2,
      desc: 'Spells deal 40% more damage and cover 20% more area.',
      fx: { spellDmg: 1.4, spellRadius: 1.2 } },
    eagleeye: { name: 'Eagle Eye', icon: '🎯', cat: 'card', sev: 1, dur: 20, weight: 2,
      desc: 'Ranged troops (range 3+) get +1.5 range.',
      fx: { rangeAdd: 1.5 } },
    bulwark: { name: 'Bulwark', icon: '🧱', cat: 'card', sev: 1, dur: 20, weight: 2,
      desc: 'Buildings take 40% less damage and attack 30% faster.',
      fx: { buildIn: 0.6, buildAtk: 1.3 } },
    frenzy: { name: 'Swarm Frenzy', icon: '🐝', cat: 'card', sev: 1, dur: 18, weight: 2,
      desc: 'Troops from swarm cards attack 35% faster.',
      fx: { swarmAtk: 1.35 } },
    overclock: { name: 'Overclock', icon: '⚡', cat: 'troop', sev: 2, dur: 12, weight: 2, group: 'speed',
      desc: 'All troops move and attack 30% faster.',
      fx: { move: 1.3, atk: 1.3 } },
    glass: { name: 'Glass Cannons', icon: '🥂', cat: 'troop', sev: 2, dur: 15, weight: 2,
      desc: 'Troops deal 50% more damage but also take 30% more.',
      fx: { dmgOut: 1.5, dmgIn: 1.3 } },
    pinball: { name: 'Pinball', icon: '🎱', cat: 'troop', sev: 2, dur: 15, weight: 2,
      desc: 'Every single-target hit knocks ground troops back half a tile.',
      fx: { knock: 0.5 } },
    rattle: { name: 'Death Rattle', icon: '💀', cat: 'troop', sev: 2, dur: 18, weight: 2,
      desc: 'Troops that die burst for 20% of their max HP (up to 150) to enemy troops and buildings nearby.',
      fx: { deathBurst: 0.2 } },
    aegis: { name: 'Aegis', icon: '🛡️', cat: 'troop', sev: 1, dur: 15, weight: 2,
      desc: 'Every troop on the field (and every troop deployed for 15 s) gets a shield worth 25% of its max HP.',
      fx: { shieldPct: 0.25 }, start: { shield: 0.25 } },
    growth: { name: 'Growth Spurt', icon: '🌱', cat: 'troop', sev: 2, dur: 15, weight: 1,
      desc: 'Troops deployed for the next 15 s come out big: +40% HP, +15% damage, 10% slower.',
      fx: { grow: 1 } },
    evorush: { name: 'Evolution Rush', icon: '✦', cat: 'evolution', sev: 1, dur: 25, weight: 3, needs: 'evo',
      desc: 'Each play charges an equipped Evolution twice, and evolved troops deal 15% more damage.',
      fx: { evoCharge: 1, evoDmg: 1.15 } },
    towerfury: { name: 'Tower Fury', icon: '🏰', cat: 'tower', sev: 2, dur: 15, weight: 2, group: 'tower',
      desc: 'Crown towers fire 50% faster. A bad time to attack.',
      fx: { towerAtk: 1.5 } },
    finale: { name: 'Final Frenzy', icon: '🔥', cat: 'time', sev: 1, dur: 30, weight: 0, group: 'elixir', fixed: true,
      desc: 'The last 30 seconds: elixir flows 50% faster on top of double elixir, and towers fire 30% faster.',
      fx: { elixir: 1.5, towerAtk: 1.3 } },
  };

  // How each effect combines across active modifiers, and the range it is held to
  const MOD_STACK = {
    move: 'mul', atk: 'mul', dmgOut: 'mul', dmgIn: 'mul', spellDmg: 'mul', spellRadius: 'mul', elixir: 'mul',
    towerAtk: 'mul', buildIn: 'mul', buildAtk: 'mul', swarmAtk: 'mul', evoDmg: 'mul',
    cost: 'add', costHeavy: 'add', rangeAdd: 'add', evoCharge: 'add',
    refund: 'max', knock: 'max', deathBurst: 'max', shieldPct: 'max', grow: 'max',
  };
  const MOD_CAPS = {
    move: [0.5, 1.7], atk: [0.5, 1.7], dmgOut: [0.5, 1.8], dmgIn: [0.6, 1.6], spellDmg: [0.5, 1.6], spellRadius: [0.7, 1.4],
    elixir: [0.25, 3.5], towerAtk: [0.5, 1.8], buildIn: [0.4, 1.5], buildAtk: [0.5, 1.6], swarmAtk: [1, 1.6], evoDmg: [1, 1.3],
    cost: [-2, 2], costHeavy: [-2, 0], rangeAdd: [0, 2], evoCharge: [0, 1],
    refund: [0, 0.5], knock: [0, 0.8], deathBurst: [0, 0.25], shieldPct: [0, 0.3], grow: [0, 1],
  };
  const NO_FX = Object.freeze(Object.fromEntries(Object.keys(MOD_STACK).map((k) => [k, MOD_STACK[k] === 'mul' ? 1 : 0])));

  // Combine the effects of every active modifier (deliberate stacking, then clamped)
  function combineModFx(activeIds) {
    if (!activeIds.length) return NO_FX;
    const fx = { ...NO_FX };
    for (const id of activeIds) {
      const def = MODIFIERS[id];
      if (!def || !def.fx) continue;
      for (const k of Object.keys(def.fx)) {
        const v = def.fx[k];
        if (MOD_STACK[k] === 'mul') fx[k] *= v;
        else if (MOD_STACK[k] === 'add') fx[k] += v;
        else if (MOD_STACK[k] === 'max') fx[k] = Math.max(fx[k], v);
      }
    }
    for (const k of Object.keys(fx)) fx[k] = clamp(fx[k], MOD_CAPS[k][0], MOD_CAPS[k][1]);
    return Object.freeze(fx);
  }

  // ─── Match setup ─────────────────────────────────────────────────────────

  // Load a deck into a player's hand/stats. Used at match start and when an event swaps decks.
  function loadDeck(p, deck, rules) {
    const ids = deck.map((c) => c.id);
    const er = rules.evo;
    p.cards = {};
    p.cooldowns = {};
    p.evo = {}; // equipped Evolutions: cardId -> { need, charge }
    p.size = {}; // Size Roulette: cardId -> 'tiny' | 'mega' for the copy in hand
    deck.forEach((c) => {
      p.cards[c.id] = applyCardMods(getCardStatsAtLevel(c.id, c.level, c.abilityUnlocked, c.mastery), rules.cardMods);
      p.cooldowns[c.id] = 0;
      // Events can switch Evolutions off, or hand out every card's Evolution for this match only
      const def = !er.disabled && (c.evo || er.all) && evolutionOf(c.id);
      if (def) {
        const need = Math.max(0, def.cycles + er.cycleDelta);
        p.evo[c.id] = { need, charge: EVO_RULES.startCharged || er.startCharged ? need : 0 };
      }
    });
    p.hand = ids.slice(0, 4);
    p.queue = ids.slice(4);
  }

  function createPlayer(side, deck, rules) {
    const p = {
      side,
      elixir: rules.startElixir,
      crowns: 0,
      hand: [],
      queue: [],
      cards: {},
      cooldowns: {},
      damageDealt: 0,
      cardsPlayed: 0,
      evoPlayed: 0,
      evo: {},
      size: {},
      kills: 0,
      emoteLog: [],
    };
    loadDeck(p, deck, rules);
    return p;
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

  // ─── C.H.A.O.S. card upgrades ────────────────────────────────────────────
  //
  // In a C.H.A.O.S. match (rules.upgrades) each side is offered two card-specific upgrades at set
  // checkpoints, picks one, and that card keeps it for the rest of the match. The battle pauses while
  // a choice is open (rules.upgrades.pause); an unanswered choice takes the left offer when its timer
  // runs out. An upgrade is baked into that player's per-match card stats (p.cards), so it can never
  // reach the shared card table, the collection, or another match.
  //
  // An upgrade definition (all fields but id/card/rarity/name/desc are optional):
  //   stats   multipliers hp, dmg, cd, speed, lifetime, stun, knockback; additions range, splash, count, waves
  //   mech    merged into the card's own mechanics (slowOnHit, shield, deathSplash, deathSpawn, spawner, ramp, dash)
  //   em      merged into the unit's Evolution-style mechanics (shockwave, chain, cluster, stackHits, rally,
  //           dive, pulse, allyShield, impactZone, deathSummon, pierceLine); an equipped Evolution wins a clash
  //   spell   merged into the spell's Evolution-style effects (afterZone, echo, seek); zoneEcho repeats a zone spell
  //   zone    { mult: {...}, add: {...} } for lingering spells (duration, slow, troop count, roll length)
  //   special appended to the card's special keywords (e.g. 'chain')
  //   role    'offense' | 'defense' | 'both': what the AI weighs it as
  //
  // To add one: add an entry to CHAOS_UPGRADES (and the card to CHAOS_POOL), and add it to the tests'
  // every-upgrade smoke run. See CLASH_TANKS.md, "C.H.A.O.S. mode".

  const UPGRADE_RARITIES = {
    common: { name: 'Common', value: 1 },
    rare: { name: 'Rare', value: 2 },
    epic: { name: 'Epic', value: 3 },
  };
  const UPGRADE_RARITY_ORDER = ['common', 'rare', 'epic'];

  const chaosUp = (card, rarity, id, name, desc, fx) => Object.assign({ id: `${card}_${id}`, card, rarity, name, desc, role: 'both' }, fx);
  const CHAOS_UPGRADES = [
    // Troops
    chaosUp('brawler', 'common', 'plating', 'Iron Plating', '+30% HP.', { stats: { hp: 1.3 }, role: 'defense' }),
    chaosUp('brawler', 'rare', 'quake', 'Quake Fist', 'Every 3rd punch makes a shockwave around its target: splash damage and knockback.', { em: { shockwave: { every: 3, radius: 1.6, dmgMult: 0.6, knock: 1 } } }),
    chaosUp('brawler', 'epic', 'unbreakable', 'Unbreakable', 'Deploys with a 450 HP shield and +15% HP.', { stats: { hp: 1.15 }, mech: { shield: 450 }, role: 'defense' }),
    chaosUp('scout', 'common', 'fleet', 'Fleet Foot', '+30% speed and +15% damage.', { stats: { speed: 1.3, dmg: 1.15 }, role: 'offense' }),
    chaosUp('scout', 'rare', 'party', 'Scout Party', 'Deploys 2 Scouts instead of 1.', { stats: { count: 1 }, role: 'offense' }),
    chaosUp('scout', 'epic', 'sharpshooter', 'Sharpshooter', '+2 range, and every shot pierces everything in a line.', { stats: { range: 2 }, em: { pierceLine: { width: 0.55, falloff: 0.7 } }, role: 'offense' }),
    chaosUp('voltbug', 'common', 'overcharge', 'Overcharge', '+35% damage.', { stats: { dmg: 1.35 } }),
    chaosUp('voltbug', 'rare', 'storm', 'Storm Chain', 'Lightning jumps to 4 more enemies and briefly stuns the first.', { em: { chain: { count: 4, stunPrimary: 0.25 } } }),
    chaosUp('voltbug', 'epic', 'thunderhead', 'Thunderhead', 'Lightning jumps to 5 more enemies, stuns the first, and slows everything it hits.', { em: { chain: { count: 5, stunPrimary: 0.4 } }, mech: { slowOnHit: { mult: 0.6, dur: 1.5 } } }),
    chaosUp('drillcat', 'common', 'tempered', 'Tempered Drill', '+30% HP.', { stats: { hp: 1.3 }, role: 'defense' }),
    chaosUp('drillcat', 'rare', 'bore', 'Bore Through', 'Each hit in a row on the same target drills 40% deeper (up to +120%).', { em: { stackHits: { per: 0.4, max: 3 } } }),
    chaosUp('drillcat', 'epic', 'diamond', 'Diamond Core', 'Hits stack 55% deeper (up to +220%), and it explodes when destroyed.', { em: { stackHits: { per: 0.55, max: 4 } }, mech: { deathSplash: { radius: 1.8, dmg: 160 } } }),
    chaosUp('ramhog', 'common', 'hide', 'Thick Hide', '+30% HP.', { stats: { hp: 1.3 }, role: 'offense' }),
    chaosUp('ramhog', 'rare', 'stampede', 'Stampede', 'Two Ram Hogs, each with 75% HP.', { stats: { count: 1, hp: 0.75 }, role: 'offense' }),
    chaosUp('ramhog', 'epic', 'wrecking', 'Wrecking Ram', 'Charges in behind a 350 HP shield and explodes when destroyed.', { mech: { shield: 350, deathSplash: { radius: 1.8, dmg: 150 } }, role: 'offense' }),
    chaosUp('flarepod', 'common', 'wide', 'Wide Flare', 'Splash radius +0.5 tiles.', { stats: { splash: 0.5 }, role: 'defense' }),
    chaosUp('flarepod', 'rare', 'cluster', 'Cluster Flare', 'Each flare bursts into 3 bomblets around the impact.', { em: { cluster: { count: 3, spread: 1.5, dmgMult: 0.4, radius: 0.9 } } }),
    chaosUp('flarepod', 'epic', 'searing', 'Searing Ground', '+20% damage, and every flare leaves a 3 s patch that slows enemies by 50%.', { stats: { dmg: 1.2 }, em: { impactZone: { kind: 'slow', slow: 0.5, dur: 3, radius: 1.6 } }, role: 'defense' }),
    chaosUp('cryocaster', 'common', 'deepfreeze', 'Deep Freeze', 'Its slow is 50% (from 30%) and lasts 2 s.', { mech: { slowOnHit: { mult: 0.5, dur: 2 } }, role: 'defense' }),
    chaosUp('cryocaster', 'rare', 'shatter', 'Shatter', '+50% damage.', { stats: { dmg: 1.5 } }),
    chaosUp('cryocaster', 'epic', 'glacier', 'Glacier', 'Every shard leaves a 3.5 s patch of ice that slows enemies by 55%.', { em: { impactZone: { kind: 'slow', slow: 0.45, dur: 3.5, radius: 2 } }, role: 'defense' }),
    chaosUp('guardian', 'common', 'reinforced', 'Reinforced', '+30% HP.', { stats: { hp: 1.3 }, role: 'defense' }),
    chaosUp('guardian', 'rare', 'aegis', 'Aegis Pulse', 'When it lands and every 8 s, shields the 4 nearest allies for 110 HP.', { em: { allyShield: { every: 8, amount: 110, radius: 3, max: 4 } } }),
    chaosUp('guardian', 'epic', 'prime', 'Bastion Prime', 'A 300 HP shield of its own, and shields up to 6 allies for 160 HP every 5 s.', { mech: { shield: 300 }, em: { allyShield: { every: 5, amount: 160, radius: 3.5, max: 6 } } }),
    chaosUp('junkpack', 'common', 'bigger', 'Bigger Pack', 'Deploys 4 instead of 3.', { stats: { count: 1 } }),
    chaosUp('junkpack', 'rare', 'rally', 'Scrap Rally', 'When a packmate falls, the rest get 35% faster (up to 2 stacks).', { em: { rally: { per: 0.35, max: 2 } } }),
    chaosUp('junkpack', 'epic', 'horde', 'Junkyard Horde', 'Deploys 5, and they rally when packmates fall.', { stats: { count: 2 }, em: { rally: { per: 0.35, max: 2 } } }),
    chaosUp('wolfpack', 'common', 'fangs', 'Sharp Fangs', '+25% damage.', { stats: { dmg: 1.25 } }),
    chaosUp('wolfpack', 'rare', 'fury', 'Pack Fury', 'When a wolf falls, the rest get 40% faster (up to 2 stacks).', { em: { rally: { per: 0.4, max: 2 } } }),
    chaosUp('wolfpack', 'epic', 'alpha', 'Alpha Pack', 'Deploys 4 wolves with +20% HP.', { stats: { count: 1, hp: 1.2 } }),
    chaosUp('hawkstrike', 'common', 'talons', 'Talons', '+25% damage.', { stats: { dmg: 1.25 } }),
    chaosUp('hawkstrike', 'rare', 'dive', 'Dive Strike', 'Opens on each target with a 2.5× dive hit (every 4 s).', { em: { dive: { mult: 2.5, cd: 4 } }, role: 'offense' }),
    chaosUp('hawkstrike', 'epic', 'flock', 'Raptor Flock', 'Deploys 5 hawks, and each dives for 2.5× damage.', { stats: { count: 2 }, em: { dive: { mult: 2.5, cd: 4 } } }),
    chaosUp('phantomrider', 'common', 'blade', 'Phantom Blade', '+30% damage.', { stats: { dmg: 1.3 } }),
    chaosUp('phantomrider', 'rare', 'restless', 'Restless', 'Dashes much more often (every 2 s) and from further away.', { mech: { dash: { min: 2, max: 7, speed: 12, cd: 2 } }, role: 'offense' }),
    chaosUp('phantomrider', 'epic', 'wraith', 'Wraith', 'A 200 HP shield, and 3 Skeletons rise when it is destroyed.', { mech: { shield: 200, deathSpawn: { card: 'cryptskel', count: 3 } } }),
    chaosUp('rocktitan', 'common', 'bedrock', 'Bedrock', '+20% HP.', { stats: { hp: 1.2 }, role: 'offense' }),
    chaosUp('rocktitan', 'rare', 'landslide', 'Landslide', 'Breaks into 4 Rock Shards (from 2) when destroyed.', { mech: { deathSpawn: { card: 'rockshard', count: 4 } }, role: 'offense' }),
    chaosUp('rocktitan', 'epic', 'avalanche', 'Avalanche', 'Every 2nd hit makes a big shockwave that knocks troops away.', { em: { shockwave: { every: 2, radius: 2, dmgMult: 0.8, knock: 1.2 } }, role: 'offense' }),
    chaosUp('bugsquad', 'common', 'bigger', 'Bigger Squad', 'Deploys 6 instead of 4.', { stats: { count: 2 } }),
    chaosUp('bugsquad', 'rare', 'sticky', 'Sticky Shots', 'Shots slow enemies by 30% for 1.2 s.', { mech: { slowOnHit: { mult: 0.7, dur: 1.2 } }, role: 'defense' }),
    chaosUp('bugsquad', 'epic', 'arc', 'Arc Squad', 'Every shot chains to 2 more enemies.', { special: 'chain', em: { chain: { count: 2, stunPrimary: 0 } } }),
    chaosUp('goblinbikers', 'common', 'nitro', 'Nitro', '+25% speed and +15% damage.', { stats: { speed: 1.25, dmg: 1.15 }, role: 'offense' }),
    chaosUp('goblinbikers', 'rare', 'armored', 'Armored Bikes', '+50% HP.', { stats: { hp: 1.5 }, role: 'offense' }),
    chaosUp('goblinbikers', 'epic', 'bombs', 'Bomb Bikes', 'Each biker explodes when destroyed.', { mech: { deathSplash: { radius: 1.4, dmg: 70 } }, role: 'offense' }),
    chaosUp('mechmice', 'common', 'extra', 'Extra Mouse', 'Deploys 3 instead of 2.', { stats: { count: 1 } }),
    chaosUp('mechmice', 'rare', 'overclock', 'Overclock', '+30% damage and attacks 20% faster.', { stats: { dmg: 1.3, cd: 0.8 } }),
    chaosUp('mechmice', 'epic', 'mousebombs', 'Mouse Bombs', 'Each mouse explodes when destroyed.', { mech: { deathSplash: { radius: 1.3, dmg: 90 } } }),
    chaosUp('crackergang', 'common', 'barrels', 'Long Barrels', '+1.5 range.', { stats: { range: 1.5 } }),
    chaosUp('crackergang', 'rare', 'spark', 'Spark Rounds', 'Every shot chains to 2 more enemies and stuns the first briefly.', { special: 'chain', em: { chain: { count: 2, stunPrimary: 0.15 } } }),
    chaosUp('crackergang', 'epic', 'finale', 'Firework Finale', 'Deploys 5, and each one explodes when destroyed.', { stats: { count: 1 }, mech: { deathSplash: { radius: 1.6, dmg: 110 } } }),
    chaosUp('teslatank', 'common', 'capacitors', 'Capacitors', 'Charges its shot 25% faster.', { stats: { cd: 0.75 } }),
    chaosUp('teslatank', 'rare', 'coil', 'Overcharged Coil', '+35% damage and +0.5 splash.', { stats: { dmg: 1.35, splash: 0.5 } }),
    chaosUp('teslatank', 'epic', 'engine', 'Storm Engine', 'Every shot also discharges around itself, knocking nearby troops back.', { em: { pulse: { every: 1, radius: 2.5, dmgMult: 0.5, knock: 1 } }, role: 'defense' }),
    // Buildings
    chaosUp('boltturret', 'common', 'battery', 'Extended Battery', 'Lasts 50% longer and has +20% HP.', { stats: { lifetime: 1.5, hp: 1.2 }, role: 'defense' }),
    chaosUp('boltturret', 'rare', 'arc', 'Arc Pulse', 'Every 3rd shot also blasts everything around it and knocks troops back.', { em: { pulse: { every: 3, radius: 2.5, dmgMult: 0.9, knock: 1.1 } }, role: 'defense' }),
    chaosUp('boltturret', 'epic', 'chain', 'Chain Turret', 'Bolts chain to 3 more enemies and stun the first.', { special: 'chain', em: { chain: { count: 3, stunPrimary: 0.3 } }, role: 'defense' }),
    chaosUp('infernospire', 'common', 'core', 'Hotter Core', 'Its beam reaches full heat in 2.5 s (from 4 s).', { mech: { ramp: 2.5 }, role: 'defense' }),
    chaosUp('infernospire', 'rare', 'heatshield', 'Heat Shield', '+40% HP and lasts 30% longer.', { stats: { hp: 1.4, lifetime: 1.3 }, role: 'defense' }),
    chaosUp('infernospire', 'epic', 'meltdown', 'Meltdown', 'Heats up in 3 s, and blows up for heavy damage when destroyed or expired.', { mech: { ramp: 3, deathSplash: { radius: 2.5, dmg: 300 } }, role: 'defense' }),
    chaosUp('bonecrypt', 'common', 'restless', 'Restless Dead', 'Raises a Skeleton every 2 s (from 2.9 s).', { mech: { spawner: { card: 'cryptskel', every: 2, count: 1, onDeath: 3 } }, role: 'defense' }),
    chaosUp('bonecrypt', 'rare', 'giant', 'Bone Giant', 'A 520 HP Bone Giant rises when it is destroyed or expires, instead of 3 Skeletons.', { em: { deathSummon: { card: 'bonegiant', count: 1, replaces: true } } }),
    chaosUp('bonecrypt', 'epic', 'necropolis', 'Necropolis', 'Raises 2 Skeletons at a time, lasts 30% longer, and releases 4 at the end.', { stats: { lifetime: 1.3 }, mech: { spawner: { card: 'cryptskel', every: 2.4, count: 2, onDeath: 4 } }, role: 'defense' }),
    // Spells
    chaosUp('firebomb', 'common', 'wide', 'Wide Blast', 'Blast radius +0.7 tiles.', { stats: { splash: 0.7 } }),
    chaosUp('firebomb', 'rare', 'napalm', 'Napalm', 'Leaves burning ground for 3 s.', { spell: { afterZone: { kind: 'dot', dur: 3, tick: 0.5, dmgMult: 0.35, radius: 2 } } }),
    chaosUp('firebomb', 'epic', 'inferno', 'Inferno Bomb', '+30% damage, and leaves a big fire for 4 s.', { stats: { dmg: 1.3 }, spell: { afterZone: { kind: 'dot', dur: 4, tick: 0.5, dmgMult: 0.5, radius: 2.5 } } }),
    chaosUp('shock', 'common', 'long', 'Long Shock', 'Stuns for twice as long.', { stats: { stun: 2 }, role: 'defense' }),
    chaosUp('shock', 'rare', 'overload', 'Overload', 'An aftershock 0.8 s later: 60% damage and a longer stun.', { spell: { echo: { delay: 0.8, dmgMult: 0.6, stun: 0.8 } } }),
    chaosUp('shock', 'epic', 'thunderclap', 'Thunderclap', '+50% damage, +0.8 radius, and an aftershock.', { stats: { dmg: 1.5, splash: 0.8 }, spell: { echo: { delay: 0.8, dmgMult: 0.6, stun: 0.8 } } }),
    chaosUp('rocketrain', 'common', 'fourth', 'Fourth Wave', 'A 4th wave of rockets (+33% total damage).', { stats: { waves: 1, dmg: 1.33 } }),
    chaosUp('rocketrain', 'rare', 'homing', 'Homing Barrage', '6 rockets lock on to different enemies in the circle.', { spell: { seek: { count: 6, dmgMult: 0.3, radius: 1.2 } } }),
    chaosUp('rocketrain', 'epic', 'swarm', 'Swarm Missiles', '10 homing rockets lock on to different enemies.', { spell: { seek: { count: 10, dmgMult: 0.28, radius: 1.3 } } }),
    chaosUp('boulder', 'common', 'long', 'Longer Roll', 'Rolls 14 tiles (from 10).', { zone: { add: { length: 4 } } }),
    chaosUp('boulder', 'rare', 'heavy', 'Heavy Boulder', '+40% damage and 50% more knockback.', { stats: { dmg: 1.4, knockback: 1.5 } }),
    chaosUp('boulder', 'epic', 'double', 'Double Roll', 'A second boulder rolls the same path a moment later.', { spell: { zoneEcho: 1 } }),
    chaosUp('acidpool', 'common', 'lingering', 'Lingering Acid', 'Lasts 9 s (from 6 s) at the same strength per second.', { stats: { dmg: 1.5 }, zone: { mult: { dur: 1.5 } }, role: 'defense' }),
    chaosUp('acidpool', 'rare', 'caustic', 'Caustic', 'Enemies inside are slowed by 45% (from 20%).', { zone: { mult: { slow: 0.69 } }, role: 'defense' }),
    chaosUp('acidpool', 'epic', 'flood', 'Acid Flood', '+1 radius and +40% damage.', { stats: { splash: 1, dmg: 1.4 } }),
    chaosUp('paratroopers', 'common', 'extra', 'Extra Squad', 'Drops 8 paratroopers (from 6).', { zone: { add: { count: 2 } }, role: 'offense' }),
    chaosUp('paratroopers', 'rare', 'rapid', 'Rapid Drop', 'Drops 7, twice as fast.', { zone: { add: { count: 1 }, mult: { dur: 0.5 } }, role: 'offense' }),
    chaosUp('paratroopers', 'epic', 'division', 'Airborne Division', 'Drops 11 paratroopers.', { zone: { add: { count: 5 } }, role: 'offense' }),
  ];
  const CHAOS_UPGRADE_MAP = Object.fromEntries(CHAOS_UPGRADES.map((u) => [u.id, u]));
  // Cards eligible for C.H.A.O.S. (base versions): exactly the cards that have upgrades
  const CHAOS_POOL = [...new Set(CHAOS_UPGRADES.map((u) => u.card))];

  /** The upgrades a card can get (keyed by family, so a card's Mk-II shares them). */
  function upgradesFor(cardId) {
    const c = CARD_MAP[cardId];
    return c ? CHAOS_UPGRADES.filter((u) => u.card === c.slug) : [];
  }

  /** Problems in the upgrade table (missing cards, unknown tokens, impossible combinations). Empty when sound. */
  function validateUpgrades() {
    const problems = [];
    const seen = new Set();
    for (const u of CHAOS_UPGRADES) {
      const c = CARD_MAP[u.card];
      if (seen.has(u.id)) problems.push(`${u.id}: duplicate id`);
      seen.add(u.id);
      if (!c || c.token) { problems.push(`${u.id}: unknown card ${u.card}`); continue; }
      if (!UPGRADE_RARITIES[u.rarity]) problems.push(`${u.id}: unknown rarity ${u.rarity}`);
      if (!u.name || !u.desc) problems.push(`${u.id}: needs a name and a description`);
      const m = u.mech || {};
      ['deathSpawn', 'spawner'].forEach((k) => { if (m[k] && !CARD_MAP[m[k].card]) problems.push(`${u.id}: ${k} card ${m[k].card} does not exist`); });
      if (u.em && u.em.deathSummon && !CARD_MAP[u.em.deathSummon.card]) problems.push(`${u.id}: deathSummon card does not exist`);
      if ((u.spell || u.zone) && !c.spell) problems.push(`${u.id}: spell effects on a card that is not a spell`);
      if (u.zone && !c.zone) problems.push(`${u.id}: zone changes on a spell without a zone`);
      if (u.spell && u.spell.zoneEcho && !c.zone) problems.push(`${u.id}: zoneEcho needs a zone spell`);
      if (u.em && u.em.shockwave && c.proj !== 'melee') problems.push(`${u.id}: shockwave needs a melee card`);
      if (u.em && (u.em.chain || u.em.cluster || u.em.impactZone) && (c.proj === 'melee' || c.building && c.targets === 'none')) problems.push(`${u.id}: projectile effects need a ranged attacker`);
      if (u.em && u.em.chain && !(c.special || '').includes('chain') && !(u.special || '').includes('chain')) problems.push(`${u.id}: chain needs the chain keyword`);
      if (u.em && u.em.rally && !(c.swarmCount > 1)) problems.push(`${u.id}: rally needs a swarm card`);
      if (u.stats && u.stats.count && c.spell) problems.push(`${u.id}: count on a spell`);
    }
    for (const id of CHAOS_POOL) {
      const r = new Set(upgradesFor(id).map((u) => u.rarity));
      UPGRADE_RARITY_ORDER.forEach((rar) => { if (!r.has(rar)) problems.push(`${id}: no ${rar} upgrade`); });
    }
    return problems;
  }

  // Card stats with an upgrade baked in (a new object; the stats passed in are never changed)
  function upgradedStats(stats, def) {
    if (!stats || !def) return stats;
    const s = { ...stats, upg: def.id };
    const st = def.stats || {};
    if (st.hp) { s.hpScaled = Math.round(s.hpScaled * st.hp); }
    if (st.dmg) s.dmgScaled = +(s.dmgScaled * st.dmg).toFixed(2);
    if (st.cd) s.cd = r2(Math.max(0.3, s.cd * st.cd));
    if (st.speed) s.speed = r2(s.speed * st.speed);
    if (st.lifetime && s.lifetime) s.lifetime = r2(s.lifetime * st.lifetime);
    if (st.stun) s.stun = r2((s.stun || 0) * st.stun);
    if (st.knockback) s.knockback = r2((s.knockback || 0) * st.knockback);
    if (st.range) { s.range = r2(s.range + st.range); s.sight = Math.max(s.sight || 0, s.range + 1.5); }
    if (st.splash) s.splash = r2((s.splash || 0) + st.splash);
    if (st.count) s.swarmCount = (s.swarmCount || 1) + st.count;
    if (st.waves) s.waves = (s.waves || 1) + st.waves;
    if (def.mech) s.mech = { ...(s.mech || {}), ...def.mech };
    if (def.special) s.special = `${s.special || ''} ${def.special}`.trim();
    if (def.zone && s.zone) {
      const z = { ...s.zone };
      Object.entries(def.zone.mult || {}).forEach(([k, v]) => { if (typeof z[k] === 'number') z[k] = r2(z[k] * v); });
      Object.entries(def.zone.add || {}).forEach(([k, v]) => { z[k] = r2((z[k] || 0) + v); });
      s.zone = z;
    }
    return s;
  }

  // A unit's Evolution-style mechanics: its upgrade's, with an equipped Evolution winning any clash
  function unitEvoMech(stats) {
    const um = stats.upg && CHAOS_UPGRADE_MAP[stats.upg] ? CHAOS_UPGRADE_MAP[stats.upg].em : null;
    const ev = stats.evo ? stats.evo.mech : null;
    if (!um) return ev || null;
    return ev ? { ...um, ...ev } : um;
  }

  // A spell's Evolution-style effects, merged the same way
  function spellEvoFx(stats) {
    const us = stats.upg && CHAOS_UPGRADE_MAP[stats.upg] ? CHAOS_UPGRADE_MAP[stats.upg].spell : null;
    const ev = stats.evo ? stats.evo.spell : null;
    if (!us) return ev || null;
    return ev ? { ...us, ...ev } : us;
  }

  // Deterministic shuffle (Princess Gambit draw order), apart from the battle's random numbers
  function shuffleWith(list, seed) {
    const rand = offerRng(seed);
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    return list;
  }

  // Small deterministic generator for offers (kept apart from the battle's own random numbers)
  function offerRng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // Rules for the upgrade draft (rules.upgrades), cleaned like every other rule
  function normalizeUpgradeRules(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const checkpoints = (Array.isArray(raw.checkpoints) ? raw.checkpoints : []).slice(0, 12)
      .map((c) => ({ at: num(c && c.at, 0, 0, 900), rarity: UPGRADE_RARITIES[c && c.rarity] ? c.rarity : 'common' }))
      .sort((a, b) => a.at - b.at);
    if (!checkpoints.length) return null;
    return {
      checkpoints,
      choiceSecs: num(raw.choiceSecs, 10, 3, 30),
      pause: raw.pause !== false,
      autoPick: raw.autoPick === 1 ? 1 : 0,
      perCard: Math.floor(num(raw.perCard, 1, 1, 3)),
    };
  }

  function freshChaos() {
    return { next: 0, active: null, upgrades: { A: {}, B: {} }, history: [] };
  }

  // What a side could be offered at this rarity, and why the rest was left out (for the debug view)
  function upgradeCandidates(state, side, rarity) {
    const p = state.players[side];
    const ch = state.chaos;
    const cfg = state.rules.upgrades;
    const ids = Object.keys(p.cards);
    const eligible = [];
    const rejected = [];
    for (const id of ids) {
      const owned = ch.upgrades[side][id] ? 1 : 0;
      const list = upgradesFor(id);
      if (!list.length) { rejected.push({ cardId: id, why: 'no upgrades for this card' }); continue; }
      if (owned >= cfg.perCard) { rejected.push({ cardId: id, why: 'already upgraded' }); continue; }
      const fits = list.filter((u) => u.rarity === rarity);
      if (!fits.length) { rejected.push({ cardId: id, why: `no ${rarity} upgrade` }); continue; }
      fits.forEach((u) => eligible.push({ cardId: id, upgradeId: u.id }));
    }
    return { eligible, rejected };
  }

  const cardKind = (c) => (c.spell ? 'spell' : c.building ? 'building' : 'troop');

  /**
   * Two offers for a side at a checkpoint: both of the checkpoint's rarity, on two different cards
   * when possible (preferring two different kinds of card, so the choice is a real trade-off). Falls
   * back to the nearest rarity that has offers, then to two upgrades of one card. Null when nothing fits.
   */
  function makeOffers(state, side, n) {
    const want = state.rules.upgrades.checkpoints[n].rarity;
    const rand = offerRng((state.seed ^ Math.imul(n + 1, 0x9e3779b1) ^ (side === 'A' ? 0x51ed : 0xa2c3)) >>> 0);
    const order = [want].concat(UPGRADE_RARITY_ORDER.filter((r) => r !== want).sort((a, b) => Math.abs(UPGRADE_RARITY_ORDER.indexOf(a) - UPGRADE_RARITY_ORDER.indexOf(want)) - Math.abs(UPGRADE_RARITY_ORDER.indexOf(b) - UPGRADE_RARITY_ORDER.indexOf(want))));
    for (const rarity of order) {
      const { eligible } = upgradeCandidates(state, side, rarity);
      if (!eligible.length) continue;
      const pick = (list) => list[Math.floor(rand() * list.length)];
      const first = pick(eligible);
      const fc = CARD_MAP[first.cardId];
      const others = eligible.filter((e) => e.cardId !== first.cardId);
      const contrast = others.filter((e) => cardKind(CARD_MAP[e.cardId]) !== cardKind(fc));
      const second = contrast.length && rand() < 0.75 ? pick(contrast) : others.length ? pick(others) : pick(eligible.filter((e) => e.upgradeId !== first.upgradeId));
      if (!second) continue; // only one upgrade fits at this rarity: try another rarity
      return { rarity, offers: [first, second] };
    }
    // Last card standing: two of its upgrades, the wanted rarity (or nearest) first
    for (const rarity of order) {
      const first = upgradeCandidates(state, side, rarity).eligible[0];
      if (!first) continue;
      const rest = order.filter((r) => r !== rarity).map((r) => upgradeCandidates(state, side, r).eligible.find((e) => e.cardId === first.cardId)).filter(Boolean);
      if (rest.length) return { rarity, offers: [first, rest[0]] };
    }
    return null;
  }

  // Open a checkpoint: roll both sides' offers. Sides with nothing to offer sit this one out.
  function openCheckpoint(state, n) {
    const ch = state.chaos;
    const offers = {};
    const picked = {};
    let any = false;
    ['A', 'B'].forEach((side) => {
      if (state.rules.noTowers.includes(side) && state.rules.waves) { offers[side] = null; picked[side] = -1; return; }
      const o = makeOffers(state, side, n);
      offers[side] = o;
      picked[side] = o ? null : -1;
      if (o) any = true;
    });
    if (!any) return false;
    const cfg = state.rules.upgrades;
    ch.active = { n, rarity: cfg.checkpoints[n].rarity, wait: cfg.choiceSecs, total: cfg.choiceSecs, offers, picked, auto: {} };
    pushFx(state, { type: 'upgradeOpen', n });
    return true;
  }

  function applyUpgrade(state, side, offer, n, auto) {
    const p = state.players[side];
    const def = CHAOS_UPGRADE_MAP[offer.upgradeId];
    if (!def || !p.cards[offer.cardId]) return;
    p.cards[offer.cardId] = upgradedStats(p.cards[offer.cardId], def);
    state.chaos.upgrades[side][offer.cardId] = def.id;
    pushFx(state, { type: 'upgrade', owner: side, cardId: offer.cardId, upgradeId: def.id, rarity: def.rarity, auto: auto ? 1 : 0 });
  }

  /** A side picks offer 0 (left) or 1 (right). Resolves once; anything else is refused. */
  function chooseUpgrade(state, side, idx) {
    const ch = state.chaos;
    const a = ch && ch.active;
    if (!a) return { ok: false, reason: 'No upgrade choice is open' };
    if (side !== 'A' && side !== 'B') return { ok: false, reason: 'Unknown side' };
    if (!a.offers[side]) return { ok: false, reason: 'No offer for this side' };
    if (a.picked[side] != null) return { ok: false, reason: 'Already chosen' };
    const i = Number(idx);
    if (i !== 0 && i !== 1) return { ok: false, reason: 'Pick 0 or 1' };
    resolvePick(state, side, i, false);
    return { ok: true, upgradeId: a.offers[side].offers[i].upgradeId };
  }

  function resolvePick(state, side, i, auto) {
    const ch = state.chaos;
    const a = ch.active;
    const o = a.offers[side];
    a.picked[side] = i;
    a.auto[side] = !!auto;
    applyUpgrade(state, side, o.offers[i], a.n, auto);
    ch.history.push({
      n: a.n, side, at: r2(state.time), rarity: o.rarity, auto: !!auto,
      chosen: o.offers[i], other: o.offers[1 - i],
    });
  }

  // Runs at the top of every step. Returns true while the battle is paused for a choice.
  function updateChaos(state, dt) {
    const ch = state.chaos;
    const cfg = state.rules.upgrades;
    if (!ch || !cfg || !state.running) return false;
    if (!ch.active && ch.next < cfg.checkpoints.length && state.time >= cfg.checkpoints[ch.next].at) {
      const n = ch.next++;
      openCheckpoint(state, n);
    }
    const a = ch.active;
    if (!a) return false;
    a.wait = r2(Math.max(0, a.wait - dt));
    if (a.wait <= 0) ['A', 'B'].forEach((side) => { if (a.picked[side] == null) resolvePick(state, side, cfg.autoPick, true); });
    if (a.picked.A != null && a.picked.B != null) {
      ch.active = null;
      pushFx(state, { type: 'upgradeClose', n: a.n });
      return false;
    }
    return cfg.pause;
  }

  // Is play frozen for an upgrade choice right now?
  function choicePaused(state) {
    return !!(state.chaos && state.chaos.active && state.rules.upgrades && state.rules.upgrades.pause);
  }

  /**
   * How much an upgrade is worth to this AI right now. Reads only its own deck, the public board and
   * its own offers: the card's role and cost (cheap cards come round more often), whether it's in hand,
   * the upgrade's rarity and role, the score, which side is under pressure, and the time left.
   */
  function scoreUpgrade(state, side, offer, rand) {
    const def = CHAOS_UPGRADE_MAP[offer.upgradeId];
    const p = state.players[side];
    const c = p.cards[offer.cardId];
    if (!def || !c) return -Infinity;
    const foe = enemyOf(side);
    let v = UPGRADE_RARITIES[def.rarity].value * 3;
    v += c.winCondition ? 2 : 0;
    v += c.spell ? 0.5 : 0;
    v += clamp(5 - c.cost, -2, 3) * 0.4; // cheap cards are played more often
    if (p.hand.includes(offer.cardId)) v += 0.6 + Math.max(0, 1 - timeLeft(state) / 60); // late on, what's in hand matters most
    const myCrowns = p.crowns;
    const theirCrowns = state.players[foe].crowns;
    const myLow = Math.min(...state.towers.filter((t) => t.owner === side && t.hp > 0).map((t) => t.hp / t.hpMax), 1);
    const behind = theirCrowns > myCrowns;
    const pressured = myLow < 0.5 || state.units.some((u) => u.owner === foe && u.hp > 0 && !ownHalf(foe, u.y));
    if (def.role === 'offense') v += behind ? 1.5 : 0.3;
    if (def.role === 'defense') v += pressured ? 1.5 : 0.2;
    return v + rand() * 1.2;
  }

  // The AI's half of a choice: a short moment to "think", then the better-scored offer
  function aiChooseUpgrade(state, brain, dt) {
    const a = state.chaos && state.chaos.active;
    const side = brain.side;
    if (!a || !a.offers[side] || a.picked[side] != null) { brain.upgradeWait = null; return false; }
    if (brain.upgradeWait == null) brain.upgradeWait = 0.8 + brain.rand() * 1.4;
    brain.upgradeWait -= dt;
    if (brain.upgradeWait > 0) return true;
    brain.upgradeWait = null;
    const offers = a.offers[side].offers;
    const s = offers.map((o) => scoreUpgrade(state, side, o, brain.rand));
    chooseUpgrade(state, side, s[1] > s[0] ? 1 : 0);
    return true;
  }

  // What clients see. Both sides' upgrades are public once chosen (they show on the cards and units);
  // pending offers are per side, and the server hides the other side's (see server.js).
  function chaosSnapshot(state) {
    const ch = state.chaos;
    const cfg = state.rules.upgrades;
    if (!ch || !cfg) return undefined;
    const a = ch.active;
    return {
      n: ch.next, total: cfg.checkpoints.length,
      nextAt: ch.next < cfg.checkpoints.length ? cfg.checkpoints[ch.next].at : null,
      nextRarity: ch.next < cfg.checkpoints.length ? cfg.checkpoints[ch.next].rarity : null,
      pause: cfg.pause,
      active: a ? { n: a.n, rarity: a.rarity, wait: a.wait, total: a.total, offers: { A: a.offers.A, B: a.offers.B }, picked: { ...a.picked } } : null,
      upgrades: { A: { ...ch.upgrades.A }, B: { ...ch.upgrades.B } },
      history: ch.history.map((h) => ({ ...h })),
    };
  }

  /** Debug view for development tools: the pool, the next checkpoint, what each side could be offered and why not. */
  function chaosDebug(state) {
    const ch = state.chaos;
    const cfg = state.rules.upgrades;
    if (!ch || !cfg) return null;
    const next = cfg.checkpoints[ch.next] || null;
    const sides = {};
    ['A', 'B'].forEach((side) => {
      const rarity = next ? next.rarity : 'common';
      sides[side] = { ...upgradeCandidates(state, side, rarity), upgrades: { ...ch.upgrades[side] } };
    });
    return { config: cfg, next, nextIndex: ch.next, active: ch.active, sides, poolSize: CHAOS_POOL.length, upgradeCount: CHAOS_UPGRADES.length, problems: validateUpgrades() };
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
      playLog: [],           // every card played, in order { n, owner, cardId, at, swap }: public, both players see it
      playSeq: 0,
      fx: [],
      lastEmote: null,
      players: {},
      nav: createNav(),
      hash: null,
      byId: new Map(),
      // Event runtime (all of it lives on the match, so it disappears with the match)
      rules: normalizeRules(o.rules),
      mods: { next: 0, active: [] }, // timed modifiers: index of the next to start, and the running ones
      modFx: NO_FX,                  // their combined effects (see combineModFx)
      hill: null,                    // King of the Hill state
      waveNo: 0,                     // survival: waves sent so far
      boss: null,                    // boss battle: { id, spawned, summons, enraged }
      swapNo: 0,                     // deck swaps done
      chaos: null,                   // C.H.A.O.S.: { next, active, upgrades: { A, B }, history } (see freshChaos)
      obj: null,                     // objective modes: payload cart, held zones, chests (see freshObjectives)
      stage: 0,                      // Ramp-Up: index of the current elixir stage
    };
    const rules = state.rules;
    ['A', 'B'].forEach((side) => {
      let deck = normalizeDeck(o.decks && o.decks[side]);
      // Princess Gambit: no deck of your own; each side draws the shared pool in its own order
      if (rules.gambit) deck = shuffleWith(rules.gambit.pool.slice(), (state.seed ^ (side === 'A' ? 0x1234 : 0xbeef)) >>> 0).map((id) => ({ id, level: rules.cardLevel || 9 }));
      if (rules.cardLevel) deck = deck.map((c) => ({ ...c, level: rules.cardLevel }));
      const p = createPlayer(side, deck, rules);
      state.players[side] = p;
      p.hand.forEach((id) => rollSize(state, p, id));
      if (rules.noTowers.includes(side)) return;
      let t = (o.towers && o.towers[side]) || {};
      if (rules.towerLevel) t = { ...t, towerLevel: rules.towerLevel, kingLevel: rules.towerLevel };
      const th = rules.towerHp || { princess: 1, king: 1 };
      const stats = towerStats(t.towerLevel, t.kingLevel, { tower: (t.towerMult || 1) * th.princess, king: (t.kingMult || 1) * th.king * (rules.vault ? rules.vault.hp : 1) });
      if (!rules.kingOnly) {
        state.towers.push(makeTower(side, 'princess', 0, stats));
        state.towers.push(makeTower(side, 'princess', 1, stats));
      }
      const king = makeTower(side, 'king', -1, stats);
      // Heist: the King Tower is the vault, awake from the start; it only shoots if the rules say so
      if (rules.kingOnly) king.active = true;
      if (rules.vault && !rules.vault.shoots) king.dmg = 0;
      state.towers.push(king);
    });
    if (rules.hill) state.hill = { idx: 0, pts: { A: 0, B: 0 }, holder: null, movedAt: 0 };
    if (rules.boss) state.boss = { id: null, spawned: false, summons: 0, enraged: false };
    if (rules.upgrades) state.chaos = freshChaos();
    if (hasObjective(rules)) state.obj = freshObjectives(rules);
    // Preset defences (Inferno Siege): permanent buildings placed before the start
    rules.defenses.forEach((d) => {
      const st = getCardStatsAtLevel(d.card, d.level, false, 0);
      const u = spawnUnit(state, d.side, st, d.x, d.y, 0, 0);
      u.lifetime = 0;
    });
    if (rules.defenses.length) rebuildObstacles(state);
    state.towers.forEach((t) => state.byId.set(t.id, t));
    rebuildObstacles(state);
    buildHash(state);
    return state;
  }

  // Size Roulette: roll the form of a card as it comes into hand
  function rollSize(state, p, cardId) {
    const sr = state.rules.sizeRoll;
    if (!sr) return;
    const c = p.cards[cardId];
    if (!c || c.spell || c.building) { delete p.size[cardId]; return; }
    const r = nextRandom(state);
    if (r < sr.tiny) p.size[cardId] = 'tiny';
    else if (r < sr.tiny + sr.mega) p.size[cardId] = 'mega';
    else delete p.size[cardId];
  }

  /** What a card costs this player right now (event card mods, Size Roulette and active modifiers included). */
  function playCost(state, side, cardId) {
    const p = state.players[side];
    const c = p && p.cards[cardId];
    if (!c) return Infinity;
    let cost = c.cost;
    const form = p.size[cardId];
    if (form) cost += SIZE_FORMS[form].cost;
    const fx = state.modFx;
    cost += fx.cost;
    if (c.cost >= 5) cost += fx.costHeavy;
    return clamp(cost, 1, 10);
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
    if (!behindLine(state.rules.deployDepth, side, y)) return false;
    // Tunnelling troops can surface anywhere that isn't river or a tower/building
    if (!(card && card.anywhere) && !inDeployZone(state, side, x, y, card)) return false;
    return walkablePoint(state.nav, x, y, false);
  }

  // Same rules as canDeploy, checked against a snapshot. Online clients use this for the
  // placement preview; the server still makes the final call.
  // Special arenas can keep deployments a set distance back from the river
  function behindLine(depth, side, y) {
    if (!(depth > 0)) return true;
    return side === 'A' ? y >= RIVER.y1 + depth : y <= RIVER.y0 - depth;
  }

  function canDeployOnSnapshot(snap, side, x, y, card) {
    if (!snap || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (x < 0.5 || x > W - 0.5 || y < 0.5 || y > H - 0.5) return false;
    if (card && card.spell) return true;
    if (!behindLine(snap.deployDepth, side, y)) return false;
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
      windupTarget: null,
      lastAtkT: -9,
      hitT: -9,
      lastAttackerId: null,
      path: null,
      pathT: 0,
      pathTargetId: null,
      pathNav: -1,
      stuckT: 0,
      bridge: -1,          // bridge its current route crosses (route stickiness, see findPath)
      runDist: 0,
      charging: false,
      jumping: false,
      stunT: 0,
      // Mechanics and status effects (see the Mechanics section)
      mech: stats.mech || null,
      evo: stats.evo ? stats.evoSlug : null,     // evolved form (slug of its Evolution)
      em: unitEvoMech(stats),                    // Evolution and/or C.H.A.O.S. upgrade mechanics
      upg: stats.upg || null,                    // C.H.A.O.S. upgrade id
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
      baseRange: stats.range,
      form: null,
      boss: !!(stats.mech && stats.mech.boss),
    };
    // Modifiers that apply to troops as they land (Eagle Eye range, Aegis shields)
    if (u.kind === 'troop') applyModToUnit(state, u, true);
    state.units.push(u);
    state.byId.set(u.id, u);
    hashInsert(state, u);
    return u;
  }

  // Derived stats that depend on active modifiers, always recomputed from the unit's base values
  function applyModToUnit(state, u, landing) {
    const fx = state.modFx;
    u.range = u.baseRange + (u.kind === 'troop' && u.baseRange >= 3 ? fx.rangeAdd : 0);
    if (landing && fx.shieldPct > 0) giveShield(u, fx.shieldPct);
  }

  function giveShield(u, pct) {
    const amount = Math.round(u.hpMax * pct);
    if (amount <= (u.shield || 0)) return;
    u.shield = amount;
    u.shieldMax = Math.max(u.shieldMax || 0, amount);
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
    if (idx < 0 || p.queue.length === 0) return null;
    p.hand[idx] = p.queue.shift();
    p.queue.push(cardId);
    return p.hand[idx];
  }

  // Cycle a played card out of the hand; the card that comes in gets its own Size Roulette roll
  function cycleCard(state, p, cardId) {
    delete p.size[cardId];
    if (state.rules.gambit) {
      // Princess Gambit: a played card is gone for this match; the next one in the pile comes in.
      // Only when the pile runs dry does the discard go back in (same order).
      const idx = p.hand.indexOf(cardId);
      if (idx < 0) return;
      p.discard = p.discard || [];
      p.discard.push(cardId);
      if (!p.queue.length) { p.queue = p.discard; p.discard = []; }
      p.hand[idx] = p.queue.shift();
      return;
    }
    const incoming = cycleHand(p, cardId);
    if (incoming) rollSize(state, p, incoming);
  }

  // Stats for a Size Roulette form ('tiny' / 'mega') or a Growth Spurt troop ('grown')
  function sizedStats(stats, form) {
    const f = form === 'grown' ? { hp: 1.4, dmg: 1.15, speed: 0.9, radius: 1.15 } : SIZE_FORMS[form];
    if (!f) return stats;
    return {
      ...stats,
      hpScaled: Math.round(stats.hpScaled * f.hp),
      dmgScaled: +(stats.dmgScaled * f.dmg).toFixed(2),
      speed: r2(stats.speed * f.speed),
      radius: r2(clamp(stats.radius * f.radius, 0.25, 1.3)),
    };
  }

  /** Play a card. Returns { ok: true, units } or { ok: false, reason }. */
  function deploy(state, side, cardId, x, y) {
    if (!state.running) return { ok: false, reason: 'Match is over' };
    if (choicePaused(state)) return { ok: false, reason: 'Choosing upgrades' };
    const p = state.players[side];
    const stats = p && p.cards[cardId];
    if (!stats) return { ok: false, reason: 'Unknown card' };
    const lim = state.rules.playLimit && state.rules.playLimit[side];
    if (lim > 0 && p.cardsPlayed >= lim) return { ok: false, reason: 'No plays left' };
    if (state.rules.unitCap > 0 && !stats.spell) {
      let n = 0;
      for (const u of state.units) if (u.owner === side && u.hp > 0 && u.costShare > 0) n++;
      if (n + (stats.swarmCount || 1) > state.rules.unitCap) return { ok: false, reason: `Unit limit (${state.rules.unitCap}) reached` };
    }
    if (!p.hand.includes(cardId)) return { ok: false, reason: 'Card not in hand' };
    const cost = playCost(state, side, cardId);
    if (p.elixir < cost) return { ok: false, reason: 'Not enough elixir' };
    if ((p.cooldowns[cardId] || 0) > state.time) return { ok: false, reason: 'Card is recharging' };
    const px = Number(x);
    const py = Number(y);
    if (!canDeploy(state, side, px, py, stats)) return { ok: false, reason: "Can't deploy there" };

    p.elixir = Math.max(0, p.elixir - cost);
    p.cooldowns[cardId] = state.time + stats.deployCdScaled;
    p.cardsPlayed += 1;
    state.playLog.push({ n: ++state.playSeq, owner: side, cardId, at: state.time, swap: state.swapNo });
    if (state.playLog.length > 40) state.playLog.shift();
    const form = p.size[cardId] || null;

    // Evolution cycle: only a play that passed every check above counts. A charged card comes
    // out evolved and starts charging again; otherwise this play adds one charge.
    const cycle = p.evo[cardId];
    let evolved = false;
    if (cycle) {
      if (cycle.charge >= cycle.need) { evolved = true; cycle.charge = 0; p.evoPlayed += 1; }
      else cycle.charge = Math.min(cycle.need, cycle.charge + 1 + state.modFx.evoCharge);
    }
    let play = evolved ? evolvedStats(stats) : stats;
    if (form) play = sizedStats(play, form);
    else if (state.modFx.grow && !stats.spell && !stats.building) play = sizedStats(play, 'grown');
    if (evolved) pushFx(state, { type: 'evolve', x: px, y: py, owner: side, cardId, name: play.evo.name });

    if (stats.spell) {
      castSpell(state, side, play, px, py);
      state.castLog.push({ seq: state.nextId++, owner: side, cost, cardId });
      if (state.castLog.length > 24) state.castLog.shift();
      cycleCard(state, p, cardId);
      pushFx(state, { type: 'cast', x: px, y: py, owner: side, r: play.splash, cardId, cost, evo: evolved ? 1 : 0 });
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
      units.push(spawnUnit(state, side, play, clamp(sx, 0.4, W - 0.4), clamp(sy, 0.4, H - 0.4), MATCH.deployTime + tunnel + i * 0.05, cost / count));
    }
    if (form) units.forEach((u) => { u.form = form; });
    // Swarm members of one play know each other (for pack mechanics like Scrap Rally)
    if (count > 1) units.forEach((u) => { u.pack = units[0].id; });
    if (stats.building) rebuildObstacles(state);
    cycleCard(state, p, cardId);
    pushFx(state, { type: 'deploy', x: px, y: py, owner: side, r: count > 1 ? 1.4 : 1, cardId, cost, evo: evolved ? 1 : 0, form: form || undefined });
    return { ok: true, units, evolved };
  }

  // ─── Spells ──────────────────────────────────────────────────────────────

  function spellSpec(stats) {
    return { kind: stats.proj, towerMult: stats.towerMult, knockback: stats.knockback, stun: stats.stun, freeze: stats.freeze, cost: stats.cost };
  }

  function castSpell(state, side, statsIn, x, y) {
    let stats = statsIn;
    if (state.modFx.spellRadius !== 1) stats = { ...stats, splash: r2(stats.splash * state.modFx.spellRadius) };
    const echo = state.rules.spellEcho;
    const evoSpell = spellEvoFx(stats);
    if (stats.zone) {
      const z = addZone(state, side, stats, x, y);
      if (echo > 0) echoZoneSpell(state, z, echo);
      if (evoSpell && evoSpell.zoneEcho) echoZoneSpell(state, z, evoSpell.zoneEcho); // C.H.A.O.S. Double Roll
      return;
    }
    const spec = spellSpec(stats);
    const king = state.towers.find((t) => t.owner === side && t.tower === 'king');
    const fromX = king ? king.x : x;
    const fromY = king ? king.y : y;
    if (echo > 0) {
      // Spellstorm: the spell rings out again at the same spot just after it lands
      const flight = stats.instant || stats.proj === 'shock' ? 0 : dist(fromX, fromY, x, y) / (PROJ_SPEED[stats.proj] || 15) + ((stats.waves || 1) - 1) * 0.22;
      makeZone(state, { kind: 'echo', owner: side, cardId: stats.id, x, y, r: stats.splash, delay: flight + 0.9, total: stats.dmgScaled * echo,
        spec: { kind: stats.proj, towerMult: stats.towerMult, knockback: stats.knockback * 0.5, stun: stats.stun, freeze: stats.freeze * 0.5, cost: 0 } });
    }
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

  // Spellstorm echo for lingering spells: areas last longer (same strength per second), and
  // one-shot zones (laser, boulder) strike a second time; troop drops bring a couple more.
  function echoZoneSpell(state, z, echo) {
    if (['dot', 'slow', 'haste', 'heal', 'pull'].includes(z.kind)) {
      z.dur *= 1 + echo;
      z.total *= 1 + echo;
    } else if (z.kind === 'laser' || z.kind === 'roll') {
      const again = { ...z, id: `z${state.nextId++}`, total: z.total * echo, delay: (z.delay || 0) + 1, age: 0, hit: z.hit ? new Set() : null, travelled: 0 };
      state.zones.push(again);
    } else if (z.kind === 'spawn') {
      z.count += 1; // one extra trooper
    }
  }

  // Stun (or freeze) a troop, building or tower. Interrupts wind-ups, charges, dashes and ramp-ups.
  function stunEntity(e, dur0, freeze) {
    if (!e || e.hp <= 0 || !(dur0 > 0)) return;
    const dur = e.boss ? dur0 * 0.5 : dur0; // bosses shrug off half of every stun and freeze
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
    const src = { id: null, owner, structureMult: 1, spell: !spec.hazard };
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
    if (e.boss) return; // bosses can't be shoved around
    let dx = e.x - fromX;
    let dy = e.y - fromY;
    const d = Math.hypot(dx, dy);
    if (d < 1e-3) { dx = 0; dy = e.owner === 'A' ? 1 : -1; } else { dx /= d; dy /= d; }
    const jump = e.special.includes('jump');
    for (const k of [1, 0.5, 0.25]) {
      const nx = clamp(e.x + dx * amount * k, e.radius, W - e.radius);
      const ny = clamp(e.y + dy * amount * k, e.radius, H - e.radius);
      // The whole shove must stay on open ground, not just where it lands (no hopping obstacles)
      if (e.air || (walkablePoint(state.nav, nx, ny, jump) && lineClear(state.nav, e.x, e.y, nx, ny, jump))) {
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
      if (z.until != null && state.time >= z.until) { z.done = true; continue; }
      if (z.delay > 0) { z.delay -= dt; if (z.delay > 0) continue; }
      if (updateEventZone(state, z, dt)) { z.age += dt; continue; }
      const src = z.source || { id: null, owner: z.owner, structureMult: 1, spell: true };
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
            if (e.kind !== 'troop' || e.invuln || e.boss) return;
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
          // Overload's aftershock / a Spellstorm echo (fires once, after its delay)
          applySpell(state, z.owner, z.spec || { kind: 'shock', towerMult: z.towerMult, knockback: 0, stun: z.stun, freeze: 0, cost: 0, evo: 1 }, z.x, z.y, z.r, z.total);
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
    const prevId = u.targetId;
    let why = null;
    let t = u.targetId ? state.byId.get(u.targetId) : null;
    if (t && !canTarget(u, t)) { t = null; why = 'previous target gone'; }
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
        if (t) why = seen ? (seen.mech && seen.mech.taunt ? 'taunted' : 'nearest in sight') : 'marching on tower';
      } else if (candidate && candidate !== t) {
        const tVisible = edgeDist(u, t) <= sight;
        // Hysteresis: only switch to a clearly closer target, or when the current one is out of sight
        if (!tVisible || edgeDist(u, candidate) < edgeDist(u, t) - 0.75) {
          why = !tVisible ? 'old target out of sight' : 'clearly closer target';
          t = candidate;
        }
      }
    }
    u.targetId = t ? t.id : null;
    // Diagnostics only (explainTargeting): why the current target was picked, and since when
    if (u.targetId !== prevId) { u.targetWhy = u.targetId ? why : why || 'nothing to target'; u.targetSince = state.time; }
    return t;
  }

  /**
   * Read-only report of how a unit sees its targets: its current target and why, the ranges it
   * uses, and every enemy it looked at with the reason each was or wasn't eligible. Changes nothing
   * (no random draws), so it is safe to call from a debug overlay or a test at any time.
   */
  function explainTargeting(state, unitId) {
    const u = state.byId.get(unitId);
    if (!u) return null;
    if (u.kind === 'tower') {
      const t = u.targetId ? state.byId.get(u.targetId) : null;
      return { id: u.id, tower: u.tower, active: !!u.active, range: u.range, target: t ? t.id : null, cooldown: r2(Math.max(0, u.atkCd)) };
    }
    const sight = u.building ? u.range : u.sight;
    const candidates = [];
    const ents = state.units.concat(state.towers);
    for (const e of ents) {
      if (e === u || e.owner === u.owner || e.hp <= 0) continue;
      const d = edgeDist(u, e);
      let reject = null;
      if (e.hidden) reject = 'burrowed';
      else if (u.targets === 'none') reject = 'never attacks';
      else if (u.targets === 'air' && !e.air) reject = 'only hits air';
      else if (e.air && u.targets !== 'any' && u.targets !== 'air') reject = "can't hit air";
      else if (u.targets === 'buildings' && e.kind === 'troop') reject = 'only targets buildings';
      else if (u.minRange && dist(u.x, u.y, e.x, e.y) < u.minRange) reject = 'inside minimum range';
      else if (d > sight && !(u.kind === 'troop' && e.mech && e.mech.taunt && d <= e.mech.taunt) && e.kind !== 'tower') reject = 'out of sight';
      candidates.push({ id: e.id, cardId: e.cardId || e.tower, gap: r2(d), inRange: !reject && inAttackRange(u, e), reject });
    }
    candidates.sort((a, b) => (a.reject ? 1 : 0) - (b.reject ? 1 : 0) || a.gap - b.gap);
    const t = u.targetId ? state.byId.get(u.targetId) : null;
    return {
      id: u.id, cardId: u.cardId, targets: u.targets, sight, range: u.range, minRange: u.minRange,
      target: t ? t.id : null, why: u.targetWhy || null, since: u.targetSince != null ? r2(u.targetSince) : null,
      pursuing: t && u.targetSince != null ? r2(state.time - u.targetSince) : 0,
      locked: !!u.locked, retargetIn: r2(Math.max(0, u.retargetT)),
      attack: u.windupT > 0 ? 'winding up' : u.atkCd > 0 ? 'cooling down' : 'ready',
      candidates,
    };
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
    // Timed modifiers (already combined and capped in state.modFx)
    const fx = state.modFx;
    if (fx !== NO_FX) {
      if (source.spell) amt *= fx.spellDmg;
      if (source.kind === 'troop') amt *= source.evo ? fx.dmgOut * fx.evoDmg : fx.dmgOut;
      if (target.kind === 'troop') amt *= fx.dmgIn;
      else if (target.kind === 'building') amt *= fx.buildIn;
    }
    // A boss guarded by its summons takes reduced damage until they fall
    if (target.boss && state.boss && state.boss.guard) amt *= target.mech.boss.guardMult;
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
    afterHit(state, source, target, amt);
    if (target.tower === 'king' && !target.active) wakeKing(state, target);
    // Floating damage numbers: towers, spells and heavy hits
    if (showNumber || target.kind === 'tower' || amt >= 150) {
      pushFx(state, { type: 'dmg', x: target.x, y: target.y - (target.half || target.radius || 0.4), amt: Math.round(amt), owner: source.owner, big: amt >= 150 });
    }
    return amt;
  }

  // Thorns and lifesteal: both act on a hit that landed. A reflected hit is never reflected again.
  function afterHit(state, source, target, amt) {
    const tm = target.mech;
    if (tm && tm.reflect && source.melee && source.kind === 'troop' && !source.reflected) {
      const attacker = state.byId.get(source.id);
      if (attacker && attacker.hp > 0) {
        const back = Math.min(amt * tm.reflect.pct, tm.reflect.cap * (target.lvlScale || 1));
        applyDamage(state, { ...damageSource(target), reflected: true }, attacker, back);
        pushFx(state, { type: 'thorns', x: attacker.x, y: attacker.y, owner: target.owner });
      }
    }
    if (source.lifesteal > 0 && !source.reflected) {
      const healer = state.byId.get(source.id);
      if (healer && healer.hp > 0 && healer.hp < healer.hpMax) {
        healer.hp = Math.min(healer.hpMax, healer.hp + amt * source.lifesteal);
        healer.healedAt = state.time;
      }
    }
  }

  // War Drum: the strongest aura covering this troop (buildings of its own side), 1 when none
  function empowerMult(state, u) {
    if (u.kind !== 'troop') return 1;
    let best = 1;
    for (const b of state.units) {
      const e = b.mech && b.mech.empower;
      if (!e || b.owner !== u.owner || b.hp <= 0 || b.deployT > 0) continue;
      if (dist(b.x, b.y, u.x, u.y) <= e.radius) best = Math.max(best, e.mult);
    }
    return best;
  }

  // Snare Mine: buried until an enemy ground troop comes close, then it goes off once
  function updateTrap(state, u) {
    const tr = u.mech.trap;
    if (u.deployT > 0) return;
    let sprung = false;
    queryHash(state, u.x, u.y, tr.trigger + 1, (e) => {
      if (sprung || e.owner === u.owner || e.kind !== 'troop' || e.air || e.hp <= 0 || e.hidden) return;
      if (dist(u.x, u.y, e.x, e.y) - e.radius <= tr.trigger) sprung = true;
    });
    if (!sprung) return;
    const hit = splashDamage(state, damageSource(u), u.x, u.y, tr.radius, u.dmg, false);
    hit.forEach((e) => { if (e.kind !== 'tower') stunEntity(e, tr.stun, false); });
    pushFx(state, { type: 'splash', x: u.x, y: u.y, r: tr.radius, owner: u.owner });
    pushFx(state, { type: 'trap', x: u.x, y: u.y, r: tr.radius, owner: u.owner });
    u.hidden = false;
    u.hp = 0;
    u.kamikazed = true;
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
    return { id: u.id, owner: u.owner, structureMult: u.structureMult, crownMult: u.crownMult || 1, kind: u.kind, evo: !!u.evo, x: u.x, y: u.y, melee: u.proj === 'melee', lifesteal: (u.mech && u.mech.lifesteal) || 0 };
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
    let dmg = u.dmg * empowerMult(state, u);
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
        hitKnock(state, u.x, u.y, t);
        pushFx(state, { type: 'hit', x: t.x, y: t.y, owner: u.owner, style: 'melee' });
      }
      // Melee shockwave every Nth hit, centred on the target
      if (em && em.shockwave && u.evoHits % em.shockwave.every === 0) shockwave(state, u, t.x, t.y, em.shockwave, 'shockwave');
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

  // How fast a unit's attack timers run right now (slow/haste/rally, timed modifiers, boss rage)
  function attackRate(state, u) {
    const fx = state.modFx;
    const rage = u.boss && state.boss && state.boss.enraged ? u.mech.boss.enrageMult : 1;
    return timeScale(u) * rage * (u.kind === 'troop' ? fx.atk * (u.pack ? fx.swarmAtk : 1) : u.building ? fx.buildAtk : 1);
  }

  // A unit that was alive when this tick began but was killed earlier in the same tick (by a unit
  // that happened to update first) still lands an attack that releases this tick. That makes two
  // units trading blows on the same tick both hit, whatever the update order. Nothing else happens:
  // no movement, no new wind-up, no retargeting.
  function releaseOnDeathTick(state, u, dt) {
    if (!u.live || u.deployT > 0 || u.stunT > 0 || u.dashing || u.targets === 'none') return;
    const t = u.targetId ? state.byId.get(u.targetId) : null;
    if (!t || !canTarget(u, t)) return;
    const k = attackRate(state, u);
    if (u.windupT > 0) {
      if (t.id !== u.windupTarget || edgeDist(u, t) > u.range + 0.5) return;
      if (u.windupT - dt * k <= TIME_EPS) { u.windupT = 0; fireAttack(state, u, t); }
    } else if (u.mech && u.mech.ramp && u.atkCd - dt * k <= TIME_EPS && inAttackRange(u, t)) {
      fireAttack(state, u, t);
    }
  }

  function updateUnit(state, u, dt) {
    u.px = u.x;
    u.py = u.y;
    if (u.hp <= 0) { releaseOnDeathTick(state, u, dt); return; }
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
    // Timed modifiers scale movement and attack speed separately (troops / buildings)
    const fx = state.modFx;
    const rage = u.boss && state.boss && state.boss.enraged ? u.mech.boss.enrageMult : 1;
    const kMove = k * (u.kind === 'troop' ? fx.move : 1) * rage;
    const kAtk = attackRate(state, u);
    const m = u.mech;
    if (u.em) updateEvolvedUnit(state, u, dt);
    if (m) {
      if (m.spawner) updateSpawner(state, u, dt * k);
      if (m.elixir) updateElixirPump(state, u, dt);
      if (m.heal) updateHealer(state, u, dt);
      if (m.taunt) updateTaunt(state, u, dt);
      if (m.trap) updateTrap(state, u);
      if (m.boss) updateBoss(state, u, dt);
    }
    if (u.targets === 'none') return; // spawners, pumps and decoys never attack

    u.atkCd -= dt * kAtk;
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
      // A wind-up belongs to the target it started on. If that target dies, becomes untargetable,
      // is swapped for another, or gets clear away, the swing is called off before it lands and the
      // attack timer is handed back (nothing was released). A stun still costs the attack.
      if (!t || t.id !== u.windupTarget || edgeDist(u, t) > u.range + 0.5) {
        u.windupT = 0;
        u.windupTarget = null;
        u.atkCd = Math.min(u.atkCd, 0);
        return;
      }
      u.windupT -= dt * kAtk;
      faceToward(u, t.x, t.y, dt);
      if (u.windupT <= TIME_EPS) { u.windupT = 0; u.windupTarget = null; fireAttack(state, u, t); }
      return;
    }

    if (t && inAttackRange(u, t)) {
      u.vx = 0;
      u.vy = 0;
      u.stuckT = 0;
      faceToward(u, t.x, t.y, dt);
      if (m && m.ramp) u.rampT += dt * kAtk;
      if (u.atkCd <= TIME_EPS) {
        u.locked = true;
        u.atkCd = u.cd;
        const w = windupOf(u);
        if (w > 0) { u.windupT = w; u.windupTarget = t.id; } else fireAttack(state, u, t);
      }
      return;
    }
    if (m && m.ramp) u.rampT = 0;
    if (m && m.dash && t && startDash(state, u, t)) return;

    if (!u.building && t) moveToward(state, u, t, dt, kMove);
    else if (!t && !u.building && state.obj) walkToObjective(state, u, dt, kMove);
    else if (!t && !u.building && state.rules.guard) holdGuardLine(state, u, dt, kMove);
  }

  // With no enemy towers to march on (survival, boss battles), troops hold a line in front of
  // their own bridge in their lane instead of standing wherever they landed.
  function holdGuardLine(state, u, dt, rate) {
    const lane = u.x < MID_X ? 0 : 1;
    const gx = BRIDGES[lane].cx + (u.x < BRIDGES[lane].cx ? -0.6 : 0.6);
    const gy = u.owner === 'A' ? RIVER.y1 + 2.2 : RIVER.y0 - 2.2;
    if (dist(u.x, u.y, gx, gy) < 1.2) { u.vx = 0; u.vy = 0; return; }
    moveToward(state, u, { id: `guard-${lane}-${u.owner}`, kind: 'point', x: gx, y: gy, radius: 0.2, hp: 1 }, dt, rate);
  }

  // Pinball rules: a single-target hit pushes a ground troop away from whoever hit it
  function hitKnock(state, fromX, fromY, t) {
    const k = Math.max(state.rules.knockOnHit, state.modFx.knock);
    if (!(k > 0) || t.kind !== 'troop' || t.air || t.hp <= 0 || t.invuln || t.boss) return;
    knockBack(state, t, fromX, fromY, k);
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
    p.elixir = clamp(p.elixir + amount, 0, state.rules.maxElixir);
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
          const fresh = u.bridge >= 0 && state.time - (u.bridgeSince || 0) < BRIDGE_HOLD;
          u.path = findPath(state, u.x, u.y, t, u.range, u.radius, jump, u.bridge, fresh);
          // Remember the bridge while still on the far side of it; once across, forget it
          const nb = u.path ? u.path.bridge : u.bridge;
          if (u.path && nb !== u.bridge) { u.bridge = nb; u.bridgeSince = state.time; }
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
        let nx;
        let ny;
        let overlap;
        if (o.kind === 'tower') {
          // Towers are squares (the same footprint the nav grid and attack range use), not circles:
          // push out from the nearest point of the square
          const cx = clamp(u.x, o.x - o.half, o.x + o.half);
          const cy = clamp(u.y, o.y - o.half, o.y + o.half);
          let dx = u.x - cx;
          let dy = u.y - cy;
          const d = Math.hypot(dx, dy);
          if (d >= u.radius) return;
          if (d < 1e-6) {
            // Centre inside the square: leave by the nearest edge
            const ex = o.half - Math.abs(u.x - o.x);
            const ey = o.half - Math.abs(u.y - o.y);
            if (ex < ey) { dx = u.x >= o.x ? 1 : -1; dy = 0; overlap = ex + u.radius; } else { dx = 0; dy = u.y >= o.y ? 1 : -1; overlap = ey + u.radius; }
            nx = dx; ny = dy;
          } else {
            nx = dx / d; ny = dy / d;
            overlap = u.radius - d;
          }
        } else {
          let dx = u.x - o.x;
          let dy = u.y - o.y;
          let d = Math.hypot(dx, dy);
          const min = u.radius + o.radius;
          if (d >= min) return;
          if (d < 1e-4) { const a = nextRandom(state) * Math.PI * 2; dx = Math.cos(a); dy = Math.sin(a); d = 1; }
          nx = dx / d;
          ny = dy / d;
          overlap = min - Math.max(d, 1e-4);
        }
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
    // Towers update after troops, so one destroyed earlier this tick still takes the shot that was
    // due this tick (the same simultaneous-hit rule troops follow)
    if (t.hp <= 0 && !t.live) return;
    if (t.frozenT > 0) t.frozenT -= dt;
    if (t.stunT > 0) { t.stunT -= dt; return; }
    t.atkCd -= dt * state.modFx.towerAtk;
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
    if (target && t.atkCd <= TIME_EPS) {
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
        hitKnock(state, p.sx, p.sy, t);
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

  // ─── Event runtime ───────────────────────────────────────────────────────
  //
  // Everything below only does something when the match's rules ask for it, so a normal battle
  // runs exactly as before. All timing uses the match clock (state.time), never the wall clock.

  function anyEvo(state) {
    return Object.keys(state.players.A.evo).length + Object.keys(state.players.B.evo).length > 0;
  }

  // Switch timed modifiers on and off, then recombine their effects
  function updateModifiers(state) {
    const plan = state.rules.modifiers;
    if (!plan.length) return;
    const M = state.mods;
    let changed = false;
    for (let i = M.active.length - 1; i >= 0; i--) {
      if (state.time >= M.active[i].end) { endModifier(state, M.active[i]); M.active.splice(i, 1); changed = true; }
    }
    while (M.next < plan.length && plan[M.next].at <= state.time) {
      if (startModifier(state, plan[M.next++])) changed = true;
    }
    if (changed) {
      state.modFx = combineModFx(M.active.map((a) => a.id));
      for (const u of state.units) if (u.kind === 'troop') applyModToUnit(state, u, false);
    }
  }

  function startModifier(state, m) {
    const def = MODIFIERS[m.id];
    const M = state.mods;
    // The same modifier again only refreshes its timer: it never stacks with itself
    const same = M.active.find((a) => a.id === m.id);
    if (same) {
      same.end = Math.max(same.end, state.time + m.dur);
      state.zones.forEach((z) => { if (z.modKey === same.key) z.until = same.end; });
      return false;
    }
    // Safety nets (the schedule builder already avoids these): one per group, and requirements
    if (def.group && M.active.some((a) => MODIFIERS[a.id].group === def.group)) return false;
    if (def.needs === 'evo' && !anyEvo(state)) return false;
    const a = { id: m.id, key: `m${state.nextId++}`, start: state.time, end: state.time + m.dur };
    M.active.push(a);
    if (def.start && def.start.elixir) {
      ['A', 'B'].forEach((side) => {
        const king = state.towers.find((t) => t.owner === side && t.tower === 'king');
        giveElixir(state, side, def.start.elixir, king ? king.x : MID_X, king ? king.y : (side === 'A' ? H - 2 : 2));
      });
    }
    if (def.start && def.start.shield) state.units.forEach((u) => { if (u.kind === 'troop' && u.hp > 0) giveShield(u, def.start.shield); });
    (def.zones || []).forEach((zd) => placeModZone(state, a, zd));
    pushFx(state, { type: 'modOn', id: m.id, dur: m.dur });
    return true;
  }

  function endModifier(state, a) {
    state.zones.forEach((z) => { if (z.modKey === a.key) z.done = true; });
    pushFx(state, { type: 'modOff', id: a.id });
  }

  // Modifier areas belong to nobody (owner 'X'), so they affect both sides; `mirror` adds the
  // point-reflected copy so each side gets exactly the same layout.
  function placeModZone(state, a, zd) {
    const add = (x, y) => makeZone(state, {
      kind: zd.kind, owner: 'X', modKey: a.key, modId: a.id, x, y, r: zd.r, mult: zd.mult || 1, perSec: zd.perSec || 0,
      every: zd.every || 0, hitR: zd.hitR || 0, dmg: zd.dmg || 0, hitDelay: zd.delay || 0, vx: zd.speed || 0,
      until: a.end, born: state.time, tickT: zd.every ? 1 : 0,
    });
    add(zd.x, zd.y);
    if (zd.mirror) add(W - zd.x, H - zd.y);
  }

  // Chaos areas, boss slams and meteors (called from updateZones). Returns true if it handled z.
  function updateEventZone(state, z, dt) {
    switch (z.kind) {
      case 'cHaste':
        eachInZone(state, z, false, (e) => setHaste(e, z.mult, 0.25));
        return true;
      case 'cSlow':
        eachInZone(state, z, false, (e) => setSlow(e, z.mult, 0.25));
        return true;
      case 'cHeal':
        z.tickT -= dt;
        if (z.tickT <= 0) {
          z.tickT += 0.5;
          eachInZone(state, z, false, (e) => { if (e.kind === 'troop' && healEntity(state, e, z.perSec * 0.5) > 0) e.healedAt = state.time; });
        }
        return true;
      case 'storm': {
        z.x += z.vx * dt;
        if (z.x > W - 2.5) { z.x = W - 2.5; z.vx = -Math.abs(z.vx); }
        if (z.x < 2.5) { z.x = 2.5; z.vx = Math.abs(z.vx); }
        z.tickT -= dt;
        if (z.tickT <= 0) {
          z.tickT += 0.5;
          const src = { id: null, owner: 'X', structureMult: 1 };
          eachInZone(state, z, false, (e) => { if (e.kind !== 'tower' && !e.hidden) applyDamage(state, src, e, z.perSec * 0.5); });
        }
        return true;
      }
      case 'meteorField':
        // Every few seconds: a telegraphed impact on each side, at mirrored spots
        z.tickT -= dt;
        if (z.tickT <= 0) {
          z.tickT += z.every;
          const x = 2 + nextRandom(state) * (W - 4);
          const y = RIVER.y1 + 1.5 + nextRandom(state) * (H - RIVER.y1 - 5);
          [[x, y], [W - x, H - y]].forEach(([px, py]) => {
            makeZone(state, { kind: 'impact', owner: 'X', x: px, y: py, r: z.hitR, delay: z.hitDelay, total: z.dmg, warnDur: z.hitDelay });
          });
        }
        return true;
      case 'impact':
      case 'slam':
        // Lands once its warning has run out (the delay is handled by updateZones)
        applySpell(state, z.owner, { kind: z.kind === 'slam' ? 'slam' : 'meteor', towerMult: z.kind === 'slam' ? 0.25 : 0, knockback: z.kind === 'slam' ? 1.0 : 0.6, stun: 0, freeze: 0, cost: 0, hazard: true }, z.x, z.y, z.r, z.total);
        z.done = true;
        return true;
      default:
        return false;
    }
  }

  // King of the Hill: whoever has more troop strength on the hill fills their meter; a full
  // meter is worth a crown. The hill hops between spots on a fixed timetable.
  function updateHill(state, dt) {
    const cfg = state.rules.hill;
    const hs = state.hill;
    if (!cfg || !hs || !state.running) return;
    const idx = Math.floor(state.time / cfg.every) % cfg.spots.length;
    if (idx !== hs.idx) {
      hs.idx = idx;
      pushFx(state, { type: 'hillMove', x: cfg.spots[idx].x, y: cfg.spots[idx].y });
    }
    const spot = cfg.spots[hs.idx];
    const power = { A: 0, B: 0 };
    for (const e of state.units) {
      if (e.kind !== 'troop' || e.hp <= 0 || e.deployT > 0 || !(e.owner in power)) continue;
      if (dist(e.x, e.y, spot.x, spot.y) > cfg.r + e.radius * 0.5) continue;
      power[e.owner] += Math.max(0.35, e.costShare || 0) * (0.4 + 0.6 * e.hp / e.hpMax);
    }
    hs.power = power;
    const lead = power.A > power.B ? 'A' : power.B > power.A ? 'B' : null;
    hs.holder = lead;
    if (!lead) return;
    // Contested hills fill slower: the bigger the edge, the faster the meter
    const share = clamp((power[lead] - power[enemyOf(lead)]) / power[lead], 0.25, 1);
    hs.pts[lead] += cfg.rate * share * dt;
    if (hs.pts[lead] >= cfg.points) {
      hs.pts[lead] = 0;
      const pl = state.players[lead];
      pl.crowns = Math.min(3, pl.crowns + 1);
      pl.hillCrowns = (pl.hillCrowns || 0) + 1;
      pushFx(state, { type: 'hillCrown', owner: lead, x: spot.x, y: spot.y });
      pushFx(state, { type: 'crown', owner: lead, crowns: pl.crowns, hill: 1 });
    }
  }

  // Survival: scripted attackers for side B arrive on a timetable, behind their bridges
  function updateWaves(state) {
    const waves = state.rules.waves;
    if (!waves) return;
    while (state.waveNo < waves.length && waves[state.waveNo].at <= state.time) {
      const w = waves[state.waveNo++];
      w.units.forEach((g, gi) => {
        const stats = getCardStatsAtLevel(g.card, g.level, false, 0);
        if (!stats || stats.spell || stats.building) return;
        const count = (stats.swarmCount || 1) * g.n;
        const bx = BRIDGES[g.lane].cx;
        const by = RIVER.y0 - 3 - (gi % 3) * 0.9;
        for (let i = 0; i < count; i++) {
          const spot = spawnSpot(state, bx, by, stats.air, 0.6 + count * 0.12, i * 2 + gi);
          if (!spot) continue;
          spawnUnit(state, 'B', stats, spot.x, spot.y, 0.8 + i * 0.05, stats.cost / (stats.swarmCount || 1));
        }
      });
      pushFx(state, { type: 'wave', n: state.waveNo, total: waves.length });
    }
  }

  function updateBossSpawn(state) {
    const b = state.rules.boss;
    const bs = state.boss;
    if (!b || !bs || bs.spawned || state.time < b.at) return;
    bs.spawned = true;
    const x = BRIDGES[b.lane].cx;
    const y = RIVER.y0 - 3.5;
    const u = spawnToken(state, 'B', b.card, x, y, b.level, 1.5);
    if (!u) return;
    u.costShare = 10; // the AI's threat estimates should treat it as a huge push
    bs.id = u.id;
    pushFx(state, { type: 'bossSpawn', x, y, owner: 'B', cardId: b.card });
  }

  // ─── Bosses ──────────────────────────────────────────────────────────────
  //
  // Iron Colossus: telegraphed ground slams aimed at the biggest cluster of your troops and
  // buildings (1.6 s warning circle), summons guards at 70% and 40% HP (it takes half damage while
  // any are alive), and enrages under 35% HP (faster everything, slams more often). It can't be
  // knocked back or pulled, and stuns and freezes last half as long on it.
  // Phases are checked every step, even while the boss is stunned or frozen
  function updateBossPhases(state) {
    const bs = state.boss;
    if (!bs || !bs.id) return;
    const u = state.byId.get(bs.id);
    if (!u || u.hp <= 0) { bs.guard = false; return; }
    const cfg = u.mech.boss;
    const frac = u.hp / u.hpMax;
    const marks = cfg.summonAt.concat(state.rules.boss && state.rules.boss.extraSummon ? [0.2] : []);
    while (bs.summons < marks.length && frac <= marks[bs.summons]) {
      bs.summons++;
      for (let i = 0; i < cfg.summon.count; i++) {
        const spot = spawnSpot(state, u.x, u.y, false, 1.6, i * 3 + bs.summons);
        if (!spot) continue;
        const m = spawnToken(state, u.owner, cfg.summon.card, spot.x, spot.y, u.level, 0.6);
        if (m) { m.bossMinion = true; m.costShare = 1; }
      }
      pushFx(state, { type: 'bossSummon', x: u.x, y: u.y, owner: u.owner });
    }
    bs.guard = state.units.some((o) => o.bossMinion && o.hp > 0);
    if (!bs.enraged && frac <= cfg.enrageBelow) {
      bs.enraged = true;
      pushFx(state, { type: 'bossEnrage', x: u.x, y: u.y, owner: u.owner });
    }
  }

  // The slam (only while the boss is up and acting)
  function updateBoss(state, u, dt) {
    const cfg = u.mech.boss;
    const bs = state.boss;
    if (!bs) return;
    if (u.slamT == null) u.slamT = cfg.slamEvery * 0.6;
    u.slamT -= dt;
    if (u.slamT > 0) return;
    const pt = slamPoint(state, u);
    if (!pt) { u.slamT = 0.5; return; }
    u.slamT = bs.enraged ? cfg.slamEnraged : cfg.slamEvery;
    makeZone(state, { kind: 'slam', owner: u.owner, x: pt.x, y: pt.y, r: cfg.slamRadius, delay: cfg.slamDelay, warnDur: cfg.slamDelay, total: cfg.slamDmg * u.lvlScale });
    pushFx(state, { type: 'bossSlam', x: pt.x, y: pt.y, owner: u.owner, r: cfg.slamRadius });
  }

  // Where the boss slams: the densest group of enemy troops/buildings near it, else a tower in reach
  function slamPoint(state, u) {
    let best = null;
    let bestScore = 0;
    for (const e of state.units) {
      if (e.owner === u.owner || e.hp <= 0 || e.air || e.hidden || dist(u.x, u.y, e.x, e.y) > 6) continue;
      let score = 0;
      for (const o of state.units) {
        if (o.owner === u.owner || o.hp <= 0 || o.air || o.hidden) continue;
        if (dist(e.x, e.y, o.x, o.y) <= 2.2) score += 0.5 + (o.costShare || 0);
      }
      if (score > bestScore) { bestScore = score; best = { x: e.x, y: e.y }; }
    }
    if (best) return best;
    for (const t of state.towers) {
      if (t.owner === u.owner || t.hp <= 0 || boxDist(u.x, u.y, t) > 4) continue;
      return { x: clamp(u.x, t.x - t.half, t.x + t.half), y: clamp(u.y, t.y - t.half, t.y + t.half) };
    }
    return null;
  }

  // Deck Roulette: both hands are replaced by new decks at fixed times
  function updateDeckSwaps(state) {
    const swaps = state.rules.deckSwaps;
    while (state.swapNo < swaps.length && swaps[state.swapNo].at <= state.time) {
      const sw = swaps[state.swapNo++];
      ['A', 'B'].forEach((side) => {
        const p = state.players[side];
        const ids = Object.keys(p.cards);
        const avg = ids.length ? Math.round(ids.reduce((n, id) => n + (p.cards[id].level || 1), 0) / ids.length) : 1;
        const lvl = state.rules.deckLevel || avg;
        loadDeck(p, sw[side].map((id) => ({ id, level: lvl })), { ...state.rules, evo: { ...state.rules.evo, disabled: true } });
        p.hand.forEach((id) => rollSize(state, p, id));
      });
      pushFx(state, { type: 'deckSwap', n: state.swapNo });
    }
  }

  // Scavenger refunds, Death Rattle bursts, kill counts and the boss's defeat
  function onUnitKilled(state, u) {
    const foe = enemyOf(u.owner);
    const killer = state.players[foe];
    if (u.kind === 'troop' && killer) killer.kills += 1;
    if (u.boss && state.boss) state.boss.dead = true;
    const refund = Math.max(state.rules.killRefund, state.modFx.refund);
    // Only real kills pay: not kamikazes, not tokens (no elixir value), not troops nobody touched
    if (refund > 0 && killer && u.kind === 'troop' && u.costShare > 0 && !u.kamikazed && state.time - u.hitT < 1) {
      const amt = Math.min(2, Math.round(u.costShare * refund * 10) / 10);
      if (amt > 0) giveElixir(state, foe, amt, u.x, u.y);
    }
    const burst = state.modFx.deathBurst;
    if (burst > 0 && u.kind === 'troop' && !u.kamikazed) {
      const dmg = Math.min(150, u.hpMax * burst);
      const src = { id: null, owner: u.owner, structureMult: 1 };
      queryHash(state, u.x, u.y, 1.5, (e) => {
        if (e.hp <= 0 || e.owner === u.owner || e.kind === 'tower' || e.hidden) return;
        if (dist(u.x, u.y, e.x, e.y) - e.radius <= 1.5) applyDamage(state, src, e, dmg);
      });
      pushFx(state, { type: 'splash', x: u.x, y: u.y, r: 1.5, owner: u.owner, rattle: 1 });
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
        onUnitKilled(state, u);
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

    const kingsDown = [];
    for (const t of state.towers) {
      if (t.hp > 0 || t.destroyed) continue;
      t.hp = 0;
      t.destroyed = true;
      t.targetId = null;
      navDirty = true;
      const foe = enemyOf(t.owner);
      pushFx(state, { type: 'tower', x: t.x, y: t.y, owner: t.owner, king: t.tower === 'king' });
      if (t.tower === 'king') {
        state.players[foe].crowns = 3;
        kingsDown.push(foe);
      } else {
        state.players[foe].crowns += 1;
        const king = state.towers.find((k) => k.owner === t.owner && k.tower === 'king');
        if (king && king.hp > 0) wakeKing(state, king);
      }
      pushFx(state, { type: 'crown', owner: foe, crowns: state.players[foe].crowns });
    }
    // Both kings falling on the same tick is a draw, not a win for whichever tower is listed first
    if (kingsDown.length === 1) endMatch(state, kingsDown[0], 'king');
    else if (kingsDown.length > 1) endMatch(state, 'draw', 'king');
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

  function tiebreak(state) {
    // Whoever's weakest tower has more health left wins
    const la = lowestTowerFraction(state, 'A');
    const lb = lowestTowerFraction(state, 'B');
    if (Math.abs(la - lb) < 0.001) endMatch(state, 'draw', 'tiebreak');
    else endMatch(state, la > lb ? 'A' : 'B', 'tiebreak');
  }

  function updateClock(state) {
    if (!state.running) return;
    const r = state.rules;
    const a = state.players.A.crowns;
    const b = state.players.B.crowns;
    // Crown races (sudden death = 1 crown, King of the Hill = 3): the first to reach it wins
    if (r.crownsToWin > 0 && Math.max(a, b) >= r.crownsToWin && a !== b) {
      endMatch(state, a > b ? 'A' : 'B', r.crownsToWin === 1 ? 'firstCrown' : 'crownRace');
      return;
    }
    if (r.waves && state.waveNo >= r.waves.length && !state.units.some((u) => u.owner === 'B' && u.hp > 0)) {
      endMatch(state, 'A', 'survived');
      return;
    }
    if (state.boss && state.boss.dead) { endMatch(state, 'A', 'boss'); return; }
    // Score modes: the first to the target wins on the spot
    if (r.scoreToWin > 0) {
      const sa = Math.floor(state.players.A.score || 0);
      const sb = Math.floor(state.players.B.score || 0);
      if (Math.max(sa, sb) >= r.scoreToWin && sa !== sb) { endMatch(state, sa > sb ? 'A' : 'B', 'score'); return; }
    }
    // Play limits (Inferno Siege): out of plays with nothing left fighting is a loss
    if (r.playLimit) {
      for (const side of ['A', 'B']) {
        const lim = r.playLimit[side];
        if (lim > 0 && state.players[side].cardsPlayed >= lim && !state.units.some((u) => u.owner === side && u.hp > 0 && !u.building) && !state.zones.some((z) => z.owner === side)) {
          endMatch(state, enemyOf(side), 'outOfPlays');
          return;
        }
      }
    }
    // Objective modes are decided by the objective, never by crowns
    if (state.obj) {
      const end = state.phase === 'regular' ? r.regulation : r.regulation + r.overtime;
      if (state.time >= end) {
        const lead = objectiveLeader(state);
        if (lead) { endMatch(state, lead, state.phase === 'overtime' ? 'overtimeScore' : 'scoreTime'); return; }
        if (state.phase === 'regular' && r.overtime > 0) { state.phase = 'overtime'; return; }
        endMatch(state, 'draw', 'scoreTime');
        return;
      }
      if (state.phase === 'overtime') {
        const lead = objectiveLeader(state);
        if (lead && !r.payload) { endMatch(state, lead, 'overtimeScore'); return; }
      }
      return;
    }
    if (state.phase === 'regular' && state.time >= r.regulation) {
      // Survival: holding out to the end is a win. Boss: letting the clock run out is a loss.
      if (r.timeout === 'survive') { endMatch(state, 'A', 'survived'); return; }
      if (r.timeout === 'defend') { endMatch(state, 'B', 'timeout'); return; }
      if (a !== b) { endMatch(state, a > b ? 'A' : 'B', 'crowns'); return; }
      if (r.overtime <= 0) { tiebreak(state); return; }
      state.phase = 'overtime';
    }
    if (state.phase === 'overtime') {
      if (a !== b) { endMatch(state, a > b ? 'A' : 'B', 'overtime'); return; }
      if (state.time >= r.regulation + r.overtime) tiebreak(state);
    }
  }

  // Elixir generation multiplier from the clock (the rules' phases or overtime) and timed modifiers
  function phaseMult(state) {
    const r = state.rules;
    if (state.phase === 'overtime') return r.overtimeMult;
    let m = 1;
    for (const ph of r.elixirPhases) if (state.time >= ph.at) m = ph.mult;
    return m;
  }

  function elixirMultiplier(state) {
    return phaseMult(state) * state.modFx.elixir;
  }

  // Elixir per second for one side (Fortress rules add a bonus per living building, up to 3)
  function elixirRate(state, side) {
    let m = elixirMultiplier(state);
    const be = state.rules.buildingElixir;
    if (be > 0) {
      let n = 0;
      for (const u of state.units) if (u.owner === side && u.building && u.hp > 0 && u.deployT <= 0) n++;
      m *= 1 + be * Math.min(3, n);
    }
    return MATCH.elixirPerSec * m;
  }

  function timeLeft(state) {
    const r = state.rules;
    const end = state.phase === 'overtime' ? r.regulation + r.overtime : r.regulation;
    return Math.max(0, end - state.time);
  }

  /** Advance the match by one fixed step (MATCH.step seconds). */
  function step(state, dtIn) {
    const dt = dtIn || MATCH.step;
    if (!state.running) return;
    // C.H.A.O.S.: the battle stands still while an upgrade choice is open (only its timer runs)
    if (state.chaos && updateChaos(state, dt)) return;
    state.time += dt;
    updateModifiers(state);
    updateDeckSwaps(state);
    updateWaves(state);
    updateBossSpawn(state);

    const maxElixir = state.rules.maxElixir;
    ['A', 'B'].forEach((side) => {
      const p = state.players[side];
      p.elixir = state.rules.infiniteElixir ? maxElixir : clamp(p.elixir + elixirRate(state, side) * dt, 0, maxElixir);
    });
    if (state.rules.announceStages) {
      // Ramp-Up: say so whenever the elixir rate steps up
      let stage = 0;
      state.rules.elixirPhases.forEach((ph, i) => { if (state.time >= ph.at) stage = i; });
      if (stage !== state.stage) { state.stage = stage; pushFx(state, { type: 'elixirStage', mult: state.rules.elixirPhases[stage].mult, stage }); }
    }

    buildHash(state);
    // Who was standing when this tick began: they may still land an attack due this tick even if
    // something that updates before them kills them (see releaseOnDeathTick)
    for (const u of state.units) u.live = u.hp > 0;
    for (const t of state.towers) t.live = t.hp > 0;
    // Stagger update order each step so no side always moves first
    const order = state.units.slice();
    if (Math.floor(state.time / dt) % 2) order.reverse();
    for (const u of order) updateUnit(state, u, dt);
    buildHash(state);
    resolveCollisions(state);
    for (const t of state.towers) updateTower(state, t, dt);
    updateZones(state, dt);
    updateProjectiles(state, dt);
    updateHill(state, dt);
    if (state.obj) updateObjectives(state, dt);
    updateBossPhases(state);
    processDeaths(state);
    updateClock(state);
  }

  // ─── Objective modes (Touchdown, Capture the Point, Payload, Treasure Hunt) ─
  //
  // These play without crown towers (rules.noTowers lists both sides). A troop with nothing to
  // fight heads for the mode's objective instead of a tower, and the match is decided by
  // p.score (rules.scoreToWin) or, for Payload, by where the cart is. All of it runs inside the
  // shared engine, so it is server-authoritative online like every other rule.
  //
  //   touchdown { depth }                 a troop that reaches the enemy's back `depth` tiles scores 1
  //   capture   { spots, r, rate }        points per second for each zone only your troops stand in
  //   payload   { x, r, speed, end }      the cart rolls toward the side with no troops near it
  //   treasure  { every, life, r, hold, elixir }  mirrored chests appear; stand on one alone to claim it

  const hasObjective = (r) => !!(r.touchdown || r.capture || r.payload || r.treasure);

  function freshObjectives(rules) {
    const o = {};
    if (rules.payload) o.payload = { x: rules.payload.x, y: H / 2, dir: 0 };
    if (rules.capture) o.capture = { held: rules.capture.spots.map(() => null) };
    if (rules.treasure) o.treasure = { chests: [], next: rules.treasure.every * 0.5, n: 0 };
    return o;
  }

  // Where a troop with no enemy to fight walks to (null: nowhere special)
  function objectivePoint(state, u) {
    const r = state.rules;
    const o = state.obj;
    const mine = u.owner === 'A';
    if (r.touchdown) return { x: clamp(u.x, 1, W - 1), y: mine ? 0.6 : H - 0.6, radius: 0.1 };
    if (r.payload && o.payload) {
      // Stand just behind the cart (on your own side of it), so you push it toward the enemy
      return { x: o.payload.x + (u.x < o.payload.x ? -0.6 : 0.6), y: o.payload.y + (mine ? 1 : -1), radius: 0.6 };
    }
    if (r.capture) {
      let best = null;
      r.capture.spots.forEach((s, i) => {
        const d = dist(u.x, u.y, s.x, s.y) - (o.capture.held[i] === u.owner ? 3 : 0); // prefer zones you don't hold yet
        if (!best || d < best.d) best = { d, x: s.x, y: s.y };
      });
      return best ? { x: best.x, y: best.y, radius: r.capture.r * 0.6 } : null;
    }
    if (r.treasure && o.treasure) {
      let best = null;
      o.treasure.chests.forEach((c) => {
        if (c.at > state.time) return;
        const d = dist(u.x, u.y, c.x, c.y);
        if (!best || d < best.d) best = { d, x: c.x, y: c.y };
      });
      return best ? { x: best.x, y: best.y, radius: r.treasure.r * 0.5 } : null;
    }
    return null;
  }

  function walkToObjective(state, u, dt, rate) {
    const p = objectivePoint(state, u);
    if (!p) { if (state.rules.guard) holdGuardLine(state, u, dt, rate); return; }
    if (dist(u.x, u.y, p.x, p.y) <= p.radius + 0.2) { u.vx = 0; u.vy = 0; return; }
    // An objective is somewhere to stand, not something to shoot: walk all the way, whatever the range
    const range = u.range;
    u.range = 0;
    moveToward(state, u, { id: `obj-${Math.round(p.x * 2)}-${Math.round(p.y * 2)}`, kind: 'point', x: p.x, y: p.y, radius: 0.2, hp: 1 }, dt, rate);
    u.range = range;
  }

  // Live troop strength of each side within r of a point (deploying troops don't count yet)
  function presence(state, x, y, r) {
    const out = { A: 0, B: 0 };
    for (const e of state.units) {
      if (e.kind !== 'troop' || e.hp <= 0 || e.deployT > 0 || !(e.owner in out)) continue;
      if (dist(e.x, e.y, x, y) <= r + e.radius * 0.5) out[e.owner] += Math.max(0.35, e.costShare || 0);
    }
    return out;
  }

  function addScore(state, side, n, x, y) {
    const p = state.players[side];
    p.score = (p.score || 0) + n;
    pushFx(state, { type: 'score', owner: side, x, y, n, score: Math.floor(p.score) });
  }

  function updateObjectives(state, dt) {
    const r = state.rules;
    const o = state.obj;
    if (!o || !state.running) return;
    if (r.touchdown) {
      const d = r.touchdown.depth;
      for (const u of state.units) {
        if (u.kind !== 'troop' || u.hp <= 0 || u.deployT > 0) continue;
        const scored = u.owner === 'A' ? u.y <= d : u.y >= H - d;
        if (!scored) continue;
        addScore(state, u.owner, 1, u.x, u.y);
        u.hp = 0;
        u.dead = true; // leaves the field without death effects (it scored, it wasn't killed)
      }
    }
    if (r.capture) {
      r.capture.spots.forEach((s, i) => {
        const pw = presence(state, s.x, s.y, r.capture.r);
        // Strict: a zone scores only while exactly one side stands in it
        const holder = pw.A > 0 && pw.B === 0 ? 'A' : pw.B > 0 && pw.A === 0 ? 'B' : null;
        if (holder !== o.capture.held[i] && holder) pushFx(state, { type: 'capture', owner: holder, x: s.x, y: s.y });
        o.capture.held[i] = holder;
        if (holder) state.players[holder].score = (state.players[holder].score || 0) + r.capture.rate * dt;
      });
    }
    if (r.payload) {
      const c = o.payload;
      const pw = presence(state, c.x, c.y, r.payload.r);
      c.dir = pw.A > 0 && pw.B === 0 ? -1 : pw.B > 0 && pw.A === 0 ? 1 : 0; // A pushes it up (toward B)
      c.y = clamp(c.y + c.dir * r.payload.speed * dt, r.payload.end, H - r.payload.end);
      if (c.y <= r.payload.end) endMatch(state, 'A', 'payload');
      else if (c.y >= H - r.payload.end) endMatch(state, 'B', 'payload');
    }
    if (r.treasure) {
      const tr = r.treasure;
      const t = o.treasure;
      if (state.time >= t.next) {
        // A mirrored pair: one on each half, so both sides get the same chance
        t.n++;
        const lane = t.n % 2;
        const x = lane ? W - 4 + (t.n % 3) * 0.5 : 4 - (t.n % 3) * 0.5;
        const y = RIVER.y1 + 4 + (t.n % 3);
        const warn = 3;
        t.chests.push({ id: `c${t.n}a`, x, y, at: state.time + warn, until: state.time + warn + tr.life, hold: 0, side: null });
        t.chests.push({ id: `c${t.n}b`, x: W - x, y: H - y, at: state.time + warn, until: state.time + warn + tr.life, hold: 0, side: null });
        pushFx(state, { type: 'chestSoon', x, y, x2: W - x, y2: H - y });
        t.next = state.time + tr.every;
      }
      t.chests = t.chests.filter((c) => {
        if (state.time > c.until || c.claimed) return false;
        if (state.time < c.at) return true;
        const pw = presence(state, c.x, c.y, tr.r);
        const side = pw.A > 0 && pw.B === 0 ? 'A' : pw.B > 0 && pw.A === 0 ? 'B' : null;
        if (side !== c.side) { c.side = side; c.hold = 0; }
        if (!side) return true;
        c.hold += dt;
        if (c.hold < tr.hold) return true;
        c.claimed = true; // claimed once, by one side, then gone
        addScore(state, side, 1, c.x, c.y);
        giveElixir(state, side, tr.elixir, c.x, c.y);
        return false;
      });
    }
  }

  // Who leads when time runs out in a score mode (null: level)
  function objectiveLeader(state) {
    const r = state.rules;
    if (r.payload && state.obj.payload) {
      const y = state.obj.payload.y;
      return Math.abs(y - H / 2) < 0.05 ? null : y < H / 2 ? 'A' : 'B';
    }
    const a = Math.floor(state.players.A.score || 0);
    const b = Math.floor(state.players.B.score || 0);
    return a === b ? null : a > b ? 'A' : 'B';
  }

  function objectiveSnapshot(state) {
    const r = state.rules;
    const o = state.obj;
    if (!o) return undefined;
    const out = { score: { A: Math.floor(state.players.A.score || 0), B: Math.floor(state.players.B.score || 0) }, toWin: r.scoreToWin || 0 };
    if (r.touchdown) out.touchdown = { depth: r.touchdown.depth };
    if (r.capture) out.capture = r.capture.spots.map((s, i) => ({ x: s.x, y: s.y, r: r.capture.r, held: o.capture.held[i] }));
    if (r.payload) out.payload = { x: o.payload.x, y: r2(o.payload.y), dir: o.payload.dir, r: r.payload.r, end: r.payload.end };
    if (r.treasure) out.chests = o.treasure.chests.map((c) => ({ id: c.id, x: c.x, y: c.y, wait: r2(Math.max(0, c.at - state.time)), left: r2(Math.max(0, c.until - state.time)), side: c.side, hold: r2(c.hold / r.treasure.hold) }));
    return out;
  }

  // ─── The AI in objective modes ──────────────────────────────────────────
  // Without towers to defend or attack, the AI plays the objective: it answers enemy troops near
  // what matters (its end zone, a zone, the cart, a chest), and otherwise sends troops at it.
  function objectiveFocus(state, side) {
    const r = state.rules;
    const o = state.obj;
    const foe = enemyOf(side);
    const ownHome = side === 'A' ? H : 0;
    const points = [];
    if (r.touchdown) {
      // Defend: enemy troops on our half; attack: either lane
      points.push({ x: BRIDGES[0].cx, y: H / 2, attack: true }, { x: BRIDGES[1].cx, y: H / 2, attack: true });
    }
    if (r.capture) r.capture.spots.forEach((s, i) => points.push({ x: s.x, y: s.y, attack: o.capture.held[i] !== side }));
    if (r.payload) points.push({ x: o.payload.x, y: o.payload.y, attack: true });
    if (r.treasure) o.treasure.chests.forEach((c) => { if (!c.claimed) points.push({ x: c.x, y: c.y, attack: true, soon: c.at - state.time }); });
    // Threats: enemy troops on our half, closest to our home line first
    const threats = state.units.filter((u) => u.owner === foe && u.kind === 'troop' && u.hp > 0 && ownHalf(side, u.y))
      .sort((a, b) => Math.abs(a.y - ownHome) - Math.abs(b.y - ownHome));
    return { points, threats };
  }

  function aiObjectivePlay(state, brain, troops) {
    const side = brain.side;
    const p = state.players[side];
    if (!troops.length) return null;
    const { points, threats } = objectiveFocus(state, side);
    const near = (x, y, rad) => state.units.filter((u) => u.owner === enemyOf(side) && u.hp > 0 && u.kind === 'troop' && dist(u.x, u.y, x, y) <= rad);
    const laneOf = (list, lead) => ({
      lead, count: list.length,
      air: list.filter((u) => u.air).length, ground: list.filter((u) => !u.air).length,
      tank: list.some((u) => u.hpMax >= 600), threatValue: list.reduce((s, u) => s + (u.costShare || 0), 0),
    });
    const usable = troops.filter((c) => !c.building || c.targets !== 'none');
    // 1) Defend whatever enemy troop is deepest on our half
    if (threats.length) {
      const lead = threats[0];
      const group = near(lead.x, lead.y, 3);
      const card = chooseDefender(state, brain, usable, laneOf(group, lead));
      if (card) {
        const spot = findDeploySpot(state, side, card, lead.x, toward(side, lead.y, 2));
        if (spot) return { cardId: card.id, x: spot.x, y: spot.y, why: { kind: 'objective-defend' } };
      }
    }
    // 2) Contest the objective: the nearest point we don't control yet, when we can afford it
    const want = points.filter((pt) => pt.attack && !(pt.soon > 6));
    if (!want.length || p.elixir < 6 * (state.rules.maxElixir / 10)) return null;
    const own = side === 'A' ? H : 0;
    const target = want.sort((a, b) => Math.abs(a.y - own) - Math.abs(b.y - own))[0];
    const enemies = near(target.x, target.y, 3.5);
    const card = enemies.length ? chooseDefender(state, brain, usable, laneOf(enemies, enemies[0])) : usable.filter((c) => !c.building).sort((a, b) => (b.speed || 0) - (a.speed || 0) || a.cost - b.cost)[0];
    if (!card) return null;
    const ty = ownHalf(side, target.y) ? target.y : (side === 'A' ? RIVER.y1 + 1 : RIVER.y0 - 1);
    const spot = findDeploySpot(state, side, card, target.x, ty);
    return spot ? { cardId: card.id, x: spot.x, y: spot.y, why: { kind: 'objective' } } : null;
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
        // What each card in hand (and next) costs right now, when an event changes it
        cost: costsChanged ? Object.fromEntries(p.hand.concat(p.queue[0] ? [p.queue[0]] : []).map((id) => [id, playCost(state, p.side, id)])) : undefined,
        size: Object.keys(p.size).length ? { ...p.size } : undefined,
        // Card levels in hand during events (event decks can differ from your collection)
        lvl: r.eventId ? Object.fromEntries(p.hand.map((id) => [id, p.cards[id] ? p.cards[id].level : 1])) : undefined,
        kills: p.kills,
        hill: p.hillCrowns || undefined,
      };
    };
    const r = state.rules;
    const costsChanged = r.cardMods.length > 0 || !!r.sizeRoll || state.modFx.cost !== 0 || state.modFx.costHeavy !== 0;
    const since = (t) => r2(Math.min(9, state.time - t));
    return {
      time: r2(state.time),
      running: state.running,
      winner: state.winner,
      endReason: state.endReason,
      phase: state.phase,
      timeLeft: r2(timeLeft(state)),
      double: elixirMultiplier(state) > 1,
      elixirMult: r2(elixirMultiplier(state)),
      maxElixir: r.maxElixir,
      blackout: r.blackout ? 1 : undefined,
      deployDepth: r.deployDepth || undefined,
      obj: objectiveSnapshot(state),
      playsLeft: r.playLimit ? { A: r.playLimit.A ? Math.max(0, r.playLimit.A - state.players.A.cardsPlayed) : null, B: r.playLimit.B ? Math.max(0, r.playLimit.B - state.players.B.cardsPlayed) : null } : undefined,
      pile: r.gambit ? { A: state.players.A.queue.length, B: state.players.B.queue.length } : undefined,
      ev: eventSnapshot(state),
      chaos: chaosSnapshot(state),
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
        upg: u.upg || undefined,
        emp: u.mech && u.mech.empower && u.deployT <= 0 ? u.mech.empower.radius : undefined,
        dv: u.evo && state.time - u.divedAt < 0.5 ? 1 : undefined,
        stk: u.em && u.em.stackHits && u.stack ? u.stack : undefined,
        rly: u.rally ? r2(u.rally) : undefined,
        form: u.form || undefined,
        boss: u.boss ? 1 : undefined,
        mn: u.bossMinion ? 1 : undefined,
        grd: u.boss && state.boss && state.boss.guard ? 1 : undefined,
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
        // Event areas: their modifier, remaining time, and how long the warning lasts
        mod: z.modId || undefined,
        left: z.until != null ? r2(Math.max(0, z.until - state.time)) : undefined,
        warn: z.warnDur || undefined,
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

  // Event state the HUD needs: active and announced modifiers, hill, waves, boss, deck swaps
  function eventSnapshot(state) {
    const r = state.rules;
    const out = {};
    if (r.eventId) out.id = r.eventId;
    if (r.modifiers.length) {
      out.mods = state.mods.active.map((a) => ({ id: a.id, left: r2(Math.max(0, a.end - state.time)), dur: r2(a.end - a.start) }));
      // Only modifiers inside the warning window are announced: nobody sees further ahead than that
      const next = [];
      for (let i = state.mods.next; i < r.modifiers.length; i++) {
        const lead = r.modifiers[i].at - state.time;
        if (lead > r.modWarn) break;
        next.push({ id: r.modifiers[i].id, in: r2(Math.max(0, lead)) });
      }
      out.next = next;
    }
    if (state.hill) {
      const cfg = r.hill;
      const spot = cfg.spots[state.hill.idx];
      const moveIn = cfg.every - (state.time % cfg.every);
      const nextSpot = cfg.spots[(state.hill.idx + 1) % cfg.spots.length];
      out.hill = {
        x: spot.x, y: spot.y, r: cfg.r, points: cfg.points,
        A: r2(state.hill.pts.A), B: r2(state.hill.pts.B), holder: state.hill.holder,
        moveIn: cfg.spots.length > 1 ? r2(moveIn) : null, nx: nextSpot.x, ny: nextSpot.y,
      };
    }
    if (r.waves) {
      const nxt = r.waves[state.waveNo];
      out.wave = { n: state.waveNo, total: r.waves.length, nextIn: nxt ? r2(Math.max(0, nxt.at - state.time)) : null, left: state.units.reduce((n, u) => n + (u.owner === 'B' && u.hp > 0 ? 1 : 0), 0) };
    }
    if (state.boss) {
      const u = state.boss.id ? state.byId.get(state.boss.id) : null;
      out.boss = {
        cardId: r.boss.card, spawned: state.boss.spawned, inSec: state.boss.spawned ? 0 : r2(Math.max(0, r.boss.at - state.time)),
        hp: u ? Math.round(Math.max(0, u.hp)) : 0, hpMax: u ? u.hpMax : 0,
        guard: state.boss.guard ? 1 : 0, enraged: state.boss.enraged ? 1 : 0, phase: state.boss.summons,
      };
    }
    if (r.deckSwaps.length && state.swapNo < r.deckSwaps.length) out.swapIn = r2(r.deckSwaps[state.swapNo].at - state.time);
    return out;
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
      // plan: rank threats and score placements; lookahead: how many plays to try out in a copy of the match
      // replies / spellLook / pushLook switch the opponent model and the spell / attack look-ahead (all on by default)
      // mistakes: chance per play of a slip (hesitate, or place a little off); 0 for full strength
      profile: Object.assign({ thinkMin: 0.5, thinkMax: 0.6, strategicChance: 0.7, aggression: 0.35, leakAt: 9.3, emoteChance: 0.55, plan: true, lookahead: 2, replies: true, spellLook: true, pushLook: true, mistakes: 0 }, profile || {}),
      thinkT: 1.5,
      rand: rng,
      // What the AI has *seen* the opponent spend (it can't see their elixir, so it estimates)
      foeElixir: 5,
      init: false,
      seenSeq: 0,
      lastPlan: null,     // the last play it made and why (see planDefense, planPush, verifySpell)
      spellQuietUntil: -1, // a "don't cast" verdict stands until then, unless the opponent plays
      spellQuietSeq: -1,
      holdUntil: -1,      // a "hold" verdict stands until then, unless the opponent plays again
      holdSeq: -1,
      stats: { decisions: 0, rollouts: 0, steps: 0, ms: 0, maxMs: 0 },
      emo: { init: false, mine: 3, theirs: 3, scanT: 0, peakThreat: 0, queued: null, lastAt: -99, seenEmoteT: -1, endDone: false },
    };
  }

  function idSeq(id) { return Number(String(id).slice(1)) || 0; }
  const clockMs = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

  // Track the opponent's elixir from what they visibly play (troops landing, spells flying)
  function trackFoeElixir(state, brain, dt) {
    const foe = enemyOf(brain.side);
    // It knows the rules everyone can read (start/max elixir, the visible elixir rate), not the opponent's bar
    if (!brain.init) { brain.init = true; brain.foeElixir = state.rules.startElixir; }
    brain.foeElixir = clamp(brain.foeElixir + MATCH.elixirPerSec * elixirMultiplier(state) * dt, 0, state.rules.maxElixir);
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

  // A telegraphed hazard (meteor mark, boss slam) or the storm is about to hit this spot.
  // Everyone sees these warnings on the arena, so avoiding them is fair play.
  function hazardAt(state, x, y) {
    for (const z of state.zones) {
      if (z.done) continue;
      if ((z.kind === 'impact' || (z.kind === 'slam' && z.owner !== 'X')) && z.delay > 0 && dist(x, y, z.x, z.y) <= z.r + 0.8) return true;
      if (z.kind === 'storm' && dist(x, y, z.x, z.y) <= z.r + 1.5) return true;
    }
    return false;
  }

  function findDeploySpot(state, side, card, x, y) {
    const ok = (px, py) => canDeploy(state, side, px, py, card) && (card.spell || !hazardAt(state, px, py));
    if (ok(x, y)) return { x, y };
    for (let ring = 0.5; ring <= 3; ring += 0.5) {
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        const px = clamp(x + Math.cos(ang) * ring, 0.6, W - 0.6);
        const py = clamp(y + Math.sin(ang) * ring, 0.6, H - 0.6);
        if (ok(px, py)) return { x: px, y: py };
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
  const isTrap = (c) => !!(c.mech && c.mech.trap);
  const isAura = (c) => !!(c.mech && c.mech.empower);
  const hitsAir = (c) => c.targets === 'any' || c.targets === 'air' || (isSpawner(c) && CARD_MAP[c.mech.spawner.card] && CARD_MAP[c.mech.spawner.card].targets === 'any');

  function chooseDefender(state, brain, options, lane) {
    const smart = brain.rand() < brain.profile.strategicChance;
    let best = null;
    let bestScore = -Infinity;
    options.forEach((c) => {
      if (c.spell || isPump(c) || isSiegeBuilding(c) || isAura(c)) return;
      if (isTrap(c) && lane.ground === 0) return; // a mine only catches ground troops
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
    const cands = [];
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
        // Arcane Surge / Spellstorm: spells hit harder right now, so they're worth casting sooner
        value *= state.modFx.spellDmg * (1 + state.rules.spellEcho * 0.6);
        // Prefer clearing threats on our own side of the river
        if (ownHalf(side, pt.y) && kind !== 'spawn') value *= 1.15;
        const need = playCost(state, side, c.id) * (smart ? 1.05 : 1.5);
        const enough = kind === 'spawn' || kind === 'haste' || kind === 'heal' ? count >= 1 : (count >= 2 || value >= 20);
        if (enough && value >= need) {
          const cand = { cardId: c.id, x: clamp(pt.x, 0.6, W - 0.6), y: clamp(pt.y, 0.6, H - 0.6), score: value - c.cost };
          cands.push(cand);
          if (!best || cand.score > best.score) best = cand;
        }
      }
    }
    // The runners-up (best spot of each other spell), for the look-ahead to compare
    if (best) {
      cands.sort((a, b) => b.score - a.score);
      best.alts = cands.filter((cd, i) => cands.findIndex((o) => o.cardId === cd.cardId) === i && cd !== best);
    }
    return best;
  }

  // Look-ahead check for a spell: play the best few casts and "don't cast" in copies of the match.
  // Returns the winning cast (with its numbers), or null when not casting is as good.
  function verifySpell(state, brain, spell) {
    const side = brain.side;
    const model = foeModel(state, brain);
    const stats = brain.stats;
    const opts = [spell].concat((spell.alts || []).slice(0, Math.max(0, (brain.profile.lookahead | 0) - 1)));
    const hold = rollout(state, side, null, AI_EVAL.spellSecs, stats, model);
    let best = null;
    const tried = [];
    for (const o of opts) {
      const v = rollout(state, side, o, AI_EVAL.spellSecs, stats, model);
      if (v == null) continue;
      tried.push({ cardId: o.cardId, x: r2(o.x), y: r2(o.y), value: r2(v) });
      if (!best || v > best.v) best = { o, v };
    }
    stats.rollouts += tried.length + 1;
    if (hold == null || !best) return spell;
    const why = { kind: 'spell', by: 'lookahead', secs: AI_EVAL.spellSecs, hold: r2(hold), tried };
    if (best.v < hold + AI_EVAL.spellMargin) { brain.lastPlan = { hold: true, why: { ...why, verdict: 'no cast: not worth it once played out' } }; return null; }
    return { cardId: best.o.cardId, x: best.o.x, y: best.o.y, why: { ...why, value: r2(best.v), gain: r2(best.v - hold) } };
  }

  // ─── AI: threats, placements and look-ahead ──────────────────────────────
  //
  // The AI reads only what a player could see: units and towers on the board, the cards the
  // opponent has played (state.playLog / castLog) and the public rules. The opponent's hand and
  // elixir are never read; brain.foeElixir and foeCycle() are estimates built from what was seen.
  //
  // Defence runs in four steps: assessThreats() ranks what is coming and how soon, defenseOptions()
  // lists legal (card, spot) pairs and scores each spot against the real targeting rules, and with
  // a look-ahead profile the best few are played out in a throwaway copy of the match (rollout())
  // next to "hold" (play nothing). The winner, with the numbers behind it, ends up in brain.lastPlan.

  const AI_EVAL = {
    towerWorth: 14,      // elixir-equivalent of a full princess tower in the material count
    kingWorth: 26,       // ... of the king (losing it loses the match)
    winWorth: 200,       // a rollout that ends the match
    urgencyHalf: 4,      // seconds-to-tower at which a threat counts half as urgent
    holdMargin: 0.75,    // a defensive play must beat holding by this much (elixir) to be made
    horizonMin: 3,       // seconds each candidate is played out for (more when the threat is far off)
    horizonMax: 6,
    hitWindow: 4,        // seconds of the threat at work that a rollout should include after it arrives
    workBudget: 6000,    // unit-steps one decision may spend on rollouts (steps x units on the board), so
                         // a crowded board gets fewer/shorter rollouts; counted, not timed, so it stays deterministic
    recheck: 0.8,        // after a "hold" verdict, wait this long before re-running rollouts (unless the foe plays)
    reaction: 1.0,       // seconds before the modelled opponent answers a play inside a rollout
    replyMin: 0.8,       // the modelled answer must be worth this fraction of its cost to be made
    spellMargin: 0.4,    // a spell must beat not casting by this much (elixir) in its rollout
    spellSecs: 3,        // rollout length for a spell
    pushSecs: 8,         // rollout length for an attack (time to cross and start hitting)
  };

  // Where an enemy troop is heading on our side and roughly how long until it gets there.
  // Ground troops on the far side of the river must go round by the bridge in their lane.
  function travelTime(u, goal) {
    const reach = Math.max(0, edgeDist(u, goal) - u.range);
    if (reach <= 0) return u.deployT > 0 ? u.deployT : 0;
    let d = reach;
    const crosses = (u.y < RIVER.y0) !== (goal.y < RIVER.y0);
    if (!u.air && crosses && !u.special.includes('jump')) {
      const b = BRIDGES[u.x < MID_X ? 0 : 1];
      const by = (RIVER.y0 + RIVER.y1) / 2;
      d = dist(u.x, u.y, b.cx, by) + Math.max(0, dist(b.cx, by, goal.x, goal.y) - targetExtent(goal) - u.range);
    }
    return (u.deployT > 0 ? u.deployT : 0) + d / Math.max(0.3, u.speed);
  }

  /** Rank every visible enemy that is coming for `side`: [{ u, lane, goal, eta, value, towerHit, danger }]. */
  function assessThreats(state, side) {
    const foe = enemyOf(side);
    const out = [];
    for (const u of state.units) {
      if (u.owner !== foe || u.hp <= 0 || u.hidden || u.targets === 'none') continue;
      if (u.building && u.range < 9) continue; // only siege buildings reach our towers from their side
      // What it is fighting now, if that is ours; otherwise the tower it is walking to
      const cur = u.targetId ? state.byId.get(u.targetId) : null;
      const goal = cur && cur.owner === side && cur.hp > 0 ? cur : defaultTarget(state, u);
      if (!goal) continue;
      const eta = travelTime(u, goal);
      const value = u.costShare * (u.hp / u.hpMax) * (u.evo ? 1.35 : 1);
      // What it does to a tower once it gets there (about five seconds of hitting it)
      let towerHit = 0;
      const tower = goal.kind === 'tower' ? goal : null;
      if (tower && u.targets !== 'air') {
        const dps = (u.dmg * u.structureMult * (u.swarmCount || 1)) / Math.max(0.4, u.cd);
        towerHit = (Math.min(tower.hp, dps * 5) / tower.hpMax) * (tower.tower === 'king' ? AI_EVAL.kingWorth : AI_EVAL.towerWorth);
      }
      const urgency = 1 / (1 + eta / AI_EVAL.urgencyHalf);
      out.push({ u, lane: u.x < MID_X ? 0 : 1, goal, eta, value, towerHit, danger: urgency * (value + towerHit) });
    }
    out.sort((a, b) => b.danger - a.danger || idSeq(a.u.id) - idSeq(b.u.id));
    return out;
  }

  /**
   * What the AI can infer about the opponent's hand from the cards it has seen played (public).
   * A played card goes to the back of an (deck - 4) card queue, so it cannot come back until that
   * many other plays have happened. The deck is at least as big as the number of different cards
   * seen, which gives a safe lower bound: until enough plays pass, the card is certainly not in hand.
   * Cards never seen are unknown, never assumed absent.
   */
  function foeCycle(state, side) {
    const foe = enemyOf(side);
    const plays = state.playLog.filter((p) => p.owner === foe && p.swap === state.swapNo);
    const seen = new Set(plays.map((p) => p.cardId));
    const queue = clamp(seen.size - 4, 0, MAX_DECK - 4);
    const lastAt = new Map();
    plays.forEach((p, i) => lastAt.set(p.cardId, i));
    return {
      seen,
      // false only when the rules prove it is not in hand right now
      mayHold(cardId) {
        if (!lastAt.has(cardId)) return true;
        return plays.length - 1 - lastAt.get(cardId) >= queue;
      },
    };
  }

  // Splash spells the opponent has shown and could have back in hand (an estimate)
  function foeSplashReady(cycle) {
    let n = 0;
    cycle.seen.forEach((id) => {
      const c = CARD_MAP[id];
      if (c && c.spell && !c.friendly && c.dmg > 0 && c.splash >= 1.5 && cycle.mayHold(id)) n++;
    });
    return n;
  }

  // The deterministic part of how well card c answers this lane (null: it can't)
  function defenderScore(state, brain, c, lane) {
    if (c.spell || isPump(c) || isSiegeBuilding(c) || isAura(c)) return null;
    if (isTrap(c) && lane.ground === 0) return null;
    if (c.targets === 'buildings' && !c.building) return null;
    if (c.targets === 'air' && lane.air === 0) return null;
    if (lane.ground === 0 && lane.air > 0 && !hitsAir(c) && !isTaunt(c)) return null;
    let s = 0;
    if (isTrap(c)) s += lane.count >= 3 ? 3 : 1.5; // roots a whole group in its path
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
    s -= c.cost * 0.25;
    if (evoReady(state.players[brain.side], c.id)) s += 1.2;
    return s;
  }

  // Distance from point p to the segment a-b
  function segDist(px, py, ax, ay, bx, by) {
    const vx = bx - ax;
    const vy = by - ay;
    const L2 = vx * vx + vy * vy;
    const t = L2 > 1e-9 ? clamp(((px - ax) * vx + (py - ay) * vy) / L2, 0, 1) : 0;
    return dist(px, py, ax + vx * t, ay + vy * t);
  }

  // Candidate spots for defender c against threat th. All are passed through the real deploy check.
  function defenseSpots(state, side, c, th, laneIdx, legacy) {
    const L = th.u;
    const G = th.goal;
    const laneX = TOWER_LAYOUT.princessX[laneIdx];
    const inward = laneIdx === 0 ? 1 : -1; // toward the middle of the arena
    const raw = [legacy];
    // In its path, a little ahead of it: meets it head on
    for (const f of [0.35, 0.6]) raw.push({ x: L.x + (G.x - L.x) * f, y: L.y + (G.y - L.y) * f });
    if (c.building || isTaunt(c)) {
      // Pull spots: toward the middle, so whatever turns for it walks away from the tower
      const b = defenseBuildingSpot(side, laneIdx);
      raw.push(b, { x: b.x + inward, y: toward(side, b.y, 1) });
    }
    if (c.range >= 3 || c.targets === 'air') {
      // Behind the tower, nudged inward; and just outside the threat's reach but inside ours
      raw.push({ x: laneX + inward * 1.2, y: toward(side, TOWER_LAYOUT.princessY[side], 2.8) });
      raw.push({ x: L.x, y: toward(side, L.y, Math.min(c.range + 0.5, 5.5)) });
    }
    if (c.splash > 0) {
      // On the middle of the group, a step back
      const grp = state.units.filter((e) => e.owner === L.owner && e.hp > 0 && dist(e.x, e.y, L.x, L.y) < 3);
      const cx = grp.reduce((s2, e) => s2 + e.x, 0) / grp.length;
      const cy = grp.reduce((s2, e) => s2 + e.y, 0) / grp.length;
      raw.push({ x: cx, y: toward(side, cy, 2.2) });
    }
    const out = [];
    for (const p of raw) {
      const y = side === 'A' ? clamp(p.y, RIVER.y1 + 0.6, H - 1) : clamp(p.y, 1, RIVER.y0 - 0.6);
      const ok = findDeploySpot(state, side, c, clamp(p.x, 0.8, W - 0.8), y);
      // (coordinates stay exactly as checked: rounding could nudge a spot into an illegal cell)
      if (ok && !out.some((q) => dist(q.x, q.y, ok.x, ok.y) < 0.6)) out.push({ x: ok.x, y: ok.y, legacy: p === legacy });
    }
    return out;
  }

  // How well a spot works against the threat, judged by the real targeting rules:
  // can our unit reach the threat's path, and will the threat turn to fight it before it reaches the tower?
  function spotScore(state, side, c, spot, th, splashRisk) {
    const L = th.u;
    const G = th.goal;
    const r = c.radius || 0.5;
    const probe = { id: 'probe', x: spot.x, y: spot.y, radius: r, kind: c.building ? 'building' : 'troop', owner: side, hp: 1, air: c.air, hidden: false };
    const notes = [];
    let s = 0;
    // Can we engage it? Distance from our spot to the threat's route to its goal
    const route = segDist(spot.x, spot.y, L.x, L.y, G.x, G.y);
    const reach = c.building ? c.range + r : Math.max(c.range, c.sight || 5.5);
    if (route <= reach) { s += 1.5; notes.push('covers its route'); } else s -= 1.5;
    // Lure: it can target us, and it sees us before it is on its tower
    if (canTarget(L, probe)) {
      const sight = L.sight || 5.5;
      const towerReach = targetExtent(G) + L.range;
      let lured = false;
      for (let f = 0; f <= 1.001; f += 0.1) {
        const px = L.x + (G.x - L.x) * f;
        const py = L.y + (G.y - L.y) * f;
        if (dist(px, py, G.x, G.y) - towerReach <= 0 && G.kind === 'tower') break;
        if (dist(px, py, spot.x, spot.y) - r <= sight) { lured = true; break; }
      }
      if (lured) {
        s += 2;
        notes.push('pulls it off the tower');
        // A pull toward the middle drags it further from both towers
        if (Math.abs(spot.x - MID_X) < Math.abs(G.x - MID_X) - 1) { s += 1; notes.push('toward the middle'); }
      }
    } else if (L.targets === 'buildings' && !c.building) {
      notes.push('it ignores troops: hit it on the way');
    }
    // Our unit must have landed before the threat walks past
    const arrive = dist(L.x, L.y, spot.x, spot.y) / Math.max(0.3, L.speed);
    if (arrive < MATCH.deployTime * 0.8) { s -= 1; notes.push('lands too late'); }
    // Swarms next to the enemy's splash, or under a splash spell they may have back
    if ((c.swarmCount || 1) >= 3) {
      const splashers = state.units.some((e) => e.owner === L.owner && e.hp > 0 && e.splash > 0 && dist(e.x, e.y, spot.x, spot.y) < 3.5);
      if (splashers) { s -= 1.5; notes.push('splash nearby'); }
      s -= splashRisk * 0.4;
    }
    // Don't drop it on top of our own crowd
    let crowd = 0;
    for (const u of state.units) if (u.owner === side && !u.air && !c.air && u.hp > 0 && dist(u.x, u.y, spot.x, spot.y) < r + u.radius) crowd++;
    if (crowd >= 2) { s -= 0.8; notes.push('crowded'); }
    return { score: s, notes };
  }

  // A private copy of the match for "what if" play. Nothing done to it reaches the real match, and
  // it gets its own random stream so the AI can't peek at the real match's upcoming rolls.
  function cloneForRollout(state) {
    const copy = structuredClone({ ...state, fx: [], hash: null });
    copy.chaos = null; // no upgrade choices inside a look-ahead (chosen upgrades are already in the card stats)
    if (state.modFx === NO_FX) copy.modFx = NO_FX;
    copy.seed = (state.seed ^ 0x5bd1e995) | 0;
    buildHash(copy);
    return copy;
  }

  // Elixir-equivalent balance for `side`: units (by health left) and towers, mine minus theirs
  function material(state, side) {
    if (!state.running) return state.winner === side ? AI_EVAL.winWorth : state.winner === 'draw' ? 0 : -AI_EVAL.winWorth;
    let m = 0;
    for (const u of state.units) {
      if (u.hp <= 0 || !(u.costShare > 0)) continue;
      const v = u.costShare * (u.hp / u.hpMax);
      m += u.owner === side ? v : -v;
    }
    for (const t of state.towers) {
      const v = (Math.max(0, t.hp) / t.hpMax) * (t.tower === 'king' ? AI_EVAL.kingWorth : AI_EVAL.towerWorth);
      m += t.owner === side ? v : -v;
    }
    return m;
  }

  /**
   * What the AI believes the opponent could answer with: only cards it has SEEN them play that the
   * cycle rules don't rule out, at the level their units have shown, with its estimate of their
   * elixir. Never-seen cards can't be modelled, so they are left out (the answer is a lower bound).
   */
  function foeModel(state, brain) {
    if (brain.profile && brain.profile.replies === false) return null;
    const foe = enemyOf(brain.side);
    const cyc = foeCycle(state, brain.side);
    const ids = [...cyc.seen].filter((id) => CARD_MAP[id] && !CARD_MAP[id].token && cyc.mayHold(id));
    const lv = state.units.filter((u) => u.owner === foe && u.costShare > 0).map((u) => u.level || 1);
    const level = lv.length ? Math.round(lv.reduce((a, b) => a + b, 0) / lv.length) : 1;
    return { ids, elixir: brain.foeElixir, level };
  }

  // Inside a rollout: the opponent answers our play at (action.x, action.y) with the best card the
  // model allows. The copy's real hand is hidden information, so it is replaced by the believed one
  // before anything is played. Returns the elixir the answer cost (0 if there was none).
  function modelReply(sim, side, model, action) {
    if (!model || !model.ids.length || !action) return 0;
    const foe = enemyOf(side);
    const p = sim.players[foe];
    const near = sim.units.filter((u) => u.owner === side && u.hp > 0 && u.costShare > 0 && dist(u.x, u.y, action.x, action.y) < 4);
    if (!near.length) return 0;
    const laneIdx = action.x < MID_X ? 0 : 1;
    const lane = laneSummary(sim, foe, laneIdx);
    const cx = near.reduce((a, u) => a + u.x, 0) / near.length;
    const cy = near.reduce((a, u) => a + u.y, 0) / near.length;
    let best = null;
    for (const id of model.ids) {
      const c = getCardStatsAtLevel(id, model.level, false, 0);
      if (!c || c.cost > model.elixir) continue;
      let value;
      let spot;
      if (c.spell) {
        if (c.friendly || !(c.dmg > 0)) continue;
        value = 0;
        for (const e of near) if (dist(cx, cy, e.x, e.y) - e.radius <= c.splash) value += hitValue(e, c.dmgScaled);
        spot = { x: cx, y: cy };
      } else {
        const sc = defenderScore(sim, { side: foe }, c, lane);
        if (sc == null) continue;
        value = c.cost * (1 + sc / 10);
        const want = legacyDefenseSpot(foe, c, near[0], laneIdx);
        spot = findDeploySpot(sim, foe, c, want.x, want.y);
        if (!spot) continue;
      }
      if (value < c.cost * AI_EVAL.replyMin) continue;
      if (!best || value - c.cost > best.value - best.c.cost) best = { id, c, value, spot };
    }
    if (!best) return 0;
    p.cards[best.id] = best.c;
    p.hand = [best.id];
    p.queue = [];
    p.cooldowns[best.id] = 0;
    p.elixir = best.c.cost; // exactly enough: the copy's real elixir is hidden information too
    return deploy(sim, foe, best.id, best.spot.x, best.spot.y).ok ? best.c.cost : 0;
  }

  // Play `action` (or nothing) in a copy of the match for `secs` and score the result. With a foe
  // model, the opponent answers the play after AI_EVAL.reaction seconds; the elixir they spend is
  // added back, so only what their answer achieves on the board counts against the play.
  function rollout(state, side, action, secs, stats, model) {
    if (typeof structuredClone !== 'function') return null;
    const sim = cloneForRollout(state);
    let cost = 0;
    let replyCost = 0;
    if (action) {
      cost = playCost(sim, side, action.cardId);
      if (!deploy(sim, side, action.cardId, action.x, action.y).ok) return null;
    }
    const steps = Math.round(secs / MATCH.step);
    const replyAt = model && action ? Math.round(AI_EVAL.reaction / MATCH.step) : -1;
    for (let i = 0; i < steps && sim.running; i++) {
      if (i === replyAt) replyCost = modelReply(sim, side, model, action);
      step(sim);
    }
    if (stats) { stats.steps += steps; if (replyCost) stats.replies = (stats.replies || 0) + 1; }
    return material(sim, side) - cost + replyCost;
  }

  // Pick a defensive play for the most dangerous threat. Returns a plan, a hold verdict, or null.
  function planDefense(state, brain, troops, lanes, threats) {
    const side = brain.side;
    const pr = brain.profile;
    const th = threats[0];
    const laneIdx = th.lane;
    const lane = lanes[laneIdx];
    const splashRisk = foeSplashReady(foeCycle(state, side));
    const cands = [];
    for (const c of troops) {
      const cs = defenderScore(state, brain, c, lane);
      if (cs == null) continue;
      const legacy = legacyDefenseSpot(side, c, th.u, laneIdx);
      for (const spot of defenseSpots(state, side, c, th, laneIdx, legacy)) {
        if (refusedHere(state, brain, c.id, spot)) continue;
        const sp = spotScore(state, side, c, spot, th, splashRisk);
        cands.push({ cardId: c.id, x: spot.x, y: spot.y, card: cs, spot: sp.score, notes: sp.notes, h: cs + sp.score });
      }
    }
    if (!cands.length) return null;
    cands.sort((a, b) => b.h - a.h);
    const why = { kind: 'defend', threat: th.u.cardId, threatId: th.u.id, lane: laneIdx, eta: r2(th.eta), danger: r2(th.danger) };
    const k = pr.lookahead | 0;
    if (k <= 0 || typeof structuredClone !== 'function') {
      return { cardId: cands[0].cardId, x: cands[0].x, y: cands[0].y, why: { ...why, by: 'heuristic', score: r2(cands[0].h), notes: cands[0].notes } };
    }
    // Look-ahead: one card per family of spots (best spot each), the top few, against holding
    const picks = [];
    for (const cd of cands) {
      if (picks.length >= k) break;
      if (!picks.some((p) => p.cardId === cd.cardId)) picks.push(cd);
    }
    // ...and the best second spot of the favourite card, if there's budget
    const alt = cands.find((cd) => cd.cardId === picks[0].cardId && cd !== picks[0]);
    if (alt && picks.length < k + 1) picks.push(alt);
    const busy = Math.max(12, state.units.length + state.projectiles.length * 0.25);
    const stepsAllowed = AI_EVAL.workBudget / busy;
    // Long enough to see it arrive and hit for a while; shorter when the board is busy
    const secs = clamp(Math.min(th.eta + AI_EVAL.hitWindow, stepsAllowed * MATCH.step / 2), AI_EVAL.horizonMin * 0.6, AI_EVAL.horizonMax);
    const maxRuns = Math.max(2, Math.floor(stepsAllowed / Math.round(secs / MATCH.step)));
    const stats = brain.stats;
    const model = foeModel(state, brain);
    const hold = rollout(state, side, null, secs, stats, model);
    let best = null;
    const tried = [];
    for (const cd of picks.slice(0, maxRuns - 1)) {
      const v = rollout(state, side, cd, secs, stats, model);
      if (v == null) continue;
      tried.push({ cardId: cd.cardId, x: cd.x, y: cd.y, value: r2(v) });
      if (!best || v > best.v) best = { cd, v };
    }
    stats.rollouts += tried.length + 1;
    if (!best || hold == null) return { cardId: cands[0].cardId, x: cands[0].x, y: cands[0].y, why: { ...why, by: 'heuristic', score: r2(cands[0].h) } };
    const detail = { ...why, by: 'lookahead', secs: r2(secs), hold: r2(hold), tried };
    if (best.v < hold + AI_EVAL.holdMargin) return { hold: true, why: { ...detail, verdict: 'hold: no play beats letting it come' } };
    return { cardId: best.cd.cardId, x: best.cd.x, y: best.cd.y, why: { ...detail, value: r2(best.v), gain: r2(best.v - hold), notes: best.cd.notes } };
  }

  // Look-ahead for an attack: the top two fast (or tunnelling) win conditions, each sent down either
  // lane, played out with the opponent's modelled answer. Slow tanks keep the start-at-the-back
  // heuristic: a few seconds of look-ahead can't see their pay-off, so it would only bias against them.
  // A slow single-body win condition (Rock Titan, Storm Zeppelin, Siege) walks from the back; slow
  // swarms like UFO Fleet go to the bridge instead, so they don't cross the whole map alone
  function startsAtBack(c) { return c.speed <= 1.0 && (c.swarmCount || 1) <= 1; }

  function planPush(state, brain, winCons, enemyPrincesses, bridgeY) {
    const side = brain.side;
    const foe = enemyOf(side);
    if (brain.profile.plan === false || brain.profile.pushLook === false || (brain.profile.lookahead | 0) <= 0 || typeof structuredClone !== 'function') return null;
    // Everything but the slow single-body cards (they start at the back instead): fast win conditions
    // and slow swarms like UFO Fleet
    const fast = winCons.filter((c) => c.anywhere || !startsAtBack(c)).slice(0, 2);
    if (!fast.length) return null;
    const cands = [];
    for (const c of fast) {
      for (const laneIdx of [0, 1]) {
        const tower = enemyPrincesses[laneIdx].hp > 0 ? enemyPrincesses[laneIdx] : state.towers.find((t) => t.owner === foe && t.tower === 'king');
        if (!tower) continue;
        const want = c.anywhere ? { x: tower.x + (tower.x < MID_X ? 2.2 : -2.2), y: tower.y } : { x: BRIDGES[laneIdx].cx, y: bridgeY };
        const spot = findDeploySpot(state, side, c, want.x, want.y);
        if (spot && !refusedHere(state, brain, c.id, spot)) cands.push({ cardId: c.id, x: spot.x, y: spot.y, lane: laneIdx });
      }
    }
    if (!cands.length) return null;
    const busy = Math.max(12, state.units.length + state.projectiles.length * 0.25);
    const steps = Math.round(AI_EVAL.pushSecs / MATCH.step);
    // Whatever a spell check spent earlier in this decision comes out of the same budget
    const spent = (brain.stats.steps - (brain.decisionSteps == null ? brain.stats.steps : brain.decisionSteps)) * busy;
    const runs = Math.min(cands.length, Math.floor((AI_EVAL.workBudget - spent) / busy / steps));
    if (runs < 1) return null;
    const model = foeModel(state, brain);
    const tried = [];
    let best = null;
    for (const cd of cands.slice(0, runs)) {
      const v = rollout(state, side, cd, AI_EVAL.pushSecs, brain.stats, model);
      if (v == null) continue;
      tried.push({ cardId: cd.cardId, lane: cd.lane, value: r2(v) });
      if (!best || v > best.v) best = { cd, v };
    }
    brain.stats.rollouts += tried.length;
    if (!best) return null;
    return { cardId: best.cd.cardId, x: best.cd.x, y: best.cd.y, why: { kind: 'push', by: 'lookahead', secs: AI_EVAL.pushSecs, lane: best.cd.lane, value: r2(best.v), tried } };
  }

  // A play the match refused a moment ago is not tried again at the same spot right away
  function refusedHere(state, brain, cardId, spot) {
    const b = brain.refused;
    return !!(b && b.until > state.time && b.cardId === cardId && dist(b.x, b.y, spot.x, spot.y) < 0.6);
  }

  // The spot the AI has always used for a defender (kept as one of the candidates)
  function legacyDefenseSpot(side, card, lead, laneIdx) {
    const laneX = TOWER_LAYOUT.princessX[laneIdx];
    let spot;
    if (isTaunt(card)) spot = { x: clamp(lead.x, 1.5, W - 1.5), y: toward(side, lead.y, 3.2) };
    else if (card.building) spot = defenseBuildingSpot(side, laneIdx);
    else if (card.range >= 3 || card.targets === 'air') spot = { x: laneX, y: toward(side, TOWER_LAYOUT.princessY[side], 2.8) };
    else spot = { x: lead.x, y: toward(side, lead.y, 2.5) };
    spot.y = side === 'A' ? clamp(spot.y, RIVER.y1 + 0.6, H - 1) : clamp(spot.y, 1, RIVER.y0 - 0.6);
    return spot;
  }

  function aiDecide(state, brain) {
    const side = brain.side;
    const foe = enemyOf(side);
    const p = state.players[side];
    const options = p.hand.map((id) => p.cards[id]).filter((c) => c && playCost(state, side, c.id) <= p.elixir && (p.cooldowns[c.id] || 0) <= state.time);
    if (options.length === 0) return null;
    const limit = state.rules.playLimit && state.rules.playLimit[side];
    if (limit > 0 && p.cardsPlayed >= limit) return null; // out of plays (Inferno Siege)
    // Unit cap (Triple / Infinite Elixir): only cards that still fit
    if (state.rules.unitCap > 0) {
      let n = 0;
      for (const u of state.units) if (u.owner === side && u.hp > 0 && u.costShare > 0) n++;
      for (let i = options.length - 1; i >= 0; i--) if (!options[i].spell && n + (options[i].swarmCount || 1) > state.rules.unitCap) options.splice(i, 1);
      if (!options.length) return null;
    }
    brain.decisionSteps = brain.stats.steps; // rollouts later in this decision share one work budget
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

    // 0) A spell that pays for itself (or finishes a tower). With look-ahead, the cast is played out
    // first and only made if it beats not casting; a "no" stands for a moment so it isn't re-run every think.
    let spell = brain.spellQuietUntil > state.time && brain.spellQuietSeq === state.playSeq ? null : planSpell(state, brain, options, ctx);
    if (spell && brain.profile.plan !== false && brain.profile.spellLook !== false && (brain.profile.lookahead | 0) > 0 && typeof structuredClone === 'function') {
      spell = verifySpell(state, brain, spell);
      if (!spell) { brain.spellQuietUntil = state.time + AI_EVAL.recheck; brain.spellQuietSeq = state.playSeq; }
    }
    if (spell) { if (spell.why) brain.lastPlan = spell; return spell; }

    // Objective modes (no towers): play the objective instead of the tower game
    if (state.obj) {
      const plan = aiObjectivePlay(state, brain, troops);
      if (plan) brain.lastPlan = plan;
      return plan;
    }

    // 1) Defend the more dangerous lane if it isn't already covered. The planner ranks lanes by how
    // soon and how hard their threats will hit (assessThreats), not just by what has crossed.
    const planner = brain.profile.plan !== false;
    const threats = planner ? assessThreats(state, side) : null;
    let lanePick = lanes[0].threatValue - lanes[0].defenseValue >= lanes[1].threatValue - lanes[1].defenseValue ? 0 : 1;
    if (threats && threats.length) {
      const danger = [0, 0];
      threats.forEach((t) => { danger[t.lane] += t.danger; });
      lanePick = danger[0] - lanes[0].defenseValue * 0.5 >= danger[1] - lanes[1].defenseValue * 0.5 ? 0 : 1;
    }
    const lane = lanes[lanePick];
    const need = lane.threatValue - lane.defenseValue * 0.8;
    const leadDeep = lane.lead && (side === 'A' ? lane.lead.y > RIVER.y1 + 1 : lane.lead.y < RIVER.y0 - 1);
    const holding = brain.holdUntil > state.time && brain.holdSeq === state.playSeq;
    if (lane.lead && (need >= 1.5 || (leadDeep && need > 0.5)) && !holding) {
      const laneThreats = threats ? threats.filter((t) => t.lane === lanePick) : [];
      if (planner && laneThreats.length && brain.rand() < brain.profile.strategicChance) {
        const plan = planDefense(state, brain, troops, lanes, laneThreats);
        if (plan && plan.hold) {
          brain.holdUntil = state.time + AI_EVAL.recheck;
          brain.holdSeq = state.playSeq;
          brain.lastPlan = plan;
        } else if (plan) {
          brain.lastPlan = plan;
          return plan;
        }
      } else {
        const card = chooseDefender(state, brain, troops, lane);
        if (card) {
          const spot = legacyDefenseSpot(side, card, lane.lead, lanePick);
          const ok = findDeploySpot(state, side, card, spot.x, spot.y);
          if (ok) return { cardId: card.id, x: ok.x, y: ok.y };
        }
      }
    }

    // Read the event: what's on now (and what has been announced) changes how freely it spends
    const fx = state.modFx;
    const scale = state.rules.maxElixir / 10;
    const cheapNow = fx.cost < 0 || fx.costHeavy < 0 || fx.elixir > 1.2;
    const conserve = fx.elixir < 1 || (state.rules.killRefund > 0 && !cheapNow);

    // King of the Hill: keep a presence on the hill
    const hill = state.hill && state.rules.hill;
    if (hill) {
      const spot = hill.spots[state.hill.idx];
      const mineOnHill = (state.hill.power && state.hill.power[side]) || 0;
      const foeOnHill = (state.hill.power && state.hill.power[foe]) || 0;
      if (mineOnHill <= foeOnHill && p.elixir >= 3.5 * scale) {
        const contester = troops.filter((c) => !c.building && c.targets !== 'air' && !c.anywhere)
          .sort((a, b) => (foeOnHill > 0 ? dps(b) - dps(a) : a.cost - b.cost))[0];
        if (contester) {
          const spotOk = findDeploySpot(state, side, contester, spot.x, side === 'A' ? RIVER.y1 + 1 : RIVER.y0 - 1);
          if (spotOk) return { cardId: contester.id, x: spotOk.x, y: spotOk.y };
        }
      }
    }

    // 2) Offense: build a push in the weaker enemy lane; don't sit at full elixir
    // Heist (no Princess Towers): both lanes lead to the enemy King, the vault
    const foeKing = state.rules.kingOnly ? state.towers.find((t) => t.owner === foe && t.tower === 'king') : null;
    const enemyPrincesses = foeKing ? [foeKing, foeKing] : [princessOf(state, foe, 0), princessOf(state, foe, 1)];
    if (!enemyPrincesses[0] || !enemyPrincesses[1]) return null; // nothing to attack (survival / boss)
    let attackLane = 0;
    if (hill) attackLane = hill.spots[state.hill.idx].x < MID_X ? 0 : 1;
    else if (enemyPrincesses[0].hp <= 0) attackLane = 0;
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

    const leaking = p.elixir >= brain.profile.leakAt * scale;
    const doubleTime = elixirMultiplier(state) > 1;
    // Punish when the opponent has (visibly) just spent a lot
    const foeLow = brain.foeElixir < 3;
    // Card cycle (planner only): their buildings and damage spells we've seen are all still cycling
    let answersDown = false;
    let incoming = false;
    if (planner) {
      const cyc = foeCycle(state, side);
      const answers = [...cyc.seen].filter((id) => CARD_MAP[id] && (CARD_MAP[id].building || (CARD_MAP[id].spell && CARD_MAP[id].dmg > 0)));
      answersDown = answers.length > 0 && answers.every((id) => !cyc.mayHold(id));
      // Something dangerous is on its way (even from the back): keep enough to answer it
      incoming = threats.some((t) => t.eta < 6 && t.danger >= 2);
    }
    const aggression = Math.min(0.95, brain.profile.aggression * (doubleTime ? 1.5 : 1) + (foeLow ? 0.3 : 0) + (cheapNow ? 0.25 : 0) - (conserve ? 0.2 : 0) + (answersDown ? 0.15 : 0));
    const wantsPush = leaking || (p.elixir >= (foeLow ? 5 : 7) * scale && (!incoming || p.elixir >= 8.5 * scale) && brain.rand() < aggression);
    const calm = lanes[0].threatValue + lanes[1].threatValue < 0.5;

    // An elixir pump when things are quiet (and only one at a time)
    const pump = troops.find(isPump);
    if (pump && calm && p.elixir >= 7.5 && !mine.some((u) => u.mech && u.mech.elixir)) {
      const spot = findDeploySpot(state, side, pump, TOWER_LAYOUT.princessX[1 - attackLane] + (attackLane ? 1.5 : -1.5), side === 'A' ? H - 1.6 : 1.6);
      if (spot) return { cardId: pump.id, x: spot.x, y: spot.y };
    }

    // War Drum: only where our own troops are gathering (it does nothing on its own)
    const aura = troops.find(isAura);
    if (aura && p.elixir >= aura.cost + 1 && !mine.some((u) => u.mech && u.mech.empower && u.hp > 0)) {
      const pushers = state.units.filter((u) => u.owner === side && u.kind === 'troop' && u.hp > 0 && u.costShare > 0 && ownHalf(side, u.y));
      if (pushers.reduce((sum, u) => sum + u.costShare, 0) >= 4) {
        const cx = pushers.reduce((sum, u) => sum + u.x, 0) / pushers.length;
        const cy = pushers.reduce((sum, u) => sum + u.y, 0) / pushers.length;
        const spot = findDeploySpot(state, side, aura, cx + (cx < MID_X ? 1.2 : -1.2), side === 'A' ? Math.max(cy + 1, RIVER.y1 + 1.2) : Math.min(cy - 1, RIVER.y0 - 1.2));
        if (spot) return { cardId: aura.id, x: spot.x, y: spot.y };
      }
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
      const pushPlan = planPush(state, brain, winCons, enemyPrincesses, bridgeY);
      if (pushPlan) { brain.lastPlan = pushPlan; return pushPlan; }
      const c = winCons[0];
      let spot;
      if (c.anywhere) {
        // Tunnel straight to the side of the target tower
        const target = enemyPrincesses[attackLane].hp > 0 ? enemyPrincesses[attackLane] : state.towers.find((t) => t.owner === foe && t.tower === 'king');
        spot = target ? findDeploySpot(state, side, c, target.x + (target.x < MID_X ? 2.2 : -2.2), target.y) : null;
      } else if (startsAtBack(c)) {
        // Slow tanks start at the back to build elixir behind them; everything else goes straight to the bridge
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
      // A mine in front of the weaker tower, or a drum behind the King: never sit on them at full elixir
      const parked = troops.find((c) => isTrap(c) || isAura(c));
      if (parked) {
        const myPrincess = [princessOf(state, side, 0), princessOf(state, side, 1)].filter((t) => t && t.hp > 0).sort((a, b) => a.hp / a.hpMax - b.hp / b.hpMax)[0];
        const s = isTrap(parked) && myPrincess
          ? { x: myPrincess.x + (myPrincess.x < MID_X ? 1.5 : -1.5), y: toward(side, myPrincess.y, -3.2) }
          : { x: MID_X, y: side === 'A' ? H - 1.5 : 1.5 };
        const spot = findDeploySpot(state, side, parked, s.x, s.y);
        if (spot) return { cardId: parked.id, x: spot.x, y: spot.y };
      }
      const spawner = troops.find((c) => isSpawner(c));
      if (spawner) {
        const s = defenseBuildingSpot(side, attackLane);
        const spot = findDeploySpot(state, side, spawner, s.x, s.y);
        if (spot) return { cardId: spawner.id, x: spot.x, y: spot.y };
      }
      // A hand of nothing but spells (spell-heavy event decks): chip the weaker tower instead of
      // sitting at full elixir, which also cycles the hand toward troops. Events only, so normal
      // battles keep exactly the AI they always had.
      const chip = !state.rules.eventId ? null : options.filter((c) => c.spell && !c.friendly && (c.dmg > 0 || (c.zone && c.zone.kind === 'spawn')))
        .sort((a, b) => playCost(state, side, a.id) - playCost(state, side, b.id))[0];
      const tower = enemyPrincesses[attackLane].hp > 0 ? enemyPrincesses[attackLane] : state.towers.find((t) => t.owner === foe && t.tower === 'king' && t.hp > 0);
      if (chip && tower) return { cardId: chip.id, x: tower.x, y: tower.y };
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
    // C.H.A.O.S.: answer an open upgrade choice first; nothing else happens while play is frozen
    if (state.chaos && aiChooseUpgrade(state, brain, dt)) return null;
    if (choicePaused(state)) return null;
    trackFoeElixir(state, brain, dt);
    brain.thinkT -= dt;
    if (brain.thinkT > 0) return null;
    const pr = brain.profile;
    brain.thinkT = pr.thinkMin + brain.rand() * (pr.thinkMax - pr.thinkMin);
    const t0 = clockMs();
    const plan = aiDecide(state, brain);
    // Decision time is recorded for profiling only; it never feeds back into a decision
    const ms = clockMs() - t0;
    const st = brain.stats;
    st.decisions++;
    st.ms += ms;
    if (ms > st.maxMs) st.maxMs = ms;
    if (!plan) return null;
    // Lower difficulties make honest mistakes (profile.mistakes = chance per play): hesitate a beat,
    // or drop the card a little off the planned spot (still a legal one). Never a stat bonus.
    if (pr.mistakes > 0 && brain.rand() < pr.mistakes) {
      if (brain.rand() < 0.4) return null;
      const card = state.players[brain.side].cards[plan.cardId];
      const a = brain.rand() * Math.PI * 2;
      const d = 1.2 + brain.rand() * 1.8;
      const nx = clamp(plan.x + Math.cos(a) * d, 0.6, W - 0.6);
      const ny = clamp(plan.y + Math.sin(a) * d, 0.6, H - 0.6);
      const spot = card && card.spell ? { x: nx, y: ny } : findDeploySpot(state, brain.side, card, nx, ny);
      if (spot) { plan.x = spot.x; plan.y = spot.y; if (plan.why) plan.why.slip = true; }
    }
    const res = deploy(state, brain.side, plan.cardId, plan.x, plan.y);
    if (plan.why) plan.why.ok = res.ok;
    if (!res.ok) brain.refused = { cardId: plan.cardId, x: plan.x, y: plan.y, until: state.time + 2, reason: res.reason };
    return res;
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
    ARCHETYPES, VARIANTS, REMOVED_VARIANTS, migrateCardId, CARD_LIBRARY, CARD_MAP, STARTER_DECK, MAX_DECK, RARITY_ORDER,
    getCardStatsAtLevel, towerStats, normalizeDeck,
    createMatch, step, deploy, canDeploy, explainTargeting, canDeployOnSnapshot, inDeployZone, snapshot, takeFx, timeLeft,
    isRiverPoint, walkablePoint: (state, x, y, jump) => walkablePoint(state.nav, x, y, jump),
    findPath, enemyOf,
    createAi, aiUpdate, aiDecide, buildAiDeck, aiEvoPicks, assessThreats, foeCycle, foeModel, AI_EVAL,
    TOKEN_CARDS, MAX_ARENA,
    EVOLUTIONS, EVO_RULES, evolutionOf, evoReady, evolvedStats,
    CHAOS_UPGRADES, CHAOS_UPGRADE_MAP, CHAOS_POOL, UPGRADE_RARITIES, UPGRADE_RARITY_ORDER, upgradesFor, validateUpgrades, upgradedStats,
    chooseUpgrade, choicePaused, chaosDebug, makeOffers, scoreUpgrade,
    DEFAULT_RULES, normalizeRules, MODIFIERS, MOD_STACK, MOD_CAPS, combineModFx, playCost, SIZE_FORMS, cardMatches, applyCardMods,
  };
});
