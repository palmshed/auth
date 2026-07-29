import { AuthError } from "./types.js";

export { AuthError };

export const errors = {
  missingFields: () => new AuthError("Missing required fields", "MISSING_FIELDS", 400),
  invalidCredentials: () => new AuthError("Invalid credentials", "INVALID_CREDENTIALS", 401),
  usernameTaken: () => new AuthError("Username is already taken", "USERNAME_TAKEN", 409),
  passwordTooShort: (min: number) => new AuthError(`Password must be at least ${min} characters`, "PASSWORD_TOO_SHORT", 400),
  captchaFailed: () => new AuthError("Captcha verification failed", "CAPTCHA_FAILED", 400),
  sessionExpired: () => new AuthError("Session has expired", "SESSION_EXPIRED", 401),
  invalidToken: () => new AuthError("Invalid or expired token", "INVALID_TOKEN", 400),
  userNotFound: () => new AuthError("User not found", "USER_NOT_FOUND", 404),
  emailRequired: () => new AuthError("Email is required for password reset", "EMAIL_REQUIRED", 400),
  rateLimited: () => new AuthError("Too many requests. Try again later.", "RATE_LIMITED", 429),
  methodNotAllowed: () => new AuthError("Method not allowed", "METHOD_NOT_ALLOWED", 405),
  unauthorized: () => new AuthError("Unauthorized", "UNAUTHORIZED", 401),
  permissionDenied: () => new AuthError("Permission denied", "PERMISSION_DENIED", 403),
  maxSessionsExceeded: () => new AuthError("Maximum concurrent sessions exceeded", "MAX_SESSIONS", 429),
  tokenRefreshFailed: () => new AuthError("Token refresh failed", "TOKEN_REFRESH_FAILED", 401),
  internal: () => new AuthError("Internal server error", "INTERNAL_ERROR", 500),
} as const;
