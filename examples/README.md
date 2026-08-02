# Examples

Reference integrations that use the published `@palmshed/auth` packages. Each
example is a minimal, runnable application. For a complete production
application, see `templates/fullstack`.

- [Express](express/) - Express server with `@palmshed/auth-express` and
  SQLite storage. Exposes the auth routes plus a protected admin endpoint.
- [Hono](hono/) - Hono server with `@palmshed/auth-hono` and SQLite storage.
  The same shape as the hosted service.
- [React](react/) - Vite + React app using `@palmshed/auth-client` for
  sign-in, registration, and session state.

All examples keep configuration in code for brevity. In production, read the
database URL, captcha keys, and other secrets from environment variables, as
`templates/fullstack` does.

## Run an example

```bash
# Express
cd examples/express
npm install
npm start

# Hono
cd examples/hono
npm install
npm start

# React (points at a server on localhost:3000)
cd examples/react
npm install
npm run dev
```

The Express and Hono examples create a local SQLite file (`auth.db`) on first
run. Delete it to reset.
