import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseFake, type SupabaseFake } from "../../_helpers/supabase-fake";
let current: SupabaseFake = makeSupabaseFake();
vi.mock("@/lib/supabase/server", () => ({ getServiceClient: () => current.client }));
import { getAnnouncements, getAnnouncementById, createAnnouncement, updateAnnouncement, deleteAnnouncement, toggleAnnouncementActive } from "@/lib/db/announcements";
beforeEach(() => { current = makeSupabaseFake(); });

describe("announcements db", () => {
  it("getAnnouncements returns rows with trip_name", async () => {
    current = makeSupabaseFake({ "announcements:select": { data: [{ announcement_id: "ANN-001", trips: { trip_name: "Hampi" } }], error: null } });
    const rows = await getAnnouncements();
    expect(rows).toHaveLength(1);
  });
  it("getAnnouncements throws on error", async () => {
    current = makeSupabaseFake({ "announcements:select": { data: null, error: { message: "x" } } });
    await expect(getAnnouncements()).rejects.toThrow();
  });
  it("getAnnouncementById returns null on missing", async () => {
    current = makeSupabaseFake({ "announcements:select": { data: null, error: { message: "no rows" } } });
    expect(await getAnnouncementById("ANN-X")).toBeNull();
  });
  it("getAnnouncementById returns the row", async () => {
    current = makeSupabaseFake({ "announcements:select": { data: { announcement_id: "ANN-1" }, error: null } });
    expect((await getAnnouncementById("ANN-1"))?.announcement_id).toBe("ANN-1");
  });
  it("createAnnouncement generates ANN id and inserts", async () => {
    current = makeSupabaseFake({
      "rpc:nm_next_sequential_id": { data: "ANN-007", error: null },
      "announcements:insert": { data: { announcement_id: "ANN-007" }, error: null },
    });
    const r = await createAnnouncement({ tag_type: "new", headline: "Hi" } as any);
    expect(r.announcement_id).toBe("ANN-007");
  });
  it("createAnnouncement throws on insert error", async () => {
    current = makeSupabaseFake({
      "rpc:nm_next_sequential_id": { data: "ANN-007", error: null },
      "announcements:insert": { data: null, error: { message: "x" } },
    });
    await expect(createAnnouncement({} as any)).rejects.toThrow();
  });
  it("updateAnnouncement throws / succeeds", async () => {
    current = makeSupabaseFake({ "announcements:update": { data: null, error: { message: "x" } } });
    await expect(updateAnnouncement("ANN-1", {} as any)).rejects.toThrow();
    current = makeSupabaseFake({ "announcements:update": { data: { announcement_id: "ANN-1" }, error: null } });
    await expect(updateAnnouncement("ANN-1", {} as any)).resolves.toBeDefined();
  });
  it("deleteAnnouncement throws / succeeds", async () => {
    current = makeSupabaseFake({ "announcements:delete": { data: null, error: { message: "x" } } });
    await expect(deleteAnnouncement("ANN-1")).rejects.toThrow();
    current = makeSupabaseFake({ "announcements:delete": { data: null, error: null } });
    await expect(deleteAnnouncement("ANN-1")).resolves.toBeUndefined();
  });
  it("toggleAnnouncementActive updates is_active", async () => {
    current = makeSupabaseFake({ "announcements:update": { data: null, error: null } });
    await toggleAnnouncementActive("ANN-1", false);
    const upd = current.log.find((l) => l.op === "update") as any;
    expect(upd.payload.is_active).toBe(false);
  });
  it("toggleAnnouncementActive throws on error", async () => {
    current = makeSupabaseFake({ "announcements:update": { data: null, error: { message: "x" } } });
    await expect(toggleAnnouncementActive("ANN-1", false)).rejects.toThrow();
  });
});
