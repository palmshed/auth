import type { RateLimiter } from "@palmshed/auth-core";
import Redis from "ioredis";

export class RedisRateLimiter implements RateLimiter {
  private redis: Redis;
  private prefix: string;

  constructor(redis: Redis, prefix = "ratelimit:") {
    this.redis = redis;
    this.prefix = prefix;
  }

  async check(key: string): Promise<boolean> {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const maxAttempts = 10;
    const redisKey = `${this.prefix}${key}`;

    const multi = this.redis.multi();
    multi.zadd(redisKey, now, `${now}:${Math.random()}`);
    multi.zremrangebyscore(redisKey, 0, now - windowMs);
    multi.zcard(redisKey);
    multi.expire(redisKey, Math.ceil(windowMs / 1000) + 60);
    const results = await multi.exec();
    if (!results) return true;

    const count = results[2]?.[1] as number;
    return count <= maxAttempts;
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(`${this.prefix}${key}`);
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}
