export interface User {
  id: string;
  username: string;
  email: string | null;
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  role: string;
  permissions: string[];
  disabled: boolean;
  disabledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  refreshToken: string;
  signingKeyId: string;
  deviceInfo: DeviceInfo | null;
  ipAddress: string | null;
  lastActiveAt: Date;
  expiresAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface DeviceInfo {
  userAgent: string;
  platform: string | null;
  device: string | null;
  browser: string | null;
  version: string | null;
}

export interface PasswordReset {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

export interface SigningKey {
  id: string;
  secret: string;
  algorithm: string;
  active: boolean;
  rotatedAt: Date | null;
  createdAt: Date;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, unknown>;
}

export interface AuthContext {
  user: User;
  session: Session;
}

export type SignInInput = {
  username: string;
  password: string;
  captcha?: string;
  deviceInfo?: DeviceInfo;
  ipAddress?: string;
};

export type SignUpInput = {
  username: string;
  password: string;
  email?: string;
  captcha?: string;
};

export type ForgotPasswordInput = {
  username: string;
  captcha?: string;
};

export type ResetPasswordInput = {
  token: string;
  password: string;
};

export type TokenPair = {
  token: string;
  refreshToken: string;
  expiresAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
};

export type AuthResponse<T = void> =
  | { success: true; data: T }
  | { success: false; error: AuthError };

export type AuthStateChange = {
  type: "signed-in" | "signed-out" | "session-refreshed" | "session-expired";
  user?: User;
  session?: Session;
};

export type AuthStateListener = (change: AuthStateChange) => void;

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 400,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
