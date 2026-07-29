import type { User, Session, PasswordReset, SigningKey, DeviceInfo } from "@palmshed/auth-core";
import type { AuthStorage, CreateUserData, CreateSessionData } from "@palmshed/auth-core";
import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import { randomUUID } from "node:crypto";

export class SqliteStorage implements AuthStorage {
  private db: DatabaseType;

  constructor(path: string = ":memory:") {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT,
        email_verified INTEGER NOT NULL DEFAULT 0,
        email_verified_at TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        permissions TEXT NOT NULL DEFAULT '[]',
        disabled INTEGER NOT NULL DEFAULT 0,
        disabled_at TEXT,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        refresh_token TEXT UNIQUE NOT NULL,
        signing_key_id TEXT NOT NULL,
        device_info TEXT,
        ip_address TEXT,
        last_active_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        idle_expires_at TEXT NOT NULL,
        absolute_expires_at TEXT NOT NULL,
        revoked_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS password_resets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS signing_keys (
        id TEXT PRIMARY KEY,
        secret TEXT NOT NULL,
        algorithm TEXT NOT NULL DEFAULT 'sha256',
        active INTEGER NOT NULL DEFAULT 1,
        rotated_at TEXT,
        created_at TEXT NOT NULL
      );
    `);
  }

  private uuid(): string {
    return randomUUID();
  }

  private now(): string {
    return new Date().toISOString();
  }

  // ─── Users ───────────────────────────────────────────

  async createUser(data: CreateUserData): Promise<User> {
    const id = this.uuid();
    const now = this.now();
    this.db.prepare(`
      INSERT INTO users (id, username, email, role, permissions, password_hash, salt, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.username, data.email || null, data.role || "user", JSON.stringify(data.permissions || []), data.passwordHash, data.salt, now, now);
    return this.getUserById(id) as Promise<User>;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const row = this.db.prepare("SELECT * FROM users WHERE username = ?").get(username) as Record<string, unknown> | undefined;
    return row ? this.rowToUser(row) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const row = this.db.prepare("SELECT * FROM users WHERE email = ?").get(email) as Record<string, unknown> | undefined;
    return row ? this.rowToUser(row) : null;
  }

  async getUserById(id: string): Promise<User | null> {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToUser(row) : null;
  }

  async getUserWithPassword(username: string): Promise<(User & { passwordHash: string; salt: string }) | null> {
    const row = this.db.prepare("SELECT * FROM users WHERE username = ?").get(username) as Record<string, unknown> | undefined;
    if (!row) return null;
    const user = this.rowToUser(row);
    return { ...user, passwordHash: row.password_hash as string, salt: row.salt as string };
  }

  async updateUserPassword(id: string, passwordHash: string, salt: string): Promise<void> {
    this.db.prepare("UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?").run(passwordHash, salt, this.now(), id);
  }

  async updateUser(id: string, data: Partial<Pick<User, "email" | "role" | "permissions" | "disabled" | "emailVerified" | "emailVerifiedAt">>): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (data.email !== undefined) { sets.push("email = ?"); vals.push(data.email); }
    if (data.role !== undefined) { sets.push("role = ?"); vals.push(data.role); }
    if (data.permissions !== undefined) { sets.push("permissions = ?"); vals.push(JSON.stringify(data.permissions)); }
    if (data.disabled !== undefined) { sets.push("disabled = ?"); vals.push(data.disabled ? 1 : 0); }
    if (data.emailVerified !== undefined) { sets.push("email_verified = ?"); vals.push(data.emailVerified ? 1 : 0); }
    if (data.emailVerifiedAt !== undefined) { sets.push("email_verified_at = ?"); vals.push(data.emailVerifiedAt?.toISOString() || null); }
    if (sets.length === 0) return;
    sets.push("updated_at = ?");
    vals.push(this.now());
    vals.push(id);
    this.db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  }

  async verifyUserEmail(id: string): Promise<void> {
    this.db.prepare("UPDATE users SET email_verified = 1, email_verified_at = ?, updated_at = ? WHERE id = ?").run(this.now(), this.now(), id);
  }

  async listUsers(offset = 0, limit = 100): Promise<User[]> {
    const rows = this.db.prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?").all(limit, offset) as Record<string, unknown>[];
    return rows.map((r) => this.rowToUser(r));
  }

  // ─── Sessions ────────────────────────────────────────

  async createSession(data: CreateSessionData): Promise<Session> {
    const id = this.uuid();
    const now = this.now();
    this.db.prepare(`
      INSERT INTO sessions (id, user_id, token, refresh_token, signing_key_id, device_info, ip_address, last_active_at, expires_at, idle_expires_at, absolute_expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.userId, data.token, data.refreshToken, data.signingKeyId, data.deviceInfo ? JSON.stringify(data.deviceInfo) : null, data.ipAddress, now, data.expiresAt.toISOString(), data.idleExpiresAt.toISOString(), data.absoluteExpiresAt.toISOString(), now);
    return this.getSessionByToken(data.token) as Promise<Session>;
  }

  async getSessionByToken(token: string): Promise<Session | null> {
    const row = this.db.prepare("SELECT * FROM sessions WHERE token = ?").get(token) as Record<string, unknown> | undefined;
    return row ? this.rowToSession(row) : null;
  }

  async getSessionByRefreshToken(refreshToken: string): Promise<Session | null> {
    const row = this.db.prepare("SELECT * FROM sessions WHERE refresh_token = ?").get(refreshToken) as Record<string, unknown> | undefined;
    return row ? this.rowToSession(row) : null;
  }

  async listUserSessions(userId: string): Promise<Session[]> {
    const rows = this.db.prepare("SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC").all(userId) as Record<string, unknown>[];
    return rows.map((r) => this.rowToSession(r));
  }

  async updateSessionActivity(token: string, lastActiveAt: Date): Promise<void> {
    this.db.prepare("UPDATE sessions SET last_active_at = ? WHERE token = ?").run(lastActiveAt.toISOString(), token);
  }

  async revokeSession(token: string): Promise<void> {
    this.db.prepare("UPDATE sessions SET revoked_at = ? WHERE token = ?").run(this.now(), token);
  }

  async revokeUserSessions(userId: string, excludeToken?: string): Promise<void> {
    if (excludeToken) {
      this.db.prepare("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND token != ? AND revoked_at IS NULL").run(this.now(), userId, excludeToken);
    } else {
      this.db.prepare("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL").run(this.now(), userId);
    }
  }

  async deleteSession(token: string): Promise<void> {
    this.db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  }

  async deleteExpiredSessions(): Promise<number> {
    const result = this.db.prepare("DELETE FROM sessions WHERE expires_at <= ? OR absolute_expires_at <= ? OR revoked_at IS NOT NULL").run(this.now(), this.now());
    return result.changes;
  }

  // ─── Password Resets ────────────────────────────────

  async createPasswordReset(userId: string, token: string, expiresAt: Date): Promise<PasswordReset> {
    const id = this.uuid();
    const now = this.now();
    this.db.prepare("INSERT INTO password_resets (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)").run(id, userId, token, expiresAt.toISOString(), now);
    return this.getPasswordResetByToken(token) as Promise<PasswordReset>;
  }

  async getPasswordResetByToken(token: string): Promise<PasswordReset | null> {
    const row = this.db.prepare("SELECT * FROM password_resets WHERE token = ?").get(token) as Record<string, unknown> | undefined;
    return row ? this.rowToReset(row) : null;
  }

  async markPasswordResetUsed(token: string): Promise<void> {
    this.db.prepare("UPDATE password_resets SET used = 1 WHERE token = ?").run(token);
  }

  async deleteExpiredPasswordResets(): Promise<number> {
    const result = this.db.prepare("DELETE FROM password_resets WHERE expires_at <= ?").run(this.now());
    return result.changes;
  }

  // ─── Signing Keys ──────────────────────────────────

  async createSigningKey(data: { secret: string; algorithm: string }): Promise<SigningKey> {
    const id = this.uuid();
    const now = this.now();
    this.db.prepare("INSERT INTO signing_keys (id, secret, algorithm, created_at) VALUES (?, ?, ?, ?)").run(id, data.secret, data.algorithm, now);
    return this.getSigningKeyById(id) as Promise<SigningKey>;
  }

  async getActiveSigningKeys(): Promise<SigningKey[]> {
    const rows = this.db.prepare("SELECT * FROM signing_keys WHERE active = 1 ORDER BY created_at ASC").all() as Record<string, unknown>[];
    return rows.map((r) => this.rowToKey(r));
  }

  async getSigningKeyById(id: string): Promise<SigningKey | null> {
    const row = this.db.prepare("SELECT * FROM signing_keys WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToKey(row) : null;
  }

  async rotateSigningKey(id: string): Promise<void> {
    this.db.prepare("UPDATE signing_keys SET active = 0, rotated_at = ? WHERE id = ?").run(this.now(), id);
  }

  async deactivateSigningKey(id: string): Promise<void> {
    this.db.prepare("UPDATE signing_keys SET active = 0 WHERE id = ?").run(id);
  }

  // ─── Row Mappers ─────────────────────────────────────

  private rowToUser(row: Record<string, unknown>): User {
    return {
      id: row.id as string,
      username: row.username as string,
      email: row.email as string | null,
      emailVerified: Boolean(row.email_verified),
      emailVerifiedAt: row.email_verified_at ? new Date(row.email_verified_at as string) : null,
      role: (row.role as string) || "user",
      permissions: JSON.parse((row.permissions as string) || "[]") as string[],
      disabled: Boolean(row.disabled),
      disabledAt: row.disabled_at ? new Date(row.disabled_at as string) : null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private rowToSession(row: Record<string, unknown>): Session {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      token: row.token as string,
      refreshToken: row.refresh_token as string,
      signingKeyId: row.signing_key_id as string,
      deviceInfo: row.device_info ? (JSON.parse(row.device_info as string) as DeviceInfo) : null,
      ipAddress: row.ip_address as string | null,
      lastActiveAt: new Date(row.last_active_at as string),
      expiresAt: new Date(row.expires_at as string),
      idleExpiresAt: new Date(row.idle_expires_at as string),
      absoluteExpiresAt: new Date(row.absolute_expires_at as string),
      revokedAt: row.revoked_at ? new Date(row.revoked_at as string) : null,
      createdAt: new Date(row.created_at as string),
    };
  }

  private rowToReset(row: Record<string, unknown>): PasswordReset {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      token: row.token as string,
      expiresAt: new Date(row.expires_at as string),
      used: Boolean(row.used),
      createdAt: new Date(row.created_at as string),
    };
  }

  private rowToKey(row: Record<string, unknown>): SigningKey {
    return {
      id: row.id as string,
      secret: row.secret as string,
      algorithm: (row.algorithm as string) || "sha256",
      active: Boolean(row.active),
      rotatedAt: row.rotated_at ? new Date(row.rotated_at as string) : null,
      createdAt: new Date(row.created_at as string),
    };
  }
}
