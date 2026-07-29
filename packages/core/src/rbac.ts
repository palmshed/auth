import type { User } from "./types.js";
import { AuthError } from "./types.js";

export type PermissionCheck = {
  resource: string;
  action: string;
};

export function hasPermission(user: User, resource: string, action: string): boolean {
  if (user.role === "admin") return true;
  const needed = `${resource}:${action}`;
  for (const p of user.permissions) {
    if (p === needed || p === `${resource}:*` || p === "*:*") return true;
  }
  if (user.role === "owner") return true;
  return false;
}

export function hasAllPermissions(user: User, checks: PermissionCheck[]): boolean {
  return checks.every((c) => hasPermission(user, c.resource, c.action));
}

export function hasAnyPermission(user: User, checks: PermissionCheck[]): boolean {
  return checks.some((c) => hasPermission(user, c.resource, c.action));
}

export function requirePermission(user: User, resource: string, action: string): void {
  if (!hasPermission(user, resource, action)) {
    throw new AuthError(
      `Permission denied: ${resource}:${action}`,
      "PERMISSION_DENIED",
      403,
    );
  }
}

export const defaultRoles: Record<string, { permissions: string[]; description: string }> = {
  admin: {
    permissions: ["*:*"],
    description: "Full system access",
  },
  user: {
    permissions: [],
    description: "Standard authenticated user",
  },
};
