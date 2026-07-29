import type { User, Session, PasswordReset, SigningKey, DeviceInfo } from "@palmshed/auth-core";
import type { AuthStorage, CreateUserData, CreateSessionData } from "@palmshed/auth-core";
import postgres from "postgres";

export class PostgresStorage implements AuthStorage {
  private sql: ReturnType<typeof postgres>;
  private schema: string;

  constructor(connection: string | postgres.Options<{}>, schema = "auth") {
    this.sql = typeof connection === "string" ? postgres(connection) : postgres(connection);
    this.schema = schema;
  }

  async close(): Promise<void> {
    await this.sql.end();
  }

  // ─── Schema ─────────────────────────────────────────

  async migrate(): Promise<void> {
    await this.sql.unsafe(`
      CREATE SCHEMA IF NOT EXISTS ${this.sql(this.schema)};

      CREATE TABLE IF NOT EXISTS ${this.sql(this.schema)}.users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT,
        email_verified BOOLEAN NOT NULL DEFAULT false,
        email_verified_at TIMESTAMPTZ,
        role TEXT NOT NULL DEFAULT 'user',
        permissions TEXT[] NOT NULL DEFAULT '{}',
        disabled BOOLEAN NOT NULL DEFAULT false,
        disabled_at TIMESTAMPTZ,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS ${this.sql(this.schema)}.sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES ${this.sql(this.schema)}.users(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        refresh_token TEXT UNIQUE NOT NULL,
        signing_key_id TEXT NOT NULL,
        device_info JSONB,
        ip_address TEXT,
        last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL,
        idle_expires_at TIMESTAMPTZ NOT NULL,
        absolute_expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS ${this.sql(this.schema)}.password_resets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES ${this.sql(this.schema)}.users(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS ${this.sql(this.schema)}.signing_keys (
        id TEXT PRIMARY KEY,
        secret TEXT NOT NULL,
        algorithm TEXT NOT NULL DEFAULT 'sha256',
        active BOOLEAN NOT NULL DEFAULT true,
        rotated_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
  }

  // ─── Users ───────────────────────────────────────────

  async createUser(data: CreateUserData): Promise<User> {
    const id = crypto.randomUUID();
    const now = new Date();
    const [row] = await this.sql.unsafe<Record<string, unknown>[]>`
      INSERT INTO ${this.sql(this.schema)}.users (id, username, email, role, permissions, password_hash, salt, created_at, updated_at)
      VALUES (${id}, ${data.username}, ${data.email || null}, ${data.role || "user"}, ${data.permissions || []}, ${data.passwordHash}, ${data.salt}, ${now}, ${now})
      RETURNING *
    `;
    return this.rowToUser(row as Record<string, unknown>);
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const [row] = await this.sql.unsafe<Record<string, unknown>[]>`
      SELECT * FROM ${this.sql(this.schema)}.users WHERE username = ${username}
    `;
    return row ? this.rowToUser(row as Record<string, unknown>) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const [row] = await this.sql.unsafe<Record<string, unknown>[]>`
      SELECT * FROM ${this.sql(this.schema)}.users WHERE email = ${email}
    `;
    return row ? this.rowToUser(row as Record<string, unknown>) : null;
  }

  async getUserById(id: string): Promise<User | null> {
    const [row] = await this.sql.unsafe<Record<string, unknown>[]>`
      SELECT * FROM ${this.sql(this.schema)}.users WHERE id = ${id}
    `;
    return row ? this.rowToUser(row as Record<string, unknown>) : null;
  }

  async getUserWithPassword(username: string): Promise<(User & { passwordHash: string; salt: string }) | null> {
    const [row] = await this.sql.unsafe<Record<string, unknown>[]>`
      SELECT * FROM ${this.sql(this.schema)}.users WHERE username = ${username}
    `;
    if (!row) return null;
    const user = this.rowToUser(row as Record<string, unknown>);
    return { ...user, passwordHash: row.password_hash as string, salt: row.salt as string };
  }

  async updateUserPassword(id: string, passwordHash: string, salt: string): Promise<void> {
    await this.sql.unsafe`
      UPDATE ${this.sql(this.schema)}.users SET password_hash = ${passwordHash}, salt = ${salt}, updated_at = now() WHERE id = ${id}
    `;
  }

  async updateUser(id: string, data: Partial<Pick<User, "email" | "role" | "permissions" | "disabled" | "emailVerified" | "emailVerifiedAt">>): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (data.email !== undefined) { sets.push("email"); vals.push(data.email); }
    if (data.role !== undefined) { sets.push("role"); vals.push(data.role); }
    if (data.permissions !== undefined) { sets.push("permissions"); vals.push(data.permissions); }
    if (data.disabled !== undefined) { sets.push("disabled"); vals.push(data.disabled); }
    if (data.emailVerified !== undefined) { sets.push("email_verified"); vals.push(data.emailVerified); }
    if (data.emailVerifiedAt !== undefined) { sets.push("email_verified_at"); vals.push(data.emailVerifiedAt); }
    if (sets.length === 0) return;
    sets.push("updated_at"); vals.push(new Date());
    const setClause = sets.map((s, i) => `${s} = $${i + 1}`).join(", ");
    vals.push(id);
    await this.sql.unsafe(
      `UPDATE ${this.schema}.users SET ${setClause} WHERE id = $${vals.length}`,
      vals,
    );
  }

  async verifyUserEmail(id: string): Promise<void> {
    await this.sql.unsafe`
      UPDATE ${this.sql(this.schema)}.users SET email_verified = true, email_verified_at = now(), updated_at = now() WHERE id = ${id}
    `;
  }

  async listUsers(offset = 0, limit = 100): Promise<User[]> {
    const rows = await this.sql.unsafe<Record<string, unknown>[]>`
      SELECT * FROM ${this.sql(this.schema)}.users ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    `;
    return rows.map((r) => this.rowToUser(r as Record<string, unknown>));
  }

  // ─── Sessions ────────────────────────────────────────

  async createSession(data: CreateSessionData): Promise<Session> {
    const id = crypto.randomUUID();
    const [row] = await this.sql.unsafe<Record<string, unknown>[]>`
      INSERT INTO ${this.sql(this.schema)}.sessions (id, user_id, token, refresh_token, signing_key_id, device_info, ip_address, expires_at, idle_expires_at, absolute_expires_at)
      VALUES (${id}, ${data.userId}, ${data.token}, ${data.refreshToken}, ${data.signingKeyId}, ${data.deviceInfo ? JSON.stringify(data.deviceInfo) : null}, ${data.ipAddress}, ${data.expiresAt}, ${data.idleExpiresAt}, ${data.absoluteExpiresAt})
      RETURNING *
    `;
    return this.rowToSession(row as Record<string, unknown>);
  }

  async getSessionByToken(token: string): Promise<Session | null> {
    const [row] = await this.sql.unsafe<Record<string, unknown>[]>`
      SELECT * FROM ${this.sql(this.schema)}.sessions WHERE token = ${token}
    `;
    return row ? this.rowToSession(row as Record<string, unknown>) : null;
  }

  async getSessionByRefreshToken(refreshToken: string): Promise<Session | null> {
    const [row] = await this.sql.unsafe<Record<string, unknown>[]>`
      SELECT * FROM ${this.sql(this.schema)}.sessions WHERE refresh_token = ${refreshToken}
    `;
    return row ? this.rowToSession(row as Record<string, unknown>) : null;
  }

  async listUserSessions(userId: string): Promise<Session[]> {
    const rows = await this.sql.unsafe<Record<string, unknown>[]>`
      SELECT * FROM ${this.sql(this.schema)}.sessions WHERE user_id = ${userId} ORDER BY created_at DESC
    `;
    return rows.map((r) => this.rowToSession(r as Record<string, unknown>));
  }

  async updateSessionActivity(token: string, lastActiveAt: Date): Promise<void> {
    await this.sql.unsafe`
      UPDATE ${this.sql(this.schema)}.sessions SET last_active_at = ${lastActiveAt} WHERE token = ${token}
    `;
  }

  async revokeSession(token: string): Promise<void> {
    await this.sql.unsafe`
      UPDATE ${this.sql(this.schema)}.sessions SET revoked_at = now() WHERE token = ${token}
    `;
  }

  async revokeUserSessions(userId: string, excludeToken?: string): Promise<void> {
    if (excludeToken) {
      await this.sql.unsafe`
        UPDATE ${this.sql(this.schema)}.sessions SET revoked_at = now() WHERE user_id = ${userId} AND token != ${excludeToken} AND revoked_at IS NULL
      `;
    } else {
      await this.sql.unsafe`
        UPDATE ${this.sql(this.schema)}.sessions SET revoked_at = now() WHERE user_id = ${userId} AND revoked_at IS NULL
      `;
    }
  }

  async deleteSession(token: string): Promise<void> {
    await this.sql.unsafe`
      DELETE FROM ${this.sql(this.schema)}.sessions WHERE token = ${token}
    `;
  }

  async deleteExpiredSessions(): Promise<number> {
    const result = await this.sql.unsafe<{ count: string }[]>`
      DELETE FROM ${this.sql(this.schema)}.sessions WHERE expires_at <= now() OR absolute_expires_at <= now() OR revoked_at IS NOT NULL
    `;
    return Number(result.count || 0);
  }

  // ─── Password Resets ────────────────────────────────

  async createPasswordReset(userId: string, token: string, expiresAt: Date): Promise<PasswordReset> {
    const id = crypto.randomUUID();
    const [row] = await this.sql.unsafe<Record<string, unknown>[]>`
      INSERT INTO ${this.sql(this.schema)}.password_resets (id, user_id, token, expires_at)
      VALUES (${id}, ${userId}, ${token}, ${expiresAt})
      RETURNING *
    `;
    return this.rowToReset(row as Record<string, unknown>);
  }

  async getPasswordResetByToken(token: string): Promise<PasswordReset | null> {
    const [row] = await this.sql.unsafe<Record<string, unknown>[]>`
      SELECT * FROM ${this.sql(this.schema)}.password_resets WHERE token = ${token}
    `;
    return row ? this.rowToReset(row as Record<string, unknown>) : null;
  }

  async markPasswordResetUsed(token: string): Promise<void> {
    await this.sql.unsafe`
      UPDATE ${this.sql(this.schema)}.password_resets SET used = true WHERE token = ${token}
    `;
  }

  async deleteExpiredPasswordResets(): Promise<number> {
    const result = await this.sql.unsafe<{ count: string }[]>`
      DELETE FROM ${this.sql(this.schema)}.password_resets WHERE expires_at <= now()
    `;
    return Number(result.count || 0);
  }

  // ─── Signing Keys ──────────────────────────────────

  async createSigningKey(data: { secret: string; algorithm: string }): Promise<SigningKey> {
    const id = crypto.randomUUID();
    const [row] = await this.sql.unsafe<Record<string, unknown>[]>`
      INSERT INTO ${this.sql(this.schema)}.signing_keys (id, secret, algorithm)
      VALUES (${id}, ${data.secret}, ${data.algorithm})
      RETURNING *
    `;
    return this.rowToKey(row as Record<string, unknown>);
  }

  async getActiveSigningKeys(): Promise<SigningKey[]> {
    const rows = await this.sql.unsafe<Record<string, unknown>[]>`
      SELECT * FROM ${this.sql(this.schema)}.signing_keys WHERE active = true ORDER BY created_at ASC
    `;
    return rows.map((r) => this.rowToKey(r as Record<string, unknown>));
  }

  async getSigningKeyById(id: string): Promise<SigningKey | null> {
    const [row] = await this.sql.unsafe<Record<string, unknown>[]>`
      SELECT * FROM ${this.sql(this.schema)}.signing_keys WHERE id = ${id}
    `;
    return row ? this.rowToKey(row as Record<string, unknown>) : null;
  }

  async rotateSigningKey(id: string): Promise<void> {
    await this.sql.unsafe`
      UPDATE ${this.sql(this.schema)}.signing_keys SET active = false, rotated_at = now() WHERE id = ${id}
    `;
  }

  async deactivateSigningKey(id: string): Promise<void> {
    await this.sql.unsafe`
      UPDATE ${this.sql(this.schema)}.signing_keys SET active = false WHERE id = ${id}
    `;
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
      permissions: (Array.isArray(row.permissions) ? row.permissions : []) as string[],
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
      deviceInfo: row.device_info ? (row.device_info as unknown as DeviceInfo) : null,
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
