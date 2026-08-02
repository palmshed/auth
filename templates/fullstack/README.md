# Full-stack template

A production-ready reference application for `@palmshed/auth`. The server is a
Hono app with the published auth packages and PostgreSQL storage. The client is
a pair of static pages that use `@palmshed/auth-client` (vendored into
`client/assets/auth-client.js`).

This template mirrors the hosted service at `palmshed-auth.vercel.app`. Use it
as a starting point when you want to embed auth in your own application
instead of pointing at the hosted service.

## Layout

```text
fullstack/
├── server/
│   └── src/
│       ├── index.ts    # Hono app: CORS, auth routes, static client
│       ├── config.ts   # env-backed configuration
│       └── email.ts    # optional Resend password-reset sender
├── client/
│   ├── index.html      # sign-in / register / signed-in state
│   ├── reset-password.html
│   └── assets/auth-client.js
├── .env.example
└── package.json
```

## Setup

```bash
npm install
cp .env.example .env        # then set DATABASE_URL
npm run dev                 # http://localhost:3000
```

On first start the server creates the schema in the `auth` schema of your
Postgres database. Use a database you own; the template never stores secrets in
the repository.

## Configuration

All settings come from environment variables. See `.env.example` for the full
list. The essentials:

- `DATABASE_URL` - Postgres connection string.
- `CAPTCHA_PROVIDER` - `none`, `hcaptcha`, or `turnstile`. When set to `hcaptcha` or `turnstile`, the bundled client pages render the corresponding widget. Set `CAPTCHA_SITE_KEY` (or `TURNSTILE_SITE_KEY`) and `CAPTCHA_SECRET` (or `TURNSTILE_SECRET`) accordingly.
- `ALLOWED_ORIGIN` - origin allowed to call the API cross-origin.
- `RESEND_API_KEY` / `RESEND_FROM` - optional; enables password-reset email.

## API

The server exposes the versioned routes under `/api/v1`:

- `POST /api/v1/signup`
- `POST /api/v1/signin`
- `POST /api/v1/signout`
- `GET /api/v1/session`
- `POST /api/v1/refresh`
- `POST /api/v1/forgot-password`
- `POST /api/v1/reset-password`
- `GET /api/v1/config`

## Client

The pages construct `AuthClient` with `baseUrl: window.location.origin`, so the
client talks to the same server that serves it. No CORS setup is needed when
served this way. The vendored `auth-client.js` is the published
`@palmshed/auth-client` build; refresh it when a new version ships.

## Deployment

The app is a standard Node server. Build it and run `npm start` on any host
that can reach your Postgres database, or adapt `server/src/index.ts` to
deploy `app.fetch` as a serverless function (as the hosted service does on
Vercel). Never commit `DATABASE_URL` or captcha secrets; inject them through
the platform.
