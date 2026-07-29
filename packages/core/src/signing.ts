import type { AuthStorage } from "./storage/interface.js";
import type { AuthConfig } from "./config.js";
import type { SigningKey } from "./types.js";
import { generateSecret } from "./crypto.js";

export class SigningKeyManager {
  private keys: SigningKey[] = [];
  private lastRotation: number = 0;

  constructor(
    private storage: AuthStorage,
    private config: AuthConfig,
  ) {}

  async getActiveKey(): Promise<SigningKey> {
    await this.maybeRotate();
    const active = this.keys.filter((k) => k.active);
    if (active.length === 0) {
      const key = await this.createKey();
      return key;
    }
    return active[active.length - 1] as SigningKey;
  }

  async getKeyById(id: string): Promise<SigningKey | null> {
    const existing = this.keys.find((k) => k.id === id);
    if (existing) return existing;
    return this.storage.getSigningKeyById(id);
  }

  private async maybeRotate(): Promise<void> {
    this.keys = await this.storage.getActiveSigningKeys();
    const now = Date.now();
    if (this.keys.length === 0 || (now - this.lastRotation) >= this.config.signingKeys.rotationInterval) {
      await this.rotate();
    }
  }

  private async rotate(): Promise<void> {
    for (const key of this.keys) {
      await this.storage.rotateSigningKey(key.id);
    }
    await this.createKey();
    this.lastRotation = Date.now();
    this.keys = await this.storage.getActiveSigningKeys();

    while (this.keys.length > this.config.signingKeys.activeKeys) {
      const oldest = this.keys[0];
      if (oldest) {
        await this.storage.deactivateSigningKey(oldest.id);
        this.keys = this.keys.filter((k) => k.id !== oldest.id);
      }
    }
  }

  private async createKey(): Promise<SigningKey> {
    const secret = generateSecret(32);
    return this.storage.createSigningKey({
      secret,
      algorithm: this.config.signingKeys.algorithm,
    });
  }
}
