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

// ─── Game constants (must stay in sync with prototype.js) ──────────────────

const UNIT_TYPES = {
  scout:    { name: 'Scout',    cost: 2, hp: 55,  dmg: 10, range: 8,  speed: 27, cd: 0.52, structureMult: 0.85, cool: 1.8 },
  brawler:  { name: 'Brawler',  cost: 4, hp: 145, dmg: 17, range: 9,  speed: 13, cd: 0.78, structureMult: 1,    cool: 2.8 },
  siege:    { name: 'Siege',    cost: 6, hp: 96,  dmg: 37, range: 18, speed: 8,  cd: 1.22, structureMult: 1.65, cool: 4.1 },
  guardian: { name: 'Guardian', cost: 5, hp: 120, dmg: 9,  range: 10, speed: 10, cd: 0.95, structureMult: 1,    cool: 3.4 },
};

const BOARD = {
  laneCount: 3,
  spawnA: 6,
  spawnB: 94,
  towerX: { A: 24, B: 76 },
  baseX: { A: 2, B: 98 },
};

const TICK_MS = 1000 / 20; // 20 ticks per second

// ─── Room registry ─────────────────────────────────────────────────────────

const rooms = new Map();     // code → room
const socketRoom = new Map(); // socketId → code

function generateCode() {
  let code;
  do {
    code = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (rooms.has(code));
  return code;
}

// ─── State factory ─────────────────────────────────────────────────────────

function createPlayer(id) {
  return {
    id,
    baseHpMax: 1300,
    baseHp: 1300,
    energyMax: 10,
    energy: 10,
    energyRegen: 2.2,
    towerDamage: 12,
    cooldowns: { scout: 0, brawler: 0, siege: 0, guardian: 0 },
  };
}

function createState() {
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
    players: { A: createPlayer('A'), B: createPlayer('B') },
  };
}

// ─── Simulation ─────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function enemyOf(owner) { return owner === 'A' ? 'B' : 'A'; }

function livingStructures(state, owner, lane, kind) {
  return state.structures.filter(s =>
    s.owner === owner &&
    s.hp > 0 &&
    (lane == null || s.lane === lane) &&
    (!kind || s.kind === kind)
  );
}

function nearestEnemyUnit(state, unit) {
  const foe = enemyOf(unit.owner);
  let best = null;
  let bestDist = Infinity;
  state.units.forEach(other => {
    if (other.owner !== foe || other.lane !== unit.lane || other.hp <= 0) return;
    const d = Math.abs(other.x - unit.x);
    if (d < bestDist) { best = other; bestDist = d; }
  });
  return bestDist <= unit.stats.range ? best : null;
}

function primaryEnemyStructure(state, unit) {
  const foe = enemyOf(unit.owner);
  const towers = livingStructures(state, foe, unit.lane, 'tower');
  if (towers.length) return towers[0];
  return livingStructures(state, foe, null, 'base')[0] || null;
}

function guardianReduction(state, owner, lane, x) {
  let r = 0;
  state.units.forEach(u => {
    if (u.owner !== owner || u.type !== 'guardian' || u.lane !== lane || u.hp <= 0) return;
    if (Math.abs(u.x - x) <= 10) r = Math.max(r, 0.23);
  });
  return r;
}

function dealDamage(state, target, amount, isStructure) {
  if (!target || target.hp <= 0 || amount <= 0) return;
  let dmg = amount;
  if (!isStructure) {
    dmg *= (1 - guardianReduction(state, target.owner, target.lane, target.x));
  }
  target.hp -= dmg;
  if (target.hp < 0) target.hp = 0;
}

function applyDeploy(state, owner, type, lane) {
  const def = UNIT_TYPES[type];
  const p = state.players[owner];
  if (!def || !p) return false;
  if (lane < 0 || lane >= BOARD.laneCount) return false;
  if (p.energy < def.cost) return false;
  if (p.cooldowns[type] > state.time) return false;
  p.energy -= def.cost;
  p.cooldowns[type] = state.time + def.cool;
  state.units.push({
    id: `u-${state.nextId++}`,
    owner, lane, type,
    stats: def,
    hp: def.hp,
    x: owner === 'A' ? BOARD.spawnA : BOARD.spawnB,
    attackCd: 0,
  });
  return true;
}

function tick(state, dt) {
  if (!state.running) return;
  state.time += dt;

  // Energy recharge
  ['A', 'B'].forEach(id => {
    const p = state.players[id];
    p.energy = clamp(p.energy + p.energyRegen * dt, 0, p.energyMax);
  });

  // Unit AI: attack or advance
  state.units.forEach(u => {
    if (u.hp <= 0) return;
    u.attackCd -= dt;
    const enemy = nearestEnemyUnit(state, u);
    if (enemy) {
      if (u.attackCd <= 0) {
        dealDamage(state, enemy, u.stats.dmg, false);
        u.attackCd = u.stats.cd;
      }
      return;
    }
    const structure = primaryEnemyStructure(state, u);
    if (structure) {
      const dist = Math.abs(structure.x - u.x);
      if (dist <= u.stats.range) {
        if (u.attackCd <= 0) {
          dealDamage(state, structure, u.stats.dmg * u.stats.structureMult, true);
          u.attackCd = u.stats.cd;
        }
      } else {
        u.x += (u.owner === 'A' ? 1 : -1) * u.stats.speed * dt;
      }
    }
  });

  state.units = state.units.filter(u => u.hp > 0 && u.x >= -3 && u.x <= 103);

  // Structures fire
  state.structures.forEach(s => {
    if (s.hp <= 0) return;
    s.cd -= dt;
    const range = s.kind === 'base' ? 14 : 22;
    const dmg   = s.kind === 'base' ? 16 : state.players[s.owner].towerDamage;
    const foe   = enemyOf(s.owner);
    let target = null;
    let bestDist = Infinity;
    state.units.forEach(u => {
      if (u.owner !== foe || u.lane !== s.lane || u.hp <= 0) return;
      const dist = Math.abs(u.x - s.x);
      if (dist <= range && dist < bestDist) { bestDist = dist; target = u; }
    });
    if (target && s.cd <= 0) {
      dealDamage(state, target, dmg, false);
      s.cd = s.kind === 'base' ? 0.7 : 0.9;
    }
  });

  // Sync player base HP from structure
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

function buildClientState(state) {
  const remaining = (p) => ({
    scout:    Math.max(0, p.cooldowns.scout    - state.time),
    brawler:  Math.max(0, p.cooldowns.brawler  - state.time),
    siege:    Math.max(0, p.cooldowns.siege    - state.time),
    guardian: Math.max(0, p.cooldowns.guardian - state.time),
  });
  return {
    time: state.time,
    running: state.running,
    winner: state.winner,
    units: state.units.map(u => ({
      id: u.id, owner: u.owner, lane: u.lane, type: u.type,
      hp: u.hp, hpMax: u.stats.hp, x: u.x,
    })),
    structures: state.structures.map(s => ({
      id: s.id, owner: s.owner, lane: s.lane, x: s.x,
      hp: s.hp, hpMax: s.hpMax, kind: s.kind,
    })),
    players: {
      A: {
        energy: state.players.A.energy,
        energyMax: state.players.A.energyMax,
        baseHp: state.players.A.baseHp,
        baseHpMax: state.players.A.baseHpMax,
        cooldownsRemaining: remaining(state.players.A),
      },
      B: {
        energy: state.players.B.energy,
        energyMax: state.players.B.energyMax,
        baseHp: state.players.B.baseHp,
        baseHpMax: state.players.B.baseHpMax,
        cooldownsRemaining: remaining(state.players.B),
      },
    },
  };
}

// ─── Room lifecycle ────────────────────────────────────────────────────────

function startRoom(room) {
  if (room.interval) clearInterval(room.interval);
  room.state = createState();
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

  socket.on('create_room', () => {
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

  socket.on('join_room', ({ code }) => {
    const upper = String(code || '').toUpperCase().trim();
    const room = rooms.get(upper);
    if (!room) { socket.emit('room_error', { msg: 'Room not found. Check your code.' }); return; }
    if (room.players.length >= 2) { socket.emit('room_error', { msg: 'Room is full.' }); return; }
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

  socket.on('deploy', ({ unit, lane }) => {
    const code = socketRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room || !room.state || !room.state.running) return;
    if (!UNIT_TYPES[unit]) return; // Validate unit type
    const side = room.sockets.A === socket.id ? 'A' : 'B';
    applyDeploy(room.state, side, unit, Number(lane));
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

  socket.on('disconnect', () => {
    console.log(`disconnect ${socket.id}`);
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
