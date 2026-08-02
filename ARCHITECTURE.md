# Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Client Layer                      │
│  @palmshed/auth-client (Browser/Node)                │
│  - Token storage in localStorage                     │
│  - Automatic token refresh                           │
│  - Request interceptors                              │
│  - Auth state subscriptions                          │
└─────────────────────┬───────────────────────────────┘
                      │ HTTP/JSON
┌─────────────────────▼───────────────────────────────┐
│              Adapter Layer (server)                   │
│  @palmshed/auth-hono   @palmshed/auth-express        │
│  - Middleware (session injection)                     │
│  - Route handlers (signin, signup, etc.)             │
│  - Permission middleware                              │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│                 Core Engine                           │
│  @palmshed/auth-core                                  │
│                                                       │
│  Auth class:                                          │
│  ┌─────────────────────────────────────────────────┐ │
│  │ signIn / signUp / signOut                       │ │
│  │ getSession / refreshSession                     │ │
│  │ forgotPassword / resetPassword                  │ │
│  │ listSessions / revokeOtherSessions              │ │
│  │ hasPermission                                   │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  Subsystems:                                          │
│  ┌────────────┐ ┌──────────┐ ┌────────────────────┐  │
│  │ Password   │ │ Token    │ │ SigningKeyManager   │  │
│  │ Hasher     │ │ Crypto   │ │ (key rotation)      │  │
│  │ (Argon2id) │ │ (HMAC)   │ └────────────────────┘  │
│  └────────────┘ └──────────┘ ┌────────────────────┐  │
│  ┌────────────┐ ┌──────────┐ │ RBAC               │  │
│  │ Rate       │ │ Captcha  │ │ (roles/permissions) │  │
│  │ Limiter    │ │ Verifier │ └────────────────────┘  │
│  └────────────┘ └──────────┘                         │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│              Storage Layer                            │
│  AuthStorage interface:                               │
│  ┌─────────────────────────────────────────────────┐ │
│  │ MemoryStorage (testing only)                    │ │
│  │ PostgresStorage (production)                    │ │
│  │ SqliteStorage (development/single-server)       │ │
│  │ RedisRateLimiter (scaling)                      │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Key Design Decisions

1. **Signed tokens**: Session tokens are HMAC-signed with rotating server-side signing keys. The client never sees the raw signing key — only the signed token.

2. **Storage interface**: All storage operations go through `AuthStorage`. This lets you swap databases without changing application code.

3. **Token refresh**: Short-lived session tokens with longer-lived refresh tokens. Refresh tokens can be rotated on each use (refresh token rotation).

4. **Session hierarchy**: Three timeouts — `expiresIn` (standard session), `idleTimeout` (inactivity expiry), `absoluteLifetime` (hard maximum). Combined with device metadata for audit.

5. **RBAC**: Simple string-based permissions (`resource:action`). Admins bypass all checks. Custom roles map to permission sets.

## Hosted Service

`apps/server` wires the core engine, a storage adapter, and the Hono adapter into a deployable HTTP service.

- Built with Hono; deploys to Vercel with the project root directory set to `apps/server`.
- Versioned routes live under `/api/v1` (signup, signin, signout, session, refresh, forgot-password, reset-password, config). Unversioned aliases are kept for backward compatibility.
- Configuration is read from environment variables at boot (see OPERATIONS.md). No secrets are hardcoded.
- A public `GET /api/v1/config` endpoint reports the captcha provider and site key so client pages can render the right widget.

Consumers use the hosted service by pointing `@palmshed/auth-client` at its URL, or embed the published packages when self-hosting is required.
