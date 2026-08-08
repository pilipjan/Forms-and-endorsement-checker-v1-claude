/**
 * Personal-use analytics receiver for the Insurance Forms Comparator
 * "analytics build" (web-analytics/). Runs as its own small service —
 * separate from your existing "portfolio" pm2 app — so it can be started,
 * stopped, or torn down independently.
 *
 * Storage: append-only JSONL, one file per month, under ./data/.
 * No database dependency on purpose — keeps this deployable on a small VPS
 * with zero native-module build steps. Use `npm run report` (summarize.js)
 * to turn the raw log into something readable.
 */
const express = require("express");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 4100;
const API_KEY = process.env.ANALYTICS_KEY || "change-me";
// Comma-separated list of allowed origins, e.g. "https://philipjohnn8nautomation.online"
// Leave unset only while testing locally — lock this down before exposing the port.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*").split(",").map(s => s.trim());

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const app = express();
app.use(express.json({ limit: "512kb" }));

// --- minimal CORS (personal-use scope, not a general-purpose API) ---
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes("*") || (origin && ALLOWED_ORIGINS.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Analytics-Key");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// --- very simple in-memory rate limit: N requests per IP per minute ---
const RATE_LIMIT = 60;
const hits = new Map(); // ip -> { count, windowStart }
app.use((req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.windowStart > 60000) {
    hits.set(ip, { count: 1, windowStart: now });
    return next();
  }
  rec.count++;
  if (rec.count > RATE_LIMIT) return res.status(429).json({ error: "rate limited" });
  next();
});

function checkAuth(req) {
  const headerKey = req.headers["x-analytics-key"];
  const bodyKey = req.body && req.body.apiKey;
  return headerKey === API_KEY || bodyKey === API_KEY;
}

function monthFile(d = new Date()) {
  const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return path.join(DATA_DIR, `events-${ym}.jsonl`);
}

app.post("/api/events", (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: "unauthorized" });

  const events = Array.isArray(req.body.events) ? req.body.events : [];
  if (!events.length) return res.status(400).json({ error: "no events" });

  const receivedAt = new Date().toISOString();
  const lines = events
    .filter(e => e && typeof e.event === "string")
    .map(e => JSON.stringify({ ...e, receivedAt, ip: req.ip }))
    .join("\n") + "\n";

  fs.appendFile(monthFile(), lines, (err) => {
    if (err) {
      console.error("write failed", err);
      return res.status(500).json({ error: "write failed" });
    }
    res.json({ ok: true, stored: events.length });
  });
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Analytics receiver listening on :${PORT} (data -> ${DATA_DIR})`);
  if (API_KEY === "change-me") {
    console.warn("WARNING: ANALYTICS_KEY is still the default. Set it via env var before exposing this publicly.");
  }
});
