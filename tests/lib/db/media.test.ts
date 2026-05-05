import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseFake, type SupabaseFake } from "../../_helpers/supabase-fake";
let current: SupabaseFake = makeSupabaseFake();
vi.mock("@/lib/supabase/server", () => ({ getServiceClient: () => current.client }));

import {
  getTripGalleryImages, createGalleryImage, updateGalleryImage, deleteGalleryImage,
  toggleGalleryFeatured, toggleGalleryCover,
  getSiteGalleryImages, createSiteGalleryImage, updateSiteGalleryImage, deleteSiteGalleryImage,
  getRawMoments, createRawMoment, updateRawMoment, deleteRawMoment,
} from "@/lib/db/media";

beforeEach(() => { current = makeSupabaseFake(); });

describe("trip_gallery", () => {
  it("getTripGalleryImages returns rows / throws on error", async () => {
    current = makeSupabaseFake({ "trip_gallery:select": { data: [{ gallery_id: "GAL-1" }], error: null } });
    expect(await getTripGalleryImages("TRIP-1")).toHaveLength(1);
    current = makeSupabaseFake({ "trip_gallery:select": { data: null, error: { message: "x" } } });
    await expect(getTripGalleryImages("TRIP-1")).rejects.toThrow();
  });
  it("createGalleryImage generates GAL id and inserts", async () => {
    current = makeSupabaseFake({
      "rpc:nm_next_sequential_id": { data: "GAL-001", error: null },
      "trip_gallery:insert": { data: { gallery_id: "GAL-001" }, error: null },
    });
    const r = await createGalleryImage("TRIP-1", { image_url: "https://x.io/1.jpg", category: "gallery" } as any);
    expect(r.gallery_id).toBe("GAL-001");
  });
  it("createGalleryImage throws on insert error", async () => {
    current = makeSupabaseFake({
      "rpc:nm_next_sequential_id": { data: "GAL-001", error: null },
      "trip_gallery:insert": { data: null, error: { message: "x" } },
    });
    await expect(createGalleryImage("TRIP-1", {} as any)).rejects.toThrow();
  });
  it("updateGalleryImage throws / succeeds", async () => {
    current = makeSupabaseFake({ "trip_gallery:update": { data: null, error: { message: "x" } } });
    await expect(updateGalleryImage("GAL-1", {} as any)).rejects.toThrow();
    current = makeSupabaseFake({ "trip_gallery:update": { data: { gallery_id: "GAL-1" }, error: null } });
    await expect(updateGalleryImage("GAL-1", {} as any)).resolves.toBeDefined();
  });
  it("deleteGalleryImage throws / succeeds", async () => {
    current = makeSupabaseFake({ "trip_gallery:delete": { data: null, error: { message: "x" } } });
    await expect(deleteGalleryImage("GAL-1")).rejects.toThrow();
    current = makeSupabaseFake({ "trip_gallery:delete": { data: null, error: null } });
    await expect(deleteGalleryImage("GAL-1")).resolves.toBeUndefined();
  });
  it("toggleGalleryFeatured updates is_featured / throws on error", async () => {
    current = makeSupabaseFake({ "trip_gallery:update": { data: null, error: null } });
    await toggleGalleryFeatured("GAL-1", true);
    expect((current.log.find((l) => l.op === "update") as any).payload.is_featured).toBe(true);
    current = makeSupabaseFake({ "trip_gallery:update": { data: null, error: { message: "x" } } });
    await expect(toggleGalleryFeatured("GAL-1", true)).rejects.toThrow();
  });
  it("toggleGalleryCover calls nm_set_trip_cover_image RPC atomically", async () => {
    current = makeSupabaseFake({ "rpc:nm_set_trip_cover_image": { data: null, error: null } });
    await toggleGalleryCover("TRIP-1", "GAL-1");
    expect(current.log[0]).toMatchObject({
      rpc: "nm_set_trip_cover_image",
      args: { p_trip_id: "TRIP-1", p_gallery_id: "GAL-1" },
    });
  });
  it("toggleGalleryCover throws on RPC error", async () => {
    current = makeSupabaseFake({ "rpc:nm_set_trip_cover_image": { data: null, error: { message: "x" } } });
    await expect(toggleGalleryCover("TRIP-1", "GAL-1")).rejects.toThrow();
  });
});

describe("site_gallery", () => {
  it("getSiteGalleryImages / errors", async () => {
    current = makeSupabaseFake({ "site_gallery:select": { data: [{ gallery_id: "SGL-1" }], error: null } });
    expect(await getSiteGalleryImages()).toHaveLength(1);
    current = makeSupabaseFake({ "site_gallery:select": { data: null, error: { message: "x" } } });
    await expect(getSiteGalleryImages()).rejects.toThrow();
  });
  it("createSiteGalleryImage generates SGL id / throws", async () => {
    current = makeSupabaseFake({
      "rpc:nm_next_sequential_id": { data: "SGL-001", error: null },
      "site_gallery:insert": { data: { gallery_id: "SGL-001" }, error: null },
    });
    expect((await createSiteGalleryImage({} as any)).gallery_id).toBe("SGL-001");
    current = makeSupabaseFake({
      "rpc:nm_next_sequential_id": { data: "SGL-001", error: null },
      "site_gallery:insert": { data: null, error: { message: "x" } },
    });
    await expect(createSiteGalleryImage({} as any)).rejects.toThrow();
  });
  it("updateSiteGalleryImage throws / succeeds", async () => {
    current = makeSupabaseFake({ "site_gallery:update": { data: null, error: { message: "x" } } });
    await expect(updateSiteGalleryImage("SGL-1", {} as any)).rejects.toThrow();
    current = makeSupabaseFake({ "site_gallery:update": { data: { gallery_id: "SGL-1" }, error: null } });
    await expect(updateSiteGalleryImage("SGL-1", {} as any)).resolves.toBeDefined();
  });
  it("deleteSiteGalleryImage throws / succeeds", async () => {
    current = makeSupabaseFake({ "site_gallery:delete": { data: null, error: { message: "x" } } });
    await expect(deleteSiteGalleryImage("SGL-1")).rejects.toThrow();
    current = makeSupabaseFake({ "site_gallery:delete": { data: null, error: null } });
    await expect(deleteSiteGalleryImage("SGL-1")).resolves.toBeUndefined();
  });
});

describe("raw_moments", () => {
  it("getRawMoments / errors", async () => {
    current = makeSupabaseFake({ "raw_moments:select": { data: [{ moment_id: "MOM-1" }], error: null } });
    expect(await getRawMoments()).toHaveLength(1);
    current = makeSupabaseFake({ "raw_moments:select": { data: null, error: { message: "x" } } });
    await expect(getRawMoments()).rejects.toThrow();
  });
  it("createRawMoment generates MOM id / throws", async () => {
    current = makeSupabaseFake({
      "rpc:nm_next_sequential_id": { data: "MOM-001", error: null },
      "raw_moments:insert": { data: { moment_id: "MOM-001" }, error: null },
    });
    expect((await createRawMoment({} as any)).moment_id).toBe("MOM-001");
    current = makeSupabaseFake({
      "rpc:nm_next_sequential_id": { data: "MOM-001", error: null },
      "raw_moments:insert": { data: null, error: { message: "x" } },
    });
    await expect(createRawMoment({} as any)).rejects.toThrow();
  });
  it("updateRawMoment throws / succeeds", async () => {
    current = makeSupabaseFake({ "raw_moments:update": { data: null, error: { message: "x" } } });
    await expect(updateRawMoment("MOM-1", {} as any)).rejects.toThrow();
    current = makeSupabaseFake({ "raw_moments:update": { data: { moment_id: "MOM-1" }, error: null } });
    await expect(updateRawMoment("MOM-1", {} as any)).resolves.toBeDefined();
  });
  it("deleteRawMoment throws / succeeds", async () => {
    current = makeSupabaseFake({ "raw_moments:delete": { data: null, error: { message: "x" } } });
    await expect(deleteRawMoment("MOM-1")).rejects.toThrow();
    current = makeSupabaseFake({ "raw_moments:delete": { data: null, error: null } });
    await expect(deleteRawMoment("MOM-1")).resolves.toBeUndefined();
  });
});
