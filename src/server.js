import Fastify from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import pg from "pg";
import bcrypt from "bcryptjs";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import nodemailer from "nodemailer";

const { Pool } = pg;

const frontendUrl = (process.env.FRONTEND_URL ?? "http://localhost:8000/web/").replace(/\/+$/, "");
const smtpReady = Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.EMAIL_FROM);
const mailer = smtpReady ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT), secure: process.env.SMTP_SECURE === "true", auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined, connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000 }) : null;
const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");
async function sendAccountEmail(to, subject, text) { if (!mailer) return false; await mailer.sendMail({ from: process.env.EMAIL_FROM, to, subject, text }); return true; }
async function createNotification(pool, userId, type, title, body, href = "/web/#workspace") { if (!userId) return; await pool.query("INSERT INTO notifications (user_id, type, title, body, href) VALUES ($1, $2, $3, $4, $5)", [userId, type, title, body, href]); }
const emailPattern = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$";
const idSchema = { type: "string", format: "uuid" };

export function buildApp({ pool: suppliedPool, jwtSecret = process.env.JWT_SECRET, logger = false } = {}) {
  if (!jwtSecret || Buffer.byteLength(jwtSecret) < 32 || /^(replace-with|change-me|example)/i.test(jwtSecret)) {
    throw new Error("JWT_SECRET must be a unique, non-placeholder secret of at least 32 bytes.");
  }
  const pool = suppliedPool ?? new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000
  });
  const ownsPool = !suppliedPool;
  const app = Fastify({
    logger,
    bodyLimit: 64 * 1024,
    trustProxy: process.env.TRUST_PROXY === "true",
    requestIdHeader: "x-request-id",
    genReqId: () => randomUUID()
  });

  app.register(helmet, { contentSecurityPolicy: false });
  const allowedOrigins = (process.env.CORS_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
  app.register(cors, { origin: allowedOrigins.length ? allowedOrigins : false, credentials: false });
  app.register(jwt, { secret: jwtSecret, sign: { expiresIn: "1h" } });
  app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
  app.decorateRequest("identity", null);
  app.decorate("authenticate", async function authenticate(request, reply) {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "unauthorized" });
    }
    if (!request.user?.sub) return reply.code(401).send({ error: "unauthorized" });
    const activeUser = await pool.query("SELECT id, name, email, role FROM users WHERE id = $1 AND status = 'active'", [request.user.sub]);
    if (!activeUser.rowCount) return reply.code(401).send({ error: "unauthorized" });
    request.identity = { id: activeUser.rows[0].id, name: activeUser.rows[0].name, email: activeUser.rows[0].email, role: activeUser.rows[0].role };
  });
  app.addHook("onClose", async () => { if (ownsPool) await pool.end(); });

  app.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      return reply.code(400).send({ error: "validation_error", message: "Request input is invalid." });
    }
    request.log.error({ err: error, requestId: request.id }, "request failed");
    if (!reply.sent) reply.code(500).send({ error: "internal_error", requestId: request.id });
  });

  app.get("/health/live", async () => ({ status: "ok" }));
  app.get("/health/ready", async (_request, reply) => {
    try { await pool.query("SELECT 1"); return { status: "ready" }; }
    catch { return reply.code(503).send({ status: "unavailable" }); }
  });


  app.post("/api/auth/verify-email", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    schema: { body: { type: "object", additionalProperties: false, required: ["token"], properties: { token: { type: "string", minLength: 20, maxLength: 200 } } } }
  }, async (request, reply) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query("SELECT user_id FROM email_verification_tokens WHERE token_hash = $1 AND expires_at > now() FOR UPDATE", [hashToken(request.body.token)]);
      if (!result.rowCount) { await client.query("ROLLBACK"); return reply.code(400).send({ error: "verification_token_invalid_or_expired" }); }
      await client.query("UPDATE users SET email_verified = true, updated_at = now() WHERE id = $1", [result.rows[0].user_id]);
      await client.query("DELETE FROM email_verification_tokens WHERE user_id = $1", [result.rows[0].user_id]);
      await client.query("COMMIT");
      return { status: "verified", message: "Email address verified. You can now sign in." };
    } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
    finally { client.release(); }
  });

  app.post("/api/auth/resend-verification", {
    config: { rateLimit: { max: 3, timeWindow: "15 minutes" } },
    schema: { body: { type: "object", additionalProperties: false, required: ["email"], properties: { email: { type: "string", maxLength: 254, pattern: emailPattern } } } }
  }, async (request, reply) => {
    if (process.env.REQUIRE_EMAIL_VERIFICATION === "true" && !mailer) return reply.code(503).send({ error: "email_delivery_not_configured" });
    const result = await pool.query("SELECT id, name, email, email_verified FROM users WHERE email = $1 AND status = 'active'", [request.body.email.trim().toLowerCase()]);
    const user = result.rows[0];
    if (user && !user.email_verified) {
      const token = newToken();
      await pool.query("DELETE FROM email_verification_tokens WHERE user_id = $1", [user.id]);
      await pool.query("INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '24 hours')", [user.id, hashToken(token)]);
      const link = frontendUrl + "/?verify=" + encodeURIComponent(token);
      if (mailer) await sendAccountEmail(user.email, "Verify your SkillChain email", "Hello " + user.name + ", verify your email within 24 hours: " + link);
      else if (process.env.NODE_ENV !== "production") request.log.info({ verificationUrl: link }, "Development email verification link");
    }
    return { message: "If the account needs verification, instructions will be sent to its email address." };
  });

  app.post("/api/auth/forgot-password", {
    config: { rateLimit: { max: 3, timeWindow: "15 minutes" } },
    schema: { body: { type: "object", additionalProperties: false, required: ["email"], properties: { email: { type: "string", maxLength: 254, pattern: emailPattern } } } }
  }, async (request, reply) => {
    if (process.env.NODE_ENV === "production" && !mailer) return reply.code(503).send({ error: "email_delivery_not_configured" });
    const result = await pool.query("SELECT id, name, email FROM users WHERE email = $1 AND status = 'active'", [request.body.email.trim().toLowerCase()]);
    const user = result.rows[0];
    let developmentUrl;
    if (user) {
      const token = newToken();
      await pool.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [user.id]);
      await pool.query("INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '30 minutes')", [user.id, hashToken(token)]);
      const link = frontendUrl + "/?reset=" + encodeURIComponent(token);
      if (mailer) await sendAccountEmail(user.email, "Reset your SkillChain password", "Hello " + user.name + ", this password-reset link expires in 30 minutes: " + link);
      else if (process.env.NODE_ENV !== "production") developmentUrl = link;
    }
    return { message: "If an active account matches that email, password reset instructions will be sent.", ...(developmentUrl ? { developmentUrl } : {}) };
  });

  app.post("/api/auth/reset-password", {
    config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
    schema: { body: { type: "object", additionalProperties: false, required: ["token", "password"], properties: { token: { type: "string", minLength: 20, maxLength: 200 }, password: { type: "string", minLength: 12, maxLength: 128 } } } }
  }, async (request, reply) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query("SELECT user_id FROM password_reset_tokens WHERE token_hash = $1 AND expires_at > now() FOR UPDATE", [hashToken(request.body.token)]);
      if (!result.rowCount) { await client.query("ROLLBACK"); return reply.code(400).send({ error: "reset_token_invalid_or_expired" }); }
      const userId = result.rows[0].user_id;
      const passwordHash = await bcrypt.hash(request.body.password, 12);
      await client.query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", [passwordHash, userId]);
      await client.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [userId]);
      await client.query("COMMIT");
      return { message: "Password updated. Please sign in with your new password." };
    } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
    finally { client.release(); }
  });

  app.post("/api/auth/register", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    schema: { body: { type: "object", additionalProperties: false, required: ["name", "email", "password"], properties: {
      name: { type: "string", minLength: 2, maxLength: 80, pattern: "\\S" },
      email: { type: "string", maxLength: 254, pattern: emailPattern },
      password: { type: "string", minLength: 12, maxLength: 128 }
    } } }
  }, async (request, reply) => {
    const name = request.body.name.trim();
    const email = request.body.email.trim().toLowerCase();
    if (name.length < 2) return reply.code(400).send({ error: "validation_error", message: "Name must contain at least two non-space characters." });
    const passwordHash = await bcrypt.hash(request.body.password, 12);
    try {
      const result = await pool.query(
        "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at",
        [name, email, passwordHash]
      );
      const user = result.rows[0];
      const token = app.jwt.sign({ sub: user.id, email: user.email });
      return reply.code(201).send({ user, token });
    } catch (error) {
      if (error.code === "23505") return reply.code(409).send({ error: "email_already_registered" });
      throw error;
    }
  });

  app.post("/api/auth/login", {
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    schema: { body: { type: "object", additionalProperties: false, required: ["email", "password"], properties: {
      email: { type: "string", maxLength: 254, pattern: emailPattern },
      password: { type: "string", minLength: 1, maxLength: 128 }
    } } }
  }, async (request, reply) => {
    const result = await pool.query("SELECT id, name, email, password_hash FROM users WHERE email = $1 AND status = 'active'", [request.body.email.trim().toLowerCase()]);
    const user = result.rows[0];
    const valid = user ? await bcrypt.compare(request.body.password, user.password_hash) : false;
    if (!valid) return reply.code(401).send({ error: "invalid_credentials" });
    const token = app.jwt.sign({ sub: user.id, email: user.email });
    return { user: { id: user.id, name: user.name, email: user.email }, token };
  });

  app.get("/api/auth/me", { preHandler: app.authenticate }, async (request, reply) => {
    const result = await pool.query("SELECT id, name, email, created_at FROM users WHERE id = $1 AND status = 'active'", [request.identity.id]);
    if (!result.rowCount) return reply.code(401).send({ error: "unauthorized" });
    return { user: result.rows[0] };
  });

  app.get("/api/skills", {
    schema: { querystring: { type: "object", additionalProperties: false, properties: {
      q: { type: "string", maxLength: 100 }, category: { type: "string", maxLength: 80 },
      limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
      offset: { type: "integer", minimum: 0, maximum: 100000, default: 0 }
    } } }
  }, async (request) => {
    const { q = "", category = "", limit = 20, offset = 0 } = request.query;
    const result = await pool.query(
      "SELECT s.id, s.owner_id, u.name AS owner_name, s.title, s.description, s.category, s.created_at, s.updated_at FROM skills s JOIN users u ON u.id = s.owner_id WHERE s.status = 'published' AND u.status = 'active' AND ($1 = '' OR s.title ILIKE '%' || $1 || '%' OR s.description ILIKE '%' || $1 || '%') AND ($2 = '' OR s.category = $2) ORDER BY s.created_at DESC, s.id LIMIT $3 OFFSET $4",
      [q.trim(), category.trim(), limit, offset]
    );
    return { items: result.rows, limit, offset };
  });

  app.post("/api/skills", { preHandler: app.authenticate, schema: { body: { type: "object", additionalProperties: false, required: ["title", "description", "category"], properties: {
    title: { type: "string", minLength: 3, maxLength: 120 }, description: { type: "string", minLength: 10, maxLength: 4000 },
    category: { type: "string", minLength: 2, maxLength: 80 }, status: { type: "string", enum: ["draft", "published"], default: "published" }
  } } } }, async (request, reply) => {
    const { title, description, category, status = "published" } = request.body;
    if (title.trim().length < 3 || description.trim().length < 10 || category.trim().length < 2) {
      return reply.code(400).send({ error: "validation_error", message: "Title, description, and category must contain enough non-space characters." });
    }
    const result = await pool.query(
      "INSERT INTO skills (owner_id, title, description, category, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, owner_id, title, description, category, status, created_at, updated_at",
      [request.identity.id, title.trim(), description.trim(), category.trim(), status]
    );
    return reply.code(201).send({ skill: result.rows[0] });
  });

  app.get("/api/skills/mine", { preHandler: app.authenticate }, async (request) => {
    const result = await pool.query("SELECT id, owner_id, title, description, category, status, created_at, updated_at FROM skills WHERE owner_id = $1 ORDER BY updated_at DESC", [request.identity.id]);
    return { items: result.rows };
  });

  app.patch("/api/skills/:id", { preHandler: app.authenticate, schema: {
    params: { type: "object", required: ["id"], properties: { id: idSchema } },
    body: { type: "object", minProperties: 1, additionalProperties: false, properties: {
      title: { type: "string", minLength: 3, maxLength: 120 }, description: { type: "string", minLength: 10, maxLength: 4000 },
      category: { type: "string", minLength: 2, maxLength: 80 }, status: { type: "string", enum: ["draft", "published", "archived"] }
    } }
  } }, async (request, reply) => {
    const allowed = ["title", "description", "category", "status"];
    const updates = allowed.filter((key) => request.body[key] !== undefined);
    const values = updates.map((key) => typeof request.body[key] === "string" ? request.body[key].trim() : request.body[key]);
    for (let index = 0; index < updates.length; index += 1) {
      const minimum = { title: 3, description: 10, category: 2 }[updates[index]] ?? 0;
      if (minimum && values[index].length < minimum) {
        return reply.code(400).send({ error: "validation_error", message: `${updates[index]} contains too few non-space characters.` });
      }
    }
    const sets = updates.map((key, index) => `${key} = $${index + 3}`);
    const result = await pool.query(
      `UPDATE skills SET ${sets.join(", ")}, updated_at = now() WHERE id = $1 AND owner_id = $2 RETURNING id, owner_id, title, description, category, status, created_at, updated_at`,
      [request.params.id, request.identity.id, ...values]
    );
    if (!result.rowCount) return reply.code(404).send({ error: "skill_not_found" });
    return { skill: result.rows[0] };
  });

  app.delete("/api/skills/:id", { preHandler: app.authenticate, schema: { params: { type: "object", required: ["id"], properties: { id: idSchema } } } }, async (request, reply) => {
    const result = await pool.query("DELETE FROM skills WHERE id = $1 AND owner_id = $2 RETURNING id", [request.params.id, request.identity.id]);
    if (!result.rowCount) return reply.code(404).send({ error: "skill_not_found" });
    return reply.code(204).send();
  });

  app.post("/api/skills/:id/requests", { preHandler: app.authenticate, schema: {
    params: { type: "object", required: ["id"], properties: { id: idSchema } },
    body: { type: "object", additionalProperties: false, required: ["message"], properties: { message: { type: "string", minLength: 10, maxLength: 2000 } } }
  } }, async (request, reply) => {
    if (request.body.message.trim().length < 10) {
      return reply.code(400).send({ error: "validation_error", message: "Message must contain at least ten non-space characters." });
    }
    const skill = await pool.query("SELECT id, owner_id FROM skills WHERE id = $1 AND status = 'published'", [request.params.id]);
    if (!skill.rowCount) return reply.code(404).send({ error: "skill_not_found" });
    if (skill.rows[0].owner_id === request.identity.id) return reply.code(400).send({ error: "cannot_request_own_skill" });
    try {
      const result = await pool.query(
        "INSERT INTO skill_requests (skill_id, requester_id, provider_id, message) VALUES ($1, $2, $3, $4) RETURNING id, skill_id, requester_id, provider_id, message, status, created_at, updated_at",
        [request.params.id, request.identity.id, skill.rows[0].owner_id, request.body.message.trim()]
      );
      return reply.code(201).send({ request: result.rows[0] });
    } catch (error) {
      if (error.code === "23505") return reply.code(409).send({ error: "request_already_exists" });
      throw error;
    }
  });

  app.get("/api/requests", { preHandler: app.authenticate }, async (request) => {
    const result = await pool.query(
      "SELECT r.id, r.skill_id, r.requester_id, requester.name AS requester_name, r.provider_id, provider.name AS provider_name, s.title AS skill_title, r.message, r.status, r.created_at, r.updated_at FROM skill_requests r JOIN skills s ON s.id = r.skill_id JOIN users requester ON requester.id = r.requester_id JOIN users provider ON provider.id = r.provider_id WHERE r.requester_id = $1 OR r.provider_id = $1 ORDER BY r.created_at DESC",
      [request.identity.id]
    );
    return { items: result.rows };
  });

  app.patch("/api/requests/:id", { preHandler: app.authenticate, schema: {
    params: { type: "object", required: ["id"], properties: { id: idSchema } },
    body: { type: "object", additionalProperties: false, required: ["status"], properties: { status: { type: "string", enum: ["accepted", "declined", "cancelled"] } } }
  } }, async (request, reply) => {
    const { status } = request.body;
    const result = await pool.query(
      "UPDATE skill_requests SET status = $1, updated_at = now() WHERE id = $2 AND status = 'pending' AND ((provider_id = $3 AND $1 IN ('accepted', 'declined')) OR (requester_id = $3 AND $1 = 'cancelled')) RETURNING id, skill_id, requester_id, provider_id, message, status, created_at, updated_at",
      [status, request.params.id, request.identity.id]
    );
    if (!result.rowCount) return reply.code(404).send({ error: "request_not_found_or_transition_forbidden" });
    return { request: result.rows[0] };
  });

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = buildApp({ logger: true });
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "0.0.0.0";
  app.listen({ port, host }).catch((error) => {
    app.log.error(error);
    process.exitCode = 1;
  });
}
