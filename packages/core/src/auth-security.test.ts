import { describe, it, expect } from "vitest";
import { MemoryStorage } from "../src/storage/memory.js";
import { Auth } from "../src/auth.js";
import { parseSignedToken } from "../src/crypto.js";
import type { AuthConfig } from "../src/config.js";

function createAuth() {
  return new Auth({ storage: new MemoryStorage(), config: { captcha: { provider: "none" } } });
}

describe("auth security", () => {
  describe("token forgery", () => {
    it("should reject tampered signed token", async () => {
      const auth = createAuth();
      await auth.signUp({ username: "alice", password: "password123" });
      const signIn = await auth.signIn({ username: "alice", password: "password123" });
      expect(signIn.success).toBe(true);
      if (!signIn.success) return;

      const tampered = signIn.data.token.replace(/:[a-f0-9]+:/, ":tampered:");
      const session = await auth.getSession(tampered);
      expect(session.success).toBe(false);
    });

    it("should reject token with wrong signing key id", async () => {
      const auth = createAuth();
      await auth.signUp({ username: "alice", password: "password123" });
      const signIn = await auth.signIn({ username: "alice", password: "password123" });
      expect(signIn.success).toBe(true);
      if (!signIn.success) return;

      const parts = signIn.data.token.split(":");
      const tampered = `nonexistent:${parts[1]}:${parts.slice(2).join(":")}`;
      const session = await auth.getSession(tampered);
      expect(session.success).toBe(false);
    });
  });

  describe("session expiry", () => {
    it("should expire session after absolute lifetime", async () => {
      const auth = new Auth({
        storage: new MemoryStorage(),
        config: { captcha: { provider: "none" }, session: { absoluteLifetime: -1000 } } as Partial<AuthConfig>,
      });
      await auth.signUp({ username: "alice", password: "password123" });
      const signIn = await auth.signIn({ username: "alice", password: "password123" });
      expect(signIn.success).toBe(true);
      if (!signIn.success) return;

      const session = await auth.getSession(signIn.data.token);
      expect(session.success).toBe(false);
    });
  });

  describe("revocation", () => {
    it("should reject revoked session", async () => {
      const auth = createAuth();
      await auth.signUp({ username: "alice", password: "password123" });
      const signIn = await auth.signIn({ username: "alice", password: "password123" });
      expect(signIn.success).toBe(true);
      if (!signIn.success) return;

      const parsed = parseSignedToken(signIn.data.token);
      const plainToken = parsed ? parsed.plainToken : signIn.data.token;
      const memStorage = (auth as unknown as { storage: MemoryStorage }).storage as MemoryStorage;
      await memStorage.revokeSession(plainToken);

      const session = await auth.getSession(signIn.data.token);
      expect(session.success).toBe(false);
    });
  });

  describe("concurrent sessions", () => {
    it("should enforce max concurrent sessions (best effort)", async () => {
      const auth = new Auth({
        storage: new MemoryStorage(),
        config: { captcha: { provider: "none" }, session: { maxConcurrentSessions: 2 } } as Partial<AuthConfig>,
      });
      await auth.signUp({ username: "alice", password: "password123" });

      const s1 = await auth.signIn({ username: "alice", password: "password123" });
      expect(s1.success).toBe(true);
      const s2 = await auth.signIn({ username: "alice", password: "password123" });
      expect(s2.success).toBe(true);
      const s3 = await auth.signIn({ username: "alice", password: "password123" });
      expect(s3.success).toBe(true);
      if (!s3.success) return;

      const list = await auth.listSessions(s3.data.token);
      expect(list.success).toBe(true);
      if (list.success) {
        // sequential requests should be limited
        expect(list.data.filter((s) => !s.revokedAt).length).toBeLessThanOrEqual(2);
      }
    });
  });

  describe("disabled user", () => {
    it("should reject sign in for disabled user", async () => {
      const auth = createAuth();
      await auth.signUp({ username: "alice", password: "password123" });
      const memStorage = (auth as unknown as { storage: MemoryStorage }).storage as MemoryStorage;
      const user = await memStorage.getUserByUsername("alice");
      if (user) await memStorage.updateUser(user.id, { disabled: true });

      const signIn = await auth.signIn({ username: "alice", password: "password123" });
      expect(signIn.success).toBe(false);
    });
  });
});
