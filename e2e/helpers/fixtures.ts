import { test as base, expect } from "@playwright/test";
import { API_BASE_URL, CAPTCHA_PROVIDER } from "./config";

const HARDCODED_SITE_API = "https://palmshed-auth.vercel.app";

export const test = base.extend({
  context: async ({ context }, use) => {
    if (CAPTCHA_PROVIDER === "none") {
      await context.addInitScript(`
        globalThis.hcaptcha = { getResponse: () => "__e2e__", reset: () => {} };
      `);
      await context.route(/https:\/\/.*\.hcaptcha\.com\/.*/, (route) =>
        route.abort(),
      );
    }
    if (API_BASE_URL !== HARDCODED_SITE_API) {
      await context.addInitScript((apiBase) => {
        const hardcoded = "https://palmshed-auth.vercel.app";
        const realFetch = globalThis.fetch.bind(globalThis);
        (globalThis as any).fetch = (input: any, init?: any) => {
          const url =
            typeof input === "string"
              ? input
              : input?.url
                ? input.url
                : String(input);
          if (url.startsWith(hardcoded)) {
            input = url.replace(hardcoded, apiBase);
          }
          return realFetch(input, init);
        };
      }, API_BASE_URL);
    }
    await use(context);
  },
});

export { expect };

export function uniqueUsername(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

export const TEST_PASSWORD = "E2eTestPass123!";
