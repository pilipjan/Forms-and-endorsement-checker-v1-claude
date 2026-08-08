const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const assert = require("node:assert");

const context = { window: {} };
context.window.window = context.window;
vm.createContext(context);

for (const file of ["parser.js", "compare.js"]) {
  const source = fs.readFileSync(path.join(__dirname, file), "utf8");
  vm.runInContext(source, context, { filename: file });
}

const prefixes = context.window.ComparatorParser.defaultPrefixes;
const previous = fs.readFileSync(path.join(__dirname, "..", "samples", "Previous Sample.txt"), "utf8");
const current = fs.readFileSync(path.join(__dirname, "..", "samples", "Current Sample.txt"), "utf8");
const previousItems = context.window.ComparatorParser.parseSchedule(previous, prefixes);
const currentItems = context.window.ComparatorParser.parseSchedule(current, prefixes);
const comparison = context.window.ComparatorEngine.compareSchedules(previousItems, currentItems);
const statuses = comparison.results.map((item) => item.status);

assert(statuses.includes("Match"), "expected at least one match");
assert(statuses.includes("Edition Changed"), "expected an edition change");
assert(statuses.includes("Added"), "expected an added form");
assert(statuses.includes("Removed"), "expected a removed form");
assert(statuses.includes("Unknown Format"), "expected unknown format rows");
assert.strictEqual(previousItems[0].normalizedCode, "CG20100413");
const revised = comparison.results.find((item) => item.status === "Edition Changed");
assert(revised.displayCode.includes("CG 20 10"), "expected revised row to display full spaced code");

console.log(JSON.stringify({
  previousRows: previousItems.length,
  currentRows: currentItems.length,
  resultRows: comparison.results.length,
  statuses,
}, null, 2));
