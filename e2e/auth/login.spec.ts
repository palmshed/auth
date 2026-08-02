import {
  test,
  expect,
  uniqueUsername,
  TEST_PASSWORD,
} from "../helpers/fixtures";
import { solveCaptcha } from "../helpers/captcha";
import { signup } from "../helpers/api";
import { BASE_URL } from "../helpers/config";

test.describe("sign in", () => {
  let username: string;

  test.beforeAll(async ({ request }) => {
    username = uniqueUsername("login");
    expect((await signup(request, username, TEST_PASSWORD)).status()).toBe(201);
  });

  test("redirects to the homepage and stores a session", async ({ page }) => {
    await page.goto(`${BASE_URL}/login.html`);
    await page.fill("#username", username);
    await page.fill("#password", TEST_PASSWORD);
    await solveCaptcha(page);
    await page.click("#submit");
    await page.waitForURL(/index\.html/);
    const session = await page.evaluate("localStorage.getItem('session')");
    expect(session).toBeTruthy();
    await expect(page.locator("#authLink")).toHaveText("Sign out");
    await expect
      .poll(() => page.evaluate("getComputedStyle(document.body).opacity"))
      .toBe("1");
  });
});
