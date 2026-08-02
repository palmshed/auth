# palmshed/auth

Authentication platform for Palmshed projects.

**Status: v1.0.0 released.** All packages are published to npm and the hosted service runs at https://palmshed-auth.vercel.app. The public API follows semantic versioning.

- [Architecture](ARCHITECTURE.md)
- [API reference](API.md)
- [Security](SECURITY.md)
- [Threat model](THREAT_MODEL.md)
- [Operations](OPERATIONS.md)
- [Upgrading to `@palmshed/auth-client`](UPGRADING.md)

## Packages

| Package | Description |
|---------|-------------|
| `@palmshed/auth-core` | Framework-agnostic authentication engine |
| `@palmshed/auth-hono` | Hono middleware and route handlers |
| `@palmshed/auth-express` | Express middleware and router |
| `@palmshed/auth-client` | Browser/Node.js client library |
| `@palmshed/auth-storage-postgres` | PostgreSQL storage adapter |
| `@palmshed/auth-storage-sqlite` | SQLite storage adapter |
| `@palmshed/auth-storage-redis` | Redis rate limiter adapter |

## Quick Start

```ts
import { Auth, MemoryStorage } from "@palmshed/auth-core";

const auth = new Auth({
  storage: new MemoryStorage(),
  config: {
    captcha: { provider: "none" },
  },
});

// Sign up
await auth.signUp({ username: "alice", password: "securepassword" });

// Sign in
const result = await auth.signIn({ username: "alice", password: "securepassword" });
// result.data.token is the signed session token
```

## Usage with Hono

```ts
import { Auth, MemoryStorage } from "@palmshed/auth-core";
import { middleware, createHandlers } from "@palmshed/auth-hono";
import { Hono } from "hono";

const auth = new Auth({ storage: new MemoryStorage() });
const app = new Hono();

app.use("*", middleware(auth));
const h = createHandlers(auth);

app.post("/api/signin", h.signIn);
app.post("/api/signup", h.signUp);
app.post("/api/signout", h.signOut);
app.get("/api/session", h.session);
app.post("/api/refresh", h.refresh);
app.get("/api/sessions", h.listSessions);
```

## Usage with Express

```ts
import { Auth, MemoryStorage } from "@palmshed/auth-core";
import { middleware, createRouter } from "@palmshed/auth-express";
import express from "express";

const auth = new Auth({ storage: new MemoryStorage() });
const app = express();

app.use(express.json());
app.use(middleware(auth));
app.use("/api/auth", createRouter(auth));
```

## Environment Variables

See `.env.example` for full documentation. Never commit `.env` to version control.

## Development

```bash
git clone https://github.com/palmshed/auth
cd auth
npm install
npm test
```
