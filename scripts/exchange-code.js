"use strict";
// One-time helper (run by the "Get YouTube token" workflow): turns the Google authorization code into a refresh token
// and sends it ONLY to your private Telegram chat (it is never printed in the logs).
const { sendText } = require("../src/telegram");
const creds = require("../src/creds");
(async () => {
  const code = (process.env.AUTH_CODE || "").trim();
  const redirect = process.env.REDIRECT_URI || "http://localhost";
  if (!code) throw new Error("AUTH_CODE is empty.");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: creds.get().clientId, client_secret: creds.get().clientSecret, redirect_uri: redirect, grant_type: "authorization_code" })
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google refused the code: ${j.error || res.status} ${j.error_description || ""}. Codes work once and expire fast: get a new one.`);
  if (!j.refresh_token) throw new Error("No refresh_token returned. Open the link again (it must include prompt=consent) and approve again.");
  console.log("::add-mask::" + j.refresh_token);
  await sendText("🔑 YT_REFRESH_TOKEN (save it as a GitHub secret, then delete this message):\n\n" + j.refresh_token);
  console.log("Done: the refresh token was sent to your Telegram chat.");
})().catch((e) => { console.error(e.message); process.exit(1); });
