# Contributing

## Development Setup

```bash
git clone https://github.com/palmshed/auth
cd auth
npm install
```

## Local Development

Run the hosted service locally with a captcha-free config:

```bash
CAPTCHA_PROVIDER=none \
ALLOWED_ORIGIN=http://127.0.0.1:8080 \
DATABASE_URL=:memory: \
npm run dev -w @palmshed/auth-server
```

The server listens on `http://localhost:3000` by default. Point `@palmshed/auth-client` at it during development.

## Testing

```bash
# Full suite
npm test

# Single package
npm run test -w packages/core -- --run

# Watch mode
npm run test -w packages/core -- --watch

# Typecheck
npm run lint
```

### End-to-end tests

The Playwright suite (`e2e/`) exercises the real site against the real backend. Run it locally against a captcha-free preview deployment:

```bash
BASE_URL=https://palmshed.github.io \
API_BASE_URL=https://<preview>.vercel.app \
CAPTCHA_PROVIDER=none \
DATABASE_URL=postgres://... \
npm run test:e2e
```

See `e2e/README.md` for the fully-local and production-captcha modes.

## Package Structure

- `packages/core` — No production dependencies beyond `@noble/hashes`. Should remain minimal.
- `packages/hono` — Depends only on `hono` and `@palmshed/auth-core`.
- `packages/express` — Depends only on `express` (peer) and `@palmshed/auth-core`.
- `packages/client` — Zero dependencies. Works in any ES2022 environment.
- `packages/storage-*` — Each has one database driver dependency.

## Adding a Storage Adapter

1. Create `packages/storage-<name>` with `package.json` and `tsconfig.json`.
2. Implement the `AuthStorage` interface.
3. Add a `migrate()` method that creates the schema.
4. Use `crypto.randomUUID()` for primary keys.
5. Run the contract tests against your adapter.

## API Stability

The public API is frozen for v1.x. Additions must be backward-compatible. Breaking changes require a major version bump.

## Release Process

1. Bump package versions and update `CHANGELOG.md`.
2. Open a PR; CI runs lint, test, build, and E2E.
3. Merge, push an annotated tag `v<version>`.
4. CI publishes all packages to npm on tag push.
5. Create a GitHub Release. See OPERATIONS.md for the full procedure.

## Before Submitting

- [ ] Tests pass (`npm test`)
- [ ] TypeScript compiles (`npm run lint`)
- [ ] E2E suite passes when the change affects a live flow
- [ ] No new dependencies unless necessary
- [ ] Public API changes documented in API.md
- [ ] Migration/upgrade guide updated if behavior changed
