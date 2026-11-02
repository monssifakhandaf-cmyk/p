"use strict";
// Layout preview: plays a short round and sends 3 screenshots to Telegram with the "danger zones" painted in red
// (where the Shorts interface or the phone's screen crop can hide things). Nothing is uploaded to YouTube.
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");
const cfg = require("../config.json");
const { botMain } = require("../src/bot");
const planner = require("../src/planner");
const { FX_CSS, SAFE_CSS, showText } = require("../src/record");
const { sendPhoto, sendText } = require("../src/telegram");

const ZONES = `
#zones{position:fixed;inset:0;z-index:99999;pointer-events:none}
#zones div{position:absolute;background:rgba(255,0,0,.38);outline:2px dashed #fff}
#zones .t{left:0;right:0;top:0;height:100px}
#zones .b{left:0;right:0;top:675px;bottom:0}
#zones .l{left:0;top:100px;width:56px;height:575px}
#zones .r{right:0;top:100px;width:56px;height:575px}
`;

(async () => {
  const plan = planner.planOne([], [], { concept: "gold_rush" });
  const gameUrl = "file://" + path.resolve(cfg.gamePath) + `?shorts&manual&time=${plan.time}`;
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const ctx = await browser.newContext({ viewport: cfg.viewport, deviceScaleFactor: cfg.outputSize.width / cfg.viewport.width, locale: "en-US", hasTouch: true });
  await ctx.addInitScript(() => { window.__LOG = []; try { localStorage.setItem("antSmash_muted", "1"); } catch (e) {} });
  const page = await ctx.newPage();
  await page.goto(gameUrl);
  await page.addStyleTag({ content: FX_CSS + (cfg.safeZone === false ? "" : SAFE_CSS) + ZONES });
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await page.waitForTimeout(600);
  await page.evaluate(() => { const z = document.createElement("div"); z.id = "zones"; z.innerHTML = '<div class="t"></div><div class="b"></div><div class="l"></div><div class="r"></div>'; document.body.appendChild(z); });

  const shots = [];
  const snap = async (name) => { const f = path.join("out", `preview_${name}.jpg`); fs.mkdirSync("out", { recursive: true }); await page.screenshot({ path: f, type: "jpeg", quality: 85 }); shots.push(f); };

  await page.click("#startBtn");
  await showText(page, "fxBio", plan.bioTpl || cfg.bioText, "bio", 0);
  await showText(page, "fxHook", "Hunt the golden ants ✨", "ribbon", 0);
  await page.waitForTimeout(900);
  await snap("1_start");
  await page.evaluate(botMain, plan.bot);
  await page.waitForTimeout(8000);
  await snap("2_playing");
  await page.waitForSelector("#endScreen:not(.hidden)", { timeout: (plan.time + 60) * 1000 });
  await showText(page, "fxCta", "Beat 30? Play free — link in bio 👆", "pill", 0);
  await showText(page, "fxBio", plan.bioEndTpl || cfg.bioText, "bio big", 0);
  await page.waitForTimeout(900);
  await snap("3_end");
  await browser.close();

  await sendText("🧪 Layout preview: the red areas are where YouTube Shorts (top/bottom bars, buttons) or the phone's screen crop can hide things. Important content must stay out of the red.");
  for (const f of shots) await sendPhoto(f, path.basename(f));
  console.log("Preview sent to Telegram.");
})().catch((e) => { console.error(e); process.exit(1); });
