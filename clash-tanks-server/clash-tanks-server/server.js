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
app.get('/health', (_req, res) => res.json({ status: 'ok', rooms: rooms.size, queues: Object.fromEntries([...queues].map(([k, q]) => [k || 'ranked', q.size])) }));

// ─── Game rules ────────────────────────────────────────────────────────────
// The whole match simulation (arena, cards, combat, towers, clock) is shared with the
// browser, so online matches play exactly like local ones.
const Sim = require('./shared/clash-sim');
// Special events: the server builds every event match itself (rules, modifier schedule, decks)
// from its own seed, so both players always get the same, untampered configuration.
const Events = require('./shared/events');

const TICK_MS = Sim.MATCH.step * 1000; // 20 simulation steps per second

// ─── Room registry ─────────────────────────────────────────────────────────

const rooms = new Map();     // code → room
const socketRoom = new Map(); // socketId → code

// ─── Matchmaking ───────────────────────────────────────────────────────────

// One queue per ruleset: '' is the normal ranked ladder, 'chaos:wild' etc. are event queues.
// Players are only ever paired with someone playing the same event and tier.
const queues = new Map(); // key -> Set of socketIds, in the order they joined
const socketQueue = new Map(); // socketId -> key

function addToMatchQueue(socketId, key) {
  removeFromMatchQueue(socketId);
  if (!queues.has(key)) queues.set(key, new Set());
  queues.get(key).add(socketId);
  socketQueue.set(socketId, key);
  console.log(`[Queue ${key || 'ranked'}] ${socketId} added. Size: ${queues.get(key).size}`);
}

function removeFromMatchQueue(socketId) {
  const key = socketQueue.get(socketId);
  if (key == null) return;
  socketQueue.delete(socketId);
  const q = queues.get(key);
  if (q) { q.delete(socketId); if (q.size === 0) queues.delete(key); }
}

// Pair players first-come, first-served as soon as two are waiting in the same queue
function runMatchmaker(key) {
  const q = queues.get(key);
  if (!q) return;
  for (const id of q) {
    if (!io.sockets.sockets.get(id)?.connected) { q.delete(id); socketQueue.delete(id); }
  }
  while (q.size >= 2) {
    const [a, b] = q;
    q.delete(a); q.delete(b);
    socketQueue.delete(a); socketQueue.delete(b);
    startQueueMatch(a, b, key);
  }
  if (q.size === 0) queues.delete(key);
}

// An event the client asked for, checked on the server: known, playable online, open right now
// (by the server's clock), and a real tier. Returns { eventId, tier } or { error }.
function eventRequest(eventId, tier) {
  if (!eventId) return { event: null };
  const ev = Events.EVENT_MAP[String(eventId)];
  if (!ev || !ev.modes.includes('online')) return { error: 'That event cannot be played online.' };
  const open = Events.availability(ev.id, Date.now());
  if (!open.ok) return { error: `${ev.name} is not available right now. ${open.reason || ''}`.trim() };
  const t = ev.tiers ? (ev.tiers.find((x) => x.id === tier) || ev.tiers[0]).id : null;
  return { event: { eventId: ev.id, tier: t } };
}

function queueKey(event) { return event ? `${event.eventId}:${event.tier || ''}` : ''; }

function startQueueMatch(idA, idB, key) {
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
    ranked: !key, // the normal queue counts for trophies; event queues, private rooms and rematches are friendly
    matchNo: 0,
    event: key ? { eventId: key.split(':')[0], tier: key.split(':')[1] || null } : null,
  };
  rooms.set(code, room);
  socketRoom.set(idA, code);
  socketRoom.set(idB, code);
  sockA.join(code);
  sockB.join(code);
  console.log(`[Match] Room ${code}: ${idA} vs ${idB}`);
  sockA.emit('room_joined', { code, side: 'A' });
  sockB.emit('room_joined', { code, side: 'B' });
  if (startRoom(room)) io.to(code).emit('match_start', matchInfo(room));
}



function generateCode() {
  let code;
  do {
    code = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (rooms.has(code));
  return code;
}

// ─── Room lifecycle ────────────────────────────────────────────────────────

// Each player's deck is stored on their socket when they create/join a room or queue
function deckOf(socketId) {
  return io.sockets.sockets.get(socketId)?.data.deck || Sim.normalizeDeck(null, Sim.EVO_RULES.slots.online);
}

// What clients need to know about the match that is starting. The id is unique per match, so a
// client can make sure a result is only ever counted once.
function matchInfo(room) {
  const info = { code: room.code, ranked: !!room.ranked, matchId: `${room.code}-${room.matchNo}-${room.startedAt}` };
  if (room.event) {
    info.eventId = room.event.eventId;
    info.tier = room.event.tier;
    if (room.eventLaw) info.law = room.eventLaw;
  }
  return info;
}

// Build the match: a normal battle, or an event match configured entirely on the server
function createRoomMatch(room, seed) {
  const decks = { A: deckOf(room.sockets.A), B: deckOf(room.sockets.B) };
  room.eventLaw = null;
  if (!room.event) return Sim.createMatch({ seed, decks });
  const { eventId, tier } = room.event;
  // Own-deck events: a deck that breaks the event's deck rules is swapped for a legal loaner
  const legal = {};
  ['A', 'B'].forEach((side, i) => {
    const res = Events.legalDeckFor(eventId, decks[side], seed + i + 1);
    legal[side] = res.entries;
    if (res.loaner) io.sockets.sockets.get(room.sockets[side])?.emit('deck_loaner', { problems: res.problems || [] });
  });
  const all = legal.A.concat(legal.B);
  const level = all.length ? Math.round(all.reduce((s, e) => s + (Number(e.level) || 1), 0) / all.length) : 1;
  const hasEvo = all.some((e) => e.evo);
  const cfg = Events.buildMatch(eventId, { seed, tier, decks: legal, hasEvo, level, now: Date.now() });
  room.eventLaw = cfg.law ? cfg.law.id : null;
  return Sim.createMatch({ seed, rules: cfg.rules, decks: cfg.decks });
}

function startRoom(room) {
  if (room.interval) clearInterval(room.interval);
  room.matchNo = (room.matchNo || 0) + 1;
  room.startedAt = Date.now();
  try {
    room.state = createRoomMatch(room, Math.floor(Math.random() * 2147483647));
  } catch (err) {
    // A broken event config must never strand players: tell them and close the room
    console.error(`[Room ${room.code}] could not start:`, err);
    io.to(room.code).emit('room_error', { msg: 'The match could not be started. Please try again.' });
    destroyRoom(room.code);
    return false;
  }
  room.lastTick = Date.now();
  room.acc = 0;
  room.rematchVotes = 0;
  room.interval = setInterval(() => {
    // Fixed-size simulation steps regardless of timer jitter (capped so a stall can't snowball)
    const now = Date.now();
    room.acc = Math.min(room.acc + (now - room.lastTick) / 1000, Sim.MATCH.step * 4);
    room.lastTick = now;
    const fx = [];
    while (room.acc >= Sim.MATCH.step) {
      room.acc -= Sim.MATCH.step;
      Sim.step(room.state);
      fx.push(...Sim.takeFx(room.state));
    }
    const snap = Sim.snapshot(room.state);
    snap.fx = fx;
    io.to(room.code).emit('state_update', snap);
    if (!room.state.running && room.state.winner) {
      io.to(room.code).emit('match_over', { winner: room.state.winner, ...matchInfo(room) });
      clearInterval(room.interval);
      room.interval = null;
    }
  }, TICK_MS);
  return true;
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

  socket.on('create_room', ({ deck, eventId, tier } = {}) => {
    const req = eventRequest(eventId, tier);
    if (req.error) { socket.emit('room_error', { msg: req.error }); return; }
    socket.data.deck = Sim.normalizeDeck(deck, Sim.EVO_RULES.slots.online);
    removeFromMatchQueue(socket.id);
    leaveCurrentRoom(socket);
    const code = generateCode();
    const room = {
      code,
      players: [socket.id],
      sockets: { A: socket.id, B: null },
      state: null,
      interval: null,
      rematchVotes: 0,
      ranked: false,
      matchNo: 0,
      event: req.event,
    };
    rooms.set(code, room);
    socketRoom.set(socket.id, code);
    socket.join(code);
    socket.emit('room_created', { code, side: 'A', eventId: req.event?.eventId || null, tier: req.event?.tier || null });
    console.log(`Room ${code} created by ${socket.id}`);
  });

  socket.on('join_room', ({ code, deck } = {}) => {
    const upper = String(code || '').toUpperCase().trim();
    const room = rooms.get(upper);
    if (!room) { socket.emit('room_error', { msg: 'Room not found. Check your code.' }); return; }
    if (room.players.length >= 2) { socket.emit('room_error', { msg: 'Room is full.' }); return; }
    socket.data.deck = Sim.normalizeDeck(deck, Sim.EVO_RULES.slots.online);
    leaveCurrentRoom(socket);
    room.players.push(socket.id);
    room.sockets.B = socket.id;
    removeFromMatchQueue(socket.id);
    socketRoom.set(socket.id, upper);
    socket.join(upper);
    // The room's event decides the rules; the joiner plays whatever the creator picked
    socket.emit('room_joined', { code: upper, side: 'B', eventId: room.event?.eventId || null, tier: room.event?.tier || null });
    if (startRoom(room)) io.to(upper).emit('match_start', matchInfo(room));
    console.log(`Room ${upper} started`);
  });

  socket.on('deploy', ({ cardId, x, y } = {}) => {
    const code = socketRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room || !room.state || !room.state.running) return;
    const side = room.sockets.A === socket.id ? 'A' : 'B';
    // Sim.deploy checks the card is in hand, elixir, and that the spot is a legal deploy zone
    const result = Sim.deploy(room.state, side, String(cardId), Number(x), Number(y));
    if (!result.ok) socket.emit('deploy_rejected', { reason: result.reason });
  });

  // Emotes go through the shared engine (validation + rate limits) and reach both players
  // with the next state update. After the final whistle the tick loop has stopped, so send them directly.
  socket.on('emote', ({ id } = {}) => {
    const code = socketRoom.get(socket.id);
    const room = code && rooms.get(code);
    if (!room || !room.state) return;
    const side = room.sockets.A === socket.id ? 'A' : 'B';
    const res = Sim.emote(room.state, side, String(id || ''));
    if (!res.ok) { socket.emit('emote_rejected', { reason: res.reason }); return; }
    if (!room.state.running) io.to(code).emit('fx', Sim.takeFx(room.state));
  });

  socket.on('rematch', () => {
    const code = socketRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room || room.players.length < 2 || room.state?.running) return;
    room.rematchVotes = (room.rematchVotes || 0) + 1;
    if (room.rematchVotes >= 2) {
      room.rematchVotes = 0;
      room.ranked = false; // rematches are friendly, so two players can't farm trophies off each other
      if (startRoom(room)) io.to(code).emit('match_start', matchInfo(room)); // same event, fresh seed
    } else {
      socket.emit('rematch_waiting', {});
    }
  });

  socket.on('join_queue', ({ deck, eventId, tier } = {}) => {
    const req = eventRequest(eventId, tier);
    if (req.error) { socket.emit('queue_error', { msg: req.error }); return; }
    socket.data.deck = Sim.normalizeDeck(deck, Sim.EVO_RULES.slots.online);
    leaveCurrentRoom(socket);
    const key = queueKey(req.event);
    addToMatchQueue(socket.id, key);
    socket.emit('queue_waiting', { eventId: req.event?.eventId || null, tier: req.event?.tier || null });
    runMatchmaker(key); // match right away if someone is already waiting
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
          // The player who stayed wins by forfeit
          io.to(code).emit('opponent_left', matchInfo(room));
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
