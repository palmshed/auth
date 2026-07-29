import { describe, it, expect } from "vitest";
import { MemoryStorage } from "../src/storage/memory.js";
import { Auth } from "../src/auth.js";

function createAuth() {
  return new Auth({ storage: new MemoryStorage(), config: { captcha: { provider: "none" } } });
}

describe("Auth", () => {
  describe("signUp", () => {
    it("should register a new user", async () => {
      const auth = createAuth();
      const result = await auth.signUp({ username: "alice", password: "password123", email: "alice@test.com" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.username).toBe("alice");
        expect(result.data.email).toBe("alice@test.com");
      }
    });

    it("should reject short passwords", async () => {
      const auth = createAuth();
      const result = await auth.signUp({ username: "bob", password: "123" });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe("PASSWORD_TOO_SHORT");
    });

    it("should reject duplicate usernames", async () => {
      const auth = createAuth();
      await auth.signUp({ username: "alice", password: "password123" });
      const result = await auth.signUp({ username: "alice", password: "password456" });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe("USERNAME_TAKEN");
    });

    it("should reject missing fields", async () => {
      const auth = createAuth();
      const result = await auth.signUp({ username: "", password: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("signIn", () => {
    it("should sign in with valid credentials", async () => {
      const auth = createAuth();
      await auth.signUp({ username: "alice", password: "password123" });
      const result = await auth.signIn({ username: "alice", password: "password123" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.username).toBe("alice");
        expect(result.data.token).toBeTruthy();
      }
    });

    it("should reject invalid password", async () => {
      const auth = createAuth();
      await auth.signUp({ username: "alice", password: "password123" });
      const result = await auth.signIn({ username: "alice", password: "wrong" });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("should reject nonexistent user", async () => {
      const auth = createAuth();
      const result = await auth.signIn({ username: "nonexistent", password: "password123" });
      expect(result.success).toBe(false);
    });
  });

  describe("signOut", () => {
    it("should invalidate the session", async () => {
      const auth = createAuth();
      await auth.signUp({ username: "alice", password: "password123" });
      const signIn = await auth.signIn({ username: "alice", password: "password123" });
      expect(signIn.success).toBe(true);
      if (!signIn.success) return;
      const token = signIn.data.token;

      const before = await auth.getSession(token);
      expect(before.success).toBe(true);

      await auth.signOut(token);

      const after = await auth.getSession(token);
      expect(after.success).toBe(false);
    });
  });

  describe("session", () => {
    it("should return user and session for valid token", async () => {
      const auth = createAuth();
      await auth.signUp({ username: "alice", password: "password123" });
      const signIn = await auth.signIn({ username: "alice", password: "password123" });
      expect(signIn.success).toBe(true);
      if (!signIn.success) return;

      const result = await auth.getSession(signIn.data.token);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.username).toBe("alice");
      }
    });

    it("should reject invalid token", async () => {
      const auth = createAuth();
      const result = await auth.getSession("invalid-token");
      expect(result.success).toBe(false);
    });
  });

  describe("forgotPassword / resetPassword", () => {
    it("should always return success to avoid enumeration", async () => {
      const auth = createAuth();
      const result = await auth.forgotPassword({ username: "nonexistent" });
      expect(result.success).toBe(true);
    });

    it("should reset password with valid token", async () => {
      const auth = createAuth();
      await auth.signUp({ username: "alice", password: "password123", email: "alice@test.com" });
      await auth.forgotPassword({ username: "alice" });

      const memStorage = (auth as unknown as { storage: MemoryStorage }).storage as MemoryStorage;
      const resets = (memStorage as unknown as { resets: Map<string, { token: string }> }).resets;
      const resetToken = resets.values().next().value?.token;
      expect(resetToken).toBeTruthy();
      if (!resetToken) return;

      const result = await auth.resetPassword({ token: resetToken, password: "newpassword456" });
      expect(result.success).toBe(true);

      const signIn = await auth.signIn({ username: "alice", password: "newpassword456" });
      expect(signIn.success).toBe(true);
    });

    it("should reject expired reset token", async () => {
      const auth = createAuth();
      const { createExpiry, generateResetToken } = await import("../src/token.js");
      const { MemoryStorage } = await import("../src/storage/memory.js");

      await auth.signUp({ username: "alice", password: "password123", email: "alice@test.com" });
      const storage = (auth as unknown as { storage: MemoryStorage }).storage as MemoryStorage;
      await storage.createPasswordReset("mem_1", "expired-token", new Date(Date.now() - 1000));

      const result = await auth.resetPassword({ token: "expired-token", password: "newpassword456" });
      expect(result.success).toBe(false);
    });
  });
});
