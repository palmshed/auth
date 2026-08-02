export class AuthClient {
    baseUrl;
    storage;
    storageKey;
    refreshKey;
    fetcher;
    onStateChange;
    interceptors = [];
    _state = { status: "loading" };
    refreshPromise = null;
    constructor(config) {
        this.baseUrl = config.baseUrl.replace(/\/+$/, "");
        this.storage = config.storage || globalThis.localStorage;
        this.storageKey = config.storageKey || "session";
        this.refreshKey = config.refreshKey || "session_refresh";
        this.fetcher = config.fetch || globalThis.fetch.bind(globalThis);
        this.onStateChange = config.onStateChange;
    }
    getToken() {
        return this.storage.getItem(this.storageKey);
    }
    getRefreshToken() {
        return this.storage.getItem(this.refreshKey);
    }
    setToken(token) {
        this.storage.setItem(this.storageKey, token);
    }
    setRefreshToken(token) {
        this.storage.setItem(this.refreshKey, token);
    }
    clearTokens() {
        this.storage.removeItem(this.storageKey);
        this.storage.removeItem(this.refreshKey);
    }
    isAuthenticated() {
        return !!this.getToken();
    }
    get state() {
        return this._state;
    }
    setState(state) {
        this._state = state;
        this.onStateChange?.(state);
    }
    addInterceptor(interceptor) {
        this.interceptors.push(interceptor);
        return () => {
            this.interceptors = this.interceptors.filter((i) => i !== interceptor);
        };
    }
    async signedRequest(path, options = {}, retry = true) {
        const headers = {
            "content-type": "application/json",
        };
        const token = this.getToken();
        if (token)
            headers["authorization"] = `Bearer ${token}`;
        let url = `${this.baseUrl}${path}`;
        let opts = { ...options, headers };
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
                if (refreshed)
                    return this.signedRequest(path, options, false);
                this.setState({ status: "unauthenticated" });
                return { ok: false, error: "Session expired" };
            }
            const body = await res.json();
            if (body.ok) {
                return { ok: true, data: body };
            }
            return { ok: false, error: body.error || "Request failed" };
        }
        catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") {
                return { ok: false, error: "Request timed out" };
            }
            return { ok: false, error: "Unable to reach the server" };
        }
    }
    async tryRefresh() {
        const result = await this.refreshToken();
        return result.ok;
    }
    async signIn(username, password, options) {
        const result = await this.signedRequest("/api/v1/signin", {
            method: "POST",
            body: JSON.stringify({ username, password, captcha: options?.captcha }),
            signal: options?.signal,
        }, false);
        if (result.ok) {
            this.setToken(result.data.token);
            if (result.data.refreshToken)
                this.setRefreshToken(result.data.refreshToken);
            this.setState({ status: "authenticated", user: result.data.user, token: result.data.token });
        }
        return result;
    }
    async signUp(username, password, email, options) {
        return this.signedRequest("/api/v1/signup", {
            method: "POST",
            body: JSON.stringify({ username, password, email, captcha: options?.captcha }),
            signal: options?.signal,
        }, false);
    }
    async forgotPassword(username, options) {
        return this.signedRequest("/api/v1/forgot-password", {
            method: "POST",
            body: JSON.stringify({ username, captcha: options?.captcha }),
            signal: options?.signal,
        }, false);
    }
    async resetPassword(token, password, options) {
        return this.signedRequest("/api/v1/reset-password", {
            method: "POST",
            body: JSON.stringify({ token, password }),
            signal: options?.signal,
        }, false);
    }
    async signOut(options) {
        const result = await this.signedRequest("/api/v1/signout", { method: "POST", signal: options?.signal }, false);
        this.clearTokens();
        this.setState({ status: "unauthenticated" });
        return result;
    }
    async getSession(options) {
        const result = await this.signedRequest("/api/v1/session", { signal: options?.signal });
        if (result.ok) {
            this.setState({ status: "authenticated", user: result.data.user, token: this.getToken() || "" });
        }
        return result;
    }
    async getConfig(options) {
        return this.signedRequest("/api/v1/config", { signal: options?.signal }, false);
    }
    async refreshToken() {
        if (this.refreshPromise)
            return this.refreshPromise;
        this.refreshPromise = this._refreshToken();
        try {
            return await this.refreshPromise;
        }
        finally {
            this.refreshPromise = null;
        }
    }
    async _refreshToken() {
        const refreshToken = this.getRefreshToken();
        if (!refreshToken)
            return { ok: false, error: "No refresh token" };
        try {
            const res = await this.fetcher(`${this.baseUrl}/api/v1/refresh`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ refreshToken }),
            });
            const body = await res.json();
            if (body.ok && body.token) {
                this.setToken(body.token);
                if (body.refreshToken)
                    this.setRefreshToken(body.refreshToken);
                return { ok: true, data: { token: body.token, refreshToken: body.refreshToken || "" } };
            }
            this.clearTokens();
            return { ok: false, error: body.error || "Token refresh failed" };
        }
        catch {
            return { ok: false, error: "Unable to reach the server" };
        }
    }
}
//# sourceMappingURL=index.js.map