"use strict";
// Plays one round with the bot, records the screen, rebuilds the sound, and produces the final MP4.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { chromium } = require("playwright");
const { botMain } = require("./bot");
const { renderWav } = require("./audio");
const { fill } = require("./meta");
const D = require("./data");

// Keeps the game inside YouTube Shorts\' safe zone so the Shorts interface (title, channel, buttons) never covers it:
// ~110px top, ~420px bottom, ~120px right on the 1080x1920 frame (this page is 540x960, so values are halved).
const SAFE_CSS = `
body.shorts #app{box-sizing:border-box;padding-top:56px !important;padding-bottom:210px !important}
body.shorts #field{width:min(440px,90vw) !important;left:-24px}
`;
const FX_CSS = `
.fx{position:fixed;left:50%;transform:translateX(-50%);width:max-content;z-index:9000;pointer-events:none;text-align:center;font-family:'Baloo 2','Nunito','Segoe UI',sans-serif;font-weight:800;line-height:1.12;max-width:500px;animation:fxPop .38s cubic-bezier(.2,.9,.3,1.4) both, fxPulse 1.1s .4s ease-in-out infinite alternate}
.fx.out{animation:fxOut .35s ease-in forwards}
#fxHook{top:112px;font-size:40px}
#fxCta{top:112px;font-size:36px}
#fxBio{bottom:215px;left:calc(50% - 24px);font-size:24px;max-width:420px;white-space:normal}
#fxBio.big{font-size:30px}
.fx.bio{background:#1f8f3a;color:#fff;border:4px solid #fff;border-radius:30px;padding:10px 18px;box-shadow:0 6px 0 #0d4a1e;text-shadow:0 2px 0 #0d4a1e}
.fx.pill{background:#3a2717;color:#f6ecd2;border:4px solid #e8b93f;border-radius:30px;padding:12px 24px;box-shadow:0 6px 0 #1c1208}
.fx.sticker{color:#fff04a;font-size:46px;transform:translateX(-50%) rotate(-3deg);text-shadow:-3px -3px 0 #1c1208,3px -3px 0 #1c1208,-3px 3px 0 #1c1208,3px 3px 0 #1c1208,0 6px 0 #1c1208}
.fx.neon{color:#fff;background:rgba(0,0,0,.5);border-radius:26px;padding:10px 22px;text-shadow:0 0 8px #00e5ff,0 0 22px #00e5ff;border:3px solid #00e5ff;box-shadow:0 0 18px #00e5ff}
.fx.ribbon{color:#fff;background:linear-gradient(#ff5a4d,#c0392b);padding:12px 40px;clip-path:polygon(0 0,100% 0,96% 50%,100% 100%,0 100%,4% 50%);text-shadow:0 3px 0 #7a1d12}
@keyframes fxPop{0%{opacity:0;margin-top:30px;scale:.5}100%{opacity:1;margin-top:0;scale:1}}
@keyframes fxPulse{from{filter:brightness(1)}to{filter:brightness(1.18)}}
@keyframes fxOut{to{opacity:0;margin-top:-20px}}
`;

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 28, ...opts });
  if (r.status !== 0 && !opts.allowFail) throw new Error(`${cmd} failed:\n${(r.stderr || "").slice(-1500)}`);
  return r;
}

async function showText(page, id, text, style, hideAfterMs) {
  await page.evaluate(({ id, text, style, hideAfterMs }) => {
    const old = document.getElementById(id); if (old) old.remove();
    const d = document.createElement("div"); d.id = id; d.className = "fx " + style; d.textContent = text; document.body.appendChild(d);
    if (hideAfterMs) setTimeout(() => { d.classList.add("out"); setTimeout(() => d.remove(), 380); }, hideAfterMs);
  }, { id, text, style, hideAfterMs });
}

// One attempt: plays the round with the bot while capturing true 1080x1920 frames (CDP screencast, device scale 2).
async function playAndRecord(plan, cfg, framesDir) {
  const gameUrl = "file://" + path.resolve(cfg.gamePath) + `?shorts&manual&time=${plan.time}` + (plan.theme !== "garden" ? `&theme=${plan.theme}` : "") + (cfg.watermark ? `&wm=${encodeURIComponent(cfg.watermark)}` : "");
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
  const dsf = cfg.outputSize.width / cfg.viewport.width;
  const ctx = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: dsf, locale: "en-US", hasTouch: true });
  await ctx.addInitScript(({ seed, best }) => {
    // deterministic game randomness for this plan's seed
    let a = seed >>> 0;
    Math.random = function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    try { localStorage.setItem("antSmash_best", String(best)); localStorage.setItem("antSmash_muted", "1"); } catch (e) {}
    window.__LOG = [];
  }, { seed: plan.seed, best: plan.bestSeed });

  const page = await ctx.newPage();
  await page.goto(gameUrl);
  await page.addStyleTag({ content: FX_CSS + (cfg.safeZone === false ? "" : SAFE_CSS) });
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await page.waitForTimeout(600);
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);

  // ---- frame capture ----
  const client = await ctx.newCDPSession(page);
  const frames = []; let n = 0; const writes = [];
  client.on("Page.screencastFrame", (f) => {
    client.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
    const i = ++n; const file = path.join(framesDir, String(i).padStart(6, "0") + ".jpg");
    frames.push({ file, ts: f.metadata.timestamp * 1000 });
    writes.push(fs.promises.writeFile(file, Buffer.from(f.data, "base64")));
  });
  await client.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: cfg.outputSize.width, maxHeight: cfg.outputSize.height, everyNthFrame: 1 });

  const vars = { time: plan.time, rush: plan.bot.rush ? plan.bot.rush.sec : 8 };
  await page.click("#startBtn");
  await showText(page, "fxBio", plan.bioTpl || cfg.bioText || "🎮 Play FREE — link in bio 🔗", "bio", 0);
  await showText(page, "fxHook", fill(plan.hookTpl, vars), plan.hookStyle, 3900);
  await page.evaluate(botMain, plan.bot);

  await page.waitForSelector("#endScreen:not(.hidden)", { timeout: (plan.time + 60) * 1000 });
  const mid = await page.evaluate(() => ({ score: window.__game.score }));
  const target = Math.max(10, Math.round((mid.score + 8) / 5) * 5);
  await showText(page, "fxCta", fill(plan.ctaTpl, { score: mid.score, target }), plan.ctaStyle, 0);
  await showText(page, "fxBio", plan.bioEndTpl || plan.bioTpl || cfg.bioText, "bio big", 0);   // bigger, re-animated link-in-bio call at the end
  const usedMs = await page.evaluate(() => { const c = window.__LOG.find((e) => e.k === "count"); return c ? performance.now() - c.t + 60 : 0; });
  const tailMs = Math.max((cfg.tailSeconds || 2.5) * 1000, (cfg.videoSeconds || 20) * 1000 - usedMs);
  await page.waitForTimeout(tailMs);
  const endWall = Date.now();

  const result = await page.evaluate(() => ({
    score: window.__game.score, bestMult: window.__game.bestMult, smashed: window.__game.smashed, taps: window.__game.taps,
    bot: window.__botStats, log: window.__LOG
  }));
  await client.send("Page.stopScreencast").catch(() => {});
  await Promise.all(writes);
  await browser.close();

  result.counts = {};
  for (const e of result.log) result.counts[e.k] = (result.counts[e.k] || 0) + 1;
  result.log = result.log.map((e) => ({ ...e, wall: timeOrigin + e.t }));   // event time on the same clock as the frames
  return { result, frames, endWall };
}

function finalize(plan, result, frames, endWall, outFile, cfg, framesDir) {
  const firstCount = result.log.find((e) => e.k === "count");
  const start = firstCount.wall - 60;                       // video starts right when the 3-2-1 begins
  const end = endWall;
  // frames active during [start,end]
  let idx = frames.findIndex((f) => f.ts > start);
  idx = Math.max(0, idx - 1);
  const used = frames.slice(idx).filter((f) => f.ts < end);
  const lines = [];
  used.forEach((f, i) => {
    const from = i === 0 ? start : f.ts;
    const to = i + 1 < used.length ? used[i + 1].ts : end;
    lines.push(`file '${f.file.replace(/'/g, "'\\''")}'`, `duration ${Math.max(0.001, (to - from) / 1000).toFixed(4)}`);
  });
  lines.push(`file '${used[used.length - 1].file.replace(/'/g, "'\\''")}'`);
  const list = path.join(framesDir, "list.txt");
  fs.writeFileSync(list, lines.join("\n"));
  const dur = (end - start) / 1000;
  const fps = used.length / dur;

  const events = result.log.map((e) => ({ k: e.k, a: e.a, at: (e.wall - start) / 1000 }));
  if (process.env.DEBUG_SYNC) fs.writeFileSync(outFile.replace(/\.mp4$/, ".events.json"), JSON.stringify(events));
  const wav = renderWav(events, dur, plan.music);
  const wavFile = outFile.replace(/\.mp4$/, ".wav");
  fs.writeFileSync(wavFile, wav);

  run("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, "-i", wavFile,
    "-vf", `scale=${cfg.outputSize.width}:${cfg.outputSize.height}:flags=lanczos,fps=${cfg.fps},format=yuv420p`,
    "-c:v", "libx264", "-preset", "medium", "-profile:v", "high", "-crf", String(cfg.crf || 20), "-maxrate", cfg.maxrate || "8M", "-bufsize", cfg.bufsize || "16M",
    "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-t", Math.min(dur, cfg.videoSeconds || 20).toFixed(3), "-movflags", "+faststart", outFile]);
  fs.unlinkSync(wavFile);
  return { duration: Math.min(dur, cfg.videoSeconds || 20), capturedFps: fps };
}

module.exports = { playAndRecord, finalize };
