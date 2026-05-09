/**
 * Tests for prepare+register banner upload actions in
 * app/(cms)/announcements/actions.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const createUploadTicketMock = vi.fn();
const getStorageProviderMock = vi.fn(() => ({ createUploadTicket: createUploadTicketMock }));
const validateUploadInputMock = vi.fn();
const buildPathMock = vi.fn();
const revalidatePathMock = vi.fn();
const revalidateHomeMock = vi.fn(async () => {});
const logActivityMock = vi.fn(async () => {});
const nextSequentialIdMock = vi.fn(async () => "SGL-001");

// DB insert spy via getServiceClient
const insertMock = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/storage", () => ({
  getStorageProvider: () => getStorageProviderMock(),
}));
vi.mock("@/lib/storage/validate", () => ({
  validateUploadInput: (...args: unknown[]) => validateUploadInputMock(...args),
}));
vi.mock("@/lib/storage/paths", () => ({
  buildPath: (...args: unknown[]) => buildPathMock(...args),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
  revalidateTag: vi.fn(),
}));
vi.mock("@/lib/revalidate", () => ({
  revalidateHome: (...args: unknown[]) => revalidateHomeMock(...args),
  revalidateTrip: vi.fn(async () => {}),
  revalidateAbout: vi.fn(async () => {}),
  revalidateCareers: vi.fn(async () => {}),
  revalidateReview: vi.fn(async () => {}),
  revalidateWebsite: vi.fn(async () => {}),
}));
vi.mock("@/lib/audit", () => ({
  logActivity: (...args: unknown[]) => logActivityMock(...args),
}));
vi.mock("@/lib/ids", () => ({
  nextSequentialId: (...args: unknown[]) => nextSequentialIdMock(...args),
}));
vi.mock("@/lib/supabase/server", () => ({
  getServiceClient: () => ({
    from: (_table: string) => ({
      insert: (...args: unknown[]) => insertMock(...args),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(async () => ({ data: [], error: null })),
          })),
        })),
        in: vi.fn(() => ({
          order: vi.fn(async () => ({ data: [], error: null })),
        })),
      })),
    }),
  }),
}));
vi.mock("@/lib/schemas/trip", () => ({ announcementSchema: { safeParse: vi.fn() } }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_TICKET = {
  uploadUrl: "https://storage.example.com/upload",
  method: "PUT" as const,
  headers: {},
  path: "banners/1234-banner.jpg",
  publicUrl: "https://cdn.example.com/banners/banner.jpg",
  expiresAt: Date.now() + 900_000,
};

// ---------------------------------------------------------------------------
// prepareBannerUploadAction
// ---------------------------------------------------------------------------

describe("prepareBannerUploadAction", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    validateUploadInputMock.mockReturnValue({ ok: true });
    buildPathMock.mockReturnValue("banners/1234-banner.jpg");
    createUploadTicketMock.mockResolvedValue(FAKE_TICKET);
  });

  it("returns a ticket for valid 5MB banner", async () => {
    const { prepareBannerUploadAction } = await import("@/app/(cms)/announcements/actions");
    const result = await prepareBannerUploadAction({
      fileName: "banner.jpg",
      contentType: "image/jpeg",
      size: 5 * 1024 * 1024,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ticket.uploadUrl).toBe(FAKE_TICKET.uploadUrl);
    }
  });

  it("calls validateUploadInput with 'banner' kind", async () => {
    const { prepareBannerUploadAction } = await import("@/app/(cms)/announcements/actions");
    await prepareBannerUploadAction({
      fileName: "banner.jpg",
      contentType: "image/jpeg",
      size: 1024,
    });
    expect(validateUploadInputMock).toHaveBeenCalledWith(
      "banner",
      expect.objectContaining({ fileName: "banner.jpg" }),
    );
  });

  it("rejects 11MB banner (over 10MB limit)", async () => {
    validateUploadInputMock.mockReturnValue({ ok: false, error: "File too large — max 10 MB" });
    const { prepareBannerUploadAction } = await import("@/app/(cms)/announcements/actions");
    const result = await prepareBannerUploadAction({
      fileName: "big-banner.jpg",
      contentType: "image/jpeg",
      size: 11 * 1024 * 1024,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/too large/i);
  });

  it("rejects non-image MIME types", async () => {
    validateUploadInputMock.mockReturnValue({ ok: false, error: "File type not allowed" });
    const { prepareBannerUploadAction } = await import("@/app/(cms)/announcements/actions");
    const result = await prepareBannerUploadAction({
      fileName: "banner.mp4",
      contentType: "video/mp4",
      size: 1024,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/type not allowed/i);
  });

  it("returns error when provider throws", async () => {
    createUploadTicketMock.mockRejectedValue(new Error("storage unavailable"));
    const { prepareBannerUploadAction } = await import("@/app/(cms)/announcements/actions");
    const result = await prepareBannerUploadAction({
      fileName: "banner.jpg",
      contentType: "image/jpeg",
      size: 1024,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("storage unavailable");
  });
});

// ---------------------------------------------------------------------------
// registerBannerAction
// ---------------------------------------------------------------------------

describe("registerBannerAction", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    insertMock.mockResolvedValue({ error: null });
    nextSequentialIdMock.mockResolvedValue("SGL-001");
  });

  it("inserts into site_gallery with category 'hero' and returns url", async () => {
    const { registerBannerAction } = await import("@/app/(cms)/announcements/actions");
    const result = await registerBannerAction({
      path: "banners/1234-banner.jpg",
      publicUrl: "https://cdn.example.com/banners/banner.jpg",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.url).toBe("https://cdn.example.com/banners/banner.jpg");
    }
  });

  it("calls nextSequentialId for site_gallery prefix SGL", async () => {
    const { registerBannerAction } = await import("@/app/(cms)/announcements/actions");
    await registerBannerAction({
      path: "banners/abc.jpg",
      publicUrl: "https://cdn.example.com/banners/abc.jpg",
    });
    expect(nextSequentialIdMock).toHaveBeenCalledWith("site_gallery", "gallery_id", "SGL");
  });

  it("logs activity after successful insert", async () => {
    const { registerBannerAction } = await import("@/app/(cms)/announcements/actions");
    await registerBannerAction({
      path: "banners/abc.jpg",
      publicUrl: "https://cdn.example.com/banners/abc.jpg",
    });
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ table_name: "site_gallery", action: "INSERT" }),
    );
  });

  it("returns error if DB insert fails", async () => {
    insertMock.mockResolvedValue({ error: { message: "unique constraint" } as unknown as null });
    const { registerBannerAction } = await import("@/app/(cms)/announcements/actions");
    const result = await registerBannerAction({
      path: "banners/abc.jpg",
      publicUrl: "https://cdn.example.com/banners/abc.jpg",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("unique constraint");
  });
});
