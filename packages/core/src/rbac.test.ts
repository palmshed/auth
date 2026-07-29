import { describe, it, expect } from "vitest";
import { hasPermission, hasAllPermissions, hasAnyPermission } from "../src/rbac.js";
import type { User } from "../src/types.js";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u1",
    username: "test",
    email: "test@test.com",
    emailVerified: true,
    emailVerifiedAt: new Date(),
    role: "user",
    permissions: ["read:posts", "write:posts"],
    disabled: false,
    disabledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("rbac", () => {
  it("should allow matching permission", () => {
    expect(hasPermission(makeUser(), "read", "posts")).toBe(true);
  });
  it("should deny missing permission", () => {
    expect(hasPermission(makeUser(), "delete", "posts")).toBe(false);
  });
  it("should allow admin for all", () => {
    expect(hasPermission(makeUser({ role: "admin" }), "anything", "anyaction")).toBe(true);
  });
  it("should support wildcard permission", () => {
    expect(hasPermission(makeUser({ permissions: ["*:*"] }), "anything", "anyaction")).toBe(true);
  });
  it("should support resource wildcard", () => {
    expect(hasPermission(makeUser({ permissions: ["read:*"] }), "read", "anything")).toBe(true);
  });
  it("hasAllPermissions should require all", () => {
    expect(hasAllPermissions(makeUser(), [{ resource: "read", action: "posts" }, { resource: "write", action: "posts" }])).toBe(true);
    expect(hasAllPermissions(makeUser(), [{ resource: "read", action: "posts" }, { resource: "delete", action: "posts" }])).toBe(false);
  });
  it("hasAnyPermission should require at least one", () => {
    expect(hasAnyPermission(makeUser(), [{ resource: "read", action: "posts" }, { resource: "delete", action: "posts" }])).toBe(true);
    expect(hasAnyPermission(makeUser(), [{ resource: "delete", action: "posts" }, { resource: "admin", action: "panel" }])).toBe(false);
  });
});
