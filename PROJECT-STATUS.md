# Insurance Forms Comparator — Project Status & Continuity Guide

> **Last Updated:** 2026-07-26 09:33 (UTC+8)
> **Live URL:** https://philipjohnn8nautomation.online/forms-checker-offline/

---

## Project Location

```
c:\Users\PJ\Desktop\vibe coding collection\excel for insurance\InsuranceFormsComparator\
```

### Key Files

| File | Purpose |
|------|---------|
| `web/index.html` | Main HTML layout (modular dev version) |
| `web/styles.css` | All CSS styles and design tokens |
| `web/app.js` | All UI logic, event handlers, charts, export |
| `web/compare.js` | Comparison engine with Levenshtein similarity |
| `web/parser.js` | Form code parser (prefix detection, normalization) |
| `web/build-offline.js` | Build script — inlines all files into single HTML |
| `web/insurance-forms-comparator-offline.html` | **Built offline standalone** (generated, don't edit) |
| `web/service-worker.js` | PWA offline caching for hosted version |
| `web/manifest.json` | PWA manifest |
| `vibe-deploy.ps1` | Deployment script to VPS (needs `pwsh` not `powershell`) |
| `forms-checker-improvements.md` | Feature spec / requirements doc (at parent dir level) |

---

## VPS Deployment

- **Mesh IP:** `100.96.0.1`
- **User:** `ubuntu`
- **SSH Key:** `.\VPS\ssh-key-2026-01-06.key`
- **Remote Path:** `/home/ubuntu/portfolio/public/forms-checker-offline/`
- **After SCP:** Run `cd /home/ubuntu/portfolio && npm run build && pm2 restart portfolio`

### Manual Deploy Commands (run from project root)

```powershell
# 1. Build offline HTML
node web\build-offline.js

# 2. Upload files
scp -i ".\VPS\ssh-key-2026-01-06.key" -o StrictHostKeyChecking=no .\web\index.html .\web\styles.css .\web\parser.js .\web\compare.js .\web\app.js .\web\insurance-forms-comparator-offline.html .\web\manifest.json .\web\service-worker.js .\web\icon.svg ubuntu@100.96.0.1:/home/ubuntu/portfolio/public/forms-checker-offline/

# 3. Remote build & restart
ssh -i ".\VPS\ssh-key-2026-01-06.key" -o StrictHostKeyChecking=no ubuntu@100.96.0.1 "cd /home/ubuntu/portfolio && npm run build && pm2 restart portfolio"
```

> [!WARNING]
> The `vibe-deploy.ps1` script uses `&&` syntax which fails in older PowerShell (v5). Use **PowerShell 7 (`pwsh`)** or run the manual commands above in cmd/terminal.

> [!IMPORTANT]
> The `build-offline.js` script uses `safeReplace()` to escape `$` characters in file contents before `.replace()`. Without this, `$&` in app.js regex code gets corrupted during build. **Do not simplify this back to direct string interpolation.**

---

## Completed Features (v2.0)

- [x] Collapsible groups (group results by source document)
- [x] Filter chips with counts (Match, Added, Removed, Edition Changed, **Desc Changed**, **Possible Typo**, Unknown)
- [x] Real-time search/filter across codes, descriptions, notes
- [x] Pin rows (star important rows to float to top)
- [x] Color strip (4px left-border instead of full-row coloring)
- [x] Side-by-side mode (Previous vs Current columns)
- [x] Differences Only mode (hide Match rows)
- [x] Copy/Export buttons (form numbers, descriptions, entire table)
- [x] Smart Export modal (configurable subset export)
- [x] Editable cells (double-click to edit code/description inline)
- [x] Row notes (📝 icon for custom underwriting/review comments)
- [x] Keyboard shortcuts (Ctrl+1 Compare, Ctrl+2 Smart Export, Ctrl+F Search, Ctrl+Z Undo)
- [x] Undo stack (revert accidental clears)
- [x] Statistics cards (pie chart + bar chart metrics)
- [x] Levenshtein similarity engine in `compare.js`
- [x] **Description Changed** status (< 85% description similarity)
- [x] **Possible Typo** status (≥ 85% description similarity)
- [x] Metric cards for Desc Changed and Possible Typo
- [x] Charts updated with 7 status categories
- [x] Dark mode with full color token support
- [x] Offline standalone HTML build
- [x] Live deployment to VPS

---

## Remaining / Future Work

- [ ] **Drag to reorder** — Skipped per user request, can add later
- [ ] **Additional parser improvements** from `forms-checker-improvements.md` — review for any uncovered items
- [ ] **PWA install prompt** — Service worker is present but install UX could be improved
- [ ] **Automated tests** — `web/test-engine.js` exists but may need updates for new status types
- [ ] **Deployment script fix** — `vibe-deploy.ps1` needs PowerShell 7 or rewrite for PS 5 compatibility

---

## Architecture Notes

```
index.html ─┐
styles.css  ─┤
parser.js   ─┤──→ build-offline.js ──→ insurance-forms-comparator-offline.html
compare.js  ─┤
app.js      ─┘

parser.js   → window.ComparatorParser  (parseSchedule, parsePrefixes, etc.)
compare.js  → window.ComparatorEngine  (compareSchedules with Levenshtein)
app.js      → IIFE (all UI state, rendering, event binding)
```

### Status Categories (from compare.js)

| Status | Condition | Color |
|--------|-----------|-------|
| Match | Same code + edition + 100% description | Green `#15803d` |
| Possible Typo | Same code + edition + ≥85% description | Fuchsia `#d946ef` |
| Description Changed | Same code + edition + <85% description | Purple `#8b5cf6` |
| Edition Changed | Same base code, different edition | Orange `#ea580c` |
| Added | In Current only | Yellow `#ca8a04` |
| Removed | In Previous only | Red `#dc2626` |
| Unknown Format | Could not parse form code | Gray `#64748b` |
