export type AuthClientConfig = {
  baseUrl: string;
  storage?: Storage;
  storageKey?: string;
  refreshKey?: string;
  fetch?: typeof globalThis.fetch;
  onStateChange?: (state: AuthState) => void;
};

export type AuthState =
  | { status: "loading" }
  | { status: "authenticated"; user: User; token: string }
  | { status: "unauthenticated" }
  | { status: "error"; error: string };

export type AuthResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type User = {
  id: string;
  username: string;
  email: string | null;
  emailVerified: boolean;
  role: string;
  permissions: string[];
};

export type SessionInfo = {
  id: string;
  userId: string;
  deviceInfo: { userAgent: string; platform: string | null; device: string | null; browser: string | null } | null;
  ipAddress: string | null;
  lastActiveAt: string;
  expiresAt: string;
  createdAt: string;
};

type RequestInterceptor = (req: {
  url: string;
  options: RequestInit;
  headers: Record<string, string>;
}) => { url: string; options: RequestInit; headers: Record<string, string> } | void;

type RequestOptions = {
  captcha?: string;
  signal?: AbortSignal;
};

export class AuthClient {
  private baseUrl: string;
  private storage: Storage;
  private storageKey: string;
  private refreshKey: string;
  private fetcher: typeof globalThis.fetch;
  private onStateChange?: (state: AuthState) => void;
  private interceptors: RequestInterceptor[] = [];
  private _state: AuthState = { status: "loading" };
  private refreshPromise: Promise<AuthResponse<{ token: string; refreshToken: string }>> | null = null;

  constructor(config: AuthClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.storage = config.storage || globalThis.localStorage;
    this.storageKey = config.storageKey || "session";
    this.refreshKey = config.refreshKey || "session_refresh";
    this.fetcher = config.fetch || globalThis.fetch.bind(globalThis);
    this.onStateChange = config.onStateChange;
  }

  getToken(): string | null {
    return this.storage.getItem(this.storageKey);
  }

  getRefreshToken(): string | null {
    return this.storage.getItem(this.refreshKey);
  }

  private setToken(token: string): void {
    this.storage.setItem(this.storageKey, token);
  }

  private setRefreshToken(token: string): void {
    this.storage.setItem(this.refreshKey, token);
  }

  clearTokens(): void {
    this.storage.removeItem(this.storageKey);
    this.storage.removeItem(this.refreshKey);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  get state(): AuthState {
    return this._state;
  }

  private setState(state: AuthState): void {
    this._state = state;
    this.onStateChange?.(state);
  }

  addInterceptor(interceptor: RequestInterceptor): () => void {
    this.interceptors.push(interceptor);
    return () => {
      this.interceptors = this.interceptors.filter((i) => i !== interceptor);
    };
  }

  private async signedRequest<T>(
    path: string,
    options: RequestInit & { signal?: AbortSignal } = {},
    retry = true,
  ): Promise<AuthResponse<T>> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    const token = this.getToken();
    if (token) headers["authorization"] = `Bearer ${token}`;

    let url = `${this.baseUrl}${path}`;
    let opts: RequestInit = { ...options, headers };

    for (const interceptor of this.interceptors) {
      const result = interceptor({ url, options: opts, headers });
      if (result) {
        url = result.url;
        opts = result.options;
      }
    }

    try {
      const res = await this.fetcher(url, opts);
      if (res.status === 401 && retry) {
        const refreshed = await this.tryRefresh();
        if (refreshed) return this.signedRequest<T>(path, options, false);
        this.setState({ status: "unauthenticated" });
        return { ok: false, error: "Session expired" };
      }
      const body = await res.json() as { ok?: boolean; error?: string; token?: string; refreshToken?: string };
      if (body.ok) {
        return { ok: true, data: body as unknown as T };
      }
      return { ok: false, error: body.error || "Request failed" };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return { ok: false, error: "Request timed out" };
      }
      return { ok: false, error: "Unable to reach the server" };
    }
  }

  private async tryRefresh(): Promise<boolean> {
    const result = await this.refreshToken();
    return result.ok;
  }

  async signIn(username: string, password: string, options?: RequestOptions): Promise<AuthResponse<{ token: string; refreshToken: string; user: User }>> {
    const result = await this.signedRequest<{ token: string; refreshToken: string; user: User }>("/api/v1/signin", {
      method: "POST",
      body: JSON.stringify({ username, password, captcha: options?.captcha }),
      signal: options?.signal,
    }, false);
    if (result.ok) {
      this.setToken(result.data.token);
      if (result.data.refreshToken) this.setRefreshToken(result.data.refreshToken);
      this.setState({ status: "authenticated", user: result.data.user, token: result.data.token });
    }
    return result;
  }

  async signUp(username: string, password: string, email?: string, options?: RequestOptions): Promise<AuthResponse<void>> {
    return this.signedRequest<void>("/api/v1/signup", {
      method: "POST",
      body: JSON.stringify({ username, password, email, captcha: options?.captcha }),
      signal: options?.signal,
    }, false);
  }

  async forgotPassword(username: string, options?: RequestOptions): Promise<AuthResponse<void>> {
    return this.signedRequest<void>("/api/v1/forgot-password", {
      method: "POST",
      body: JSON.stringify({ username, captcha: options?.captcha }),
      signal: options?.signal,
    }, false);
  }

  async resetPassword(token: string, password: string, options?: { signal?: AbortSignal }): Promise<AuthResponse<void>> {
    return this.signedRequest<void>("/api/v1/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
      signal: options?.signal,
    }, false);
  }

  async signOut(options?: { signal?: AbortSignal }): Promise<AuthResponse<void>> {
    const result = await this.signedRequest<void>("/api/v1/signout", { method: "POST", signal: options?.signal }, false);
    this.clearTokens();
    this.setState({ status: "unauthenticated" });
    return result;
  }

  async getSession(options?: { signal?: AbortSignal }): Promise<AuthResponse<{ user: User }>> {
    const result = await this.signedRequest<{ user: User }>("/api/v1/session", { signal: options?.signal });
    if (result.ok) {
      this.setState({ status: "authenticated", user: result.data.user, token: this.getToken() || "" });
    }
    return result;
  }

  async getConfig(options?: { signal?: AbortSignal }): Promise<AuthResponse<{ captchaProvider: string; captchaSiteKey: string; allowRegistration: boolean }>> {
    return this.signedRequest<{ captchaProvider: string; captchaSiteKey: string; allowRegistration: boolean }>("/api/v1/config", { signal: options?.signal }, false);
  }

  async refreshToken(): Promise<AuthResponse<{ token: string; refreshToken: string }>> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this._refreshToken();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async _refreshToken(): Promise<AuthResponse<{ token: string; refreshToken: string }>> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return { ok: false, error: "No refresh token" };
    try {
      const res = await this.fetcher(`${this.baseUrl}/api/v1/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      const body = await res.json() as { ok?: boolean; token?: string; refreshToken?: string; error?: string };
      if (body.ok && body.token) {
        this.setToken(body.token);
        if (body.refreshToken) this.setRefreshToken(body.refreshToken);
        return { ok: true, data: { token: body.token, refreshToken: body.refreshToken || "" } };
      }
      this.clearTokens();
      return { ok: false, error: body.error || "Token refresh failed" };
    } catch {
      return { ok: false, error: "Unable to reach the server" };
    }
  }
}
