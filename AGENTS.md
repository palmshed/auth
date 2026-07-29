# AGENTS.md

## Project Structure

```text
palmshed/auth
├── apps/
│   └── server/          # Deployed authentication service (Vercel)
├── packages/
│   ├── core/            # Framework-agnostic auth engine
│   ├── client/          # Browser/Node.js client
│   ├── hono/            # Hono adapter (middleware + handlers)
│   ├── express/         # Express adapter (middleware + router)
│   ├── storage-postgres/# PostgreSQL storage adapter
│   ├── storage-sqlite/  # SQLite storage adapter
│   └── storage-redis/   # Redis rate limiter adapter
├── examples/            # Example integrations
└── templates/           # Production-ready templates
```

## Build

```bash
npm install
npm run build
```

## Test

```bash
# Run all tests
npm test

# Run specific package tests
npm test -w packages/core

# Watch mode
npm test -w packages/core -- --watch
```

## Dev Server

```bash
# Start the auth API server locally
npm run dev -w @palmshed/auth-server
```

## Test Coverage

- **Core**: 56 tests across 8 test files
  - `auth.test.ts` (13) — main auth flow
  - `auth-security.test.ts` (6) — token forgery, expiry, revocation, disabled users
  - `auth-concurrency.test.ts` (3) — concurrent signups/signins
  - `auth-edge.test.ts` (10) — edge cases, empty/very long values
  - `crypto.test.ts` (9) — signing, constant-time, token parsing
  - `rbac.test.ts` (7) — permissions, roles, wildcards
  - `rate-limit.test.ts` (4) — rate limiter behavior
  - `token.test.ts` (4) — token generation and expiry

## Storage Adapter Contract

All storage adapters must implement `AuthStorage` interface. The memory storage serves as the reference implementation. To validate a new adapter:

1. Implement `AuthStorage` interface
2. Run existing auth tests against it
3. Verify all session, user, signing key, and password reset operations

## Release Process

This repository stays at `v1.0.0-rc.1` until the library is validated in a production application.

### Gate: v1.0.0

Publish only after **all** of the following are complete:

1. **First Consumer** — One existing Palmshed project is migrated to `palmshed/auth`. Its local authentication implementation is removed. Sign up, sign in, sign out, session restore, password reset, RBAC, and token refresh all work. No library changes are required during migration.

2. **Examples** — Each runs with `npm install && npm run dev` and includes a short README:
   - `examples/hono`
   - `examples/express`
   - `examples/react`
   - `examples/nextjs`

3. **Templates** — Each is production-ready (not a demo):
   - `templates/hono-auth`
   - `templates/express-auth`
   - `templates/react-auth`
   - `templates/next-auth`

4. **Documentation** — Present at the repo root:
   - CONTRIBUTING.md
   - CODE_OF_CONDUCT.md
   - LICENSE (MIT)
   - SUPPORT.md
   - SECURITY.md (with vulnerability reporting policy)
   - Version compatibility matrix
   - Upgrade guide

5. **Release Validation** — Install the published packages in a clean repository; confirm no internal path dependencies, ESM/CJS compatibility, tree shaking, and generated type declarations; smoke test exactly as users will consume.

### When gated steps pass

1. Update version in `package.json` (drop `-rc.X`)
2. Run `npm test` — all must pass
3. Run `npm run build` — all packages must compile
4. Create GitHub release with semantic version tag
5. Publish to npm with `--provenance`
