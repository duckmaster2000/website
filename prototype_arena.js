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

  // Battlefield looks, one per Trophy Road arena (names match TrophyRoad.ARENAS[].theme)
  const THEMES = {
    meadow: { grass: ['#4c923f', '#559d47'], lane: 'rgba(222,196,132,0.32)', tuft: ['rgba(40,95,35,0.55)', 'rgba(120,190,90,0.45)'], decor: 'flowers', water: ['#2a7fc9', '#3fa4ea'], ripple: 'rgba(255,255,255,0.18)', bank: 'rgba(70,48,24,0.45)', wood: ['#8a5d32', '#a8774a'], plank: '#6e4826', pad: 'rgba(120,112,98,0.55)', vignette: 'rgba(0,20,0,0.35)' },
    scrap: { grass: ['#6b5a45', '#75634c'], lane: 'rgba(60,45,30,0.4)', tuft: ['rgba(40,30,20,0.5)', 'rgba(150,120,80,0.35)'], decor: 'scrap', water: ['#3b4a3a', '#56664a'], ripple: 'rgba(200,220,150,0.18)', bank: 'rgba(40,30,20,0.55)', wood: ['#6c6f75', '#8b8f96'], plank: '#4a4d52', pad: 'rgba(90,85,80,0.65)', vignette: 'rgba(20,10,0,0.45)' },
    frost: { grass: ['#dbeaf5', '#e7f2fa'], lane: 'rgba(160,190,215,0.45)', tuft: ['rgba(150,180,210,0.6)', 'rgba(255,255,255,0.7)'], decor: 'snow', water: ['#7fc4ec', '#b8e4fa'], ripple: 'rgba(255,255,255,0.45)', bank: 'rgba(120,150,180,0.5)', wood: ['#8a6a4a', '#a7845e'], plank: '#6a4d32', pad: 'rgba(150,165,180,0.6)', vignette: 'rgba(40,70,110,0.3)' },
    dunes: { grass: ['#e3bf78', '#e9c785'], lane: 'rgba(170,120,60,0.35)', tuft: ['rgba(160,110,50,0.45)', 'rgba(255,230,170,0.5)'], decor: 'cactus', water: ['#2e9fb8', '#4cc3d6'], ripple: 'rgba(255,255,255,0.22)', bank: 'rgba(150,100,40,0.5)', wood: ['#9a6a38', '#b78550'], plank: '#7a4f25', pad: 'rgba(170,140,100,0.6)', vignette: 'rgba(90,50,0,0.3)' },
    jungle: { grass: ['#2f7a3d', '#358545'], lane: 'rgba(110,90,60,0.4)', tuft: ['rgba(15,60,25,0.6)', 'rgba(110,200,110,0.45)'], decor: 'ferns', water: ['#1f6f6a', '#2c8f85'], ripple: 'rgba(200,255,230,0.2)', bank: 'rgba(40,40,20,0.55)', wood: ['#6a4a2a', '#86603a'], plank: '#4f351c', pad: 'rgba(100,110,90,0.65)', vignette: 'rgba(0,25,5,0.5)' },
    volcano: { grass: ['#3a2a28', '#43302d'], lane: 'rgba(20,10,8,0.45)', tuft: ['rgba(15,8,6,0.6)', 'rgba(255,120,40,0.25)'], decor: 'embers', water: ['#ff5a14', '#ffb020'], ripple: 'rgba(255,240,180,0.45)', bank: 'rgba(20,8,4,0.7)', wood: ['#4b4b52', '#66666f'], plank: '#2e2e33', pad: 'rgba(70,60,58,0.75)', vignette: 'rgba(40,0,0,0.5)', lava: true },
    neon: { grass: ['#151534', '#191a3d'], lane: 'rgba(95,242,255,0.18)', tuft: ['rgba(95,242,255,0.18)', 'rgba(255,90,220,0.18)'], decor: 'grid', water: ['#2a0f5c', '#5a1fb0'], ripple: 'rgba(95,242,255,0.5)', bank: 'rgba(95,242,255,0.35)', wood: ['#2b2f55', '#3d4378'], plank: '#5ff2ff', pad: 'rgba(60,70,130,0.7)', vignette: 'rgba(0,0,20,0.55)' },
    sky: { grass: ['#bfe0ff', '#cbe7ff'], lane: 'rgba(255,255,255,0.55)', tuft: ['rgba(255,255,255,0.7)', 'rgba(160,200,255,0.5)'], decor: 'clouds', water: ['#e9f5ff', '#ffffff'], ripple: 'rgba(140,190,255,0.5)', bank: 'rgba(150,190,240,0.5)', wood: ['#c9a46a', '#e0bf86'], plank: '#9c7a45', pad: 'rgba(180,200,230,0.7)', vignette: 'rgba(60,110,200,0.25)' },
    royal: { grass: ['#d8cfbd', '#e2d9c7'], lane: 'rgba(170,140,80,0.35)', tuft: ['rgba(180,160,120,0.45)', 'rgba(255,240,200,0.5)'], decor: 'marble', water: ['#2a6fb8', '#3f93d8'], ripple: 'rgba(255,230,140,0.35)', bank: 'rgba(160,130,60,0.55)', wood: ['#b8962e', '#d9b44a'], plank: '#8a6a1a', pad: 'rgba(200,180,140,0.75)', vignette: 'rgba(80,60,0,0.3)' },
    legend: { grass: ['#2a1a4a', '#311f55'], lane: 'rgba(255,211,95,0.18)', tuft: ['rgba(255,211,95,0.25)', 'rgba(170,120,255,0.3)'], decor: 'stars', water: ['#3a1f7a', '#6a3fc0'], ripple: 'rgba(255,211,95,0.45)', bank: 'rgba(255,211,95,0.3)', wood: ['#5a3a1a', '#7a5228'], plank: '#ffd35f', pad: 'rgba(110,80,160,0.7)', vignette: 'rgba(10,0,30,0.55)' },
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
    let themeName = 'meadow';
    let T = THEMES.meadow;
    const emotes = { A: null, B: null };     // { id, born }
    let banners = [];                        // queued announcements
    const hpShown = new Map();               // id -> trailing health fraction
    const motion = new Map();                // id -> { x, y, moving }
    let lastNow = performance.now();
    const watch = { time: -1, double: false, phase: 'regular' };
    let ribbons = [];                        // small notices at the top of the arena (events)
    const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

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
          g.fillStyle = (tx + ty) % 2 ? T.grass[0] : T.grass[1];
          g.fillRect(tx * s, ty * s, s + 1, s + 1);
        }
      }
      // Lanes from tower to tower and plazas around the kings (symmetric, so no flip needed)
      g.strokeStyle = T.lane;
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
        g.strokeStyle = rand() < 0.5 ? T.tuft[0] : T.tuft[1];
        g.lineWidth = Math.max(1, s * 0.045);
        g.beginPath();
        g.moveTo(x * s - s * 0.08, y * s - s * 0.12);
        g.lineTo(x * s, y * s);
        g.lineTo(x * s + s * 0.08, y * s - s * 0.12);
        g.stroke();
      }
      drawDecor(g, rand, s);
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
      g.fillStyle = T.bank;
      g.fillRect(0, ry0 - s * 0.22, bg.width, s * 0.22);
      g.fillRect(0, ry1, bg.width, s * 0.22);
      const water = g.createLinearGradient(0, ry0, 0, ry1);
      water.addColorStop(0, T.water[0]);
      water.addColorStop(0.5, T.water[1]);
      water.addColorStop(1, T.water[0]);
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
        wood.addColorStop(0, T.wood[0]);
        wood.addColorStop(0.5, T.wood[1]);
        wood.addColorStop(1, T.wood[0]);
        g.fillStyle = wood;
        g.fillRect(x0, y0, x1 - x0, y1 - y0);
        g.strokeStyle = T.plank;
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
          g.fillStyle = T.pad;
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
        gr.addColorStop(0, T.vignette);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(rx, ry, rw, rh);
      });
    }

    // Theme decorations scattered along the edges (kept away from the river)
    function drawDecor(g, rand, s) {
      const spot = () => {
        const x = rand() < 0.5 ? rand() * 1.4 + 0.2 : W - 0.2 - rand() * 1.4;
        const y = rand() * H;
        return y > Sim.RIVER.y0 - 0.6 && y < Sim.RIVER.y1 + 0.6 ? null : { x: x * s, y: y * s };
      };
      for (let i = 0; i < 46; i++) {
        const p = spot();
        if (!p) continue;
        switch (T.decor) {
          case 'flowers': {
            g.fillStyle = ['#fff7d6', '#ffd6e7', '#ffe36b', '#cfe8ff'][i % 4];
            for (let k = 0; k < 4; k++) {
              const a = (k / 4) * Math.PI * 2;
              g.beginPath(); g.arc(p.x + Math.cos(a) * s * 0.07, p.y + Math.sin(a) * s * 0.07, s * 0.055, 0, Math.PI * 2); g.fill();
            }
            g.fillStyle = '#e8a400';
            g.beginPath(); g.arc(p.x, p.y, s * 0.04, 0, Math.PI * 2); g.fill();
            break;
          }
          case 'scrap':
            g.fillStyle = ['#8b8f96', '#a0522d', '#5a5d63'][i % 3];
            g.save(); g.translate(p.x, p.y); g.rotate(rand() * 3);
            g.fillRect(-s * 0.12, -s * 0.05, s * 0.24, s * 0.1);
            g.restore();
            if (i % 5 === 0) { g.fillStyle = 'rgba(20,20,20,0.35)'; g.beginPath(); g.ellipse(p.x, p.y, s * 0.3, s * 0.15, 0, 0, Math.PI * 2); g.fill(); }
            break;
          case 'snow':
            g.fillStyle = 'rgba(255,255,255,0.9)';
            g.beginPath(); g.arc(p.x, p.y, s * (0.06 + rand() * 0.08), 0, Math.PI * 2); g.fill();
            if (i % 6 === 0) { g.fillStyle = '#5c8a6a'; g.beginPath(); g.moveTo(p.x, p.y - s * 0.35); g.lineTo(p.x - s * 0.18, p.y + s * 0.1); g.lineTo(p.x + s * 0.18, p.y + s * 0.1); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(p.x, p.y - s * 0.35); g.lineTo(p.x - s * 0.08, p.y - s * 0.15); g.lineTo(p.x + s * 0.08, p.y - s * 0.15); g.fill(); }
            break;
          case 'cactus':
            if (i % 4 === 0) {
              g.fillStyle = '#4f8a3a';
              g.fillRect(p.x - s * 0.05, p.y - s * 0.3, s * 0.1, s * 0.32);
              g.fillRect(p.x - s * 0.17, p.y - s * 0.2, s * 0.08, s * 0.12);
              g.fillRect(p.x + s * 0.09, p.y - s * 0.24, s * 0.08, s * 0.12);
            } else { g.fillStyle = 'rgba(150,100,40,0.35)'; g.beginPath(); g.arc(p.x, p.y, s * 0.06, 0, Math.PI * 2); g.fill(); }
            break;
          case 'ferns':
            g.strokeStyle = i % 2 ? '#1e5a2c' : '#4caf62';
            g.lineWidth = Math.max(1, s * 0.05);
            for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(p.x, p.y); g.quadraticCurveTo(p.x + k * s * 0.08, p.y - s * 0.2, p.x + k * s * 0.15, p.y - s * 0.32); g.stroke(); }
            break;
          case 'embers':
            g.fillStyle = i % 3 ? 'rgba(255,110,30,0.55)' : 'rgba(255,200,80,0.7)';
            g.beginPath(); g.arc(p.x, p.y, s * (0.03 + rand() * 0.05), 0, Math.PI * 2); g.fill();
            if (i % 5 === 0) { g.fillStyle = 'rgba(15,8,6,0.6)'; g.beginPath(); g.arc(p.x, p.y, s * 0.22, 0, Math.PI * 2); g.fill(); }
            break;
          case 'grid':
            if (i === 0) {
              g.strokeStyle = 'rgba(95,242,255,0.08)';
              g.lineWidth = 1;
              for (let gx = 0; gx <= W; gx += 1) { g.beginPath(); g.moveTo(gx * s, 0); g.lineTo(gx * s, H * s); g.stroke(); }
              for (let gy = 0; gy <= H; gy += 1) { g.beginPath(); g.moveTo(0, gy * s); g.lineTo(W * s, gy * s); g.stroke(); }
            }
            g.fillStyle = i % 2 ? 'rgba(95,242,255,0.6)' : 'rgba(255,90,220,0.55)';
            g.fillRect(p.x - s * 0.04, p.y - s * 0.04, s * 0.08, s * 0.08);
            break;
          case 'clouds':
            g.fillStyle = 'rgba(255,255,255,0.75)';
            [[-0.15, 0, 0.16], [0.05, -0.05, 0.2], [0.22, 0.02, 0.14]].forEach(([dx, dy, r]) => { g.beginPath(); g.arc(p.x + dx * s, p.y + dy * s, r * s, 0, Math.PI * 2); g.fill(); });
            break;
          case 'marble':
            g.strokeStyle = 'rgba(150,130,100,0.35)';
            g.lineWidth = Math.max(1, s * 0.03);
            g.beginPath(); g.moveTo(p.x - s * 0.3, p.y); g.quadraticCurveTo(p.x, p.y - s * 0.15, p.x + s * 0.3, p.y + s * 0.05); g.stroke();
            if (i % 6 === 0) { g.fillStyle = '#d9b44a'; g.fillRect(p.x - s * 0.06, p.y - s * 0.06, s * 0.12, s * 0.12); }
            break;
          case 'stars':
            g.fillStyle = i % 3 ? 'rgba(255,211,95,0.8)' : 'rgba(200,170,255,0.8)';
            g.save(); g.translate(p.x, p.y); g.rotate(rand());
            g.beginPath();
            for (let k = 0; k < 8; k++) { const r = k % 2 ? s * 0.03 : s * 0.09; const a = (k / 8) * Math.PI * 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
            g.fill();
            g.restore();
            break;
          default: break;
        }
      }
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
      if (t.frz) {
        ctx.fillStyle = 'rgba(170,230,255,0.5)';
        roundRect(ctx, x - half, y - half, half * 2, half * 2, scale * 0.3);
        ctx.fill();
        drawSprite('❄️', x + half * 0.55, y - half * 0.55, half * 0.5, 0.9);
      } else if (t.stn) stunSparks(x, y, half * 0.8, now);
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
      if (u.hid) { drawBurrowed(u, card, team, now); return; }
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

      // Evolved units: a violet/gold aura under the body
      if (u.evo) drawEvoAura(x, y - lift - drop - bob, r, now, u.air);

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
      drawStatus(u, x, y, r, face, team, now);
      if (u.evo) drawEvoCrest(u, x, y, r, now);
      if (u.form || u.boss || u.mn) drawEventBadge(u, x, y, r, now);
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
      const barW = Math.max(scale * 0.8, r * 2);
      if (u.hp < u.hpMax || u.building || (u.shd != null && u.shd < 1)) hpBar(u.id, x, y - r - scale * 0.28, barW, u.hp / u.hpMax, u.owner, null, dt);
      if (u.shd > 0) {
        // Shield bar sits on top of the health bar
        const bh = Math.max(3, scale * 0.12);
        const by = y - r - scale * 0.28 - bh - 2;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x - barW / 2 - 1, by - 1, barW + 2, bh + 2);
        ctx.fillStyle = '#7fe8ff';
        ctx.fillRect(x - barW / 2, by, barW * u.shd, bh);
      }
    }

    const EVO1 = '#b45cff';
    const EVO2 = '#ffcf3a';

    function drawEvoAura(x, y, r, now, air) {
      const pulse = 0.5 + 0.5 * Math.sin(now / 260);
      const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 1.7);
      g.addColorStop(0, `rgba(180,92,255,${0.35 + 0.15 * pulse})`);
      g.addColorStop(1, 'rgba(180,92,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r * 1.7, 0, Math.PI * 2); ctx.fill();
      // Orbiting gold sparks
      for (let i = 0; i < 3; i++) {
        const a = now / 500 + (i * Math.PI * 2) / 3;
        const px = x + Math.cos(a) * r * 1.35;
        const py = y + Math.sin(a) * r * (air ? 1.35 : 0.7);
        ctx.fillStyle = EVO2;
        ctx.beginPath();
        ctx.moveTo(px, py - scale * 0.1); ctx.lineTo(px + scale * 0.05, py); ctx.lineTo(px, py + scale * 0.1); ctx.lineTo(px - scale * 0.05, py);
        ctx.fill();
      }
    }

    // Gradient rim, crest, and stack/rally readouts so evolved units read at a glance
    function drawEvoCrest(u, x, y, r, now) {
      const rim = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
      rim.addColorStop(0, EVO1);
      rim.addColorStop(1, EVO2);
      ctx.strokeStyle = rim;
      ctx.lineWidth = Math.max(2, scale * 0.1);
      ctx.beginPath(); ctx.arc(x, y, r * (u.building ? 1.25 : 1.02), 0, Math.PI * 2); ctx.stroke();
      outlinedText('✦', x + r * 0.85, y - r * 0.85, Math.max(9, scale * 0.42), EVO2, 'rgba(60,0,90,0.9)', 900);
      if (u.stk) {
        for (let i = 0; i < u.stk; i++) {
          ctx.fillStyle = '#7ff3ff';
          ctx.beginPath(); ctx.arc(x - r * 0.6 + i * r * 0.6, y + r * 1.05, Math.max(2, scale * 0.08), 0, Math.PI * 2); ctx.fill();
        }
      }
      if (u.rly) {
        ctx.fillStyle = `rgba(255,80,60,${0.25 + 0.2 * Math.sin(now / 90)})`;
        ctx.beginPath(); ctx.arc(x, y, r * (1 + u.rly), 0, Math.PI * 2); ctx.fill();
      }
      if (u.dv) {
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x + i * r * 0.4, y - r * 2.4); ctx.lineTo(x + i * r * 0.2, y - r * 1.2); ctx.stroke(); }
      }
    }

    // A burrowed building: a dirt mound with a twitching antenna
    function drawBurrowed(u, card, team, now) {
      const x = sx(u.x);
      const y = sy(u.y);
      const r = u.radius * scale;
      ctx.fillStyle = 'rgba(70,50,30,0.85)';
      ctx.beginPath(); ctx.ellipse(x, y, r * 0.95, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(120,90,60,0.9)';
      for (let i = 0; i < 5; i++) {
        const a = i * 1.3;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.28, r * 0.16, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = team.light;
      ctx.lineWidth = Math.max(1.5, scale * 0.06);
      const tw = Math.sin(now / 140) * r * 0.12;
      ctx.beginPath(); ctx.moveTo(x, y - r * 0.2); ctx.lineTo(x + tw, y - r * 0.85); ctx.stroke();
      ctx.fillStyle = `rgba(160,240,255,${0.6 + 0.4 * Math.sin(now / 200)})`;
      ctx.beginPath(); ctx.arc(x + tw, y - r * 0.85, r * 0.12, 0, Math.PI * 2); ctx.fill();
      if (card) drawSprite(card.icon, x + r * 0.55, y + r * 0.1, r * 0.6, 0.45);
    }

    // Frozen, slowed, hasted, shielded, dashing and healing looks
    function drawStatus(u, x, y, r, face, team, now) {
      if (u.inv) {
        // Afterimages trailing behind a dash
        for (let i = 1; i <= 3; i++) {
          ctx.fillStyle = `rgba(200,220,255,${0.25 - i * 0.06})`;
          ctx.beginPath(); ctx.arc(x - Math.cos(face) * r * i * 0.9, y - Math.sin(face) * r * i * 0.9, r * (1 - i * 0.12), 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, r * 1.1, 0, Math.PI * 2); ctx.stroke();
      }
      if (u.hst) {
        ctx.strokeStyle = 'rgba(255,140,40,0.85)';
        ctx.lineWidth = Math.max(1.5, scale * 0.06);
        for (let i = -1; i <= 1; i++) {
          const bx = x - Math.cos(face) * r * 1.2 + Math.cos(face + Math.PI / 2) * i * r * 0.45;
          const by = y - Math.sin(face) * r * 1.2 + Math.sin(face + Math.PI / 2) * i * r * 0.45;
          const len = r * (0.6 + 0.3 * Math.sin(now / 60 + i));
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - Math.cos(face) * len, by - Math.sin(face) * len); ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(255,170,60,0.5)';
        ctx.beginPath(); ctx.arc(x, y, r * 1.15, 0, Math.PI * 2); ctx.stroke();
      }
      if (u.slw) {
        ctx.fillStyle = 'rgba(120,60,200,0.22)';
        ctx.beginPath(); ctx.arc(x, y, r * 1.05, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(150,90,230,0.85)';
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI + 0.3;
          const drip = ((now / 600 + i * 0.33) % 1) * r * 0.5;
          ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.7, y + r * 0.5 + drip, Math.max(1.5, r * 0.1), 0, Math.PI * 2); ctx.fill();
        }
      }
      if (u.shd > 0) {
        ctx.strokeStyle = `rgba(127,232,255,${0.5 + 0.4 * u.shd})`;
        ctx.lineWidth = Math.max(2, scale * 0.09);
        ctx.beginPath(); ctx.arc(x, y, r * 1.12, face - 1.1, face + 1.1); ctx.stroke();
      }
      if (u.frz) {
        ctx.fillStyle = 'rgba(170,230,255,0.55)';
        ctx.beginPath(); ctx.arc(x, y, r * 1.08, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = Math.max(1.2, scale * 0.04);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.3;
          ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3); ctx.lineTo(x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95); ctx.stroke();
        }
      }
      if (u.hl) {
        ctx.fillStyle = 'rgba(110,255,140,0.9)';
        ctx.font = `900 ${Math.max(8, r * 0.7)}px "Space Grotesk",sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < 2; i++) {
          const k = (now / 700 + i * 0.5) % 1;
          ctx.globalAlpha = 1 - k;
          ctx.fillText('+', x + (i ? r * 0.5 : -r * 0.5), y - r * (0.5 + k * 1.1));
        }
        ctx.globalAlpha = 1;
      }
    }

    // Ramp-up beams (Inferno Spire): a line to the target that thickens and whitens as it heats
    function drawBeams(view, byId, now) {
      view.units.forEach((u) => {
        if (!u.tgt) return;
        const t = byId.get(u.tgt);
        if (!t) return;
        const x0 = sx(u.x);
        const y0 = sy(u.y) - (u.building ? u.radius * scale * 0.4 : 0);
        const x1 = sx(t.x);
        const y1 = sy(t.y);
        const heat = u.rmp || 0;
        const wob = Math.sin(now / 40) * scale * 0.04;
        ctx.strokeStyle = `rgba(255,${Math.round(200 - heat * 150)},${Math.round(60 - heat * 40)},0.85)`;
        ctx.lineWidth = Math.max(2, scale * (0.08 + heat * 0.22));
        ctx.shadowColor = '#ff6a00';
        ctx.shadowBlur = 8 + heat * 10;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 + wob, y1 + wob); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,220,0.9)';
        ctx.lineWidth = Math.max(1, scale * 0.04 * (1 + heat));
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 + wob, y1 + wob); ctx.stroke();
        ctx.shadowBlur = 0;
      });
    }

    // ── Lingering spell areas ──
    function drawZoneDecal(z, now) {
      const x = sx(z.x);
      const y = sy(z.y);
      const R = z.r * scale;
      const team = TEAM[z.owner] || TEAM.A;
      const fade = z.dur ? clamp((z.dur - z.age) / 0.5, 0, 1) : 1;
      const grow = clamp(z.age / 0.25, 0, 1);
      ctx.save();
      ctx.globalAlpha = fade;
      if (z.evo && drawEvoZone(z, x, y, R, now, grow)) { ctx.restore(); return; }
      switch (z.kind) {
        case 'dot': {
          const g = ctx.createRadialGradient(x, y, R * 0.2, x, y, R);
          g.addColorStop(0, 'rgba(120,255,90,0.45)');
          g.addColorStop(1, 'rgba(60,180,40,0.15)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x, y, R * grow, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(170,255,120,0.75)';
          ctx.lineWidth = Math.max(1.5, scale * 0.06);
          ctx.stroke();
          for (let i = 0; i < 10; i++) {
            const a = i * 2.4 + i;
            const d = ((i * 37) % 10) / 10 * R * 0.85;
            const k = (now / 900 + i * 0.13) % 1;
            ctx.fillStyle = `rgba(200,255,150,${0.7 * (1 - k)})`;
            ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d - k * scale * 0.3, scale * (0.05 + k * 0.08), 0, Math.PI * 2); ctx.fill();
          }
          break;
        }
        case 'slow': {
          ctx.fillStyle = 'rgba(30,20,12,0.6)';
          ctx.beginPath();
          for (let i = 0; i <= 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            const rr = R * grow * (0.9 + 0.1 * Math.sin(a * 3 + 1));
            if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
          }
          ctx.fill();
          ctx.fillStyle = 'rgba(140,110,80,0.35)';
          ctx.beginPath(); ctx.ellipse(x - R * 0.25, y - R * 0.25, R * 0.3, R * 0.12, -0.6, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'haste': {
          ctx.strokeStyle = team.light;
          ctx.lineWidth = Math.max(2, scale * 0.08);
          ctx.setLineDash([scale * 0.4, scale * 0.25]);
          ctx.lineDashOffset = -now / 30;
          ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(255,150,50,0.14)';
          ctx.fill();
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + now / 500;
            drawSprite('⏩', x + Math.cos(a) * R * 0.65, y + Math.sin(a) * R * 0.65, scale * 0.45, 0.5);
          }
          break;
        }
        case 'heal': {
          ctx.fillStyle = 'rgba(90,255,140,0.16)';
          ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(130,255,170,0.8)';
          ctx.lineWidth = Math.max(1.5, scale * 0.06);
          ctx.stroke();
          ctx.fillStyle = 'rgba(160,255,190,0.85)';
          for (let i = 0; i < 8; i++) {
            const a = i * 0.785;
            const k = (now / 1000 + i * 0.125) % 1;
            const px = x + Math.cos(a) * R * 0.6;
            const py = y + Math.sin(a) * R * 0.6 - k * scale * 0.8;
            ctx.globalAlpha = fade * (1 - k);
            ctx.fillRect(px - scale * 0.04, py - scale * 0.12, scale * 0.08, scale * 0.24);
            ctx.fillRect(px - scale * 0.12, py - scale * 0.04, scale * 0.24, scale * 0.08);
          }
          break;
        }
        case 'pull': {
          ctx.strokeStyle = 'rgba(190,120,255,0.8)';
          ctx.lineWidth = Math.max(1.5, scale * 0.07);
          for (let arm = 0; arm < 3; arm++) {
            ctx.beginPath();
            for (let k = 0; k <= 24; k++) {
              const t = k / 24;
              const a = arm * 2.094 + t * 5 - now / 180;
              const rr = R * (1 - t) * grow;
              if (k) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
            }
            ctx.stroke();
          }
          const g = ctx.createRadialGradient(x, y, 0, x, y, R * 0.4);
          g.addColorStop(0, 'rgba(20,0,40,0.8)');
          g.addColorStop(1, 'rgba(120,60,200,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x, y, R * 0.4, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'laser': {
          // Lock-on reticle that tightens until the strike
          const k = z.wait > 0 ? 1 - z.wait / 0.9 : 1;
          ctx.strokeStyle = `rgba(255,60,60,${0.5 + 0.5 * k})`;
          ctx.lineWidth = Math.max(1.5, scale * 0.07);
          ctx.beginPath(); ctx.arc(x, y, R * (1.3 - 0.3 * k), 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(x, y, R * 0.25, 0, Math.PI * 2); ctx.stroke();
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + now / 400;
            ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * R * 0.3, y + Math.sin(a) * R * 0.3); ctx.lineTo(x + Math.cos(a) * R * 1.1, y + Math.sin(a) * R * 1.1); ctx.stroke();
          }
          break;
        }
        case 'spawn': {
          ctx.strokeStyle = team.light;
          ctx.lineWidth = Math.max(1.5, scale * 0.06);
          ctx.setLineDash([scale * 0.3, scale * 0.2]);
          ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          break;
        }
        default: break;
      }
      ctx.restore();
    }

    // Evolution zones have their own looks (returns true when drawn)
    function drawEvoZone(z, x, y, R, now, grow) {
      if (z.kind === 'slow' && z.cardId === 'siege') {
        // Earthshaker crater: cracked, dusty ground
        ctx.fillStyle = 'rgba(70,45,25,0.55)';
        ctx.beginPath(); ctx.arc(x, y, R * grow, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(30,18,10,0.8)';
        ctx.lineWidth = Math.max(1.5, scale * 0.06);
        for (let i = 0; i < 6; i++) {
          const a = i * 1.05 + 0.3;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * R * 0.5, y + Math.sin(a) * R * 0.5); ctx.lineTo(x + Math.cos(a + 0.3) * R * 0.95, y + Math.sin(a + 0.3) * R * 0.95); ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(180,92,255,0.6)';
        ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
        return true;
      }
      if (z.kind === 'dot' && z.cardId === 'firebomb') {
        // Napalm: low flames licking up across the patch
        ctx.fillStyle = 'rgba(255,90,20,0.22)';
        ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < 12; i++) {
          const a = i * 2.39;
          const d = ((i * 53) % 10) / 10 * R * 0.85;
          const fx = x + Math.cos(a) * d;
          const fy = y + Math.sin(a) * d;
          const h = scale * (0.25 + 0.2 * Math.sin(now / 90 + i));
          ctx.fillStyle = i % 2 ? 'rgba(255,170,40,0.85)' : 'rgba(255,90,20,0.85)';
          ctx.beginPath(); ctx.moveTo(fx - scale * 0.1, fy); ctx.quadraticCurveTo(fx, fy - h * 2, fx + scale * 0.1, fy); ctx.fill();
        }
        return true;
      }
      if (z.kind === 'echo') {
        // Overload: a tightening ring until the aftershock lands
        const k = z.wait > 0 ? 1 - z.wait / 0.8 : 1;
        ctx.strokeStyle = `rgba(180,240,255,${0.4 + 0.5 * k})`;
        ctx.lineWidth = Math.max(2, scale * 0.08);
        ctx.setLineDash([scale * 0.25, scale * 0.15]);
        ctx.beginPath(); ctx.arc(x, y, R * (1.4 - 0.4 * k), 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(180,92,255,0.7)';
        ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
        return true;
      }
      return false;
    }

    // Rolling boulders and thrown blades are objects, drawn over ground troops
    function drawZoneObject(z, now) {
      const x = sx(z.x);
      const y = sy(z.y);
      if (z.kind === 'roll') {
        const r = scale * 0.85;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(x, y + r * 0.6, r, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(z.age * 9 * (flip ? -1 : 1) * (z.owner === 'A' ? -1 : 1));
        const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
        g.addColorStop(0, '#b9b2a8');
        g.addColorStop(1, '#5d564e');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(40,36,30,0.7)';
        ctx.lineWidth = Math.max(1.5, scale * 0.06);
        ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.2); ctx.lineTo(r * 0.1, r * 0.1); ctx.lineTo(r * 0.5, -r * 0.5); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = 'rgba(200,180,150,0.35)';
        for (let i = 0; i < 4; i++) {
          ctx.beginPath(); ctx.arc(x + (Math.random() - 0.5) * r * 2, y + r * 0.5 + Math.random() * r * 0.4, scale * 0.12, 0, Math.PI * 2); ctx.fill();
        }
      } else if (z.kind === 'blade') {
        const team = TEAM[z.owner] || TEAM.A;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(now / 40);
        ctx.fillStyle = '#dfe6ee';
        ctx.strokeStyle = team.main;
        ctx.lineWidth = Math.max(1.5, scale * 0.06);
        ctx.beginPath();
        ctx.moveTo(-scale * 0.55, -scale * 0.08);
        ctx.quadraticCurveTo(0, -scale * 0.3, scale * 0.55, -scale * 0.08);
        ctx.lineTo(scale * 0.45, scale * 0.06);
        ctx.quadraticCurveTo(0, -scale * 0.1, -scale * 0.45, scale * 0.06);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
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
      if (p.evo && p.style !== 'bomblet') {
        ctx.fillStyle = 'rgba(180,92,255,0.45)';
        ctx.beginPath(); ctx.arc(x, y, s * 0.3, 0, Math.PI * 2); ctx.fill();
      }
      switch (p.style) {
        case 'bomblet':
          ctx.fillStyle = '#ff9a3a';
          ctx.shadowColor = '#b45cff'; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.arc(x, y, s * 0.13, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
          break;
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
        case 'flak':
          ctx.fillStyle = '#3a3d44';
          ctx.beginPath(); ctx.arc(x, y, s * 0.13, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#ffcf7a'; ctx.lineWidth = 1.5; ctx.stroke();
          break;
        case 'ice':
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(now / 80);
          ctx.fillStyle = '#d8f6ff';
          ctx.shadowColor = '#7fd8ff'; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.moveTo(0, -s * 0.22); ctx.lineTo(s * 0.09, 0); ctx.lineTo(0, s * 0.22); ctx.lineTo(-s * 0.09, 0); ctx.closePath(); ctx.fill();
          ctx.restore();
          ctx.shadowBlur = 0;
          break;
        case 'pulse': {
          const pr = s * (0.3 + 0.05 * Math.sin(now / 40));
          const g = ctx.createRadialGradient(x, y, 0, x, y, pr);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(0.4, '#9ff3ff');
          g.addColorStop(1, 'rgba(60,160,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x, y, pr, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'zap':
          ctx.strokeStyle = '#bdf6ff';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x - s * 0.15, y - s * 0.15); ctx.lineTo(x + s * 0.05, y); ctx.lineTo(x - s * 0.05, y + s * 0.02); ctx.lineTo(x + s * 0.15, y + s * 0.15); ctx.stroke();
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
          if (!f.hill) announce('CROWN!', { sub: `${names[f.owner] || TEAM[f.owner].name} takes a tower`, color: TEAM[f.owner].light });
          continue;
        }
        if (eventFx(f)) continue;
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
          case 'laser': e.life = 650; shake = Math.max(shake, 6); break;
          case 'drop': e.life = 650; break;
          case 'elixir': e.life = 1000; break;
          case 'shieldBreak': e.life = 450; e.parts = Array.from({ length: 8 }, (_, i) => ({ a: (i / 8) * Math.PI * 2, v: 0.6 + Math.random() * 0.6 })); break;
          case 'popup': e.life = 420; break;
          case 'dash': e.life = 380; break;
          case 'taunt': e.life = 900; break;
          case 'evolve': e.life = f.small ? 700 : 1300; if (!f.small) shake = Math.max(shake, 4); break;
          case 'shockwave': e.life = 550; shake = Math.max(shake, 3); break;
          case 'pulse': e.life = 500; break;
          case 'pierce': e.life = 280; break;
          case 'dive': e.life = 320; break;
          case 'rally': e.life = 700; break;
          case 'bastion': e.life = 800; break;
          case 'spell':
            e.life = f.kind === 'firebomb' ? 750 : f.kind === 'shock' ? 420 : f.kind === 'frost' ? 800 : 520;
            e.parts = Array.from({ length: f.kind === 'rocket' ? 6 : 14 }, () => ({ a: Math.random() * Math.PI * 2, d: Math.random(), v: 0.6 + Math.random() * 0.8 }));
            shake = Math.max(shake, f.kind === 'firebomb' || f.kind === 'slam' ? 7 : f.kind === 'shock' || f.kind === 'frost' || f.kind === 'meteor' ? 4 : 2.5);
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
          case 'laser': {
            // Beams slam down from orbit onto each target
            ctx.globalAlpha = 1 - t;
            (e.pts || []).forEach((pt) => {
              const px = sx(pt.x);
              const py = sy(pt.y);
              const w = scale * (0.5 * (1 - t) + 0.1);
              const g = ctx.createLinearGradient(px - w, 0, px + w, 0);
              g.addColorStop(0, 'rgba(255,60,60,0)');
              g.addColorStop(0.5, 'rgba(255,240,240,0.95)');
              g.addColorStop(1, 'rgba(255,60,60,0)');
              ctx.fillStyle = g;
              ctx.fillRect(px - w, 0, w * 2, py);
              ctx.fillStyle = `rgba(255,120,90,${0.6 * (1 - t)})`;
              ctx.beginPath(); ctx.arc(px, py, scale * (0.4 + t * 1.2), 0, Math.PI * 2); ctx.fill();
            });
            break;
          }
          case 'drop': {
            // A parachute floating down onto the spot
            const k = easeOut(t);
            const py = y - scale * 2.2 * (1 - k);
            ctx.globalAlpha = 1;
            ctx.fillStyle = team.light;
            ctx.beginPath(); ctx.arc(x, py - scale * 0.45, scale * 0.42, Math.PI, 0); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            ctx.lineWidth = 1;
            [-0.4, 0, 0.4].forEach((dx) => { ctx.beginPath(); ctx.moveTo(x + dx * scale, py - scale * 0.45); ctx.lineTo(x, py); ctx.stroke(); });
            break;
          }
          case 'elixir':
            ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
            drawSprite('💧', x, y - scale * (0.8 + easeOut(t) * 0.8), scale * 0.55);
            outlinedText(`+${e.amt || 1}`, x + scale * 0.45, y - scale * (0.8 + easeOut(t) * 0.8), scale * 0.5, '#f0a8ff', 'rgba(40,0,60,0.85)', 900);
            break;
          case 'shieldBreak':
            e.parts.forEach((p) => {
              const d = scale * p.v * t * 1.2;
              ctx.fillStyle = 'rgba(160,240,255,0.9)';
              ctx.fillRect(x + Math.cos(p.a) * d, y + Math.sin(p.a) * d, scale * 0.12, scale * 0.06);
            });
            break;
          case 'popup':
            ctx.fillStyle = 'rgba(120,90,60,0.8)';
            for (let i = 0; i < 7; i++) {
              const a = (i / 7) * Math.PI * 2;
              ctx.beginPath(); ctx.arc(x + Math.cos(a) * scale * t * 1.1, y + Math.sin(a) * scale * t * 0.7, scale * 0.14 * (1 - t), 0, Math.PI * 2); ctx.fill();
            }
            break;
          case 'dash':
            ctx.fillStyle = 'rgba(200,200,220,0.5)';
            ctx.beginPath(); ctx.arc(x, y, scale * (0.3 + t * 0.8), 0, Math.PI * 2); ctx.fill();
            break;
          case 'evolve': {
            // Evolution arrives: a violet column, gold rays and a callout
            const k = easeOut(clamp(t * 2, 0, 1));
            const R = scale * (e.small ? 1 : 1.6);
            ctx.globalAlpha = 1 - t;
            const col = ctx.createLinearGradient(0, y - scale * 4, 0, y);
            col.addColorStop(0, 'rgba(180,92,255,0)');
            col.addColorStop(1, 'rgba(180,92,255,0.55)');
            ctx.fillStyle = col;
            ctx.fillRect(x - R * 0.5, y - scale * 4 * k, R, scale * 4 * k);
            ctx.strokeStyle = '#ffcf3a';
            ctx.lineWidth = Math.max(2, scale * 0.08);
            for (let i = 0; i < 10; i++) {
              const a = (i / 10) * Math.PI * 2 + t;
              ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * R * 0.6, y + Math.sin(a) * R * 0.4); ctx.lineTo(x + Math.cos(a) * R * (0.8 + k), y + Math.sin(a) * R * (0.5 + k * 0.6)); ctx.stroke();
            }
            ctx.strokeStyle = '#b45cff';
            ctx.beginPath(); ctx.arc(x, y, R * (0.5 + k), 0, Math.PI * 2); ctx.stroke();
            if (!e.small) {
              ctx.globalAlpha = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
              outlinedText('EVOLVED!', x, y - scale * (1.8 + k * 0.6), scale * 0.62, '#ffcf3a', 'rgba(60,0,90,0.95)', 900);
              if (e.name) outlinedText(e.name, x, y - scale * (1.15 + k * 0.6), scale * 0.42, '#f3e6ff', 'rgba(60,0,90,0.95)', 800);
            }
            break;
          }
          case 'shockwave':
          case 'pulse': {
            const R = (e.r || 1.5) * scale;
            ctx.strokeStyle = e.type === 'pulse' ? `rgba(140,220,255,${1 - t})` : `rgba(230,200,150,${1 - t})`;
            ctx.lineWidth = Math.max(2, scale * 0.14 * (1 - t));
            ctx.beginPath(); ctx.arc(x, y, R * easeOut(t), 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = `rgba(180,92,255,${0.8 * (1 - t)})`;
            ctx.lineWidth = Math.max(1, scale * 0.05);
            ctx.beginPath(); ctx.arc(x, y, R * easeOut(t) * 0.75, 0, Math.PI * 2); ctx.stroke();
            if (e.type === 'shockwave') {
              ctx.fillStyle = `rgba(160,130,90,${0.5 * (1 - t)})`;
              for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.beginPath(); ctx.arc(x + Math.cos(a) * R * easeOut(t), y + Math.sin(a) * R * easeOut(t) * 0.7, scale * 0.15, 0, Math.PI * 2); ctx.fill(); }
            }
            break;
          }
          case 'pierce': {
            // Prism beam: a white core with rainbow edges
            const x2 = sx(e.x2);
            const y2 = sy(e.y2);
            ctx.globalAlpha = 1 - t;
            ['rgba(255,80,200,0.6)', 'rgba(80,200,255,0.6)', 'rgba(255,255,255,0.95)'].forEach((c, i) => {
              ctx.strokeStyle = c;
              ctx.lineWidth = Math.max(1.5, scale * (0.3 - i * 0.09));
              ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
            });
            break;
          }
          case 'dive': {
            const x2 = sx(e.x2);
            const y2 = sy(e.y2);
            ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - t)})`;
            ctx.lineWidth = Math.max(2, scale * 0.08);
            ctx.beginPath(); ctx.moveTo(x, y - scale * 1.2); ctx.lineTo(x2, y2); ctx.stroke();
            break;
          }
          case 'rally':
          case 'bastion':
            (e.pts || []).forEach((pt) => {
              const px = sx(pt.x);
              const py = sy(pt.y);
              if (e.type === 'rally') {
                outlinedText('⬆', px, py - scale * (0.8 + t * 0.6), scale * 0.45, '#ff6b5a', 'rgba(0,0,0,0.8)', 900);
              } else {
                ctx.strokeStyle = `rgba(127,232,255,${1 - t})`;
                ctx.lineWidth = Math.max(2, scale * 0.08);
                ctx.beginPath();
                for (let k = 0; k <= 6; k++) { const a = (k / 6) * Math.PI * 2; const rr = scale * (0.55 + 0.15 * t); if (k) ctx.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr); else ctx.moveTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr); }
                ctx.stroke();
              }
            });
            if (e.type === 'bastion') {
              ctx.strokeStyle = `rgba(180,92,255,${0.7 * (1 - t)})`;
              ctx.lineWidth = 2;
              ctx.beginPath(); ctx.arc(x, y, (e.r || 3) * scale * easeOut(t), 0, Math.PI * 2); ctx.stroke();
            }
            break;
          case 'taunt':
            ctx.strokeStyle = `rgba(255,70,70,${1 - t})`;
            ctx.lineWidth = Math.max(2, scale * 0.08);
            ctx.beginPath(); ctx.arc(x, y, (e.r || 6) * scale * easeOut(t), 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1 - t;
            outlinedText('!', x, y - scale * 1.4, scale * 0.9, '#ff5a5a', '#fff', 900);
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
      } else if (e.kind === 'frost') {
        const k = easeOut(clamp(t * 2, 0, 1));
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = 'rgba(200,240,255,0.45)';
        ctx.beginPath(); ctx.arc(x, y, R * k, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = Math.max(2, scale * 0.08);
        ctx.stroke();
        e.parts.forEach((p, i) => {
          const d = R * (0.2 + p.d * 0.8) * k;
          drawSprite('❄️', x + Math.cos(p.a) * d, y + Math.sin(p.a) * d, scale * (0.35 + (i % 3) * 0.1), 1 - t);
        });
      } else if (e.kind === 'meteor' || e.kind === 'slam') {
        // Hazard landing: a dust ring and debris (meteor = orange, boss slam = steel)
        const k = easeOut(clamp(t * 1.8, 0, 1));
        const hot = e.kind === 'meteor';
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = hot ? 'rgba(255,140,40,0.45)' : 'rgba(170,180,200,0.45)';
        ctx.beginPath(); ctx.arc(x, y, R * k, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = hot ? 'rgba(255,230,160,0.95)' : 'rgba(230,236,255,0.95)';
        ctx.lineWidth = Math.max(2, scale * 0.14 * (1 - t));
        ctx.beginPath(); ctx.arc(x, y, R * (0.4 + 0.7 * k), 0, Math.PI * 2); ctx.stroke();
        e.parts.forEach((p) => {
          const d = R * (0.2 + p.v * 0.8 * k);
          ctx.fillStyle = hot ? `rgba(120,60,30,${1 - t})` : `rgba(90,96,110,${1 - t})`;
          ctx.fillRect(x + Math.cos(p.a) * d, y + Math.sin(p.a) * d - (1 - t) * scale * 0.3, scale * 0.16, scale * 0.16);
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

    // ── Special events: modifier areas, telegraphed hazards, the hill, badges and notices ──
    // Gameplay timing always comes from the snapshot (zone age/left/wait), so an interrupted
    // animation can never desync what you see from what the engine does.
    const EVENT_ZONES = new Set(['cHaste', 'cSlow', 'cHeal', 'storm', 'impact', 'slam', 'meteorField']);
    const pulse = (now, ms) => (reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(now / ms));

    // A small notice that slides in at the top of the arena (doesn't cover the fight)
    function ribbon(text, opts) {
      const o = opts || {};
      ribbons.push({ text, icon: o.icon || '', color: o.color || '#ffe680', born: null, life: o.life || 2400 });
      if (ribbons.length > 3) ribbons.shift();
    }

    function drawRibbons(now) {
      ribbons = ribbons.filter((r) => r.born == null || now - r.born < r.life);
      ribbons.forEach((r, i) => {
        if (r.born == null) r.born = now;
        const t = (now - r.born) / r.life;
        const inK = easeOut(clamp(t * 6, 0, 1));
        const outK = t > 0.85 ? (t - 0.85) / 0.15 : 0;
        const y = scale * (2.6 + i * 0.95);
        const size = Math.max(10, scale * 0.42);
        ctx.font = `800 ${size}px "Space Grotesk",sans-serif`;
        const label = `${r.icon ? `${r.icon}  ` : ''}${r.text}`;
        const w = ctx.measureText(label).width + scale * 0.9;
        ctx.globalAlpha = (1 - outK) * inK;
        ctx.fillStyle = 'rgba(6,12,26,0.82)';
        roundRect(ctx, canvas.width / 2 - w / 2, y - size * 0.95, w, size * 1.9, size * 0.5);
        ctx.fill();
        ctx.strokeStyle = r.color;
        ctx.lineWidth = Math.max(1, scale * 0.05);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, canvas.width / 2, y + 1);
        ctx.globalAlpha = 1;
      });
    }

    // Engine event fx -> notices and banners. Returns true if it handled f.
    function eventFx(f) {
      const M = Sim.MODIFIERS;
      switch (f.type) {
        case 'modOn': {
          const d = M[f.id];
          if (d) ribbon(d.name, { icon: d.icon, color: MOD_COLOR[d.cat] || '#ffe680' });
          return true;
        }
        case 'modOff': return true;
        case 'hillMove': ribbon('The hill moved!', { icon: '⛰️', color: '#ffd35f' }); return true;
        case 'hillCrown': announce('HILL CROWN!', { sub: `${names[f.owner] || TEAM[f.owner].name} held the hill`, color: TEAM[f.owner].light }); return true;
        case 'wave': ribbon(`Wave ${f.n} of ${f.total}`, { icon: '🌊', color: '#ff9a7a' }); return true;
        case 'bossSpawn': announce('IRON COLOSSUS', { sub: 'Bring it down before time runs out!', color: '#ffb36c', big: true, urgent: true }); shake = Math.max(shake, 8); return true;
        case 'bossSummon': ribbon('Guards summoned: it takes half damage!', { icon: '⚙️', color: '#ffb36c', life: 3200 }); return true;
        case 'bossEnrage': announce('ENRAGED!', { sub: 'Faster attacks, more slams', color: '#ff6b6b' }); return true;
        case 'bossSlam': return true; // the warning circle is drawn from the zone itself
        case 'deckSwap': announce('DECKS SWAPPED!', { sub: 'New hand, new plan', color: '#c38bff' }); return true;
        default: return false;
      }
    }

    const MOD_COLOR = { battlefield: '#7dffb0', elixir: '#e48bff', card: '#7fc8ff', troop: '#ffb347', evolution: '#ffcf3a', tower: '#ff8a8a', time: '#ff6b6b' };

    function drawEventZone(z, now) {
      const x = sx(z.x);
      const y = sy(z.y);
      const R = z.r * scale;
      const fadeOut = z.left != null ? clamp(z.left / 0.6, 0, 1) : 1;
      // Telegraphs are fully visible for their whole warning (their age only starts once they land)
      const fadeIn = z.wait > 0 ? 1 : clamp((z.age || 0) / 0.4, 0, 1);
      ctx.save();
      ctx.globalAlpha = fadeIn * fadeOut;
      switch (z.kind) {
        case 'cHaste': case 'cSlow': case 'cHeal': {
          // Each kind gets its own colour AND its own pattern and icon, so it reads without colour
          const col = z.kind === 'cHaste' ? [120, 255, 200] : z.kind === 'cSlow' ? [150, 110, 70] : [120, 255, 140];
          ctx.fillStyle = `rgba(${col.join(',')},${z.kind === 'cSlow' ? 0.42 : 0.18})`;
          ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = `rgba(${col.join(',')},0.85)`;
          ctx.lineWidth = Math.max(1.5, scale * 0.07);
          ctx.setLineDash(z.kind === 'cHaste' ? [scale * 0.5, scale * 0.25] : z.kind === 'cSlow' ? [scale * 0.15, scale * 0.15] : []);
          ctx.lineDashOffset = reduceMotion ? 0 : -now / 40;
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.clip();
          if (z.kind === 'cHaste') {
            // Chevrons streaming forward
            ctx.strokeStyle = 'rgba(200,255,235,0.55)';
            ctx.lineWidth = Math.max(1.5, scale * 0.08);
            for (let i = -2; i <= 2; i++) {
              const off = ((now / 18 + i * scale * 0.9) % (scale * 4.5)) - scale * 2.25;
              const yy = y + (reduceMotion ? i * scale * 0.9 : off);
              ctx.beginPath(); ctx.moveTo(x - R * 0.45, yy + scale * 0.25); ctx.lineTo(x, yy - scale * 0.15); ctx.lineTo(x + R * 0.45, yy + scale * 0.25); ctx.stroke();
            }
          } else if (z.kind === 'cSlow') {
            ctx.fillStyle = 'rgba(70,45,25,0.5)';
            for (let i = 0; i < 7; i++) { const a = i * 2.2; const d = R * ((i * 0.37) % 0.8); ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, scale * 0.35, scale * 0.18, a, 0, Math.PI * 2); ctx.fill(); }
          } else {
            for (let i = 0; i < 8; i++) {
              const k = reduceMotion ? 0.5 : (now / 1200 + i / 8) % 1;
              drawSprite('➕', x + Math.cos(i * 2.4) * R * 0.6, y + Math.sin(i * 2.4) * R * 0.5 - k * scale, scale * 0.35, 0.8 * (1 - k));
            }
          }
          ctx.restore();
          ctx.save();
          ctx.globalAlpha = fadeIn * fadeOut * 0.9;
          drawSprite(z.kind === 'cHaste' ? '💨' : z.kind === 'cSlow' ? '🟫' : '⛲', x, y - R * 0.75, scale * 0.6, 0.9);
          break;
        }
        case 'storm': {
          const g = ctx.createRadialGradient(x, y, R * 0.1, x, y, R);
          g.addColorStop(0, 'rgba(90,70,160,0.15)');
          g.addColorStop(1, 'rgba(60,40,140,0.5)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(200,180,255,0.9)';
          ctx.lineWidth = Math.max(1.5, scale * 0.08);
          for (let i = 0; i < 3; i++) {
            const a0 = (reduceMotion ? 0 : now / 300) + (i * Math.PI * 2) / 3;
            ctx.beginPath(); ctx.arc(x, y, R * (0.45 + i * 0.2), a0, a0 + 1.6); ctx.stroke();
          }
          if (!reduceMotion && Math.random() < 0.15) {
            ctx.strokeStyle = 'rgba(255,255,220,0.9)';
            ctx.beginPath(); ctx.moveTo(x, y - R); ctx.lineTo(x + scale * 0.3, y - R * 0.3); ctx.lineTo(x - scale * 0.2, y); ctx.lineTo(x + scale * 0.2, y + R * 0.4); ctx.stroke();
          }
          drawSprite('🌀', x, y, scale * 0.8, 0.85);
          break;
        }
        case 'impact': case 'slam': {
          // Telegraph: a filling ring that closes as the hit approaches (with the seconds left)
          if (!(z.wait > 0)) break;
          const total = z.warn || 1.5;
          const k = clamp(1 - z.wait / total, 0, 1);
          const red = z.kind === 'slam' ? '255,90,70' : '255,150,40';
          ctx.fillStyle = `rgba(${red},${0.12 + 0.2 * k})`;
          ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = `rgba(${red},${0.6 + 0.4 * pulse(now, 60)})`;
          ctx.lineWidth = Math.max(2, scale * 0.1);
          ctx.setLineDash([scale * 0.3, scale * 0.2]);
          ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = `rgba(${red},0.35)`;
          ctx.beginPath(); ctx.arc(x, y, R * k, 0, Math.PI * 2); ctx.fill();
          drawSprite(z.kind === 'slam' ? '⚠️' : '☄️', x, y, scale * 0.75, 0.95);
          outlinedText(z.wait.toFixed(1), x, y + R * 0.55, Math.max(9, scale * 0.38), '#fff', 'rgba(0,0,0,0.8)', 800);
          break;
        }
        default: break;
      }
      ctx.restore();
    }

    function drawHill(h, now) {
      const x = sx(h.x);
      const y = sy(h.y);
      const R = h.r * scale;
      const holder = h.holder ? TEAM[h.holder] : null;
      ctx.save();
      ctx.fillStyle = holder ? holder.main : 'rgba(255,211,95,1)';
      ctx.globalAlpha = 0.16 + 0.08 * pulse(now, 300);
      ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = holder ? holder.light : '#ffd35f';
      ctx.lineWidth = Math.max(2, scale * 0.1);
      ctx.setLineDash([scale * 0.35, scale * 0.18]);
      ctx.lineDashOffset = reduceMotion ? 0 : -now / 60;
      ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      // Both meters as arcs around the hill: you on your side, the opponent on theirs
      const me = flip ? 'B' : 'A';
      const foe = flip ? 'A' : 'B';
      [[me, Math.PI / 2], [foe, -Math.PI / 2]].forEach(([side, mid]) => {
        const frac = clamp(h[side] / h.points, 0, 1);
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.lineWidth = Math.max(3, scale * 0.2);
        ctx.beginPath(); ctx.arc(x, y, R + scale * 0.25, mid - 1.2, mid + 1.2); ctx.stroke();
        ctx.strokeStyle = TEAM[side].main;
        ctx.beginPath(); ctx.arc(x, y, R + scale * 0.25, mid - 1.2, mid - 1.2 + 2.4 * frac); ctx.stroke();
      });
      drawSprite('⛰️', x, y, scale * 0.85, 0.95);
      // Where it goes next, in the last 8 seconds
      if (h.moveIn != null && h.moveIn < 8) {
        const nx = sx(h.nx);
        const ny = sy(h.ny);
        ctx.globalAlpha = 0.5 + 0.4 * pulse(now, 120);
        ctx.strokeStyle = '#ffd35f';
        ctx.lineWidth = Math.max(1.5, scale * 0.06);
        ctx.setLineDash([scale * 0.15, scale * 0.15]);
        ctx.beginPath(); ctx.arc(nx, ny, R, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        outlinedText(`⛰️ ${Math.ceil(h.moveIn)}`, nx, ny, Math.max(9, scale * 0.45), '#ffd35f', 'rgba(0,0,0,0.8)', 800);
      }
      ctx.restore();
    }

    // Size Roulette forms, the boss and its guards
    function drawEventBadge(u, x, y, r, now) {
      if (u.form) {
        const mega = u.form === 'mega';
        const bx = x + r * 0.85;
        const by = y + r * 0.7;
        const br = Math.max(5, scale * 0.24);
        ctx.fillStyle = mega ? '#ff7a3d' : '#59d6ff';
        ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        outlinedText(mega ? 'M' : 'T', bx, by + 1, br * 1.3, '#fff', 'rgba(0,0,0,0.5)', 900);
      }
      if (u.boss) {
        ctx.strokeStyle = `rgba(255,180,90,${0.5 + 0.4 * pulse(now, 200)})`;
        ctx.lineWidth = Math.max(2, scale * 0.12);
        ctx.beginPath(); ctx.arc(x, y, r * 1.25, 0, Math.PI * 2); ctx.stroke();
      }
      if (u.mn) {
        ctx.strokeStyle = 'rgba(255,180,90,0.7)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(x, y, r * 1.15, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
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
      if (card.spell && card.zone && card.zone.kind === 'roll') {
        // Show the boulder's whole path toward the enemy
        const dir = (ghost.owner === 'A' ? -1 : 1) * (flip ? -1 : 1);
        const len = card.zone.length * scale;
        const w = card.splash * scale;
        ctx.fillStyle = ghost.valid ? `${team.main}33` : 'rgba(128,32,32,0.3)';
        ctx.fillRect(x - w, dir < 0 ? y - len : y, w * 2, len);
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.setLineDash([scale * 0.3, scale * 0.2]);
        ctx.lineWidth = 2;
        ctx.strokeRect(x - w, dir < 0 ? y - len : y, w * 2, len);
        ctx.setLineDash([]);
        drawSprite(card.icon, x, y, scale * 0.9, 0.85);
      } else if (card.spell) {
        const R = card.splash * scale;
        const friendly = card.friendly;
        ctx.fillStyle = !ghost.valid ? 'rgba(128,32,32,0.3)' : friendly ? 'rgba(90,255,150,0.2)' : `${team.main}33`;
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
      if (T.lava) {
        ctx.fillStyle = `rgba(255,200,60,${0.12 + 0.08 * Math.sin(now / 400)})`;
        ctx.fillRect(0, ry0, canvas.width, ry1 - ry0);
      }
      ctx.strokeStyle = T.ripple;
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
      if (reduceMotion) shake = 0;
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
        const zones = view.zones || [];
        if (view.ev && view.ev.hill) drawHill(view.ev.hill, now);
        const telegraph = (z) => z.kind === 'impact' || z.kind === 'slam';
        zones.forEach((z) => {
          if (telegraph(z)) return;
          if (EVENT_ZONES.has(z.kind)) drawEventZone(z, now);
          else if (z.kind !== 'roll' && z.kind !== 'blade') drawZoneDecal(z, now);
        });
        ground.forEach((d) => (d.kind === 't' ? drawTower(d.e, now, dt) : drawUnit(d.e, now, dt)));
        // Hazard warnings go on top of troops and towers so they can't be missed
        zones.forEach((z) => { if (telegraph(z)) drawEventZone(z, now); });
        zones.forEach((z) => { if (z.kind === 'roll' || z.kind === 'blade') drawZoneObject(z, now); });
        if (view.units.some((u) => u.tgt)) {
          const byId = new Map();
          view.units.forEach((u) => byId.set(u.id, u));
          view.towers.forEach((t) => byId.set(t.id, t));
          drawBeams(view, byId, now);
        }
        view.projectiles.forEach((p) => drawProjectile(p, now));
        air.forEach((d) => drawUnit(d.e, now, dt));
        drawEffects(now);
        drawGhost(o.ghost);
        drawEmotes(view, now);
        drawHud(view, now);
        drawRibbons(now);
        drawBanner(now);
        pruneMotion(now);
      }
      ctx.restore();
    }

    function setNames(n) { names = Object.assign({}, names, n); }

    function setTheme(name) {
      const next = THEMES[name] ? name : 'meadow';
      if (next === themeName) return;
      themeName = next;
      T = THEMES[next];
      bg = null;
    }

    function reset() {
      effects = [];
      banners = [];
      ribbons = [];
      emotes.A = null;
      emotes.B = null;
      hpShown.clear();
      motion.clear();
    }

    resize();
    const api = { render, resize, toWorld, addFx, announce, ribbon, showEmote, setNames, setTheme, reset, onCue: null, get flip() { return flip; }, get theme() { return themeName; } };
    return api;
  }

  window.ArenaView = { create, TEAM, THEMES };
})();
