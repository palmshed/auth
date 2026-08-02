# Operations

This document covers deployment, configuration, secrets, publishing, testing, and recovery for the `palmshed/auth` platform.

## Hosted service

- **Production URL**: https://palmshed-auth.vercel.app
- **Deployment**: Vercel project `palmshed-auth` (org `palmshed`), project root directory `apps/server`.
- **Runtime**: Node 24.x. The service is built from the `apps/server` workspace and deploys automatically from the `main` branch and pull requests.
- **Database**: Neon PostgreSQL. Tables live in the `auth` schema, created by the storage adapter migration.

Deploying from the Vercel CLI:

```bash
vercel link --yes --team palmshed --project palmshed-auth
vercel pull --yes --environment=production
vercel build
vercel deploy --prod
```

The project root directory is `apps/server`, but all Vercel CLI commands run from the repository root.

## Environment variables

Required for production, documented in `.env.example`:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (Neon, schema `auth`) |
| `CAPTCHA_PROVIDER` | `hcaptcha`, `turnstile`, or `none` |
| `CAPTCHA_SITE_KEY` | Captcha site key (`HCAPTCHA_SITE_KEY` is accepted as a fallback) |
| `CAPTCHA_SECRET` | Captcha secret; required when `CAPTCHA_PROVIDER` is not `none` |
| `RESEND_API_KEY` | Resend API key for password reset emails |
| `RESEND_FROM` | Sender address for password reset emails |
| `ALLOWED_ORIGIN` | CORS origin for the site, `https://palmshed.github.io` |

Optional overrides (defaults in `apps/server/src/config.ts`):

| Variable | Default |
|----------|---------|
| `SESSION_EXPIRES_IN` | `604800000` (7d) |
| `SESSION_IDLE_TIMEOUT` | `14400000` (4h) |
| `SESSION_ABSOLUTE_LIFETIME` | `2592000000` (30d) |
| `MAX_CONCURRENT_SESSIONS` | `10` |
| `RATE_LIMIT_MAX_ATTEMPTS` | `10` |
| `RATE_LIMIT_WINDOW_MS` | `900000` (15m) |

## Secrets

Sensitive values are injected through environment variables or the Vercel dashboard. Never hardcode them, and never commit `.env` files.

- Production custom vars (`CAPTCHA_PROVIDER`, `HCAPTCHA_SITE_KEY`, `CAPTCHA_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, `ALLOWED_ORIGIN`) are stored as `type: "sensitive"` project environment variables. They are masked in the dashboard and not decryptable via the API.
- PostgreSQL vars are stored as `type: "encrypted"` and can be pulled with `vercel env pull`.
- A public `GET /api/v1/config` endpoint reports only the captcha provider and site key — never secrets.

### Rotating the npm token

`NPM_TOKEN` is an npm **Automation** token stored as a GitHub Actions secret on `palmshed/auth` (never in a file or chat).

1. In npmjs.com → Access Tokens, create a new Automation token.
2. Update the `NPM_TOKEN` secret at github.com/palmshed/auth → Settings → Secrets and variables → Actions.
3. Revoke the old token.
4. If the token was ever exposed in chat or a log, treat it as compromised and rotate immediately.

Publishing with provenance requires npm 2FA enabled and a verified GitHub identity on the publishing account.

## Release process

1. Bump package versions and update `CHANGELOG.md`.
2. Open a pull request. CI runs lint, unit tests, build, and the E2E suite against a preview deployment.
3. Merge, then push an annotated tag:

   ```bash
   git tag -a v<version> -m "v<version>"
   git push origin v<version>
   ```

4. The CI `publish` job runs `npm publish --workspaces --provenance --access public` on tag push and publishes all seven `@palmshed/auth-*` packages.
5. Create a GitHub Release (`gh release create v<version>`) with notes summarizing what shipped.

If `publish` fails with `ENEEDAUTH`, the `NPM_TOKEN` secret is missing or stale; re-run the job after fixing it. The tag and GitHub Release remain valid.

## End-to-end tests

The Playwright suite (`e2e/`) exercises the real static site against the real backend the way a user would: register, sign in, sign out, session sync across tabs, forgot password, and the reset journey.

- **Local runs** need `BASE_URL`, `API_BASE_URL`, `CAPTCHA_PROVIDER=none`, and (for the reset journey) `DATABASE_URL`. See `e2e/README.md`.
- **CI** runs the suite against a captcha-free Vercel preview deployment. Preview deployments sit behind SSO deployment protection, so the workflow uses a **Protection Bypass for Automation** secret sent as the `x-vercel-protection-bypass` header. The `e2e` Playwright config adds this header automatically when `VERCEL_AUTOMATION_BYPASS_SECRET` is set.
- Do not send `x-vercel-set-bypass-cookie: true`; it breaks CORS preflight in the browser.

Secrets used by the workflow: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `DATABASE_URL`, `VERCEL_AUTOMATION_BYPASS_SECRET`.

## Recovery procedures

- **Rollback a bad deployment**: in the Vercel dashboard, promote a previous healthy production deployment.
- **Reset a lost user password**: generate a reset token directly in the `auth.password_resets` table (as the E2E suite does) and open the `/reset-password?token=...` link, or delete the account if it cannot be recovered.
- **Revoke a compromised session set**: remove rows from `auth.sessions` for the affected user, or delete the user (FK cascade cleans up sessions and resets).
- **Rotate signing keys**: the server rotates signing keys automatically; old keys are deactivated. To force a full rotation, delete `auth.signing_keys` rows after confirming active sessions can be reissued.
- **Clean up test accounts**: delete rows from `auth.users` matching the E2E username prefixes (`forgot-`, `login-`, `reg-`, `reset-`, `sess-`, `wrong-`, `verify-`). Use `SELECT` first, then `DELETE`.
- **Backups**: the database lives in Neon; enable point-in-time backups there. The application stores no data outside the database.
