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

Publish only after **all** phases are complete.

#### Phase 1: Deploy

- Create the Vercel project from `apps/server`
- Configure all required environment variables
- Verify the health endpoint and every authentication endpoint
- Enable production logging and error reporting

#### Phase 2: First Consumer

- Migrate one Palmshed application to use the hosted authentication service
- Remove its local authentication implementation
- Do not add compatibility code to the application. If migration exposes friction, improve `palmshed/auth` instead

#### Phase 3: Validation

- Verify sign up, sign in, sign out, session restore, refresh, password reset, RBAC, and concurrent sessions
- Verify deployment from a clean clone
- Verify local development and production behave consistently

#### Phase 4: Release

- If the migration succeeds without API changes, tag `v1.0.0`
- Publish the packages
- Announce `palmshed/auth` as the standard authentication platform for the organization

### After the gate

No new authentication implementations should be created in individual repositories. Every project should either:

- consume the hosted service (`apps/server`), or
- embed the published packages when self-hosting is required.

`palmshed/auth` is the single source of truth for authentication across the Palmshed ecosystem. Future work should focus on adoption, maintenance, and incremental improvements rather than creating parallel implementations.
