import type { APIRequestContext } from "@playwright/test";
import { API_BASE_URL } from "./config";

export function signup(
  request: APIRequestContext,
  username: string,
  password: string,
  email?: string,
) {
  return request.post(`${API_BASE_URL}/api/v1/signup`, {
    data: { username, password, email: email || "", captcha: "__e2e__" },
  });
}

export function signin(
  request: APIRequestContext,
  username: string,
  password: string,
) {
  return request.post(`${API_BASE_URL}/api/v1/signin`, {
    data: { username, password, captcha: "__e2e__" },
  });
}
