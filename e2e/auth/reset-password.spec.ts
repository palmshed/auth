import {
  test,
  expect,
  uniqueUsername,
  TEST_PASSWORD,
} from "../helpers/fixtures";
import { signup, signin } from "../helpers/api";
import { createResetToken, resetIsUsed, closeDb } from "../helpers/db";
import { BASE_URL, captchaFree, DATABASE_URL } from "../helpers/config";

test.describe("reset password", () => {
  test.afterAll(async () => {
    await closeDb();
  });

  test("shows an error and hides the form when the token is missing", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/reset-password.html`);
    await expect(page.locator("#msg")).toHaveText(/missing a token/);
    await expect(page.locator("#form")).toBeHidden();
  });

  test("rejects a fake token", async ({ page }) => {
    await page.goto(`${BASE_URL}/reset-password.html?token=fake-token-123`);
    await page.fill("#password", "NewPass123!");
    await page.fill("#confirm", "NewPass123!");
    await page.click("#submit");
    await expect(page.locator("#msg")).toHaveText(/Invalid or expired token/);
    await expect(page).toHaveURL(/reset-password/);
  });

  test("completes the full reset journey and invalidates the old password", async ({
    page,
    request,
  }) => {
    test.skip(!captchaFree, "requires a captcha-free API");
    test.skip(!DATABASE_URL, "requires DATABASE_URL to seed a reset token");

    const username = uniqueUsername("reset");
    expect(
      (
        await signup(
          request,
          username,
          TEST_PASSWORD,
          `${username}@example.com`,
        )
      ).status(),
    ).toBe(201);

    const token = await createResetToken(username);
    const newPassword = "FreshPass456!";

    await page.goto(`${BASE_URL}/reset-password.html?token=${token}`);
    await page.fill("#password", newPassword);
    await page.fill("#confirm", newPassword);
    await page.click("#submit");
    await expect(page.locator("#msg")).toHaveText(/Password reset/);
    await page.waitForURL(/login\.html\?reset=1/);
    await expect(page.locator("#msg")).toHaveText(
      /Password reset successfully/,
    );

    expect(await resetIsUsed(token)).toBe(true);

    const ok = await signin(request, username, newPassword);
    expect(ok.status()).toBe(200);
    expect((await ok.json()).ok).toBe(true);

    const rejected = await signin(request, username, TEST_PASSWORD);
    expect(rejected.status()).toBe(401);
  });
});
