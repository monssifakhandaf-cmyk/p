"use strict";
// Runs INSIDE the game page (serialized by Playwright). It "plays" like a human with a given skill profile.
function botMain(cfg) {
  const rnd = (r) => r[0] + Math.random() * (r[1] - r[0]);
  const holes = [...document.querySelectorAll("#field .hole")];
  const st = holes.map(() => ({ active: false, tok: 0 }));
  const stats = { beesSeen: 0, beesHit: 0, failDone: false, taps: 0 };
  window.__botStats = stats;
  let started = false;

  function tap(h) {
    stats.taps++;
    h.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "touch" }));
  }

  const iv = setInterval(() => {
    const g = window.__game;
    if (!g) return;
    if (g.state === "over") { clearInterval(iv); return; }
    if (g.state !== "playing") return;
    started = true;
    const rushing = cfg.rush && g.timeLeft < cfg.rush.sec * 1000;

    holes.forEach((h, i) => {
      const s = st[i];
      const act = h.classList.contains("up") && !h.classList.contains("smashed");
      if (!act) { s.active = false; return; }
      if (s.active) return;
      s.active = true;
      const tok = ++s.tok;
      const type = h.dataset.type;
      let go = false, delay = rushing ? rnd(cfg.rush.react) : rnd(cfg.react);

      if (type === "bee") {
        stats.beesSeen++;
        if (cfg.failAtStreak && !stats.failDone && g.streak >= cfg.failAtStreak) { go = true; stats.failDone = true; delay = Math.max(delay, 140); }
        else if (Math.random() < (cfg.beeMistake || 0)) go = true;
      } else if (type === "clock" || type === "frenzy") {
        go = Math.random() < (cfg.powerProb == null ? 0.95 : cfg.powerProb);
        if (type === "clock") go = false;   // clocks add +5s: skip them so every video stays at the planned 20s
        if (cfg.powerReact) delay = rnd(cfg.powerReact);
      } else {
        go = Math.random() < cfg.hitProb;
        if (type === "gold" && cfg.goldReact) { go = Math.random() < 0.99; delay = rnd(cfg.goldReact); }
      }
      if (!go) return;
      setTimeout(() => {
        const still = st[i].tok === tok && st[i].active && h.classList.contains("up") && !h.classList.contains("smashed");
        if (still && window.__game.state === "playing") {
          if (type === "bee") stats.beesHit++;
          tap(h);
        }
      }, delay);
    });

    // clumsy / frantic taps on empty holes
    if (cfg.whiff && Math.random() < cfg.whiff * 0.025) {
      const empty = holes.filter((h) => !h.classList.contains("up"));
      if (empty.length) tap(empty[Math.floor(Math.random() * empty.length)]);
    }
  }, 25);
}

module.exports = { botMain };
