#!/usr/bin/env node
"use strict";
/*
  Shorts Factory (Ant Smash + Neon Tower)
    node factory.js make --send --upload                make 1 Short (the two games alternate), send it to Telegram and upload it to YouTube
    node factory.js make --game neontower --count 3     make 3 Shorts of one game
    node factory.js plan --count 5                      show what would be made (no recording)
    node factory.js report                              variety report of everything made so far
*/
const fs = require("fs");
const path = require("path");
const cfg = require("./config.json");
const planner = require("./src/planner");
const { finalize } = require("./src/record");
const games = require("./src/games");
const { sendVideo, sendText } = require("./src/telegram");
const yt = require("./src/youtube");

const args = process.argv.slice(2);
const cmd = args[0] || "help";
const opt = (name, def) => { const i = args.indexOf("--" + name); return i >= 0 ? args[i + 1] : def; };
const has = (name) => args.includes("--" + name);

const historyFile = path.resolve(cfg.historyFile);
const outDir = path.resolve(cfg.outDir);
const pad = (n) => String(n).padStart(3, "0");
const gameOf = (e) => e.game || "antsmash";
const kindOf = (e) => e.kind || "short";
const enabled = () => Object.keys(cfg.games || { antsmash: {} }).filter((id) => games[id] && (cfg.games[id] || {}).enabled !== false);

// Alternates the games: the one used longest ago goes next (ties are random).
function pickGame(history, forced) {
  if (forced && forced !== "auto" && forced !== "both") { if (!games[forced]) throw new Error("Unknown game: " + forced + " (available: " + Object.keys(games).join(", ") + ")"); return forced; }
  const ids = enabled();
  const shorts = history.filter((e) => kindOf(e) === "short");
  const last = (id) => { for (let i = shorts.length - 1; i >= 0; i--) if (gameOf(shorts[i]) === id) return i; return -1; };
  const min = Math.min(...ids.map(last));
  const pool = ids.filter((id) => last(id) === min);
  return pool[Math.floor(Math.random() * pool.length)];
}

// Telegram first (always keeps a copy), then YouTube. Each one is independent; returns { delivered, errors }.
async function deliver(file, meta, info, entry, dims) {
  const errors = []; let delivered = false;
  if (has("send")) {
    try { console.log("   📨 sending to Telegram..."); await sendVideo(file, meta, { ...dims, duration: Math.round(info.duration) }); console.log("   ✓ sent to Telegram"); delivered = true; }
    catch (e) { console.log("   ✗ Telegram: " + e.message); errors.push("Telegram: " + e.message); }
  }
  if (has("upload")) {
    if (!yt.configured()) console.log("   ⏭️  YouTube not configured yet (missing YT_* secrets): skipping upload.");
    else {
      try {
        console.log("   ▶️  uploading to YouTube...");
        const up = await yt.uploadVideo(file, meta, cfg.youtube || {});
        entry.youtube = { id: up.id, privacy: up.privacy };
        let thumbNote = "";
        if (info.thumb) {
          try { await yt.setThumbnail(up.id, info.thumb); console.log("   ✓ cover image set"); thumbNote = "\n🖼️ Cover image set"; }
          catch (e) { console.log("   (cover not set: " + e.message + ")"); thumbNote = "\n🖼️ Cover not set: " + e.message.slice(0, 160); }
        }
        console.log(`   ✓ YouTube: ${up.url} (${up.privacy})`); delivered = true;
        const locked = up.requestedPrivacy !== up.privacy;
        const link = up.url;
        const note = `▶️ Uploaded to YouTube\n${link}\nStatus: ${up.privacy}` + thumbNote + (locked ? "\n⚠️ YouTube kept it " + up.privacy + " (the API project probably has not passed the audit yet). Publish it from YouTube Studio." : "");
        if (has("send")) await sendText(note).catch(() => {});
      } catch (e) {
        console.log("   ✗ YouTube: " + e.message); errors.push("YouTube: " + e.message);
        if (has("send")) await sendText("⚠️ YouTube upload failed for " + path.basename(file) + ":\n" + e.message).catch(() => {});
      }
    }
  }
  if (errors.length) process.exitCode = 1;   // the run is marked failed, but the history is still saved
  if ((has("send") || has("upload")) && !delivered) throw new Error("Nothing was delivered: " + errors.join(" | "));
  return { delivered, errors };
}

function baseEntry(id, plan, meta, result) {
  return {
    id, createdAt: new Date().toISOString(), game: plan.game, kind: plan.kind || "short", concept: plan.concept, theme: plan.theme, seed: plan.seed, time: plan.time,
    hookTpl: plan.hookTpl, hookStyle: plan.hookStyle, bioTpl: plan.bioTpl, bioEndTpl: plan.bioEndTpl, ctaTpl: plan.ctaTpl, ctaStyle: plan.ctaStyle, music: plan.music, bestMode: plan.bestMode,
    title: meta.title, titleTpl: meta.titleTpl, descIntro: meta.descIntro, descTips: meta.descTips, descQuestion: meta.descQuestion, bioLine: meta.bioLine, hashtags: meta.hashtags, tags: meta.tags,
    result: { score: result.score, bestMult: result.bestMult, bestCombo: result.bestCombo, perfects: result.perfects, smashed: result.smashed, taps: result.taps, counts: result.counts }
  };
}

async function make() {
  const count = parseInt(opt("count", "1"), 10);
  let history = planner.loadHistory(historyFile);
  fs.mkdirSync(outDir, { recursive: true });
  const sheet = path.join(outDir, "upload_sheet.csv");
  if (!fs.existsSync(sheet)) fs.writeFileSync(sheet, "id,file,title,description,tags,game,concept,score\n");
  const csv = (s) => '"' + String(s).replace(/"/g, '""').replace(/\n/g, "\\n") + '"';

  for (let n = 0; n < count; n++) {
    const gid = pickGame(history, opt("game"));
    const A = games[gid];
    const gameHist = history.filter((e) => gameOf(e) === gid && kindOf(e) === "short");
    const id = `${gid}_short_${pad(gameHist.length + 1)}`;
    let plan = A.planOne(gameHist, { concept: opt("concept") });
    let done = false;
    for (let attempt = 1; attempt <= cfg.maxAttemptsPerVideo && !done; attempt++) {
      console.log(`\n🎬 ${id} [${A.name}] (attempt ${attempt})\n   ${A.describe(plan)}`);
      const rawDir = path.join(outDir, ".raw", id);
      let rec;
      try { rec = await A.playAndRecord(plan, cfg, rawDir); }
      catch (e) { console.log("   ✗ recording failed: " + e.message.split("\n")[0]); plan = A.planOne(gameHist, { concept: plan.concept }); continue; }
      const { result, frames, endWall } = rec;
      const ok = A.gate(plan, result);
      console.log(`   result: ${A.summary(result)} ${ok ? "✓ passes concept check" : "✗ did not match the concept, retrying with a new seed"}`);
      if (!ok) { fs.rmSync(rawDir, { recursive: true, force: true }); plan = A.reseed(plan, gameHist); continue; }

      const file = `${id}_${plan.concept}.mp4`;
      const info = finalize(plan, result, frames, endWall, path.join(outDir, file), cfg, rawDir);
      const meta = A.buildMeta(plan, result, gameHist);
      const entry = { ...baseEntry(id, plan, meta, result), file };
      await deliver(path.join(outDir, file), meta, info, entry, { width: cfg.outputSize.width, height: cfg.outputSize.height });
      history.push(entry);
      planner.saveHistory(historyFile, history);
      fs.writeFileSync(path.join(outDir, `${id}_${plan.concept}.txt`), `GAME: ${A.name}\nTITLE:\n${meta.title}\n\nDESCRIPTION:\n${meta.description}\n\nTAGS (comma separated):\n${meta.tags.join(", ")}\n`);
      fs.appendFileSync(sheet, [id, file, meta.title, meta.description, meta.tags.join(", "), A.name, plan.concept, result.score].map(csv).join(",") + "\n");
      fs.rmSync(path.join(outDir, ".raw"), { recursive: true, force: true });
      console.log(`   ✅ ${file}  (${info.duration.toFixed(1)}s, captured ${info.capturedFps.toFixed(0)} fps)\n   📝 ${meta.title}`);
      done = true;
    }
    if (!done) console.log(`   ⛔ could not make a valid ${id}; skipping.`);
  }
  console.log("\n" + planner.report(planner.loadHistory(historyFile).filter((e) => kindOf(e) === "short"), cfg));
}

(async () => {
  if (cmd === "make") return make();
  if (cmd === "plan") {
    const count = parseInt(opt("count", "6"), 10);
    let history = planner.loadHistory(historyFile).slice();
    for (let i = 0; i < count; i++) {
      const gid = pickGame(history, opt("game")); const A = games[gid];
      const gh = history.filter((e) => gameOf(e) === gid && kindOf(e) === "short");
      const p = A.planOne(gh, { concept: opt("concept") });
      console.log(`#${i + 1} [${A.name}] ${A.describe(p)}`);
      history.push({ game: gid, kind: "short", concept: p.concept, theme: p.theme, seed: p.seed, hookTpl: p.hookTpl, hookStyle: p.hookStyle, ctaTpl: p.ctaTpl, ctaStyle: p.ctaStyle, bioTpl: p.bioTpl, bioEndTpl: p.bioEndTpl, music: p.music });
    }
    return;
  }
  if (cmd === "report") return console.log(planner.report(planner.loadHistory(historyFile).filter((e) => kindOf(e) === "short"), cfg));
  console.log("Usage:\n  node factory.js make [--count N] [--game antsmash|neontower] [--concept id] [--send] [--upload]\n  node factory.js plan [--count N]\n  node factory.js report\n\nGames: " + Object.keys(games).join(", "));
})().catch((e) => { console.error(e); process.exit(1); });
