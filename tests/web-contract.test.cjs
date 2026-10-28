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
  assert.match(html, /id="forgot-form"/);
  assert.match(html, /id="resend-verification-form"/);
  assert.match(html, /id="reset-form"/);
  assert.match(html, /id="report-form"/);
  assert.match(html, /id="notification-list"/);
  assert.match(html, /id="admin-report-list"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /Prototype preview/);
});

test("frontend calls the implemented API and uses a session-scoped bearer token", () => {
  for (const endpoint of ["/api/auth/register", "/api/auth/login", "/api/auth/me", "/api/auth/verify-email", "/api/auth/forgot-password", "/api/auth/reset-password", "/api/auth/resend-verification", "/api/skills", "/api/skills/mine", "/api/requests", "/api/notifications", "/api/reports", "/api/admin/reports", "/health/ready"]) {
    assert.ok(app.includes(endpoint), `expected API endpoint ${endpoint}`);
  }
  assert.match(app, /sessionStorage\.setItem/);
  assert.match(app, /sessionStorage\.removeItem/);
  assert.match(app, /credentials:\s*"omit"/);
  assert.match(app, /function loadNotifications/);
  assert.match(app, /function loadAdminReports/);
  assert.match(app, /function openReport/);
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
