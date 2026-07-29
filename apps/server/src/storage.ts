import { MemoryStorage } from "@palmshed/auth-core";
import { PostgresStorage } from "@palmshed/auth-storage-postgres";

export type StorageInstance = {
  storage: MemoryStorage | PostgresStorage;
  close: () => Promise<void>;
};

export async function createStorage(url: string): Promise<StorageInstance> {
  if (url.startsWith("postgres")) {
    const storage = new PostgresStorage(url);
    await storage.migrate();
    return { storage, close: () => storage.close() };
  }
  if (url === ":memory:") {
    return { storage: new MemoryStorage(), close: async () => {} };
  }
  return { storage: new MemoryStorage(), close: async () => {} };
}
