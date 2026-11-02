"use strict";
// Uploads the finished video to YouTube (resumable upload, YouTube Data API v3).
// Secrets (GitHub Actions): YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN. Optional: YT_PRIVACY (public|unlisted|private).
const fs = require("fs");
const creds = require("./creds");

function configured() {
  const c = creds.get();
  return !!(c.clientId && c.clientSecret && process.env.YT_REFRESH_TOKEN);
}

async function accessToken() {
  const c = creds.get();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      refresh_token: process.env.YT_REFRESH_TOKEN,
      grant_type: "refresh_token"
    })
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw new Error(`YouTube token refresh failed: ${j.error || res.status} ${j.error_description || ""}`.trim());
  return j.access_token;
}

// Keeps title/description/tags inside YouTube's limits.
function clean(meta, yt = {}) {
  let title = String(meta.title).replace(/[<>]/g, "").trim();
  if (title.length > 100) title = title.slice(0, 97).trimEnd() + "...";
  let description = String(meta.description).replace(/[<>]/g, "");
  if (description.length > 4900) description = description.slice(0, 4900);
  const tags = [];
  let total = 0;
  for (const t of meta.tags || []) {
    const tag = String(t).replace(/[<>,]/g, "").trim();
    if (!tag || tag.length > 60) continue;
    if (total + tag.length + 3 > 480) break;
    tags.push(tag); total += tag.length + 3;
  }
  return {
    snippet: { title, description, tags, categoryId: String(yt.categoryId || "20"), defaultLanguage: yt.language || "en", defaultAudioLanguage: yt.language || "en" },
    status: {
      privacyStatus: process.env.YT_PRIVACY || yt.privacy || "public",
      selfDeclaredMadeForKids: false,
      embeddable: true,
      publicStatsViewable: true
    }
  };
}

async function uploadVideo(file, meta, yt = {}) {
  if (!configured()) throw new Error("YouTube is not configured (missing GitHub secrets: YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN).");
  const token = await accessToken();
  const body = clean(meta, yt);
  const data = fs.readFileSync(file);

  // 1) start a resumable session
  const start = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=true", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(data.length),
      "X-Upload-Content-Type": "video/mp4"
    },
    body: JSON.stringify(body)
  });
  if (!start.ok) {
    const t = await start.text();
    throw new Error(`YouTube upload start failed (${start.status}): ${t.slice(0, 400)}`);
  }
  const location = start.headers.get("location");
  if (!location) throw new Error("YouTube did not return an upload URL.");

  // 2) send the file (about 15-20 MB, a single request is fine)
  const put = await fetch(location, { method: "PUT", headers: { "Content-Type": "video/mp4", "Content-Length": String(data.length) }, body: data });
  const j = await put.json().catch(() => ({}));
  if (!put.ok || !j.id) throw new Error(`YouTube upload failed (${put.status}): ${JSON.stringify(j).slice(0, 400)}`);
  return { id: j.id, url: `https://youtube.com/shorts/${j.id}`, privacy: (j.status && j.status.privacyStatus) || body.status.privacyStatus, requestedPrivacy: body.status.privacyStatus };
}

// Sets the custom cover image. YouTube only allows this on channels with "advanced features" (phone verification), so callers treat errors as non-fatal.
async function setThumbnail(videoId, file) {
  const token = await accessToken();
  const data = fs.readFileSync(file);
  if (data.length > 2 * 1024 * 1024) throw new Error("thumbnail is bigger than 2 MB");
  const res = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}&uploadType=media`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/jpeg", "Content-Length": String(data.length) }, body: data
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`thumbnail failed (${res.status}): ${t.slice(0, 300)}`); }
}

module.exports = { uploadVideo, setThumbnail, configured, clean };
