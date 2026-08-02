# Changelog

## Unreleased

### Added
- `templates/fullstack`: production-ready reference application (Hono + Postgres server, sign-in and reset-password pages using `@palmshed/auth-client`).
- `docs/`: static HTML reference documentation (setup, configuration, client, server, storage, API, migration, deployment, troubleshooting).
- `examples/`: README covering the Express, Hono, and React examples; the React example is now a runnable Vite app.
- Turnstile captcha provider support alongside hCaptcha. `CAPTCHA_PROVIDER=turnstile` enables Cloudflare Turnstile verification; `CAPTCHA_PROVIDER=hcaptcha` keeps the existing behavior. Both providers share the same `CAPTCHA_SITE_KEY`/`CAPTCHA_SECRET` env var names (with `TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET` as aliases). Frontend widget rendering is provider-aware and loads the correct script dynamically.

## 1.1.0 (2026-08-02)

### Added
- `AuthClient.forgotPassword(username)` and `AuthClient.resetPassword(token, password)` methods, so client applications no longer need raw `fetch()` calls for the password recovery flow.

## 1.0.0 (2026-08-02)

### Features
- Argon2id password hashing via `@noble/hashes`
- HMAC-signed session tokens with automatic signing key rotation
- Three-tier session expiry: standard, idle timeout, absolute lifetime
- Device metadata tracking for sessions
- RBAC with string-based permissions (`resource:action`)
- Captcha verification (hCaptcha, Turnstile)
- Rate limiting (memory and Redis)
- Password reset flow

### Packages
- `@palmshed/auth-core` — framework-agnostic authentication engine
- `@palmshed/auth-hono` — Hono adapter with middleware and handlers
- `@palmshed/auth-express` — Express adapter with middleware and router
- `@palmshed/auth-client` — Browser/Node.js client with auto-refresh
- `@palmshed/auth-storage-postgres` — PostgreSQL storage adapter
- `@palmshed/auth-storage-sqlite` — SQLite storage adapter
- `@palmshed/auth-storage-redis` — Redis rate limiter adapter

### Migration from v0.x
See MIGRATION.md for breaking changes from earlier versions.
