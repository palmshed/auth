import { Auth, type AuthError } from "@palmshed/auth-core";
import type { Context, MiddlewareHandler } from "hono";

export type { Auth } from "@palmshed/auth-core";

export function requireAuth(): MiddlewareHandler {
  return async (c: Context, next) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    await next();
  };
}

export function requirePermission(resource: string, action: string): MiddlewareHandler {
  return async (c: Context, next) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const allowed = await c.get("auth").hasPermission(getToken(c), resource, action);
    if (!allowed) return c.json({ error: "Forbidden" }, 403);
    await next();
  };
}

export function middleware(auth: Auth): MiddlewareHandler {
  return async (c: Context, next) => {
    c.set("auth", auth);
    const token = getToken(c);
    if (token) {
      const result = await auth.getSession(token);
      if (result.success) {
        c.set("user", result.data.user);
        c.set("session", result.data.session);
        c.set("token", token);
      }
    }
    await next();
  };
}

export function createHandlers(auth: Auth) {
  const sendError = (c: Context, err: AuthError) =>
    c.json({ error: err.message }, err.status as 400 | 401 | 403 | 404 | 409 | 429 | 500);

  return {
    signIn: async (c: Context) => {
      const body = await c.req.json<{
        username?: string; password?: string; captcha?: string;
        deviceInfo?: { userAgent: string; platform?: string; device?: string; browser?: string; version?: string };
        ipAddress?: string;
      }>();
      const ip = body.ipAddress || c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "";
      const deviceInfo = body.deviceInfo ? {
        userAgent: body.deviceInfo.userAgent,
        platform: body.deviceInfo.platform ?? null,
        device: body.deviceInfo.device ?? null,
        browser: body.deviceInfo.browser ?? null,
        version: body.deviceInfo.version ?? null,
      } : undefined;
      const result = await auth.signIn({
        username: body.username || "",
        password: body.password || "",
        captcha: body.captcha,
        deviceInfo,
        ipAddress: ip,
      });
      if (!result.success) return sendError(c, result.error);
      return c.json({
        ok: true,
        token: result.data.token,
        refreshToken: result.data.refreshToken,
        expiresAt: result.data.expiresAt,
        user: result.data.user,
      }, 200);
    },

    signUp: async (c: Context) => {
      const body = await c.req.json<{ username?: string; password?: string; email?: string; captcha?: string }>();
      const result = await auth.signUp({ username: body.username || "", password: body.password || "", email: body.email, captcha: body.captcha });
      if (!result.success) return sendError(c, result.error);
      return c.json({ ok: true }, 201);
    },

    signOut: async (c: Context) => {
      const token = getToken(c);
      if (token) await auth.signOut(token);
      return c.json({ ok: true }, 200);
    },

    session: async (c: Context) => {
      const user = c.get("user");
      const session = c.get("session");
      if (!user) return c.json({ ok: false }, 200);
      return c.json({ ok: true, user, session }, 200);
    },

    refresh: async (c: Context) => {
      const body = await c.req.json<{ refreshToken?: string }>();
      const result = await auth.refreshSession(body.refreshToken || "");
      if (!result.success) return sendError(c, result.error);
      return c.json({
        ok: true,
        token: result.data.token,
        refreshToken: result.data.refreshToken,
      }, 200);
    },

    listSessions: async (c: Context) => {
      const token = getToken(c);
      if (!token) return c.json({ error: "Unauthorized" }, 401);
      const result = await auth.listSessions(token);
      if (!result.success) return sendError(c, result.error);
      return c.json({ ok: true, sessions: result.data }, 200);
    },

    revokeSessions: async (c: Context) => {
      const token = getToken(c);
      if (!token) return c.json({ error: "Unauthorized" }, 401);
      const result = await auth.revokeOtherSessions(token);
      if (!result.success) return sendError(c, result.error);
      return c.json({ ok: true }, 200);
    },

    checkPermission: async (c: Context) => {
      const token = getToken(c);
      const resource = c.req.param("resource");
      const action = c.req.param("action");
      if (!token || !resource || !action) return c.json({ ok: false }, 200);
      const allowed = await auth.hasPermission(token, resource, action);
      return c.json({ ok: allowed }, 200);
    },

    forgotPassword: async (c: Context) => {
      const body = await c.req.json<{ username?: string; captcha?: string }>();
      await auth.forgotPassword({ username: body.username || "", captcha: body.captcha });
      return c.json({ ok: true }, 200);
    },

    resetPassword: async (c: Context) => {
      const body = await c.req.json<{ token?: string; password?: string }>();
      const result = await auth.resetPassword({ token: body.token || "", password: body.password || "" });
      if (!result.success) return sendError(c, result.error);
      return c.json({ ok: true }, 200);
    },
  };
}

function getToken(c: Context): string {
  const authHeader = c.req.header("authorization") || "";
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1] as string;
  return "";
}
