'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = http.createServer(app);

const ALLOWED_ORIGINS = [
  'https://caleb-liu.com',
  'https://www.caleb-liu.com',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5501',
  'http://127.0.0.1:5501',
  'http://localhost:8765',
  'http://127.0.0.1:8765',
  'null', // file:// protocol sends null origin
];

const io = new Server(httpServer, {
  cors: {
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true);
      else cb(null, true); // allow all for now during development
    },
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3001;

// Health check endpoint for Render / uptime monitors
app.get('/', (_req, res) => res.send('Clash Tanks server OK'));
app.get('/health', (_req, res) => res.json({ status: 'ok', rooms: rooms.size }));

// ─── Card data (copied from prototype_v4.js — keep in sync) ───────────────

const BOARD = {
  laneCount: 3,
  laneHeight: 100,
  spawnA: 6,
  spawnB: 94,
  towerX: { A: 24, B: 76 },
  baseX: { A: 2, B: 98 }
};


const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'champion'];
const RARITY_STYLE = {
  common: { label: 'Common', color: '#88c7ff', copies: 1, gold: 55 },
  rare: { label: 'Rare', color: '#63ffd2', copies: 2, gold: 85 },
  epic: { label: 'Epic', color: '#ffb36c', copies: 3, gold: 130 },
  legendary: { label: 'Legendary', color: '#ffd35f', copies: 5, gold: 210 },
  champion: { label: 'Champion', color: '#ff728f', copies: 7, gold: 300 }
};

const ARCHETYPES = [
  { slug: 'scout', name: 'Scout', icon: '🏎️', rarity: 'common', cost: 2, hp: 58, dmg: 11, range: 8, speed: 27, cd: 0.52, structureMult: 0.9, deployCd: 1.0, style: 'single', proj: 'slug', role: 'flank', winCondition: true,
    ability: { name: 'Turbo Drive', minLevel: 5, minMastery: 10, dmgBoost: 1.08, hpBoost: 1.07 } },
  { slug: 'brawler', name: 'Brawler', icon: '🚛', rarity: 'common', cost: 4, hp: 146, dmg: 18, range: 9, speed: 13, cd: 0.78, structureMult: 1, deployCd: 1.15, style: 'single', proj: 'slug', role: 'tank',
    ability: { name: 'Iron Shell', minLevel: 6, minMastery: 12, dmgBoost: 1.05, hpBoost: 1.12 } },
  { slug: 'siege', name: 'Siege', icon: '🛞', rarity: 'rare', cost: 6, hp: 98, dmg: 38, range: 18, speed: 8, cd: 1.2, structureMult: 1.6, deployCd: 1.45, style: 'single', proj: 'shell', role: 'siege', winCondition: true,
    ability: { name: 'Heavy Payload', minLevel: 6, minMastery: 12, dmgBoost: 1.14, hpBoost: 1.05 } },
  { slug: 'guardian', name: 'Guardian', icon: '🛡️', rarity: 'rare', cost: 5, hp: 124, dmg: 10, range: 10, speed: 10, cd: 0.9, structureMult: 1, deployCd: 1.25, style: 'single', proj: 'pulse', role: 'aura',
    ability: { name: 'Forcefield', minLevel: 5, minMastery: 10, dmgBoost: 1.07, hpBoost: 1.14 } },
  { slug: 'voltbug', name: 'Volt Bug', icon: '⚡', rarity: 'common', cost: 3, hp: 82, dmg: 12, range: 10, speed: 22, cd: 0.66, structureMult: 1, deployCd: 1.0, style: 'double', proj: 'spark', role: 'chain',
    ability: { name: 'Static Burst', minLevel: 5, minMastery: 10, dmgBoost: 1.12, hpBoost: 1.05 } },
  { slug: 'flarepod', name: 'Flare Pod', icon: '🔥', rarity: 'epic', cost: 4, hp: 84, dmg: 13, range: 16, speed: 11, cd: 0.82, structureMult: 1.1, deployCd: 1.2, style: 'splash', proj: 'flare', role: 'burn',
    ability: { name: 'Inferno Surge', minLevel: 6, minMastery: 12, dmgBoost: 1.12, hpBoost: 1.07 } },
  { slug: 'drillcat', name: 'Drill Cat', icon: '🚜', rarity: 'rare', cost: 4, hp: 134, dmg: 21, range: 7, speed: 12, cd: 0.8, structureMult: 1.25, deployCd: 1.15, style: 'single', proj: 'drill', role: 'breaker',
    ability: { name: 'Diamond Drill', minLevel: 6, minMastery: 12, dmgBoost: 1.14, hpBoost: 1.06 } },
  { slug: 'raylance', name: 'Ray Lance', icon: '💠', rarity: 'legendary', cost: 5, hp: 100, dmg: 16, range: 15, speed: 12, cd: 0.62, structureMult: 1, deployCd: 1.35, style: 'beam', proj: 'beam', role: 'sniper',
    ability: { name: 'Overcharge', minLevel: 7, minMastery: 15, dmgBoost: 1.16, hpBoost: 1.05 } },
  { slug: 'mortarfox', name: 'Mortar Fox', icon: '🧨', rarity: 'epic', cost: 6, hp: 96, dmg: 34, range: 20, speed: 7, cd: 1.32, structureMult: 1.55, deployCd: 1.65, style: 'splash', proj: 'mortar', role: 'artillery', winCondition: true,
    ability: { name: 'Barrage Mode', minLevel: 7, minMastery: 15, dmgBoost: 1.14, hpBoost: 1.07 } },
  { slug: 'ramhog', name: 'Ram Hog', icon: '🐗', rarity: 'rare', cost: 5, hp: 128, dmg: 24, range: 8, speed: 15, cd: 0.9, structureMult: 1.2, deployCd: 1.18, style: 'burst', proj: 'ram', role: 'charge', winCondition: true,
    ability: { name: 'Rampage', minLevel: 7, minMastery: 15, dmgBoost: 1.16, hpBoost: 1.08 } },
  // ── Swarm archetypes ──────────────────────────────────────────────────────
  { slug: 'junkpack', name: 'Junk Pack', icon: '🔧', rarity: 'common', cost: 3, hp: 120, dmg: 27, range: 7, speed: 18, cd: 0.6, structureMult: 0.8, deployCd: 1.1, style: 'single', proj: 'slug', role: 'swarm', swarmCount: 3,
    ability: { name: 'Mob Rush', minLevel: 5, minMastery: 10, dmgBoost: 1.1, hpBoost: 1.08 } },
  { slug: 'bugsquad', name: 'Bug Squad', icon: '🐛', rarity: 'rare', cost: 4, hp: 160, dmg: 36, range: 9, speed: 22, cd: 0.55, structureMult: 0.9, deployCd: 1.2, style: 'double', proj: 'spark', role: 'swarm', swarmCount: 4,
    ability: { name: 'Hive Mind', minLevel: 6, minMastery: 12, dmgBoost: 1.12, hpBoost: 1.1 } },
  { slug: 'mechmice', name: 'Mech Mice', icon: '🐭', rarity: 'common', cost: 2, hp: 84, dmg: 18, range: 7, speed: 24, cd: 0.65, structureMult: 0.85, deployCd: 0.95, style: 'single', proj: 'slug', role: 'swarm', swarmCount: 2,
    ability: { name: 'Scuttle', minLevel: 5, minMastery: 10, dmgBoost: 1.08, hpBoost: 1.1 } },
  { slug: 'goblinbikers', name: 'Goblin Bikers', icon: '🏍️', rarity: 'epic', cost: 5, hp: 200, dmg: 55, range: 8, speed: 26, cd: 0.5, structureMult: 1.0, deployCd: 1.3, style: 'single', proj: 'slug', role: 'swarm', swarmCount: 5, winCondition: true,
    ability: { name: 'Turbo Gang', minLevel: 7, minMastery: 15, dmgBoost: 1.12, hpBoost: 1.1 } },
  { slug: 'nanodrones', name: 'Nano Drones', icon: '🤖', rarity: 'rare', cost: 4, hp: 135, dmg: 33, range: 13, speed: 18, cd: 0.6, structureMult: 1.0, deployCd: 1.2, style: 'double', proj: 'spark', role: 'swarm', swarmCount: 3,
    ability: { name: 'Network Link', minLevel: 6, minMastery: 12, dmgBoost: 1.1, hpBoost: 1.08 } },
  { slug: 'bombbeetles', name: 'Bomb Beetles', icon: '💣', rarity: 'legendary', cost: 6, hp: 240, dmg: 84, range: 8, speed: 14, cd: 0.7, structureMult: 1.2, deployCd: 1.5, style: 'splash', proj: 'shell', role: 'swarm', swarmCount: 6,
    ability: { name: 'Chain Detonation', minLevel: 7, minMastery: 15, dmgBoost: 1.16, hpBoost: 1.08 } },
  { slug: 'antmarch', name: 'Ant March', icon: '🐜', rarity: 'common', cost: 2, hp: 72, dmg: 15, range: 7, speed: 22, cd: 0.7, structureMult: 0.8, deployCd: 0.9, style: 'single', proj: 'slug', role: 'swarm', swarmCount: 3,
    ability: { name: 'Column Charge', minLevel: 5, minMastery: 10, dmgBoost: 1.08, hpBoost: 1.1 } },
  { slug: 'crickethop', name: 'Cricket Hop', icon: '🦗', rarity: 'common', cost: 2, hp: 88, dmg: 20, range: 8, speed: 30, cd: 0.6, structureMult: 0.85, deployCd: 0.95, style: 'single', proj: 'slug', role: 'swarm', swarmCount: 2,
    ability: { name: 'Leap Spring', minLevel: 5, minMastery: 10, dmgBoost: 1.09, hpBoost: 1.09 } },
  { slug: 'beeblitz', name: 'Bee Blitz', icon: '🐝', rarity: 'common', cost: 3, hp: 100, dmg: 20, range: 9, speed: 24, cd: 0.65, structureMult: 0.85, deployCd: 1.0, style: 'double', proj: 'spark', role: 'swarm', swarmCount: 4,
    ability: { name: 'Sting Flurry', minLevel: 5, minMastery: 10, dmgBoost: 1.1, hpBoost: 1.07 } },
  { slug: 'scrapbots', name: 'Scrap Bots', icon: '🪲', rarity: 'common', cost: 3, hp: 112, dmg: 27, range: 8, speed: 15, cd: 0.75, structureMult: 0.9, deployCd: 1.1, style: 'single', proj: 'slug', role: 'swarm', swarmCount: 3,
    ability: { name: 'Salvage Mode', minLevel: 5, minMastery: 10, dmgBoost: 1.08, hpBoost: 1.12 } },
  { slug: 'lizarddash', name: 'Lizard Dash', icon: '🦎', rarity: 'rare', cost: 3, hp: 108, dmg: 30, range: 7, speed: 28, cd: 0.55, structureMult: 0.9, deployCd: 1.05, style: 'single', proj: 'slug', role: 'swarm', swarmCount: 3,
    ability: { name: 'Cold Blooded', minLevel: 6, minMastery: 12, dmgBoost: 1.12, hpBoost: 1.06 } },
  { slug: 'toadtroop', name: 'Toad Troop', icon: '🐸', rarity: 'rare', cost: 4, hp: 165, dmg: 48, range: 13, speed: 13, cd: 0.85, structureMult: 1.0, deployCd: 1.2, style: 'splash', proj: 'shell', role: 'swarm', swarmCount: 3,
    ability: { name: 'Leapfrog Volley', minLevel: 6, minMastery: 12, dmgBoost: 1.1, hpBoost: 1.1 } },
  { slug: 'wolfpack', name: 'Wolf Pack', icon: '🐺', rarity: 'rare', cost: 5, hp: 192, dmg: 54, range: 8, speed: 25, cd: 0.8, structureMult: 1.0, deployCd: 1.3, style: 'burst', proj: 'slug', role: 'swarm', swarmCount: 3,
    ability: { name: 'Pack Fury', minLevel: 6, minMastery: 12, dmgBoost: 1.14, hpBoost: 1.08 } },
  { slug: 'zombiemob', name: 'Zombie Mob', icon: '🧟', rarity: 'rare', cost: 4, hp: 200, dmg: 30, range: 7, speed: 9, cd: 0.95, structureMult: 1.0, deployCd: 1.2, style: 'single', proj: 'slug', role: 'swarm', swarmCount: 5,
    ability: { name: 'Reanimate', minLevel: 6, minMastery: 12, dmgBoost: 1.07, hpBoost: 1.16 } },
  { slug: 'hawkstrike', name: 'Hawk Strike', icon: '🦅', rarity: 'epic', cost: 4, hp: 126, dmg: 54, range: 11, speed: 24, cd: 0.7, structureMult: 1.1, deployCd: 1.2, style: 'double', proj: 'spark', role: 'swarm', swarmCount: 3, winCondition: true,
    ability: { name: 'Talon Dive', minLevel: 7, minMastery: 15, dmgBoost: 1.14, hpBoost: 1.08 } },
  { slug: 'crackergang', name: 'Cracker Gang', icon: '🧨', rarity: 'epic', cost: 5, hp: 188, dmg: 60, range: 10, speed: 18, cd: 0.7, structureMult: 1.1, deployCd: 1.3, style: 'burst', proj: 'slug', role: 'swarm', swarmCount: 4,
    ability: { name: 'Flashbang', minLevel: 7, minMastery: 15, dmgBoost: 1.12, hpBoost: 1.1 } },
  { slug: 'flybombers', name: 'Fly Bombers', icon: '🪰', rarity: 'epic', cost: 5, hp: 180, dmg: 65, range: 8, speed: 20, cd: 0.6, structureMult: 1.15, deployCd: 1.3, style: 'splash', proj: 'shell', role: 'swarm', swarmCount: 5,
    ability: { name: 'Kamikaze Drop', minLevel: 7, minMastery: 15, dmgBoost: 1.14, hpBoost: 1.06 } },
  { slug: 'rabbitrush', name: 'Rabbit Rush', icon: '🐇', rarity: 'epic', cost: 5, hp: 175, dmg: 50, range: 7, speed: 29, cd: 0.55, structureMult: 1.0, deployCd: 1.25, style: 'single', proj: 'slug', role: 'swarm', swarmCount: 5, winCondition: true,
    ability: { name: 'Burrow Blitz', minLevel: 7, minMastery: 15, dmgBoost: 1.12, hpBoost: 1.1 } },
  { slug: 'ufofleet', name: 'UFO Fleet', icon: '🛸', rarity: 'legendary', cost: 6, hp: 220, dmg: 88, range: 18, speed: 13, cd: 1.0, structureMult: 1.6, deployCd: 1.5, style: 'beam', proj: 'beam', role: 'swarm', swarmCount: 4, winCondition: true,
    ability: { name: 'Abduction Ray', minLevel: 7, minMastery: 15, dmgBoost: 1.16, hpBoost: 1.06 } },
  { slug: 'dustdevils', name: 'Dust Devils', icon: '🌪️', rarity: 'legendary', cost: 6, hp: 180, dmg: 75, range: 15, speed: 22, cd: 0.85, structureMult: 1.1, deployCd: 1.45, style: 'beam', proj: 'beam', role: 'swarm', swarmCount: 3,
    ability: { name: 'Vortex Spin', minLevel: 7, minMastery: 15, dmgBoost: 1.14, hpBoost: 1.1 } },
  { slug: 'makoswarm', name: 'Mako Swarm', icon: '🦈', rarity: 'legendary', cost: 7, hp: 312, dmg: 114, range: 9, speed: 16, cd: 0.8, structureMult: 1.2, deployCd: 1.6, style: 'single', proj: 'slug', role: 'swarm', swarmCount: 6,
    ability: { name: 'Feeding Frenzy', minLevel: 7, minMastery: 15, dmgBoost: 1.18, hpBoost: 1.1 } }
];

const VARIANTS = [
  { suffix: 'Mk-I', hp: 0, dmg: 0, range: 0, speed: 0, cost: 0, cd: 0, deployCd: 0, rarityShift: 0, style: null },
  { suffix: 'Mk-II', hp: 8, dmg: 2, range: 1, speed: 1, cost: 0, cd: -0.03, deployCd: -0.05, rarityShift: 0, style: null },
  { suffix: 'Twin', hp: -4, dmg: 3, range: 2, speed: -1, cost: 1, cd: 0.02, deployCd: 0.03, rarityShift: 1, style: 'double' },
  { suffix: 'Burst', hp: -7, dmg: 4, range: 0, speed: 0, cost: 1, cd: -0.08, deployCd: -0.08, rarityShift: 1, style: 'burst' },
  { suffix: 'Core', hp: 14, dmg: 6, range: 1, speed: -2, cost: 1, cd: 0.08, deployCd: 0.08, rarityShift: 2, style: 'splash' }
];

function rarityShift(base, shift) {
  const i = RARITY_ORDER.indexOf(base);
  return RARITY_ORDER[Math.max(0, Math.min(RARITY_ORDER.length - 1, i + shift))] || base;
}

function buildCards() {
  const cards = [];
  ARCHETYPES.forEach((a) => {
    VARIANTS.forEach((v, idx) => {
      const id = idx === 0 ? a.slug : `${a.slug}-${v.suffix.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      cards.push({
        id,
        name: idx === 0 ? a.name : `${a.name} ${v.suffix}`,
        icon: a.icon,
        rarity: rarityShift(a.rarity, v.rarityShift),
        cost: Math.max(1, Math.min(9, a.cost + v.cost)),
        hp: Math.max(40, a.hp + v.hp),
        dmg: Math.max(6, a.dmg + v.dmg),
        range: Math.max(6, a.range + v.range),
        speed: Math.max(5, a.speed + v.speed),
        cd: Math.max(0.45, a.cd + v.cd),
        deployCd: Math.max(0.7, a.deployCd + v.deployCd),
        structureMult: a.structureMult,
        style: v.style || a.style,
        proj: a.proj,
        role: a.role,
        splash: (v.style === 'splash' || a.style === 'splash') ? 5 : 0,
        winCondition: a.winCondition || false,
        swarmCount: a.swarmCount || 1,
        ability: a.ability
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
    hpScaled: Math.round(card.hp * scale * (abilityReady ? card.ability.hpBoost : 1)),
    dmgScaled: +(card.dmg * scale * (abilityReady ? card.ability.dmgBoost : 1)).toFixed(2),
    deployCdScaled: Math.max(0.62, card.deployCd - (lvl - 1) * 0.02),
    abilityReady
  };
}

const TICK_MS = 1000 / 20; // 20 ticks per second

// ─── Room registry ─────────────────────────────────────────────────────────

const rooms = new Map();     // code → room
const socketRoom = new Map(); // socketId → code

// ─── Matchmaking ───────────────────────────────────────────────────────────

const matchQueue = new Set(); // socketIds, in the order they joined

function addToMatchQueue(socketId) {
  matchQueue.add(socketId);
  console.log(`[Queue] ${socketId} added. Queue size: ${matchQueue.size}`);
}

function removeFromMatchQueue(socketId) {
  matchQueue.delete(socketId);
}

// Pair players first-come, first-served as soon as two are waiting
function runMatchmaker() {
  for (const id of matchQueue) {
    if (!io.sockets.sockets.get(id)?.connected) matchQueue.delete(id);
  }
  while (matchQueue.size >= 2) {
    const [a, b] = matchQueue;
    matchQueue.delete(a);
    matchQueue.delete(b);
    startQueueMatch(a, b);
  }
}

function startQueueMatch(idA, idB) {
  const sockA = io.sockets.sockets.get(idA);
  const sockB = io.sockets.sockets.get(idB);
  if (!sockA || !sockB) return;

  const code = generateCode();
  const room = {
    code,
    players: [idA, idB],
    sockets: { A: idA, B: idB },
    state: null,
    interval: null,
    rematchVotes: 0,
  };
  rooms.set(code, room);
  socketRoom.set(idA, code);
  socketRoom.set(idB, code);
  sockA.join(code);
  sockB.join(code);
  console.log(`[Match] Room ${code}: ${idA} vs ${idB}`);
  sockA.emit('room_joined', { code, side: 'A' });
  sockB.emit('room_joined', { code, side: 'B' });
  io.to(code).emit('match_start', { code });
  startRoom(room);
}



function generateCode() {
  let code;
  do {
    code = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (rooms.has(code));
  return code;
}

// ─── State factory ─────────────────────────────────────────────────────────

// Clean up a deck sent by a client: known cards only, no duplicates, max 8.
// Falls back to the starter deck if nothing valid was sent.
function sanitizeDeck(raw) {
  const out = [];
  const seen = new Set();
  (Array.isArray(raw) ? raw : []).forEach((entry) => {
    if (out.length >= MAX_DECK || !entry) return;
    const id = String(entry.id || '');
    if (!CARD_MAP[id] || seen.has(id)) return;
    seen.add(id);
    out.push({
      id,
      level: clamp(Math.floor(Number(entry.level) || 1), 1, 14),
      abilityUnlocked: !!entry.abilityUnlocked,
      mastery: Math.max(0, Number(entry.mastery) || 0),
    });
  });
  if (out.length === 0) return STARTER_DECK.map((id) => ({ id, level: 1, abilityUnlocked: false, mastery: 0 }));
  return out;
}

function createPlayer(id, deck) {
  const ids = deck.map((c) => c.id);
  const cards = {};
  const cooldowns = {};
  deck.forEach((c) => {
    cards[c.id] = getCardStatsAtLevel(c.id, c.level, c.abilityUnlocked, c.mastery);
    cooldowns[c.id] = 0;
  });
  return {
    id,
    baseHpMax: 1300,
    baseHp: 1300,
    energyMax: 10,
    energy: 10,
    energyRegen: 1.05,
    towerDamage: 13,
    cooldowns,
    cards,
    hand: ids.slice(0, 4),
    handQueue: ids.slice(4),
  };
}

function createState(deckA, deckB) {
  const structures = [];
  for (let lane = 0; lane < BOARD.laneCount; lane++) {
    structures.push({ id: `tower-A-${lane}`, owner: 'A', lane, x: BOARD.towerX.A, hpMax: 320, hp: 320, kind: 'tower', cd: 0 });
    structures.push({ id: `tower-B-${lane}`, owner: 'B', lane, x: BOARD.towerX.B, hpMax: 320, hp: 320, kind: 'tower', cd: 0 });
  }
  structures.push({ id: 'base-A', owner: 'A', lane: 1, x: BOARD.baseX.A, hpMax: 1300, hp: 1300, kind: 'base', cd: 0 });
  structures.push({ id: 'base-B', owner: 'B', lane: 1, x: BOARD.baseX.B, hpMax: 1300, hp: 1300, kind: 'base', cd: 0 });
  return {
    running: true,
    time: 0,
    nextId: 1,
    winner: null,
    units: [],
    structures,
    projectiles: [],
    players: { A: createPlayer('A', deckA), B: createPlayer('B', deckB) },
  };
}

// ─── Simulation (mirrors the local game in prototype_v4.js) ────────────────

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function enemyOf(owner) { return owner === 'A' ? 'B' : 'A'; }
function laneY(lane) { return lane * BOARD.laneHeight + BOARD.laneHeight / 2; }

function livingStructures(state, owner, lane, kind) {
  return state.structures.filter(s =>
    s.owner === owner &&
    s.hp > 0 &&
    (lane == null || s.lane === lane) &&
    (!kind || s.kind === kind)
  );
}

function findUnitTargets(state, u) {
  const foe = enemyOf(u.owner);
  const inRange = state.units
    .filter(x => x.owner === foe && x.lane === u.lane && x.hp > 0)
    .map(x => ({ t: x, d: Math.abs(x.x - u.x) }))
    .filter(x => x.d <= u.range)
    .sort((a, b) => a.d - b.d)
    .map(x => x.t);
  if (inRange.length === 0) return [];
  return u.style === 'double' ? inRange.slice(0, 2) : [inRange[0]];
}

function primaryEnemyStructure(state, unit) {
  const foe = enemyOf(unit.owner);
  const towers = livingStructures(state, foe, unit.lane, 'tower');
  if (towers.length) return towers[0];
  return livingStructures(state, foe, null, 'base')[0] || null;
}

function dealDamage(target, amount) {
  if (!target || target.hp <= 0 || amount <= 0) return;
  target.hp -= amount;
}

function spawnProjectile(state, source, target, damage, targetKind) {
  const sx = source.x;
  const sy = laneY(source.lane) + (source.owner === 'A' ? 12 : -12);
  const tx = target.x;
  const ty = laneY(target.lane ?? source.lane);
  const dx = tx - sx;
  const dy = (ty - sy) / 12;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const speed = source.proj === 'beam' ? 170 : source.proj === 'mortar' ? 66 : 104;
  const ttl = dist / speed;
  state.projectiles.push({
    id: `p-${state.nextId++}`,
    owner: source.owner,
    x: sx,
    y: sy,
    vx: dx / ttl,
    vy: dy / ttl,
    ttl,
    style: source.proj || 'slug',
    damage,
    targetId: target.id,
    targetKind,
    splash: source.splash || 0,
  });
}

function hitProjectile(state, p) {
  const list = p.targetKind === 'unit' ? state.units : state.structures;
  const target = list.find(t => t.id === p.targetId);
  if (!target || target.hp <= 0) return;
  dealDamage(target, p.damage);
  if (p.splash > 0 && target.lane != null) {
    state.units.forEach(u => {
      if (u.hp <= 0 || u.owner !== target.owner || u.id === target.id || u.lane !== target.lane) return;
      if (Math.abs(u.x - target.x) <= p.splash) dealDamage(u, p.damage * 0.55);
    });
  }
}

function cycleHand(p, cardId) {
  if (p.handQueue.length === 0) return;
  const idx = p.hand.indexOf(cardId);
  if (idx < 0) return;
  p.hand[idx] = p.handQueue.shift();
  p.handQueue.push(cardId);
}

function applyDeploy(state, owner, cardId, lane) {
  const p = state.players[owner];
  const card = p && p.cards[cardId];
  if (!card) return false;
  if (!Number.isInteger(lane) || lane < 0 || lane >= BOARD.laneCount) return false;
  if (!p.hand.includes(cardId)) return false;
  if (p.energy < card.cost) return false;
  if ((p.cooldowns[cardId] || 0) > state.time) return false;

  p.energy -= card.cost;
  p.cooldowns[cardId] = state.time + card.deployCdScaled;

  const count = card.swarmCount || 1;
  // Each swarm unit is proportionally weaker so total value equals one normal unit
  const hpPer = Math.max(10, Math.round(card.hpScaled / count));
  const dmgPer = Math.max(1, +(card.dmgScaled / count).toFixed(2));
  const spawnX = owner === 'A' ? BOARD.spawnA : BOARD.spawnB;
  for (let i = 0; i < count; i++) {
    const xOffset = count > 1 ? (i - (count - 1) / 2) * 1.2 : 0;
    state.units.push({
      id: `u-${state.nextId++}`,
      owner,
      lane,
      cardId,
      hp: hpPer,
      hpMax: hpPer,
      dmg: dmgPer,
      range: card.range,
      speed: card.speed,
      cd: card.cd,
      atkCd: i * 0.08,
      x: spawnX + xOffset,
      style: card.style,
      proj: card.proj,
      splash: card.splash,
      structureMult: card.structureMult,
      winCondition: card.winCondition || false,
    });
  }
  cycleHand(p, cardId);
  return true;
}

function tick(state, dt) {
  if (!state.running) return;
  state.time += dt;

  ['A', 'B'].forEach(id => {
    const p = state.players[id];
    p.energy = clamp(p.energy + p.energyRegen * dt, 0, p.energyMax);
  });

  // Win conditions ignore enemy units and march straight for structures.
  // All other cards fight enemy units first, then advance on structures.
  state.units.forEach(u => {
    if (u.hp <= 0) return;
    u.atkCd -= dt;
    if (!u.winCondition) {
      const targets = findUnitTargets(state, u);
      if (targets.length > 0) {
        if (u.atkCd <= 0) {
          targets.forEach(t => spawnProjectile(state, u, t, u.dmg, 'unit'));
          if (u.style === 'burst') spawnProjectile(state, u, targets[0], u.dmg * 0.45, 'unit');
          u.atkCd = u.cd;
        }
        return;
      }
    }
    const structure = primaryEnemyStructure(state, u);
    if (!structure) return;
    const dist = Math.abs(structure.x - u.x);
    if (dist <= u.range) {
      if (u.atkCd <= 0) {
        spawnProjectile(state, u, structure, u.dmg * u.structureMult, 'structure');
        u.atkCd = u.cd;
      }
    } else {
      u.x += (u.owner === 'A' ? 1 : -1) * u.speed * dt;
    }
  });
  state.units = state.units.filter(u => u.hp > 0 && u.x >= -3 && u.x <= 103);

  state.structures.forEach(s => {
    if (s.hp <= 0) return;
    s.cd -= dt;
    const foe = enemyOf(s.owner);
    const range = s.kind === 'base' ? 14 : 22;
    const dmg = s.kind === 'base' ? 17 : state.players[s.owner].towerDamage;
    let target = null;
    let best = Infinity;
    state.units.forEach(u => {
      if (u.owner !== foe || u.lane !== s.lane || u.hp <= 0) return;
      const d = Math.abs(u.x - s.x);
      if (d <= range && d < best) { target = u; best = d; }
    });
    if (target && s.cd <= 0) {
      spawnProjectile(state, { id: s.id, owner: s.owner, lane: s.lane, x: s.x, proj: s.kind === 'base' ? 'pulse' : 'shell', splash: 0 }, target, dmg, 'unit');
      s.cd = s.kind === 'base' ? 0.72 : 0.9;
    }
  });

  state.projectiles.forEach(p => {
    p.ttl -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.ttl <= 0) hitProjectile(state, p);
  });
  state.projectiles = state.projectiles.filter(p => p.ttl > 0);
  state.units = state.units.filter(u => u.hp > 0);

  state.structures.forEach(s => { if (s.hp < 0) s.hp = 0; });
  const baseA = state.structures.find(s => s.id === 'base-A');
  const baseB = state.structures.find(s => s.id === 'base-B');
  state.players.A.baseHp = baseA ? Math.max(0, baseA.hp) : 0;
  state.players.B.baseHp = baseB ? Math.max(0, baseB.hp) : 0;

  if (!state.winner) {
    if (state.players.A.baseHp <= 0) state.winner = 'B';
    if (state.players.B.baseHp <= 0) state.winner = 'A';
  }
  if (state.winner) state.running = false;
}

// ─── Client state builder ──────────────────────────────────────────────────

const r2 = v => Math.round(v * 100) / 100; // trims payload size

function buildClientState(state) {
  const player = (p) => {
    const cooldownsRemaining = {};
    Object.keys(p.cooldowns).forEach(k => { cooldownsRemaining[k] = r2(Math.max(0, p.cooldowns[k] - state.time)); });
    return {
      energy: r2(p.energy),
      energyMax: p.energyMax,
      baseHp: r2(p.baseHp),
      baseHpMax: p.baseHpMax,
      hand: p.hand,
      next: p.handQueue[0] || null,
      cooldownsRemaining,
    };
  };
  return {
    time: r2(state.time),
    running: state.running,
    winner: state.winner,
    units: state.units.map(u => ({
      id: u.id, owner: u.owner, lane: u.lane, cardId: u.cardId,
      hp: r2(u.hp), hpMax: u.hpMax, x: r2(u.x),
    })),
    projectiles: state.projectiles.map(p => ({
      id: p.id, owner: p.owner, style: p.style, x: r2(p.x), y: r2(p.y),
    })),
    structures: state.structures.map(s => ({
      id: s.id, owner: s.owner, lane: s.lane, x: s.x,
      hp: r2(s.hp), hpMax: s.hpMax, kind: s.kind,
    })),
    players: { A: player(state.players.A), B: player(state.players.B) },
  };
}


// ─── Room lifecycle ────────────────────────────────────────────────────────

// Each player's deck is stored on their socket when they create/join a room or queue
function deckOf(socketId) {
  return io.sockets.sockets.get(socketId)?.data.deck || sanitizeDeck(null);
}

function startRoom(room) {
  if (room.interval) clearInterval(room.interval);
  room.state = createState(deckOf(room.sockets.A), deckOf(room.sockets.B));
  room.lastTick = Date.now();
  room.rematchVotes = 0;
  room.interval = setInterval(() => {
    const now = Date.now();
    const dt = clamp((now - room.lastTick) / 1000, 0, 0.06);
    room.lastTick = now;
    tick(room.state, dt);
    io.to(room.code).emit('state_update', buildClientState(room.state));
    if (!room.state.running && room.state.winner) {
      io.to(room.code).emit('match_over', { winner: room.state.winner });
      clearInterval(room.interval);
      room.interval = null;
    }
  }, TICK_MS);
}

function destroyRoom(code) {
  const room = rooms.get(code);
  if (!room) return;
  if (room.interval) clearInterval(room.interval);
  rooms.delete(code);
  console.log(`Room ${code} destroyed`);
}

function leaveCurrentRoom(socket) {
  const old = socketRoom.get(socket.id);
  if (!old) return;
  const room = rooms.get(old);
  if (room) {
    room.players = room.players.filter(id => id !== socket.id);
    if (room.players.length === 0) destroyRoom(old);
  }
  socket.leave(old);
  socketRoom.delete(socket.id);
}

// ─── Socket.io handlers ────────────────────────────────────────────────────

io.on('connection', socket => {
  console.log(`connect  ${socket.id}`);

  socket.on('create_room', ({ deck } = {}) => {
    socket.data.deck = sanitizeDeck(deck);
    leaveCurrentRoom(socket);
    const code = generateCode();
    const room = {
      code,
      players: [socket.id],
      sockets: { A: socket.id, B: null },
      state: null,
      interval: null,
      rematchVotes: 0,
    };
    rooms.set(code, room);
    socketRoom.set(socket.id, code);
    socket.join(code);
    socket.emit('room_created', { code, side: 'A' });
    console.log(`Room ${code} created by ${socket.id}`);
  });

  socket.on('join_room', ({ code, deck } = {}) => {
    const upper = String(code || '').toUpperCase().trim();
    const room = rooms.get(upper);
    if (!room) { socket.emit('room_error', { msg: 'Room not found. Check your code.' }); return; }
    if (room.players.length >= 2) { socket.emit('room_error', { msg: 'Room is full.' }); return; }
    socket.data.deck = sanitizeDeck(deck);
    leaveCurrentRoom(socket);
    room.players.push(socket.id);
    room.sockets.B = socket.id;
    socketRoom.set(socket.id, upper);
    socket.join(upper);
    socket.emit('room_joined', { code: upper, side: 'B' });
    io.to(upper).emit('match_start', { code: upper });
    startRoom(room);
    console.log(`Room ${upper} started`);
  });

  socket.on('deploy', ({ unit, lane } = {}) => {
    const code = socketRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room || !room.state || !room.state.running) return;
    const side = room.sockets.A === socket.id ? 'A' : 'B';
    applyDeploy(room.state, side, String(unit), Number(lane)); // validates card, lane, energy
  });

  socket.on('rematch', () => {
    const code = socketRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room || room.players.length < 2 || room.state?.running) return;
    room.rematchVotes = (room.rematchVotes || 0) + 1;
    if (room.rematchVotes >= 2) {
      room.rematchVotes = 0;
      io.to(code).emit('match_start', { code });
      startRoom(room);
    } else {
      socket.emit('rematch_waiting', {});
    }
  });

  socket.on('join_queue', ({ deck } = {}) => {
    socket.data.deck = sanitizeDeck(deck);
    leaveCurrentRoom(socket);
    addToMatchQueue(socket.id);
    socket.emit('queue_waiting', {});
    runMatchmaker(); // match right away if someone is already waiting
  });

  socket.on('leave_queue', () => {
    removeFromMatchQueue(socket.id);
    socket.emit('queue_left', {});
  });

  socket.on('disconnect', () => {
    console.log(`disconnect ${socket.id}`);
    // Remove from matchmaking queue
    removeFromMatchQueue(socket.id);
    const code = socketRoom.get(socket.id);
    if (code) {
      const room = rooms.get(code);
      if (room) {
        if (room.state?.running) {
          room.state.running = false;
          io.to(code).emit('opponent_left', {});
        }
        destroyRoom(code);
      }
      socketRoom.delete(socket.id);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Clash Tanks server running on :${PORT}`);
});
