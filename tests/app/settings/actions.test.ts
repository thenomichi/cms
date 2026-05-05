const revalidatePathMock = vi.fn();
const updateSiteSettingsMock = vi.fn();
const getTripsMock = vi.fn();
const revalidateWebsiteMock = vi.fn();
const logActivityMock = vi.fn();
const nextSequentialIdMock = vi.fn();
const uploadImageMock = vi.fn();
const getServiceClientMock = vi.fn();
const getBucketMock = vi.fn();
const updateBucketMock = vi.fn();

function makeServiceClient() {
  return {
    from: vi.fn(() => ({
      insert: vi.fn(async () => ({ error: null })),
      select: vi.fn(() => ({
        in: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(async () => ({ data: [] })),
            })),
          })),
        })),
      })),
    })),
    storage: {
      getBucket: getBucketMock,
      updateBucket: updateBucketMock,
    },
  };
}

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));
vi.mock("@/lib/db/settings", () => ({
  updateSiteSettings: (...args: unknown[]) => updateSiteSettingsMock(...args),
}));
vi.mock("@/lib/db/trips", () => ({
  getTrips: (...args: unknown[]) => getTripsMock(...args),
}));
vi.mock("@/lib/revalidate", () => ({
  revalidateWebsite: (...args: unknown[]) => revalidateWebsiteMock(...args),
}));
vi.mock("@/lib/audit", () => ({
  logActivity: (...args: unknown[]) => logActivityMock(...args),
}));
vi.mock("@/lib/ids", () => ({
  nextSequentialId: (...args: unknown[]) => nextSequentialIdMock(...args),
}));
vi.mock("@/lib/storage/upload", () => ({
  uploadImage: (...args: unknown[]) => uploadImageMock(...args),
}));
vi.mock("@/lib/supabase/server", () => ({
  getServiceClient: () => getServiceClientMock(),
}));

describe("updateSettingsAction", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getBucketMock.mockResolvedValue({
      data: {
        public: true,
        file_size_limit: 5 * 1024 * 1024,
        allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
      },
      error: null,
    });
    updateBucketMock.mockResolvedValue({ data: {}, error: null });
    getServiceClientMock.mockReturnValue(makeServiceClient());
  });

  it("persists settings, logs activity, revalidates CMS and website paths", async () => {
    getTripsMock.mockResolvedValue([
      { slug: "spiti" },
      { slug: "spiti" },
      { slug: "meghalaya" },
      { slug: "" },
      { slug: null },
    ]);
    const { updateSettingsAction } = await import(
      "@/app/(cms)/settings/actions"
    );

    const payload = { features: { join_a_trip: { enabled: false } } };
    await expect(updateSettingsAction(payload)).resolves.toEqual({ success: true });

    expect(updateSiteSettingsMock).toHaveBeenCalledWith(payload);
    expect(logActivityMock).toHaveBeenCalledWith({
      table_name: "site_settings",
      record_id: "global",
      action: "UPDATE",
      new_values: payload,
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/settings");
    expect(revalidateWebsiteMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        "/",
        "/join-a-trip",
        "/beyond-ordinary",
        "/signature-journeys",
        "/plan-a-trip",
        "/gift-a-trip",
        "/about",
        "/careers",
        "/sitemap.xml",
        "/trips/spiti",
        "/trips/meghalaya",
      ]),
      ["site-features", "site-settings"],
    );
  });

  it("returns a failure response when saving settings throws", async () => {
    updateSiteSettingsMock.mockRejectedValueOnce(new Error("save failed"));
    const { updateSettingsAction } = await import(
      "@/app/(cms)/settings/actions"
    );

    await expect(updateSettingsAction({})).resolves.toEqual({
      success: false,
      error: "save failed",
    });
    expect(logActivityMock).not.toHaveBeenCalled();
    expect(revalidateWebsiteMock).not.toHaveBeenCalled();
  });

  it("uploads a hero image and stores it for reuse in site gallery", async () => {
    uploadImageMock.mockResolvedValue("https://cdn.test/hero-image.jpg");
    nextSequentialIdMock.mockResolvedValue("SGL001");
    const insertMock = vi.fn(async () => ({ error: null }));
    getServiceClientMock.mockReturnValue({
      from: vi.fn(() => ({
        insert: insertMock,
      })),
      storage: {
        getBucket: getBucketMock,
        updateBucket: updateBucketMock,
      },
    });

    const { uploadHeroImageAction } = await import("@/app/(cms)/settings/actions");
    const formData = new FormData();
    formData.append("file", new File(["image"], "hero.jpg", { type: "image/jpeg" }));

    await expect(uploadHeroImageAction(formData)).resolves.toEqual({
      success: true,
      url: "https://cdn.test/hero-image.jpg",
    });
    expect(uploadImageMock).toHaveBeenCalledWith(expect.any(File), expect.stringMatching(/^settings\/hero\/images\//));
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        gallery_id: "SGL001",
        image_url: "https://cdn.test/hero-image.jpg",
        category: "hero",
      }),
    );
  });

  it("rejects invalid hero video uploads", async () => {
    const { uploadHeroVideoAction } = await import("@/app/(cms)/settings/actions");
    const formData = new FormData();
    formData.append("file", new File(["nope"], "hero.jpg", { type: "image/jpeg" }));

    await expect(uploadHeroVideoAction(formData)).resolves.toEqual({
      success: false,
      error: "Please upload a video file",
    });
    expect(uploadImageMock).not.toHaveBeenCalled();
  });

  it("updates the cms-media bucket to allow video uploads before uploading hero videos", async () => {
    uploadImageMock.mockResolvedValue("https://cdn.test/hero-video.mp4");
    const { uploadHeroVideoAction } = await import("@/app/(cms)/settings/actions");
    const formData = new FormData();
    formData.append("file", new File(["video"], "hero.mp4", { type: "video/mp4" }));

    await expect(uploadHeroVideoAction(formData)).resolves.toEqual({
      success: true,
      url: "https://cdn.test/hero-video.mp4",
    });
    expect(getBucketMock).toHaveBeenCalledWith("cms-media");
    expect(updateBucketMock).toHaveBeenCalledWith(
      "cms-media",
      expect.objectContaining({
        public: true,
        fileSizeLimit: 50 * 1024 * 1024,
        allowedMimeTypes: expect.arrayContaining([
          "image/jpeg",
          "image/png",
          "image/webp",
          "video/mp4",
          "video/webm",
          "video/quicktime",
        ]),
      }),
    );
    expect(uploadImageMock).toHaveBeenCalledWith(
      expect.any(File),
      expect.stringMatching(/^settings\/hero\/videos\//),
    );
  });

  it("skips the bucket update when hero video mime types are already allowed", async () => {
    getBucketMock.mockResolvedValue({
      data: {
        public: true,
        file_size_limit: 50 * 1024 * 1024,
        allowed_mime_types: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "video/mp4",
          "video/webm",
          "video/quicktime",
          "application/pdf",
        ],
      },
      error: null,
    });
    uploadImageMock.mockResolvedValue("https://cdn.test/hero-video.mp4");

    const { uploadHeroVideoAction } = await import("@/app/(cms)/settings/actions");
    const formData = new FormData();
    formData.append("file", new File(["video"], "hero.mp4", { type: "video/mp4" }));

    await uploadHeroVideoAction(formData);
    expect(updateBucketMock).not.toHaveBeenCalled();
  });
});
