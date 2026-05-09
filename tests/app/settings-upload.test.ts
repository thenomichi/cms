/**
 * Tests for prepare+register hero image and video upload actions in
 * app/(cms)/settings/actions.ts.
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
const logActivityMock = vi.fn(async () => {});
const nextSequentialIdMock = vi.fn(async () => "SGL-001");
const revalidateWebsiteMock = vi.fn(async () => {});

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
  revalidateWebsite: (...args: unknown[]) => revalidateWebsiteMock(...args),
  revalidateHome: vi.fn(async () => {}),
  revalidateTrip: vi.fn(async () => {}),
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
        in: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(async () => ({ data: [], error: null })),
            })),
          })),
        })),
      })),
    }),
    storage: {
      getBucket: vi.fn(async () => ({ data: { allowed_mime_types: [], file_size_limit: null }, error: null })),
      updateBucket: vi.fn(async () => ({ data: null, error: null })),
    },
  }),
}));
vi.mock("@/lib/db/settings", () => ({ updateSiteSettings: vi.fn() }));
vi.mock("@/lib/db/trips", () => ({ getTrips: vi.fn(async () => []) }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFakeTicket(path: string, publicUrl: string) {
  return {
    uploadUrl: "https://storage.example.com/upload",
    method: "PUT" as const,
    headers: {},
    path,
    publicUrl,
    expiresAt: Date.now() + 900_000,
  };
}

// ---------------------------------------------------------------------------
// prepareHeroImageUploadAction
// ---------------------------------------------------------------------------

describe("prepareHeroImageUploadAction", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    validateUploadInputMock.mockReturnValue({ ok: true });
    buildPathMock.mockReturnValue("settings/hero/images/1234-hero.jpg");
    createUploadTicketMock.mockResolvedValue(
      makeFakeTicket(
        "settings/hero/images/1234-hero.jpg",
        "https://cdn.example.com/settings/hero/images/hero.jpg",
      ),
    );
  });

  it("returns ticket for valid hero image", async () => {
    const { prepareHeroImageUploadAction } = await import("@/app/(cms)/settings/actions");
    const result = await prepareHeroImageUploadAction({
      fileName: "hero.jpg",
      contentType: "image/jpeg",
      size: 5 * 1024 * 1024,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ticket.path).toBe("settings/hero/images/1234-hero.jpg");
    }
  });

  it("calls validateUploadInput with 'heroImage' kind", async () => {
    const { prepareHeroImageUploadAction } = await import("@/app/(cms)/settings/actions");
    await prepareHeroImageUploadAction({
      fileName: "hero.jpg",
      contentType: "image/jpeg",
      size: 1024,
    });
    expect(validateUploadInputMock).toHaveBeenCalledWith(
      "heroImage",
      expect.objectContaining({ fileName: "hero.jpg" }),
    );
  });

  it("rejects video MIME for hero image", async () => {
    validateUploadInputMock.mockReturnValue({ ok: false, error: "File type not allowed" });
    const { prepareHeroImageUploadAction } = await import("@/app/(cms)/settings/actions");
    const result = await prepareHeroImageUploadAction({
      fileName: "hero.mp4",
      contentType: "video/mp4",
      size: 1024,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/type not allowed/i);
  });

  it("accepts valid photo MIME", async () => {
    const { prepareHeroImageUploadAction } = await import("@/app/(cms)/settings/actions");
    const result = await prepareHeroImageUploadAction({
      fileName: "hero.webp",
      contentType: "image/webp",
      size: 8 * 1024 * 1024,
    });
    expect(result.success).toBe(true);
  });

  it("returns error when provider throws", async () => {
    createUploadTicketMock.mockRejectedValue(new Error("provider down"));
    const { prepareHeroImageUploadAction } = await import("@/app/(cms)/settings/actions");
    const result = await prepareHeroImageUploadAction({
      fileName: "hero.jpg",
      contentType: "image/jpeg",
      size: 1024,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("provider down");
  });
});

// ---------------------------------------------------------------------------
// registerHeroImageAction
// ---------------------------------------------------------------------------

describe("registerHeroImageAction", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    insertMock.mockResolvedValue({ error: null });
    nextSequentialIdMock.mockResolvedValue("SGL-002");
  });

  it("inserts into site_gallery with category 'hero' and returns url", async () => {
    const { registerHeroImageAction } = await import("@/app/(cms)/settings/actions");
    const result = await registerHeroImageAction({
      path: "settings/hero/images/1234-hero.jpg",
      publicUrl: "https://cdn.example.com/settings/hero/images/hero.jpg",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.url).toBe("https://cdn.example.com/settings/hero/images/hero.jpg");
    }
  });

  it("calls nextSequentialId for site_gallery prefix SGL", async () => {
    const { registerHeroImageAction } = await import("@/app/(cms)/settings/actions");
    await registerHeroImageAction({
      path: "settings/hero/images/abc.jpg",
      publicUrl: "https://cdn.example.com/abc.jpg",
    });
    expect(nextSequentialIdMock).toHaveBeenCalledWith("site_gallery", "gallery_id", "SGL");
  });

  it("logs activity after insert", async () => {
    const { registerHeroImageAction } = await import("@/app/(cms)/settings/actions");
    await registerHeroImageAction({
      path: "settings/hero/images/abc.jpg",
      publicUrl: "https://cdn.example.com/abc.jpg",
    });
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ table_name: "site_gallery", action: "INSERT" }),
    );
  });

  it("returns error if DB insert fails", async () => {
    insertMock.mockResolvedValue({ error: { message: "db fail" } as unknown as null });
    const { registerHeroImageAction } = await import("@/app/(cms)/settings/actions");
    const result = await registerHeroImageAction({
      path: "settings/hero/images/abc.jpg",
      publicUrl: "https://cdn.example.com/abc.jpg",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("db fail");
  });
});

// ---------------------------------------------------------------------------
// prepareHeroVideoUploadAction
// ---------------------------------------------------------------------------

describe("prepareHeroVideoUploadAction", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    validateUploadInputMock.mockReturnValue({ ok: true });
    buildPathMock.mockReturnValue("settings/hero/videos/1234-hero.mp4");
    createUploadTicketMock.mockResolvedValue(
      makeFakeTicket(
        "settings/hero/videos/1234-hero.mp4",
        "https://cdn.example.com/settings/hero/videos/hero.mp4",
      ),
    );
  });

  it("returns ticket for valid 90MB hero video", async () => {
    const { prepareHeroVideoUploadAction } = await import("@/app/(cms)/settings/actions");
    const result = await prepareHeroVideoUploadAction({
      fileName: "hero.mp4",
      contentType: "video/mp4",
      size: 90 * 1024 * 1024,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ticket.path).toBe("settings/hero/videos/1234-hero.mp4");
    }
  });

  it("calls validateUploadInput with 'heroVideo' kind", async () => {
    const { prepareHeroVideoUploadAction } = await import("@/app/(cms)/settings/actions");
    await prepareHeroVideoUploadAction({
      fileName: "hero.mp4",
      contentType: "video/mp4",
      size: 1024,
    });
    expect(validateUploadInputMock).toHaveBeenCalledWith(
      "heroVideo",
      expect.objectContaining({ fileName: "hero.mp4" }),
    );
  });

  it("rejects 110MB video (over 100MB limit)", async () => {
    validateUploadInputMock.mockReturnValue({ ok: false, error: "File too large — max 100 MB" });
    const { prepareHeroVideoUploadAction } = await import("@/app/(cms)/settings/actions");
    const result = await prepareHeroVideoUploadAction({
      fileName: "huge.mp4",
      contentType: "video/mp4",
      size: 110 * 1024 * 1024,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/too large/i);
  });

  it("rejects image MIME for hero video", async () => {
    validateUploadInputMock.mockReturnValue({ ok: false, error: "File type not allowed" });
    const { prepareHeroVideoUploadAction } = await import("@/app/(cms)/settings/actions");
    const result = await prepareHeroVideoUploadAction({
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      size: 1024,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/type not allowed/i);
  });

  it("accepts 90MB video (under 100MB limit)", async () => {
    const { prepareHeroVideoUploadAction } = await import("@/app/(cms)/settings/actions");
    const result = await prepareHeroVideoUploadAction({
      fileName: "hero.mp4",
      contentType: "video/mp4",
      size: 90 * 1024 * 1024,
    });
    expect(result.success).toBe(true);
  });

  it("returns error when provider throws", async () => {
    createUploadTicketMock.mockRejectedValue(new Error("quota exceeded"));
    const { prepareHeroVideoUploadAction } = await import("@/app/(cms)/settings/actions");
    const result = await prepareHeroVideoUploadAction({
      fileName: "hero.mp4",
      contentType: "video/mp4",
      size: 1024,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("quota exceeded");
  });
});

// ---------------------------------------------------------------------------
// registerHeroVideoAction
// ---------------------------------------------------------------------------

describe("registerHeroVideoAction", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns success with url — no DB insert", async () => {
    const { registerHeroVideoAction } = await import("@/app/(cms)/settings/actions");
    const result = await registerHeroVideoAction({
      path: "settings/hero/videos/1234-hero.mp4",
      publicUrl: "https://cdn.example.com/settings/hero/videos/hero.mp4",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.url).toBe("https://cdn.example.com/settings/hero/videos/hero.mp4");
    }
  });

  it("does NOT call DB insert for video registration", async () => {
    const { registerHeroVideoAction } = await import("@/app/(cms)/settings/actions");
    await registerHeroVideoAction({
      path: "settings/hero/videos/abc.mp4",
      publicUrl: "https://cdn.example.com/abc.mp4",
    });
    expect(insertMock).not.toHaveBeenCalled();
  });
});
