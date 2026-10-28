const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("skill_sharing_platform.html", "utf8");
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter((match) => !/\bsrc\s*=/.test(match[1]) && match[2].trim());

if (scripts.length === 0) {
  throw new Error("No inline JavaScript found to validate.");
}

scripts.forEach((match, index) => {
  new vm.Script(match[2], { filename: `skill_sharing_platform.html:inline-script-${index + 1}` });
});

console.log(`JavaScript syntax valid: ${scripts.length} inline script(s).`);
