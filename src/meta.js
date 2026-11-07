"use strict";
// Builds title / description / tags for one video. Wording rotates and is checked against recent titles.
const D = require("./data");
const { lruPick, similarity, shuffle, pickRandom } = require("./planner");

const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (v[k] !== undefined ? v[k] : "{" + k + "}"));

// lib = the game's text library (DESC_INTROS, DESC_TIPS, DESC_QUESTIONS, HASHTAGS, BIO_LINES, TAG_POOL); C = the concept (titles, desc, tags)
function buildMetaGeneric(lib, C, vars, history) {
  const used = (f) => history.map(f);

  // ----- title: avoid exact repeats and anything too similar to the last 40 titles -----
  const recentTitles = history.slice(-40).map((e) => e.title).filter(Boolean);
  const usedTpl = used((e) => e.titleTpl);
  const candidates = C.titles.map((t) => ({ tpl: t, text: fill(t, vars) })).filter((c) => c.text.length <= 100);
  const score = (c) => Math.max(0, ...recentTitles.map((t) => similarity(t, c.text)));
  let pool = candidates.filter((c) => score(c) < 0.55 && !recentTitles.includes(c.text));
  if (!pool.length) pool = [candidates.slice().sort((a, b) => score(a) - score(b))[0]];
  const tpl = lruPick(pool.map((c) => c.tpl), usedTpl);
  const title = pool.find((c) => c.tpl === tpl).text;

  // ----- description -----
  const intro = lruPick(lib.DESC_INTROS, used((e) => e.descIntro));
  const conceptLine = fill(pickRandom(C.desc), vars);
  const tipsUsed = used((e) => e.descTips || []).flat();
  const tips = lib.DESC_TIPS.slice().sort((a, b) => tipsUsed.lastIndexOf(a) - tipsUsed.lastIndexOf(b)).slice(0, 3);
  const question = fill(lruPick(lib.DESC_QUESTIONS, used((e) => e.descQuestion)), vars);
  const hashUsed = used((e) => e.hashtags || []).flat();
  const hashtags = ["#Shorts"].concat(lib.HASHTAGS.slice().sort((a, b) => hashUsed.lastIndexOf(a) - hashUsed.lastIndexOf(b)).slice(0, 4));
  const bioLine = lruPick(lib.BIO_LINES, used((e) => e.bioLine));
  const description = [bioLine, "", intro, "", conceptLine, "", shuffle(tips).join("\n"), "", question, "", hashtags.join(" ")].join("\n");

  // ----- tags (YouTube allows ~500 characters) -----
  const tagUsed = used((e) => e.tags || []).flat();
  const extra = lib.TAG_POOL.slice().sort((a, b) => tagUsed.lastIndexOf(a) - tagUsed.lastIndexOf(b)).slice(0, 16);
  let tags = [];
  for (const t of [...C.tags, ...extra]) { if (tags.join(",").length + t.length + 1 < 480 && !tags.includes(t)) tags.push(t); }

  return { title, titleTpl: tpl, bioLine, description, tags, descIntro: intro, descTips: tips, descQuestion: lib.DESC_QUESTIONS.find((q) => fill(q, vars) === question) || question, hashtags: hashtags.slice(1) };
}

function buildMeta(plan, result, history) {
  const vars = {
    score: result.score, combo: result.bestMult, time: plan.time,
    rush: plan.bot.rush ? plan.bot.rush.sec : 8,
    target: Math.max(10, Math.round((result.score + 8) / 5) * 5)
  };
  return buildMetaGeneric(D, D.CONCEPTS[plan.concept], vars, history);
}

module.exports = { buildMeta, buildMetaGeneric, fill };
