"use strict";
// Google OAuth client credentials: GitHub Secrets (YT_CLIENT_ID / YT_CLIENT_SECRET) win; otherwise client_secret.json in the repo root is used.
const fs = require("fs");
const path = require("path");

function fromFile() {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "client_secret.json"), "utf8"));
    const c = j.installed || j.web || {};
    return { clientId: c.client_id, clientSecret: c.client_secret };
  } catch (e) { return {}; }
}

function get() {
  const f = fromFile();
  return { clientId: process.env.YT_CLIENT_ID || f.clientId, clientSecret: process.env.YT_CLIENT_SECRET || f.clientSecret };
}

module.exports = { get };
