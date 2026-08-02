import { Hono } from "hono";
import { cors } from "hono/cors";
import { Auth } from "@palmshed/auth-core";
import { middleware as authMiddleware, createHandlers } from "@palmshed/auth-hono";
import { loadConfig } from "./config.js";
import { createStorage } from "./storage.js";
import { ResendEmailSender } from "./email.js";

export async function buildApp() {
  const config = loadConfig();
  const { storage, close } = await createStorage(config.storage.url);

  const emailSender = config.email.apiKey
    ? new ResendEmailSender(config.email.apiKey, config.email.from, config.cors.origin)
    : null;

  const auth = new Auth({
    storage,
    config: config.auth,
    onPasswordReset: emailSender
      ? async (email, token) => emailSender.sendPasswordReset(email, token)
      : undefined,
  });

  const app = new Hono();
  const h = createHandlers(auth);

  app.use("/*", cors({ origin: config.cors.origin, credentials: true }));
  app.use("/*", authMiddleware(auth));

  const publicConfig = (c: import("hono").Context) =>
    c.json({
      captchaProvider: config.auth.captcha?.provider ?? "none",
      captchaSiteKey: config.auth.captcha?.siteKey ?? "",
      allowRegistration: true,
    });

  app.get("/api/v1/config", publicConfig);
  app.get("/api/config", publicConfig);

  app.post("/api/v1/signup", h.signUp);
  app.post("/api/v1/signin", h.signIn);
  app.post("/api/v1/signout", h.signOut);
  app.get("/api/v1/session", h.session);
  app.get("/api/v1/me", h.session);
  app.post("/api/v1/refresh", h.refresh);
  app.post("/api/v1/forgot-password", h.forgotPassword);
  app.post("/api/v1/reset-password", h.resetPassword);

  app.post("/signup", h.signUp);
  app.post("/signin", h.signIn);
  app.post("/signout", h.signOut);
  app.get("/session", h.session);
  app.post("/refresh", h.refresh);
  app.post("/forgot-password", h.forgotPassword);
  app.post("/reset-password", h.resetPassword);
  app.get("/me", h.session);

  return { app, close };
}
