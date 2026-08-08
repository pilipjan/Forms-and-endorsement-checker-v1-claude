# Online Comparator

This is the online-first, offline-capable prototype of the Insurance Forms & Endorsements Comparator.

## Run Locally

Open `index.html` in a browser, or serve the folder with any static web server.

```powershell
cd "C:\Users\PJ\Desktop\vibe coding collection\excel for insurance\InsuranceFormsComparator\web"
python -m http.server 5177
```

Then open `http://localhost:5177`.

## Offline Use

After the app is loaded once from a hosted portfolio link, the service worker caches the app for offline use in the same browser.

You can also click `Download Offline Copy` to save `insurance-forms-comparator-offline.html`. That file has the app's HTML, CSS, and JavaScript embedded, so it can be opened directly without visiting the hosted URL.

When changing app code, regenerate the standalone copy:

```powershell
cd "C:\Users\PJ\Desktop\vibe coding collection\excel for insurance\InsuranceFormsComparator\web"
node build-offline.js
```

## Privacy

No pasted policy data is uploaded, stored, tracked, or sent to a server. Parsing, comparison, charts, and exports run entirely in the user's browser.

## Deploy Later

This app is static HTML, CSS, JavaScript, a web manifest, and a service worker. It can be hosted on GitHub Pages, Netlify, Vercel, Cloudflare Pages, SharePoint static hosting, or any ordinary web server.

## Offline Follow-Up Tasks

1. Port `parser.js` parsing rules into `modParser.bas`.
2. Port `compare.js` dictionary comparison into `modCompare.bas`.
3. Create an `.xlsm` workbook manually or with an Office environment that has trusted VBA project access enabled.
4. Wire workbook buttons to `CleanPrevious`, `CleanCurrent`, `ComparePolicies`, `ExportComparison`, and `ClearWorkbook`.
5. Add an Excel export option to the web app if `.xlsx` output is preferred over CSV.
