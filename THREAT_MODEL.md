# Threat Model

## Assets Protected

1. **User credentials** — passwords, password hashes, salt values
2. **Session tokens** — authentication tokens and refresh tokens
3. **Signing keys** — server-side HMAC keys used to sign tokens
4. **User data** — profile information, email addresses
5. **Password reset tokens** — one-time tokens for password recovery

## Threat Scenarios

| Threat | Mitigation |
|--------|-----------|
| **Token theft** (session hijacking) | Signed tokens verified server-side; short expiration; idle timeout; device metadata tracking; server revocation capability |
| **Token forgery** | HMAC-SHA256 signatures with per-request verification; signing keys stored in database only |
| **Password brute force** | Argon2id (memory-hard); rate limiting on sign-in; captcha |
| **Timing attack on verification** | `crypto.timingSafeEqual()` for all comparison operations |
| **Signing key compromise** | Key rotation; limited active keys; old keys deactivated |
| **Database compromise** | Passwords hashed with Argon2id (not reversible); signing key secret encrypted at rest |
| **CSRF** | Bearer token in Authorization header (not cookies); client manages token |
| **XSS token theft** | Token stored in localStorage (not accessible to HTTP-only cookies is better — consider httpOnly cookies for browser apps) |
| **Privilege escalation** | RBAC enforced server-side on every request; permission check middleware |
| **Session fixation** | New token generated on each sign-in; refresh token rotation |
| **Replay attack** | Session tokens expire; refresh tokens single-use with rotation |
| **Enumeration** | Forgot-password always returns success regardless of whether user exists |
| **Concurrent session abuse** | Configurable max concurrent sessions; session revocation endpoint |

## Assumptions

1. The server environment is trusted (no malicious access to process memory).
2. TLS/HTTPS is used in production.
3. The database is accessed with least-privilege credentials.
4. Application code does not log tokens, passwords, or secrets.
