import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Auth } from "@palmshed/auth-core";
import { middleware as authMiddleware, createHandlers } from "@palmshed/auth-hono";
import { PostgresStorage } from "@palmshed/auth-storage-postgres";
import { loadConfig } from "./config.js";
import { createPasswordResetSender } from "./email.js";

const config = loadConfig();

const storage = new PostgresStorage(config.storage.url);
await storage.migrate();

const emailSender = config.email.apiKey
  ? createPasswordResetSender(config.email.apiKey, config.email.from, `http://localhost:${config.port}`)
  : null;

const auth = new Auth({
  storage,
  config: config.auth,
  onPasswordReset: emailSender
    ? (email, token) => emailSender.sendPasswordReset(email, token)
    : undefined,
});

const app = new Hono();
const h = createHandlers(auth);

app.use("/*", cors({ origin: config.cors.origin, credentials: true }));
app.use("/api/*", authMiddleware(auth));

app.get("/api/v1/config", (c) =>
  c.json({
    captchaProvider: config.auth.captcha?.provider ?? "none",
    captchaSiteKey: config.auth.captcha?.siteKey ?? "",
    allowRegistration: true,
  }),
);

app.post("/api/v1/signup", h.signUp);
app.post("/api/v1/signin", h.signIn);
app.post("/api/v1/signout", h.signOut);
app.get("/api/v1/session", h.session);
app.post("/api/v1/refresh", h.refresh);
app.post("/api/v1/forgot-password", h.forgotPassword);
app.post("/api/v1/reset-password", h.resetPassword);

app.get("/assets/*", serveStatic({ root: "./client" }));
app.get("*", serveStatic({ path: "./client/index.html" }));

serve({ fetch: app.fetch, port: config.port });
console.log(`Server running on http://localhost:${config.port}`);
