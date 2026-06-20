import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Storage boundary for trade attachments. The app only depends on this interface,
 * so the local-disk backend can be swapped for object storage (e.g. Cloudflare R2)
 * at go-public without touching callers — implement `FileStorage` and switch `getStorage`.
 */
export interface FileStorage {
  save(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

const UPLOADS_DIR = process.env.TRADEVAULT_UPLOADS_DIR
  ? path.resolve(process.env.TRADEVAULT_UPLOADS_DIR)
  : path.join(process.cwd(), "var", "uploads");

/** Reject any key that would escape the base directory (path-traversal guard). */
function safeJoin(base: string, key: string) {
  const resolved = path.resolve(base, key);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error("Invalid storage key.");
  }
  return resolved;
}

class LocalDiskStorage implements FileStorage {
  constructor(private readonly base: string) {}
  async save(key: string, data: Buffer) {
    const full = safeJoin(this.base, key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
  }
  async read(key: string) {
    return readFile(safeJoin(this.base, key));
  }
  async delete(key: string) {
    await unlink(safeJoin(this.base, key)).catch(() => {});
  }
}

let storage: FileStorage | null = null;
export function getStorage(): FileStorage {
  if (!storage) storage = new LocalDiskStorage(UPLOADS_DIR);
  return storage;
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Build a collision-free, tenant/trade-partitioned storage key. */
export function buildStorageKey(tenantId: string, tradeId: string, contentType: string) {
  const extension = EXTENSION_BY_TYPE[contentType] ?? "bin";
  return path.posix.join("tenants", tenantId, "trades", tradeId, `${randomUUID()}.${extension}`);
}
