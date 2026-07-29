import { Auth } from "@palmshed/auth-core";
import { SqliteStorage } from "@palmshed/auth-storage-sqlite";
import { middleware, requireAuth, requirePermission, createHandlers } from "@palmshed/auth-hono";
import { Hono } from "hono";
import { serve } from "@hono/node-server";

const storage = new SqliteStorage("auth.db");
const auth = new Auth({ storage, config: { captcha: { provider: "none" } } });
const app = new Hono();

app.use("*", middleware(auth));
const h = createHandlers(auth);

app.post("/api/signin", h.signIn);
app.post("/api/signup", h.signUp);
app.post("/api/signout", h.signOut);
app.get("/api/session", h.session);
app.post("/api/refresh", h.refresh);
app.get("/api/sessions", requireAuth(), h.listSessions);
app.post("/api/sessions/revoke", requireAuth(), h.revokeSessions);
app.post("/api/forgot-password", h.forgotPassword);
app.post("/api/reset-password", h.resetPassword);

app.get("/api/admin", requireAuth(), requirePermission("admin", "panel"), (c) => {
  return c.json({ ok: true, message: "Admin access granted" });
});

console.log("Server running on http://localhost:3000");
serve({ fetch: app.fetch, port: 3000 });
