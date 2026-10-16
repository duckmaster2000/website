/*
 * Background music, generated live with Web Audio (no audio files): an original loop over a
 * i–VI–III–VII chord cycle in A minor. Menus get a slow pad; battles add bass and an arpeggio,
 * and pick up (faster, with percussion) in double elixir and overtime.
 *
 * It plays through Sound's context and master volume (prototype_v4.js), so the main mute and
 * volume cover it too; its own level is the Music slider in Settings (0 = off).
 */
const Music = (() => {
  // Chords as semitones above A2 (110 Hz): Am, F, C, G
  const CHORDS = [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]];
  const hz = (semi) => 110 * Math.pow(2, semi / 12);
  let level = 0.35;
  try { const raw = localStorage.getItem('prototype_music'); if (raw !== null && Number.isFinite(Number(raw))) level = Math.max(0, Math.min(1, Number(raw))); } catch (_) {}
  let gain = null;
  let timer = null;
  let nextAt = 0;
  let step = 0;
  let mood = 'menu';   // 'menu' | 'battle'
  let heat = 0;        // 0 normal, 1 double elixir, 2 overtime

  function ensure() {
    const ctx = Sound.ctx;
    const bus = Sound.bus();
    if (!ctx || !bus) return null;
    if (!gain) { gain = ctx.createGain(); gain.gain.value = 0; gain.connect(bus); }
    return ctx;
  }

  function note(ctx, freq, t, dur, vol, type) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.08, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(gain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function tick(ctx, t, beat) {
    // 16 steps per chord (sixteenth notes), 4 chords per loop
    const chord = CHORDS[Math.floor(step / 16) % CHORDS.length];
    const s16 = step % 16;
    if (s16 === 0) chord.forEach((n) => note(ctx, hz(n + 12), t, beat * 4, mood === 'menu' ? 0.035 : 0.022, 'triangle')); // pad
    if (mood === 'battle') {
      if (s16 % 4 === 0) note(ctx, hz(chord[0] - 12), t, beat * 0.9, 0.06, 'sawtooth');                       // bass
      if (s16 % 2 === 0) note(ctx, hz(chord[(s16 / 2) % 3] + 24 + (s16 >= 8 ? 12 : 0)), t, beat * 0.45, 0.018, 'square'); // arpeggio
      if (heat > 0 && s16 % 4 === 2) note(ctx, 2400, t, 0.05, 0.012, 'square');                               // hi-hat tick
      if (heat > 1 && s16 % 8 === 4) note(ctx, hz(chord[0] - 24), t, beat * 0.5, 0.05, 'sine');                // overtime pulse
    } else if (s16 % 8 === 4) {
      note(ctx, hz(chord[2] + 24), t, beat * 3, 0.012, 'sine');                                              // menu bell
    }
    step++;
  }

  // Schedules a little ahead of the audio clock, so timing stays steady even if a frame is late
  function pump() {
    const ctx = ensure();
    if (!ctx || level <= 0 || !Sound.enabled) return;
    const bpm = mood === 'menu' ? 72 : [108, 120, 132][heat];
    const beat = 60 / bpm / 4; // one sixteenth note
    if (nextAt < ctx.currentTime) nextAt = ctx.currentTime + 0.05;
    while (nextAt < ctx.currentTime + 0.25) { tick(ctx, nextAt, beat * 4); nextAt += beat; }
  }

  function start() {
    if (timer || level <= 0) return;
    const ctx = ensure();
    if (!ctx) return;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setTargetAtTime(level, ctx.currentTime, 0.4);
    timer = setInterval(pump, 90);
  }

  function stop() {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
    const ctx = Sound.ctx;
    if (ctx && gain) gain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
  }

  /** Called every frame: battle music while a match runs, menu music otherwise. */
  function update(view, running) {
    if (!Sound.ctx || !Sound.enabled || level <= 0) { stop(); return; }
    mood = view && running && view.running ? 'battle' : 'menu';
    heat = mood === 'battle' ? (view.phase === 'overtime' ? 2 : view.double ? 1 : 0) : 0;
    start();
  }

  function setLevel(v) {
    level = Math.max(0, Math.min(1, Number(v) || 0));
    try { localStorage.setItem('prototype_music', String(level)); } catch (_) {}
    const ctx = Sound.ctx;
    if (level <= 0) stop();
    else if (ctx && gain) gain.gain.setTargetAtTime(level, ctx.currentTime, 0.2);
  }

  return { update, setLevel, get level() { return level; } };
})();
