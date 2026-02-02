Original prompt: Build and iterate a playable web game in this workspace, validating changes with a Playwright loop. Also teach Git + skills + automations + Playwright by building something end-to-end.

## Progress log (2026-02-02)
- Scaffolded Vite (vanilla) app.
- Implemented initial playable Canvas shooter with:
  - Start button `#start-btn`
  - Modes: menu / play / paused / gameover
  - Controls: arrows move, click shoot, B pause, A restart, F fullscreen
  - Hooks: `window.render_game_to_text()` and `window.advanceTime(ms)`
- Added smoke actions + smoke script + workshop doc.
- Installed Playwright for the skill client and ran Playwright loop successfully.
- Verified screenshots + state JSON from output/web-game.

## TODO
- Add a Codex automation (daily 09:00) to run `scripts/smoke.sh`.
