import { randomBytes } from "node:crypto";

export function generateResetToken(length: number = 64): string {
  return randomBytes(length).toString("hex");
}

export function createExpiry(msFromNow: number): Date {
  return new Date(Date.now() + msFromNow);
}

export function isExpired(date: Date): boolean {
  return date.getTime() <= Date.now();
}
