"use strict";
// "Main video" per game: a longer, landscape (16:9) gameplay video that is NOT a Short, so its description can hold the clickable game link.
// Shorts can then point to it (Related video, set by hand in YouTube Studio) and the channel can feature/pin it.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const planner = require("./planner");
const { fill } = require("./meta");

const MAIN = {
  antsmash: {
    minScore: 20, concepts: ["pro_run", "gold_rush"],
    pitch: ["Whack the ants as they pop out of their holes, grab golden ants for 5 points and avoid the bees!", "A fast reflex game: tap ants, chain combos up to ×8, dodge bees and catch power-ups."],
    how: ["🐜 Normal ants = 1 point, red ants = 2 points", "✨ Golden ants = 5 points", "🐝 Bees cost you 3 points", "⚡ Lightning = double points for 6 seconds, ⏱️ clocks add 5 seconds", "🔥 Every 4 hits in a row raises your combo multiplier"],
    titles: ["Ant Smash — Free Reflex Game | Can You Beat {score} Points?", "Whack the Ants, Dodge the Bees! Ant Smash Gameplay ({score} Points)", "Ant Smash Full Gameplay: {score} Points and a Huge Combo 🔥", "Free Browser Game: Ant Smash — Play It Now, Beat {score}!", "How to Play Ant Smash (and Get {score} Points) 🐜🔨", "Ant Smash: The Reflex Game You Can Play Anywhere 🐜"],
    tags: ["ant smash", "ant smash game", "whack a mole", "reflex game", "free browser game", "mini game", "casual game", "gameplay", "no download game", "high score challenge"],
    thumbText: (r) => `${r.score} POINTS?`
  },
  neontower: {
    minScore: 25, concepts: ["perfect_streak", "fast_climb"],
    pitch: ["Tap at the right moment, stack the floors and build a skyscraper that climbs past the clouds, birds and satellites all the way to the planets!", "A satisfying timing game: land every floor perfectly to keep your tower wide and watch the sky change from sunset to outer space."],
    how: ["🎯 Tap when the moving floor lines up with the tower for a Perfect", "🔥 Four perfects in a row make the floor wider again", "☁️ Cloud layer at 12 floors, birds at 28, satellites at 40", "🪐 Outer space at 55, then Mars, Saturn, Jupiter and the edge of the galaxy", "⚡ The higher you build, the faster the floors move"],
    titles: ["Neon Tower — Free Stacking Game | How High Can You Build? ({score} Floors)", "Build a Skyscraper to Space! Neon Tower Gameplay — {score} Floors 🏙️🚀", "Neon Tower Full Gameplay: {score} Floors, From Sunset to the Stars", "Free Browser Game: Neon Tower — Can You Beat {score} Floors?", "How to Stack a Perfect Tower: Neon Tower Gameplay ({score} Floors) 🎯", "Neon Tower: The Timing Game That Reaches the Planets 🪐"],
    tags: ["neon tower", "neon tower game", "stacking game", "tower stack", "timing game", "perfect timing", "free browser game", "mini game", "casual game", "gameplay", "no download game", "skyscraper game"],
    thumbText: (r) => `FLOOR ${r.score}?`
  }
};

// Plan for a main video: longer round, no Shorts safe-zone layout, "link in the description" texts instead of "link in bio".
function makePlan(adapter, gameId, history, cfg) {
  const M = MAIN[gameId];
  const concept = M.concepts[history.length % M.concepts.length];
  const plan = adapter.planOne(history, { concept });
  const mainBio = cfg.main || {};
  plan.bioTpl = mainBio.badge || "🎮 Play FREE — link in the description 👇";
  plan.bioEndTpl = mainBio.end || "👇 Play FREE — link in the description!";
  plan.kind = "main";
  if (gameId === "neontower") {
    plan.bot = { ...plan.bot, playMs: 38000, endMode: concept === "fast_climb" ? "hold" : "fail", jitter: 3 };
    plan.time = 38; plan.videoSeconds = 38 + 5.5;
  } else {
    plan.time = 45; plan.videoSeconds = 45 + 2.9 + 3.6;
  }
  const cfg2 = { ...cfg, videoSeconds: plan.videoSeconds, tailSeconds: 3, safeZone: false };
  return { plan, cfg2 };
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`${cmd} failed:\n${(r.stderr || "").slice(-1200)}`);
}

// 9:16 gameplay in the middle of a 1920x1080 frame, with a blurred, zoomed copy of the same footage behind it.
function toLandscape(inFile, outFile) {
  run("ffmpeg", ["-y", "-v", "error", "-i", inFile, "-filter_complex",
    "[0:v]split[a][b];[a]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=28:6,eq=brightness=-0.08[bg];[b]scale=-2:1080[fg];[bg][fg]overlay=(W-w)/2:0,format=yuv420p[v]",
    "-map", "[v]", "-map", "0:a", "-c:v", "libx264", "-preset", "medium", "-profile:v", "high", "-crf", "20", "-maxrate", "10M", "-bufsize", "20M", "-c:a", "copy", "-movflags", "+faststart", outFile]);
}

function makeThumb(videoFile, outJpg, text, seconds) {
  try {
    const fonts = ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"];
    const font = fonts.find((f) => fs.existsSync(f));
    let vf = "scale=1280:720";
    if (font) {
      const txt = outJpg.replace(/\.jpg$/, ".txt"); fs.writeFileSync(txt, text);
      vf += `,drawtext=fontfile=${font}:textfile=${txt}:fontsize=110:fontcolor=#ffe14a:borderw=10:bordercolor=black:x=(w-text_w)/2:y=h*0.1`;
    }
    run("ffmpeg", ["-y", "-v", "error", "-ss", String(Math.max(1, seconds * 0.5)), "-i", videoFile, "-vf", vf, "-frames:v", "1", "-q:v", "3", outJpg]);
    return fs.existsSync(outJpg) ? outJpg : null;
  } catch (e) { console.log("   (thumbnail skipped: " + e.message.split("\n")[0] + ")"); return null; }
}

function buildMainMeta(gameId, name, url, plan, result, history) {
  const M = MAIN[gameId];
  const vars = { score: result.score, name };
  const used = history.map((e) => e.titleTpl);
  const tpl = planner.lruPick(M.titles, used);
  const title = fill(tpl, vars).slice(0, 100);
  const pitch = planner.pickRandom(M.pitch);
  const tag = name.replace(/\s+/g, "");
  const description = [
    `▶️ PLAY ${name.toUpperCase()} FREE (no download, no sign-up): ${url}`,
    "",
    pitch,
    "",
    "How it works:",
    ...M.how,
    "",
    `In this video: a full round that reached ${result.score} ${gameId === "neontower" ? "floors" : "points"}. Can you beat it? Tell me your score in the comments 👇`,
    "",
    `🔗 Play here: ${url}`,
    "🔔 New Shorts every few days — subscribe so you don't miss them!",
    "",
    `#${tag} #FreeGames #MobileGame #CasualGames #GamePlay`
  ].join("\n");
  const tags = M.tags.slice();
  return { title, titleTpl: tpl, description, tags, gameName: name, kind: "main", note: "📌 Main video. To do by hand in YouTube Studio: pin a comment with the game link, and set this video as the Related video on your Shorts (desktop only)." };
}

module.exports = { MAIN, makePlan, toLandscape, makeThumb, buildMainMeta };
