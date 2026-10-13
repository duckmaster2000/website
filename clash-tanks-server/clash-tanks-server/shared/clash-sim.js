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

  const PROJ_SPEED = { slug: 13, spark: 15, shell: 10, mortar: 6, beam: 26, flare: 11, arrow: 15, bolt: 13, pulse: 12, firebomb: 15, rocket: 17 };

  // Emotes: ids only (the art lives in the browser). Rate limits keep them fun, not spammy.
  const EMOTE_IDS = ['laugh', 'thumbs', 'cry', 'angry', 'surprised', 'celebrate', 'facepalm', 'cool', 'gg', 'king'];
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
    { slug: 'crackergang', name: 'Cracker Gang', icon: '🧨', rarity: 'epic', cost: 5, role: 'ranged gang', count: 4, hp: 120, dmg: 45, cd: 1.4, range: 4.5, speed: 1.25, targets: 'any', proj: 'slug', radius: 0.38, deployCd: 1.3,
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
  ];

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

  function buildCards() {
    const cards = [];
    ARCHETYPES.forEach((a) => {
      VARIANTS.forEach((v, idx) => {
        if (a.spell && idx > 0) return; // spells come in one version only
        const id = idx === 0 ? a.slug : `${a.slug}-${v.suffix.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        const style = v.style || a.style || 'single';
        const melee = a.proj === 'melee';
        cards.push({
          id,
          slug: a.slug,
          name: idx === 0 ? a.name : `${a.name} ${v.suffix}`,
          icon: a.icon,
          rarity: rarityShift(a.rarity, v.rarityShift),
          cost: clamp(a.cost + v.cost, 1, 9),
          hp: Math.round(a.hp * v.hp),
          dmg: Math.round(a.dmg * v.dmg),
          cd: r2(Math.max(0.5, a.cd * v.cd)),
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
          deployCd: Math.max(0.7, a.deployCd + v.deployCd),
          winCondition: a.targets === 'buildings',
          ability: a.ability,
          spell: !!a.spell,
          towerMult: a.towerMult || 1,
          knockback: a.knockback || 0,
          stun: a.stun || 0,
          waves: a.waves || 1,
        });
      });
    });
    return cards;
  }

  const CARD_LIBRARY = buildCards();
  const CARD_MAP = Object.fromEntries(CARD_LIBRARY.map((c) => [c.id, c]));
  const STARTER_DECK = ['scout', 'brawler', 'siege', 'guardian', 'voltbug', 'drillcat', 'ramhog', 'flarepod'];
  const MAX_DECK = 8;

  function getCardStatsAtLevel(id, level, abilityUnlocked, mastery) {
    const card = CARD_MAP[id];
    if (!card) return null;
    const lvl = clamp(level || 1, 1, 14);
    const scale = 1 + (lvl - 1) * 0.075;
    const abilityReady = !!abilityUnlocked && lvl >= card.ability.minLevel && (mastery || 0) >= card.ability.minMastery;
    return {
      ...card,
      level: lvl,
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
  function normalizeDeck(raw) {
    const out = [];
    const seen = new Set();
    (Array.isArray(raw) ? raw : []).forEach((entry) => {
      if (out.length >= MAX_DECK || !entry) return;
      const e = typeof entry === 'string' ? { id: entry } : entry;
      const id = String(e.id || '');
      if (!CARD_MAP[id] || seen.has(id)) return;
      seen.add(id);
      out.push({
        id,
        level: clamp(Math.floor(Number(e.level) || 1), 1, 14),
        abilityUnlocked: !!e.abilityUnlocked,
        mastery: Math.max(0, Number(e.mastery) || 0),
      });
    });
    if (out.length === 0) return STARTER_DECK.map((id) => ({ id, level: 1, abilityUnlocked: false, mastery: 0 }));
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
    deck.forEach((c) => {
      cards[c.id] = getCardStatsAtLevel(c.id, c.level, c.abilityUnlocked, c.mastery);
      cooldowns[c.id] = 0;
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
      emoteLog: [],
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
    if (!inDeployZone(state, side, x, y, card)) return false;
    return walkablePoint(state.nav, x, y, false);
  }

  // Same rules as canDeploy, checked against a snapshot. Online clients use this for the
  // placement preview; the server still makes the final call.
  function canDeployOnSnapshot(snap, side, x, y, card) {
    if (!snap || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (x < 0.5 || x > W - 0.5 || y < 0.5 || y > H - 0.5) return false;
    if (card && card.spell) return true;
    const own = side === 'A' ? y >= RIVER.y1 + 0.5 : y <= RIVER.y0 - 0.5;
    if (!own) {
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
    };
    state.units.push(u);
    state.byId.set(u.id, u);
    return u;
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

    if (stats.spell) {
      castSpell(state, side, stats, px, py);
      cycleHand(p, cardId);
      pushFx(state, { type: 'cast', x: px, y: py, owner: side, r: stats.splash, cardId, cost: stats.cost });
      return { ok: true, units: [] };
    }

    const count = stats.swarmCount || 1;
    const units = [];
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
      units.push(spawnUnit(state, side, stats, clamp(sx, 0.4, W - 0.4), clamp(sy, 0.4, H - 0.4), MATCH.deployTime + i * 0.05, stats.cost / count));
    }
    if (stats.building) rebuildObstacles(state);
    cycleHand(p, cardId);
    pushFx(state, { type: 'deploy', x: px, y: py, owner: side, r: count > 1 ? 1.4 : 1, cardId, cost: stats.cost });
    return { ok: true, units };
  }

  // ─── Spells ──────────────────────────────────────────────────────────────

  function spellSpec(stats) {
    return { kind: stats.proj, towerMult: stats.towerMult, knockback: stats.knockback, stun: stats.stun, cost: stats.cost };
  }

  function castSpell(state, side, stats, x, y) {
    const spec = spellSpec(stats);
    const waves = stats.waves || 1;
    const dmg = stats.dmgScaled / waves;
    if (stats.proj === 'shock') {
      applySpell(state, side, spec, x, y, stats.splash, dmg);
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

  // Damage (and knock back / stun) every enemy in the radius. Crown towers take reduced damage.
  function applySpell(state, owner, spec, x, y, radius, dmg) {
    const hit = [];
    queryHash(state, x, y, radius, (e) => {
      if (e.hp <= 0 || e.owner === owner) return;
      const gap = e.kind === 'tower' ? boxDist(x, y, e) : dist(x, y, e.x, e.y) - e.radius;
      if (gap <= radius) hit.push(e);
    });
    const src = { id: null, owner, structureMult: 1 };
    for (const e of hit) {
      applyDamage(state, src, e, e.kind === 'tower' ? dmg * spec.towerMult : dmg);
      if (spec.stun > 0) {
        e.stunT = Math.max(e.stunT || 0, spec.stun);
        e.windupT = 0;
        if (e.kind === 'troop') { e.charging = false; e.runDist = 0; }
      }
      if (spec.knockback > 0 && e.kind === 'troop' && e.hp > 0) knockBack(state, e, x, y, spec.knockback * (1 - 0.4 * Math.min(1, dist(x, y, e.x, e.y) / radius)));
    }
    pushFx(state, { type: 'spell', kind: spec.kind, x, y, r: radius, owner });
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
  function acquireTarget(state, u, radius) {
    let best = null;
    let bestScore = Infinity;
    queryHash(state, u.x, u.y, radius, (e) => {
      if (!canTarget(u, e)) return;
      const d = edgeDist(u, e);
      if (d > radius) return;
      if (u.minRange && dist(u.x, u.y, e.x, e.y) < u.minRange) return;
      // Prefer whoever is hitting us or our allies
      const score = d - (e.id === u.lastAttackerId ? 1 : 0);
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
      const candidate = seen || (u.building ? null : defaultTarget(state, u));
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
    let amt = amount;
    if (target.kind !== 'troop') amt *= source.structureMult || 1;
    if (target.kind === 'troop' && auraProtected(state, target)) amt *= 0.75;
    target.hp -= amt;
    target.hitT = state.time;
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

  function splashDamage(state, source, x, y, radius, amount, canHitAir) {
    const hit = [];
    queryHash(state, x, y, radius, (e) => {
      if (e.hp <= 0 || e.owner === source.owner) return;
      if (e.air && !canHitAir) return;
      const gap = e.kind === 'tower' ? boxDist(x, y, e) : dist(x, y, e.x, e.y) - e.radius;
      if (gap <= radius) hit.push(e);
    });
    hit.forEach((e) => applyDamage(state, source, e, amount));
    pushFx(state, { type: 'splash', x, y, r: radius, owner: source.owner });
  }

  function damageSource(u) {
    return { id: u.id, owner: u.owner, structureMult: u.structureMult };
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
      canHitAir: shooter.kind === 'tower' || shooter.targets === 'any',
      chain: !!o.chain,
      delay: o.delay || 0,
    });
  }

  // The moment an attack lands (end of wind-up). Melee hits instantly; ranged fires a projectile.
  function fireAttack(state, u, t) {
    let dmg = u.dmg;
    let heavy = false;
    if (u.charging) { dmg *= 2; heavy = true; u.charging = false; u.runDist = 0; pushFx(state, { type: 'charge', x: t.x, y: t.y, owner: u.owner }); }
    u.lastAtkT = state.time;
    const src = damageSource(u);
    const canHitAir = u.targets === 'any';

    if (u.proj === 'melee') {
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
      if (u.style === 'double') {
        const second = secondTarget(state, u, t);
        if (second) applyDamage(state, src, second, dmg);
      }
      if (u.style === 'burst') applyDamage(state, src, t, dmg * 0.45);
      return;
    }

    launchProjectile(state, u, t, dmg, { chain: u.special.includes('chain') });
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
    return Math.min(0.3, u.cd * 0.3);
  }

  // ─── Unit update ─────────────────────────────────────────────────────────

  function updateUnit(state, u, dt) {
    u.px = u.x;
    u.py = u.y;
    if (u.hp <= 0) return;
    if (u.deployT > 0) { u.deployT -= dt; return; }

    if (u.building && u.lifetime > 0) {
      u.hp -= (u.hpMax / u.lifetime) * dt;
      if (u.hp <= 0) return;
    }
    if (u.stunT > 0) {
      u.stunT -= dt;
      u.vx = 0;
      u.vy = 0;
      u.windupT = 0;
      return;
    }

    u.atkCd -= dt;
    const t = updateTargeting(state, u, dt);

    if (u.windupT > 0) {
      // Wind-up can only be cancelled if the target is lost
      if (!t || edgeDist(u, t) > u.range + 0.5) {
        u.windupT = 0;
        return;
      }
      u.windupT -= dt;
      faceToward(u, t.x, t.y, dt);
      if (u.windupT <= 0) fireAttack(state, u, t);
      return;
    }

    if (t && inAttackRange(u, t)) {
      u.vx = 0;
      u.vy = 0;
      u.stuckT = 0;
      faceToward(u, t.x, t.y, dt);
      if (u.atkCd <= 0) {
        u.locked = true;
        u.atkCd = u.cd;
        u.windupT = windupOf(u);
      }
      return;
    }

    if (!u.building && t) moveToward(state, u, t, dt);
  }

  function faceToward(u, x, y, dt) {
    const want = Math.atan2(y - u.y, x - u.x);
    let diff = want - u.face;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    u.face += diff * Math.min(1, dt * 10);
  }

  function moveToward(state, u, t, dt) {
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

    let speed = u.speed;
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
    if (t.stunT > 0) { t.stunT -= dt; return; }
    t.atkCd -= dt;
    if (!t.active) return;
    let target = t.targetId ? state.byId.get(t.targetId) : null;
    const valid = (e) => e && e.hp > 0 && e.owner !== t.owner && e.kind !== 'tower' && dist(t.x, t.y, e.x, e.y) - e.radius <= t.range;
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
        splashDamage(state, p.source, p.tx, p.ty, p.splash, p.dmg, p.canHitAir);
      } else if (t && t.hp > 0) {
        applyDamage(state, p.source, t, p.dmg);
        pushFx(state, { type: 'hit', x: p.tx, y: p.ty, owner: p.owner, style: p.style });
        if (p.chain) chainLightning(state, p, t);
      }
    }
    state.projectiles = state.projectiles.filter((p) => !p.done);
  }

  function chainLightning(state, p, first) {
    const hit = new Set([first.id]);
    let from = first;
    for (let n = 0; n < 2; n++) {
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
      for (const u of state.units) {
        if (u.hp > 0 || u.dead) continue;
        u.dead = true;
        changed = true;
        if (u.building) navDirty = true;
        pushFx(state, { type: 'death', x: u.x, y: u.y, owner: u.owner, air: u.air, big: u.radius >= 0.6 || u.building, cardId: u.cardId });
        if (u.special.includes('deathBomb') && !u.kamikazed) {
          splashDamage(state, damageSource(u), u.x, u.y, 1.5, u.dmg * 0.6, false);
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
      })),
      towers: state.towers.map((t) => ({
        id: t.id, owner: t.owner, tower: t.tower, x: t.x, y: t.y,
        hp: Math.round(Math.max(0, t.hp)), hpMax: t.hpMax, active: t.active, half: t.half,
        atk: since(t.lastAtkT), hit: since(t.hitT), stn: t.stunT > 0 ? 1 : 0,
      })),
      projectiles: state.projectiles.filter((p) => !(p.delay > 0)).map((p) => {
        const total = dist(p.sx, p.sy, p.tx, p.ty) || 1;
        return {
          id: p.id, owner: p.owner, style: p.style,
          x: r2(p.x), y: r2(p.y),
          lob: p.lob ? r2(clamp(1 - dist(p.x, p.y, p.tx, p.ty) / total, 0, 1)) : null,
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
    for (const pr of state.projectiles) {
      if (pr.owner !== foe || !pr.spell) continue;
      const n = idSeq(pr.id);
      if (n <= brain.seenSeq) continue;
      if (n > maxSeq) maxSeq = n;
      if (!(pr.delay > 0.01)) brain.foeElixir -= pr.spell.cost; // first wave only
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
    const value = (list) => list.reduce((s, u) => s + u.costShare * (u.hp / u.hpMax), 0);
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

  function dps(c) { return (c.dmgScaled * (c.swarmCount || 1)) / c.cd; }

  function chooseDefender(state, brain, options, lane) {
    const smart = brain.rand() < brain.profile.strategicChance;
    let best = null;
    let bestScore = -Infinity;
    options.forEach((c) => {
      if (c.targets === 'buildings' || c.spell) return;
      if (lane.ground === 0 && lane.air > 0 && c.targets !== 'any') return; // can't touch pure air
      let s = 0;
      if (smart) {
        if (lane.air > 0 && c.targets === 'any') s += 3;
        if (lane.air > 0 && c.targets !== 'any') s -= 3;
        if (lane.count >= 3 && c.splash > 0) s += 4;
        if (lane.tank && dps(c) >= 120) s += 3;
        if (lane.tank && c.building) s += 3;
        if (lane.count >= 3 && c.swarmCount >= 3 && !c.splash) s -= 1;
        s -= Math.abs(c.cost - lane.threatValue) * 0.6;
      }
      s -= c.cost * 0.25;
      s += brain.rand() * (smart ? 0.8 : 4);
      if (s > bestScore) { bestScore = s; best = c; }
    });
    return best;
  }

  // Best place to cast a spell: lead moving targets by the flight time, value what it would kill
  function planSpell(state, brain, options) {
    const spells = options.filter((c) => c.spell);
    if (!spells.length) return null;
    const side = brain.side;
    const foe = enemyOf(side);
    const smart = brain.rand() < brain.profile.strategicChance;
    const king = state.towers.find((t) => t.owner === side && t.tower === 'king');
    const enemies = state.units.filter((u) => u.owner === foe && u.hp > 0 && u.deployT <= 0.2);
    const enemyTowers = state.towers.filter((t) => t.owner === foe && t.hp > 0);
    let best = null;
    for (const c of spells) {
      const r = c.splash;
      const dmg = c.dmgScaled;
      const towerDmg = dmg * c.towerMult;
      const flight = c.proj === 'shock' ? 0 : (king ? 1 : 0);
      const points = [];
      for (const e of enemies) {
        const t = flight ? dist(king.x, king.y, e.x, e.y) / (PROJ_SPEED[c.proj] || 15) + (c.waves > 1 ? 0.2 : 0) : 0.1;
        points.push({ x: e.x + e.vx * t * 0.8, y: e.y + e.vy * t * 0.8 });
      }
      enemyTowers.forEach((t) => { if (t.hp <= towerDmg) points.push({ x: t.x, y: t.y }); });
      for (const pt of points) {
        let value = 0;
        let count = 0;
        for (const e of enemies) {
          if (dist(pt.x, pt.y, e.x, e.y) - e.radius > r * 0.9) continue;
          count++;
          const unitCost = e.costShare;
          value += e.hp <= dmg ? unitCost * (e.hp / e.hpMax + 0.3) : unitCost * (dmg / e.hpMax) * 0.6;
          if (c.stun && (e.charging || e.windupT > 0 || e.building)) value += 0.4;
        }
        for (const t of enemyTowers) {
          if (boxDist(pt.x, pt.y, t) > r) continue;
          value += t.hp <= towerDmg ? 20 : (towerDmg / t.hpMax) * 8;
        }
        // Prefer clearing threats on our own side of the river
        if (ownHalf(side, pt.y)) value *= 1.15;
        const need = c.cost * (smart ? 1.05 : 1.5);
        if ((count >= 2 || value >= 20) && value >= need && (!best || value - c.cost > best.score)) {
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

    // 0) A spell that pays for itself (or finishes a tower)
    const spell = planSpell(state, brain, options);
    if (spell) return spell;

    // 1) Defend the more dangerous lane if it isn't already covered
    const lanes = [laneSummary(state, side, 0), laneSummary(state, side, 1)];
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
        if (card.building) spot = { x: MID_X, y: side === 'A' ? 21.5 : 10.5 };
        else if (card.range >= 3) spot = { x: laneX, y: toward(side, TOWER_LAYOUT.princessY[side], 2.8) };
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
    const myPush = state.units.filter((u) => u.owner === side && u.hp > 0 && !u.building && (attackLane === 0 ? u.x < MID_X : u.x >= MID_X));
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

    // Support an existing tank that is heading over the river
    if (tank && p.elixir >= 4) {
      const support = troops.filter((c) => c.targets !== 'buildings' && !c.building).sort((a, b) => (b.splash > 0) - (a.splash > 0) || b.range - a.range)[0];
      if (support) {
        const spot = findDeploySpot(state, side, support, tank.x, ownHalf(side, tank.y) ? toward(side, tank.y, 2) : bridgeY);
        if (spot) return { cardId: support.id, x: spot.x, y: spot.y };
      }
    }
    if (!wantsPush) return null;

    const winCons = troops.filter((c) => !c.building && (c.winCondition || c.hpScaled >= 600)).sort((a, b) => b.cost - a.cost);
    if (winCons.length && !tank) {
      const c = winCons[0];
      // Slow tanks start at the back to build elixir behind them; fast ones go straight to the bridge
      const spot = c.speed <= 1.0
        ? findDeploySpot(state, side, c, laneX, side === 'A' ? H - 1.2 : 1.2)
        : findDeploySpot(state, side, c, BRIDGES[attackLane].cx, bridgeY);
      if (spot) return { cardId: c.id, x: spot.x, y: spot.y };
    }
    if (leaking) {
      // Avoid wasting elixir: cycle the cheapest non-building card at the back
      const cheap = troops.filter((c) => !c.building).sort((a, b) => a.cost - b.cost)[0];
      if (cheap) {
        const spot = findDeploySpot(state, side, cheap, cheap.targets === 'buildings' ? BRIDGES[attackLane].cx : laneX, cheap.targets === 'buildings' ? bridgeY : toward(side, TOWER_LAYOUT.princessY[side], 2.8));
        if (spot) return { cardId: cheap.id, x: spot.x, y: spot.y };
      }
    }
    return null;
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

  return {
    W, H, MID_X, RIVER, BRIDGES, TOWER_LAYOUT, MATCH, NAV_CELL, EMOTE_IDS, EMOTE_RULES,
    emote,
    spawnDirect,
    ARCHETYPES, VARIANTS, CARD_LIBRARY, CARD_MAP, STARTER_DECK, MAX_DECK, RARITY_ORDER,
    getCardStatsAtLevel, towerStats, normalizeDeck,
    createMatch, step, deploy, canDeploy, canDeployOnSnapshot, inDeployZone, snapshot, takeFx, timeLeft,
    isRiverPoint, walkablePoint: (state, x, y, jump) => walkablePoint(state.nav, x, y, jump),
    findPath, enemyOf,
    createAi, aiUpdate, aiDecide,
  };
});
