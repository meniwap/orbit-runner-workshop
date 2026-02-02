import fs from "node:fs";
import path from "node:path";

function getArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function assert(condition, message) {
  if (!condition) {
    console.error(`ASSERT FAIL: ${message}`);
    process.exit(1);
  }
}

function latestStateFile(dir) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("state-") && f.endsWith(".json"))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (!files.length) return null;
  return path.join(dir, files[0].name);
}

const scenario = getArg("--scenario");
const dir = getArg("--dir");
const statePath = getArg("--state") || (dir ? latestStateFile(dir) : null);

if (!scenario) {
  console.error("Missing --scenario");
  process.exit(1);
}
if (!statePath || !fs.existsSync(statePath)) {
  console.error("Missing state JSON");
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(statePath, "utf-8"));
const centerX = payload?.viewport?.baseW ? payload.viewport.baseW / 2 : 0;

switch (scenario) {
  case "start":
    assert(payload.mode === "play", "mode should be play");
    break;
  case "move":
    assert(payload.player?.x > centerX + 5, "player should move right");
    break;
  case "shoot-score":
    assert(payload.score >= 1, "score should be >= 1");
    assert(payload.stats?.hits >= 1, "hits should be >= 1");
    break;
  case "dash":
    assert(payload.player?.dashCooldown > 0, "dashCooldown should be > 0");
    assert(payload.stats?.dashesUsed >= 1, "dashesUsed should be >= 1");
    break;
  case "pause":
    assert(payload.mode === "paused", "mode should be paused");
    break;
  case "shooter":
    assert(payload.enemyBullets?.count > 0, "enemyBullets.count should be > 0");
    break;
  case "tank":
    assert(payload.score >= 4, "score should be >= 4 after tank kill");
    break;
  case "powerups":
    assert(payload.player?.hp === payload.player?.maxHp, "hp should be at max");
    assert(payload.player?.buffs?.rapidFire > 0, "rapidFire buff should be active");
    break;
  case "wave":
    assert(payload.wave >= 2, "wave should be >= 2");
    break;
  case "gameover":
    assert(payload.mode === "gameover", "mode should be gameover");
    break;
  default:
    console.warn(`No assertions for scenario: ${scenario}`);
}

console.log(`OK: ${scenario}`);
