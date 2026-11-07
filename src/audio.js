"use strict";
// Pure-JS audio: (1) re-creates the game's sound effects at the exact moments they happened,
// (2) generates a procedural chiptune backing track that is different for every video.
const SR = 44100;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Track {
  constructor(sec) { this.n = Math.ceil(sec * SR); this.buf = new Float32Array(this.n); }
  tone(t0, freq, dur, type, vol, glideTo) {
    const s = Math.floor(t0 * SR), n = Math.floor(dur * SR);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const x = i / n;
      const f = glideTo ? freq * Math.pow(glideTo / freq, x) : freq;
      ph += f / SR; ph -= Math.floor(ph);
      const idx = s + i; if (idx < 0 || idx >= this.n) continue;
      let v;
      if (type === "square") v = ph < 0.5 ? 1 : -1;
      else if (type === "sawtooth") v = 2 * ph - 1;
      else if (type === "triangle") v = 4 * Math.abs(ph - 0.5) - 1;
      else v = Math.sin(2 * Math.PI * ph);
      this.buf[idx] += v * vol * Math.pow(0.001 / vol, x);
    }
  }
  noise(t0, dur, vol, rnd, bright) {
    const s = Math.floor(t0 * SR), n = Math.floor(dur * SR); let prev = 0;
    for (let i = 0; i < n; i++) {
      const idx = s + i; if (idx < 0 || idx >= this.n) continue;
      const w = rnd() * 2 - 1; const v = bright ? w - prev : w; prev = w;
      this.buf[idx] += v * vol * Math.pow(0.001 / vol, i / n);
    }
  }
}

// --- the game's own sound recipes (copied from index.html) ---
const SFX = {
  smashNormal: (t, at) => t.tone(at, 180, 0.12, "square", 0.25, 60),
  smashGold: (t, at) => { t.tone(at, 660, 0.09, "sine", 0.25, 880); t.tone(at + 0.07, 990, 0.12, "sine", 0.2, 1200); },
  smashBee: (t, at) => t.tone(at, 120, 0.25, "sawtooth", 0.25, 40),
  clock: (t, at) => { t.tone(at, 520, 0.08, "triangle", 0.25, 780); t.tone(at + 0.08, 780, 0.1, "triangle", 0.25, 1040); t.tone(at + 0.16, 1040, 0.14, "triangle", 0.22, 1300); },
  frenzy: (t, at) => { t.tone(at, 300, 0.1, "sawtooth", 0.18, 600); t.tone(at + 0.09, 600, 0.12, "sawtooth", 0.18, 1200); },
  combo: (t, at, a) => t.tone(at, 420 + Math.min(a[0] || 1, 12) * 45, 0.08, "triangle", 0.15),
  tick: (t, at) => t.tone(at, 880, 0.04, "square", 0.06),
  count: (t, at) => t.tone(at, 520, 0.12, "sine", 0.22),
  go: (t, at) => t.tone(at, 880, 0.25, "sine", 0.25, 1320),
  whiff: (t, at) => t.tone(at, 90, 0.06, "sine", 0.1, 60),
  gameOver: (t, at) => { t.tone(at, 300, 0.2, "sine", 0.2, 180); t.tone(at + 0.15, 200, 0.3, "sine", 0.2, 100); },
  // Neon Tower sounds (same recipes as that game's beep() calls)
  ntPerfect: (t, at, a) => t.tone(at, 330 * Math.pow(2, Math.min((a[0] || 1) * 2, 16) / 12), 0.22, "triangle", 0.2),
  ntPlace: (t, at) => t.tone(at, 190, 0.1, "square", 0.09),
  ntZone: (t, at) => { t.tone(at, 660, 0.3, "sine", 0.14); t.tone(at + 0.12, 990, 0.4, "sine", 0.12); },
  ntOver: (t, at) => { t.tone(at, 160, 0.5, "sawtooth", 0.18); t.tone(at + 0.12, 90, 0.6, "sawtooth", 0.18); },
  newBest: (t, at) => [523, 659, 784, 1047].forEach((f, i) => t.tone(at + i * 0.11, f, 0.16, "triangle", 0.2, f * 1.02))
};

// --- music styles (names are stored in history so the planner can rotate them) ---
const STYLES = {
  chip_bounce: { scale: [0, 2, 4, 7, 9], tempo: [118, 134], lead: "square", bass: "triangle", swing: 0, density: 0.6, progs: [[0, 3, 4, 0], [0, 4, 5, 3], [0, 5, 3, 4]] },
  arcade_tense: { scale: [0, 2, 3, 5, 7, 8, 10], tempo: [136, 150], lead: "sawtooth", bass: "square", swing: 0, density: 0.5, progs: [[0, 5, 3, 4], [0, 3, 5, 4], [0, 6, 5, 4]] },
  sunny_pop: { scale: [0, 2, 4, 6, 7, 9, 11], tempo: [104, 118], lead: "triangle", bass: "sine", swing: 0.05, density: 0.55, progs: [[0, 4, 5, 3], [0, 3, 0, 4], [0, 5, 1, 4]] },
  funk_groove: { scale: [0, 2, 3, 5, 7, 9, 10], tempo: [98, 112], lead: "square", bass: "sawtooth", swing: 0.18, density: 0.5, progs: [[0, 3, 0, 4], [0, 0, 3, 4], [0, 6, 3, 4]] },
  epic_run: { scale: [0, 1, 4, 5, 7, 8, 10], tempo: [142, 156], lead: "sawtooth", bass: "triangle", swing: 0, density: 0.65, progs: [[0, 1, 0, 6], [0, 5, 6, 4], [0, 3, 1, 0]] }
};

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function degree(root, scale, idx) {
  const len = scale.length; const oct = Math.floor(idx / len); const i = ((idx % len) + len) % len;
  return root + scale[i] + 12 * oct;
}

function writeMusic(track, m, seconds) {
  const S = STYLES[m.style]; const rnd = mulberry32(m.seed);
  const step = 60 / m.tempo / 4; const prog = S.progs[m.prog % S.progs.length];
  const bassPat = [[0, 6, 8, 14], [0, 3, 6, 8, 11, 14], [0, 8, 10]][m.bassVar % 3];
  const arpPat = [[0, 1, 2, 1], [0, 2, 1, 2], [2, 1, 0, 1]][m.arpVar % 3];
  const motifs = {}; // one melody per chord, reused every time that chord returns -> sounds composed, not random
  const bars = Math.ceil(seconds / (step * 16)) + 1;
  for (let bar = 0; bar < bars; bar++) {
    const ci = bar % 4; const chord = prog[ci];
    const tones = [chord, chord + 2, chord + 4];
    if (!motifs[ci]) {
      let pos = chord + 7; const arr = [];
      for (let s = 0; s < 16; s++) {
        if (s % 2 === 0 && rnd() < S.density) { pos += [-2, -1, -1, 0, 1, 1, 2][Math.floor(rnd() * 7)]; pos = Math.max(chord + 4, Math.min(chord + 11, pos)); arr.push(pos); } else arr.push(null);
      }
      motifs[ci] = arr;
    }
    for (let s = 0; s < 16; s++) {
      const at = (bar * 16 + s) * step + (s % 2 ? S.swing * step : 0);
      if (at >= seconds) return;
      if (bassPat.includes(s)) track.tone(at, mtof(degree(m.root - 12, S.scale, chord)), step * 1.8, S.bass, 0.16, null);
      track.tone(at, mtof(degree(m.root + 12, S.scale, tones[arpPat[s % 4] % 3])), step * 0.9, S.lead, 0.05, null);
      const mo = motifs[ci][s];
      if (mo !== null) track.tone(at, mtof(degree(m.root + 24, S.scale, mo)), step * 1.7, S.lead, 0.07, null);
      if (s === 0 || s === 8 || (s === 10 && m.bassVar === 1)) track.tone(at, 150, 0.13, "sine", 0.45, 45);
      if (s === 4 || s === 12) { track.noise(at, 0.12, 0.16, rnd, false); track.tone(at, 200, 0.07, "triangle", 0.12, 120); }
      if (s % 2 === 0 || m.style === "epic_run") track.noise(at, 0.035, 0.05, rnd, true);
    }
  }
}

function renderWav(events, durationSec, music) {
  const sfx = new Track(durationSec), mus = new Track(durationSec);
  writeMusic(mus, music, durationSec);
  for (const e of events) { const f = SFX[e.k]; if (f && e.at >= 0 && e.at < durationSec) f(sfx, e.at, e.a || []); }
  const out = new Float32Array(sfx.n);
  const fadeIn = Math.floor(0.25 * SR), fadeOut = Math.floor(0.9 * SR);
  for (let i = 0; i < out.length; i++) {
    let m = mus.buf[i] * 0.55;
    if (i < fadeIn) m *= i / fadeIn;
    if (i > out.length - fadeOut) m *= (out.length - i) / fadeOut;
    out[i] = Math.tanh((m + sfx.buf[i]) * 1.15);
  }
  const data = Buffer.alloc(out.length * 4 + 44);
  data.write("RIFF", 0); data.writeUInt32LE(36 + out.length * 4, 4); data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22); data.writeUInt32LE(SR, 24);
  data.writeUInt32LE(SR * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34); data.write("data", 36); data.writeUInt32LE(out.length * 4, 40);
  for (let i = 0; i < out.length; i++) { const v = Math.max(-1, Math.min(1, out[i])) * 32000; data.writeInt16LE(v, 44 + i * 4); data.writeInt16LE(v, 46 + i * 4); }
  return data;
}

module.exports = { renderWav, STYLES, SFX };
