"use strict";
// Ant Smash adapter: thin wrapper around the original planner / recorder / text builder.
const planner = require("../planner");
const D = require("../data");
const { buildMeta } = require("../meta");
const { playAndRecord } = require("../record");

module.exports = {
  id: "antsmash", name: "Ant Smash", concepts: Object.keys(D.CONCEPTS),
  planOne: (history, opts = {}) => ({ ...planner.planOne(history, [], opts), game: "antsmash" }),
  playAndRecord,
  buildMeta: (plan, result, history) => { const m = buildMeta(plan, result, history); m.gameName = "Ant Smash"; return m; },
  gate: (plan, result) => D.CONCEPTS[plan.concept].gate(result),
  summary: (r) => `score=${r.score} bestMult=×${r.bestMult} bee=${r.counts.smashBee || 0} gold=${r.counts.smashGold || 0} bolt=${r.counts.frenzy || 0}`,
  describe: (p) => `${p.concept.padEnd(12)} theme=${p.theme.padEnd(6)} music=${p.music.style}@${p.music.tempo}bpm hook="${p.hookTpl}" [${p.hookStyle}] time=${p.time}s seed=${p.seed}`,
  reseed(plan, history) { const again = planner.planOne(history, [], { concept: plan.concept }); return { ...plan, seed: again.seed, bot: again.bot, bestSeed: again.bestSeed, bestMode: again.bestMode }; }
};
