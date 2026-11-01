"use strict";
// The anti-repetition brain. Every video gets a "plan" (concept, theme, hook, text styles, music, seed...).
// Each choice is made with a least-recently-used rule against data/history.json, so the same combination
// does not come back until everything else has been used. Nothing here is random in a way that can repeat quickly.
const fs = require("fs");
const path = require("path");
const D = require("./data");
const cfg = require("../config.json");
const { STYLES: MUSIC } = require("./audio");

const MUSIC_STYLES = Object.keys(MUSIC);

function loadHistory(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return []; }
}
function saveHistory(file, h) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(h, null, 2));
}

const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Pick the option used longest ago (never used = best). Ties are random. `exclude` is a hard ban list.
function lruPick(options, used, exclude = []) {
  let pool = options.filter((o) => !exclude.includes(o));
  if (!pool.length) pool = options.slice();
  const last = (o) => used.lastIndexOf(o);
  const min = Math.min(...pool.map(last));
  return pickRandom(pool.filter((o) => last(o) === min));
}

function planOne(history, planned, opts = {}) {
  const all = history.concat(planned);
  const prev = all[all.length - 1];
  const col = (f) => all.map(f);

  // 1) Concept: the least used one in the recent window, never the same as the previous video.
  const ids = Object.keys(D.CONCEPTS);
  let concept = opts.concept;
  if (!concept) {
    const recent = all.slice(-18);
    const count = (c) => recent.filter((e) => e.concept === c).length;
    const pool = ids.filter((c) => !prev || c !== prev.concept);
    const min = Math.min(...pool.map(count));
    concept = pickRandom(pool.filter((c) => count(c) === min));
  }
  const C = D.CONCEPTS[concept];
  if (!C) throw new Error("Unknown concept: " + concept + " (available: " + ids.join(", ") + ")");

  // 2) Visual theme: never the same as either of the last two videos.
  const theme = lruPick(D.THEMES, col((e) => e.theme), all.slice(-2).map((e) => e.theme));

  // 3) Text: hook (per concept), styles, end call-to-action.
  const sameConcept = all.filter((e) => e.concept === concept);
  const hookTpl = lruPick(C.hooks, sameConcept.map((e) => e.hookTpl));
  const hookStyle = lruPick(D.HOOK_STYLES, col((e) => e.hookStyle), all.slice(-1).map((e) => e.hookStyle));
  const ctaStyle = lruPick(D.HOOK_STYLES, col((e) => e.ctaStyle), [hookStyle]);
  const ctaTpl = lruPick(C.ctas || D.COMMON_CTAS, col((e) => e.ctaTpl));

  // 3b) "link in bio" texts: small badge during play + bigger one at the end, both rotating.
  const bioTpl = lruPick(D.BIO_BADGES, col((e) => e.bioTpl));
  const bioEndTpl = lruPick(D.BIO_END, col((e) => e.bioEndTpl));

  // 4) Music: style rotates, key and tempo must differ from recent videos.
  const style = lruPick(MUSIC_STYLES, col((e) => e.music && e.music.style));
  const [t0, t1] = MUSIC[style].tempo;
  const lastRoots = all.slice(-3).map((e) => e.music && e.music.root);
  const lastTempo = prev && prev.music ? prev.music.tempo : -99;
  let root, tempo;
  do { root = randInt(40, 52); } while (lastRoots.includes(root));
  for (let i = 0; i < 12; i++) { tempo = randInt(t0, t1); if (Math.abs(tempo - lastTempo) >= 6) break; }
  const music = { style, root, tempo, prog: randInt(0, MUSIC[style].progs.length - 1), bassVar: randInt(0, 2), arpVar: randInt(0, 2), seed: randInt(1, 2 ** 31) };

  // 5) Seed (drives the game's randomness: ant positions, types, timing) is never reused.
  const usedSeeds = new Set(col((e) => e.seed));
  let seed; do { seed = randInt(1, 2 ** 31); } while (usedSeeds.has(seed));

  // 6) Bot behaviour: concept profile with a little random "skill drift" so no two runs feel identical.
  const drift = 0.85 + Math.random() * 0.3;
  const bot = JSON.parse(JSON.stringify(C.bot));
  const scale = (r) => r && r.map((x) => Math.round(x * drift));
  bot.react = scale(bot.react);
  if (bot.powerReact) bot.powerReact = scale(bot.powerReact);
  if (bot.goldReact) bot.goldReact = scale(bot.goldReact);
  if (bot.rush) bot.rush = { sec: bot.rush.sec, react: scale(bot.rush.react) };
  if (Array.isArray(bot.failAtStreak)) bot.failAtStreak = randInt(bot.failAtStreak[0], bot.failAtStreak[1]);

  const bestMode = Math.random() < 0.55 ? "fresh" : "chase";
  return {
    concept, theme, seed, time: cfg.gameSeconds || 14,   // fixed round length so the whole video lands on ~20s
    hookTpl, hookStyle, ctaTpl, ctaStyle, bioTpl, bioEndTpl, music, bot,
    bestMode, bestSeed: bestMode === "fresh" ? 0 : randInt(40, 400)
  };
}

function planBatch(history, count, opts = {}) {
  const planned = [];
  for (let i = 0; i < count; i++) planned.push(planOne(history, planned, opts));
  return planned;
}

// ---------- variety report ----------
const tokens = (s) => new Set(String(s).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 1));
function similarity(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

function report(history, cfg) {
  const lines = [];
  const recent = history.slice(-20);
  lines.push(`Videos made so far: ${history.length}`);
  if (!history.length) return lines.concat("Nothing to report yet. Run: node factory.js make --count 5").join("\n");
  const tally = (f) => { const m = {}; recent.forEach((e) => { const k = f(e); m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(", "); };
  lines.push(`Concepts (last ${recent.length}): ${tally((e) => e.concept)}`);
  lines.push(`Themes: ${tally((e) => e.theme)}`);
  lines.push(`Music styles: ${tally((e) => e.music.style)}`);
  lines.push(`Hook styles: ${tally((e) => e.hookStyle)}`);
  const warns = [];
  if (recent.length >= 8) {
    const top = Object.entries(recent.reduce((m, e) => (m[e.concept] = (m[e.concept] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1])[0];
    if (top[1] / recent.length > 0.3) warns.push(`Concept "${top[0]}" is ${Math.round((top[1] / recent.length) * 100)}% of recent videos.`);
  }
  for (let i = 1; i < recent.length; i++) {
    if (recent[i].title && recent[i - 1].title && similarity(recent[i].title, recent[i - 1].title) > 0.6) warns.push(`Titles #${i} and #${i + 1} are too similar.`);
  }
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = history.filter((e) => String(e.createdAt).slice(0, 10) === today).length;
  if (todayCount >= (cfg.maxPerDay || 3)) warns.push(`${todayCount} videos made today. Publishing many videos a day can look like mass-produced content to YouTube; spread them out.`);
  lines.push(warns.length ? "\nWarnings:\n - " + warns.join("\n - ") : "\nNo variety warnings. 👍");
  return lines.join("\n");
}

module.exports = { loadHistory, saveHistory, planOne, planBatch, report, similarity, lruPick, shuffle, pickRandom, randInt };
