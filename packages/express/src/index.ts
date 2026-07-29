import { Auth, type AuthError } from "@palmshed/auth-core";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { Router } from "express";

export type { Auth } from "@palmshed/auth-core";

export function middleware(auth: Auth): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    (req as unknown as Record<string, unknown>).auth = auth;
    const token = getToken(req);
    if (token) {
      const result = await auth.getSession(token);
      if (result.success) {
        (req as unknown as Record<string, unknown>).user = result.data.user;
        (req as unknown as Record<string, unknown>).session = result.data.session;
        (req as unknown as Record<string, unknown>).authToken = token;
      }
    }
    next();
  };
}

export function requireAuth(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!(req as unknown as Record<string, unknown>).user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  };
}

export function requirePermission(resource: string, action: string): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as unknown as Record<string, unknown>).user as { permissions?: string[]; role?: string } | undefined;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const auth = (req as unknown as Record<string, unknown>).auth as Auth;
    const token = getToken(req);
    const allowed = await auth.hasPermission(token, resource, action);
    if (!allowed) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export function createRouter(auth: Auth): Router {
  const router = Router();

  const sendError = (res: Response, err: AuthError) =>
    res.status(err.status).json({ error: err.message });

  router.post("/signin", async (req: Request, res: Response) => {
    const ip = req.body.ipAddress || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
    const result = await auth.signIn({
      username: req.body.username || "",
      password: req.body.password || "",
      captcha: req.body.captcha,
      deviceInfo: req.body.deviceInfo,
      ipAddress: ip as string,
    });
    if (!result.success) return sendError(res, result.error);
    res.json({
      ok: true, token: result.data.token, refreshToken: result.data.refreshToken,
      expiresAt: result.data.expiresAt, user: result.data.user,
    });
  });

  router.post("/signup", async (req: Request, res: Response) => {
    const result = await auth.signUp({ username: req.body.username || "", password: req.body.password || "", email: req.body.email, captcha: req.body.captcha });
    if (!result.success) return sendError(res, result.error);
    res.status(201).json({ ok: true });
  });

  router.post("/signout", async (req: Request, res: Response) => {
    const token = getToken(req);
    if (token) await auth.signOut(token);
    res.json({ ok: true });
  });

  router.get("/session", (req: Request, res: Response) => {
    const user = (req as unknown as Record<string, unknown>).user;
    const session = (req as unknown as Record<string, unknown>).session;
    if (!user) return res.json({ ok: false });
    res.json({ ok: true, user, session });
  });

  router.post("/refresh", async (req: Request, res: Response) => {
    const result = await auth.refreshSession(req.body.refreshToken || "");
    if (!result.success) return sendError(res, result.error);
    res.json({ ok: true, token: result.data.token, refreshToken: result.data.refreshToken });
  });

  router.get("/sessions", async (req: Request, res: Response) => {
    const token = getToken(req);
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const result = await auth.listSessions(token);
    if (!result.success) return sendError(res, result.error);
    res.json({ ok: true, sessions: result.data });
  });

  router.post("/sessions/revoke", async (req: Request, res: Response) => {
    const token = getToken(req);
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const result = await auth.revokeOtherSessions(token);
    if (!result.success) return sendError(res, result.error);
    res.json({ ok: true });
  });

  router.post("/forgot-password", async (req: Request, res: Response) => {
    await auth.forgotPassword({ username: req.body.username || "", captcha: req.body.captcha });
    res.json({ ok: true });
  });

  router.post("/reset-password", async (req: Request, res: Response) => {
    const result = await auth.resetPassword({ token: req.body.token || "", password: req.body.password || "" });
    if (!result.success) return sendError(res, result.error);
    res.json({ ok: true });
  });

  return router;
}

function getToken(req: Request): string {
  const authHeader = req.headers.authorization || "";
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1] as string;
  return "";
}
