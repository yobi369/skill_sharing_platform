# Delivery Roadmap

This roadmap is an implementation plan, not a claim that these features already exist.

## M0 — Make the prototype honest and maintainable

- [x] Document the current repository and its demo-only behaviour.
- [x] Define security expectations and a target architecture.
- [x] Label simulated balances, transaction history, and marketplace metrics in the UI.
- [x] Remove misleading wallet, payment, AI-matching, blockchain-write, and live-statistics success claims.
- [x] Add zero-dependency contract tests and inline JavaScript syntax checks; improve navigation state semantics.

**Acceptance:** users can distinguish demo content from real account or network state; navigation and forms work without uncaught browser errors.

## M1 — Core marketplace

- [x] Implement registration/login with password hashing, expiring bearer tokens, and an API-connected frontend.
- [x] Add server-side skill CRUD with ownership checks and a frontend listing editor.
- [x] Add search, category filters, pagination, and safe empty/error states in the API-connected frontend.
- [x] Add skill requests with validated state transitions and a frontend request workflow.\n- [ ] Add notifications for request changes.
- [ ] Add moderation/reporting and account suspension controls.
- [ ] Add database migrations and automated integration tests.

**Acceptance:** the PostgreSQL-backed integration suite verifies two users, authentication, listing creation/discovery, blocked cross-owner edits, and provider-only acceptance. Hosting-level restart durability and backups still require environment-specific verification.

## M2 — Learning workflow and trust

- [ ] Add session scheduling, cancellation, completion, and feedback.
- [ ] Prevent duplicate or ineligible reviews.
- [ ] Add abuse prevention, rate limits, audit trails, and privacy controls.
- [ ] Add backup automation and demonstrate restore into a clean environment.

**Acceptance:** key workflows pass automated tests; backup restoration is documented and repeatable; sensitive actions are auditable.

## M3 — Operational readiness

- [ ] CI runs formatting/lint, tests, dependency checks, and build checks on pull requests.
- [ ] Add environment-specific configuration and secret handling.
- [ ] Add health/readiness checks, structured logs, error monitoring, and rollback instructions.
- [ ] Run accessibility, performance, and security reviews.
- [ ] Publish deployment, incident response, and data deletion procedures.

**Acceptance:** clean deployment from documented steps, passing required checks, verified restore, and no unresolved critical/high security findings.

## M4 — Optional payments / Web3

- [ ] Demonstrate a user need that requires payments or on-chain settlement.
- [ ] Threat-model custody, key management, disputes, refunds, fees, and irreversible transactions.
- [ ] Use a test network and independent smart-contract review before considering real funds.
- [ ] Obtain appropriate legal/compliance review for target jurisdictions.

**Acceptance:** no production funds are handled until contract, operational, legal, and recovery controls have been independently reviewed.
