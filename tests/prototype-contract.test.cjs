const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("skill_sharing_platform.html", "utf8");
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter((match) => !/\bsrc\s*=/.test(match[1]) && match[2].trim());

test("the prototype clearly identifies demo-only behaviour", () => {
  assert.match(html, /Interactive prototype — demo data only/i);
  assert.match(html, /No account, payment, wallet, smart contract, or blockchain is connected/i);
  assert.match(html, /No wallet connected · No real funds/i);
});

test("sample marketplace metrics are not represented as verified live metrics", () => {
  assert.match(html, /Sample active tasks/);
  assert.match(html, /Sample freelancer count/);
  assert.match(html, /not real activity/);
  assert.match(html, /not measured/);
});

test("sample activity does not use fake blockchain transaction hashes", () => {
  assert.match(html, /Example Activity \(Simulated — Not Real Transactions\)/);
  assert.match(html, /not a blockchain hash/);
  assert.match(html, /not verified on-chain/);
  assert.doesNotMatch(html, /0x7a9b4c8d2e1f3g5h6i/);
  assert.doesNotMatch(html, /0x2f8e5a1c9b7d4g3h/);
});

test("navigation buttons expose their selected state and target sections", () => {
  const tabs = [...html.matchAll(/<button[^>]*class="nav-tab[^"]*"[^>]*>/g)];
  assert.equal(tabs.length, 5);
  for (const [tag] of tabs) {
    assert.match(tag, /role="tab"/);
    assert.match(tag, /aria-selected="(?:true|false)"/);
    assert.match(tag, /aria-controls="/);
    assert.match(tag, /showSection\('[^']+', this\)/);
  }
});

test("all inline JavaScript parses without syntax errors", () => {
  assert.ok(scripts.length > 0, "expected at least one inline script");
  scripts.forEach((match, index) => {
    assert.doesNotThrow(
      () => new vm.Script(match[2]),
      `inline script ${index + 1} should parse`
    );
  });
});
