import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseFake, type SupabaseFake } from "../../_helpers/supabase-fake";
let current: SupabaseFake = makeSupabaseFake();
vi.mock("@/lib/supabase/server", () => ({ getServiceClient: () => current.client }));

import { getTripContent, upsertTripContent, deleteTripContent, upsertHighlights } from "@/lib/db/trip-content";
import { getTripItinerary, saveTripItinerary } from "@/lib/db/trip-itinerary";
import { getTripInclusions, saveTripInclusions } from "@/lib/db/trip-inclusions";
import { getFaqs, getFaqById, createFaq, updateFaq, deleteFaq } from "@/lib/db/trip-faqs";

beforeEach(() => { current = makeSupabaseFake(); });

describe("trip-content db", () => {
  it("getTripContent returns rows", async () => {
    current = makeSupabaseFake({ "trip_content:select": { data: [{ content_id: "TC-001" }], error: null } });
    expect(await getTripContent("TRIP-1")).toHaveLength(1);
  });
  it("getTripContent throws on error", async () => {
    current = makeSupabaseFake({ "trip_content:select": { data: null, error: { message: "x" } } });
    await expect(getTripContent("TRIP-1")).rejects.toThrow();
  });
  it("upsertTripContent updates when row exists", async () => {
    current = makeSupabaseFake({
      "trip_content:select": { data: { content_id: "TC-001" }, error: null },
      "trip_content:update": { data: null, error: null },
    });
    await upsertTripContent("TRIP-1", "overview", "new text");
    expect(current.log.find((l) => l.op === "update")).toBeDefined();
  });
  it("upsertTripContent inserts when row missing", async () => {
    current = makeSupabaseFake({
      "trip_content:select": { data: null, error: null },
      "rpc:nm_next_sequential_id": { data: "TC-001", error: null },
      "trip_content:insert": { data: null, error: null },
    });
    await upsertTripContent("TRIP-1", "overview", "text");
    expect(current.log.find((l) => l.op === "insert" && l.from === "trip_content")).toBeDefined();
  });
  it("upsertTripContent throws when update fails", async () => {
    current = makeSupabaseFake({
      "trip_content:select": { data: { content_id: "TC-001" }, error: null },
      "trip_content:update": { data: null, error: { message: "x" } },
    });
    await expect(upsertTripContent("TRIP-1", "overview", "x")).rejects.toThrow();
  });
  it("upsertTripContent throws when insert fails", async () => {
    current = makeSupabaseFake({
      "trip_content:select": { data: null, error: null },
      "rpc:nm_next_sequential_id": { data: "TC-001", error: null },
      "trip_content:insert": { data: null, error: { message: "x" } },
    });
    await expect(upsertTripContent("TRIP-1", "overview", "x")).rejects.toThrow();
  });
  it("deleteTripContent throws / succeeds", async () => {
    current = makeSupabaseFake({ "trip_content:delete": { data: null, error: { message: "x" } } });
    await expect(deleteTripContent("TC-1")).rejects.toThrow();
    current = makeSupabaseFake({ "trip_content:delete": { data: null, error: null } });
    await expect(deleteTripContent("TC-1")).resolves.toBeUndefined();
  });
  it("upsertHighlights with empty array does nothing", async () => {
    current = makeSupabaseFake({ "trip_content:delete": { data: null, error: null } });
    await upsertHighlights("TRIP-1", []);
    // Should not have an insert op
    expect(current.log.find((l) => l.op === "insert")).toBeUndefined();
  });
  it("upsertHighlights deletes then inserts new rows", async () => {
    current = makeSupabaseFake({
      "trip_content:delete": { data: null, error: null },
      "rpc:nm_next_sequential_id": { data: "TC-001", error: null },
      "trip_content:insert": { data: null, error: null },
    });
    await upsertHighlights("TRIP-1", ["a", "b", "c"]);
    expect(current.log.filter((l) => l.rpc === "nm_next_sequential_id")).toHaveLength(3);
  });
  it("upsertHighlights throws on insert error", async () => {
    current = makeSupabaseFake({
      "trip_content:delete": { data: null, error: null },
      "rpc:nm_next_sequential_id": { data: "TC-001", error: null },
      "trip_content:insert": { data: null, error: { message: "x" } },
    });
    await expect(upsertHighlights("TRIP-1", ["a"])).rejects.toThrow();
  });
});

describe("trip-itinerary db", () => {
  it("getTripItinerary returns rows", async () => {
    current = makeSupabaseFake({ "trip_itinerary:select": { data: [{ itinerary_id: "ITIN-001" }], error: null } });
    expect(await getTripItinerary("TRIP-1")).toHaveLength(1);
  });
  it("getTripItinerary throws on error", async () => {
    current = makeSupabaseFake({ "trip_itinerary:select": { data: null, error: { message: "x" } } });
    await expect(getTripItinerary("TRIP-1")).rejects.toThrow();
  });
  it("saveTripItinerary with empty days only deletes", async () => {
    current = makeSupabaseFake({ "trip_itinerary:delete": { data: null, error: null } });
    await saveTripItinerary("TRIP-1", []);
    expect(current.log.find((l) => l.op === "insert")).toBeUndefined();
  });
  it("saveTripItinerary inserts rows", async () => {
    current = makeSupabaseFake({
      "trip_itinerary:delete": { data: null, error: null },
      "rpc:nm_next_sequential_id": { data: "ITIN-001", error: null },
      "trip_itinerary:insert": { data: null, error: null },
    });
    await saveTripItinerary("TRIP-1", [{ day_number: 1, title: "Day 1" }, { day_number: 2, title: "Day 2" }]);
    expect(current.log.filter((l) => l.rpc).length).toBe(2);
  });
  it("saveTripItinerary throws on insert error", async () => {
    current = makeSupabaseFake({
      "trip_itinerary:delete": { data: null, error: null },
      "rpc:nm_next_sequential_id": { data: "ITIN-001", error: null },
      "trip_itinerary:insert": { data: null, error: { message: "x" } },
    });
    await expect(saveTripItinerary("TRIP-1", [{ day_number: 1, title: "x" }])).rejects.toThrow();
  });
});

describe("trip-inclusions db", () => {
  it("getTripInclusions splits inclusion / exclusion rows", async () => {
    current = makeSupabaseFake({
      "trip_inclusions:select": {
        data: [
          { inclusion_id: "INC-001", inclusion_type: "inclusion", name: "Hotel" },
          { inclusion_id: "INC-002", inclusion_type: "exclusion", name: "Flights" },
        ],
        error: null,
      },
    });
    const r = await getTripInclusions("TRIP-1");
    expect(r.inclusions).toHaveLength(1);
    expect(r.exclusions).toHaveLength(1);
  });
  it("getTripInclusions throws on error", async () => {
    current = makeSupabaseFake({ "trip_inclusions:select": { data: null, error: { message: "x" } } });
    await expect(getTripInclusions("TRIP-1")).rejects.toThrow();
  });
  it("saveTripInclusions with empty arrays only deletes", async () => {
    current = makeSupabaseFake({ "trip_inclusions:delete": { data: null, error: null } });
    await saveTripInclusions("TRIP-1", [], []);
    expect(current.log.find((l) => l.op === "insert")).toBeUndefined();
  });
  it("saveTripInclusions inserts inclusion + exclusion rows", async () => {
    current = makeSupabaseFake({
      "trip_inclusions:delete": { data: null, error: null },
      "rpc:nm_next_sequential_id": { data: "INC-001", error: null },
      "trip_inclusions:insert": { data: null, error: null },
    });
    await saveTripInclusions("TRIP-1", [{ name: "Hotel" }], [{ name: "Flights" }]);
    expect(current.log.filter((l) => l.rpc).length).toBe(2);
  });
  it("saveTripInclusions throws on insert error", async () => {
    current = makeSupabaseFake({
      "trip_inclusions:delete": { data: null, error: null },
      "rpc:nm_next_sequential_id": { data: "INC-001", error: null },
      "trip_inclusions:insert": { data: null, error: { message: "x" } },
    });
    await expect(saveTripInclusions("TRIP-1", [{ name: "Hotel" }], [])).rejects.toThrow();
  });
});

describe("trip-faqs db", () => {
  it("getFaqs returns rows with trip_name", async () => {
    current = makeSupabaseFake({ "trip_faqs:select": { data: [{ faq_id: "FAQ-001", trips: { trip_name: "Hampi" } }], error: null } });
    const r = await getFaqs();
    expect(r[0].trip_name).toBe("Hampi");
  });
  it("getFaqs throws on error", async () => {
    current = makeSupabaseFake({ "trip_faqs:select": { data: null, error: { message: "x" } } });
    await expect(getFaqs()).rejects.toThrow();
  });
  it("getFaqs filters by tripId", async () => {
    current = makeSupabaseFake({ "trip_faqs:select": { data: [], error: null } });
    await getFaqs("TRIP-1");
    expect(current.log.find((l) => l.op === "select")).toBeDefined();
  });
  it("getFaqById returns null on missing", async () => {
    current = makeSupabaseFake({ "trip_faqs:select": { data: null, error: { message: "no rows" } } });
    expect(await getFaqById("FAQ-X")).toBeNull();
  });
  it("getFaqById returns the row", async () => {
    current = makeSupabaseFake({ "trip_faqs:select": { data: { faq_id: "FAQ-1" }, error: null } });
    expect((await getFaqById("FAQ-1"))?.faq_id).toBe("FAQ-1");
  });
  it("createFaq throws on insert error", async () => {
    current = makeSupabaseFake({ "trip_faqs:insert": { data: null, error: { message: "x" } } });
    await expect(createFaq({ faq_id: "FAQ-1", trip_id: null, question: "Q?", answer: "A!" } as any)).rejects.toThrow();
  });
  it("createFaq returns the inserted row", async () => {
    current = makeSupabaseFake({ "trip_faqs:insert": { data: { faq_id: "FAQ-1" }, error: null } });
    expect((await createFaq({ faq_id: "FAQ-1" } as any)).faq_id).toBe("FAQ-1");
  });
  it("updateFaq throws / succeeds", async () => {
    current = makeSupabaseFake({ "trip_faqs:update": { data: null, error: { message: "x" } } });
    await expect(updateFaq("FAQ-1", {} as any)).rejects.toThrow();
    current = makeSupabaseFake({ "trip_faqs:update": { data: { faq_id: "FAQ-1" }, error: null } });
    await expect(updateFaq("FAQ-1", {} as any)).resolves.toBeDefined();
  });
  it("deleteFaq throws / succeeds", async () => {
    current = makeSupabaseFake({ "trip_faqs:delete": { data: null, error: { message: "x" } } });
    await expect(deleteFaq("FAQ-1")).rejects.toThrow();
    current = makeSupabaseFake({ "trip_faqs:delete": { data: null, error: null } });
    await expect(deleteFaq("FAQ-1")).resolves.toBeUndefined();
  });
});
