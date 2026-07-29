import type { User, Session, PasswordReset, SigningKey, DeviceInfo } from "../types.js";
import type { AuthStorage, CreateUserData, CreateSessionData } from "./interface.js";

export class MemoryStorage implements AuthStorage {
  private users = new Map<string, User & { passwordHash: string; salt: string }>();
  private sessions = new Map<string, Session>();
  private refreshTokens = new Map<string, string>();
  private resets = new Map<string, PasswordReset>();
  private signingKeys = new Map<string, SigningKey>();
  private idCounter = 0;

  private nextId(): string {
    return `mem_${++this.idCounter}`;
  }

  // ─── Users ───────────────────────────────────────────

  async createUser(data: CreateUserData): Promise<User> {
    const id = this.nextId();
    const now = new Date();
    const user: User & { passwordHash: string; salt: string } = {
      id,
      username: data.username,
      email: data.email || null,
      emailVerified: false,
      emailVerifiedAt: null,
      role: data.role || "user",
      permissions: data.permissions || [],
      disabled: false,
      disabledAt: null,
      passwordHash: data.passwordHash,
      salt: data.salt,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, user);
    this.users.set(`un:${data.username}`, user);
    const { passwordHash: _pw, salt: _salt, ...publicUser } = user;
    return publicUser;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    for (const [, user] of this.users) {
      if (user.username === username) {
        const { passwordHash: _pw, salt: _salt, ...publicUser } = user;
        return publicUser;
      }
    }
    return null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    for (const [, user] of this.users) {
      if (user.email === email) {
        const { passwordHash: _pw, salt: _salt, ...publicUser } = user;
        return publicUser;
      }
    }
    return null;
  }

  async getUserById(id: string): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;
    const { passwordHash: _pw, salt: _salt, ...publicUser } = user;
    return publicUser;
  }

  async getUserWithPassword(username: string): Promise<(User & { passwordHash: string; salt: string }) | null> {
    for (const [, user] of this.users) {
      if (user.username === username) return user;
    }
    return null;
  }

  async updateUserPassword(id: string, passwordHash: string, salt: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.passwordHash = passwordHash;
      user.salt = salt;
      user.updatedAt = new Date();
    }
  }

  async updateUser(id: string, data: Partial<Pick<User, "email" | "role" | "permissions" | "disabled" | "emailVerified" | "emailVerifiedAt">>): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      Object.assign(user, data);
      user.updatedAt = new Date();
    }
  }

  async verifyUserEmail(id: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.emailVerified = true;
      user.emailVerifiedAt = new Date();
    }
  }

  async listUsers(offset = 0, limit = 100): Promise<User[]> {
    const all: User[] = [];
    for (const [, user] of this.users) {
      if (typeof user.id === "string" && user.id.startsWith("mem_")) {
        const { passwordHash: _pw, salt: _salt, ...publicUser } = user;
        all.push(publicUser);
      }
    }
    return all.slice(offset, offset + limit);
  }

  // ─── Sessions ────────────────────────────────────────

  async createSession(data: CreateSessionData): Promise<Session> {
    const session: Session = {
      id: this.nextId(),
      userId: data.userId,
      token: data.token,
      refreshToken: data.refreshToken,
      signingKeyId: data.signingKeyId,
      deviceInfo: data.deviceInfo,
      ipAddress: data.ipAddress,
      lastActiveAt: new Date(),
      expiresAt: data.expiresAt,
      idleExpiresAt: data.idleExpiresAt,
      absoluteExpiresAt: data.absoluteExpiresAt,
      revokedAt: null,
      createdAt: new Date(),
    };
    this.sessions.set(data.token, session);
    this.refreshTokens.set(data.refreshToken, data.token);
    return session;
  }

  async getSessionByToken(token: string): Promise<Session | null> {
    return this.sessions.get(token) || null;
  }

  async getSessionByRefreshToken(refreshToken: string): Promise<Session | null> {
    const token = this.refreshTokens.get(refreshToken);
    if (!token) return null;
    return this.sessions.get(token) || null;
  }

  async listUserSessions(userId: string): Promise<Session[]> {
    const result: Session[] = [];
    for (const [, session] of this.sessions) {
      if (session.userId === userId) result.push(session);
    }
    return result;
  }

  async updateSessionActivity(token: string, lastActiveAt: Date): Promise<void> {
    const session = this.sessions.get(token);
    if (session) session.lastActiveAt = lastActiveAt;
  }

  async revokeSession(token: string): Promise<void> {
    const session = this.sessions.get(token);
    if (session) {
      session.revokedAt = new Date();
    }
  }

  async revokeUserSessions(userId: string, excludeToken?: string): Promise<void> {
    for (const [, session] of this.sessions) {
      if (session.userId === userId && session.token !== excludeToken) {
        session.revokedAt = new Date();
      }
    }
  }

  async deleteSession(token: string): Promise<void> {
    const session = this.sessions.get(token);
    if (session) {
      this.refreshTokens.delete(session.refreshToken);
      this.sessions.delete(token);
    }
  }

  async deleteExpiredSessions(): Promise<number> {
    const now = new Date();
    let count = 0;
    for (const [token, session] of this.sessions) {
      if (session.expiresAt <= now || session.absoluteExpiresAt <= now || (session.revokedAt && session.revokedAt <= now)) {
        this.deleteSession(token);
        count++;
      }
    }
    return count;
  }

  // ─── Password Resets ────────────────────────────────

  async createPasswordReset(userId: string, token: string, expiresAt: Date): Promise<PasswordReset> {
    const reset: PasswordReset = { id: this.nextId(), userId, token, expiresAt, used: false, createdAt: new Date() };
    this.resets.set(token, reset);
    return reset;
  }

  async getPasswordResetByToken(token: string): Promise<PasswordReset | null> {
    return this.resets.get(token) || null;
  }

  async markPasswordResetUsed(token: string): Promise<void> {
    const reset = this.resets.get(token);
    if (reset) reset.used = true;
  }

  async deleteExpiredPasswordResets(): Promise<number> {
    const now = new Date();
    let count = 0;
    for (const [token, reset] of this.resets) {
      if (reset.expiresAt <= now) {
        this.resets.delete(token);
        count++;
      }
    }
    return count;
  }

  // ─── Signing Keys ──────────────────────────────────

  async createSigningKey(data: { secret: string; algorithm: string }): Promise<SigningKey> {
    const key: SigningKey = {
      id: this.nextId(),
      secret: data.secret,
      algorithm: data.algorithm,
      active: true,
      rotatedAt: null,
      createdAt: new Date(),
    };
    this.signingKeys.set(key.id, key);
    return key;
  }

  async getActiveSigningKeys(): Promise<SigningKey[]> {
    const result: SigningKey[] = [];
    for (const [, key] of this.signingKeys) {
      if (key.active) result.push(key);
    }
    return result;
  }

  async getSigningKeyById(id: string): Promise<SigningKey | null> {
    return this.signingKeys.get(id) || null;
  }

  async rotateSigningKey(id: string): Promise<void> {
    const key = this.signingKeys.get(id);
    if (key) {
      key.active = false;
      key.rotatedAt = new Date();
    }
  }

  async deactivateSigningKey(id: string): Promise<void> {
    const key = this.signingKeys.get(id);
    if (key) key.active = false;
  }
}
