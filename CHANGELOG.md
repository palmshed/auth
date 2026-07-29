# Changelog

## 1.0.0 (unreleased)

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
