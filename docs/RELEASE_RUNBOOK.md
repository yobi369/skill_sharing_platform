# SkillChain release and deployment runbook

This runbook separates a passing repository CI run from a verified live release. Do not announce a production launch until every required gate below has evidence.

## Current deployment shape

- Frontend: static HTML/CSS/JavaScript in `web/`; set `window.SKILLCHAIN_CONFIG.apiBaseUrl` in `web/config.js` to the public API origin when frontend and API use different hosts.
- API: Fastify service started by `npm start`, listening on `0.0.0.0:$PORT` (default 3000).
- Database: PostgreSQL; apply `db/schema.sql` with `npm run migrate` before serving traffic.
- Health checks: `GET /health/live` verifies process liveness; `GET /health/ready` verifies database connectivity.
- CI: GitHub Actions workflow `.github/workflows/quality.yml` runs PostgreSQL-backed integration tests, syntax/contract checks, dependency audit, Compose validation, Docker build, and secret-pattern scanning.

## Required production environment

Configure these in the hosting provider's secret/environment settings. Never commit real values.

| Variable | Requirement |
| --- | --- |
| `DATABASE_URL` | Managed PostgreSQL connection string with TLS support |
| `DATABASE_SSL` | Set to `true` only when the provider's certificate chain is trusted by Node.js; do not disable certificate validation to silence errors |
| `JWT_SECRET` | Unique random secret of at least 32 bytes; never a sample or placeholder |
| `CORS_ORIGINS` | Exact HTTPS frontend origin(s), comma-separated; no wildcard |
| `FRONTEND_URL` | Public HTTPS frontend base URL used in account email links |
| `REQUIRE_EMAIL_VERIFICATION` | Keep `false` until SMTP is configured and delivery/recovery flows have been tested; then set `true` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | Real SMTP settings; use secret variables for credentials |
| `TRUST_PROXY` | Enable only behind a trusted reverse proxy |
| `DB_POOL_MAX` | Set according to the database connection limit |

Use `npm run migrate` as a controlled release step before the new application version accepts traffic. Do not run concurrent migration jobs from multiple application replicas.

## Hosting options and no-cost constraint

A static frontend can be hosted on Vercel or another static host. The API requires a Node/Docker-capable host and the PostgreSQL database must be reachable from it. These are separate services unless the chosen platform supports the full stack.

Render's free PostgreSQL databases have an expiry date and are not a durable production database. A free web service may sleep or have cold starts. Do not treat a temporary free database as safe for real user accounts, listings, messages, or moderation records. No paid resources should be created without explicit authorization. If no durable no-cost database is available, keep the public deployment in preview/staging mode and do not invite real users to store data.

No SkillChain deployment is considered live merely because a host project exists or a build succeeds. Record the actual frontend URL, API URL, database plan/expiry, deployed commit, and health-check results here only after independently verifying them.

## Release sequence

1. Confirm the intended branch head and latest PR checks; review the diff and outstanding PR conversations.
2. Configure a durable PostgreSQL database and backups; test a restore into a separate database.
3. Configure secrets and SMTP; verify account registration, verification email, expired/replayed token rejection, password recovery, and recovery email delivery.
4. Apply migrations once, deploy the API, and verify `/health/live` and `/health/ready` over HTTPS.
5. Deploy the static `web/` directory; set `apiBaseUrl` to the API origin and configure the API's exact `CORS_ORIGINS`.
6. Run browser end-to-end checks with separate member accounts: register/login, create/edit/archive a listing, send/accept/decline/cancel an exchange request, notifications/read state, reporting, admin moderation, account deletion, and legal pages. Confirm unauthorized users cannot access admin operations.
7. Check HTTPS, headers, rate limiting, logs/alerts, backup retention and restore, secret exposure, and privacy/terms wording. Conduct an independent security review before broad public launch.
8. Merge the reviewed PR only when required checks pass and release gates are satisfied; then verify the production deployment references the intended merge commit.

## Verification record

- Repository quality run: [GitHub Actions run 40758231879](https://github.com/yobi369/skill_sharing_platform/actions/runs/40758231879) — passed for commit `08a88812e5637f127b759da1a7910ab209ce53b0`.
- Public deployment: not yet verified.
- SMTP delivery: not yet configured/verified.
- Durable production database and backup/restore: not yet verified.
- External browser E2E and independent security review: outstanding.
