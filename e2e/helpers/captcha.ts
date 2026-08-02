import type { Page } from "@playwright/test";
import { CAPTCHA_PROVIDER } from "./config";

export async function solveCaptcha(page: Page): Promise<void> {
  if (CAPTCHA_PROVIDER === "none") return;
  await page.waitForFunction(
    "!!(window.hcaptcha && window.hcaptcha.getResponse && window.hcaptcha.getResponse())",
    undefined,
    { timeout: 300_000 },
  );
}
