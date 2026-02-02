Original prompt: Build and iterate a playable web game in this workspace, validating changes with a Playwright loop. Also teach Git + skills + automations + Playwright by building something end-to-end.

## Progress log (2026-02-02)
- Scaffolded Vite (vanilla) app.
- Implemented initial playable Canvas shooter with:
  - Start button `#start-btn`
  - Modes: menu / play / paused / gameover
  - Controls: arrows move, click shoot, B pause, A restart, F fullscreen
  - Hooks: `window.render_game_to_text()` and `window.advanceTime(ms)`
- Added smoke actions + smoke script + workshop doc.
- Installed Playwright for the skill client under `~/.codex/skills/develop-web-game` and set `package.json` to `"type": "module"`.
- Ran the Playwright client against dev server; screenshots + state JSONs are generated under `output/web-game/` with no errors. Smoke shows `score: 1` shortly after start.
- Added enemy types (chaser/shooter/tank), dash, power-ups, wave scaling, and expanded HUD.
- Added test suite actions + assertions and ran full test suite (all scenarios passed).

## TODO
- Add a Codex automation (daily 09:00) to run `scripts/smoke.sh`.
