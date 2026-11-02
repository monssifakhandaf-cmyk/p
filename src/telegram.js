"use strict";
// Sends the finished video (plus title/description/tags for copy-paste) to Telegram.
// Needs two environment variables (GitHub Secrets): TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.
const fs = require("fs");
const path = require("path");

const API = (token, method) => `https://api.telegram.org/bot${token}/${method}`;

async function call(token, method, body) {
  const res = await fetch(API(token, method), { method: "POST", body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(`Telegram ${method} failed: ${res.status} ${json.description || ""}`);
  return json;
}

async function sendVideo(file, meta, dims = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID (add them as GitHub Secrets).");

  const size = fs.statSync(file).size;
  if (size > 49 * 1024 * 1024) throw new Error(`Video is ${(size / 1048576).toFixed(1)} MB; Telegram bots accept up to 50 MB.`);

  const form = new FormData();
  form.append("chat_id", chat);
  form.append("caption", String(meta.title).slice(0, 1000));
  form.append("supports_streaming", "true");
  if (dims.width) form.append("width", String(dims.width));
  if (dims.height) form.append("height", String(dims.height));
  if (dims.duration) form.append("duration", String(dims.duration));
  form.append("video", new Blob([fs.readFileSync(file)], { type: "video/mp4" }), path.basename(file));
  await call(token, "sendVideo", form);

  // second message: everything needed to paste into YouTube
  const text = `TITLE:\n${meta.title}\n\nDESCRIPTION:\n${meta.description}\n\nTAGS:\n${meta.tags.join(", ")}`.slice(0, 4000);
  const msg = new FormData();
  msg.append("chat_id", chat);
  msg.append("text", text);
  await call(token, "sendMessage", msg);
}

async function sendText(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID.");
  const msg = new FormData();
  msg.append("chat_id", chat);
  msg.append("text", String(text).slice(0, 4000));
  msg.append("disable_web_page_preview", "true");
  await call(token, "sendMessage", msg);
}

async function sendPhoto(file, caption) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID.");
  const form = new FormData();
  form.append("chat_id", chat);
  if (caption) form.append("caption", String(caption).slice(0, 1000));
  form.append("photo", new Blob([fs.readFileSync(file)], { type: "image/jpeg" }), path.basename(file));
  await call(token, "sendPhoto", form);
}

module.exports = { sendVideo, sendText, sendPhoto };
