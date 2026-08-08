# Forms Comparator — Analytics Receiver (personal use)

Small standalone Express service that receives usage events from the
`web-analytics/` build of the Insurance Forms Comparator and appends them to
JSONL log files. Runs as its own process — separate from your existing
`portfolio` pm2 app — so it can't break the live site if something goes wrong
with this.

## What it captures

From `web-analytics/analytics.js` + the instrumented `app.js`:

- **`compare_run`** — status breakdown, form counts, timing, and critically
  the **raw text of every line the parser couldn't handle** (`unknownLines`)
  and any duplicate form lines. This is the highest-value data for improving
  `parser.js`.
- **`manual_link`** — every time you use the 🔗 manual re-pair feature,
  logged with the two statuses involved. Repeated patterns here point at
  gaps in the Pass 3 fuzzy matcher in `compare.js`.
- **`manual_edit`** — when you hand-edit a result's code/description, with
  the row's original status. Frequent edits on a given status mean the
  auto-generated output for that status needs work.
- **`export`**, **`note_added`**, **`theme_toggle`**, **`session_start`**,
  **`js_error`** — general usage + error visibility.

## 1. Deploy to your VPS

You already deploy the main site via SCP + pm2 (see the project's
`PROJECT-STATUS.md`). This service is independent — same box, different
port, own pm2 process:

```bash
# From your machine, upload this folder
scp -i <your-ssh-key> -r ./analytics-server ubuntu@<your-vps-ip>:/home/ubuntu/forms-analytics

# On the VPS
cd /home/ubuntu/forms-analytics
npm install --production
cp .env.example .env   # then edit ANALYTICS_KEY and ALLOWED_ORIGINS
```

Start it with pm2, pointing at your `.env`:

```bash
ANALYTICS_KEY=$(grep ANALYTICS_KEY .env | cut -d= -f2) \
ALLOWED_ORIGINS=$(grep ALLOWED_ORIGINS .env | cut -d= -f2) \
pm2 start server.js --name forms-analytics
pm2 save
```

Or simpler — just export the vars in the pm2 ecosystem file / ecosystem.config.js
if you're already using one for `portfolio`.

**Expose it.** Either:
- Open port `4100` on the VPS firewall and hit it directly
  (`http://<vps-ip>:4100/api/events`), or
- (Better) reverse-proxy it through the nginx config you already have for
  the portfolio site, on a subpath or subdomain, so it rides on HTTPS:
  ```nginx
  location /forms-analytics/ {
      proxy_pass http://127.0.0.1:4100/;
      proxy_set_header Host $host;
  }
  ```
  Then your endpoint is `https://philipjohnn8nautomation.online/forms-analytics/api/events`.

## 2. Configure the frontend

In `web-analytics/analytics.js`, set:

```js
endpoint: "https://philipjohnn8nautomation.online/forms-analytics/api/events",
apiKey: "<same value as ANALYTICS_KEY on the server>",
```

Then deploy `web-analytics/` to wherever you want to actually use the
tracked build — **not** to `forms-checker-offline/`, so the public site
keeps its "nothing leaves your browser" claim true. A separate path like
`/forms-checker-tracked/` (kept unlinked / not indexed) works well for
personal-only use.

## 3. Read the data

```bash
npm run report            # human-readable summary
npm run report -- --json  # raw JSON, e.g. to pipe elsewhere
npm run report -- --month=2026-07
```

This is the actual payoff: `topUnknownLines` and `topManualLinkPairs` tell
you exactly which real-world form lines and mismatches to go fix in
`parser.js` / `compare.js`, ranked by how often you actually hit them.

## Notes

- Storage is flat JSONL files under `data/`, one per month. No database —
  nothing to install or maintain beyond Node itself.
- The shared key (`X-Analytics-Key` header, or `apiKey` in the body for the
  `sendBeacon` unload path) is basic protection against randoms hitting the
  endpoint, not real auth. Keep `ALLOWED_ORIGINS` locked to your domain once
  this is live.
- The client queues events in `localStorage` and retries if you're offline
  or the server's down — fits the "offline-first" nature of the tool.
