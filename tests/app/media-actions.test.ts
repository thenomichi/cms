/**
 * Tests for prepare+register upload actions in app/(cms)/media/actions.ts.
 * Covers trip gallery, site gallery, and raw moment upload flows.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock declarations (must be before any imports that trigger module loading)
// ---------------------------------------------------------------------------

const createUploadTicketMock = vi.fn();
const getStorageProviderMock = vi.fn(() => ({ createUploadTicket: createUploadTicketMock }));
const validateUploadInputMock = vi.fn();
const buildPathMock = vi.fn();
const revalidatePathMock = vi.fn();
const revalidateHomeMock = vi.fn(async () => {});
const logActivityMock = vi.fn(async () => {});
const createGalleryImageMock = vi.fn();
const createSiteGalleryImageMock = vi.fn();
const createRawMomentMock = vi.fn();

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
vi.mock("@/lib/db/media", () => ({
  getTripGalleryImages: vi.fn(async () => []),
  createGalleryImage: (...args: unknown[]) => createGalleryImageMock(...args),
  updateGalleryImage: vi.fn(),
  deleteGalleryImage: vi.fn(),
  toggleGalleryFeatured: vi.fn(),
  toggleGalleryCover: vi.fn(),
  getSiteGalleryImages: vi.fn(async () => []),
  createSiteGalleryImage: (...args: unknown[]) => createSiteGalleryImageMock(...args),
  updateSiteGalleryImage: vi.fn(),
  deleteSiteGalleryImage: vi.fn(),
  getRawMoments: vi.fn(async () => []),
  createRawMoment: (...args: unknown[]) => createRawMomentMock(...args),
  updateRawMoment: vi.fn(),
  deleteRawMoment: vi.fn(),
}));
vi.mock("@/lib/utils", () => ({ generateId: vi.fn(() => "test-id") }));
vi.mock("@/lib/supabase/server", () => ({ getServiceClient: vi.fn() }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_TICKET = {
  uploadUrl: "https://storage.example.com/upload",
  method: "PUT" as const,
  headers: { "Content-Type": "image/jpeg" },
  path: "trip-gallery/TRIP-1/1234-photo.jpg",
  publicUrl: "https://cdn.example.com/trip-gallery/TRIP-1/1234-photo.jpg",
  expiresAt: Date.now() + 900_000,
};

// ---------------------------------------------------------------------------
// prepareTripGalleryUploadAction
// ---------------------------------------------------------------------------

describe("prepareTripGalleryUploadAction", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    validateUploadInputMock.mockReturnValue({ ok: true });
    buildPathMock.mockReturnValue("trip-gallery/TRIP-1/1234-photo.jpg");
    createUploadTicketMock.mockResolvedValue(FAKE_TICKET);
  });

  it("returns a ticket on valid input", async () => {
    const { prepareTripGalleryUploadAction } = await import("@/app/(cms)/media/actions");
    const result = await prepareTripGalleryUploadAction({
      tripId: "TRIP-1",
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      size: 1024 * 1024,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ticket).toMatchObject({ uploadUrl: FAKE_TICKET.uploadUrl });
    }
  });

  it("calls validateUploadInput with 'tripGallery' kind", async () => {
    const { prepareTripGalleryUploadAction } = await import("@/app/(cms)/media/actions");
    await prepareTripGalleryUploadAction({
      tripId: "TRIP-1",
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      size: 1024,
    });
    expect(validateUploadInputMock).toHaveBeenCalledWith(
      "tripGallery",
      expect.objectContaining({ fileName: "photo.jpg" }),
    );
  });

  it("returns error when validation fails — oversize", async () => {
    validateUploadInputMock.mockReturnValue({ ok: false, error: "File too large — max 20 MB" });
    const { prepareTripGalleryUploadAction } = await import("@/app/(cms)/media/actions");
    const result = await prepareTripGalleryUploadAction({
      tripId: "TRIP-1",
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      size: 25 * 1024 * 1024,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/too large/i);
  });

  it("returns error when validation fails — wrong MIME", async () => {
    validateUploadInputMock.mockReturnValue({ ok: false, error: "File type not allowed" });
    const { prepareTripGalleryUploadAction } = await import("@/app/(cms)/media/actions");
    const result = await prepareTripGalleryUploadAction({
      tripId: "TRIP-1",
      fileName: "doc.pdf",
      contentType: "application/pdf",
      size: 1024,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/type not allowed/i);
  });

  it("returns error when validation fails — path traversal in filename", async () => {
    validateUploadInputMock.mockReturnValue({ ok: false, error: "Invalid filename" });
    const { prepareTripGalleryUploadAction } = await import("@/app/(cms)/media/actions");
    const result = await prepareTripGalleryUploadAction({
      tripId: "TRIP-1",
      fileName: "../../../etc/passwd",
      contentType: "image/jpeg",
      size: 1024,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/filename/i);
  });

  it("returns error when storage provider throws", async () => {
    createUploadTicketMock.mockRejectedValue(new Error("provider unavailable"));
    const { prepareTripGalleryUploadAction } = await import("@/app/(cms)/media/actions");
    const result = await prepareTripGalleryUploadAction({
      tripId: "TRIP-1",
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      size: 1024,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("provider unavailable");
  });
});

// ---------------------------------------------------------------------------
// registerTripGalleryAction
// ---------------------------------------------------------------------------

describe("registerTripGalleryAction", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    createGalleryImageMock.mockResolvedValue({ gallery_id: "GAL-001" });
  });

  it("inserts DB row and revalidates on success", async () => {
    const { registerTripGalleryAction } = await import("@/app/(cms)/media/actions");
    const result = await registerTripGalleryAction({
      tripId: "TRIP-1",
      path: "trip-gallery/TRIP-1/1234-photo.jpg",
      publicUrl: "https://cdn.example.com/trip-gallery/TRIP-1/1234-photo.jpg",
      category: "gallery",
      altText: "Mountain sunset",
      caption: "Spiti Valley",
    });
    expect(result.success).toBe(true);
    expect(createGalleryImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        trip_id: "TRIP-1",
        image_url: "https://cdn.example.com/trip-gallery/TRIP-1/1234-photo.jpg",
        image_path: "trip-gallery/TRIP-1/1234-photo.jpg",
        category: "gallery",
        alt_text: "Mountain sunset",
        caption: "Spiti Valley",
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/media");
    expect(revalidateHomeMock).toHaveBeenCalled();
  });

  it("logs activity after insert", async () => {
    const { registerTripGalleryAction } = await import("@/app/(cms)/media/actions");
    await registerTripGalleryAction({
      tripId: "TRIP-1",
      path: "trip-gallery/TRIP-1/1234-photo.jpg",
      publicUrl: "https://cdn.example.com/img.jpg",
      category: "gallery",
    });
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ table_name: "trip_gallery", action: "INSERT" }),
    );
  });

  it("returns error if DB insert throws", async () => {
    createGalleryImageMock.mockRejectedValue(new Error("duplicate key"));
    const { registerTripGalleryAction } = await import("@/app/(cms)/media/actions");
    const result = await registerTripGalleryAction({
      tripId: "TRIP-1",
      path: "trip-gallery/TRIP-1/1234.jpg",
      publicUrl: "https://cdn.example.com/img.jpg",
      category: "gallery",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("duplicate key");
  });

  it("uses null for optional altText and caption when not provided", async () => {
    const { registerTripGalleryAction } = await import("@/app/(cms)/media/actions");
    await registerTripGalleryAction({
      tripId: "TRIP-2",
      path: "trip-gallery/TRIP-2/abc.jpg",
      publicUrl: "https://cdn.example.com/img.jpg",
      category: "cover",
    });
    expect(createGalleryImageMock).toHaveBeenCalledWith(
      expect.objectContaining({ alt_text: null, caption: null }),
    );
  });
});

// ---------------------------------------------------------------------------
// prepareSiteGalleryUploadAction
// ---------------------------------------------------------------------------

describe("prepareSiteGalleryUploadAction", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    validateUploadInputMock.mockReturnValue({ ok: true });
    buildPathMock.mockReturnValue("site-gallery/1234-photo.jpg");
    createUploadTicketMock.mockResolvedValue(FAKE_TICKET);
  });

  it("returns a ticket on valid input", async () => {
    const { prepareSiteGalleryUploadAction } = await import("@/app/(cms)/media/actions");
    const result = await prepareSiteGalleryUploadAction({
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      size: 1024 * 1024,
    });
    expect(result.success).toBe(true);
  });

  it("calls validateUploadInput with 'siteGallery' kind", async () => {
    const { prepareSiteGalleryUploadAction } = await import("@/app/(cms)/media/actions");
    await prepareSiteGalleryUploadAction({
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      size: 1024,
    });
    expect(validateUploadInputMock).toHaveBeenCalledWith(
      "siteGallery",
      expect.objectContaining({ fileName: "photo.jpg" }),
    );
  });

  it("returns error when validation fails", async () => {
    validateUploadInputMock.mockReturnValue({ ok: false, error: "File type not allowed" });
    const { prepareSiteGalleryUploadAction } = await import("@/app/(cms)/media/actions");
    const result = await prepareSiteGalleryUploadAction({
      fileName: "video.mp4",
      contentType: "video/mp4",
      size: 1024,
    });
    expect(result.success).toBe(false);
  });

  it("returns error when provider throws", async () => {
    createUploadTicketMock.mockRejectedValue(new Error("storage down"));
    const { prepareSiteGalleryUploadAction } = await import("@/app/(cms)/media/actions");
    const result = await prepareSiteGalleryUploadAction({
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      size: 1024,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("storage down");
  });
});

// ---------------------------------------------------------------------------
// registerSiteGalleryAction
// ---------------------------------------------------------------------------

describe("registerSiteGalleryAction", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    createSiteGalleryImageMock.mockResolvedValue({ gallery_id: "SGL-001" });
  });

  it("inserts DB row with given category and revalidates", async () => {
    const { registerSiteGalleryAction } = await import("@/app/(cms)/media/actions");
    const result = await registerSiteGalleryAction({
      path: "site-gallery/1234-photo.jpg",
      publicUrl: "https://cdn.example.com/site-gallery/photo.jpg",
      category: "landscapes",
    });
    expect(result.success).toBe(true);
    expect(createSiteGalleryImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        image_url: "https://cdn.example.com/site-gallery/photo.jpg",
        image_path: "site-gallery/1234-photo.jpg",
        category: "landscapes",
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/media");
    expect(revalidateHomeMock).toHaveBeenCalled();
  });

  it("returns error if DB insert throws", async () => {
    createSiteGalleryImageMock.mockRejectedValue(new Error("constraint violation"));
    const { registerSiteGalleryAction } = await import("@/app/(cms)/media/actions");
    const result = await registerSiteGalleryAction({
      path: "site-gallery/abc.jpg",
      publicUrl: "https://cdn.example.com/abc.jpg",
      category: "gallery",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("constraint violation");
  });
});

// ---------------------------------------------------------------------------
// prepareRawMomentUploadAction
// ---------------------------------------------------------------------------

describe("prepareRawMomentUploadAction", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    validateUploadInputMock.mockReturnValue({ ok: true });
    buildPathMock.mockReturnValue("raw-moments/1234-photo.jpg");
    createUploadTicketMock.mockResolvedValue(FAKE_TICKET);
  });

  it("returns a ticket on valid input", async () => {
    const { prepareRawMomentUploadAction } = await import("@/app/(cms)/media/actions");
    const result = await prepareRawMomentUploadAction({
      fileName: "moment.jpg",
      contentType: "image/jpeg",
      size: 2 * 1024 * 1024,
    });
    expect(result.success).toBe(true);
  });

  it("calls validateUploadInput with 'rawMoment' kind", async () => {
    const { prepareRawMomentUploadAction } = await import("@/app/(cms)/media/actions");
    await prepareRawMomentUploadAction({
      fileName: "moment.jpg",
      contentType: "image/jpeg",
      size: 1024,
    });
    expect(validateUploadInputMock).toHaveBeenCalledWith(
      "rawMoment",
      expect.objectContaining({ fileName: "moment.jpg" }),
    );
  });

  it("returns error when validation fails", async () => {
    validateUploadInputMock.mockReturnValue({ ok: false, error: "File too large — max 20 MB" });
    const { prepareRawMomentUploadAction } = await import("@/app/(cms)/media/actions");
    const result = await prepareRawMomentUploadAction({
      fileName: "big.jpg",
      contentType: "image/jpeg",
      size: 25 * 1024 * 1024,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/too large/i);
  });
});

// ---------------------------------------------------------------------------
// registerRawMomentAction
// ---------------------------------------------------------------------------

describe("registerRawMomentAction", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    createRawMomentMock.mockResolvedValue({ moment_id: "MOM-001" });
  });

  it("inserts DB row with optional fields and revalidates", async () => {
    const { registerRawMomentAction } = await import("@/app/(cms)/media/actions");
    const result = await registerRawMomentAction({
      path: "raw-moments/1234-moment.jpg",
      publicUrl: "https://cdn.example.com/raw-moments/moment.jpg",
      location: "Spiti Valley",
      caption: "Golden hour",
      tags: ["landscape", "mountains"],
    });
    expect(result.success).toBe(true);
    expect(createRawMomentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        image_url: "https://cdn.example.com/raw-moments/moment.jpg",
        image_path: "raw-moments/1234-moment.jpg",
        location: "Spiti Valley",
        caption: "Golden hour",
        tags: ["landscape", "mountains"],
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/media");
    expect(revalidateHomeMock).toHaveBeenCalled();
  });

  it("uses defaults for unspecified optional fields", async () => {
    const { registerRawMomentAction } = await import("@/app/(cms)/media/actions");
    await registerRawMomentAction({
      path: "raw-moments/abc.jpg",
      publicUrl: "https://cdn.example.com/abc.jpg",
    });
    expect(createRawMomentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        location: null,
        caption: null,
        tags: [],
      }),
    );
  });

  it("returns error if DB insert throws", async () => {
    createRawMomentMock.mockRejectedValue(new Error("db error"));
    const { registerRawMomentAction } = await import("@/app/(cms)/media/actions");
    const result = await registerRawMomentAction({
      path: "raw-moments/abc.jpg",
      publicUrl: "https://cdn.example.com/abc.jpg",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("db error");
  });
});
