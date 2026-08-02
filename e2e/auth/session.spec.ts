import {
  test,
  expect,
  uniqueUsername,
  TEST_PASSWORD,
} from "../helpers/fixtures";
import { solveCaptcha } from "../helpers/captcha";
import { signup } from "../helpers/api";
import { BASE_URL, captchaFree } from "../helpers/config";

test.describe("session handling", () => {
  let username: string;

  test.beforeAll(async ({ request }) => {
    username = uniqueUsername("sess");
    expect((await signup(request, username, TEST_PASSWORD)).status()).toBe(201);
  });

  test("signed-in state is shared across tabs and sign-out closes both", async ({
    page,
  }) => {
    test.skip(!captchaFree, "requires a captcha-free API");
    await page.goto(`${BASE_URL}/login.html`);
    await page.fill("#username", username);
    await page.fill("#password", TEST_PASSWORD);
    await solveCaptcha(page);
    await page.click("#submit");
    await page.waitForURL(/index\.html/);
    await expect(page.locator("#authLink")).toHaveText("Sign out");

    const page2 = await page.context().newPage();
    await page2.goto(`${BASE_URL}/index.html`);
    await expect(page2.locator("#authLink")).toHaveText("Sign out");

    await page.click("#authLink");
    await page.waitForURL(/login\.html/);
    await page2.waitForURL(/login\.html/);
    expect(await page2.evaluate("localStorage.getItem('session')")).toBeNull();
  });

  test("redirects to sign in when the stored session is invalid", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/index.html`);
    await page.evaluate(
      "localStorage.setItem('session', 'fake.token.for.testing')",
    );
    await page.goto(`${BASE_URL}/index.html`);
    await page.waitForURL(/login\.html/);
    expect(await page.evaluate("localStorage.getItem('session')")).toBeNull();
  });
});
