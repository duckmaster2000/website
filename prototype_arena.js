/*
 * Arena renderer for the prototype: draws a ClashSim snapshot onto a <canvas>.
 * Pure drawing + coordinate mapping; game rules live in clash-sim.js.
 */
(function () {
  'use strict';

  const Sim = window.ClashSim;
  const Emotes = window.EmoteArt;
  const W = Sim.W;
  const H = Sim.H;
  const TEAM = {
    A: { main: '#3d8bff', dark: '#1d4f9e', light: '#9cc7ff', name: 'Blue' },
    B: { main: '#ff4d5e', dark: '#9e1d2b', light: '#ffb0b8', name: 'Red' },
  };
  const EMOTE_LIFE = 2600;  // ms an emote bubble stays up
  const SPELL_RADIUS = {
    firebomb: (Sim.CARD_MAP.firebomb && Sim.CARD_MAP.firebomb.splash) || 2.5,
    rocket: (Sim.CARD_MAP.rocketrain && Sim.CARD_MAP.rocketrain.splash) || 3.8,
  };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeBack = (t) => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

  function seeded(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), s | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function create(canvas) {
    const ctx = canvas.getContext('2d');
    let scale = 20;          // device pixels per tile
    let dpr = 1;
    let flip = false;        // true when the local player is side B (draw their side at the bottom)
    let bg = null;           // pre-rendered static arena
    let zoneCache = { key: '', canvas: null };
    const sprites = new Map();
    let effects = [];
    let shake = 0;
    let names = { A: 'Blue', B: 'Red' };
    const emotes = { A: null, B: null };     // { id, born }
    let banners = [];                        // queued announcements
    const hpShown = new Map();               // id -> trailing health fraction
    const motion = new Map();                // id -> { x, y, moving }
    let lastNow = performance.now();
    const watch = { time: -1, double: false, phase: 'regular' };

    // ── Coordinates ──
    const sx = (x) => (flip ? W - x : x) * scale;
    const sy = (y) => (flip ? H - y : y) * scale;
    const faceAngle = (a) => (flip ? a + Math.PI : a);

    function resize() {
      dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const cssW = Math.max(180, rect.width);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssW * dpr * (H / W));
      scale = canvas.width / W;
      bg = null;
      zoneCache.key = '';
      sprites.clear();
    }

    function toWorld(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
      const x = ((clientX - rect.left) / rect.width) * W;
      const y = ((clientY - rect.top) / rect.height) * H;
      return flip ? { x: W - x, y: H - y } : { x, y };
    }

    // ── Static background (grass, lanes, river, bridges, tower pads) ──
    function drawBackground() {
      bg = document.createElement('canvas');
      bg.width = canvas.width;
      bg.height = canvas.height;
      const g = bg.getContext('2d');
      const rand = seeded(1337);
      const s = scale;
      for (let ty = 0; ty < H; ty++) {
        for (let tx = 0; tx < W; tx++) {
          g.fillStyle = (tx + ty) % 2 ? '#4c923f' : '#559d47';
          g.fillRect(tx * s, ty * s, s + 1, s + 1);
        }
      }
      // Sandy lanes from tower to tower and plazas around the kings (symmetric, so no flip needed)
      g.strokeStyle = 'rgba(222,196,132,0.32)';
      g.lineCap = 'round';
      g.lineWidth = s * 1.3;
      Sim.TOWER_LAYOUT.princessX.forEach((x) => {
        g.beginPath();
        g.moveTo(x * s, Sim.TOWER_LAYOUT.princessY.B * s);
        g.lineTo(x * s, Sim.TOWER_LAYOUT.princessY.A * s);
        g.stroke();
      });
      g.lineWidth = s * 0.9;
      ['A', 'B'].forEach((side) => {
        const ky = Sim.TOWER_LAYOUT.kingY[side] * s;
        const py = Sim.TOWER_LAYOUT.princessY[side] * s;
        Sim.TOWER_LAYOUT.princessX.forEach((x) => {
          g.beginPath();
          g.moveTo(x * s, py);
          g.quadraticCurveTo(x * s, ky, Sim.TOWER_LAYOUT.kingX * s, ky);
          g.stroke();
        });
      });
      // Grass tufts and flowers
      for (let i = 0; i < 260; i++) {
        const x = rand() * W;
        const y = rand() * H;
        if (y > Sim.RIVER.y0 - 0.4 && y < Sim.RIVER.y1 + 0.4) continue;
        g.strokeStyle = rand() < 0.5 ? 'rgba(40,95,35,0.55)' : 'rgba(120,190,90,0.45)';
        g.lineWidth = Math.max(1, s * 0.045);
        g.beginPath();
        g.moveTo(x * s - s * 0.08, y * s - s * 0.12);
        g.lineTo(x * s, y * s);
        g.lineTo(x * s + s * 0.08, y * s - s * 0.12);
        g.stroke();
      }
      for (let i = 0; i < 46; i++) {
        const edge = rand() < 0.5 ? rand() * 1.4 + 0.2 : W - 0.2 - rand() * 1.4;
        const y = rand() * H;
        if (y > Sim.RIVER.y0 - 0.5 && y < Sim.RIVER.y1 + 0.5) continue;
        g.fillStyle = ['#fff7d6', '#ffd6e7', '#ffe36b', '#cfe8ff'][i % 4];
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2;
          g.beginPath(); g.arc(edge * s + Math.cos(a) * s * 0.07, y * s + Math.sin(a) * s * 0.07, s * 0.055, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = '#e8a400';
        g.beginPath(); g.arc(edge * s, y * s, s * 0.04, 0, Math.PI * 2); g.fill();
      }
      // Soft team tint toward each back line (my colour at the bottom)
      const tint = (side, a) => (side === 'A' ? `rgba(61,139,255,${a})` : `rgba(255,77,94,${a})`);
      const meSide = flip ? 'B' : 'A';
      const foeSide = flip ? 'A' : 'B';
      const nearMe = g.createLinearGradient(0, bg.height, 0, bg.height * 0.55);
      nearMe.addColorStop(0, tint(meSide, 0.16));
      nearMe.addColorStop(1, tint(meSide, 0));
      g.fillStyle = nearMe;
      g.fillRect(0, bg.height * 0.55, bg.width, bg.height * 0.45);
      const nearFoe = g.createLinearGradient(0, 0, 0, bg.height * 0.45);
      nearFoe.addColorStop(0, tint(foeSide, 0.16));
      nearFoe.addColorStop(1, tint(foeSide, 0));
      g.fillStyle = nearFoe;
      g.fillRect(0, 0, bg.width, bg.height * 0.45);
      // River banks, water and foam
      const ry0 = Sim.RIVER.y0 * s;
      const ry1 = Sim.RIVER.y1 * s;
      g.fillStyle = 'rgba(70,48,24,0.45)';
      g.fillRect(0, ry0 - s * 0.22, bg.width, s * 0.22);
      g.fillRect(0, ry1, bg.width, s * 0.22);
      const water = g.createLinearGradient(0, ry0, 0, ry1);
      water.addColorStop(0, '#2a7fc9');
      water.addColorStop(0.5, '#3fa4ea');
      water.addColorStop(1, '#2a7fc9');
      g.fillStyle = water;
      g.fillRect(0, ry0, bg.width, ry1 - ry0);
      g.strokeStyle = 'rgba(255,255,255,0.4)';
      g.lineWidth = Math.max(1, s * 0.06);
      [ry0 + s * 0.08, ry1 - s * 0.08].forEach((yy, k) => {
        g.beginPath();
        for (let x = 0; x <= bg.width; x += s * 0.25) {
          const y = yy + Math.sin(x / (s * 0.6) + k * 2) * s * 0.05;
          if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      });
      // Bridges
      Sim.BRIDGES.forEach((b) => {
        const x0 = b.x0 * s;
        const x1 = b.x1 * s;
        const y0 = ry0 - s * 0.35;
        const y1 = ry1 + s * 0.35;
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(x0 + s * 0.12, y0 + s * 0.12, x1 - x0, y1 - y0);
        const wood = g.createLinearGradient(x0, 0, x1, 0);
        wood.addColorStop(0, '#8a5d32');
        wood.addColorStop(0.5, '#a8774a');
        wood.addColorStop(1, '#8a5d32');
        g.fillStyle = wood;
        g.fillRect(x0, y0, x1 - x0, y1 - y0);
        g.strokeStyle = '#6e4826';
        g.lineWidth = Math.max(1, s * 0.06);
        for (let py = y0 + s * 0.4; py < y1; py += s * 0.4) {
          g.beginPath(); g.moveTo(x0, py); g.lineTo(x1, py); g.stroke();
        }
        g.fillStyle = '#5a3a1e';
        g.fillRect(x0 - s * 0.12, y0, s * 0.18, y1 - y0);
        g.fillRect(x1 - s * 0.06, y0, s * 0.18, y1 - y0);
        g.fillStyle = '#3f2814';
        [y0, y1 - s * 0.22].forEach((py) => {
          g.fillRect(x0 - s * 0.18, py, s * 0.3, s * 0.22);
          g.fillRect(x1 - s * 0.12, py, s * 0.3, s * 0.22);
        });
      });
      // Stone pads under every tower
      ['A', 'B'].forEach((side) => {
        const pads = [
          { x: Sim.TOWER_LAYOUT.princessX[0], y: Sim.TOWER_LAYOUT.princessY[side], half: 1.5 },
          { x: Sim.TOWER_LAYOUT.princessX[1], y: Sim.TOWER_LAYOUT.princessY[side], half: 1.5 },
          { x: Sim.TOWER_LAYOUT.kingX, y: Sim.TOWER_LAYOUT.kingY[side], half: 2 },
        ];
        pads.forEach((p) => {
          const h = (p.half + 0.35) * s;
          g.fillStyle = 'rgba(120,112,98,0.55)';
          roundRect(g, sx(p.x) - h, sy(p.y) - h, h * 2, h * 2, s * 0.35);
          g.fill();
          g.strokeStyle = 'rgba(60,54,46,0.5)';
          g.lineWidth = Math.max(1, s * 0.05);
          g.stroke();
        });
      });
      // Vignette
      const edge = s * 1.2;
      [[0, 0, edge, 0, 0, 0, edge, bg.height], [bg.width, 0, bg.width - edge, 0, bg.width - edge, 0, edge, bg.height]].forEach(([gx0, gy0, gx1, gy1, rx, ry, rw, rh]) => {
        const gr = g.createLinearGradient(gx0, gy0, gx1, gy1);
        gr.addColorStop(0, 'rgba(0,20,0,0.35)');
        gr.addColorStop(1, 'rgba(0,20,0,0)');
        g.fillStyle = gr;
        g.fillRect(rx, ry, rw, rh);
      });
    }

    // ── Emoji sprites (rendering text every frame is slow, so cache bitmaps) ──
    function sprite(icon, px) {
      const size = Math.max(8, Math.round(px));
      const key = `${icon}|${size}`;
      let c = sprites.get(key);
      if (!c) {
        c = document.createElement('canvas');
        c.width = c.height = Math.ceil(size * 1.3);
        const g = c.getContext('2d');
        g.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(icon, c.width / 2, c.height / 2 + size * 0.06);
        sprites.set(key, c);
      }
      return c;
    }

    function drawSprite(icon, x, y, px, alpha) {
      const c = sprite(icon, px);
      ctx.globalAlpha = alpha == null ? 1 : alpha;
      ctx.drawImage(c, x - c.width / 2, y - c.height / 2);
      ctx.globalAlpha = 1;
    }

    function outlinedText(text, x, y, size, fill, stroke, weight) {
      ctx.font = `${weight || 800} ${Math.round(size)}px "Orbitron","Space Grotesk",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, size * 0.18);
      ctx.strokeStyle = stroke || 'rgba(0,0,0,0.8)';
      ctx.strokeText(text, x, y);
      ctx.fillStyle = fill;
      ctx.fillText(text, x, y);
    }

    // ── Deploy zone overlay ──
    function drawZones(zoneFn, key) {
      if (!zoneFn) return;
      if (zoneCache.key !== key || !zoneCache.canvas) {
        const c = document.createElement('canvas');
        c.width = canvas.width;
        c.height = canvas.height;
        const g = c.getContext('2d');
        const cell = 0.5;
        g.fillStyle = 'rgba(200,30,40,0.30)';
        for (let y = 0; y < H; y += cell) {
          for (let x = 0; x < W; x += cell) {
            if (!zoneFn(x + cell / 2, y + cell / 2)) {
              const px = flip ? (W - x - cell) * scale : x * scale;
              const py = flip ? (H - y - cell) * scale : y * scale;
              g.fillRect(px, py, cell * scale + 0.5, cell * scale + 0.5);
            }
          }
        }
        zoneCache = { key, canvas: c };
      }
      ctx.drawImage(zoneCache.canvas, 0, 0);
    }

    // ── Health bars (with a trailing "recent damage" segment) ──
    function trailFrac(id, frac, dt) {
      let shown = hpShown.get(id);
      if (shown == null || shown < frac) shown = frac;
      else shown = Math.max(frac, shown - dt * 0.45);
      hpShown.set(id, shown);
      return shown;
    }

    function hpBar(id, x, y, w, frac, owner, h, dt) {
      const bh = h || Math.max(3, scale * 0.14);
      const f = clamp(frac, 0, 1);
      const trail = trailFrac(id, f, dt);
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, bh + 2);
      if (trail > f) {
        ctx.fillStyle = '#fff2b0';
        ctx.fillRect(x - w / 2 + w * f, y, w * (trail - f), bh);
      }
      ctx.fillStyle = TEAM[owner].main;
      ctx.fillRect(x - w / 2, y, w * f, bh);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x - w / 2, y, w * f, bh * 0.4);
    }

    function stunSparks(x, y, r, now) {
      ctx.strokeStyle = 'rgba(160,240,255,0.9)';
      ctx.lineWidth = Math.max(1.5, scale * 0.06);
      for (let i = 0; i < 3; i++) {
        const a = now / 140 + (i * Math.PI * 2) / 3;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r * 0.5 - r * 0.6;
        ctx.beginPath();
        ctx.moveTo(px - scale * 0.1, py - scale * 0.08);
        ctx.lineTo(px, py);
        ctx.lineTo(px - scale * 0.04, py + scale * 0.02);
        ctx.lineTo(px + scale * 0.08, py + scale * 0.12);
        ctx.stroke();
      }
    }

    // ── Towers ──
    function drawTower(t, now, dt) {
      const x = sx(t.x);
      const y = sy(t.y);
      const half = t.half * scale;
      const team = TEAM[t.owner];
      const king = t.tower === 'king';
      if (t.hp <= 0) {
        ctx.fillStyle = 'rgba(40,36,32,0.55)';
        ctx.beginPath(); ctx.ellipse(x, y, half * 0.95, half * 0.75, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#6b6560';
        for (let i = 0; i < 7; i++) {
          const a = i * 2.1;
          const r = half * (0.25 + (i % 3) * 0.2);
          ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7, half * 0.16, 0, Math.PI * 2); ctx.fill();
        }
        return;
      }
      const hitK = t.hit < 0.12 ? (0.12 - t.hit) / 0.12 : 0;
      const jx = hitK ? (Math.random() - 0.5) * scale * 0.08 : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      roundRect(ctx, x - half + scale * 0.18, y - half + scale * 0.24, half * 2, half * 2, scale * 0.3);
      ctx.fill();
      // Stone body
      const stone = ctx.createLinearGradient(x - half, y - half, x + half, y + half);
      stone.addColorStop(0, '#c3c7cf');
      stone.addColorStop(1, '#7a7f89');
      ctx.fillStyle = stone;
      roundRect(ctx, x - half + jx, y - half, half * 2, half * 2, scale * 0.3);
      ctx.fill();
      ctx.strokeStyle = '#4c515a';
      ctx.lineWidth = Math.max(1, scale * 0.08);
      ctx.stroke();
      // Brick courses
      ctx.strokeStyle = 'rgba(70,74,82,0.35)';
      ctx.lineWidth = Math.max(1, scale * 0.04);
      for (let row = 1; row < 4; row++) {
        const yy = y - half + (row * half * 2) / 4;
        ctx.beginPath(); ctx.moveTo(x - half + jx, yy); ctx.lineTo(x + half + jx, yy); ctx.stroke();
      }
      // Corner turrets (king) / crenellations (princess)
      ctx.fillStyle = '#d4d8df';
      if (king) {
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dy]) => {
          ctx.beginPath(); ctx.arc(x + dx * half * 0.86 + jx, y + dy * half * 0.86, scale * 0.38, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#5d626b'; ctx.stroke();
        });
      } else {
        for (let i = 0; i < 3; i++) {
          const bx = x - half + (i + 0.5) * ((half * 2) / 3) + jx;
          ctx.fillRect(bx - scale * 0.2, y - half - scale * 0.14, scale * 0.4, scale * 0.28);
          ctx.fillRect(bx - scale * 0.2, y + half - scale * 0.14, scale * 0.4, scale * 0.28);
        }
      }
      // Team platform
      const roof = ctx.createRadialGradient(x - half * 0.2, y - half * 0.25, half * 0.1, x, y, half * 0.65);
      roof.addColorStop(0, team.light);
      roof.addColorStop(0.5, team.main);
      roof.addColorStop(1, team.dark);
      ctx.fillStyle = roof;
      ctx.beginPath(); ctx.arc(x + jx, y, half * 0.62, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = Math.max(1, scale * 0.08);
      ctx.stroke();
      if (t.atk < 0.15) {
        ctx.fillStyle = `rgba(255,240,180,${0.75 * (1 - t.atk / 0.15)})`;
        ctx.beginPath(); ctx.arc(x, y, half * 0.42, 0, Math.PI * 2); ctx.fill();
      }
      if (hitK) {
        ctx.fillStyle = `rgba(255,255,255,${0.4 * hitK})`;
        roundRect(ctx, x - half + jx, y - half, half * 2, half * 2, scale * 0.3);
        ctx.fill();
      }
      drawSprite(king ? '👑' : '🏹', x + jx, y, half * 0.75);
      if (king && !t.active) {
        ctx.fillStyle = 'rgba(10,15,30,0.45)';
        ctx.beginPath(); ctx.arc(x, y, half * 0.62, 0, Math.PI * 2); ctx.fill();
        drawSprite('💤', x + half * 0.55, y - half * 0.55, half * 0.5, 0.6 + 0.4 * Math.sin(now / 300));
      }
      if (t.stn) stunSparks(x, y, half * 0.8, now);
      // HP bar + number (on the side facing the middle of the arena)
      const towardMiddle = (sy(t.y) < canvas.height / 2) ? 1 : -1;
      const barY = towardMiddle > 0 ? y + half + scale * 0.3 : y - half - scale * 0.65;
      hpBar(t.id, x, barY, half * 2, t.hp / t.hpMax, t.owner, scale * 0.3, dt);
      ctx.font = `700 ${Math.max(9, scale * 0.42)}px "Space Grotesk",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      const label = String(Math.ceil(t.hp));
      ctx.strokeText(label, x, barY + scale * 0.15);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x, barY + scale * 0.15);
    }

    // ── Units ──
    function drawUnit(u, now, dt) {
      const card = Sim.CARD_MAP[u.cardId];
      const team = TEAM[u.owner];
      // Drawn a bit larger than the collision body so units read clearly at small sizes
      let r = Math.max(7, u.radius * scale * (u.building ? 1 : 1.3));
      let x = sx(u.x);
      let y = sy(u.y);
      const face = faceAngle(u.face);
      const deploying = u.dep > 0;
      // Walk bob: compare with where we drew it last frame
      let m = motion.get(u.id);
      if (!m) { m = { x: u.x, y: u.y, moving: 0, seed: (u.id.length * 7 + u.id.charCodeAt(u.id.length - 1)) % 13 }; motion.set(u.id, m); }
      const step = Math.hypot(u.x - m.x, u.y - m.y);
      m.moving += ((step > 0.002 ? 1 : 0) - m.moving) * Math.min(1, dt * 10);
      m.x = u.x; m.y = u.y; m.seen = now;
      const bob = !u.air && !u.building ? Math.abs(Math.sin(now / 95 + m.seed)) * r * 0.16 * m.moving : 0;

      let lift = 0;
      let drop = 0;
      let alpha = 1;
      if (deploying) {
        // Swarm members land staggered (dep can exceed deployTime), so clamp to 0..1
        const p = Math.min(1, Math.max(0, 1 - u.dep / Sim.MATCH.deployTime));
        if (p < 0.22) {
          const k = 1 - p / 0.22;
          drop = k * k * scale * 2.2;
          r *= 1 + k * 0.25;
        }
        alpha = 0.6 + p * 0.3;
      }
      if (u.air) lift = scale * 0.5 + Math.sin(now / 250 + u.x) * scale * 0.06;
      if (u.jmp) lift = scale * 0.6;
      if (u.melee && u.atk < 0.18 && !deploying) {
        const k = Math.sin((u.atk / 0.18) * Math.PI) * scale * 0.22;
        x += Math.cos(face) * k;
        y += Math.sin(face) * k;
      }

      // Shadow (shrinks while the unit is dropping in)
      const shadowK = drop ? Math.max(0, 1 - drop / (scale * 3.2)) : 1;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(x, y + r * 0.35, r * 0.95 * shadowK, r * 0.5 * shadowK, 0, 0, Math.PI * 2); ctx.fill();
      y -= lift + drop + bob;

      if (u.building) {
        ctx.globalAlpha = alpha;
        const body = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
        body.addColorStop(0, '#a0a5ae');
        body.addColorStop(1, '#5f646d');
        ctx.fillStyle = body;
        roundRect(ctx, x - r, y - r, r * 2, r * 2, r * 0.25);
        ctx.fill();
        ctx.strokeStyle = team.main;
        ctx.lineWidth = Math.max(2, scale * 0.12);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = team.dark;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        const body = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r * 0.85);
        body.addColorStop(0, team.light);
        body.addColorStop(1, team.main);
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.arc(x, y, r * 0.82, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = team.light;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(face) * r * 1.25, y + Math.sin(face) * r * 1.25);
        ctx.lineTo(x + Math.cos(face + 0.5) * r * 0.85, y + Math.sin(face + 0.5) * r * 0.85);
        ctx.lineTo(x + Math.cos(face - 0.5) * r * 0.85, y + Math.sin(face - 0.5) * r * 0.85);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        if (u.air) {
          ctx.strokeStyle = 'rgba(255,255,255,0.7)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.arc(x, y, r * 1.12, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      if (u.chg) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 2;
        for (let i = -1; i <= 1; i++) {
          const bx = x - Math.cos(face) * r * 1.4 + Math.cos(face + Math.PI / 2) * i * r * 0.5;
          const by = y - Math.sin(face) * r * 1.4 + Math.sin(face + Math.PI / 2) * i * r * 0.5;
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - Math.cos(face) * r, by - Math.sin(face) * r); ctx.stroke();
        }
      }
      if (card) drawSprite(card.icon, x, y, r * 1.3, alpha);
      if (u.hit < 0.1) {
        ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - u.hit / 0.1)})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      if (u.stn) {
        ctx.fillStyle = 'rgba(120,220,255,0.25)';
        ctx.beginPath(); ctx.arc(x, y, r * 1.05, 0, Math.PI * 2); ctx.fill();
        stunSparks(x, y, r * 0.9, now);
      }
      if (u.wind && !u.melee) {
        ctx.strokeStyle = 'rgba(255,230,120,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, r * 1.15, face - 0.6, face + 0.6); ctx.stroke();
      }
      if (deploying) {
        const p = Math.min(1, Math.max(0, 1 - u.dep / Sim.MATCH.deployTime));
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, r * 1.25, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ctx.stroke();
      }
      if (u.hp < u.hpMax || u.building) hpBar(u.id, x, y - r - scale * 0.28, Math.max(scale * 0.8, r * 2), u.hp / u.hpMax, u.owner, null, dt);
    }

    // ── Projectiles ──
    function drawProjectile(p, now) {
      let x = sx(p.x);
      let y = sy(p.y);
      const team = TEAM[p.owner];
      const s = scale;
      const spell = p.style === 'firebomb' || p.style === 'rocket';
      if (spell && p.tx != null) {
        // Where it will land
        const tx = sx(p.tx);
        const ty = sy(p.ty);
        const rr = (SPELL_RADIUS[p.style] || 2.5) * s;
        ctx.strokeStyle = `${team.light}`;
        ctx.globalAlpha = 0.45 + 0.25 * Math.sin(now / 90);
        ctx.lineWidth = Math.max(1.5, s * 0.07);
        ctx.setLineDash([s * 0.3, s * 0.2]);
        ctx.beginPath(); ctx.arc(tx, ty, rr, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      let height = 0;
      if (p.lob != null) {
        height = Math.sin(p.lob * Math.PI) * s * (spell ? 3.2 : 2.2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(x, y, s * (spell ? 0.35 : 0.2), s * (spell ? 0.17 : 0.1), 0, 0, Math.PI * 2); ctx.fill();
        y -= height;
      }
      switch (p.style) {
        case 'firebomb': {
          for (let i = 3; i >= 1; i--) {
            const dx = p.tx != null ? sx(p.tx) - x : 0;
            const dy = p.ty != null ? sy(p.ty) - (y + height) : 0;
            const len = Math.hypot(dx, dy) || 1;
            ctx.fillStyle = `rgba(255,${120 + i * 30},40,${0.5 - i * 0.12})`;
            ctx.beginPath(); ctx.arc(x - (dx / len) * s * 0.28 * i, y - (dy / len) * s * 0.28 * i + i * s * 0.05, s * (0.32 - i * 0.05), 0, Math.PI * 2); ctx.fill();
          }
          const fb = ctx.createRadialGradient(x - s * 0.08, y - s * 0.08, s * 0.04, x, y, s * 0.4);
          fb.addColorStop(0, '#fffbe0');
          fb.addColorStop(0.4, '#ffc23d');
          fb.addColorStop(1, '#ff4b1f');
          ctx.fillStyle = fb;
          ctx.shadowColor = '#ff6a00'; ctx.shadowBlur = 14;
          ctx.beginPath(); ctx.arc(x, y, s * 0.38, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
          break;
        }
        case 'rocket': {
          const tx = p.tx != null ? sx(p.tx) : x;
          const ty = p.ty != null ? sy(p.ty) : y + s;
          const slope = Math.cos((p.lob || 0) * Math.PI) * s * 3.2 * Math.PI; // d(height)/d(progress)
          const ang = Math.atan2((ty - (y + height)) - slope * 0.08, tx - x);
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(ang);
          ctx.fillStyle = `rgba(255,${160 + Math.random() * 80},60,0.9)`;
          ctx.beginPath(); ctx.moveTo(-s * 0.22, -s * 0.07); ctx.lineTo(-s * (0.45 + Math.random() * 0.15), 0); ctx.lineTo(-s * 0.22, s * 0.07); ctx.fill();
          ctx.fillStyle = '#d9dde4';
          ctx.fillRect(-s * 0.24, -s * 0.07, s * 0.36, s * 0.14);
          ctx.fillStyle = team.main;
          ctx.beginPath(); ctx.moveTo(s * 0.12, -s * 0.07); ctx.lineTo(s * 0.26, 0); ctx.lineTo(s * 0.12, s * 0.07); ctx.fill();
          ctx.restore();
          break;
        }
        case 'beam':
          ctx.fillStyle = '#e0fbff';
          ctx.shadowColor = team.main; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.arc(x, y, s * 0.16, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
          break;
        case 'spark':
          ctx.fillStyle = '#a7f3ff';
          ctx.shadowColor = '#4de1ff'; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.arc(x, y, s * 0.14, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
          break;
        case 'flare':
          ctx.fillStyle = '#ffb347';
          ctx.shadowColor = '#ff6a00'; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.arc(x, y, s * 0.2, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
          break;
        case 'shell':
        case 'mortar':
          ctx.fillStyle = '#2b2b2b';
          ctx.beginPath(); ctx.arc(x, y, s * 0.18, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = team.main; ctx.lineWidth = 1.5; ctx.stroke();
          break;
        case 'arrow':
          ctx.fillStyle = team.light;
          ctx.beginPath(); ctx.arc(x, y, s * 0.11, 0, Math.PI * 2); ctx.fill();
          break;
        case 'bolt':
          ctx.fillStyle = '#ffe680';
          ctx.shadowColor = team.main; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.arc(x, y, s * 0.17, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
          break;
        default:
          ctx.fillStyle = '#ffe9a8';
          ctx.beginPath(); ctx.arc(x, y, s * 0.1, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ── Announcements: "BATTLE!", "2× ELIXIR", crowns, results ──
    function announce(text, opts) {
      const o = opts || {};
      const b = { text, sub: o.sub || '', color: o.color || '#ffe680', dur: o.dur || 1700, big: !!o.big, start: null };
      if (o.urgent) banners = [b];
      else if (banners.length < 3) banners.push(b);
    }

    function drawBanner(now) {
      const b = banners[0];
      if (!b) return;
      if (b.start == null) b.start = now;
      const t = (now - b.start) / b.dur;
      if (t >= 1) { banners.shift(); return; }
      const inK = clamp((now - b.start) / 220, 0, 1);
      const outK = t > 0.8 ? (t - 0.8) / 0.2 : 0;
      const cy = canvas.height * 0.5;
      const h = scale * (b.big ? 3.4 : 2.6) * easeOut(inK);
      ctx.globalAlpha = 1 - outK;
      const band = ctx.createLinearGradient(0, 0, canvas.width, 0);
      band.addColorStop(0, 'rgba(5,10,24,0)');
      band.addColorStop(0.2, 'rgba(5,10,24,0.78)');
      band.addColorStop(0.8, 'rgba(5,10,24,0.78)');
      band.addColorStop(1, 'rgba(5,10,24,0)');
      ctx.fillStyle = band;
      ctx.fillRect(0, cy - h / 2, canvas.width, h);
      ctx.fillStyle = b.color;
      ctx.fillRect(canvas.width * 0.15, cy - h / 2, canvas.width * 0.7, Math.max(1, scale * 0.06));
      ctx.fillRect(canvas.width * 0.15, cy + h / 2 - Math.max(1, scale * 0.06), canvas.width * 0.7, Math.max(1, scale * 0.06));
      const k = easeBack(inK);
      const size = scale * (b.big ? 1.5 : 1.05) * (0.6 + 0.4 * k);
      const slide = outK * canvas.width * 0.08;
      outlinedText(b.text, canvas.width / 2 + slide, cy - (b.sub ? scale * 0.3 : 0), size, b.color, 'rgba(0,0,0,0.85)', 900);
      if (b.sub) outlinedText(b.sub, canvas.width / 2 + slide, cy + size * 0.62, scale * 0.42, '#fff', 'rgba(0,0,0,0.85)', 700);
      ctx.globalAlpha = 1;
    }

    function drawCountdown(view, now) {
      if (!view.running || view.timeLeft > 10 || view.timeLeft <= 0) return;
      const n = Math.ceil(view.timeLeft);
      const frac = n - view.timeLeft; // 0 at the start of each second
      const size = scale * (2.4 + (1 - easeOut(clamp(frac * 2, 0, 1))) * 1.2);
      ctx.globalAlpha = 0.5 * (1 - frac * 0.6);
      outlinedText(String(n), canvas.width / 2, canvas.height * 0.5, size, n <= 3 ? '#ff6b6b' : '#fff', 'rgba(0,0,0,0.6)', 900);
      ctx.globalAlpha = 1;
    }

    // Watch the clock for phase changes worth announcing
    function watchPhase(view) {
      if (view.time < watch.time - 0.5) { watch.double = false; watch.phase = 'regular'; }
      watch.time = view.time;
      if (!view.running) return;
      if (view.phase === 'overtime' && watch.phase !== 'overtime') {
        announce('OVERTIME', { sub: 'Next crown wins!', color: '#ffb347' });
        if (api.onCue) api.onCue('overtime');
      } else if (view.double && !watch.double && view.phase === 'regular') {
        announce('2× ELIXIR', { sub: 'Elixir flows twice as fast', color: '#e48bff' });
        if (api.onCue) api.onCue('double');
      }
      watch.double = view.double;
      watch.phase = view.phase;
    }

    // ── Emote bubbles beside each king tower ──
    function showEmote(side, id) {
      emotes[side] = { id, born: performance.now() };
    }

    function drawEmotes(view, now) {
      ['A', 'B'].forEach((side) => {
        const e = emotes[side];
        if (!e) return;
        const age = now - e.born;
        if (age > EMOTE_LIFE) { emotes[side] = null; return; }
        const king = view.towers.find((t) => t.owner === side && t.tower === 'king');
        const kx = sx(king ? king.x : Sim.TOWER_LAYOUT.kingX);
        const ky = sy(king ? king.y : Sim.TOWER_LAYOUT.kingY[side]);
        const bottom = ky > canvas.height / 2;
        const bw = scale * 3.1;
        const bh = scale * 2.7;
        const x = clamp(kx + scale * 3.9, bw / 2 + scale * 0.2, canvas.width - bw / 2 - scale * 0.2);
        let y = ky + (bottom ? -scale * 1.1 : scale * 1.1);
        const inK = clamp(age / 260, 0, 1);
        const outK = age > EMOTE_LIFE - 380 ? (age - (EMOTE_LIFE - 380)) / 380 : 0;
        const sc = easeBack(inK) * (1 - outK * 0.25);
        y -= outK * scale * 0.6;
        ctx.save();
        ctx.globalAlpha = 1 - outK;
        ctx.translate(x, y);
        ctx.scale(sc, sc);
        Emotes.bubble(ctx, 0, 0, bw, bh, (kx + scale * 2.1 - x) / sc, (ky - y) / sc, TEAM[side].main);
        Emotes.draw(ctx, e.id, 0, 0, bh * 0.36, age / 1000);
        ctx.restore();
      });
    }

    // ── Effects (deploy rings, hits, spells, deaths, tower explosions, numbers) ──
    function addFx(list) {
      const now = performance.now();
      for (const f of list) {
        if (f.type === 'emote') { showEmote(f.owner, f.emote); continue; }
        if (f.type === 'crown') {
          announce('CROWN!', { sub: `${names[f.owner] || TEAM[f.owner].name} takes a tower`, color: TEAM[f.owner].light });
          continue;
        }
        const e = Object.assign({ born: now }, f);
        switch (f.type) {
          case 'deploy': e.life = 520; break;
          case 'cast': e.life = 600; break;
          case 'hit': e.life = 180; break;
          case 'splash': e.life = 350; break;
          case 'chain': e.life = 160; break;
          case 'charge': e.life = 300; break;
          case 'dmg': e.life = 800; e.jx = (Math.random() - 0.5) * 0.6; break;
          case 'kingWake': e.life = 1300; break;
          case 'spell':
            e.life = f.kind === 'firebomb' ? 750 : f.kind === 'shock' ? 420 : 520;
            e.parts = Array.from({ length: f.kind === 'rocket' ? 6 : 14 }, () => ({ a: Math.random() * Math.PI * 2, d: Math.random(), v: 0.6 + Math.random() * 0.8 }));
            shake = Math.max(shake, f.kind === 'firebomb' ? 7 : f.kind === 'shock' ? 3 : 2.5);
            break;
          case 'death':
            e.life = f.big ? 650 : 450;
            e.parts = Array.from({ length: f.big ? 10 : 6 }, (_, i) => ({ a: (i / (f.big ? 10 : 6)) * Math.PI * 2 + Math.random() * 0.5, v: 0.6 + Math.random() * 0.8 }));
            break;
          case 'tower':
            e.life = 1100;
            e.parts = Array.from({ length: 18 }, (_, i) => ({ a: (i / 18) * Math.PI * 2 + Math.random() * 0.3, v: 1 + Math.random() * 1.6 }));
            shake = Math.max(shake, f.king ? 14 : 9);
            break;
          default: e.life = 250;
        }
        effects.push(e);
        // Elixir spent pops up where the card landed
        if ((f.type === 'deploy' || f.type === 'cast') && f.cost) effects.push({ type: 'cost', x: f.x, y: f.y, cost: f.cost, owner: f.owner, born: now, life: 900 });
      }
      if (effects.length > 400) effects = effects.slice(-400);
    }

    function drawEffects(now) {
      effects = effects.filter((e) => now - e.born < e.life);
      for (const e of effects) {
        const t = (now - e.born) / e.life;
        const x = sx(e.x);
        const y = sy(e.y);
        const team = TEAM[e.owner] || TEAM.A;
        ctx.globalAlpha = 1 - t;
        switch (e.type) {
          case 'deploy':
            ctx.strokeStyle = team.light;
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(x, y, scale * (0.4 + easeOut(t) * (e.r || 1) * 1.2), 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = 'rgba(210,190,150,0.35)';
            for (let i = 0; i < 6; i++) {
              const a = (i / 6) * Math.PI * 2;
              ctx.beginPath(); ctx.arc(x + Math.cos(a) * scale * (0.5 + t), y + Math.sin(a) * scale * (0.3 + t * 0.6), scale * 0.18 * (1 - t), 0, Math.PI * 2); ctx.fill();
            }
            break;
          case 'cast':
            ctx.strokeStyle = team.light;
            ctx.lineWidth = Math.max(2, scale * 0.08);
            ctx.beginPath(); ctx.arc(x, y, scale * (e.r || 2) * (0.85 + 0.15 * t), 0, Math.PI * 2); ctx.stroke();
            break;
          case 'cost':
            ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
            outlinedText(`-${e.cost}`, x, y - scale * (0.6 + easeOut(t) * 1.1), scale * 0.55, '#f0a8ff', 'rgba(40,0,60,0.85)', 900);
            break;
          case 'dmg': {
            ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
            const pop = t < 0.15 ? 1 + (0.15 - t) * 3 : 1;
            outlinedText(String(e.amt), x + e.jx * scale, y - scale * (0.4 + easeOut(t) * 0.9), scale * (e.big ? 0.62 : 0.44) * pop, e.big ? '#ffdd55' : '#ffffff', 'rgba(0,0,0,0.85)', 900);
            break;
          }
          case 'hit':
            ctx.fillStyle = '#fff6c8';
            ctx.beginPath(); ctx.arc(x, y, scale * (0.12 + t * 0.25), 0, Math.PI * 2); ctx.fill();
            break;
          case 'splash':
            ctx.fillStyle = 'rgba(255,150,60,0.25)';
            ctx.beginPath(); ctx.arc(x, y, e.r * scale * (0.6 + t * 0.4), 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ffb35c';
            ctx.lineWidth = 2;
            ctx.stroke();
            break;
          case 'spell':
            drawSpellFx(e, x, y, t, team);
            break;
          case 'kingWake': {
            ctx.strokeStyle = '#ffe680';
            ctx.lineWidth = Math.max(2, scale * 0.12);
            ctx.beginPath(); ctx.arc(x, y, scale * (1.8 + easeOut(t) * 2.2), 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
            const hop = Math.abs(Math.sin(t * Math.PI * 3)) * scale * 0.4;
            outlinedText('!', x, y - scale * 2.6 - hop, scale * 1.3, '#ff5a5a', '#fff', 900);
            break;
          }
          case 'chain': {
            const x2 = sx(e.x2);
            const y2 = sy(e.y2);
            ctx.strokeStyle = '#bdf6ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, y);
            for (let i = 1; i < 5; i++) {
              const k = i / 5;
              ctx.lineTo(x + (x2 - x) * k + (Math.random() - 0.5) * scale * 0.4, y + (y2 - y) * k + (Math.random() - 0.5) * scale * 0.4);
            }
            ctx.lineTo(x2, y2);
            ctx.stroke();
            break;
          }
          case 'charge':
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(x, y, scale * (0.3 + t * 0.9), 0, Math.PI * 2); ctx.stroke();
            break;
          case 'death':
            e.parts.forEach((p) => {
              const d = scale * p.v * t * (e.big ? 1.3 : 0.9);
              ctx.fillStyle = p.v > 1.1 ? team.main : 'rgba(190,190,190,0.9)';
              ctx.beginPath(); ctx.arc(x + Math.cos(p.a) * d, y + Math.sin(p.a) * d - (e.air ? scale * 0.5 : 0), scale * 0.12 * (1 - t * 0.5), 0, Math.PI * 2); ctx.fill();
            });
            break;
          case 'tower':
            ctx.fillStyle = `rgba(255,${Math.round(180 - t * 120)},60,${0.55 * (1 - t)})`;
            ctx.beginPath(); ctx.arc(x, y, scale * (1 + t * 2.4), 0, Math.PI * 2); ctx.fill();
            e.parts.forEach((p) => {
              const d = scale * p.v * t * 2.6;
              ctx.fillStyle = '#5d5853';
              ctx.fillRect(x + Math.cos(p.a) * d, y + Math.sin(p.a) * d, scale * 0.22, scale * 0.22);
            });
            break;
          default:
            break;
        }
        ctx.globalAlpha = 1;
      }
    }

    function drawSpellFx(e, x, y, t, team) {
      const R = (e.r || 2.5) * scale;
      if (e.kind === 'firebomb') {
        const k = easeOut(clamp(t * 1.6, 0, 1));
        const fire = ctx.createRadialGradient(x, y, 0, x, y, R * (0.55 + 0.45 * k));
        fire.addColorStop(0, `rgba(255,250,210,${0.9 * (1 - t)})`);
        fire.addColorStop(0.35, `rgba(255,170,50,${0.75 * (1 - t)})`);
        fire.addColorStop(1, 'rgba(255,60,20,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = fire;
        ctx.beginPath(); ctx.arc(x, y, R * (0.55 + 0.45 * k), 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(255,200,120,${1 - t})`;
        ctx.lineWidth = Math.max(2, scale * 0.12 * (1 - t));
        ctx.beginPath(); ctx.arc(x, y, R * k, 0, Math.PI * 2); ctx.stroke();
        e.parts.forEach((p) => {
          const d = R * (0.3 + p.v * 0.9 * k);
          ctx.fillStyle = `rgba(255,${150 + Math.round(p.d * 100)},60,${1 - t})`;
          ctx.beginPath(); ctx.arc(x + Math.cos(p.a) * d, y + Math.sin(p.a) * d - t * scale * 0.6, scale * 0.1 * (1 - t), 0, Math.PI * 2); ctx.fill();
        });
      } else if (e.kind === 'shock') {
        ctx.fillStyle = `rgba(170,240,255,${0.45 * (1 - t)})`;
        ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(230,252,255,${1 - t})`;
        ctx.lineWidth = Math.max(1.5, scale * 0.07);
        for (let i = 0; i < 8; i++) {
          const a = e.parts[i].a;
          ctx.beginPath();
          ctx.moveTo(x, y);
          for (let k = 1; k <= 4; k++) {
            const d = (R * k) / 4;
            const j = (Math.random() - 0.5) * scale * 0.5;
            ctx.lineTo(x + Math.cos(a) * d + Math.cos(a + Math.PI / 2) * j, y + Math.sin(a) * d + Math.sin(a + Math.PI / 2) * j);
          }
          ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.strokeStyle = `${team.light}`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([scale * 0.25, scale * 0.2]);
        ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        e.parts.forEach((p) => {
          const px = x + Math.cos(p.a) * R * p.d * 0.85;
          const py = y + Math.sin(p.a) * R * p.d * 0.85;
          const k = easeOut(t);
          ctx.fillStyle = `rgba(255,${170 + Math.round(p.v * 40)},70,${0.85 * (1 - t)})`;
          ctx.beginPath(); ctx.arc(px, py, scale * (0.2 + k * 0.45), 0, Math.PI * 2); ctx.fill();
        });
      }
    }

    // ── HUD painted on the arena: clock and crowns ──
    function drawHud(view, now) {
      const me = flip ? 'B' : 'A';
      const foe = flip ? 'A' : 'B';
      const mins = Math.floor(view.timeLeft / 60);
      const secs = Math.floor(view.timeLeft % 60);
      const label = `${mins}:${String(secs).padStart(2, '0')}`;
      const x = canvas.width - scale * 0.2;
      const y = scale * 0.95;
      const big = Math.max(11, scale * 0.62);
      ctx.font = `900 ${big}px "Orbitron",sans-serif`;
      const w = Math.max(ctx.measureText(label).width, scale * 1.9) + scale * 0.6;
      const tag = view.phase === 'overtime' ? 'OVERTIME' : view.double ? '×2 ELIXIR' : 'TIME LEFT';
      ctx.fillStyle = 'rgba(5,10,20,0.75)';
      roundRect(ctx, x - w, y - big * 1.15, w, big * 2.15, scale * 0.25);
      ctx.fill();
      const urgent = view.timeLeft <= 10 && view.running;
      ctx.strokeStyle = urgent ? `rgba(255,107,107,${0.5 + 0.5 * Math.sin(now / 120)})` : view.double ? 'rgba(228,139,255,0.7)' : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = Math.max(1, scale * 0.06);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.max(7, scale * 0.26)}px "Space Grotesk",sans-serif`;
      ctx.fillStyle = view.phase === 'overtime' ? '#ffb347' : view.double ? '#e48bff' : '#9ab7cf';
      ctx.fillText(tag, x - w / 2, y - big * 0.62);
      ctx.font = `900 ${big}px "Orbitron",sans-serif`;
      ctx.fillStyle = urgent ? '#ff6b6b' : '#fff';
      ctx.fillText(label, x - w / 2, y + big * 0.25);
      // Crowns: opponent's at the top-left, mine at the bottom-left
      const crown = (n, top, side) => {
        const cy = top ? scale * 0.75 : canvas.height - scale * 0.75;
        ctx.fillStyle = 'rgba(5,10,20,0.68)';
        roundRect(ctx, scale * 0.2, cy - scale * 0.45, scale * 2.0, scale * 0.9, scale * 0.25);
        ctx.fill();
        ctx.fillStyle = TEAM[side].main;
        ctx.fillRect(scale * 0.2, cy - scale * 0.3, Math.max(2, scale * 0.08), scale * 0.6);
        drawSprite('👑', scale * 0.75, cy, scale * 0.55);
        ctx.font = `800 ${Math.max(10, scale * 0.5)}px "Orbitron",sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffe680';
        ctx.fillText(String(n), scale * 1.25, cy + 1);
      };
      crown(view.players[foe].crowns, true, foe);
      crown(view.players[me].crowns, false, me);
    }

    // ── Placement ghost ──
    function drawGhost(ghost) {
      if (!ghost) return;
      const card = Sim.CARD_MAP[ghost.cardId];
      if (!card) return;
      const x = sx(ghost.x);
      const y = sy(ghost.y);
      const team = TEAM[ghost.owner];
      if (card.spell) {
        const R = card.splash * scale;
        ctx.fillStyle = ghost.valid ? `${team.main}33` : 'rgba(128,32,32,0.3)';
        ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = ghost.valid ? 'rgba(255,255,255,0.85)' : 'rgba(255,80,80,0.9)';
        ctx.setLineDash([scale * 0.3, scale * 0.2]);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
        drawSprite(card.icon, x, y, scale * 0.9, 0.85);
      } else {
        const r = card.radius * scale;
        const count = card.swarmCount || 1;
        const color = ghost.valid ? 'rgba(255,255,255,0.85)' : 'rgba(255,80,80,0.9)';
        if (card.range >= 2 && ghost.valid) {
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.setLineDash([5, 5]);
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(x, y, (card.range + card.radius) * scale, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
        }
        for (let i = 0; i < count; i++) {
          let ox = 0;
          let oy = 0;
          if (count > 1) {
            const ring = (0.45 + count * 0.1) * scale;
            const a = (i / count) * Math.PI * 2 + 0.4;
            ox = Math.cos(a) * ring * (flip ? -1 : 1);
            oy = Math.sin(a) * ring * (flip ? -1 : 1);
          }
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = ghost.valid ? team.main : '#802020';
          ctx.beginPath(); ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.stroke();
          drawSprite(card.icon, x + ox, y + oy, r * 1.4, 0.8);
        }
      }
      if (!ghost.valid && ghost.reason) {
        const r = card.spell ? card.splash * scale * 0.3 : card.radius * scale;
        ctx.font = `700 ${Math.max(10, scale * 0.4)}px "Space Grotesk",sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.strokeText(ghost.reason, x, y - r - scale * 0.5);
        ctx.fillStyle = '#ffd0d0';
        ctx.fillText(ghost.reason, x, y - r - scale * 0.5);
      }
    }

    function drawWater(now) {
      // Animated ripples over the river (cheap: a few sine strokes)
      const ry0 = Sim.RIVER.y0 * scale;
      const ry1 = Sim.RIVER.y1 * scale;
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = Math.max(1, scale * 0.05);
      for (let k = 0; k < 3; k++) {
        const base = ry0 + (ry1 - ry0) * (0.25 + k * 0.25);
        ctx.beginPath();
        for (let x = 0; x <= canvas.width; x += scale * 0.5) {
          const yy = base + Math.sin(x / (scale * 1.3) + now / 600 + k * 2) * scale * 0.08;
          if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      // Bridges sit on top of the ripples
      Sim.BRIDGES.forEach((b) => {
        ctx.drawImage(bg, b.x0 * scale - scale * 0.2, ry0 - scale * 0.35, (b.x1 - b.x0) * scale + scale * 0.45, ry1 - ry0 + scale * 0.7,
          b.x0 * scale - scale * 0.2, ry0 - scale * 0.35, (b.x1 - b.x0) * scale + scale * 0.45, ry1 - ry0 + scale * 0.7);
      });
    }

    // Forget per-unit animation state for units that are gone
    function pruneMotion(now) {
      if (motion.size < 64 && hpShown.size < 96) return;
      for (const [id, m] of motion) if (now - m.seen > 1000) { motion.delete(id); hpShown.delete(id); }
    }

    /**
     * view: interpolated snapshot. opts: { flip, zoneFn, zoneKey, ghost }
     */
    function render(view, opts) {
      const o = opts || {};
      if (flip !== !!o.flip) { flip = !!o.flip; zoneCache.key = ''; bg = null; }
      if (!bg) drawBackground();
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastNow) / 1000);
      lastNow = now;
      ctx.save();
      if (shake > 0.2) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        shake *= 0.88;
      }
      ctx.drawImage(bg, 0, 0);
      drawWater(now);
      if (view) {
        watchPhase(view);
        if (o.zoneFn) drawZones(o.zoneFn, o.zoneKey);
        drawCountdown(view, now);
        // Draw back-to-front so nearer things overlap farther ones
        const ground = [];
        const air = [];
        view.towers.forEach((t) => ground.push({ kind: 't', y: sy(t.y), e: t }));
        view.units.forEach((u) => (u.air ? air : ground).push({ kind: 'u', y: sy(u.y), e: u }));
        ground.sort((a, b) => a.y - b.y);
        air.sort((a, b) => a.y - b.y);
        ground.forEach((d) => (d.kind === 't' ? drawTower(d.e, now, dt) : drawUnit(d.e, now, dt)));
        view.projectiles.forEach((p) => drawProjectile(p, now));
        air.forEach((d) => drawUnit(d.e, now, dt));
        drawEffects(now);
        drawGhost(o.ghost);
        drawEmotes(view, now);
        drawHud(view, now);
        drawBanner(now);
        pruneMotion(now);
      }
      ctx.restore();
    }

    function setNames(n) { names = Object.assign({}, names, n); }

    function reset() {
      effects = [];
      banners = [];
      emotes.A = null;
      emotes.B = null;
      hpShown.clear();
      motion.clear();
    }

    resize();
    const api = { render, resize, toWorld, addFx, announce, showEmote, setNames, reset, onCue: null, get flip() { return flip; } };
    return api;
  }

  window.ArenaView = { create, TEAM };
})();
