# SkillChain — Skill-Sharing Marketplace

SkillChain is a skill-sharing marketplace project with a browser prototype and an initial PostgreSQL-backed API. The prototype's sample data and simulated marketplace interactions are labelled as demo-only; they are not evidence of real accounts, payments, wallets, or blockchain transactions.

## Current implementation

- `web/` — API-connected responsive marketplace interface for accounts, skill discovery, listing management, and exchange requests. Configure the API origin in `web/config.js`.
- `src/server.js` — Fastify API for account security, skill discovery and CRUD, exchange requests, notifications, user reports, and admin moderation.
- `db/schema.sql` — repeatable additive PostgreSQL schema for users, skills, exchange requests, verification/reset tokens, notifications, and moderation reports.
- `scripts/migrate.js` — explicit, transactional schema setup.
- `tests/api.integration.test.js` — PostgreSQL integration coverage for auth, one-time verification/reset tokens, ownership, requests, notifications, and moderation permissions.
- `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, and `SECURITY.md` — architecture, release gates, and security expectations.

## Account security and moderation

- Registration creates a one-time email-verification token that expires after 24 hours. Password reset tokens expire after 30 minutes; both are stored as SHA-256 hashes and invalidated after use.
- Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `EMAIL_FROM`, and the public `FRONTEND_URL` to deliver verification and reset links. In production, set `REQUIRE_EMAIL_VERIFICATION=true` only after SMTP has been tested. If production email is required but not configured, registration and verification resend return a clear service-configuration error.
- In non-production mode only, verification/reset links may be returned for local testing. Never enable development mode in a public deployment.
- Users can report a published listing or another active account. Admin-only moderation routes support review, resolution/dismissal, and (when explicitly selected) suspending the reported account or archiving the reported skill.
- To promote an already-created, active, email-verified account, set `DATABASE_URL`, `ADMIN_EMAIL`, and `CONFIRM_ADMIN_PROMOTION=true`, then run `npm run promote-admin`. Do this from a trusted operator environment; never expose these values to the browser. The command refuses unverified or inactive accounts.
- In-app notifications are created for exchange-request activity. Delivery is stored in PostgreSQL; push notifications and outbound notification email are not implemented.

## Run the API locally

Requirements: Node.js 20+ and PostgreSQL 13+.

1. Install dependencies: `npm install`.
2. Create a PostgreSQL database and set the environment variables below.
3. Apply the schema: `npm run migrate`.
4. Start the API: `npm start`.
5. Check `http://localhost:3000/health/live` and `http://localhost:3000/health/ready`.

Example environment configuration (use your own database credentials and secret; never commit a real `.env` file):

```bash
export DATABASE_URL='postgres://skillchain:change-me@localhost:5432/skillchain'
export JWT_SECRET='replace-with-a-random-secret-of-at-least-32-bytes'
export PORT=3000
# Optional for managed PostgreSQL requiring TLS:
export DATABASE_SSL=true
# Optional comma-separated exact browser origins allowed to call the API:
export CORS_ORIGINS='http://localhost:8000,https://your-approved-client.example'
npm run migrate
npm start
```

### Run the API and PostgreSQL with Docker Compose

```bash
cp .env.example .env
# Edit .env: replace JWT_SECRET and POSTGRES_PASSWORD with strong, unique values.
# Keep DATABASE_URL's password in sync with POSTGRES_PASSWORD.
docker compose up --build -d
docker compose logs -f api
```

The Compose stack stores PostgreSQL data in a named volume and applies the schema on API startup. This is a local/self-managed setup, not a substitute for managed backups or a tested off-host restore. Back up the volume before upgrades and never expose the database port publicly. The API is published on `API_PORT` (default 3000).

Use a strong, unique `JWT_SECRET` (at least 32 bytes) and a least-privilege database account. `CORS_ORIGINS` is deny-by-default when unset. Do not set `DATABASE_SSL=true` unless the database endpoint supports TLS with a trusted certificate. For local browser development, set `apiBaseUrl: "http://localhost:3000"` in `web/config.js`, then serve the repository with `python -m http.server 8000` and open `http://localhost:8000/web/`. Keep `CORS_ORIGINS` limited to the exact frontend origin. For production, set `apiBaseUrl` to the deployed API origin and configure the same frontend origin in the API's CORS allowlist.

## API surface

All JSON endpoints are under `/api`.

| Method | Endpoint | Access |
| --- | --- | --- |
| POST | `/auth/register` | Public; creates an account |
| POST | `/auth/login` | Public; returns an expiring bearer token |
| GET | `/auth/me` | Authenticated |
| GET | `/skills?q=&category=&limit=&offset=` | Public published listings |
| POST | `/skills` | Authenticated; creates a listing |
| GET | `/skills/mine` | Authenticated; own listings |
| PATCH | `/skills/:id` | Authenticated owner only |
| DELETE | `/skills/:id` | Authenticated owner only |
| POST | `/skills/:id/requests` | Authenticated; requests another user's published skill |
| GET | `/requests` | Authenticated; requests where the user is a participant |
| PATCH | `/requests/:id` | Participant and status-transition rules enforced |
| GET | `/health/live` | Liveness |
| GET | `/health/ready` | Database readiness |

Send protected requests with `Authorization: Bearer YOUR_TOKEN`. Registration requires a password of at least 12 characters. Request status rules: the provider can accept or decline a pending request; the requester can cancel a pending request. Users cannot request their own listing. Validation errors return a structured 400 response, and server errors return a request ID without exposing database details.

## Verification

`npm run check` validates JavaScript syntax and runs the tests. The API integration test is skipped locally if `DATABASE_URL` is absent. GitHub Actions provisions PostgreSQL and runs the schema and integration tests on pushes and pull requests.

## What is not production-ready yet

The API milestone is a meaningful foundation, not a claim of production launch. The frontend is not connected to the API; no deployment has been configured or independently verified; backup/restore has not been exercised; there is no email verification, account recovery, moderation/reporting workflow, notifications, or independent security review. Rate limiting is per application instance, not distributed. Do not use the current prototype for real payments, escrow, cryptocurrency, or sensitive production data.

Before public launch: deploy behind HTTPS, provision a durable managed PostgreSQL database with automated backups and a tested restore, configure production secrets and approved CORS origins, run end-to-end and abuse/security tests, implement account recovery and moderation, and document incident response and data deletion.

## Product principles

- Build a useful skill exchange before adding optional crypto or AI features.
- Never present mock data as live activity or verified transactions.
- Enforce authorization on the server, not in browser code.
- Keep secrets and credentials out of source control.
- Prefer evidence-backed tests and clear release gates over unsupported readiness claims.
