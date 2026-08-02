import type { AuthConfig } from "@palmshed/auth-core";

export type AppConfig = {
  port: number;
  auth: Partial<AuthConfig>;
  storage: { url: string };
  cors: { origin: string };
  email: { apiKey: string; from: string };
};

function env(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

export function loadConfig(): AppConfig {
  const captchaProvider = env("CAPTCHA_PROVIDER", "none") as "hcaptcha" | "turnstile" | "none";

  return {
    port: Number(env("PORT", "3000")),
    auth: {
      session: {
        expiresIn: Number(env("SESSION_EXPIRES_IN", String(7 * 24 * 60 * 60 * 1000))),
        idleTimeout: Number(env("SESSION_IDLE_TIMEOUT", String(4 * 60 * 60 * 1000))),
        absoluteLifetime: Number(env("SESSION_ABSOLUTE_LIFETIME", String(30 * 24 * 60 * 60 * 1000))),
        maxConcurrentSessions: Number(env("MAX_CONCURRENT_SESSIONS", "10")),
      },
      rateLimit: {
        maxAttempts: Number(env("RATE_LIMIT_MAX_ATTEMPTS", "10")),
        windowMs: Number(env("RATE_LIMIT_WINDOW_MS", String(15 * 60 * 1000))),
      },
      captcha: {
        provider: captchaProvider,
        siteKey: env("CAPTCHA_SITE_KEY", env("HCAPTCHA_SITE_KEY", "")),
        secret: captchaProvider !== "none" ? env("CAPTCHA_SECRET") : undefined,
      },
    } as Partial<AuthConfig>,
    storage: {
      url: env("DATABASE_URL", "postgres://localhost:5432/palmshed_auth"),
    },
    cors: {
      origin: env("ALLOWED_ORIGIN", "http://localhost:3000"),
    },
    email: {
      apiKey: env("RESEND_API_KEY", ""),
      from: env("RESEND_FROM", "auth@localhost"),
    },
  };
}
