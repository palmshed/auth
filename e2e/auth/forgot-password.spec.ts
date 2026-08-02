import {
  test,
  expect,
  uniqueUsername,
  TEST_PASSWORD,
} from "../helpers/fixtures";
import { solveCaptcha } from "../helpers/captcha";
import { signup } from "../helpers/api";
import { BASE_URL, captchaFree } from "../helpers/config";

test.describe("forgot password", () => {
  let username: string;

  test.beforeAll(async ({ request }) => {
    username = uniqueUsername("forgot");
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
  });

  test("requesting a reset for a known account shows the generic message", async ({
    page,
  }) => {
    test.skip(!captchaFree, "requires a captcha-free API");
    await page.goto(`${BASE_URL}/login.html`);
    await page.fill("#username", username);
    await solveCaptcha(page);
    await page.click("#forgot");
    await expect(page.locator("#msg")).toHaveText(/reset link was sent/);
  });
});
