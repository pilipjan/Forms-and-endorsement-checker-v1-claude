/**
 * analytics.js — personal-use tracking for the Insurance Forms Comparator.
 *
 * This file only exists in the "web-analytics" variant. The public offline
 * build (web/) stays untouched and sends nothing anywhere — keep it that way
 * so the "nothing leaves your browser" claim on the live site stays true.
 *
 * Config: edit ANALYTICS_ENDPOINT and ANALYTICS_KEY below before deploying,
 * or override at runtime via localStorage (see bottom of file).
 */
(function () {
  const DEFAULT_CONFIG = {
    // Point this at your analytics-server instance, e.g.:
    // "https://forms-analytics.yourdomain.com/api/events" or "http://100.96.0.1:4100/api/events"
    endpoint: "http://localhost:4100/api/events",
    // Shared secret — must match ANALYTICS_KEY on the server. Not real auth,
    // just keeps random scanners off your endpoint. Rotate it if it leaks.
    apiKey: "change-me",
    flushIntervalMs: 15000,
    maxBatchSize: 25,
    maxQueueSize: 500, // oldest events drop first if you're offline a long time
  };

  const STORAGE_KEY = "formsComparatorAnalyticsQueue";
  const SESSION_KEY = "formsComparatorAnalyticsSession";

  const config = { ...DEFAULT_CONFIG, ...(window.ANALYTICS_CONFIG_OVERRIDE || {}) };

  function loadQueue() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }
  function saveQueue(q) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(q.slice(-config.maxQueueSize))); }
    catch { /* storage full/unavailable — drop silently, tracking must never break the app */ }
  }

  function getSessionId() {
    try {
      let id = localStorage.getItem(SESSION_KEY);
      if (!id) {
        id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch {
      return "s_nostorage";
    }
  }

  const sessionId = getSessionId();
  let queue = loadQueue();
  let flushing = false;

  function track(event, data) {
    try {
      queue.push({
        event,
        data: data || {},
        sessionId,
        ts: new Date().toISOString(),
      });
      saveQueue(queue);
      if (queue.length >= config.maxBatchSize) flush();
    } catch (err) {
      // Tracking must never throw into app code
      console.warn("[analytics] track failed", err);
    }
  }

  async function flush(useBeacon) {
    if (flushing || !queue.length) return;
    const batch = queue.slice(0, config.maxBatchSize);
    flushing = true;
    try {
      const body = JSON.stringify({ events: batch });
      if (useBeacon && navigator.sendBeacon) {
        // Beacon can't carry custom headers, so the key rides in the payload for this path.
        const blob = new Blob([JSON.stringify({ apiKey: config.apiKey, events: batch })], { type: "application/json" });
        navigator.sendBeacon(config.endpoint, blob);
        queue = queue.slice(batch.length);
        saveQueue(queue);
      } else {
        const res = await fetch(config.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Analytics-Key": config.apiKey },
          body,
        });
        if (res.ok) {
          queue = queue.slice(batch.length);
          saveQueue(queue);
        }
        // Non-OK response: leave the batch queued, retry on next interval.
      }
    } catch {
      // Offline or server down — batch stays queued, retried next interval. Expected for an offline-first tool.
    } finally {
      flushing = false;
    }
  }

  window.setInterval(() => flush(false), config.flushIntervalMs);
  window.addEventListener("beforeunload", () => flush(true));
  window.addEventListener("online", () => flush(false));

  // Catch unhandled JS errors too — these are exactly the kind of thing worth
  // knowing about when you're not sitting there watching the console.
  window.addEventListener("error", (e) => {
    track("js_error", { message: e.message, file: e.filename, line: e.lineno });
  });

  window.ComparatorAnalytics = { track, flush: () => flush(false), sessionId, config };
})();
