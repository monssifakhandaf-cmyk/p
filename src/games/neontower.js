"use strict";
// Neon Tower adapter: plans a video, lets a bot play the game in a real browser, records the screen, and writes the title/description.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const planner = require("../planner");
const { buildMetaGeneric, fill } = require("../meta");
const { FX_CSS, showText } = require("../record");
const { STYLES: MUSIC } = require("../audio");
const D = require("../data");
const X = require("./neontower_content");

const { lruPick, randInt } = planner;
const MUSIC_STYLES = Object.keys(MUSIC);
const ZONES = [[12, "Cloud layer"], [28, "Bird altitude"], [40, "Satellite orbit"], [55, "Outer space"], [72, "Mars"], [92, "Saturn"], [115, "Jupiter"], [140, "Edge of the galaxy"]];
const range = (r) => (Array.isArray(r) ? randInt(r[0], r[1]) : r);

// Page layout for the recording: hides buttons that mean nothing in a video and moves the hook below the big score / altitude text.
const NT_CSS = `
#fxHook,#fxCta{top:222px !important}
#again,#share,#inst,#snd,#help{display:none !important}
`;

function planOne(history, opts = {}, cfg = {}) {
  const all = history;
  const prev = all[all.length - 1];
  const ids = Object.keys(X.CONCEPTS);
  let concept = opts.concept;
  if (!concept) {
    const recent = all.slice(-12);
    const count = (c) => recent.filter((e) => e.concept === c).length;
    const pool = ids.filter((c) => !prev || c !== prev.concept);
    const min = Math.min(...pool.map(count));
    const cands = pool.filter((c) => count(c) === min);
    concept = cands[Math.floor(Math.random() * cands.length)];
  }
  const C = X.CONCEPTS[concept];
  if (!C) throw new Error("Unknown Neon Tower concept: " + concept + " (available: " + ids.join(", ") + ")");
  const col = (f) => all.map(f);
  const sameConcept = all.filter((e) => e.concept === concept);

  const hookTpl = lruPick(C.hooks, sameConcept.map((e) => e.hookTpl));
  const hookStyle = lruPick(D.HOOK_STYLES, col((e) => e.hookStyle), all.slice(-1).map((e) => e.hookStyle));
  const ctaStyle = lruPick(D.HOOK_STYLES, col((e) => e.ctaStyle), [hookStyle]);
  const ctaTpl = lruPick(X.CTAS, col((e) => e.ctaTpl));
  const bioTpl = lruPick(X.BIO_BADGES, col((e) => e.bioTpl));
  const bioEndTpl = lruPick(X.BIO_END, col((e) => e.bioEndTpl));

  const style = lruPick(MUSIC_STYLES, col((e) => e.music && e.music.style));
  const [t0, t1] = MUSIC[style].tempo;
  const lastRoots = all.slice(-3).map((e) => e.music && e.music.root);
  let root; do { root = randInt(40, 52); } while (lastRoots.includes(root));
  const music = { style, root, tempo: randInt(t0, t1), prog: randInt(0, MUSIC[style].progs.length - 1), bassVar: randInt(0, 2), arpVar: randInt(0, 2), seed: randInt(1, 2 ** 31) };
  const usedSeeds = new Set(col((e) => e.seed));
  let seed; do { seed = randInt(1, 2 ** 31); } while (usedSeeds.has(seed));

  const b = C.bot;
  const bot = { mode: b.mode, jitter: b.jitter, endMode: b.endMode, sloppyN: range(b.sloppyN || 0), sloppyAmp: b.sloppyAmp || [0, 0], playMs: range(b.playMs) };
  const bestMode = Math.random() < 0.55 ? "fresh" : "chase";
  return { game: "neontower", concept, seed, time: 14, hookTpl, hookStyle, ctaTpl, ctaStyle, bioTpl, bioEndTpl, music, bot, bestMode, bestSeed: bestMode === "fresh" ? 0 : randInt(5, 10), timeScale: 1.4 };
}

// The bot that plays inside the page. It aims at the tower's center, with a chosen error per floor (0 = perfect), and logs sound events.
function ntBot(p) {
  const log = (k, a) => window.__LOG.push({ k, t: performance.now(), a: a || [] });
  const wrap = document.getElementById("wrap");
  const tap = () => wrap.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  const t0 = performance.now();
  const stats = { perfects: 0, bestCombo: 0, minW: 999 };
  let prevDx = null, off = 0, plannedFor = -1, doneFlag = false;
  const rnd = Math.random;   // seeded by the recorder
  const sign = () => (rnd() < 0.5 ? -1 : 1);
  function pickOff(idx) {
    if (p.mode === "thin" && idx >= 1 && idx <= p.sloppyN) return sign() * (p.sloppyAmp[0] + rnd() * (p.sloppyAmp[1] - p.sloppyAmp[0]));
    return (rnd() - 0.5) * 2 * p.jitter;
  }
  function doTap() {
    const sc = score, cm = combo, z = zi;
    tap();
    if (st === "over") { log("ntOver"); return; }
    if (score > sc) {
      if (combo > cm) { stats.perfects++; log("ntPerfect", [combo]); } else log("ntPlace");
      if (combo > stats.bestCombo) stats.bestCombo = combo;
      const w = stack[stack.length - 1].w; if (w < stats.minW) stats.minW = w;
      if (zi > z) log("ntZone");
    }
  }
  function step() {
    if (window.__botStop) return;
    if (st === "over") { window.__botStats = stats; window.__botDone = true; return; }
    if (st !== "play") { requestAnimationFrame(step); return; }
    const top = stack[stack.length - 1], idx = stack.length - 1, elapsed = performance.now() - t0;
    if (plannedFor !== idx) { plannedFor = idx; off = pickOff(idx); prevDx = null; }
    if (elapsed >= p.playMs && p.endMode === "hold") { if (!doneFlag) { doneFlag = true; window.__botStats = stats; window.__botDone = true; } requestAnimationFrame(step); return; }
    if (elapsed >= p.playMs && p.endMode === "fail") { doTap(); requestAnimationFrame(step); return; }   // tap right at the edge: the floor misses and the tower falls
    const dx = cur.x - top.x - off;
    let go = false;
    if (prevDx !== null) {
      const next = dx + (dx - prevDx);                                    // where the floor will be on the next frame
      if (dx * prevDx <= 0) go = true;                                    // already crossed the target
      else if (dx * next <= 0 && Math.abs(dx) <= Math.abs(next)) go = true; // will cross next frame, and now is closer
    }
    prevDx = dx;
    if (go) { doTap(); prevDx = null; }
    requestAnimationFrame(step);
  }
  window.__botStats = stats;
  requestAnimationFrame(step);
}

async function playAndRecord(plan, cfg, framesDir) {
  const gcfg = cfg.games.neontower;
  const gameUrl = "file://" + path.resolve(gcfg.path);
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
  const dsf = cfg.outputSize.width / cfg.viewport.width;
  const ctx = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: dsf, locale: "en-US", hasTouch: true });
  await ctx.route(/bauval\.org|abscloud\.org/, (r) => r.abort());    // the game's own ads must never appear in the video
  await ctx.addInitScript(({ seed, best, scale }) => {
    let a = seed >>> 0;
    Math.random = function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    try { localStorage.setItem("nt_best", String(best)); } catch (e) {}
    window.__LOG = [];
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf((ts) => cb(ts * scale));   // slightly faster game clock = a livelier video
  }, { seed: plan.seed, best: plan.bestSeed, scale: plan.timeScale || 1.4 });

  const page = await ctx.newPage();
  await page.goto(gameUrl);
  await page.addStyleTag({ content: FX_CSS + NT_CSS });
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await page.waitForTimeout(500);
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);

  const client = await ctx.newCDPSession(page);
  const frames = []; let n = 0; const writes = [];
  client.on("Page.screencastFrame", (f) => {
    client.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
    const i = ++n; const file = path.join(framesDir, String(i).padStart(6, "0") + ".jpg");
    frames.push({ file, ts: f.metadata.timestamp * 1000 });
    writes.push(fs.promises.writeFile(file, Buffer.from(f.data, "base64")));
  });
  await client.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: cfg.outputSize.width, maxHeight: cfg.outputSize.height, everyNthFrame: 1 });

  // the video starts here: a "count" event is what the shared video builder uses as time zero
  await page.evaluate(() => { mute = true; window.__LOG.push({ k: "count", t: performance.now(), a: [] }); start(); });
  await showText(page, "fxBio", plan.bioTpl || cfg.bioText, "bio", 0);
  await showText(page, "fxHook", fill(plan.hookTpl, {}), plan.hookStyle, 3900);
  await page.evaluate(ntBot, plan.bot);

  if (plan.bot.endMode === "fail") await page.waitForSelector("#over:not(.hide)", { timeout: plan.bot.playMs + 40000 });
  else await page.waitForFunction(() => window.__botDone === true, null, { timeout: plan.bot.playMs + 20000 });
  await page.waitForTimeout(400);
  const mid = await page.evaluate(() => ({ score }));
  const target = Math.max(10, Math.round((mid.score + 5) / 5) * 5);
  await showText(page, "fxCta", fill(plan.ctaTpl, { score: mid.score, target }), plan.ctaStyle, 0);
  await showText(page, "fxBio", plan.bioEndTpl || plan.bioTpl || cfg.bioText, "bio big", 0);
  const usedMs = await page.evaluate(() => { const c = window.__LOG.find((e) => e.k === "count"); return c ? performance.now() - c.t + 60 : 0; });
  const tailMs = Math.max((cfg.tailSeconds || 2.5) * 1000, (cfg.videoSeconds || 20) * 1000 - usedMs);
  await page.waitForTimeout(tailMs);
  const endWall = Date.now();

  const result = await page.evaluate(() => {
    const zn = ZONES.filter((z) => score >= z[0]).pop();
    const bs = window.__botStats || {};
    return { score, bestCombo: bs.bestCombo || 0, perfects: bs.perfects || 0, minW: bs.minW || 999, zone: zn ? zn[1] : "the city", over: st === "over", log: window.__LOG };
  });
  await client.send("Page.stopScreencast").catch(() => {});
  await Promise.all(writes);
  await browser.close();

  result.counts = {};
  for (const e of result.log) result.counts[e.k] = (result.counts[e.k] || 0) + 1;
  result.log = result.log.map((e) => ({ ...e, wall: timeOrigin + e.t }));
  result.thumbText = `FLOOR ${result.score}?`;
  return { result, frames, endWall };
}

function buildMeta(plan, result, history) {
  const vars = { score: result.score, combo: result.bestCombo, zone: result.zone, time: plan.time, target: Math.max(10, Math.round((result.score + 5) / 5) * 5) };
  const meta = buildMetaGeneric(X, X.CONCEPTS[plan.concept], vars, history);
  meta.gameName = X.NAME;
  return meta;
}

module.exports = {
  id: "neontower", name: X.NAME, concepts: Object.keys(X.CONCEPTS), CONTENT: X, ntBot, planOne, playAndRecord, buildMeta,
  gate: (plan, result) => X.CONCEPTS[plan.concept].gate(result),
  summary: (r) => `floors=${r.score} bestCombo=${r.bestCombo} perfects=${r.perfects} minWidth=${r.minW} zone=${r.zone}`,
  describe: (p) => `${p.concept.padEnd(14)} music=${p.music.style}@${p.music.tempo}bpm hook="${p.hookTpl}" [${p.hookStyle}] play=${p.bot.playMs}ms end=${p.bot.endMode} seed=${p.seed}`,
  reseed: (plan, history) => { const again = planOne(history, { concept: plan.concept }); return { ...plan, seed: again.seed, bot: again.bot, bestSeed: again.bestSeed, bestMode: again.bestMode }; }
};
