import { describe, it, expect } from "vitest";
import { constantTimeEqual, signToken, verifySignedToken, createSignedToken, parseSignedToken, generateSecret, generateSessionTokens } from "../src/crypto.js";

describe("crypto", () => {
  describe("constantTimeEqual", () => {
    it("should return true for equal strings", () => {
      expect(constantTimeEqual("hello", "hello")).toBe(true);
    });
    it("should return false for unequal strings", () => {
      expect(constantTimeEqual("hello", "world")).toBe(false);
    });
    it("should handle different lengths", () => {
      expect(constantTimeEqual("abc", "abcd")).toBe(false);
    });
  });

  describe("signToken / verifySignedToken", () => {
    it("should sign and verify a token", () => {
      const secret = generateSecret();
      const sig = signToken("mytoken", secret);
      expect(verifySignedToken("mytoken", sig, secret)).toBe(true);
    });
    it("should reject wrong secret", () => {
      const sig = signToken("mytoken", generateSecret());
      expect(verifySignedToken("mytoken", sig, generateSecret())).toBe(false);
    });
    it("should reject tampered payload", () => {
      const secret = generateSecret();
      const sig = signToken("mytoken", secret);
      expect(verifySignedToken("wrongtoken", sig, secret)).toBe(false);
    });
  });

  describe("createSignedToken / parseSignedToken", () => {
    it("should create and parse a signed token", () => {
      const key = { id: "key1", secret: generateSecret(), algorithm: "sha256", active: true, rotatedAt: null, createdAt: new Date() };
      const { signedToken, signingKeyId } = createSignedToken("mytoken", key);
      const parsed = parseSignedToken(signedToken);
      expect(parsed).not.toBeNull();
      expect(parsed!.signingKeyId).toBe("key1");
      expect(parsed!.plainToken).toBe("mytoken");
      expect(parsed!.signature).toBeTruthy();
    });
    it("should return null for malformed token", () => {
      expect(parseSignedToken("invalid")).toBeNull();
      expect(parseSignedToken("a:b")).toBeNull();
    });
  });

  describe("generateSessionTokens", () => {
    it("should generate token and refresh token", () => {
      const { token, refreshToken } = generateSessionTokens(32, 48);
      expect(token.length).toBe(64);
      expect(refreshToken.length).toBe(96);
      expect(token).not.toBe(refreshToken);
    });
  });
});
