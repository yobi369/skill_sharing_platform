# SkillChain — Skill-Sharing Marketplace

SkillChain is a skill-sharing marketplace with a responsive browser frontend and a PostgreSQL-backed Fastify API. The original prototype's sample data and simulated marketplace interactions are demo-only; they are not evidence of real accounts, payments, wallets, or blockchain transactions.

## Current implementation

- `web/` — responsive API-connected marketplace interface for accounts, skill discovery, listing management, exchange requests, verification/recovery forms, notifications, reporting, and admin moderation.
- `src/server.js` — Fastify API for account security, skill discovery and CRUD, exchange requests, notifications, reports, and admin moderation.
- `db/schema.sql` — additive PostgreSQL schema for users, skills, exchange requests, verification/reset tokens, notifications, and moderation reports.
- `scripts/migrate.js` — explicit transactional schema setup.
- `scripts/promote-admin.js` — operator-only promotion of an active, email-verified account.
- `tests/api.integration.test.js` — PostgreSQL integration coverage for auth, single-use verification/reset tokens, ownership, requests, notifications, and moderation permissions.
- `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/RELEASE_RUNBOOK.md`, and `SECURITY.md` — architecture, roadmap, deployment/release process, and security expectations.

## Account security and moderation

- Email-verification tokens expire after 24 hours; password-reset tokens expire after 30 minutes. Tokens are stored as SHA-256 hashes and invalidated after use.
- Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `EMAIL_FROM`, and the public `FRONTEND_URL` to deliver verification and reset links. In production, set `REQUIRE_EMAIL_VERIFICATION=true` only after SMTP has been tested. If verification is required but delivery is unavailable, the API returns a configuration error.
- Development-only verification/reset links may be returned for local testing. Never enable development mode in a public deployment.
- Users can report published listings or active accounts. Admin-only moderation supports review, resolve/dismiss, and explicit account suspension or skill archiving.
- In-app notifications are persisted in PostgreSQL and can be marked read. Push notifications and outbound notification email are not implemented.
- To promote an active, email-verified account, set `DATABASE_URL`, `ADMIN_EMAIL`, and `CONFIRM_ADMIN_PROMOTION=true`, then run `npm run promote-admin` from a trusted operator environment. Never expose these values to browser code.

## Run locally

Requirements: Node.js 20+ and PostgreSQL 13+.

1. Install dependencies: `npm install`.
2. Create a PostgreSQL database and set the environment variables below.
3. Apply the schema: `npm run migrate`.
4. Start the API: `npm start`.
5. Check `http://localhost:3000/health/live` and `http://localhost:3000/health/ready`.

Example configuration (use unique credentials and a random secret; never commit a real `.env` file):

```bash
export DATABASE_URL='postgres://skillchain:YOUR_LOCAL_PASSWORD@localhost:5432/skillchain'
export JWT_SECRET="$(openssl rand -base64 48)"
export PORT=3000
# Optional if your managed database requires TLS:
export DATABASE_SSL=true
# Exact browser origin(s), comma-separated:
export CORS_ORIGINS='http://localhost:8000'
npm run migrate
npm start
```

### Docker Compose

```bash
cp .env.example .env
# Edit .env and replace all sample secrets/passwords.
docker compose up --build -d
docker compose logs -f api
``

Compose persists local PostgreSQL data in a named volume and applies the schema at API startup. This is a local/self-managed setup, not a substitute for off-host backups and a tested restore. Do not expose the database port publicly.

For local browser development, set `apiBaseUrl: "http://localhost:3000"` in `web/config.js`, serve the repository with `python -m http.server 8000`, and open `http://localhost:8000/web/`. For a hosted frontend, set `apiBaseUrl` to the deployed API origin and configure the API's `CORS_ORIGINS` with the exact HTTPS frontend origin.

## Health endpoints

- `GET /health/live` — process liveness.
- `GET /health/ready` — PostgreSQL connectivity/readiness.

## Verification

Run `npm run check` to validate JavaScript syntax and execute tests. The API integration test is skipped locally if `DATABASE_URL` is absent. GitHub Actions provisions PostgreSQL and runs schema/integration tests, dependency audit, syntax/contract checks, Compose validation, Docker build, and secret-pattern scanning.

The latest recorded quality run is [run 40758231879](https://github.com/yobi369/skill_sharing_platform/actions/runs/40758231879), which passed for commit `08a88812e5637f127b759da1a7910ab209ce53b0`. Check the current branch/PR for newer results before releasing.

## Release status and limitations

This repository has a meaningful API and frontend foundation, but a passing CI run is not proof of a live production service. Public deployment, SMTP delivery, durable hosted database, backup/restore, external browser E2E, and independent security review have not yet been verified. Rate limits are per instance; the optional `REDIS_URL` is not currently wired to a distributed rate-limit adapter. Push notifications, payments, escrow, wallets, and blockchain transactions are not implemented.

Do not use a temporary free database for real user data. Review `docs/RELEASE_RUNBOOK.md` before deployment. If durable storage, tested email delivery, and release gates cannot be met within the no-cost constraint, keep the application in preview/staging mode rather than inviting real users to store data.

## Product principles

- Build a useful skill exchange before adding optional crypto or AI features.
- Never present mock data as live activity or verified transactions.
- Enforce authorization on the server, not in browser code.
- Keep secrets and credentials out of source control.
- Prefer evidence-backed tests and clear release gates over unsupported readiness claims.
