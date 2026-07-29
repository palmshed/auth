import { describe, it, expect } from "vitest";

describe("generateResetToken", () => {
  it("should generate a token of the specified length", async () => {
    const { generateResetToken } = await import("../src/token.js");
    const token = generateResetToken(32);
    expect(token.length).toBe(64);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it("should generate unique tokens", async () => {
    const { generateResetToken } = await import("../src/token.js");
    const a = generateResetToken(48);
    const b = generateResetToken(48);
    expect(a).not.toBe(b);
  });
});

describe("createExpiry / isExpired", () => {
  it("should create a future expiry date", async () => {
    const { createExpiry, isExpired } = await import("../src/token.js");
    const expiry = createExpiry(60_000);
    expect(expiry.getTime()).toBeGreaterThan(Date.now());
    expect(isExpired(expiry)).toBe(false);
  });

  it("should detect expired dates", async () => {
    const { isExpired } = await import("../src/token.js");
    expect(isExpired(new Date(Date.now() - 1000))).toBe(true);
  });
});
