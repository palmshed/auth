import { describe, it, expect } from "vitest";
import { MemoryRateLimiter } from "../src/rate-limit.js";

describe("MemoryRateLimiter", () => {
  it("should allow first request", async () => {
    const limiter = new MemoryRateLimiter(3, 1000);
    expect(await limiter.check("key")).toBe(true);
    limiter.destroy();
  });

  it("should block after max attempts", async () => {
    const limiter = new MemoryRateLimiter(3, 100_000);
    expect(await limiter.check("key")).toBe(true);
    expect(await limiter.check("key")).toBe(true);
    expect(await limiter.check("key")).toBe(true);
    expect(await limiter.check("key")).toBe(false);
    limiter.destroy();
  });

  it("should reset after window", async () => {
    const limiter = new MemoryRateLimiter(1, -1); // expired window
    expect(await limiter.check("key")).toBe(true);
    limiter.destroy();
  });

  it("should reset explicitly", async () => {
    const limiter = new MemoryRateLimiter(1, 100_000);
    await limiter.check("key");
    await limiter.reset("key");
    expect(await limiter.check("key")).toBe(true);
    limiter.destroy();
  });
});
