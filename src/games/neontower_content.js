"use strict";
// Text + bot profiles for Neon Tower. Placeholders: {score} = floors built, {combo} = best perfect streak, {zone} = last zone reached.
// Game facts: tap to drop the moving floor; a tap within ~7px is "Perfect"; 4 perfects in a row make the floor wider again (up to a limit);
// zones: Cloud layer (12), Bird altitude (28), Satellite orbit (40), Outer space (55), Mars (72), Saturn (92), Jupiter (115), Edge of the galaxy (140).

const NAME = "Neon Tower";

const CONCEPTS = {
  perfect_streak: {
    bot: { mode: "perfect", jitter: 2, endMode: "fail", playMs: [13000, 14500] },
    gate: (r) => r.bestCombo >= 8 && r.score >= 10,
    hooks: ["Perfect taps only 🎯", "Watch the combo grow 🔥", "Not one floor wasted 🏙️", "Timing is everything ⏱️", "How high can perfect take you? 🚀", "Stack it flawlessly ✨", "Can you tap this perfectly? 🎯", "Zero mistakes, pure rhythm 🎶"],
    titles: ["{combo} Perfect Taps in a Row! Can You Match It? 🎯", "Flawless Tower: {score} Floors, No Mistakes 🏙️", "Perfect Timing Challenge — {score} Floors 🔥", "I Hit {combo} Perfects in a Row 😳", "How High Can You Stack? {score} Floors ⬆️", "Neon Tower Perfect Run: Beat {score} Floors 🏆", "Tap Timing Test: {combo} Perfects 🎯", "This Tower Was Built Perfectly ✨", "Can You Stack {score} Floors Without Missing? 🏙️", "Satisfying Perfect Stack: {score} Floors 😌", "Perfect Combo ×{combo} — Neon Tower 🔥", "Build a Skyscraper in Seconds ⏱️🏙️", "Precision Stacking: {combo} Perfect Hits 🎯", "Can You Beat {score} Floors? 🚀"],
    desc: ["A flawless run: {combo} perfect taps in a row and {score} floors.", "Every perfect tap keeps the floor wide. This run reached {score} floors.", "Timing is everything. {score} floors with a {combo}-tap perfect streak.", "No missed taps in the first stretch, then {score} floors in total."],
    tags: ["perfect timing", "stacking game", "tower stack", "perfect stack", "timing game", "satisfying game"]
  },
  thin_tower: {
    bot: { mode: "thin", sloppyN: [4, 5], sloppyAmp: [16, 28], jitter: 2, endMode: "fail", playMs: [13000, 14500] },
    gate: (r) => r.minW <= 135 && r.score >= 9,
    hooks: ["The tower is getting thin… 😬", "Only a sliver left! 😳", "Can it survive? 🏙️", "This is going to be close 😅", "One tap from falling 👀", "Rescue the tower! 🛟", "Stay calm, stay centered 🎯", "Almost nothing to stand on 😰"],
    titles: ["My Tower Got Super Thin… and Survived 😳", "Saved the Tower With a Tiny Floor 🏙️😅", "Thin Tower Challenge: {score} Floors 😬", "How Did This Tower Not Fall? 😮", "From a Tiny Base to {score} Floors 🚀", "Can You Rescue a Thin Tower Too? 🛟", "Clutch Stacking: {score} Floors ⏱️", "Almost Fell, Still Built {score} Floors 🏙️", "One Wrong Tap and It's Over 😬 {score} Floors", "Stack Comeback in Neon Tower 🔥", "Tiny Floors, Huge Tower: {score} Floors 🏙️", "This Close to Losing — {score} Floors 😰", "Recovered From a Bad Start 🔄 {score} Floors", "Surviving With a Sliver: Neon Tower 😳"],
    desc: ["The tower got thin after a few sloppy taps, but it still reached {score} floors.", "A rescue mission: tiny floors and careful timing for {score} floors.", "Barely any base left, but {score} floors in the end.", "Stay centered and the floors grow back. This run: {score} floors."],
    tags: ["clutch", "comeback", "close call", "stacking game", "tower stack", "skill game"]
  },
  comeback: {
    bot: { mode: "thin", sloppyN: [5, 6], sloppyAmp: [8, 20], jitter: 2, endMode: "hold", playMs: [14000, 15000] },
    gate: (r) => r.perfects >= 6 && r.score >= 11,
    hooks: ["Bad start, great finish 🔄", "Watch the comeback 🔥", "Slow start… 😅", "Wait for the perfect taps 🎯", "It gets better, I promise 😄", "Don't judge the first floors 🙈", "Redemption run 🏆", "Turn it around ⬆️"],
    titles: ["Terrible Start, Perfect Finish 🔄 {score} Floors", "Comeback Run: {combo} Perfect Taps at the End 🔥", "Don't Give Up on a Bad Start 🏙️", "From Sloppy to Perfect in Neon Tower ✨", "How I Fixed a Bad Tower 🛠️ {score} Floors", "Redemption Run: {score} Floors 🏆", "The Comeback You Didn't Expect 😮", "Slow Start, Big Tower: {score} Floors ⬆️", "Watch This Tower Recover 🔄", "A Bad Start Can Still Reach {score} Floors 🚀", "Back on Track: {combo} Perfects in a Row 🎯", "Neon Tower Redemption Arc 😎", "Starting Bad, Ending Great ✨ {score} Floors", "This Comeback Felt So Good 😌"],
    desc: ["The first floors were messy, then {combo} perfect taps in a row got the tower back on track: {score} floors.", "A comeback run: shaky start, strong finish, {score} floors.", "Timing improved floor by floor. This run reached {score} floors.", "Don't give up early. The tower recovered and reached {score} floors."],
    tags: ["comeback", "redemption", "stacking game", "tower stack", "perfect timing", "skill game"]
  },
  fast_climb: {
    bot: { mode: "perfect", jitter: 3, endMode: "hold", playMs: [14500, 15500] },
    gate: (r) => r.score >= 14,
    hooks: ["Race to the clouds ☁️", "How high in 15 seconds? ⏱️", "Climb, climb, climb ⬆️", "Reaching for the sky 🌤️", "Watch the sky change 🌇", "From the city to the clouds ☁️", "Speed stacking challenge ⚡", "Higher and higher 🚀"],
    titles: ["{score} Floors in 15 Seconds! Can You Beat It? ⏱️", "Race to the Clouds: {score} Floors ☁️", "How High Can You Stack in 15 Seconds? 🏙️", "Speed Tower Challenge: {score} Floors ⚡", "From Sunset to the Clouds in Seconds 🌇☁️", "Climbing to the Sky — {zone}! 🚀", "Reached the {zone} in Neon Tower ☁️", "Fast Hands Tower Run: {score} Floors ⚡", "Stack Higher Than {score} Floors? 🏆", "A Skyscraper in 15 Seconds 🏙️⏱️", "Watch the Sky Change as the Tower Grows 🌇", "Can You Reach the Clouds Too? ☁️", "Quick Tower Challenge: Beat {score} Floors 🔥", "Higher Than the Birds? Neon Tower 🐦"],
    desc: ["{score} floors in about 15 seconds. The sky changes as the tower grows!", "A quick climb: {score} floors and the {zone} reached.", "How high can you stack in 15 seconds? This run: {score} floors.", "Watch the sunset turn into clouds as the tower gets taller: {score} floors."],
    tags: ["speed run", "tower challenge", "stacking game", "climbing game", "time challenge", "satisfying game"]
  },
  so_close: {
    bot: { mode: "perfect", jitter: 2, endMode: "fail", playMs: [11000, 13000] },
    gate: (r) => r.score >= 8 && r.score <= 20,
    hooks: ["So close to the next zone 😭", "One tap too early 😩", "I was doing so well… 😅", "Don't miss the last tap! 🎯", "This ends badly 😂", "Watch the final tap 👀", "Perfect… until it wasn't 💔", "The tower goes down 😬"],
    titles: ["So Close! Missed the Last Tap 😭 {score} Floors", "Perfect Run Ruined by One Tap 💔", "I Was Doing So Well… 😩 {score} Floors", "One Bad Tap Ended My Tower 😬", "Tower Fail at Floor {score} 😂", "Why Did I Tap Then?! 😭🏙️", "So Close to the Clouds ☁️😩", "A Perfect Streak, Then This Happened 😳", "Don't Miss the Last Tap Like Me 🎯😅", "My Tower Fell at Floor {score} 😭", "Heartbreaking Neon Tower Fail 💔", "Timing Failed Me at the Worst Moment 😬", "That Last Tap Was a Disaster 😂", "Can You Beat Floor {score}? Don't Miss! 🏆"],
    desc: ["A good run that ended with one bad tap at floor {score}. Can you do better?", "Floor {score} and then a missed tap. It happens!", "So close, yet so far: {score} floors before the tower fell.", "Never tap too early or too late. This run ended at floor {score}."],
    tags: ["fail", "funny fail", "rage game", "stacking game", "tower stack", "game fail"]
  }
};

const CTAS = ["Beat floor {score}? Play free — link in bio 👆", "Can you stack higher? Link in bio 🏙️", "Your turn! Neon Tower — link in bio 🔗", "Beat {score} floors! Game link in bio 🎮", "Play Neon Tower free — link in bio 👆", "Think you can beat it? Link in bio 🏆", "Stack higher than {score}! Link in bio 🚀", "Tap the link in my bio to play 🔗"];
const BIO_BADGES = ["🏙️ Play Neon Tower FREE — link in bio 🔗", "👆 Neon Tower link in my bio", "🔗 Play free: link in bio", "Want to play? Link in bio 🎮", "🚀 Stack to the stars — link in bio", "Free game → link in bio 🔗", "🏆 Beat my floors! Link in bio"];
const BIO_END = ["👆 Play FREE — link in bio!", "🏙️ Tap my bio to play now!", "🔗 Neon Tower link is in my bio!", "🏆 Beat my floors — link in bio!", "▶️ Play free — link in bio!", "🚀 Your turn! Link in bio 👆"];
const BIO_LINES = ["🏙️ Play Neon Tower FREE — link in my bio 🔗", "▶️ Want to play? The Neon Tower link is in my bio 🔗", "🔗 Free tower game link in my bio — beat my floors!", "👆 Tap my profile bio to play Neon Tower for free 🎮", "🏆 Think you can beat this? The link is in my bio!", "🚀 Play Neon Tower free — link in the channel bio", "👉 Game link? It's in my bio, no download needed", "🎯 Challenge accepted? Play now, link in my bio", "📲 Play on your phone or PC: link in my bio", "🔥 Join the challenge! Free game link in my bio"];

const DESC_INTROS = ["Tap at the right moment and build a skyscraper that reaches the stars! 🏙️", "Stack the floors, keep the tower wide, and climb past clouds, birds and satellites ☁️", "A simple timing game you can play anywhere. How high can you go? 🚀", "Neon Tower: easy to learn, hard to master 🏙️", "Can you stack a perfect tower? 🎯", "Timing test! How many perfect taps can you chain?", "No download, no sign-up, just tap and build 🏙️", "Think your timing is better than mine? Prove it 🧠", "One tap at a time, all the way to the planets 🪐", "Build higher than the clouds, the satellites and Mars ☁️🛰️🪐", "A satisfying little stacking game ✨", "Quick break? Build a tower 🏙️"];
const DESC_TIPS = ["🎯 Tap when the moving floor lines up with the tower for a Perfect", "🔥 Four perfects in a row make your floor wider again", "☁️ Reach 12 floors for the Cloud layer", "🛰️ Satellites appear around floor 40", "🪐 Mars, Saturn and Jupiter wait far above", "🌇 The sky changes from sunset to space as you climb", "⚡ The floor gets faster the higher you build", "👀 Watch the width: tiny floors are harder to land"];
const DESC_QUESTIONS = ["How many floors can you build? Tell me in the comments 👇", "Can you beat {score} floors? 👇", "Drop your best floor count below and challenge a friend 👇", "How many perfects in a row can you chain? 🎯", "Which zone did you reach: clouds, satellites or space? 🚀", "Tag a friend who thinks their timing is perfect 👇", "Did you reach the clouds? ☁️", "Be honest: could you beat {score} floors? 😏", "Rate my timing from 1 to 10 👇", "Want more tower runs? Let me know 👇"];
const HASHTAGS = ["#NeonTower", "#TowerGame", "#StackGame", "#TimingGame", "#MobileGame", "#CasualGames", "#GamingShorts", "#Challenge", "#SatisfyingGames", "#FreeGames", "#GameShorts", "#TapGame", "#HighScore", "#BrowserGame", "#ArcadeGame", "#PerfectTiming", "#PlayFree", "#GameChallenge", "#QuickGame", "#FunGames"];
const TAG_POOL = ["neon tower", "neon tower game", "tower game", "stack game", "stacking game", "tower stack", "stack the tower", "build a tower", "skyscraper game", "timing game", "perfect timing", "tap timing", "tap game", "tapping game", "mini game", "mini games", "casual game", "casual games", "mobile game", "mobile games", "browser game", "free browser game", "free online game", "free games", "free game no download", "play free games", "no download game", "html5 game", "addictive game", "addictive games", "high score", "high score challenge", "can you beat my score", "beat my score", "gaming shorts", "shorts game", "game shorts", "satisfying game", "satisfying games", "arcade game", "arcade games", "quick game", "short game", "one minute game", "game for android", "game for iphone", "phone game", "indie game", "indie game dev", "gameplay", "gameplay shorts", "gaming", "games to play when bored", "games to play on phone", "boredom killer", "reaction game", "hand eye coordination", "challenge", "game challenge", "score challenge", "viral game", "trending game", "new game", "neon game", "relaxing game", "stress relief game", "easy game", "simple game", "fun mobile game", "best free game", "top free games"];

module.exports = { NAME, CONCEPTS, CTAS, BIO_BADGES, BIO_END, BIO_LINES, DESC_INTROS, DESC_TIPS, DESC_QUESTIONS, HASHTAGS, TAG_POOL };
