# Architecture

## Current implementation (observed baseline)

The repository currently contains a single HTML file with embedded CSS and JavaScript plus a product-documentation PDF. UI behaviour and state are implemented in the browser. Some interface elements and handlers simulate matching, task applications, wallet balance, transactions, and blockchain events.

Those simulations are not connected to real services and must not be interpreted as proof of a transaction, identity, payment, or network activity.

## Current API implementation (feature branch)

The API milestone adds a Node.js 20+ Fastify service and PostgreSQL schema in `src/server.js` and `db/schema.sql`. Implemented endpoints cover registration/login, current-user lookup, public skill discovery, authenticated skill CRUD, exchange requests, request status transitions, and liveness/readiness checks. Passwords are hashed with bcrypt; bearer tokens expire after one hour; request bodies are schema-validated; auth endpoints have tighter rate limits; SQL queries are parameterized; and skill changes require owner identity. Request transitions are constrained to pending -> accepted/declined by the provider or pending -> cancelled by the requester.

Run `npm install`, configure `DATABASE_URL` and a `JWT_SECRET` of at least 32 bytes, then run `npm run migrate` and `npm start`. Set `DATABASE_SSL=true` for a TLS PostgreSQL connection where required. The API integration test uses a real PostgreSQL database and is skipped when `DATABASE_URL` is absent.

This is a functional API milestone, not a production launch: the standalone HTML UI is not yet wired to the API; deployment, real backup/restore, external security review, moderation/reporting, notifications, account recovery, email verification, and privacy/data-retention decisions remain open. Configure TLS at the hosting edge, rotate secrets, and use managed database backups before handling real users.

## Recommended target architecture

Keep the first production milestone deliberately small:

1. **Web client** — responsive, accessible pages for profile, skill listings, search, requests, sessions, and feedback.
2. **Application API** — validates every request, applies authorization, enforces business rules, and emits structured audit events.
3. **Relational database** — durable users, skills, availability, requests, sessions, consent, reports, and feedback with migrations and backups.
4. **Identity** — trusted authentication provider or hardened server-side identity implementation; roles and ownership enforced server-side.
5. **Notifications** — asynchronous email/in-app notifications with retry and abuse controls.
6. **Operations** — CI, dependency/security checks, health checks, structured logs without secrets, monitoring, backup/restore drills.

## Core data model candidates

- User: stable ID, display name, privacy settings, status, created/updated timestamps.
- Skill: owner ID, title, description, category, proficiency/experience claims, visibility, status.
- Skill request: requester ID, provider ID, learning goal, proposed schedule, status and timestamps.
- Session: participants, agreed time, status, outcome and cancellation reason.
- Feedback: session ID, author ID, recipient ID, rating and moderation status.
- Report: reporter, target, reason, status, restricted access and audit history.

Define unique constraints and state transitions explicitly. A user must not be able to alter another user's records by changing an ID in a request. Feedback should be tied to a completed, eligible session to reduce fabricated reviews.

## Trust boundaries

- Browser input is untrusted.
- The API is the enforcement boundary, not the UI.
- Database credentials and provider secrets remain server-side.
- Third-party callbacks/webhooks require signature verification and replay protection.
- Blockchain data, if ever introduced, is public and irreversible; do not put personal data or private content on-chain.

## Decisions to make before implementation

Choose the hosting platform, authentication model, database, data-retention rules, moderation workflow, and whether payments are actually necessary. Blockchain and AI matching are optional product decisions, not prerequisites for a useful skill-sharing service.
