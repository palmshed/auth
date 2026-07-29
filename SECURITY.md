# Security

## Cryptographic Primitives

- **Password hashing**: Argon2id via `@noble/hashes/argon2` with configurable memory cost, time cost, and parallelism.
- **Token signing**: HMAC-SHA256 with server-side signing keys. Tokens are verified on every request.
- **Random generation**: All random values use `crypto.randomBytes()` from Node.js or Web Crypto API.
- **Constant-time comparison**: Token signatures and verification use `crypto.timingSafeEqual()` to prevent timing attacks.

## Signing Keys

- Keys are generated on first use and stored in the database.
- Keys are rotated automatically based on `signingKeys.rotationInterval` (default 90 days).
- Multiple active keys are maintained simultaneously (default 2) to avoid invalidating active sessions during rotation.
- Old keys are deactivated after rotation and eventually cleaned up.

## Session Security

- Sessions have three timeouts: `expiresIn` (7d), `idleTimeout` (4h), `absoluteLifetime` (30d).
- Sessions can be revoked server-side.
- Concurrent session limits prevent session proliferation.
- Refresh tokens enable token rotation without re-authentication.

## Password Policy

- Minimum password length is configurable (default 8).
- Passwords are hashed with Argon2id before storage.
- Plaintext passwords are never stored or logged.

## Rate Limiting

- Rate limiting is applied to sign-in, sign-up, and password reset endpoints.
- Configurable max attempts per time window (default 10 per 15 minutes).
- In-memory rate limiter for development; Redis adapter for production.

## Captcha

- Optional captcha verification (hCaptcha, Turnstile) on sign-in, sign-up, and forgot-password.
- Captcha can be disabled in development.

## Best Practices

1. Always use HTTPS in production.
2. Set `ALLOWED_ORIGIN` to restrict CORS.
3. Use PostgreSQL or SQLite storage (not memory) in production.
4. Rotate signing keys regularly.
5. Monitor for failed authentication attempts.
6. Never commit `.env` files.
7. Keep `@noble/hashes` and other dependencies updated.
