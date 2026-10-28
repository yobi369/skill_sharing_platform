# Security Policy

## Scope and current status

SkillChain now includes an initial Fastify API and PostgreSQL schema, but the product is not yet production-ready. The browser UI remains a disconnected prototype. Do not submit real personal information, wallet secrets, payment details, or confidential work through the demo.

## Reporting a vulnerability

Please do not publish exploitable details in a public issue. Use GitHub's private vulnerability reporting feature for this repository if it is enabled. Otherwise, contact the repository maintainer privately through a verified channel listed on the maintainer's GitHub profile. Include affected path, impact, reproducible steps, and a safe proof of concept. Do not include other people's data.

## Implemented baseline controls

- Passwords are hashed using bcrypt; plaintext passwords are not stored.
- Bearer tokens expire after one hour; authenticated requests check that the account remains active.
- Request bodies and route parameters are schema-validated with bounded lengths.
- SQL uses parameterized values; listing updates and deletes enforce ownership in the database query.
- Exchange request status transitions are restricted to the authorized participant and allowed state.
- Security headers and per-instance rate limits are enabled; auth routes have stricter limits.
- CORS is disabled by default and requires explicit `CORS_ORIGINS` allowlisting.
- Readiness checks confirm database connectivity; server errors do not return raw database messages.

These controls are an implementation baseline, not an independent security audit. Rate limits are in-memory/per-instance, and no distributed limiter is configured.

## Required before production

- Deploy behind HTTPS and use managed secret storage; rotate `JWT_SECRET` and database credentials.
- Use a least-privilege database role and TLS to the database where supported.
- Configure durable automated database backups and verify restoration into a clean environment.
- Add email verification, account recovery, moderation/reporting, abuse response, and account deletion/retention workflows.
- Connect the browser UI only after end-to-end authorization and error-state testing.
- Run dependency auditing, threat modelling, penetration testing, accessibility checks, and independent security review.
- Define a privacy notice, data minimization, retention/deletion policy, incident response, and vulnerability disclosure process.
- Independently review any smart contracts and payment/escrow design before handling funds.

## Safe development

Use synthetic data and test networks only. Never test against systems you do not own or have explicit permission to assess. A passing CI run is not a security audit or proof of production readiness.


## Account security operations

- Production deployments should configure SMTP and set `REQUIRE_EMAIL_VERIFICATION=true`; test delivery before enforcing this flag.
- Keep `FRONTEND_URL` on the exact trusted HTTPS origin/path used by the web client. Do not expose development verification or password-reset URLs.
- Password reset and verification tokens are random, time-limited, one-use values; only SHA-256 token hashes are stored.
- Admin promotion is an operator action restricted to active, email-verified accounts. Run it only from a trusted shell with a least-privilege database connection.
- Review reports before suspending users or archiving skills. Record a short moderator note for consequential actions.
