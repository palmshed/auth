import { randomBytes, timingSafeEqual } from "node:crypto";

export interface PasswordHasher {
  hash(password: string): Promise<{ hash: string; salt: string }>;
  verify(password: string, hash: string, salt: string): Promise<boolean>;
  needsRehash(hash: string): boolean;
}

export class Argon2idHasher implements PasswordHasher {
  constructor(
    private options: {
      m?: number;
      t?: number;
      p?: number;
      saltLength?: number;
      dkLen?: number;
    } = {},
  ) {}

  async hash(password: string): Promise<{ hash: string; salt: string }> {
    const { argon2id } = await import("@noble/hashes/argon2");
    const salt = randomBytes(this.options.saltLength || 16);
    const hash = argon2id(password, salt, {
      m: this.options.m || 19456,
      t: this.options.t || 2,
      p: this.options.p || 1,
      dkLen: this.options.dkLen || 32,
    });
    return {
      hash: Buffer.from(hash).toString("hex"),
      salt: salt.toString("hex"),
    };
  }

  async verify(password: string, hash: string, salt: string): Promise<boolean> {
    const { argon2id } = await import("@noble/hashes/argon2");
    const expected = argon2id(password, Buffer.from(salt, "hex"), {
      m: this.options.m || 19456,
      t: this.options.t || 2,
      p: this.options.p || 1,
      dkLen: this.options.dkLen || 32,
    });
    const expectedHex = Buffer.from(expected).toString("hex");
    if (expectedHex.length !== hash.length) return false;
    return timingSafeEqual(Buffer.from(expectedHex), Buffer.from(hash));
  }

  needsRehash(_hash: string): boolean {
    return false;
  }
}
