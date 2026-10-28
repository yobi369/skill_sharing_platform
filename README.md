# SkillChain — Skill Sharing Platform

SkillChain is a prototype for a peer-to-peer skill-sharing marketplace: people can publish skills, discover collaborators, and organize learning or paid work. The current repository contains a standalone HTML/CSS/JavaScript interface and a product-documentation PDF.

> **Project status: prototype, not production-ready.** The interface contains sample marketplace metrics and illustrative activity. The UI now explicitly labels these as demo-only, and payment, transaction-hash, wallet, and smart-contract success paths are disabled. Nothing is connected to a wallet, blockchain, database, authentication provider, payment processor, or live marketplace.

## Current contents

- `skill_sharing_platform.html` — single-page UI prototype.
- `SkillChain - Product Documentation.pdf` — existing product concept document.

## Run locally

No build step is currently required.

1. Clone this repository.
2. Open `skill_sharing_platform.html` in a modern browser, or serve the repository with a static HTTP server.
3. Treat all displayed activity and account information as demo content.

For example, with Python installed:

```bash
python -m http.server 8000
```

Then open http://localhost:8000/skill_sharing_platform.html.

## Product direction

The long-term product should make skill exchange useful even without crypto: profiles, skill listings, discovery, requests, learning sessions, feedback, and clear dispute/reporting flows. Blockchain, escrow, or token features should be introduced only after the core marketplace has reliable identity, authorization, persistence, threat modelling, and legal review.

See:
- [Architecture and target boundaries](docs/ARCHITECTURE.md)
- [Security and privacy baseline](SECURITY.md)
- [Delivery roadmap and acceptance criteria](docs/ROADMAP.md)

## Engineering principles

- Never present mock data as live activity or verified transactions.
- Never store secrets, private keys, seed phrases, or credentials in browser code or Git.
- Treat all client input as untrusted and enforce authorization on the server.
- Use accessible, responsive UI patterns and clear loading, empty, success, and error states.
- Add tests and CI before representing a change as verified.
- Prefer a simple, auditable architecture over blockchain or AI features that do not solve a demonstrated user need.

## Production readiness

The repository is currently a front-end prototype. There is no verified backend, durable database, authentication, real wallet integration, smart contract, deployment pipeline, or end-to-end test suite in the inspected baseline. Do not use it for real payments, escrow, personal data, or production users until the roadmap's release gates are met.

## Contributing

Please include the user problem, implementation notes, test evidence, security/privacy impact, and any configuration changes in pull requests. Keep demo-only behaviour explicitly labelled and avoid adding real credentials or fabricated metrics.
