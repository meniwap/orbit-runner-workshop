#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export WEB_GAME_CLIENT="${WEB_GAME_CLIENT:-$CODEX_HOME/skills/develop-web-game/scripts/web_game_playwright_client.js}"

PORT="${PORT:-4173}"
BASE_URL="http://localhost:${PORT}"
ACTIONS_DIR="$ROOT_DIR/tests/playwright"
OUT_DIR="$ROOT_DIR/output/web-game"

if [[ ! -f "$WEB_GAME_CLIENT" ]]; then
  echo "Missing WEB_GAME_CLIENT at: $WEB_GAME_CLIENT" >&2
  exit 2
fi

npm run build

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

npm run preview -- --port "$PORT" --strictPort >/tmp/vite-preview.log 2>&1 &
PREVIEW_PID="$!"

cleanup() {
  if [[ -n "${PREVIEW_PID:-}" ]]; then
    kill "$PREVIEW_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

for _ in {1..60}; do
  if curl -fsS "$BASE_URL" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

run_scenario() {
  local name="$1"
  local iterations="$2"
  local pause_ms="$3"
  local actions="$ACTIONS_DIR/actions-${name}.json"
  local outdir="$OUT_DIR/$name"
  rm -rf "$outdir"
  mkdir -p "$outdir"
  node "$WEB_GAME_CLIENT" \
    --url "${BASE_URL}/?scenario=${name}" \
    --actions-file "$actions" \
    --click-selector "#start-btn" \
    --iterations "$iterations" \
    --pause-ms "$pause_ms" \
    --screenshot-dir "$outdir"

  if ls "$outdir"/errors-*.json >/dev/null 2>&1; then
    echo "Errors detected in $outdir" >&2
    exit 1
  fi

  node "$ROOT_DIR/scripts/assert-state.mjs" --scenario "$name" --dir "$outdir"
}

run_scenario "start" 1 200
run_scenario "move" 2 200
run_scenario "shoot-score" 2 200
run_scenario "dash" 2 200
run_scenario "pause" 1 200
run_scenario "shooter" 2 200
run_scenario "tank" 2 200
run_scenario "powerups" 2 200
run_scenario "wave" 1 200
run_scenario "gameover" 1 200

echo "OK: test suite completed"
