// tests/lib/storage/index.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getServiceClient: () => ({
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: "x" } }) }) },
  }),
}));

beforeEach(() => {
  vi.resetModules();
});

describe("getStorageProvider", () => {
  it("defaults to Supabase when env not set", async () => {
    delete process.env.STORAGE_PROVIDER;
    const { getStorageProvider } = await import("@/lib/storage");
    const { SupabaseStorageProvider } = await import("@/lib/storage/providers/supabase");
    expect(getStorageProvider()).toBeInstanceOf(SupabaseStorageProvider);
  });

  it("returns Supabase when STORAGE_PROVIDER=supabase", async () => {
    process.env.STORAGE_PROVIDER = "supabase";
    const { getStorageProvider } = await import("@/lib/storage");
    const { SupabaseStorageProvider } = await import("@/lib/storage/providers/supabase");
    expect(getStorageProvider()).toBeInstanceOf(SupabaseStorageProvider);
  });

  it("throws on unknown provider", async () => {
    process.env.STORAGE_PROVIDER = "unknown-vendor";
    const { getStorageProvider } = await import("@/lib/storage");
    expect(() => getStorageProvider()).toThrow(/unknown.*provider/i);
  });
});
