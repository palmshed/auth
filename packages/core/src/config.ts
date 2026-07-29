import type { DeviceInfo } from "./types.js";

export type AuthConfig = {
  session: {
    expiresIn: number;
    idleTimeout: number;
    absoluteLifetime: number;
    tokenLength: number;
    refreshTokenLength: number;
    maxConcurrentSessions: number;
    extendOnActivity: boolean;
  };
  password: {
    minLength: number;
    hashAlgorithm: "argon2id" | "bcrypt";
    hashParams: Record<string, number>;
  };
  token: {
    resetExpiresIn: number;
    verifyExpiresIn: number;
    length: number;
  };
  signingKeys: {
    rotationInterval: number;
    activeKeys: number;
    algorithm: string;
  };
  rateLimit: {
    maxAttempts: number;
    windowMs: number;
  };
  captcha: {
    provider: "hcaptcha" | "turnstile" | "none";
    siteKey?: string;
    secret?: string;
  };
  rbac: {
    defaultRole: string;
    defaultPermissions: string[];
  };
};

export const defaultConfig: AuthConfig = {
  session: {
    expiresIn: 7 * 24 * 60 * 60 * 1000,
    idleTimeout: 4 * 60 * 60 * 1000,
    absoluteLifetime: 30 * 24 * 60 * 60 * 1000,
    tokenLength: 48,
    refreshTokenLength: 64,
    maxConcurrentSessions: 10,
    extendOnActivity: true,
  },
  password: {
    minLength: 8,
    hashAlgorithm: "argon2id",
    hashParams: {
      m: 19456,
      t: 2,
      p: 1,
    },
  },
  token: {
    resetExpiresIn: 60 * 60 * 1000,
    verifyExpiresIn: 24 * 60 * 60 * 1000,
    length: 64,
  },
  signingKeys: {
    rotationInterval: 90 * 24 * 60 * 60 * 1000,
    activeKeys: 2,
    algorithm: "sha256",
  },
  rateLimit: {
    maxAttempts: 10,
    windowMs: 15 * 60 * 1000,
  },
  captcha: {
    provider: "none",
  },
  rbac: {
    defaultRole: "user",
    defaultPermissions: [],
  },
};

export function resolveConfig(overrides?: Partial<AuthConfig>): AuthConfig {
  function deepMerge<T>(a: T, b: Partial<T>): T {
    const result = { ...a } as Record<string, unknown>;
    for (const k of Object.keys(b as Record<string, unknown>)) {
      const key = k as keyof T;
      if (
        b[key] !== null &&
        typeof b[key] === "object" &&
        !Array.isArray(b[key]) &&
        typeof a[key] === "object" &&
        !Array.isArray(a[key])
      ) {
        result[k] = deepMerge(a[key] as Record<string, unknown>, b[key] as Record<string, unknown>);
      } else if (b[key] !== undefined) {
        result[k] = b[key] as unknown;
      }
    }
    return result as T;
  }
  return deepMerge(defaultConfig, overrides || {});
}
