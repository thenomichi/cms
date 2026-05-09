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

  // uploadHeroImageAction and uploadHeroVideoAction were replaced by the
  // prepare+register direct-upload pattern. Tests for the new actions live in
  // tests/app/settings-upload.test.ts.
});
