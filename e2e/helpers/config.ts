export const BASE_URL = process.env.BASE_URL || "https://palmshed.github.io";
export const API_BASE_URL =
  process.env.API_BASE_URL || "https://palmshed-auth.vercel.app";
export const CAPTCHA_PROVIDER = process.env.CAPTCHA_PROVIDER || "none";
export const DATABASE_URL = process.env.DATABASE_URL || "";

export const captchaFree = CAPTCHA_PROVIDER === "none";
