# AGENTS.md

## Status

`palmshed/auth` is at **v1.0.0** (released and published to npm). The platform is in the adoption and maintenance phase.

## Stability policy

- Public APIs follow semantic versioning. Additions must be backward-compatible; breaking changes require a major version bump.
- The hosted service at `apps/server` exposes versioned routes under `/api/v1`. The `v1` contract is stable.
- Storage adapters implement the `AuthStorage` interface and run the same contract tests.

## Release gate

A version is released only when all of these hold:

1. Lint, unit tests, and builds pass (`npm run lint`, `npm test`, `npm run build`).
2. The Playwright E2E suite passes against a live deployment.
3. Documentation is updated (CHANGELOG, API reference, migration notes).

## Priorities

1. **Adoption**: migrate Palmshed projects onto `@palmshed/auth-client` and the hosted service.
2. **Compatibility**: keep the public API and the `/api/v1` contract stable.
3. **Maintenance**: fix bugs and security issues without expanding the API.

## Non-goals

- No new foundational features without a real adopter asking for them.
- No parallel authentication implementations in other repositories. Every Palmshed project either consumes the hosted service or embeds the published packages.
- No breaking changes to the v1 API.

## Project structure

```text
palmshed/auth
├── apps/server/           # Hosted auth service, deploys to Vercel
├── packages/
│   ├── core/              # Framework-agnostic auth engine
│   ├── client/            # Browser/Node.js client
│   ├── hono/              # Hono adapter (middleware + handlers)
│   ├── express/           # Express adapter (middleware + router)
│   ├── storage-postgres/  # PostgreSQL storage adapter
│   ├── storage-sqlite/    # SQLite storage adapter
│   └── storage-redis/     # Redis rate limiter adapter
├── examples/              # Reference integrations (use published packages)
├── e2e/                   # Playwright suite against the live site + backend
├── templates/fullstack/   # Production-ready full-stack reference app
└── docs/                  # Static HTML reference documentation
```

## Commands

```bash
npm install
npm run build        # compile all workspaces
npm test             # unit tests (56 tests across 8 files in core)
npm run lint         # tsc --noEmit across the monorepo
npm run test:e2e     # Playwright suite (see e2e/README.md)
npm run dev -w @palmshed/auth-server   # local API server
```

## Deployment

- The hosted service deploys to Vercel from `apps/server` (project root directory).
- Preview deployments sit behind SSO deployment protection; CI uses a Protection Bypass for Automation secret.
- Required environment variables are documented in `.env.example` and OPERATIONS.md.

## Captcha providers

- `CAPTCHA_PROVIDER` selects the provider: `none`, `hcaptcha`, or `turnstile`.
- Both providers share `CAPTCHA_SITE_KEY`/`CAPTCHA_SECRET`; Turnstile also accepts `TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET`.
- Frontend widget rendering is provider-aware and loads the correct script dynamically.
- hCaptcha has known Safari ITP incompatibilities (third-party storage isolation causes `api.hcaptcha.com/authenticate` to return 401 in WebKit); Turnstile is the recommended provider for Safari-heavy audiences.

## Releasing

1. Update package versions and `CHANGELOG.md`.
2. Open a PR, let CI run (lint, test, build, e2e, Vercel deploy).
3. Merge, then push an annotated tag `v<version>`.
4. The CI `publish` job publishes all packages with provenance on tag push.
5. Create a GitHub Release describing what shipped.

`NPM_TOKEN` lives in the repository secrets and is never written to files or chat.

## First consumer migration

The palmshed.github.io sign-in pages were the first consumer of the hosted service and `@palmshed/auth-client`. That migration is the reference for future adopters; see UPGRADING.md.
