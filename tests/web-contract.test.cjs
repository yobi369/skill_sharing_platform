const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("web/index.html", "utf8");
const app = fs.readFileSync("web/app.js", "utf8");
const styles = fs.readFileSync("web/styles.css", "utf8");
const config = fs.readFileSync("web/config.js", "utf8");

test("real frontend has accessible auth, search, listing and request workflows", () => {
  assert.match(html, /id="login-form"/);
  assert.match(html, /id="register-form"/);
  assert.match(html, /id="search-form"/);
  assert.match(html, /id="skill-form"/);
  assert.match(html, /id="request-form"/);
  assert.match(html, /id="edit-form"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /Prototype preview/);
});

test("frontend calls the implemented API and uses a session-scoped bearer token", () => {
  for (const endpoint of ["/api/auth/register", "/api/auth/login", "/api/auth/me", "/api/skills", "/api/skills/mine", "/api/requests", "/health/ready"]) {
    assert.ok(app.includes(endpoint), `expected API endpoint ${endpoint}`);
  }
  assert.match(app, /sessionStorage\.setItem/);
  assert.match(app, /sessionStorage\.removeItem/);
  assert.match(app, /credentials:\s*"omit"/);
  assert.match(config, /apiBaseUrl/);
});

test("user-provided listing content is rendered as text rather than HTML", () => {
  assert.doesNotMatch(app, /\.innerHTML\s*=/);
  assert.match(app, /textContent\s*=/);
  assert.match(app, /document\.createElement/);
});

test("frontend includes responsive and reduced-motion styles", () => {
  assert.match(styles, /@media\s*\(max-width:\s*580px\)/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /:focus-visible/);
});
