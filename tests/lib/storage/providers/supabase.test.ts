// tests/lib/storage/providers/supabase.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreateSignedUploadUrl = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockRemove = vi.fn();
const mockFrom = vi.fn(() => ({
  createSignedUploadUrl: mockCreateSignedUploadUrl,
  getPublicUrl: mockGetPublicUrl,
  remove: mockRemove,
}));

vi.mock("@/lib/supabase/server", () => ({
  getServiceClient: () => ({ storage: { from: mockFrom } }),
}));

import { SupabaseStorageProvider } from "@/lib/storage/providers/supabase";

beforeEach(() => {
  mockCreateSignedUploadUrl.mockReset();
  mockGetPublicUrl.mockReset();
  mockRemove.mockReset();
  mockFrom.mockClear();
  mockGetPublicUrl.mockReturnValue({ data: { publicUrl: "https://x/cms-media/p" } });
});

describe("SupabaseStorageProvider", () => {
  it("createUploadTicket returns a PUT ticket with auth token", async () => {
    mockCreateSignedUploadUrl.mockResolvedValue({
      data: { signedUrl: "https://x/upload?token=abc", token: "abc", path: "p" },
      error: null,
    });
    const p = new SupabaseStorageProvider();
    const t = await p.createUploadTicket({ path: "p", contentType: "image/jpeg" });
    expect(mockFrom).toHaveBeenCalledWith("cms-media");
    expect(t.method).toBe("PUT");
    expect(t.uploadUrl).toContain("upload");
    expect(t.headers["x-upsert"]).toBe("false");
    expect(t.headers["content-type"]).toBe("image/jpeg");
    expect(t.headers["authorization"]).toMatch(/^Bearer /);
    expect(t.path).toBe("p");
    expect(t.publicUrl).toBe("https://x/cms-media/p");
    expect(t.expiresAt).toBeGreaterThan(Date.now());
  });

  it("createUploadTicket throws on Supabase error", async () => {
    mockCreateSignedUploadUrl.mockResolvedValue({
      data: null, error: { message: "boom" },
    });
    const p = new SupabaseStorageProvider();
    await expect(p.createUploadTicket({ path: "p", contentType: "image/jpeg" }))
      .rejects.toThrow(/boom/);
  });

  it("deleteObject calls remove([path])", async () => {
    mockRemove.mockResolvedValue({ error: null });
    const p = new SupabaseStorageProvider();
    await p.deleteObject("trip-gallery/x.jpg");
    expect(mockRemove).toHaveBeenCalledWith(["trip-gallery/x.jpg"]);
  });

  it("deleteObject throws on Supabase error", async () => {
    mockRemove.mockResolvedValue({ error: { message: "denied" } });
    const p = new SupabaseStorageProvider();
    await expect(p.deleteObject("x")).rejects.toThrow(/denied/);
  });

  it("getPublicUrl returns canonical URL", () => {
    const p = new SupabaseStorageProvider();
    expect(p.getPublicUrl("foo")).toBe("https://x/cms-media/p");
  });

  it("getOptimizedUrl appends transform query params", () => {
    const p = new SupabaseStorageProvider();
    const url = p.getOptimizedUrl("foo/bar.jpg", { width: 800, quality: 75, format: "webp" });
    expect(url).toMatch(/render\/image\/public\/cms-media\/foo\/bar\.jpg/);
    expect(url).toMatch(/width=800/);
    expect(url).toMatch(/quality=75/);
    expect(url).toMatch(/format=webp/);
  });

  it("getOptimizedUrl with no opts returns the public URL", () => {
    const p = new SupabaseStorageProvider();
    const url = p.getOptimizedUrl("foo", {});
    expect(url).toBe("https://x/cms-media/p");
  });

  it("getOptimizedUrl with format=auto omits format param", () => {
    const p = new SupabaseStorageProvider();
    const url = p.getOptimizedUrl("foo", { width: 800, format: "auto" });
    expect(url).not.toMatch(/format=auto/);
    expect(url).toMatch(/width=800/);
  });
});
