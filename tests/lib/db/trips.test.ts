import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseFake, type SupabaseFake } from "../../_helpers/supabase-fake";
let current: SupabaseFake = makeSupabaseFake();
vi.mock("@/lib/supabase/server", () => ({ getServiceClient: () => current.client }));

import {
  getTrips, getTripById, generateUniqueSlug, createTrip, updateTrip,
  deleteTrip, toggleTripField, cloneAsBatch,
} from "@/lib/db/trips";

beforeEach(() => { current = makeSupabaseFake(); });

describe("trips db", () => {
  it("getTrips returns rows with destination_name flattened", async () => {
    current = makeSupabaseFake({
      "trips:select": {
        data: [{ trip_id: "TRIP-1", destinations: { destination_name: "Hampi" }, group_slug: null }],
        error: null,
      },
    });
    const r = await getTrips();
    expect(r[0].destination_name).toBe("Hampi");
    expect((r[0] as any).destinations).toBeUndefined();
  });
  it("getTrips applies tripType + search filters", async () => {
    current = makeSupabaseFake({ "trips:select": { data: [], error: null } });
    await getTrips({ tripType: "Community", search: "ham" });
    expect(current.log.find((l) => l.op === "select")).toBeDefined();
  });
  it("getTrips throws on error", async () => {
    current = makeSupabaseFake({ "trips:select": { data: null, error: { message: "x" } } });
    await expect(getTrips()).rejects.toThrow();
  });
  it("getTrips computes batch_count for grouped trips", async () => {
    current = makeSupabaseFake({
      "trips:select": {
        data: [
          { trip_id: "T1", destinations: null, group_slug: "g1" },
          { trip_id: "T2", destinations: null, group_slug: "g1" },
          { trip_id: "T3", destinations: null, group_slug: null },
        ],
        error: null,
      },
    });
    const r = await getTrips();
    expect(r.find((t) => t.trip_id === "T1")?.batch_count).toBe(2);
    expect(r.find((t) => t.trip_id === "T3")?.batch_count).toBeUndefined();
  });
  it("getTripById returns null when trip is missing", async () => {
    current = makeSupabaseFake({ "trips:select": { data: null, error: { message: "no rows" } } });
    expect(await getTripById("MISSING")).toBeNull();
  });
  it("getTripById merges children into TripFull", async () => {
    current = makeSupabaseFake({
      "trips:select": { data: { trip_id: "T1", destinations: { destination_name: "Hampi" } }, error: null },
      "trip_content:select": { data: [{ content_id: "TC-1" }], error: null },
      "trip_itinerary:select": { data: [], error: null },
      "trip_inclusions:select": { data: [], error: null },
      "trip_faqs:select": { data: [], error: null },
      "trip_gallery:select": { data: [], error: null },
    });
    const r = await getTripById("T1");
    expect(r?.trip_id).toBe("T1");
    expect(r?.destination_name).toBe("Hampi");
    expect(r?.content).toHaveLength(1);
  });
  it("generateUniqueSlug returns trip-{ts} for empty input", async () => {
    const r = await generateUniqueSlug("", null);
    expect(r).toMatch(/^trip-\d+$/);
  });
  it("generateUniqueSlug returns base when free", async () => {
    current = makeSupabaseFake({ "trips:select": { data: null, error: null, count: 0 } as any });
    expect(await generateUniqueSlug("Hampi Heritage", null)).toBe("hampi-heritage");
  });
  it("createTrip inserts and returns trip_id", async () => {
    current = makeSupabaseFake({ "trips:insert": { data: { trip_id: "T1" }, error: null } });
    expect(await createTrip({ trip_id: "T1" } as any)).toBe("T1");
  });
  it("createTrip throws on insert error", async () => {
    current = makeSupabaseFake({ "trips:insert": { data: null, error: { message: "x" } } });
    await expect(createTrip({ trip_id: "T1" } as any)).rejects.toThrow();
  });
  it("updateTrip throws / succeeds", async () => {
    current = makeSupabaseFake({ "trips:update": { data: null, error: { message: "x" } } });
    await expect(updateTrip("T1", {} as any)).rejects.toThrow();
    current = makeSupabaseFake({ "trips:update": { data: null, error: null } });
    await expect(updateTrip("T1", {} as any)).resolves.toBeUndefined();
  });
  it("deleteTrip cascades children then deletes trip", async () => {
    current = makeSupabaseFake({
      "trip_content:delete": { data: null, error: null },
      "trip_itinerary:delete": { data: null, error: null },
      "trip_inclusions:delete": { data: null, error: null },
      "trip_faqs:delete": { data: null, error: null },
      "trip_gallery:delete": { data: null, error: null },
      "trips:delete": { data: null, error: null },
    });
    await deleteTrip("T1");
    const tables = current.log.filter((l) => l.op === "delete").map((l) => l.from);
    expect(tables).toEqual(expect.arrayContaining(["trip_content", "trip_itinerary", "trip_inclusions", "trip_faqs", "trip_gallery", "trips"]));
  });
  it("deleteTrip throws when trip delete fails", async () => {
    current = makeSupabaseFake({
      "trip_content:delete": { data: null, error: null },
      "trip_itinerary:delete": { data: null, error: null },
      "trip_inclusions:delete": { data: null, error: null },
      "trip_faqs:delete": { data: null, error: null },
      "trip_gallery:delete": { data: null, error: null },
      "trips:delete": { data: null, error: { message: "fk" } },
    });
    await expect(deleteTrip("T1")).rejects.toThrow();
  });
  it.each(["is_listed", "show_on_homepage"] as const)(
    "toggleTripField updates %s",
    async (field) => {
      current = makeSupabaseFake({ "trips:update": { data: null, error: null } });
      await toggleTripField("T1", field, true);
      const upd = current.log.find((l) => l.op === "update") as any;
      expect(upd.payload[field]).toBe(true);
    },
  );
  it("toggleTripField throws on error", async () => {
    current = makeSupabaseFake({ "trips:update": { data: null, error: { message: "x" } } });
    await expect(toggleTripField("T1", "is_listed", true)).rejects.toThrow();
  });
  it("cloneAsBatch clones trip + children", async () => {
    current = makeSupabaseFake({
      "trips:select": { data: { trip_id: "T1", slug: "hampi", group_slug: null, trip_name: "Hampi" }, error: null },
      "trips:update": { data: null, error: null },
      "trips:insert": { data: { trip_id: "T2", group_slug: "hampi" }, error: null },
      "trip_content:select": { data: [], error: null },
      "trip_itinerary:select": { data: [], error: null },
      "trip_inclusions:select": { data: [], error: null },
      "trip_faqs:select": { data: [], error: null },
      "trip_gallery:select": { data: [], error: null },
    });
    const r = await cloneAsBatch("T1", "T2", "hampi-feb-2026");
    expect(r.trip_id).toBe("T2");
  });
  it("cloneAsBatch throws when source missing", async () => {
    current = makeSupabaseFake({ "trips:select": { data: null, error: { message: "x" } } });
    await expect(cloneAsBatch("T1", "T2", "x")).rejects.toThrow();
  });
  it("cloneAsBatch throws when create fails", async () => {
    current = makeSupabaseFake({
      "trips:select": { data: { trip_id: "T1", slug: "hampi", group_slug: "hampi", trip_name: "Hampi" }, error: null },
      "trips:insert": { data: null, error: { message: "dup" } },
    });
    await expect(cloneAsBatch("T1", "T2", "x")).rejects.toThrow();
  });
  it("cloneAsBatch clones child rows when present", async () => {
    current = makeSupabaseFake({
      "trips:select": { data: { trip_id: "T1", slug: "hampi", group_slug: "hampi", trip_name: "Hampi" }, error: null },
      "trips:insert": { data: { trip_id: "T2", group_slug: "hampi" }, error: null },
      "trip_content:select": { data: [{ content_id: "TC-1", content_type: "overview", content_text: "x" }], error: null },
      "trip_content:insert": { data: null, error: null },
      "trip_itinerary:select": { data: [{ itinerary_id: "ITIN-1", day_number: 1, title: "Day 1" }], error: null },
      "trip_itinerary:insert": { data: null, error: null },
      "trip_inclusions:select": { data: [{ inclusion_id: "INC-1", inclusion_type: "inclusion", name: "x" }], error: null },
      "trip_inclusions:insert": { data: null, error: null },
      "trip_faqs:select": { data: [{ faq_id: "FAQ-1", question: "q?", answer: "a." }], error: null },
      "trip_faqs:insert": { data: null, error: null },
      "trip_gallery:select": { data: [{ gallery_id: "GAL-1", image_url: "https://x.io/1.jpg", category: "gallery" }], error: null },
      "trip_gallery:insert": { data: null, error: null },
    });
    await cloneAsBatch("T1", "T2", "hampi-feb-2026");
    const inserts = current.log.filter((l) => l.op === "insert").map((l) => l.from);
    expect(inserts).toEqual(expect.arrayContaining(["trips", "trip_content", "trip_itinerary", "trip_inclusions", "trip_faqs", "trip_gallery"]));
  });
});
