import {
  test,
  expect,
  uniqueUsername,
  TEST_PASSWORD,
} from "../helpers/fixtures";
import { solveCaptcha } from "../helpers/captcha";
import { signup } from "../helpers/api";
import { BASE_URL } from "../helpers/config";

test.describe("sign in with a wrong password", () => {
  let username: string;

  test.beforeAll(async ({ request }) => {
    username = uniqueUsername("wrong");
    expect((await signup(request, username, TEST_PASSWORD)).status()).toBe(201);
  });

  test("shows Invalid credentials and stays on the sign-in page", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/login.html`);
    await page.fill("#username", username);
    await page.fill("#password", "DefinitelyWrongPass1!");
    await solveCaptcha(page);
    await page.click("#submit");
    await expect(page.locator("#msg")).toHaveText(/Invalid credentials/);
    await expect(page).toHaveURL(/login\.html/);
  });
});
