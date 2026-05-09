// tests/lib/storage/provider.test.ts
import { describe, it, expectTypeOf } from "vitest";
import type { StorageProvider, UploadTicket, TransformOpts } from "@/lib/storage/provider";

describe("StorageProvider interface", () => {
  it("UploadTicket has provider-agnostic shape", () => {
    expectTypeOf<UploadTicket>().toEqualTypeOf<{
      uploadUrl: string;
      method: "PUT" | "POST";
      headers: Record<string, string>;
      path: string;
      publicUrl: string;
      expiresAt: number;
    }>();
  });

  it("TransformOpts allows the documented presets", () => {
    const opts: TransformOpts = {
      width: 800,
      height: 600,
      quality: 75,
      format: "webp",
      fit: "cover",
    };
    expectTypeOf(opts.format).toEqualTypeOf<"webp" | "avif" | "auto" | undefined>();
  });

  it("StorageProvider declares all four methods", () => {
    const stub: StorageProvider = {
      createUploadTicket: async () => ({
        uploadUrl: "x",
        method: "PUT",
        headers: {},
        path: "x",
        publicUrl: "x",
        expiresAt: 0,
      }),
      deleteObject: async () => {},
      getPublicUrl: () => "",
      getOptimizedUrl: () => "",
    };
    expectTypeOf(stub).toMatchTypeOf<StorageProvider>();
  });
});
