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
