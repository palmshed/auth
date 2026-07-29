export interface RateLimiter {
  check(key: string): Promise<boolean>;
  reset(key: string): Promise<void>;
}

type Entry = {
  count: number;
  resetAt: number;
};

export class MemoryRateLimiter implements RateLimiter {
  private store = new Map<string, Entry>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(
    private maxAttempts: number = 10,
    private windowMs: number = 15 * 60 * 1000,
  ) {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  async check(key: string): Promise<boolean> {
    const now = Date.now();
    const entry = this.store.get(key);
    if (!entry || now > entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (entry.count >= this.maxAttempts) return false;
    entry.count++;
    return true;
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.resetAt) this.store.delete(key);
    }
  }
}
