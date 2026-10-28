import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { buildApp } from "../src/server.js";

test("API integration: registration, authentication, ownership and request workflow", {
  skip: !process.env.DATABASE_URL ? "DATABASE_URL is not configured; PostgreSQL integration test skipped" : false
}, async () => {
  const { Pool } = pg;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined
  });
  const secret = process.env.JWT_SECRET ?? "integration-test-secret-with-more-than-32-bytes";
  const app = buildApp({ pool, jwtSecret: secret, logger: false });
  const suffix = randomUUID();
  const emailA = `provider-${suffix}@example.test`;
  const emailB = `learner-${suffix}@example.test`;
  let userA;
  let userB;
  try {
    await pool.query(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
    await app.ready();

    const live = await app.inject({ method: "GET", url: "/health/live" });
    assert.equal(live.statusCode, 200);
    const ready = await app.inject({ method: "GET", url: "/health/ready" });
    assert.equal(ready.statusCode, 200);

    const registerA = await app.inject({ method: "POST", url: "/api/auth/register", payload: {
      name: "Skill Provider", email: emailA, password: "Strong-passphrase-A1!"
    } });
    assert.equal(registerA.statusCode, 201, registerA.body);
    userA = registerA.json().user;
    const tokenA = registerA.json().token;

    const registerB = await app.inject({ method: "POST", url: "/api/auth/register", payload: {
      name: "Skill Learner", email: emailB, password: "Strong-passphrase-B2!"
    } });
    assert.equal(registerB.statusCode, 201, registerB.body);
    userB = registerB.json().user;
    const tokenB = registerB.json().token;

    const duplicate = await app.inject({ method: "POST", url: "/api/auth/register", payload: {
      name: "Duplicate", email: emailA, password: "Strong-passphrase-C3!"
    } });
    assert.equal(duplicate.statusCode, 409);

    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { authorization: `Bearer ${tokenA}` } });
    assert.equal(me.statusCode, 200);
    assert.equal(me.json().user.id, userA.id);

    const unauthorized = await app.inject({ method: "POST", url: "/api/skills", payload: {
      title: "JavaScript coaching", description: "Practical JavaScript mentorship for beginners.", category: "Programming"
    } });
    assert.equal(unauthorized.statusCode, 401);

    const whitespaceSkill = await app.inject({ method: "POST", url: "/api/skills", headers: { authorization: `Bearer ${tokenA}` }, payload: {
      title: "   ", description: "Practical JavaScript mentorship for beginners.", category: "  "
    } });
    assert.equal(whitespaceSkill.statusCode, 400);

    const createSkill = await app.inject({ method: "POST", url: "/api/skills", headers: { authorization: `Bearer ${tokenA}` }, payload: {
      title: "JavaScript coaching", description: "Practical JavaScript mentorship for beginners.", category: "Programming"
    } });
    assert.equal(createSkill.statusCode, 201, createSkill.body);
    const skill = createSkill.json().skill;

    const publicList = await app.inject({ method: "GET", url: "/api/skills?q=JavaScript" });
    assert.equal(publicList.statusCode, 200);
    assert.equal(publicList.json().items.some((item) => item.id === skill.id), true);

    const forbiddenEdit = await app.inject({ method: "PATCH", url: `/api/skills/${skill.id}`, headers: { authorization: `Bearer ${tokenB}` }, payload: { title: "Hijacked listing" } });
    assert.equal(forbiddenEdit.statusCode, 404);

    const ownRequest = await app.inject({ method: "POST", url: `/api/skills/${skill.id}/requests`, headers: { authorization: `Bearer ${tokenA}` }, payload: {
      message: "I would like to request my own listing as a negative test."
    } });
    assert.equal(ownRequest.statusCode, 400);

    const createRequest = await app.inject({ method: "POST", url: `/api/skills/${skill.id}/requests`, headers: { authorization: `Bearer ${tokenB}` }, payload: {
      message: "I would like to learn JavaScript fundamentals with practical exercises."
    } });
    assert.equal(createRequest.statusCode, 201, createRequest.body);
    const requestId = createRequest.json().request.id;

    const wrongTransition = await app.inject({ method: "PATCH", url: `/api/requests/${requestId}`, headers: { authorization: `Bearer ${tokenB}` }, payload: { status: "accepted" } });
    assert.equal(wrongTransition.statusCode, 404);

    const accept = await app.inject({ method: "PATCH", url: `/api/requests/${requestId}`, headers: { authorization: `Bearer ${tokenA}` }, payload: { status: "accepted" } });
    assert.equal(accept.statusCode, 200, accept.body);
    assert.equal(accept.json().request.status, "accepted");

    const visibleRequests = await app.inject({ method: "GET", url: "/api/requests", headers: { authorization: `Bearer ${tokenB}` } });
    assert.equal(visibleRequests.statusCode, 200);
    assert.equal(visibleRequests.json().items.some((item) => item.id === requestId), true);

    await pool.query("UPDATE users SET status = 'suspended' WHERE id = $1", [userA.id]);
    const suspendedToken = await app.inject({ method: "GET", url: "/api/skills/mine", headers: { authorization: `Bearer ${tokenA}` } });
    assert.equal(suspendedToken.statusCode, 401);
  } finally {
    if (userA?.id) await pool.query("DELETE FROM users WHERE id = $1", [userA.id]).catch(() => {});
    if (userB?.id) await pool.query("DELETE FROM users WHERE id = $1", [userB.id]).catch(() => {});
    await app.close();
    await pool.end();
  }
});

test("API refuses to start without a sufficiently strong JWT secret", () => {
  assert.throws(() => buildApp({ pool: {}, jwtSecret: "too-short" }), /JWT_SECRET/);
});
