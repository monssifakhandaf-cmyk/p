"use strict";
// All games the factory can make videos for. Each adapter has: planOne, playAndRecord, buildMeta, gate, summary, describe, reseed.
const games = {};
games.antsmash = require("./antsmash");
try { games.neontower = require("./neontower"); } catch (e) { console.log("(Neon Tower disabled: " + e.message.split("\n")[0] + ")"); }
module.exports = games;
