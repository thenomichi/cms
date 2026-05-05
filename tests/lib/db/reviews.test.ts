import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseFake, type SupabaseFake } from "../../_helpers/supabase-fake";
let current: SupabaseFake = makeSupabaseFake();
vi.mock("@/lib/supabase/server", () => ({ getServiceClient: () => current.client }));
import { getReviews, getReviewById, createReview, updateReview, deleteReview, toggleReviewField } from "@/lib/db/reviews";
beforeEach(() => { current = makeSupabaseFake(); });

describe("reviews db", () => {
  it("getReviews returns rows", async () => {
    current = makeSupabaseFake({ "reviews:select": { data: [{ review_id: "REV-001" }], error: null } });
    expect(await getReviews()).toHaveLength(1);
  });
  it("getReviews throws on error", async () => {
    current = makeSupabaseFake({ "reviews:select": { data: null, error: { message: "x" } } });
    await expect(getReviews()).rejects.toThrow();
  });
  it("getReviewById returns null on missing", async () => {
    current = makeSupabaseFake({ "reviews:select": { data: null, error: { message: "no rows" } } });
    expect(await getReviewById("REV-X")).toBeNull();
  });
  it("getReviewById returns the row", async () => {
    current = makeSupabaseFake({ "reviews:select": { data: { review_id: "REV-001" }, error: null } });
    expect((await getReviewById("REV-001"))?.review_id).toBe("REV-001");
  });
  it("createReview generates REV id and inserts", async () => {
    current = makeSupabaseFake({
      "rpc:nm_next_sequential_id": { data: "REV-007", error: null },
      "reviews:insert": { data: { review_id: "REV-007" }, error: null },
    });
    const r = await createReview({ reviewer_name: "Alice", rating: 5, review_text: "great" } as any);
    expect(r.review_id).toBe("REV-007");
  });
  it("createReview throws on insert error", async () => {
    current = makeSupabaseFake({
      "rpc:nm_next_sequential_id": { data: "REV-007", error: null },
      "reviews:insert": { data: null, error: { message: "dup" } },
    });
    await expect(createReview({} as any)).rejects.toThrow();
  });
  it("updateReview throws on error", async () => {
    current = makeSupabaseFake({ "reviews:update": { data: null, error: { message: "x" } } });
    await expect(updateReview("REV-1", { reviewer_name: "x" } as any)).rejects.toThrow();
  });
  it("updateReview succeeds and sets updated_at", async () => {
    current = makeSupabaseFake({ "reviews:update": { data: { review_id: "REV-1" }, error: null } });
    await updateReview("REV-1", { reviewer_name: "x" } as any);
    const upd = current.log.find((l) => l.op === "update") as any;
    expect(upd.payload.updated_at).toBeDefined();
  });
  it("deleteReview throws / succeeds", async () => {
    current = makeSupabaseFake({ "reviews:delete": { data: null, error: { message: "x" } } });
    await expect(deleteReview("REV-1")).rejects.toThrow();
    current = makeSupabaseFake({ "reviews:delete": { data: null, error: null } });
    await expect(deleteReview("REV-1")).resolves.toBeUndefined();
  });
  it.each(["is_approved", "is_featured", "show_on_homepage"] as const)(
    "toggleReviewField updates %s",
    async (field) => {
      current = makeSupabaseFake({ "reviews:update": { data: null, error: null } });
      await toggleReviewField("REV-1", field, true);
      const upd = current.log.find((l) => l.op === "update") as any;
      expect(upd.payload[field]).toBe(true);
    },
  );
  it("toggleReviewField throws on error", async () => {
    current = makeSupabaseFake({ "reviews:update": { data: null, error: { message: "x" } } });
    await expect(toggleReviewField("REV-1", "is_approved", true)).rejects.toThrow();
  });
});
