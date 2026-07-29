import { describe, it, expect } from "vitest";
import { MemoryStorage } from "../src/storage/memory.js";
import { Auth } from "../src/auth.js";

describe("auth concurrency", () => {
  it("should handle concurrent signups", async () => {
    const auth = new Auth({ storage: new MemoryStorage(), config: { captcha: { provider: "none" } } });
    const promises = Array.from({ length: 10 }, (_, i) =>
      auth.signUp({ username: `user${i}`, password: "password123" }),
    );
    const results = await Promise.all(promises);
    const successes = results.filter((r) => r.success).length;
    expect(successes).toBe(10);
  });

  it("should handle concurrent signins", async () => {
    const auth = new Auth({ storage: new MemoryStorage(), config: { captcha: { provider: "none" } } });
    await auth.signUp({ username: "alice", password: "password123" });
    const promises = Array.from({ length: 10 }, () =>
      auth.signIn({ username: "alice", password: "password123" }),
    );
    const results = await Promise.all(promises);
    const successes = results.filter((r) => r.success).length;
    expect(successes).toBe(10);
  });

  it("should handle session validation during rotation", async () => {
    const auth = new Auth({
      storage: new MemoryStorage(),
      config: { captcha: { provider: "none" }, signingKeys: { rotationInterval: 1, activeKeys: 2, algorithm: "sha256" } },
    });
    await auth.signUp({ username: "alice", password: "password123" });
    const signIn = await auth.signIn({ username: "alice", password: "password123" });
    expect(signIn.success).toBe(true);
    if (!signIn.success) return;

    // session should still be valid after rotation
    const session = await auth.getSession(signIn.data.token);
    expect(session.success).toBe(true);
  });
});
