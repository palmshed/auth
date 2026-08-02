# E2E tests

Browser end-to-end tests for the Palmshed auth flows. They exercise the real
static site (GitHub Pages) against the real auth backend (Vercel) the same way
a user would: register, sign in, sign out, session sync across tabs, forgot
password, and the reset-password journey.

## What is covered

| Spec                           | Journey                                                  | Source script                             |
| ------------------------------ | -------------------------------------------------------- | ----------------------------------------- |
| `auth/register.spec.ts`        | Create account from the sign-in page                     | `01-register.js`                          |
| `auth/login.spec.ts`           | Sign in, redirect to homepage, session in `localStorage` | `02-login.js`                             |
| `auth/wrong-password.spec.ts`  | Wrong password shows "Invalid credentials"               | `04-wrong-password.js`                    |
| `auth/session.spec.ts`         | Cross-tab session + sign-out, invalid-session redirect   | `03-session-tabs.js`, `client-session.js` |
| `auth/forgot-password.spec.ts` | Forgot-password request                                  | `05-forgot-password.js`                   |
| `auth/reset-password.spec.ts`  | Missing/fake token rejection + full reset journey        | `reset-page.js`, `06-reset-journey.js`    |

## Running locally

```sh
npm ci
npx playwright install chromium
```

Then pick an environment.

### Against a captcha-free preview (recommended)

The site hardcodes `AUTH_BASE_URL = https://palmshed-auth.vercel.app`. When
`API_BASE_URL` differs from that, the tests rewrite those API calls
automatically, so the live site can be tested against a preview deployment.

```sh
BASE_URL=https://palmshed.github.io \
API_BASE_URL=https://<preview>.vercel.app \
CAPTCHA_PROVIDER=none \
DATABASE_URL=postgres://... \
npm run test:e2e
```

`DATABASE_URL` is only required by the reset-password journey, which seeds a
reset token directly in the `auth.password_resets` table (email is not
deliverable in the Resend sandbox).

### Fully local (site + API on localhost)

Serve the site directory from the palmshed.github.io repo and run the API with
`CAPTCHA_PROVIDER=none`:

```sh
# terminal 1: API
cd apps/server
CAPTCHA_PROVIDER=none \
ALLOWED_ORIGIN=http://127.0.0.1:8080 \
DATABASE_URL=postgres://... \
npx tsx src/dev.ts

# terminal 2: static site
cd <palmshed.github.io>/.github/site
python3 -m http.server 8080 --bind 127.0.0.1

# terminal 3: tests
BASE_URL=http://127.0.0.1:8080 \
API_BASE_URL=http://127.0.0.1:3000 \
CAPTCHA_PROVIDER=none \
DATABASE_URL=postgres://... \
npm run test:e2e
```

### Against production (captcha required)

Production enforces hCaptcha, which the tests cannot solve automatically. Set
`CAPTCHA_PROVIDER=hcaptcha` and run headed; a human must solve each widget:

```sh
CAPTCHA_PROVIDER=hcaptcha HEADED=1 npm run test:e2e
```

Tests that need an automated account setup are skipped in this mode.

## Notes

- Account names are unique per run (`<prefix>-<timestamp>-<rand>`), so runs do
  not collide and signup/signin rate limits are not shared.
- The captcha is stubbed in-browser (`window.hcaptcha.getResponse() ->
"__e2e__"`) only when `CAPTCHA_PROVIDER=none`; the server skips verification
  in that mode too.
- Reset tokens are 128-hex and inserted directly into `auth.password_resets`
  with a 60-minute expiry, then verified as consumed after the journey.
