import type {
  User,
  Session,
  PasswordReset,
  SigningKey,
  DeviceInfo,
} from "../types.js";

export type CreateUserData = {
  username: string;
  passwordHash: string;
  salt: string;
  email?: string | null;
  role?: string;
  permissions?: string[];
};

export type CreateSessionData = {
  userId: string;
  token: string;
  refreshToken: string;
  signingKeyId: string;
  deviceInfo: DeviceInfo | null;
  ipAddress: string | null;
  expiresAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
};

export interface AuthStorage {
  // Users
  createUser(data: CreateUserData): Promise<User>;
  getUserByUsername(username: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserById(id: string): Promise<User | null>;
  getUserWithPassword(username: string): Promise<(User & { passwordHash: string; salt: string }) | null>;
  updateUserPassword(id: string, passwordHash: string, salt: string): Promise<void>;
  updateUser(id: string, data: Partial<Pick<User, "email" | "role" | "permissions" | "disabled" | "emailVerified" | "emailVerifiedAt">>): Promise<void>;
  verifyUserEmail(id: string): Promise<void>;
  listUsers(offset?: number, limit?: number): Promise<User[]>;

  // Sessions
  createSession(data: CreateSessionData): Promise<Session>;
  getSessionByToken(token: string): Promise<Session | null>;
  getSessionByRefreshToken(refreshToken: string): Promise<Session | null>;
  listUserSessions(userId: string): Promise<Session[]>;
  updateSessionActivity(token: string, lastActiveAt: Date): Promise<void>;
  revokeSession(token: string): Promise<void>;
  revokeUserSessions(userId: string, excludeToken?: string): Promise<void>;
  deleteSession(token: string): Promise<void>;
  deleteExpiredSessions(): Promise<number>;

  // Password resets
  createPasswordReset(userId: string, token: string, expiresAt: Date): Promise<PasswordReset>;
  getPasswordResetByToken(token: string): Promise<PasswordReset | null>;
  markPasswordResetUsed(token: string): Promise<void>;
  deleteExpiredPasswordResets(): Promise<number>;

  // Signing keys
  createSigningKey(data: { secret: string; algorithm: string }): Promise<SigningKey>;
  getActiveSigningKeys(): Promise<SigningKey[]>;
  getSigningKeyById(id: string): Promise<SigningKey | null>;
  rotateSigningKey(id: string): Promise<void>;
  deactivateSigningKey(id: string): Promise<void>;
}
