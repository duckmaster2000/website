/*
 * Card portraits, drawn in the arena's own visual language so a card looks like what it puts
 * on the field: the ground of the arena where the card unlocks, the unit as the same team-blue
 * token the battle draws (several for swarms, hovering for flyers, a stone plinth for buildings),
 * and an energy burst for spells. Each portrait is drawn once per card, cached as an image, and
 * exposed as a CSS class (`CardArt.cls(id)`), so re-rendered hands and grids never redraw it.
 * Without canvas support the emoji icon in the markup simply stays visible.
 */
(function () {
  'use strict';

  const W = 168;
  const H = 128;
  const RARITY_GLOW = { common: '#88c7ff', rare: '#63ffd2', epic: '#ffb36c', legendary: '#ffd35f', champion: '#ff728f' };
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  const made = new Set();
  let sheet = null;

  function themeFor(card) {
    const arenas = window.TrophyRoad && window.TrophyRoad.ARENAS;
    const name = arenas && arenas[card.arena] ? arenas[card.arena].theme : 'meadow';
    const themes = window.ArenaView && window.ArenaView.THEMES;
    return (themes && (themes[name] || themes.meadow)) || null;
  }

  // Small deterministic random so a card's scenery is the same every time
  function seeded(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return () => {
      h = Math.imul(h ^ (h >>> 15), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }

  function emoji(g, icon, x, y, px) {
    g.font = `${Math.round(px)}px ${EMOJI_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(icon, x, y + px * 0.06);
  }

  function shadow(g, x, y, rx, ry, a) {
    g.fillStyle = `rgba(0,0,0,${a})`;
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
  }

  // The battle's troop token: dark rim, lit body, emoji on top
  function token(g, icon, x, y, r) {
    const team = (window.ArenaView && window.ArenaView.TEAM.A) || { main: '#3d8bff', dark: '#1d4f9e', light: '#9cc7ff' };
    g.fillStyle = team.dark;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    const body = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r * 0.88);
    body.addColorStop(0, team.light);
    body.addColorStop(1, team.main);
    g.fillStyle = body;
    g.beginPath(); g.arc(x, y, r * 0.86, 0, Math.PI * 2); g.fill();
    emoji(g, icon, x, y, r * 1.15);
  }

  function ground(g, card, rand) {
    const t = themeFor(card);
    const top = card.spell ? '#1b1440' : '#1d3557';
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, top);
    sky.addColorStop(0.55, t ? t.grass[1] : '#4c923f');
    sky.addColorStop(1, t ? t.grass[0] : '#3a7a30');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    // The arena's checkered ground, in perspective-ish bands
    if (t) {
      for (let row = 0; row < 5; row++) {
        const y0 = H * 0.55 + row * 12;
        for (let col = -1; col < 9; col++) {
          if ((row + col) % 2) continue;
          g.fillStyle = 'rgba(255,255,255,0.05)';
          g.fillRect(col * 22 + (row % 2) * 11, y0, 22, 12);
        }
      }
      // Tufts / decor dots in the theme's colours
      for (let i = 0; i < 14; i++) {
        g.fillStyle = t.tuft[i % 2];
        g.beginPath(); g.arc(rand() * W, H * 0.6 + rand() * H * 0.4, 1.2 + rand() * 1.6, 0, Math.PI * 2); g.fill();
      }
    }
  }

  function glow(g, card) {
    const c = RARITY_GLOW[card.rarity] || RARITY_GLOW.common;
    const rg = g.createRadialGradient(W / 2, H * 0.45, 4, W / 2, H * 0.45, W * 0.55);
    rg.addColorStop(0, `${c}66`);
    rg.addColorStop(1, `${c}00`);
    g.fillStyle = rg;
    g.fillRect(0, 0, W, H);
  }

  function drawTroops(g, card) {
    const n = Math.min(5, card.swarmCount || 1);
    const air = !!card.air;
    const big = card.hp >= 900 ? 1.18 : card.hp >= 500 ? 1.05 : 0.92;
    const r = n === 1 ? 30 * big : n <= 3 ? 21 : 17;
    // Swarms fan out in a shallow arc, front ones lower and larger
    const spots = n === 1 ? [[0, 0]] : Array.from({ length: n }, (_, i) => {
      const k = n === 1 ? 0 : i / (n - 1) - 0.5;
      return [k * (n <= 3 ? 70 : 92), Math.abs(k) * -14 + (i % 2) * 6];
    });
    spots.sort((a, b) => a[1] - b[1]);
    const lift = air ? 16 : 0;
    for (const [dx, dy] of spots) {
      const x = W / 2 + dx;
      const y = H * 0.6 + dy;
      shadow(g, x, y + r * 0.55 + (air ? 6 : 0), r * (air ? 0.7 : 0.95), r * (air ? 0.28 : 0.42), air ? 0.22 : 0.35);
      token(g, card.icon, x, y - lift, r);
    }
  }

  function drawBuilding(g, card) {
    const s = 64;
    const x = W / 2 - s / 2;
    const y = H * 0.32;
    shadow(g, W / 2, y + s + 2, s * 0.62, 9, 0.38);
    const body = g.createLinearGradient(x, y, x + s, y + s);
    body.addColorStop(0, '#b4b9c2');
    body.addColorStop(1, '#5f646d');
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(x + 10, y); g.lineTo(x + s - 10, y); g.quadraticCurveTo(x + s, y, x + s, y + 10);
    g.lineTo(x + s, y + s - 10); g.quadraticCurveTo(x + s, y + s, x + s - 10, y + s);
    g.lineTo(x + 10, y + s); g.quadraticCurveTo(x, y + s, x, y + s - 10);
    g.lineTo(x, y + 10); g.quadraticCurveTo(x, y, x + 10, y);
    g.fill();
    g.strokeStyle = '#3d8bff';
    g.lineWidth = 3;
    g.stroke();
    // Battlements
    g.fillStyle = '#8e939c';
    for (let i = 0; i < 4; i++) g.fillRect(x + 6 + i * 15, y - 6, 9, 7);
    emoji(g, card.icon, W / 2, y + s / 2, 38);
  }

  function drawSpell(g, card, rand) {
    const c = RARITY_GLOW[card.rarity] || '#d64bff';
    const cx = W / 2;
    const cy = H * 0.52;
    for (let i = 3; i >= 1; i--) {
      g.strokeStyle = `${c}${['55', '88', 'cc'][i - 1]}`;
      g.lineWidth = 2;
      g.beginPath(); g.ellipse(cx, cy + 14, 16 * i + 10, 6 * i + 4, 0, 0, Math.PI * 2); g.stroke();
    }
    // Sparks flying out
    for (let i = 0; i < 18; i++) {
      const a = rand() * Math.PI * 2;
      const d = 26 + rand() * 40;
      g.fillStyle = i % 3 ? `${c}cc` : '#ffffffcc';
      g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.6, 1 + rand() * 2, 0, Math.PI * 2); g.fill();
    }
    const halo = g.createRadialGradient(cx, cy, 2, cx, cy, 44);
    halo.addColorStop(0, '#ffffffaa');
    halo.addColorStop(1, '#ffffff00');
    g.fillStyle = halo;
    g.beginPath(); g.arc(cx, cy, 44, 0, Math.PI * 2); g.fill();
    emoji(g, card.icon, cx, cy, 50);
  }

  function render(card) {
    const c = document.createElement('canvas');
    c.width = W * 2;
    c.height = H * 2;
    const g = c.getContext('2d');
    if (!g) return null;
    g.scale(2, 2);
    const rand = seeded(card.id);
    ground(g, card, rand);
    glow(g, card);
    if (card.spell) drawSpell(g, card, rand);
    else if (card.building) drawBuilding(g, card);
    else drawTroops(g, card);
    // A soft vignette pulls the eye to the middle
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);
    try { return c.toDataURL('image/png'); } catch (_) { return null; }
  }

  /** CSS class that shows card `id`'s portrait as a background (empty string if it can't be drawn). */
  function cls(id) {
    const card = window.ClashSim && window.ClashSim.CARD_MAP[id];
    if (!card) return '';
    const name = `art-${id.replace(/[^a-z0-9-]/gi, '')}`;
    if (made.has(name)) return `has-art ${name}`;
    const url = render(card);
    if (!url) return '';
    if (!sheet) {
      const el = document.createElement('style');
      el.id = 'cardArtSheet';
      document.head.appendChild(el);
      sheet = el.sheet;
    }
    sheet.insertRule(`.${name}{background-image:url("${url}")}`, sheet.cssRules.length);
    made.add(name);
    return `has-art ${name}`;
  }

  window.CardArt = { cls, render };
  // Shorthand used by the page templates; '' when there is no art (the emoji stays visible)
  window.artCls = (id) => { try { return cls(id); } catch (_) { return ''; } };
})();
