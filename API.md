# API Reference

## `@palmshed/auth-core`

### `Auth`

```ts
class Auth {
  constructor(options: AuthOptions);

  signUp(input: SignUpInput): Promise<AuthResponse<User>>;
  signIn(input: SignInInput): Promise<AuthResponse<{ user, session, token, refreshToken, expiresAt }>>;
  signOut(token: string): Promise<AuthResponse<void>>;
  getSession(signedToken: string): Promise<AuthResponse<AuthContext>>;
  refreshSession(refreshToken: string): Promise<AuthResponse<{ token, refreshToken, session }>>;
  revokeOtherSessions(token: string): Promise<AuthResponse<void>>;
  listSessions(token: string): Promise<AuthResponse<Session[]>>;
  forgotPassword(input: ForgotPasswordInput): Promise<AuthResponse<void>>;
  resetPassword(input: ResetPasswordInput): Promise<AuthResponse<void>>;
  hasPermission(token: string, resource: string, action: string): Promise<boolean>;
  subscribe(listener: AuthStateListener): () => void;
}
```

### `AuthOptions`

```ts
type AuthOptions = {
  storage: AuthStorage;         // required
  config?: Partial<AuthConfig>;  // optional overrides
  passwordHasher?: PasswordHasher;
  rateLimiter?: RateLimiter;
  captchaVerifier?: CaptchaVerifier;
};
```

### `AuthConfig`

| Path | Default | Description |
|------|---------|-------------|
| `session.expiresIn` | `604800000` (7d) | Session token TTL |
| `session.idleTimeout` | `14400000` (4h) | Inactivity timeout |
| `session.absoluteLifetime` | `2592000000` (30d) | Hard session maximum |
| `session.tokenLength` | `48` | Random token bytes |
| `session.refreshTokenLength` | `64` | Refresh token bytes |
| `session.maxConcurrentSessions` | `10` | Max simultaneous sessions |
| `session.extendOnActivity` | `true` | Reset idle timer on use |
| `password.minLength` | `8` | Minimum password length |
| `password.hashAlgorithm` | `"argon2id"` | Hash function |
| `password.hashParams` | `{ m: 19456, t: 2, p: 1 }` | Argon2id params |
| `token.resetExpiresIn` | `3600000` (1h) | Reset token TTL |
| `token.verifyExpiresIn` | `86400000` (24h) | Verify token TTL |
| `token.length` | `64` | Reset token bytes |
| `signingKeys.rotationInterval` | `7776000000` (90d) | Key rotation period |
| `signingKeys.activeKeys` | `2` | Active key count |
| `signingKeys.algorithm` | `"sha256"` | HMAC algorithm |
| `rateLimit.maxAttempts` | `10` | Max requests |
| `rateLimit.windowMs` | `900000` (15m) | Rate limit window |
| `captcha.provider` | `"none"` | Captcha provider |
| `rbac.defaultRole` | `"user"` | Default sign-up role |
| `rbac.defaultPermissions` | `[]` | Default permissions |

### `AuthStorage` (interface)

```ts
interface AuthStorage {
  // Users
  createUser(data: CreateUserData): Promise<User>;
  getUserByUsername(username: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserById(id: string): Promise<User | null>;
  getUserWithPassword(username: string): Promise<(User & { passwordHash, salt }) | null>;
  updateUserPassword(id: string, passwordHash: string, salt: string): Promise<void>;
  updateUser(id: string, data: Partial<User>): Promise<void>;
  verifyUserEmail(id: string): Promise<void>;
  listUsers(offset?: number, limit?: number): Promise<User[]>;

  // Sessions
  createSession(data: CreateSessionData): Promise<Session>;
  getSessionByToken(token: string): Promise<Session | null>;
  getSessionByRefreshToken(refreshToken: string): Promise<Session | null>;
  listUserSessions(userId: string): Promise<Session[]>;
  updateSessionActivity(token: string, lastActiveAt: Date): Promise<void>;
  revokeSession(token: string): Promise<void>;
  revokeUserSessions(userId: string, excludeToken?: string): Promise<void>;
  deleteSession(token: string): Promise<void>;
  deleteExpiredSessions(): Promise<number>;

  // Password resets
  createPasswordReset(userId: string, token: string, expiresAt: Date): Promise<PasswordReset>;
  getPasswordResetByToken(token: string): Promise<PasswordReset | null>;
  markPasswordResetUsed(token: string): Promise<void>;
  deleteExpiredPasswordResets(): Promise<number>;

  // Signing keys
  createSigningKey(data: { secret: string; algorithm: string }): Promise<SigningKey>;
  getActiveSigningKeys(): Promise<SigningKey[]>;
  getSigningKeyById(id: string): Promise<SigningKey | null>;
  rotateSigningKey(id: string): Promise<void>;
  deactivateSigningKey(id: string): Promise<void>;
}
```

### Utility functions

```ts
// Token crypto
generateSessionTokens(tokenLength: number, refreshTokenLength: number): { token: string; refreshToken: string };
generateResetToken(length?: number): string;
generateSecret(length?: number): string;
constantTimeEqual(a: string, b: string): boolean;
signToken(payload: string, secret: string, algorithm?: string): string;
verifySignedToken(token: string, signature: string, secret: string, algorithm?: string): boolean;
createSignedToken(plainToken: string, signingKey: SigningKey): { signedToken: string; signingKeyId: string };
parseSignedToken(signedToken: string): { signingKeyId: string; signature: string; plainToken: string } | null;

// Date utilities
createExpiry(msFromNow: number): Date;
isExpired(date: Date): boolean;

// RBAC
hasPermission(user: User, resource: string, action: string): boolean;
hasAllPermissions(user: User, checks: PermissionCheck[]): boolean;
hasAnyPermission(user: User, checks: PermissionCheck[]): boolean;
requirePermission(user: User, resource: string, action: string): void;

// Password
interface PasswordHasher {
  hash(password: string): Promise<{ hash: string; salt: string }>;
  verify(password: string, hash: string, salt: string): Promise<boolean>;
  needsRehash(hash: string): boolean;
}
```

## `@palmshed/auth-hono`

```ts
middleware(auth: Auth): MiddlewareHandler;
requireAuth(): MiddlewareHandler;
requirePermission(resource: string, action: string): MiddlewareHandler;
createHandlers(auth: Auth): { signIn, signUp, signOut, session, refresh, listSessions, revokeSessions, checkPermission, forgotPassword, resetPassword };
```

Context keys set by middleware: `auth`, `user`, `session`, `token`.

## `@palmshed/auth-express`

```ts
middleware(auth: Auth): RequestHandler;
requireAuth(): RequestHandler;
requirePermission(resource: string, action: string): RequestHandler;
createRouter(auth: Auth): Router;
```

Request properties set by middleware: `req.auth`, `req.user`, `req.session`, `req.authToken`.

## `@palmshed/auth-client`

```ts
class AuthClient {
  constructor(config: AuthClientConfig);
  getToken(): string | null;
  getRefreshToken(): string | null;
  clearTokens(): void;
  isAuthenticated(): boolean;
  get state(): AuthState;
  addInterceptor(interceptor): () => void;
  signIn(username, password, options?): Promise<AuthResponse>;
  signUp(username, password, email?, options?): Promise<AuthResponse>;
  signOut(options?): Promise<AuthResponse>;
  getSession(options?): Promise<AuthResponse>;
  refreshToken(): Promise<AuthResponse>;
}
```
