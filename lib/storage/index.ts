// lib/storage/index.ts
import type { StorageProvider } from "./provider";
import { SupabaseStorageProvider } from "./providers/supabase";

let cached: { key: string; provider: StorageProvider } | null = null;

export function getStorageProvider(): StorageProvider {
  const key = process.env.STORAGE_PROVIDER ?? "supabase";
  if (cached && cached.key === key) return cached.provider;

  switch (key) {
    case "supabase":
      cached = { key, provider: new SupabaseStorageProvider() };
      return cached.provider;
    default:
      throw new Error(`Unknown STORAGE_PROVIDER: ${key}`);
  }
}

export type { StorageProvider, UploadTicket, TransformOpts } from "./provider";
