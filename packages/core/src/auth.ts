import type { AuthStorage, CreateSessionData } from "./storage/interface.js";
import type { AuthConfig } from "./config.js";
import type {
  User,
  Session,
  AuthContext,
  SignInInput,
  SignUpInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  AuthResponse,
  TokenPair,
  AuthStateChange,
  AuthStateListener,
} from "./types.js";
import { AuthError } from "./types.js";
import { resolveConfig } from "./config.js";
import { errors } from "./errors.js";
import { Argon2idHasher, type PasswordHasher } from "./password.js";
import { createExpiry, isExpired } from "./token.js";
import { generateSessionTokens, createSignedToken, parseSignedToken, verifySignedToken } from "./crypto.js";
import { SigningKeyManager } from "./signing.js";
import type { RateLimiter } from "./rate-limit.js";
import { MemoryRateLimiter } from "./rate-limit.js";
import { hasPermission } from "./rbac.js";

export interface CaptchaVerifier {
  verify(token: string): Promise<boolean>;
}

export class HcaptchaVerifier implements CaptchaVerifier {
  constructor(private secret: string) {}
  async verify(token: string): Promise<boolean> {
    if (!token) return false;
    try {
      const res = await fetch("https://api.hcaptcha.com/siteverify", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret: this.secret, response: token }).toString(),
      });
      const data = (await res.json()) as { success?: boolean };
      return Boolean(data.success);
    } catch {
      return false;
    }
  }
}

export class TurnstileVerifier implements CaptchaVerifier {
  constructor(private secret: string) {}
  async verify(token: string): Promise<boolean> {
    if (!token) return false;
    try {
      const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret: this.secret, response: token }).toString(),
      });
      const data = (await res.json()) as { success?: boolean };
      return Boolean(data.success);
    } catch {
      return false;
    }
  }
}

export type AuthOptions = {
  storage: AuthStorage;
  config?: Partial<AuthConfig>;
  passwordHasher?: PasswordHasher;
  rateLimiter?: RateLimiter;
  captchaVerifier?: CaptchaVerifier;
  onPasswordReset?: (email: string, token: string) => Promise<void>;
};

export class Auth {
  private storage: AuthStorage;
  private config: AuthConfig;
  private passwordHasher: PasswordHasher;
  private rateLimiter: RateLimiter;
  private captchaVerifier: CaptchaVerifier | null;
  private signingKeys: SigningKeyManager;
  private listeners: AuthStateListener[] = [];
  private onPasswordReset?: (email: string, token: string) => Promise<void>;

  constructor(options: AuthOptions) {
    this.storage = options.storage;
    this.config = resolveConfig(options.config);
    this.passwordHasher = options.passwordHasher || new Argon2idHasher(this.config.password.hashParams);
    this.rateLimiter = options.rateLimiter || new MemoryRateLimiter(this.config.rateLimit.maxAttempts, this.config.rateLimit.windowMs);
    this.signingKeys = new SigningKeyManager(this.storage, this.config);
    this.onPasswordReset = options.onPasswordReset;
    if (this.config.captcha.provider === "hcaptcha" && this.config.captcha.secret) {
      this.captchaVerifier = new HcaptchaVerifier(this.config.captcha.secret);
    } else if (this.config.captcha.provider === "turnstile" && this.config.captcha.secret) {
      this.captchaVerifier = new TurnstileVerifier(this.config.captcha.secret);
    } else {
      this.captchaVerifier = null;
    }
  }

  subscribe(listener: AuthStateListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(change: AuthStateChange): void {
    for (const listener of this.listeners) {
      try { listener(change); } catch { /* noop */ }
    }
  }

  async signUp(input: SignUpInput): Promise<AuthResponse<User>> {
    try {
      if (!input.username || !input.password) return { success: false, error: errors.missingFields() };
      if (input.password.length < this.config.password.minLength) {
        return { success: false, error: errors.passwordTooShort(this.config.password.minLength) };
      }
      const captchaOk = await this.verifyCaptcha(input.captcha);
      if (!captchaOk) return { success: false, error: errors.captchaFailed() };

      const existing = await this.storage.getUserByUsername(input.username);
      if (existing) return { success: false, error: errors.usernameTaken() };

      const rateKey = `signup:${input.username}`;
      const allowed = await this.rateLimiter.check(rateKey);
      if (!allowed) return { success: false, error: errors.rateLimited() };

      const { hash, salt } = await this.passwordHasher.hash(input.password);
      const user = await this.storage.createUser({
        username: input.username,
        passwordHash: hash,
        salt,
        email: input.email || null,
        role: this.config.rbac.defaultRole,
        permissions: this.config.rbac.defaultPermissions,
      });
      await this.rateLimiter.reset(rateKey);
      return { success: true, data: user };
    } catch (err) {
      if (err instanceof AuthError) return { success: false, error: err };
      return { success: false, error: errors.internal() };
    }
  }

  async signIn(input: SignInInput): Promise<AuthResponse<{ user: User; session: Session; token: string; refreshToken: string; expiresAt: Date }>> {
    try {
      if (!input.username || !input.password) return { success: false, error: errors.missingFields() };
      const captchaOk = await this.verifyCaptcha(input.captcha);
      if (!captchaOk) return { success: false, error: errors.captchaFailed() };

      const rateKey = `signin:${input.username}`;
      const allowed = await this.rateLimiter.check(rateKey);
      if (!allowed) return { success: false, error: errors.rateLimited() };

      const userWithPw = await this.storage.getUserWithPassword(input.username);
      if (!userWithPw) return { success: false, error: errors.invalidCredentials() };
      if (userWithPw.disabled) return { success: false, error: errors.unauthorized() };

      const valid = await this.passwordHasher.verify(input.password, userWithPw.passwordHash, userWithPw.salt);
      if (!valid) return { success: false, error: errors.invalidCredentials() };

      const { token, refreshToken } = generateSessionTokens(
        this.config.session.tokenLength,
        this.config.session.refreshTokenLength,
      );
      const signingKey = await this.signingKeys.getActiveKey();
      const { signedToken } = createSignedToken(token, signingKey);

      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.config.session.expiresIn);
      const idleExpiresAt = new Date(now.getTime() + this.config.session.idleTimeout);
      const absoluteExpiresAt = new Date(now.getTime() + this.config.session.absoluteLifetime);

      const sessionData: CreateSessionData = {
        userId: userWithPw.id,
        token: signedToken,
        refreshToken,
        signingKeyId: signingKey.id,
        deviceInfo: input.deviceInfo || null,
        ipAddress: input.ipAddress || null,
        expiresAt,
        idleExpiresAt,
        absoluteExpiresAt,
      };

      const session = await this.storage.createSession({
        ...sessionData,
        token: token, // store plain token in DB
      });

      await this.enforceMaxSessions(userWithPw.id, signedToken);

      const user = await this.storage.getUserById(userWithPw.id);
      if (!user) return { success: false, error: errors.userNotFound() };

      await this.rateLimiter.reset(rateKey);

      this.notify({ type: "signed-in", user, session });

      return {
        success: true,
        data: { user, session, token: signedToken, refreshToken, expiresAt },
      };
    } catch (err) {
      if (err instanceof AuthError) return { success: false, error: err };
      return { success: false, error: errors.internal() };
    }
  }

  async signOut(token: string): Promise<AuthResponse<void>> {
    try {
      if (!token) return { success: false, error: errors.unauthorized() };
      const parsed = parseSignedToken(token);
      const plainToken = parsed ? parsed.plainToken : token;
      await this.storage.deleteSession(plainToken);
      this.notify({ type: "signed-out" });
      return { success: true, data: undefined };
    } catch {
      return { success: false, error: errors.internal() };
    }
  }

  async getSession(signedToken: string): Promise<AuthResponse<AuthContext>> {
    try {
      if (!signedToken) return { success: false, error: errors.unauthorized() };
      const parsed = parseSignedToken(signedToken);
      if (!parsed) return { success: false, error: errors.invalidToken() };
      const { signingKeyId, signature, plainToken } = parsed;

      const signingKey = await this.signingKeys.getKeyById(signingKeyId);
      if (!signingKey) return { success: false, error: errors.invalidToken() };

      if (!verifySignedToken(plainToken, signature, signingKey.secret, signingKey.algorithm)) {
        return { success: false, error: errors.invalidToken() };
      }

      const session = await this.storage.getSessionByToken(plainToken);
      if (!session || session.revokedAt) {
        if (session) await this.storage.deleteSession(plainToken);
        this.notify({ type: "session-expired" });
        return { success: false, error: errors.sessionExpired() };
      }

      const now = new Date();
      if (session.absoluteExpiresAt <= now || session.expiresAt <= now) {
        await this.storage.deleteSession(plainToken);
        this.notify({ type: "session-expired" });
        return { success: false, error: errors.sessionExpired() };
      }

      if (session.idleExpiresAt <= now) {
        await this.storage.deleteSession(plainToken);
        this.notify({ type: "session-expired" });
        return { success: false, error: errors.sessionExpired() };
      }

      if (this.config.session.extendOnActivity) {
        const newIdle = new Date(now.getTime() + this.config.session.idleTimeout);
        await this.storage.updateSessionActivity(plainToken, now);
      }

      const user = await this.storage.getUserById(session.userId);
      if (!user) return { success: false, error: errors.userNotFound() };
      if (user.disabled) return { success: false, error: errors.unauthorized() };

      return { success: true, data: { user, session } };
    } catch (err) {
      if (err instanceof AuthError) return { success: false, error: err };
      return { success: false, error: errors.internal() };
    }
  }

  async refreshSession(refreshToken: string): Promise<AuthResponse<{ token: string; refreshToken: string; session: Session }>> {
    try {
      if (!refreshToken) return { success: false, error: errors.unauthorized() };
      const session = await this.storage.getSessionByRefreshToken(refreshToken);
      if (!session || session.revokedAt) {
        return { success: false, error: errors.sessionExpired() };
      }

      const now = new Date();
      if (session.absoluteExpiresAt <= now) {
        await this.storage.deleteSession(session.token);
        return { success: false, error: errors.sessionExpired() };
      }

      const { token: newToken, refreshToken: newRefreshToken } = generateSessionTokens(
        this.config.session.tokenLength,
        this.config.session.refreshTokenLength,
      );
      const signingKey = await this.signingKeys.getActiveKey();
      const { signedToken } = createSignedToken(newToken, signingKey);

      const expiresAt = new Date(now.getTime() + this.config.session.expiresIn);
      const idleExpiresAt = new Date(now.getTime() + this.config.session.idleTimeout);

      await this.storage.deleteSession(session.token);

      const sessionData: CreateSessionData = {
        userId: session.userId,
        token: signedToken,
        refreshToken: newRefreshToken,
        signingKeyId: signingKey.id,
        deviceInfo: session.deviceInfo,
        ipAddress: session.ipAddress,
        expiresAt,
        idleExpiresAt,
        absoluteExpiresAt: session.absoluteExpiresAt,
      };

      const newSession = await this.storage.createSession(sessionData);
      this.notify({ type: "session-refreshed", session: newSession });

      return { success: true, data: { token: signedToken, refreshToken: newRefreshToken, session: newSession } };
    } catch (err) {
      if (err instanceof AuthError) return { success: false, error: err };
      return { success: false, error: errors.internal() };
    }
  }

  async revokeOtherSessions(token: string): Promise<AuthResponse<void>> {
    try {
      const parsed = parseSignedToken(token);
      const plainToken = parsed ? parsed.plainToken : token;
      const session = await this.storage.getSessionByToken(plainToken);
      if (!session) return { success: false, error: errors.unauthorized() };
      await this.storage.revokeUserSessions(session.userId, plainToken);
      return { success: true, data: undefined };
    } catch {
      return { success: false, error: errors.internal() };
    }
  }

  async listSessions(token: string): Promise<AuthResponse<Session[]>> {
    try {
      const parsed = parseSignedToken(token);
      const plainToken = parsed ? parsed.plainToken : token;
      const session = await this.storage.getSessionByToken(plainToken);
      if (!session) return { success: false, error: errors.unauthorized() };
      const sessions = await this.storage.listUserSessions(session.userId);
      return { success: true, data: sessions };
    } catch {
      return { success: false, error: errors.internal() };
    }
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<AuthResponse<void>> {
    try {
      if (!input.username) return { success: false, error: errors.missingFields() };
      const captchaOk = await this.verifyCaptcha(input.captcha);
      if (!captchaOk) return { success: false, error: errors.captchaFailed() };

      const user = await this.storage.getUserByUsername(input.username);
      if (!user || !user.email) {
        return { success: true, data: undefined };
      }

      const { generateResetToken } = await import("./token.js");
      const token = generateResetToken(this.config.token.length);
      const expiresAt = createExpiry(this.config.token.resetExpiresIn);
      await this.storage.createPasswordReset(user.id, token, expiresAt);
      await this.onPasswordReset?.(user.email, token);
      return { success: true, data: undefined };
    } catch {
      return { success: false, error: errors.internal() };
    }
  }

  async resetPassword(input: ResetPasswordInput): Promise<AuthResponse<void>> {
    try {
      if (!input.token || !input.password) return { success: false, error: errors.missingFields() };
      if (input.password.length < this.config.password.minLength) {
        return { success: false, error: errors.passwordTooShort(this.config.password.minLength) };
      }
      const reset = await this.storage.getPasswordResetByToken(input.token);
      if (!reset || reset.used || isExpired(reset.expiresAt)) {
        return { success: false, error: errors.invalidToken() };
      }
      const { hash, salt } = await this.passwordHasher.hash(input.password);
      await this.storage.updateUserPassword(reset.userId, hash, salt);
      await this.storage.markPasswordResetUsed(input.token);
      await this.storage.revokeUserSessions(reset.userId);
      return { success: true, data: undefined };
    } catch {
      return { success: false, error: errors.internal() };
    }
  }

  async hasPermission(token: string, resource: string, action: string): Promise<boolean> {
    const result = await this.getSession(token);
    if (!result.success) return false;
    return hasPermission(result.data.user, resource, action);
  }

  private async enforceMaxSessions(userId: string, newToken: string): Promise<void> {
    const max = this.config.session.maxConcurrentSessions;
    if (max <= 0) return;
    const sessions = await this.storage.listUserSessions(userId);
    const active = sessions.filter((s) => !s.revokedAt && s.expiresAt > new Date());
    if (active.length > max) {
      const toRemove = active.slice(0, active.length - max);
      for (const s of toRemove) {
        await this.storage.revokeSession(s.token);
      }
    }
  }

  private async verifyCaptcha(token?: string): Promise<boolean> {
    if (!this.captchaVerifier) return true;
    if (!token) return false;
    return this.captchaVerifier.verify(token);
  }
}
