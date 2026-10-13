/*
 * Emote artwork: small animated faces drawn with canvas paths (no image files).
 * Used by the arena (speech bubbles over the king tower) and the emote wheel.
 * draw(g, id, cx, cy, R, t): R is the face radius in pixels, t the seconds since it appeared.
 */
(function () {
  'use strict';

  const EMOTES = [
    { id: 'laugh', name: 'Ha ha!', starter: true },
    { id: 'thumbs', name: 'Nice!', starter: true },
    { id: 'cry', name: 'Waaah', starter: true },
    { id: 'angry', name: 'Grrr!', starter: true },
    { id: 'surprised', name: 'Whoa!', starter: true },
    { id: 'gg', name: 'Good game', starter: true },
    { id: 'celebrate', name: 'Party!', starter: false },
    { id: 'cool', name: 'Too easy', starter: false },
    { id: 'facepalm', name: 'Seriously?', starter: false },
    { id: 'king', name: 'King laugh', starter: false },
    // Trophy Road emotes
    { id: 'heart', name: 'Love it', starter: false },
    { id: 'thinking', name: 'Hmm…', starter: false },
    { id: 'sleepy', name: 'Zzz', starter: false },
    { id: 'trophy', name: 'Champion', starter: false },
  ];

  const INK = '#5b3200';
  const SKIN = '#ffcd94';
  const SKIN_LINE = '#9a5f2c';

  function face(g, cx, cy, R, inner, outer) {
    const grad = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    grad.addColorStop(0, inner || '#fff27a');
    grad.addColorStop(0.55, inner ? inner : '#ffd84a');
    grad.addColorStop(1, outer || '#f39c1b');
    g.fillStyle = grad;
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    g.lineWidth = R * 0.07;
    g.strokeStyle = 'rgba(120,60,0,0.55)';
    g.stroke();
    // Soft highlight
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.beginPath(); g.ellipse(cx - R * 0.35, cy - R * 0.55, R * 0.32, R * 0.16, -0.5, 0, Math.PI * 2); g.fill();
  }

  function line(g, pts, w, color) {
    g.strokeStyle = color || INK;
    g.lineWidth = w;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
  }

  function happyEyes(g, cx, cy, R) {
    g.strokeStyle = INK;
    g.lineWidth = R * 0.11;
    g.lineCap = 'round';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(cx + s * R * 0.36, cy - R * 0.12, R * 0.17, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
    }
  }

  function squeezedEyes(g, cx, cy, R) {
    const w = R * 0.1;
    line(g, [[cx - R * 0.55, cy - R * 0.32], [cx - R * 0.28, cy - R * 0.2], [cx - R * 0.55, cy - R * 0.08]], w);
    line(g, [[cx + R * 0.55, cy - R * 0.32], [cx + R * 0.28, cy - R * 0.2], [cx + R * 0.55, cy - R * 0.08]], w);
  }

  function bigMouth(g, cx, cy, R, open) {
    const top = cy + R * 0.12;
    const w = R * 0.55;
    const h = R * 0.5 * open;
    g.fillStyle = '#5a140a';
    g.beginPath();
    g.moveTo(cx - w, top);
    g.quadraticCurveTo(cx, top - R * 0.06, cx + w, top);
    g.quadraticCurveTo(cx + w * 0.9, top + h * 1.6, cx, top + h * 1.7);
    g.quadraticCurveTo(cx - w * 0.9, top + h * 1.6, cx - w, top);
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = '#fff';
    g.fillRect(cx - w, top - R * 0.05, w * 2, R * 0.14);
    g.fillStyle = '#ff5f6d';
    g.beginPath(); g.ellipse(cx, top + h * 1.55, w * 0.55, h * 0.55, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    g.lineWidth = R * 0.06;
    g.strokeStyle = INK;
    g.beginPath();
    g.moveTo(cx - w, top);
    g.quadraticCurveTo(cx, top - R * 0.06, cx + w, top);
    g.quadraticCurveTo(cx + w * 0.9, top + h * 1.6, cx, top + h * 1.7);
    g.quadraticCurveTo(cx - w * 0.9, top + h * 1.6, cx - w, top);
    g.stroke();
  }

  function drop(g, x, y, s, color) {
    g.fillStyle = color || '#7fd3ff';
    g.beginPath();
    g.moveTo(x, y - s);
    g.quadraticCurveTo(x + s * 0.75, y, x, y + s * 0.6);
    g.quadraticCurveTo(x - s * 0.75, y, x, y - s);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.beginPath(); g.arc(x - s * 0.15, y - s * 0.05, s * 0.18, 0, Math.PI * 2); g.fill();
  }

  function star(g, x, y, s, color) {
    g.fillStyle = color || '#fff6b0';
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 ? s * 0.35 : s;
      g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
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

  function crown(g, cx, top, w) {
    const h = w * 0.55;
    const grad = g.createLinearGradient(0, top - h, 0, top);
    grad.addColorStop(0, '#fff3a0');
    grad.addColorStop(1, '#e8a400');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(cx - w / 2, top);
    g.lineTo(cx - w / 2, top - h * 0.55);
    g.lineTo(cx - w / 4, top - h * 0.25);
    g.lineTo(cx, top - h);
    g.lineTo(cx + w / 4, top - h * 0.25);
    g.lineTo(cx + w / 2, top - h * 0.55);
    g.lineTo(cx + w / 2, top);
    g.closePath();
    g.fill();
    g.lineWidth = w * 0.05;
    g.strokeStyle = '#9a6400';
    g.stroke();
    g.fillStyle = '#ff4d6d';
    g.beginPath(); g.arc(cx, top - h * 0.3, w * 0.07, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4dc3ff';
    g.beginPath(); g.arc(cx - w * 0.3, top - h * 0.18, w * 0.05, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(cx + w * 0.3, top - h * 0.18, w * 0.05, 0, Math.PI * 2); g.fill();
  }

  // ── The emotes ──

  const ART = {
    laugh(g, cx, cy, R, t) {
      const by = Math.abs(Math.sin(t * 16)) * R * -0.08;
      g.save();
      g.translate(cx, cy + by);
      g.rotate(Math.sin(t * 11) * 0.09);
      face(g, 0, 0, R);
      squeezedEyes(g, 0, 0, R);
      bigMouth(g, 0, 0, R, 0.85 + Math.sin(t * 16) * 0.12);
      for (const s of [-1, 1]) {
        const k = (t * 1.8 + (s > 0 ? 0.5 : 0)) % 1;
        g.globalAlpha = 1 - k;
        drop(g, s * (R * 0.78 + k * R * 0.45), -R * 0.2 - Math.sin(k * Math.PI) * R * 0.3 + k * R * 0.4, R * 0.15);
        g.globalAlpha = 1;
      }
      g.restore();
    },

    king(g, cx, cy, R, t) {
      ART.laugh(g, cx, cy + R * 0.12, R * 0.9, t);
      const by = Math.abs(Math.sin(t * 16)) * R * -0.07;
      g.save();
      g.translate(cx, cy + by);
      g.rotate(Math.sin(t * 11) * 0.09 - 0.12);
      crown(g, 0, -R * 0.62, R * 1.05);
      g.restore();
    },

    thumbs(g, cx, cy, R, t) {
      const bump = 1 + Math.max(0, Math.sin(t * 7)) * 0.08;
      g.save();
      g.translate(cx, cy);
      g.scale(bump, bump);
      g.rotate(-0.12 + Math.sin(t * 7) * 0.05);
      // Cuff
      g.fillStyle = '#3d8bff';
      roundRect(g, -R * 0.95, -R * 0.12, R * 0.38, R * 0.95, R * 0.1);
      g.fill();
      g.lineWidth = R * 0.06; g.strokeStyle = '#1d4f9e'; g.stroke();
      // Fist
      g.fillStyle = SKIN;
      roundRect(g, -R * 0.62, -R * 0.15, R * 1.25, R * 0.98, R * 0.26);
      g.fill();
      g.strokeStyle = SKIN_LINE; g.stroke();
      // Thumb
      roundRect(g, -R * 0.55, -R * 0.98, R * 0.42, R * 0.98, R * 0.2);
      g.fill(); g.stroke();
      // Finger creases
      for (let i = 1; i <= 3; i++) {
        line(g, [[R * 0.2, -R * 0.15 + i * R * 0.245], [R * 0.6, -R * 0.15 + i * R * 0.245]], R * 0.05, SKIN_LINE);
      }
      g.restore();
      const tw = (Math.sin(t * 6) + 1) / 2;
      star(g, cx + R * 0.6, cy - R * 0.75, R * (0.12 + tw * 0.12));
      star(g, cx - R * 0.95, cy - R * 0.55, R * (0.2 - tw * 0.1));
    },

    cry(g, cx, cy, R, t) {
      const wob = Math.sin(t * 9) * R * 0.02;
      face(g, cx, cy, R, '#ffe68a', '#e6a028');
      // Worried brows
      line(g, [[cx - R * 0.6, cy - R * 0.42], [cx - R * 0.18, cy - R * 0.58]], R * 0.09);
      line(g, [[cx + R * 0.6, cy - R * 0.42], [cx + R * 0.18, cy - R * 0.58]], R * 0.09);
      // Shut eyes
      g.strokeStyle = INK; g.lineWidth = R * 0.1; g.lineCap = 'round';
      for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * R * 0.36, cy - R * 0.22, R * 0.15, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
      // Wailing mouth
      g.fillStyle = '#5a140a';
      g.beginPath(); g.ellipse(cx, cy + R * 0.42 + wob, R * 0.32, R * 0.22 + wob, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ff5f6d';
      g.beginPath(); g.ellipse(cx, cy + R * 0.53 + wob, R * 0.18, R * 0.08, 0, 0, Math.PI * 2); g.fill();
      // Tear streams
      for (const s of [-1, 1]) {
        const x = cx + s * R * 0.36;
        g.fillStyle = 'rgba(110,200,255,0.85)';
        roundRect(g, x - R * 0.08, cy - R * 0.12, R * 0.16, R * 0.95, R * 0.08);
        g.fill();
        for (let k = 0; k < 2; k++) {
          const p = (t * 1.5 + k * 0.5 + (s > 0 ? 0.25 : 0)) % 1;
          drop(g, x + s * p * R * 0.25, cy + R * 0.8 + p * R * 0.55, R * 0.13);
        }
      }
    },

    angry(g, cx, cy, R, t) {
      const sx = Math.sin(t * 40) * R * 0.035;
      // Steam
      for (const s of [-1, 1]) {
        for (let k = 0; k < 2; k++) {
          const p = (t * 1.2 + k * 0.5 + (s > 0 ? 0.3 : 0)) % 1;
          g.fillStyle = `rgba(255,255,255,${0.85 * (1 - p)})`;
          g.beginPath(); g.arc(cx + s * (R * 0.75 + p * R * 0.3), cy - R * 0.85 - p * R * 0.6, R * (0.14 + p * 0.18), 0, Math.PI * 2); g.fill();
        }
      }
      g.save();
      g.translate(sx, 0);
      face(g, cx, cy, R, '#ff9a6b', '#d0281c');
      // Brows
      line(g, [[cx - R * 0.62, cy - R * 0.55], [cx - R * 0.14, cy - R * 0.3]], R * 0.14, '#3a0d00');
      line(g, [[cx + R * 0.62, cy - R * 0.55], [cx + R * 0.14, cy - R * 0.3]], R * 0.14, '#3a0d00');
      // Eyes
      g.fillStyle = '#fff';
      for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * R * 0.33, cy - R * 0.12, R * 0.15, R * 0.1, 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#2a0800';
      for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * R * 0.3, cy - R * 0.1, R * 0.07, 0, Math.PI * 2); g.fill(); }
      // Gritted teeth
      g.fillStyle = '#fff';
      roundRect(g, cx - R * 0.42, cy + R * 0.28, R * 0.84, R * 0.32, R * 0.1);
      g.fill();
      g.lineWidth = R * 0.06; g.strokeStyle = '#3a0d00'; g.stroke();
      line(g, [[cx - R * 0.42, cy + R * 0.44], [cx + R * 0.42, cy + R * 0.44]], R * 0.04, '#3a0d00');
      for (let i = 1; i < 4; i++) line(g, [[cx - R * 0.42 + i * R * 0.21, cy + R * 0.28], [cx - R * 0.42 + i * R * 0.21, cy + R * 0.6]], R * 0.04, '#3a0d00');
      g.restore();
    },

    surprised(g, cx, cy, R, t) {
      const pop = t < 0.3 ? 1 + Math.sin((t / 0.3) * Math.PI) * 0.12 : 1;
      g.save();
      g.translate(cx, cy);
      g.scale(pop, pop);
      face(g, 0, 0, R);
      // Raised brows
      g.strokeStyle = INK; g.lineWidth = R * 0.09; g.lineCap = 'round';
      for (const s of [-1, 1]) { g.beginPath(); g.arc(s * R * 0.36, -R * 0.42, R * 0.2, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke(); }
      // Wide eyes
      for (const s of [-1, 1]) {
        g.fillStyle = '#fff';
        g.beginPath(); g.arc(s * R * 0.34, -R * 0.12, R * 0.2, 0, Math.PI * 2); g.fill();
        g.lineWidth = R * 0.05; g.strokeStyle = INK; g.stroke();
        g.fillStyle = '#2a1500';
        g.beginPath(); g.arc(s * R * 0.34, -R * 0.1, R * 0.08, 0, Math.PI * 2); g.fill();
      }
      // O mouth
      const m = 1 + Math.sin(t * 6) * 0.08;
      g.fillStyle = '#5a140a';
      g.beginPath(); g.ellipse(0, R * 0.42, R * 0.17 * m, R * 0.23 * m, 0, 0, Math.PI * 2); g.fill();
      g.restore();
      // Shock lines
      const a = 0.5 + 0.5 * Math.sin(t * 10);
      g.globalAlpha = a;
      line(g, [[cx - R * 1.05, cy - R * 0.85], [cx - R * 0.85, cy - R * 0.6]], R * 0.08, '#fff');
      line(g, [[cx + R * 1.05, cy - R * 0.85], [cx + R * 0.85, cy - R * 0.6]], R * 0.08, '#fff');
      line(g, [[cx, cy - R * 1.3], [cx, cy - R * 1.08]], R * 0.08, '#fff');
      g.globalAlpha = 1;
    },

    celebrate(g, cx, cy, R, t) {
      const COLORS = ['#ff4d6d', '#4dc3ff', '#ffe14d', '#7dff8a', '#c38bff'];
      // Confetti behind and around
      for (let i = 0; i < 12; i++) {
        const p = (t * 0.7 + i * 0.083) % 1;
        const x = cx + Math.sin(i * 2.4) * R * 1.15 + Math.sin(t * 3 + i) * R * 0.1;
        const y = cy - R * 1.2 + p * R * 2.4;
        g.save();
        g.translate(x, y);
        g.rotate(t * 5 + i);
        g.globalAlpha = 1 - p * 0.6;
        g.fillStyle = COLORS[i % COLORS.length];
        g.fillRect(-R * 0.07, -R * 0.04, R * 0.14, R * 0.08);
        g.restore();
      }
      g.globalAlpha = 1;
      const by = Math.abs(Math.sin(t * 8)) * R * -0.06;
      face(g, cx, cy + by, R);
      happyEyes(g, cx, cy + by, R);
      bigMouth(g, cx, cy + by, R, 0.7);
      // Party hat
      g.save();
      g.translate(cx + R * 0.35, cy + by - R * 0.78);
      g.rotate(0.35);
      g.fillStyle = '#c38bff';
      g.beginPath(); g.moveTo(-R * 0.32, R * 0.15); g.lineTo(0, -R * 0.75); g.lineTo(R * 0.32, R * 0.15); g.closePath(); g.fill();
      g.save(); g.clip();
      g.fillStyle = '#ffe14d';
      for (let i = 0; i < 3; i++) g.fillRect(-R, -R * 0.55 + i * R * 0.25, R * 2, R * 0.08);
      g.restore();
      g.fillStyle = '#ff4d6d';
      g.beginPath(); g.arc(0, -R * 0.78, R * 0.1, 0, Math.PI * 2); g.fill();
      g.restore();
    },

    facepalm(g, cx, cy, R, t) {
      const tilt = Math.sin(t * 2.2) * 0.08;
      g.save();
      g.translate(cx, cy);
      g.rotate(tilt);
      face(g, 0, 0, R);
      // Flat, unimpressed mouth
      line(g, [[-R * 0.32, R * 0.48], [R * 0.3, R * 0.4]], R * 0.09);
      // Hand over the eyes
      g.save();
      g.rotate(-0.25);
      g.fillStyle = SKIN;
      roundRect(g, -R * 0.85, -R * 0.48, R * 1.55, R * 0.62, R * 0.28);
      g.fill();
      g.lineWidth = R * 0.06; g.strokeStyle = SKIN_LINE; g.stroke();
      for (let i = 1; i <= 3; i++) line(g, [[-R * 0.85 + i * R * 0.34, -R * 0.44], [-R * 0.85 + i * R * 0.34, -R * 0.22]], R * 0.045, SKIN_LINE);
      // Wrist going off the bottom-right
      g.fillStyle = SKIN;
      roundRect(g, R * 0.35, -R * 0.2, R * 0.5, R * 1.1, R * 0.22);
      g.fill(); g.stroke();
      g.restore();
      g.restore();
      const p = (t * 0.8) % 1;
      drop(g, cx - R * 0.95, cy - R * 0.5 + p * R * 0.5, R * 0.16, '#9fdcff');
    },

    cool(g, cx, cy, R, t) {
      const nod = Math.sin(t * 5) * R * 0.04;
      g.save();
      g.translate(0, nod);
      face(g, cx, cy, R);
      // Smirk
      g.strokeStyle = INK; g.lineWidth = R * 0.09; g.lineCap = 'round';
      g.beginPath(); g.moveTo(cx - R * 0.3, cy + R * 0.42); g.quadraticCurveTo(cx + R * 0.1, cy + R * 0.6, cx + R * 0.42, cy + R * 0.3); g.stroke();
      // Sunglasses
      g.fillStyle = '#14141c';
      g.beginPath();
      g.moveTo(cx - R * 0.85, cy - R * 0.32);
      g.lineTo(cx + R * 0.85, cy - R * 0.32);
      g.lineTo(cx + R * 0.8, cy - R * 0.2);
      g.quadraticCurveTo(cx + R * 0.7, cy + R * 0.12, cx + R * 0.38, cy + R * 0.1);
      g.quadraticCurveTo(cx + R * 0.1, cy + R * 0.08, cx + R * 0.06, cy - R * 0.16);
      g.lineTo(cx - R * 0.06, cy - R * 0.16);
      g.quadraticCurveTo(cx - R * 0.1, cy + R * 0.08, cx - R * 0.38, cy + R * 0.1);
      g.quadraticCurveTo(cx - R * 0.7, cy + R * 0.12, cx - R * 0.8, cy - R * 0.2);
      g.closePath();
      g.fill();
      // Glint sweeping across the lenses
      const p = (t * 0.9) % 1.6;
      if (p < 1) {
        g.save();
        g.clip();
        g.fillStyle = 'rgba(255,255,255,0.75)';
        g.translate(cx - R + p * R * 2, cy - R * 0.1);
        g.rotate(0.6);
        g.fillRect(-R * 0.05, -R * 0.5, R * 0.1, R);
        g.restore();
      }
      g.restore();
    },

    heart(g, cx, cy, R, t) {
      // A beating heart with sparkles
      const beat = 1 + Math.max(0, Math.sin(t * 7)) * 0.12;
      g.save();
      g.translate(cx, cy + R * 0.05);
      g.scale(beat, beat);
      const grad = g.createLinearGradient(0, -R, 0, R);
      grad.addColorStop(0, '#ff8fa8');
      grad.addColorStop(1, '#e0244a');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, R * 0.85);
      g.bezierCurveTo(-R * 1.3, -R * 0.05, -R * 0.75, -R * 1.05, 0, -R * 0.45);
      g.bezierCurveTo(R * 0.75, -R * 1.05, R * 1.3, -R * 0.05, 0, R * 0.85);
      g.fill();
      g.lineWidth = R * 0.07;
      g.strokeStyle = '#8a0f2a';
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.beginPath(); g.ellipse(-R * 0.4, -R * 0.35, R * 0.18, R * 0.1, -0.7, 0, Math.PI * 2); g.fill();
      g.restore();
      const tw = (Math.sin(t * 5) + 1) / 2;
      star(g, cx + R * 0.95, cy - R * 0.75, R * (0.12 + tw * 0.12));
      star(g, cx - R * 0.95, cy + R * 0.55, R * (0.2 - tw * 0.08));
    },

    thinking(g, cx, cy, R, t) {
      face(g, cx, cy, R);
      // One raised brow, eyes glancing up
      line(g, [[cx - R * 0.55, cy - R * 0.42], [cx - R * 0.2, cy - R * 0.5]], R * 0.08);
      line(g, [[cx + R * 0.2, cy - R * 0.62], [cx + R * 0.55, cy - R * 0.5]], R * 0.08);
      const look = Math.sin(t * 1.5) * R * 0.05;
      g.fillStyle = INK;
      g.beginPath(); g.arc(cx - R * 0.36 + look, cy - R * 0.22, R * 0.09, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(cx + R * 0.36 + look, cy - R * 0.28, R * 0.09, 0, Math.PI * 2); g.fill();
      line(g, [[cx - R * 0.25, cy + R * 0.42], [cx + R * 0.3, cy + R * 0.32]], R * 0.08);
      // Hand on the chin
      g.fillStyle = SKIN;
      g.strokeStyle = SKIN_LINE;
      g.lineWidth = R * 0.05;
      g.beginPath(); g.ellipse(cx + R * 0.15, cy + R * 0.8, R * 0.32, R * 0.22, -0.3, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(cx - R * 0.08, cy + R * 0.55, R * 0.1, R * 0.22, 0.4, 0, Math.PI * 2); g.fill(); g.stroke();
      // Thought dots drifting up
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.8 + i * 0.33) % 1;
        g.fillStyle = `rgba(255,255,255,${0.9 * (1 - k)})`;
        g.beginPath(); g.arc(cx + R * (0.8 + i * 0.18), cy - R * (0.6 + k * 0.6 + i * 0.15), R * (0.06 + i * 0.03), 0, Math.PI * 2); g.fill();
      }
    },

    sleepy(g, cx, cy, R, t) {
      const sway = Math.sin(t * 2) * 0.06;
      g.save();
      g.translate(cx, cy);
      g.rotate(sway);
      face(g, 0, 0, R, '#ffe9a0', '#e9b44a');
      // Closed eyes and a little open mouth
      line(g, [[-R * 0.55, -R * 0.12], [-R * 0.2, -R * 0.08]], R * 0.09);
      line(g, [[R * 0.2, -R * 0.08], [R * 0.55, -R * 0.12]], R * 0.09);
      g.fillStyle = '#5a140a';
      g.beginPath(); g.ellipse(0, R * 0.38, R * 0.12, R * 0.1 + Math.max(0, Math.sin(t * 2)) * R * 0.05, 0, 0, Math.PI * 2); g.fill();
      // Drool bubble
      const b = 0.5 + 0.5 * Math.sin(t * 2);
      g.fillStyle = 'rgba(180,230,255,0.75)';
      g.beginPath(); g.arc(R * 0.32, R * 0.4, R * (0.06 + b * 0.12), 0, Math.PI * 2); g.fill();
      g.restore();
      // Floating Zzz
      g.font = `900 ${Math.round(R * 0.42)}px "Orbitron","Space Grotesk",sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.6 + i / 3) % 1;
        g.globalAlpha = 1 - k;
        g.fillStyle = '#cfe8ff';
        g.strokeStyle = '#3a5a8a';
        g.lineWidth = R * 0.06;
        const zx = cx + R * (0.75 + k * 0.4);
        const zy = cy - R * (0.4 + k * 0.9);
        g.strokeText('Z', zx, zy);
        g.fillText('Z', zx, zy);
      }
      g.globalAlpha = 1;
    },

    trophy(g, cx, cy, R, t) {
      // A gleaming golden cup that bounces
      const hop = Math.abs(Math.sin(t * 4)) * R * 0.12;
      const y = cy - hop;
      const grad = g.createLinearGradient(cx - R, 0, cx + R, 0);
      grad.addColorStop(0, '#c98a00');
      grad.addColorStop(0.45, '#fff3a0');
      grad.addColorStop(1, '#d99a00');
      g.fillStyle = grad;
      g.strokeStyle = '#7a4d00';
      g.lineWidth = R * 0.06;
      // Handles
      g.beginPath(); g.arc(cx - R * 0.62, y - R * 0.3, R * 0.28, Math.PI * 0.5, Math.PI * 1.5); g.stroke();
      g.beginPath(); g.arc(cx + R * 0.62, y - R * 0.3, R * 0.28, -Math.PI * 0.5, Math.PI * 0.5); g.stroke();
      // Cup
      g.beginPath();
      g.moveTo(cx - R * 0.65, y - R * 0.75);
      g.lineTo(cx + R * 0.65, y - R * 0.75);
      g.quadraticCurveTo(cx + R * 0.6, y + R * 0.15, cx, y + R * 0.25);
      g.quadraticCurveTo(cx - R * 0.6, y + R * 0.15, cx - R * 0.65, y - R * 0.75);
      g.fill(); g.stroke();
      // Stem and base
      g.fillRect(cx - R * 0.1, y + R * 0.22, R * 0.2, R * 0.3);
      g.strokeRect(cx - R * 0.1, y + R * 0.22, R * 0.2, R * 0.3);
      roundRect(g, cx - R * 0.45, y + R * 0.5, R * 0.9, R * 0.28, R * 0.08);
      g.fill(); g.stroke();
      // Star on the cup and a sweeping glint
      star(g, cx, y - R * 0.3, R * 0.22, '#ffffff');
      const p = (t * 0.8) % 1.4;
      if (p < 1) {
        g.fillStyle = 'rgba(255,255,255,0.6)';
        g.fillRect(cx - R * 0.6 + p * R * 1.2, y - R * 0.7, R * 0.08, R * 0.8);
      }
      const tw = (Math.sin(t * 6) + 1) / 2;
      star(g, cx + R * 0.95, y - R * 0.85, R * (0.1 + tw * 0.14));
    },

    gg(g, cx, cy, R, t) {
      const bob = Math.sin(t * 4) * R * 0.05;
      const y = cy + bob;
      const grad = g.createLinearGradient(0, y - R, 0, y + R);
      grad.addColorStop(0, '#fff3a0');
      grad.addColorStop(0.5, '#ffcf3a');
      grad.addColorStop(1, '#d98a00');
      g.fillStyle = grad;
      roundRect(g, cx - R * 1.0, y - R * 0.7, R * 2.0, R * 1.4, R * 0.42);
      g.fill();
      g.lineWidth = R * 0.08;
      g.strokeStyle = '#8a5200';
      g.stroke();
      g.font = `900 ${Math.round(R * 1.0)}px "Orbitron","Space Grotesk",sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = R * 0.16;
      g.strokeStyle = '#8a5200';
      g.strokeText('GG', cx, y + R * 0.05);
      g.fillStyle = '#fff';
      g.fillText('GG', cx, y + R * 0.05);
      const tw = (Math.sin(t * 6) + 1) / 2;
      star(g, cx + R * 0.95, y - R * 0.7, R * (0.12 + tw * 0.14));
      star(g, cx - R * 1.0, y + R * 0.65, R * (0.24 - tw * 0.12));
    },
  };

  function draw(g, id, cx, cy, R, t) {
    const fn = ART[id];
    if (!fn) return;
    g.save();
    fn(g, cx, cy, R, t || 0);
    g.restore();
  }

  // Speech bubble with a tail pointing at (tx, ty)
  function bubble(g, x, y, w, h, tx, ty, border) {
    const r = Math.min(w, h) * 0.3;
    const lw = Math.max(2, h * 0.05);
    const ang = Math.atan2(ty - y, tx - x);
    const bx = x + Math.cos(ang) * w * 0.3;
    const by = y + Math.sin(ang) * h * 0.3;
    const px = Math.cos(ang + Math.PI / 2) * h * 0.14;
    const py = Math.sin(ang + Math.PI / 2) * h * 0.14;
    const tail = (k, tipBack) => {
      g.beginPath();
      g.moveTo(bx + px * k, by + py * k);
      g.lineTo(tx - Math.cos(ang) * tipBack, ty - Math.sin(ang) * tipBack);
      g.lineTo(bx - px * k, by - py * k);
    };
    g.save();
    g.fillStyle = '#fff';
    g.shadowColor = 'rgba(0,0,0,0.35)';
    g.shadowBlur = h * 0.15;
    g.shadowOffsetY = h * 0.05;
    roundRect(g, x - w / 2, y - h / 2, w, h, r);
    g.fill();
    tail(1, 0); g.fill();
    g.shadowColor = 'transparent';
    g.lineWidth = lw;
    g.lineJoin = 'round';
    g.strokeStyle = border || '#3d8bff';
    roundRect(g, x - w / 2, y - h / 2, w, h, r);
    g.stroke();
    tail(1, 0); g.stroke();
    // Paint over the border where the tail joins the bubble
    tail(1 - lw / Math.hypot(px, py), lw * 1.2); g.fill();
    roundRect(g, x - w / 2 + lw / 2, y - h / 2 + lw / 2, w - lw, h - lw, r);
    g.fill();
    g.restore();
  }

  window.EmoteArt = { EMOTES, draw, bubble, ids: EMOTES.map((e) => e.id) };
})();
