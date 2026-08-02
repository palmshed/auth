import {
  test,
  expect,
  uniqueUsername,
  TEST_PASSWORD,
} from "../helpers/fixtures";
import { solveCaptcha } from "../helpers/captcha";
import { signin } from "../helpers/api";
import { BASE_URL } from "../helpers/config";

test("register a new account from the sign-in page", async ({
  page,
  request,
}) => {
  const username = uniqueUsername("reg");
  await page.goto(`${BASE_URL}/login.html`);
  await page.click("#toggle");
  await expect(page.locator("#title")).toHaveText("Create account");
  await page.fill("#username", username);
  await page.fill("#password", TEST_PASSWORD);
  await page.fill("#email", `${username}@example.com`);
  await solveCaptcha(page);
  await page.click("#submit");
  await expect(page.locator("#title")).toHaveText("Sign in");
  const res = await signin(request, username, TEST_PASSWORD);
  expect(res.status()).toBe(200);
});
