// lib/storage/index.ts
import type { StorageProvider } from "./provider";
import { SupabaseStorageProvider } from "./providers/supabase";

let cached: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  const key = process.env.STORAGE_PROVIDER ?? "supabase";
  if (cached && cached.constructor.name.toLowerCase().includes(key)) return cached;

  switch (key) {
    case "supabase":
      cached = new SupabaseStorageProvider();
      return cached;
    default:
      throw new Error(`Unknown STORAGE_PROVIDER: ${key}`);
  }
}

export type { StorageProvider, UploadTicket, TransformOpts } from "./provider";
