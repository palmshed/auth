import { describe, it, expect } from "vitest";
import { MemoryStorage } from "../src/storage/memory.js";
import { Auth } from "../src/auth.js";

describe("auth edge cases", () => {
  it("should handle empty username on signup", async () => {
    const auth = new Auth({ storage: new MemoryStorage(), config: { captcha: { provider: "none" } } });
    const result = await auth.signUp({ username: "", password: "password123" });
    expect(result.success).toBe(false);
  });

  it("should handle empty password on signup", async () => {
    const auth = new Auth({ storage: new MemoryStorage(), config: { captcha: { provider: "none" } } });
    const result = await auth.signUp({ username: "alice", password: "" });
    expect(result.success).toBe(false);
  });

  it("should handle special characters in username", async () => {
    const auth = new Auth({ storage: new MemoryStorage(), config: { captcha: { provider: "none" } } });
    const result = await auth.signUp({ username: "user@name#1", password: "password123" });
    expect(result.success).toBe(true);
  });

  it("should handle very long password", async () => {
    const auth = new Auth({ storage: new MemoryStorage(), config: { captcha: { provider: "none" } } });
    const result = await auth.signUp({ username: "alice", password: "x".repeat(1000) });
    expect(result.success).toBe(true);
    const signIn = await auth.signIn({ username: "alice", password: "x".repeat(1000) });
    expect(signIn.success).toBe(true);
  });

  it("should handle empty token on getSession", async () => {
    const auth = new Auth({ storage: new MemoryStorage(), config: { captcha: { provider: "none" } } });
    const result = await auth.getSession("");
    expect(result.success).toBe(false);
  });

  it("should handle empty token on signOut", async () => {
    const auth = new Auth({ storage: new MemoryStorage(), config: { captcha: { provider: "none" } } });
    const result = await auth.signOut("");
    expect(result.success).toBe(false);
  });

  it("should handle very long username", async () => {
    const auth = new Auth({ storage: new MemoryStorage(), config: { captcha: { provider: "none" } } });
    const result = await auth.signUp({ username: "a".repeat(256), password: "password123" });
    expect(result.success).toBe(true);
  });

  it("should handle refresh with invalid token", async () => {
    const auth = new Auth({ storage: new MemoryStorage(), config: { captcha: { provider: "none" } } });
    const result = await auth.refreshSession("invalid-refresh-token");
    expect(result.success).toBe(false);
  });

  it("should handle list sessions without authentication", async () => {
    const auth = new Auth({ storage: new MemoryStorage(), config: { captcha: { provider: "none" } } });
    const result = await auth.listSessions("invalid-token");
    expect(result.success).toBe(false);
  });

  it("should handle revoke others without authentication", async () => {
    const auth = new Auth({ storage: new MemoryStorage(), config: { captcha: { provider: "none" } } });
    const result = await auth.revokeOtherSessions("invalid-token");
    expect(result.success).toBe(false);
  });
});
