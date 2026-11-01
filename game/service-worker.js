// Ant Smash requires an active internet connection to play.
// This service worker intentionally does NOT cache anything for offline use —
// it only exists to satisfy PWA installability requirements in some browsers.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Always go to the network. No cache fallback — the game is online-only.
  event.respondWith(fetch(event.request));
});
