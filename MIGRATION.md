# Migration Guide

Migrating from an ad hoc authentication implementation to `palmshed/auth`.

## Step 1: Replace password hashing

**Before:**
```ts
import { randomBytes, scrypt } from "node:crypto";
// manual salt + hash management
```

**After:**
```ts
import { Auth, MemoryStorage, Argon2idHasher } from "@palmshed/auth-core";

const auth = new Auth({
  storage: yourStorageAdapter,
  passwordHasher: new Argon2idHasher({ m: 19456, t: 2, p: 1 }),
  config: { captcha: { provider: "none" } },
});
```

## Step 2: Replace session management

**Before:** Manual token generation, cookie management, session maps.

**After:**
```ts
// Sign in
const result = await auth.signIn({ username, password });
// result.data.token — HMAC-signed session token
// result.data.refreshToken — for token refresh

// Validate session
const session = await auth.getSession(token);

// Sign out
await auth.signOut(token);
```

## Step 3: Replace authorization logic

**Before:**
```ts
if (user.role !== "admin") return res.status(403);
```

**After:**
```ts
import { hasPermission } from "@palmshed/auth-core";

if (!hasPermission(user, "posts", "delete")) return res.status(403);
```

## Step 4: Add storage

Replace in-memory storage with PostgreSQL for production:
```ts
import { PostgresStorage } from "@palmshed/auth-storage-postgres";
const storage = new PostgresStorage(process.env.DATABASE_URL);
await storage.migrate();
```

## Step 5: Add route protection

**Express:**
```ts
import { middleware, requireAuth, requirePermission } from "@palmshed/auth-express";
app.use(middleware(auth));
app.get("/api/admin", requireAuth(), requirePermission("admin", "panel"), handler);
```

**Hono:**
```ts
import { middleware, requireAuth, requirePermission } from "@palmshed/auth-hono";
app.use("*", middleware(auth));
app.get("/api/admin", requireAuth(), requirePermission("admin", "panel"), handler);
```

## Breaking Changes from v0.x

- `generateToken` renamed to `generateResetToken`.
- `errors as errorCodes` alias removed — use `errors` directly.
- `SigningKeyManager` is now internal (not exported from index).
- Express `createRouter` now returns `Router` (not `RequestHandler`).
- Client `refreshToken()` now returns `AuthResponse` instead of `boolean`.
- Session tokens are now HMAC-signed; tokens issued by v0.x will be rejected.
