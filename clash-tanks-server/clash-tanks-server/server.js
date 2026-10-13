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

// ─── Game rules ────────────────────────────────────────────────────────────
// The whole match simulation (arena, cards, combat, towers, clock) is shared with the
// browser, so online matches play exactly like local ones.
const Sim = require('./shared/clash-sim');

const TICK_MS = Sim.MATCH.step * 1000; // 20 simulation steps per second

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
    ranked: true, // matchmaking games count for trophies; private rooms and rematches are friendly
    matchNo: 0,
  };
  rooms.set(code, room);
  socketRoom.set(idA, code);
  socketRoom.set(idB, code);
  sockA.join(code);
  sockB.join(code);
  console.log(`[Match] Room ${code}: ${idA} vs ${idB}`);
  sockA.emit('room_joined', { code, side: 'A' });
  sockB.emit('room_joined', { code, side: 'B' });
  startRoom(room);
  io.to(code).emit('match_start', matchInfo(room));
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
  return io.sockets.sockets.get(socketId)?.data.deck || Sim.normalizeDeck(null);
}

// What clients need to know about the match that is starting. The id is unique per match, so a
// client can make sure a result is only ever counted once.
function matchInfo(room) {
  return { code: room.code, ranked: !!room.ranked, matchId: `${room.code}-${room.matchNo}-${room.startedAt}` };
}

function startRoom(room) {
  if (room.interval) clearInterval(room.interval);
  room.matchNo = (room.matchNo || 0) + 1;
  room.startedAt = Date.now();
  room.state = Sim.createMatch({
    seed: Math.floor(Math.random() * 2147483647),
    decks: { A: deckOf(room.sockets.A), B: deckOf(room.sockets.B) },
  });
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
    socket.data.deck = Sim.normalizeDeck(deck);
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
    socket.data.deck = Sim.normalizeDeck(deck);
    leaveCurrentRoom(socket);
    room.players.push(socket.id);
    room.sockets.B = socket.id;
    socketRoom.set(socket.id, upper);
    socket.join(upper);
    socket.emit('room_joined', { code: upper, side: 'B' });
    startRoom(room);
    io.to(upper).emit('match_start', matchInfo(room));
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
      startRoom(room);
      io.to(code).emit('match_start', matchInfo(room));
    } else {
      socket.emit('rematch_waiting', {});
    }
  });

  socket.on('join_queue', ({ deck } = {}) => {
    socket.data.deck = Sim.normalizeDeck(deck);
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
