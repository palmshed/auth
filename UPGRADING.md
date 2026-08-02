# Upgrading to `@palmshed/auth-client`

This guide is for Palmshed applications migrating to the hosted authentication
service and the `@palmshed/auth-client` package. It replaces hand-written
`fetch()` calls with a single `AuthClient` instance.

## Why

- The client owns token storage, refresh, and request interceptors, so application
  code stops duplicating that logic.
- The hosted service enforces captcha, rate limiting, Argon2id hashing, and
  session expiry server-side. The application should not reimplement any of it.
- A single auth implementation across the organization means one codebase to
  maintain and one contract to upgrade.

## 1. Replace manual fetch calls

**Before** (legacy site):

```ts
const token = localStorage.getItem("session");
const res = await fetch("https://palmshed-auth.vercel.app/api/v1/signin", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username, password, captcha }),
  mode: "cors",
});
const data = await res.json();
if (data.ok && data.token) localStorage.setItem("session", data.token);
```

**After**:

```ts
import { AuthClient } from "@palmshed/auth-client";

const auth = new AuthClient({ baseUrl: "https://palmshed-auth.vercel.app" });

const result = await auth.signIn(username, password, { captcha });
if (result.ok) {
  // auth now holds the token; result.data.user is the signed-in user
}
```

The client stores tokens under the same `session` key, so existing session checks
that read `localStorage.getItem("session")` keep working.

## 2. Available client methods

| Method | HTTP route | Notes |
|--------|------------|-------|
| `signIn(username, password, options?)` | `POST /api/v1/signin` | Stores tokens on success |
| `signUp(username, password, email?, options?)` | `POST /api/v1/signup` | |
| `signOut(options?)` | `POST /api/v1/signout` | Clears tokens regardless of result |
| `getSession(options?)` | `GET /api/v1/session` | Validates the stored token, refreshes on 401 |
| `getConfig(options?)` | `GET /api/v1/config` | Captcha provider/site key |
| `forgotPassword(username, options?)` | `POST /api/v1/forgot-password` | Requires captcha in production |
| `resetPassword(token, password, options?)` | `POST /api/v1/reset-password` | |
| `refreshToken()` | `POST /api/v1/refresh` | Called automatically on 401 |

`options` may carry `captcha` and an `AbortSignal`. The client always sends an
`Authorization: Bearer` header when a token is present and retries once through
`/api/v1/refresh` on a 401 before failing.

## 3. Environment and configuration

The site is static (GitHub Pages) and the API is a separate origin (Vercel), so:

- Configure `AuthClient` with `baseUrl` set to the deployed service URL
  (`https://palmshed-auth.vercel.app`).
- The service must allow the site's origin in `ALLOWED_ORIGIN`, and its CORS
  configuration must allow the `content-type` and `authorization` headers.
- Captcha site keys are fetched at runtime from `GET /api/v1/config`, never
  hardcoded, so the widget renders the real key in production.
- The static site loads the published package from a CDN (e.g. jsdelivr) with a
  pinned version, or vendors the built `dist/index.js`.

## 4. Common pitfalls

- **Forgetting captcha in production.** `signIn`, `signUp`, and
  `forgotPassword` send `captcha` in the request body. When the service
  enforces hCaptcha, requests without a valid response are rejected. Render the
  widget using the site key from `getConfig()`, and reset it after a failure.
- **Mutating the shared client.** Create one `AuthClient` per app; do not
  construct a new instance per render.
- **Direct `localStorage` writes.** Let the client own token storage. Reading
  the `session` key for redirect checks is fine; writing it is not.
- **Blocking on network.** Pass an `AbortSignal` with a timeout for user-facing
  actions so the UI never hangs.
- **Test accounts.** The E2E suite creates accounts with `login-`, `reg-`,
  `forgot-`, `reset-`, `sess-`, and `wrong-` prefixes. Clean them from the
  `auth.users` table after runs.

## 5. Rollback

The migration is additive:

- The legacy `auth/` implementation can remain deployed alongside the hosted
  service during a transition window; nothing in the hosted service depends on it.
- If a rollout fails, revert the site to the previous commit. Session tokens are
  already signed by the hosted service, so reverting the client does not
  invalidate active sessions.
- To invalidate everything at once, delete the affected users or sessions in the
  `auth` schema (see OPERATIONS.md).
