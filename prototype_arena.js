/*
 * Arena renderer for the prototype: draws a ClashSim snapshot onto a <canvas>.
 * Pure drawing + coordinate mapping; game rules live in clash-sim.js.
 */
(function () {
  'use strict';

  const Sim = window.ClashSim;
  const W = Sim.W;
  const H = Sim.H;
  const TEAM = {
    A: { main: '#3d8bff', dark: '#1d4f9e', light: '#9cc7ff' },
    B: { main: '#ff4d5e', dark: '#9e1d2b', light: '#ffb0b8' },
  };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

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

    // ── Static background (grass, river, bridges) ──
    function drawBackground() {
      bg = document.createElement('canvas');
      bg.width = canvas.width;
      bg.height = canvas.height;
      const g = bg.getContext('2d');
      for (let ty = 0; ty < H; ty++) {
        for (let tx = 0; tx < W; tx++) {
          g.fillStyle = (tx + ty) % 2 ? '#4a8f3f' : '#529a45';
          g.fillRect(tx * scale, ty * scale, scale + 1, scale + 1);
        }
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
      // Bank shading along the river
      const ry0 = Sim.RIVER.y0 * scale;
      const ry1 = Sim.RIVER.y1 * scale;
      g.fillStyle = 'rgba(60,40,20,0.35)';
      g.fillRect(0, ry0 - scale * 0.18, bg.width, scale * 0.18);
      g.fillRect(0, ry1, bg.width, scale * 0.18);
      // Water
      const water = g.createLinearGradient(0, ry0, 0, ry1);
      water.addColorStop(0, '#2a7fc9');
      water.addColorStop(0.5, '#3a9be3');
      water.addColorStop(1, '#2a7fc9');
      g.fillStyle = water;
      g.fillRect(0, ry0, bg.width, ry1 - ry0);
      // Bridges (symmetric, so flipping doesn't matter)
      Sim.BRIDGES.forEach((b) => {
        const x0 = b.x0 * scale;
        const x1 = b.x1 * scale;
        const y0 = ry0 - scale * 0.35;
        const y1 = ry1 + scale * 0.35;
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(x0 + scale * 0.12, y0 + scale * 0.12, x1 - x0, y1 - y0);
        g.fillStyle = '#9a6b3c';
        g.fillRect(x0, y0, x1 - x0, y1 - y0);
        g.strokeStyle = '#6e4826';
        g.lineWidth = Math.max(1, scale * 0.06);
        for (let py = y0 + scale * 0.4; py < y1; py += scale * 0.4) {
          g.beginPath(); g.moveTo(x0, py); g.lineTo(x1, py); g.stroke();
        }
        g.fillStyle = '#5a3a1e';
        g.fillRect(x0 - scale * 0.12, y0, scale * 0.18, y1 - y0);
        g.fillRect(x1 - scale * 0.06, y0, scale * 0.18, y1 - y0);
      });
      // Faint centre line on each half (where you can always deploy)
      g.strokeStyle = 'rgba(255,255,255,0.07)';
      g.lineWidth = 1;
      g.setLineDash([scale * 0.3, scale * 0.3]);
      g.beginPath(); g.moveTo(Sim.MID_X * scale, 0); g.lineTo(Sim.MID_X * scale, bg.height); g.stroke();
      g.setLineDash([]);
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

    // ── Health bars ──
    function hpBar(x, y, w, frac, owner, h) {
      const bh = h || Math.max(3, scale * 0.14);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, bh + 2);
      ctx.fillStyle = TEAM[owner].main;
      ctx.fillRect(x - w / 2, y, w * clamp(frac, 0, 1), bh);
    }

    // ── Towers ──
    function drawTower(t, now) {
      const x = sx(t.x);
      const y = sy(t.y);
      const half = t.half * scale;
      const team = TEAM[t.owner];
      if (t.hp <= 0) {
        // Rubble
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
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(x - half + scale * 0.15, y - half + scale * 0.2, half * 2, half * 2);
      ctx.fillStyle = '#8d929c';
      ctx.fillRect(x - half, y - half, half * 2, half * 2);
      ctx.strokeStyle = '#5f646d';
      ctx.lineWidth = Math.max(1, scale * 0.08);
      ctx.strokeRect(x - half, y - half, half * 2, half * 2);
      // Battlements
      ctx.fillStyle = '#a4a9b2';
      const n = t.tower === 'king' ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const bx = x - half + (i + 0.5) * ((half * 2) / n);
        ctx.fillRect(bx - scale * 0.18, y - half - scale * 0.12, scale * 0.36, scale * 0.24);
        ctx.fillRect(bx - scale * 0.18, y + half - scale * 0.12, scale * 0.36, scale * 0.24);
      }
      // Team roof
      ctx.fillStyle = team.main;
      ctx.beginPath(); ctx.arc(x, y, half * 0.62, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = team.dark;
      ctx.lineWidth = Math.max(1, scale * 0.1);
      ctx.stroke();
      const recent = t.atk < 0.15;
      if (recent) {
        ctx.fillStyle = 'rgba(255,240,180,0.7)';
        ctx.beginPath(); ctx.arc(x, y, half * 0.35, 0, Math.PI * 2); ctx.fill();
      }
      if (t.hit < 0.1) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(x - half, y - half, half * 2, half * 2);
      }
      drawSprite(t.tower === 'king' ? '👑' : '🏹', x, y, half * 0.75);
      if (t.tower === 'king' && !t.active) {
        ctx.fillStyle = 'rgba(10,15,30,0.45)';
        ctx.beginPath(); ctx.arc(x, y, half * 0.62, 0, Math.PI * 2); ctx.fill();
        drawSprite('💤', x + half * 0.55, y - half * 0.55, half * 0.5, 0.6 + 0.4 * Math.sin(now / 300));
      }
      // HP bar + number (on the side facing the middle of the arena)
      const towardMiddle = (sy(t.y) < canvas.height / 2) ? 1 : -1;
      const barY = towardMiddle > 0 ? y + half + scale * 0.3 : y - half - scale * 0.65;
      hpBar(x, barY, half * 2, t.hp / t.hpMax, t.owner, scale * 0.28);
      ctx.font = `700 ${Math.max(9, scale * 0.42)}px "Space Grotesk",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      const label = String(Math.ceil(t.hp));
      ctx.strokeText(label, x, barY + scale * 0.14);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x, barY + scale * 0.14);
    }

    // ── Units ──
    function drawUnit(u, now) {
      const card = Sim.CARD_MAP[u.cardId];
      const team = TEAM[u.owner];
      // Drawn a bit larger than the collision body so units read clearly at small sizes
      const r = Math.max(7, u.radius * scale * (u.building ? 1 : 1.3));
      let x = sx(u.x);
      let y = sy(u.y);
      const face = faceAngle(u.face);
      const deploying = u.dep > 0;
      const alpha = deploying ? 0.55 : 1;
      let lift = 0;
      if (u.air) lift = scale * 0.5 + Math.sin(now / 250 + u.x) * scale * 0.06;
      if (u.jmp) lift = scale * 0.6;
      // Melee lunge toward the target right after a hit lands
      if (u.melee && u.atk < 0.18 && !deploying) {
        const k = Math.sin((u.atk / 0.18) * Math.PI) * scale * 0.22;
        x += Math.cos(face) * k;
        y += Math.sin(face) * k;
      }

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(x, y + r * 0.35, r * 0.95, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      y -= lift;

      if (u.building) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#7a7f88';
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.strokeStyle = team.main;
        ctx.lineWidth = Math.max(2, scale * 0.12);
        ctx.strokeRect(x - r, y - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
      } else {
        // Team disc with a facing notch
        ctx.globalAlpha = alpha;
        ctx.fillStyle = team.dark;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = team.main;
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
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      if (u.wind && !u.melee) {
        ctx.strokeStyle = 'rgba(255,230,120,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, r * 1.15, face - 0.6, face + 0.6); ctx.stroke();
      }
      if (deploying) {
        const p = 1 - u.dep / Sim.MATCH.deployTime;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, r * 1.25, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ctx.stroke();
      }
      if (u.hp < u.hpMax || u.building) hpBar(x, y - r - scale * 0.28, Math.max(scale * 0.8, r * 2), u.hp / u.hpMax, u.owner);
    }

    // ── Projectiles ──
    function drawProjectile(p) {
      let x = sx(p.x);
      let y = sy(p.y);
      const team = TEAM[p.owner];
      if (p.lob != null) {
        // Arc: shadow on the ground, shell in the air
        const h = Math.sin(p.lob * Math.PI) * scale * 2.2;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(x, y, scale * 0.2, scale * 0.1, 0, 0, Math.PI * 2); ctx.fill();
        y -= h;
      }
      const s = scale;
      switch (p.style) {
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

    // ── Effects (deploy rings, hits, splashes, deaths, tower explosions) ──
    function addFx(list) {
      const now = performance.now();
      for (const f of list) {
        const e = Object.assign({ born: now }, f);
        switch (f.type) {
          case 'deploy': e.life = 450; break;
          case 'hit': e.life = 180; break;
          case 'splash': e.life = 350; break;
          case 'chain': e.life = 160; break;
          case 'charge': e.life = 300; break;
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
            ctx.beginPath(); ctx.arc(x, y, scale * (0.4 + t * (e.r || 1)), 0, Math.PI * 2); ctx.stroke();
            break;
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

    // ── HUD painted on the arena: clock and crowns ──
    function drawHud(view) {
      const me = flip ? 'B' : 'A';
      const foe = flip ? 'A' : 'B';
      const mins = Math.floor(view.timeLeft / 60);
      const secs = Math.floor(view.timeLeft % 60);
      const label = `${mins}:${String(secs).padStart(2, '0')}`;
      // Clock in the top-right corner, clear of the bridges
      const x = canvas.width - scale * 0.2;
      const y = scale * 0.85;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const big = Math.max(11, scale * 0.62);
      ctx.font = `900 ${big}px "Orbitron",sans-serif`;
      const w = ctx.measureText(label).width + scale * 0.5;
      ctx.fillStyle = 'rgba(5,10,20,0.72)';
      ctx.fillRect(x - w, y - big * 0.85, w + scale * 0.1, big * 1.7);
      ctx.fillStyle = view.timeLeft <= 10 && view.running ? '#ff6b6b' : '#fff';
      ctx.fillText(label, x - scale * 0.2, y - (view.phase === 'overtime' || view.double ? big * 0.18 : 0));
      if (view.phase === 'overtime' || view.double) {
        ctx.font = `700 ${Math.max(8, scale * 0.3)}px "Space Grotesk",sans-serif`;
        ctx.fillStyle = view.phase === 'overtime' ? '#ffb347' : '#d58cff';
        ctx.fillText(view.phase === 'overtime' ? 'OVERTIME ×2' : '×2 ELIXIR', x - scale * 0.2, y + big * 0.55);
      }
      // Crowns: opponent's at the top-left, mine at the bottom-left
      const crown = (n, top) => {
        const cy = top ? scale * 0.7 : canvas.height - scale * 0.7;
        ctx.font = `800 ${Math.max(10, scale * 0.5)}px "Orbitron",sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(5,10,20,0.6)';
        ctx.fillRect(scale * 0.2, cy - scale * 0.42, scale * 1.9, scale * 0.84);
        drawSprite('👑', scale * 0.65, cy, scale * 0.55);
        ctx.fillStyle = '#ffe680';
        ctx.fillText(String(n), scale * 1.15, cy + 1);
      };
      crown(view.players[foe].crowns, true);
      crown(view.players[me].crowns, false);
    }

    // ── Placement ghost ──
    function drawGhost(ghost) {
      if (!ghost) return;
      const card = Sim.CARD_MAP[ghost.cardId];
      if (!card) return;
      const x = sx(ghost.x);
      const y = sy(ghost.y);
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
        ctx.fillStyle = ghost.valid ? TEAM[ghost.owner].main : '#802020';
        ctx.beginPath(); ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        drawSprite(card.icon, x + ox, y + oy, r * 1.4, 0.8);
      }
      if (!ghost.valid && ghost.reason) {
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
        ctx.drawImage(bg, b.x0 * scale - scale * 0.15, ry0 - scale * 0.35, (b.x1 - b.x0) * scale + scale * 0.35, ry1 - ry0 + scale * 0.7,
          b.x0 * scale - scale * 0.15, ry0 - scale * 0.35, (b.x1 - b.x0) * scale + scale * 0.35, ry1 - ry0 + scale * 0.7);
      });
    }

    /**
     * view: interpolated snapshot. opts: { flip, zoneFn, zoneKey, ghost, overlay }
     */
    function render(view, opts) {
      const o = opts || {};
      if (flip !== !!o.flip) { flip = !!o.flip; zoneCache.key = ''; bg = null; }
      if (!bg) drawBackground();
      const now = performance.now();
      ctx.save();
      if (shake > 0.2) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        shake *= 0.88;
      }
      ctx.drawImage(bg, 0, 0);
      drawWater(now);
      if (view) {
        if (o.zoneFn) drawZones(o.zoneFn, o.zoneKey);
        // Draw back-to-front so nearer things overlap farther ones
        const ground = [];
        const air = [];
        view.towers.forEach((t) => ground.push({ kind: 't', y: sy(t.y), e: t }));
        view.units.forEach((u) => (u.air ? air : ground).push({ kind: 'u', y: sy(u.y), e: u }));
        ground.sort((a, b) => a.y - b.y);
        air.sort((a, b) => a.y - b.y);
        ground.forEach((d) => (d.kind === 't' ? drawTower(d.e, now) : drawUnit(d.e, now)));
        view.projectiles.forEach(drawProjectile);
        air.forEach((d) => drawUnit(d.e, now));
        drawEffects(now);
        drawGhost(o.ghost);
        drawHud(view);
      }
      ctx.restore();
    }

    resize();
    return { render, resize, toWorld, addFx, get flip() { return flip; } };
  }

  window.ArenaView = { create };
})();
