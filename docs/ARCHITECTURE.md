# Architecture

## Current product shape

SkillChain is a peer-to-peer skill-sharing marketplace. The repository contains:

- A responsive static frontend in `web/`.
- A Fastify API in `src/server.js`.
- A PostgreSQL schema in `db/schema.sql`.
- Integration and frontend contract tests in `tests/`.
- A legacy interactive prototype in `skill_sharing_platform.html`, which is explicitly demo-only and must not be treated as a live service.

The hosted Render site at https://skillchain-preview.onrender.com is a static preview only. It does not have a connected API or database. Its interface explicitly disables API-dependent controls when `web/config.js` has no `apiBaseUrl`. This deployment is not a functioning end-to-end marketplace.

## Implemented API capabilities

The Fastify service implements registration/login, email verification and password recovery token flows, current-user lookup, public skill discovery, authenticated skill CRUD, skill exchange requests and status transitions, persisted in-app notifications, reporting/moderation, account deletion, and liveness/readiness endpoints.

The service uses bcrypt password hashes, one-hour bearer tokens, token-version checks, request schema validation, parameterized SQL, owner checks, admin authorization, tighter rate limits on sensitive auth endpoints, and safe error responses. The frontend uses session-scoped token storage and renders user-supplied content through text nodes rather than HTML injection.

Email verification and password recovery delivery depend on real SMTP configuration. Push notifications, payments, escrow, wallets, and blockchain transactions are not implemented.

## Local development

Requirements: Node.js 20+ and PostgreSQL.

1. Install dependencies with `npm install`.
2. Configure `DATABASE_URL` and a unique `JWT_SECRET` of at least 32 bytes.
3. Apply schema with `npm run migrate`.
4. Start the API with `npm start`.
5. Verify `/health/live` and `/health/ready`.
6. Set `web/config.js` to the API origin and configure `CORS_ORIGINS` to allow the exact frontend origin.

For a local stack, use Docker Compose and replace all sample credentials in `.env`. Never expose the database publicly or commit secrets.

## Trust boundaries and operational constraints

- The browser is untrusted; API authorization and ownership checks are authoritative.
- Database credentials and JWT/SMTP secrets must remain server-side.
- CORS must allow only the exact trusted frontend origins.
- Database backups and a tested restore are required before real user data is accepted.
- Rate limiting currently operates per API instance; `REDIS_URL` is not wired to a distributed adapter.
- Do not present sample data or prototype UI activity as verified real-world usage.

## Production gates

Before inviting real users, configure a durable PostgreSQL service with backups, deploy the API with secure environment variables, verify SMTP delivery, run external browser end-to-end checks, confirm HTTPS/CORS/rate-limit behaviour, test backup restoration, and obtain an independent security review. Review `docs/RELEASE_RUNBOOK.md` for the release checklist.

A successful CI run or hosting-provider deployment status is not, by itself, proof that the complete product is operational.
