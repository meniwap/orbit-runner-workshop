#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export WEB_GAME_CLIENT="${WEB_GAME_CLIENT:-$CODEX_HOME/skills/develop-web-game/scripts/web_game_playwright_client.js}"
export WEB_GAME_ACTIONS="${WEB_GAME_ACTIONS:-$ROOT_DIR/tests/playwright/actions-smoke.json}"

PORT="${PORT:-4173}"
URL="http://localhost:${PORT}"

if [[ ! -f "$WEB_GAME_CLIENT" ]]; then
  echo "Missing WEB_GAME_CLIENT at: $WEB_GAME_CLIENT" >&2
  echo "Install the develop-web-game skill and Playwright dependency first." >&2
  exit 2
fi

npm run build

rm -rf output/web-game

npm run preview -- --port "$PORT" --strictPort >/dev/null 2>&1 &
PREVIEW_PID="$!"

cleanup() {
  if [[ -n "${PREVIEW_PID:-}" ]]; then
    kill "$PREVIEW_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

for _ in {1..60}; do
  if curl -fsS "$URL" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

if ! curl -fsS "$URL" >/dev/null 2>&1; then
  echo "Preview server did not become ready at: $URL" >&2
  exit 3
fi

node "$WEB_GAME_CLIENT" \
  --url "$URL" \
  --actions-file "$WEB_GAME_ACTIONS" \
  --click-selector "#start-btn" \
  --iterations 3 \
  --pause-ms 250

echo "OK: screenshots/state in output/web-game/"
