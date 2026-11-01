"use strict";
// Content library. Add more hooks / titles / concepts here: the planner uses everything it finds.
// Placeholders: {score} {combo} {time} {target} {rush}

const THEMES = ["garden", "night", "candy", "desert", "lava", "snow"];
const HOOK_STYLES = ["pill", "sticker", "neon", "ribbon"];
const BEST_MODES = ["fresh", "chase"]; // fresh = first score ever (confetti), chase = an existing best the run may not beat

// Bot profile fields (all times in ms):
//  react [min,max] reaction time | hitProb chance to go for an ant | beeMistake chance to tap a bee by mistake
//  whiff taps per second on empty holes | powerProb chance to grab clock/lightning | goldReact faster reaction to gold ants
//  failAtStreak = deliberately tap one bee once this streak is reached | rush {sec,react} = speed up in the last seconds
const CONCEPTS = {
  pro_run: {
    time: 14,
    bot: { react: [70, 150], hitProb: 0.97, beeMistake: 0, whiff: 0.2, powerProb: 0.98 },
    gate: (r) => r.bestMult >= 4,
    hooks: ["Can you beat this score? 🐜", "Think you're faster than this? ⚡", "Beat this in {time} seconds 🏆", "Pro-level ant smashing 🔨", "Your move: beat this run 🐜"],
    titles: ["Can You Beat {score} Points in {time} Seconds? 🐜", "I Hit a ×{combo} Combo in Ant Smash! 🔥", "{score} Points in {time} Seconds — Your Turn! 🏆", "This Ant Smash Run Was PERFECT 😳", "Smashing Ants at Insane Speed 🐜💨", "How Fast Can You Smash Ants? ⚡"],
    desc: ["This run: {score} points with a ×{combo} combo in {time} seconds.", "{score} points, ×{combo} multiplier, {time} seconds. Can you do better?"],
    tags: ["high score", "combo", "ant smash challenge"]
  },
  bee_fail: {
    time: 14,
    bot: { react: [80, 160], hitProb: 0.97, beeMistake: 0, whiff: 0.2, powerProb: 0.95, failAtStreak: [7, 10] },
    gate: (r) => r.counts.smashBee >= 1 && r.bestMult >= 3,
    hooks: ["Perfect run… until the bee 🐝😭", "One wrong tap ruins everything 🐝", "Don't touch the bees! 🐝", "So close to a perfect run 😩", "Watch the bees… 🐝👀"],
    titles: ["I Was Doing So Well… Then the BEE 🐝😭", "One Bee Ruined My Combo 😩", "Never Tap the Bee! 🐝", "My ×{combo} Combo Got Destroyed by a Bee 🐝", "Perfect Run Ruined in One Tap 😭", "The Bee Trap in Ant Smash 🐝"],
    desc: ["One mistaken tap on a bee cost me the whole combo.", "Everything was going perfectly… until I tapped the bee. Finished with {score} points."],
    tags: ["bee", "fail", "funny game moments"]
  },
  noob: {
    time: 14,
    bot: { react: [260, 480], hitProb: 0.75, beeMistake: 0.12, whiff: 1.2, powerProb: 0.6 },
    gate: () => true,
    hooks: ["My reflexes right now 😭", "Be honest, you'd do better 🐜", "This is how NOT to play 😂", "Ants 1, Me 0 🐜", "Why are these ants so fast?! 😭"],
    titles: ["Why Are These Ants So Fast?! 😭", "Worst Ant Smash Run Ever 😂", "I Can't Catch Them! 🐜😭", "Ant Smash but My Reflexes Are Gone 😂", "Can You Do Better Than {score} Points? 🐜", "The Ants Are Winning… 😭"],
    desc: ["I only managed {score} points. Surely you can do better?", "Not my best run: {score} points. Show me how it's done!"],
    tags: ["funny", "fail", "bad reflexes"]
  },
  lightning: {
    time: 14,
    bot: { react: [90, 170], hitProb: 0.92, beeMistake: 0, whiff: 0.3, powerProb: 1, powerReact: [40, 90] },
    gate: (r) => r.counts.frenzy >= 1,
    hooks: ["⚡ Lightning = DOUBLE points!", "Wait for the lightning ⚡", "Catch the lightning ⚡🐜", "Double points incoming ⚡", "Chasing the lightning ⚡"],
    titles: ["The Lightning Power-Up Is INSANE ⚡", "Double Points Power-Up in Ant Smash ⚡🐜", "I Found the Lightning! ⚡ {score} Points", "How to Get Double Points ⚡", "Lightning Mode = Crazy Score ⚡", "Catch the Lightning, Get ×2 ⚡"],
    desc: ["The lightning power-up doubles every point for 6 seconds. Final score: {score}.", "Grab the lightning and watch the score explode: {score} points!"],
    tags: ["power up", "double points", "lightning"]
  },
  clutch: {
    time: 14,
    bot: { react: [170, 270], hitProb: 0.9, beeMistake: 0.02, whiff: 0.6, powerProb: 0.9, rush: { sec: 5, react: [40, 100] } },
    gate: (r) => r.score >= 12,
    hooks: ["Last seconds… watch this 😳", "Can I save this run? ⏱️", "Final seconds clutch ⏱️🔥", "Down to the wire ⏱️"],
    titles: ["Insane Last-Second Clutch ⏱️🔥", "Saved the Run With Seconds Left ⏱️", "The Final Seconds Changed Everything 😳", "Can You Clutch Like This? ⏱️", "The Last {rush} Seconds Were Crazy 🔥"],
    desc: ["Slow start, crazy finish: {score} points. The last {rush} seconds changed everything.", "I was behind until the final seconds… ended with {score} points!"],
    tags: ["clutch", "comeback", "last second"]
  },
  no_bee: {
    time: 14,
    bot: { react: [100, 180], hitProb: 0.96, beeMistake: 0, whiff: 0.2, powerProb: 0.95 },
    gate: (r) => (r.counts.smashBee || 0) === 0 && r.bot.beesSeen >= 1,
    hooks: ["Not one bee touched 🐝🚫", "Zero bees challenge 🐝", "Avoid every bee, hit every ant 🎯", "Can you avoid ALL the bees? 🐝"],
    titles: ["Zero Bees Touched Challenge 🐝🚫", "Can You Avoid Every Bee? 🐝", "Ant Smash Without Touching a Single Bee 🎯", "Dodging Every Bee Perfectly 🐝😎", "Only Ants, Never Bees 🐜"],
    desc: ["{score} points and not a single bee touched. Can you do it?", "Zero bee mistakes this round. Final score: {score}."],
    tags: ["no mistakes", "bee", "perfect run"]
  },
  speed_demon: {
    time: 14,
    bot: { react: [25, 70], hitProb: 0.97, beeMistake: 0.01, whiff: 2.5, powerProb: 0.98 },
    gate: (r) => r.bestMult >= 4,
    hooks: ["Insane reflexes? 🤯", "Too fast for the ants ⚡🐜", "Can you tap this fast? ⚡", "Speed mode ON ⚡"],
    titles: ["Can You Tap This Fast? ⚡🐜", "Insane Reflexes in Ant Smash 🤯", "Faster Than the Ants! ⚡", "Speed Run: {score} Points in {time}s ⚡", "Lightning Fast Ant Smashing 🤯"],
    desc: ["Maximum speed: {score} points in {time} seconds.", "How fast can you tap? I hit {score} points in {time} seconds."],
    tags: ["speed", "fast reflexes", "reaction time"]
  },
  guess_score: {
    time: 14,
    bot: { react: [90, 200], hitProb: 0.93, beeMistake: 0.01, whiff: 0.4, powerProb: 0.9 },
    gate: (r) => r.score >= 12,
    hooks: ["Guess my final score 👇", "What score will I get? 🤔", "Guess the score before the end! 🔢", "Score prediction time 🔢"],
    ctas: ["Did you guess right? Comment it! 👇", "Final score: {score}! Were you close? 👇", "Comment your guess — was it {score}? 👇"],
    titles: ["Guess My Final Score! 🔢🐜", "Can You Predict the Score? 🤔", "Guess the Score Challenge 🔢", "What Score Will I Get? 🐜❓"],
    desc: ["Guess the final score before the timer ends, then check the result!", "Make your prediction in the comments. (Spoiler: it ended at {score}.)"],
    tags: ["guess", "prediction", "challenge"]
  },
  gold_rush: {
    time: 14,
    bot: { react: [90, 170], hitProb: 0.95, beeMistake: 0, whiff: 0.3, powerProb: 0.95, goldReact: [30, 80] },
    gate: (r) => r.counts.smashGold >= 1,
    hooks: ["Rare golden ants = 5 points ✨", "Spot the golden ant ✨🐜", "Golden ants are worth 5× ✨", "Hunt the golden ants ✨"],
    titles: ["Golden Ants Are Worth 5 Points! ✨", "I Caught the Rare Golden Ant ✨🐜", "Hunting Golden Ants ✨", "How Many Golden Ants Can You Catch? ✨"],
    desc: ["Golden ants are rare and worth 5 points each. How many can you catch? Final score: {score}.", "Hunting rare golden ants for a huge score: {score} points."],
    tags: ["golden ant", "rare", "5 points"]
  }
};

const COMMON_CTAS = ["Comment your score 👇", "Drop your score below 👇", "Think you can do better? 👇", "Your turn — beat it! 🏆", "Tell me your best score 👇", "Score to beat: {score} 🏆", "Can you reach {target}? 👇", "What's your high score? 👇", "Beat {score} and comment 👇"];

const BIO_LINES = [
  "🎮 Play the game FREE — link in my bio 🔗",
  "▶️ Want to play? The game link is in my bio 🔗",
  "🔗 Free game link in my bio — come and beat my score!",
  "👆 Tap my profile bio to play Ant Smash for free 🎮"
];
const DESC_INTROS = [
  "Think you're fast? 🐜🔨 Smash the ants before they hide!",
  "Quick reflexes needed! Smash the ants and chain a huge combo.",
  "Tap the ants, dodge the bees, chase a high score! 🐝",
  "Ant Smash is a fast reflex game — how long can you keep the combo alive?",
  "Reflex test time! 🐜 How many ants can you smash?"
];
const DESC_TIPS = [
  "⚡ Lightning gives double points for 6 seconds",
  "⏱️ Clocks add 5 extra seconds",
  "✨ Golden ants are worth 5 points",
  "🐝 Smashing a bee costs you 3 points",
  "🔥 Chain hits to raise your multiplier up to ×8",
  "🐜 Red ants are faster and worth 2 points"
];
const DESC_QUESTIONS = [
  "What's your best score? Tell me in the comments 👇",
  "Can you beat {score}? 👇",
  "Drop your score below and challenge a friend 👇",
  "Which power-up is your favorite? ⚡⏱️✨"
];
const HASHTAGS = ["#AntSmash", "#MiniGame", "#MobileGame", "#CasualGames", "#GamingShorts", "#Challenge", "#ReflexGame", "#SatisfyingGames", "#FreeGames", "#WhackAMole", "#GameShorts", "#TapGame", "#HighScore"];
const TAG_POOL = ["ant smash", "ant smash game", "whack a mole", "whack an ant", "smash ants game", "mini game", "casual game", "mobile game", "browser game", "free online game", "free game", "addictive game", "tap game", "reflex game", "reaction game", "high score challenge", "can you beat my score", "gaming shorts", "shorts game", "play free games", "fun game", "time killer game", "satisfying game", "arcade game"];

// ---- merge the big extra pool (src/content_extra.js) into the library, ignoring duplicates ----
const X = require("./content_extra");
const uniq = (a, b) => Array.from(new Set((a || []).concat(b || [])));
for (const id of Object.keys(CONCEPTS)) {
  const ex = X.concepts[id]; if (!ex) continue;
  const C = CONCEPTS[id];
  C.hooks = uniq(C.hooks, ex.hooks); C.titles = uniq(C.titles, ex.titles); C.desc = uniq(C.desc, ex.desc); C.tags = uniq(C.tags, ex.tags);
  if (ex.ctas) C.ctas = uniq(C.ctas, ex.ctas);
}
const COMMON_CTAS2 = uniq(COMMON_CTAS, X.COMMON_CTAS);
const BIO_LINES2 = uniq(BIO_LINES, X.BIO_LINES);
const DESC_INTROS2 = uniq(DESC_INTROS, X.DESC_INTROS);
const DESC_TIPS2 = uniq(DESC_TIPS, X.DESC_TIPS);
const DESC_QUESTIONS2 = uniq(DESC_QUESTIONS, X.DESC_QUESTIONS);
const HASHTAGS2 = uniq(HASHTAGS, X.HASHTAGS);
const TAG_POOL2 = uniq(TAG_POOL, X.TAG_POOL);

module.exports = { BIO_BADGES: X.BIO_BADGES, BIO_END: X.BIO_END, BIO_LINES: BIO_LINES2, THEMES, HOOK_STYLES, BEST_MODES, CONCEPTS, COMMON_CTAS: COMMON_CTAS2, DESC_INTROS: DESC_INTROS2, DESC_TIPS: DESC_TIPS2, DESC_QUESTIONS: DESC_QUESTIONS2, HASHTAGS: HASHTAGS2, TAG_POOL: TAG_POOL2 };
