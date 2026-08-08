const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const read = (fileName) => fs.readFileSync(path.join(root, fileName), "utf8");

// In JS .replace(), $& in the replacement string means "the matched substring".
// File contents (especially app.js) can contain "$&" in regex replacement strings.
// We must escape all "$" as "$$" to prevent unintended substitution.
const safeReplace = (str) => str.replace(/\$/g, "$$$$");

const html = read("index.html")
  .replace(/<link rel="manifest" href="\.\/manifest\.json"\s*\/?>\s*/i, "")
  .replace(/<link rel="stylesheet" href="\.\/styles\.css"\s*\/?>/i, `<style>\n${safeReplace(read("styles.css"))}\n</style>`)
  .replace(/<a class="btn secondary" id="downloadOfflineLink"[\s\S]*?<\/a>/i, '<span class="btn secondary" aria-disabled="true">Offline Copy</span>')
  .replace(/<script src="\.\/analytics\.js"><\/script>/i, `<script>\n${safeReplace(read("analytics.js"))}\n</script>`)
  .replace(/<script src="\.\/parser\.js"><\/script>/i, `<script>\n${safeReplace(read("parser.js"))}\n</script>`)
  .replace(/<script src="\.\/compare\.js"><\/script>/i, `<script>\n${safeReplace(read("compare.js"))}\n</script>`)
  .replace(/<script src="\.\/app\.js"><\/script>/i, `<script>\n${safeReplace(read("app.js"))}\n</script>`)
  .replace("<html", '<html data-offline-copy="true"');

fs.writeFileSync(
  path.join(root, "insurance-forms-comparator-offline.html"),
  `<!doctype html>\n${html.replace(/^<!doctype html>\s*/i, "")}`,
  "utf8"
);

console.log("Created insurance-forms-comparator-offline.html");
