"use strict";
// Google OAuth client credentials come ONLY from GitHub Secrets (environment variables): YT_CLIENT_ID and YT_CLIENT_SECRET.
function get() {
  return { clientId: process.env.YT_CLIENT_ID, clientSecret: process.env.YT_CLIENT_SECRET };
}
module.exports = { get };
