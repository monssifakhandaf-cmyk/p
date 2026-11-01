#!/usr/bin/env node
"use strict";
/*
  Ant Smash Shorts Factory
    node factory.js make --count 5          make 5 varied, ready-to-upload videos
    node factory.js make --send             make 1 video and send it to Telegram (needs TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)
    node factory.js make --concept bee_fail make one video of a specific concept
    node factory.js plan --count 5          show what would be made (no recording)
    node factory.js report                  variety report of everything made so far
*/
const fs = require("fs");
const path = require("path");
const cfg = require("./config.json");
const planner = require("./src/planner");
const { buildMeta } = require("./src/meta");
const { playAndRecord, finalize } = require("./src/record");
const D = require("./src/data");
const { sendVideo } = require("./src/telegram");

const args = process.argv.slice(2);
const cmd = args[0] || "help";
const opt = (name, def) => { const i = args.indexOf("--" + name); return i >= 0 ? args[i + 1] : def; };
const has = (name) => args.includes("--" + name);

const historyFile = path.resolve(cfg.historyFile);
const outDir = path.resolve(cfg.outDir);
const pad = (n) => String(n).padStart(3, "0");

function describe(p) {
  return `${p.concept.padEnd(12)} theme=${p.theme.padEnd(6)} music=${p.music.style}@${p.music.tempo}bpm hook="${p.hookTpl}" [${p.hookStyle}] time=${p.time}s seed=${p.seed}`;
}

async function make() {
  const count = parseInt(opt("count", "1"), 10);
  let history = planner.loadHistory(historyFile);
  fs.mkdirSync(outDir, { recursive: true });

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = history.filter((e) => String(e.createdAt).slice(0, 10) === today).length;
  if (!has("send") && todayCount + count > cfg.maxPerDay) console.log(`⚠️  Heads-up: that would be ${todayCount + count} videos today. Upload them spread over several days (see README).`);

  const sheet = path.join(outDir, "upload_sheet.csv");
  if (!fs.existsSync(sheet)) fs.writeFileSync(sheet, "id,file,title,description,tags,concept,score\n");
  const csv = (s) => '"' + String(s).replace(/"/g, '""').replace(/\n/g, "\\n") + '"';

  for (let n = 0; n < count; n++) {
    const id = "short_" + pad(history.length + 1);
    let plan = planner.planOne(history, [], { concept: opt("concept") });
    let done = false;
    for (let attempt = 1; attempt <= cfg.maxAttemptsPerVideo && !done; attempt++) {
      console.log(`\n🎬 ${id} (attempt ${attempt})\n   ${describe(plan)}`);
      const rawDir = path.join(outDir, ".raw", id);
      let rec;
      try { rec = await playAndRecord(plan, cfg, rawDir); }
      catch (e) { console.log("   ✗ recording failed: " + e.message.split("\n")[0]); plan = planner.planOne(history, [], { concept: plan.concept }); continue; }

      const { result, frames, endWall } = rec;
      const ok = D.CONCEPTS[plan.concept].gate(result);
      console.log(`   result: score=${result.score} bestMult=×${result.bestMult} counts=${JSON.stringify({ bee: result.counts.smashBee || 0, gold: result.counts.smashGold || 0, bolt: result.counts.frenzy || 0, clock: result.counts.clock || 0 })} ${ok ? "✓ passes concept check" : "✗ did not match the concept, retrying with a new seed"}`);
      if (!ok) {
        fs.rmSync(rawDir, { recursive: true, force: true });
        const again = planner.planOne(history, [], { concept: plan.concept });
        plan = { ...plan, seed: again.seed, bot: again.bot, bestSeed: again.bestSeed, bestMode: again.bestMode };
        continue;
      }
      const file = `${id}_${plan.concept}.mp4`;
      const info = finalize(plan, result, frames, endWall, path.join(outDir, file), cfg, rawDir);
      const meta = buildMeta(plan, result, history);

      const entry = {
        id, createdAt: new Date().toISOString(), file, concept: plan.concept, theme: plan.theme, seed: plan.seed, time: plan.time,
        hookTpl: plan.hookTpl, hookStyle: plan.hookStyle, ctaTpl: plan.ctaTpl, ctaStyle: plan.ctaStyle, music: plan.music,
        bestMode: plan.bestMode, title: meta.title, titleTpl: meta.titleTpl, descIntro: meta.descIntro, descTips: meta.descTips,
        descQuestion: meta.descQuestion, bioLine: meta.bioLine, hashtags: meta.hashtags, tags: meta.tags,
        result: { score: result.score, bestMult: result.bestMult, smashed: result.smashed, taps: result.taps, counts: result.counts }
      };
      if (has("send")) {
        console.log("   📨 sending to Telegram...");
        await sendVideo(path.join(outDir, file), meta, { width: cfg.outputSize.width, height: cfg.outputSize.height, duration: Math.round(info.duration) });
        console.log("   ✓ sent");
      }
      history.push(entry);
      planner.saveHistory(historyFile, history);
      fs.writeFileSync(path.join(outDir, `${id}_${plan.concept}.txt`),
        `TITLE:\n${meta.title}\n\nDESCRIPTION:\n${meta.description}\n\nTAGS (comma separated):\n${meta.tags.join(", ")}\n`);
      fs.appendFileSync(sheet, [id, file, meta.title, meta.description, meta.tags.join(", "), plan.concept, result.score].map(csv).join(",") + "\n");
      fs.rmSync(path.join(outDir, ".raw"), { recursive: true, force: true });
      console.log(`   ✅ ${file}  (${info.duration.toFixed(1)}s, captured ${info.capturedFps.toFixed(0)} fps)\n   📝 ${meta.title}`);
      done = true;
    }
    if (!done) console.log(`   ⛔ could not make a valid ${id}; skipping.`);
  }
  console.log("\n" + planner.report(planner.loadHistory(historyFile), cfg));
}

(async () => {
  if (cmd === "make") return make();
  if (cmd === "plan") {
    const count = parseInt(opt("count", "5"), 10);
    const plans = planner.planBatch(planner.loadHistory(historyFile), count, { concept: opt("concept") });
    plans.forEach((p, i) => console.log(`#${i + 1} ${describe(p)}`));
    return;
  }
  if (cmd === "report") return console.log(planner.report(planner.loadHistory(historyFile), cfg));
  console.log("Usage:\n  node factory.js make [--count N] [--concept id]\n  node factory.js plan [--count N]\n  node factory.js report\n\nConcepts: " + Object.keys(D.CONCEPTS).join(", "));
})().catch((e) => { console.error(e); process.exit(1); });
