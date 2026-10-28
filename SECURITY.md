# Security Policy

## Scope and current status

SkillChain is a prototype, not a production marketplace. The current HTML page is client-side and does not provide trustworthy identity, access control, durable records, payments, escrow, or on-chain guarantees. Do not submit real personal information, wallet secrets, payment details, or confidential work.

## Reporting a vulnerability

Please do not publish exploitable details in a public issue. Use GitHub's private vulnerability reporting feature for this repository if it is enabled. Otherwise, contact the repository maintainer privately through a verified channel listed on the maintainer's GitHub profile. Include affected path, impact, reproducible steps, and a safe proof of concept. Do not include other people's data.

## Required controls before production

- Server-side authentication and authorization with secure session/token handling.
- Input validation, output encoding, CSRF protection where applicable, and rate limiting.
- Secure secret management; no credentials or wallet private keys in client code or repository history.
- Dependency updates and automated security checks.
- Durable storage, backups, restore testing, and audit trails for sensitive actions.
- Privacy notice, data minimization, retention/deletion policy, and access controls.
- Independent review of any smart contracts and payment/escrow design before handling funds.
- Incident response and vulnerability disclosure process.

## Safe development

Use synthetic data and test networks only. Never test against systems you do not own or have explicit permission to assess. A passing static check is not a security audit.
