# Web Game Workshop (עברית)

המטרה של הריפו הזה: ללמוד **Git**, **Codex skills**, **Playwright loop**, ו־**אוטומציות** דרך פרויקט קטן שאפשר להריץ ולבדוק מהר.

## 0) דרישות
- Node.js + npm
- (אופציונלי) GitHub CLI: `gh`

בדיקה:
```bash
node -v
npm -v
git --version
gh --version || true
```

## 1) להריץ את המשחק
```bash
npm install
npm run dev
```
ואז לפתוח את ה־URL ש־Vite מציג (ברירת מחדל: `http://localhost:5173`).

### שליטה
- חיצים: תנועה
- עכבר: כיוון
- קליק שמאלי: ירי
- `B`: Pause/Resume
- `A`: Restart
- `F`: Fullscreen toggle
- `Esc`: לצאת מ־Fullscreen

## 2) ה־Skill של Playwright (לולאת בדיקות)
הסקיל `$develop-web-game` מגיע עם קליינט:
`$CODEX_HOME/skills/develop-web-game/scripts/web_game_playwright_client.js`

### התקנת Playwright עבור הקליינט של הסקיל (פעם אחת)
הקליינט צריך dependency בשם `playwright`, לכן מתקינים בתוך תיקיית הסקיל:
```bash
cd "$HOME/.codex/skills/develop-web-game"
npm init -y
npm install playwright
npm pkg set type=module
npx playwright install chromium
```

### משתני סביבה (פעם אחת)
```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export WEB_GAME_CLIENT="$CODEX_HOME/skills/develop-web-game/scripts/web_game_playwright_client.js"
```

### להריץ smoke-test על dev server
בטרמינל 1:
```bash
npm run dev
```

בטרמינל 2:
```bash
node "$WEB_GAME_CLIENT" \
  --url http://localhost:5173 \
  --actions-file tests/playwright/actions-smoke.json \
  --click-selector "#start-btn" \
  --iterations 3 \
  --pause-ms 250
```

ארטיפקטים יופיעו ב־`output/web-game/`:
- `shot-*.png` (screenshots)
- `state-*.json` (מה ש־`window.render_game_to_text()` החזיר)
- `errors-*.json` (רק אם יש שגיאות)

## 3) Smoke script לריצה “כמו CI”
יש סקריפט:
```bash
./scripts/smoke.sh
```
הוא עושה:
1) `npm run build`
2) מריץ `npm run preview` על פורט 4173
3) מריץ Playwright client ומייצר ארטיפקטים ב־`output/web-game/`

## 4) Git – תרגול מומלץ (Hands-on)
### סטטוס בסיסי
```bash
git status -sb
git diff
```

### לעבוד ב־branch
```bash
git switch -c codex/game-core
```

### קומיט קטן
```bash
git add -A
git commit -m "Add playable canvas shooter + playwright hooks"
```

## 5) GitHub עם `gh` (ברגע שמוכנים)
אם `gh` לא מותקן, ב־macOS אפשר להתקין עם:
```bash
brew install gh
```

התחברות:
```bash
gh auth login
```

יצירת repo וחיבור remote (דוגמה):
```bash
gh repo create orbit-runner --source=. --private --remote=origin --push
```

Push נוסף:
```bash
git push -u origin codex/game-core
```

PR:
```bash
gh pr create --fill
```

## 6) אוטומציה יומית (Codex)
הרעיון: להריץ `./scripts/smoke.sh` כל יום ב־09:00, ולקבל inbox עם סיכום והארטיפקטים.

מה האוטומציה עושה:
1) Build
2) Preview
3) Playwright smoke
4) שומר screenshots + state ב־`output/web-game/`

אם תרצו, אפשר להגדיר אוטומציה דרך Codex עם המשימה:
```bash
./scripts/smoke.sh
```

## 7) איפה הקוד
- המשחק: `src/game.js`
- UI בסיסי (כפתור start וכו’): `src/main.js`
- Smoke actions: `tests/playwright/actions-smoke.json`
- Smoke runner: `scripts/smoke.sh`
