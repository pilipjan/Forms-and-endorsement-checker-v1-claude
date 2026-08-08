/**
 * Reads every data/events-*.jsonl file and prints a readable summary:
 * feature usage counts, sessions, and — the actual point of this build —
 * the raw lines that beat the parser/matcher, ranked by frequency.
 *
 * Usage: node summarize.js [--month=2026-07] [--json]
 */
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const args = process.argv.slice(2);
const monthArg = args.find(a => a.startsWith("--month="));
const asJson = args.includes("--json");

function loadEvents() {
  if (!fs.existsSync(DATA_DIR)) return [];
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.startsWith("events-") && f.endsWith(".jsonl"))
    .filter(f => !monthArg || f.includes(monthArg.split("=")[1]));

  const events = [];
  for (const f of files) {
    const lines = fs.readFileSync(path.join(DATA_DIR, f), "utf8").split("\n").filter(Boolean);
    for (const line of lines) {
      try { events.push(JSON.parse(line)); } catch { /* skip malformed line */ }
    }
  }
  return events;
}

function topN(counter, n = 15) {
  return Object.entries(counter).sort((a, b) => b[1] - a[1]).slice(0, n);
}

function summarize(events) {
  const sessions = new Set();
  const eventCounts = {};
  const unknownLineCounts = {};
  const exportFormats = {};
  const manualLinkPairs = {};
  const manualEditFields = {};
  const errors = {};
  let totalCompareRuns = 0;
  let totalRowsCompared = 0;
  let totalDurationMs = 0;

  for (const e of events) {
    if (e.sessionId) sessions.add(e.sessionId);
    eventCounts[e.event] = (eventCounts[e.event] || 0) + 1;

    if (e.event === "compare_run" && e.data) {
      totalCompareRuns++;
      totalRowsCompared += (e.data.previousCount || 0) + (e.data.currentCount || 0);
      totalDurationMs += e.data.durationMs || 0;
      (e.data.unknownLines || []).forEach(line => {
        const key = (line || "").trim();
        if (key) unknownLineCounts[key] = (unknownLineCounts[key] || 0) + 1;
      });
    }
    if (e.event === "export" && e.data) {
      exportFormats[e.data.format] = (exportFormats[e.data.format] || 0) + 1;
    }
    if (e.event === "manual_link" && e.data) {
      const key = `${e.data.statusA} <-> ${e.data.statusB}`;
      manualLinkPairs[key] = (manualLinkPairs[key] || 0) + 1;
    }
    if (e.event === "manual_edit" && e.data) {
      const key = `${e.data.field} (row was: ${e.data.status})`;
      manualEditFields[key] = (manualEditFields[key] || 0) + 1;
    }
    if (e.event === "js_error" && e.data) {
      const key = e.data.message || "unknown error";
      errors[key] = (errors[key] || 0) + 1;
    }
  }

  return {
    totalEvents: events.length,
    uniqueSessions: sessions.size,
    eventCounts,
    compareRuns: totalCompareRuns,
    avgFormsPerRun: totalCompareRuns ? Math.round(totalRowsCompared / totalCompareRuns) : 0,
    avgCompareDurationMs: totalCompareRuns ? Math.round(totalDurationMs / totalCompareRuns) : 0,
    topUnknownLines: topN(unknownLineCounts),      // <- parser gaps to fix in parser.js
    topManualLinkPairs: topN(manualLinkPairs),      // <- matcher gaps to fix in compare.js Pass 3
    topManualEditFields: topN(manualEditFields),    // <- where auto-generated output needed correction
    exportFormats,
    topErrors: topN(errors),
  };
}

const events = loadEvents();
const report = summarize(events);

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`\n=== Insurance Forms Comparator — Usage Report ===`);
  console.log(`Events: ${report.totalEvents}  |  Sessions: ${report.uniqueSessions}  |  Compare runs: ${report.compareRuns}`);
  console.log(`Avg forms per run: ${report.avgFormsPerRun}  |  Avg compare time: ${report.avgCompareDurationMs}ms\n`);

  console.log(`--- Event counts ---`);
  for (const [k, v] of Object.entries(report.eventCounts)) console.log(`  ${k}: ${v}`);

  console.log(`\n--- Top unparsed lines (parser.js gaps) ---`);
  if (!report.topUnknownLines.length) console.log("  (none — nice)");
  report.topUnknownLines.forEach(([line, count]) => console.log(`  ${count}x  ${line}`));

  console.log(`\n--- Top manual re-pairs (matcher gaps, compare.js Pass 3) ---`);
  if (!report.topManualLinkPairs.length) console.log("  (none)");
  report.topManualLinkPairs.forEach(([pair, count]) => console.log(`  ${count}x  ${pair}`));

  console.log(`\n--- Top manually-corrected fields ---`);
  if (!report.topManualEditFields.length) console.log("  (none)");
  report.topManualEditFields.forEach(([field, count]) => console.log(`  ${count}x  ${field}`));

  console.log(`\n--- Export formats used ---`);
  for (const [k, v] of Object.entries(report.exportFormats)) console.log(`  ${k}: ${v}`);

  if (report.topErrors.length) {
    console.log(`\n--- JS errors ---`);
    report.topErrors.forEach(([msg, count]) => console.log(`  ${count}x  ${msg}`));
  }
  console.log("");
}
