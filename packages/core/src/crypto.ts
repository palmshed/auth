import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import type { SigningKey } from "./types.js";

export function generateSecret(length = 32): string {
  return randomBytes(length).toString("hex");
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    const fake = Buffer.alloc(a.length);
    timingSafeEqual(fake, fake);
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function signToken(payload: string, secret: string, algorithm = "sha256"): string {
  const hmac = createHmac(algorithm, secret);
  hmac.update(payload);
  return hmac.digest("hex");
}

export function verifySignedToken(token: string, signature: string, secret: string, algorithm = "sha256"): boolean {
  const expected = signToken(token, secret, algorithm);
  return constantTimeEqual(expected, signature);
}

export function createSignedToken(
  plainToken: string,
  signingKey: SigningKey,
): { signedToken: string; signingKeyId: string } {
  const signature = signToken(plainToken, signingKey.secret, signingKey.algorithm);
  return {
    signedToken: `${signingKey.id}:${signature}:${plainToken}`,
    signingKeyId: signingKey.id,
  };
}

export function parseSignedToken(
  signedToken: string,
): { signingKeyId: string; signature: string; plainToken: string } | null {
  const parts = signedToken.split(":");
  if (parts.length < 3) return null;
  const signingKeyId = parts[0] as string;
  const signature = parts[1] as string;
  const plainToken = parts.slice(2).join(":");
  return { signingKeyId, signature, plainToken };
}

export function generateSessionTokens(
  tokenLength: number,
  refreshTokenLength: number,
): { token: string; refreshToken: string } {
  return {
    token: randomBytes(tokenLength).toString("hex"),
    refreshToken: randomBytes(refreshTokenLength).toString("hex"),
  };
}
