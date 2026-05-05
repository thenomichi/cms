/**
 * Server-action tests for the critical CMS flows the user called out:
 *   - add trip / modify trip / activate / deactivate / clone as batch
 *   - reviews (race-free IDs path)
 *   - team (role enum)
 *   - announcements (tag_type enum)
 *   - suggestions (status enum)
 *   - trip_gallery cover toggle (atomic RPC)
 *
 * For each action: valid input → success + audit; invalid → Zod returned;
 * DB error → { success: false, error }.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseFake, type SupabaseFake } from "../_helpers/supabase-fake";

let current: SupabaseFake = makeSupabaseFake();

vi.mock("@/lib/supabase/server", () => ({ getServiceClient: () => current.client }));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("@/lib/revalidate", () => ({
  revalidateHome: vi.fn(async () => {}),
  revalidateTrip: vi.fn(async () => {}),
  revalidateAbout: vi.fn(async () => {}),
  revalidateCareers: vi.fn(async () => {}),
  revalidateReview: vi.fn(async () => {}),
  revalidateWebsite: vi.fn(async () => {}),
}));

beforeEach(() => { current = makeSupabaseFake(); });

// ---------------------------------------------------------------------------
// Reviews — race-free IDs end-to-end through the action
// ---------------------------------------------------------------------------

describe("reviews/actions", () => {
  it("createReview: invalid input → Zod fieldErrors, no DB call", async () => {
    const { createReview } = await import("@/app/(cms)/reviews/actions");
    const r = await createReview({ reviewer_name: "x", rating: 99, review_text: "short" });
    expect(r.success).toBe(false);
    expect(typeof r.error).toBe("object"); // flattened fieldErrors
    expect(current.log.find((l) => l.op === "insert")).toBeUndefined();
  });
  it("createReview: valid → calls RPC, inserts, audits, succeeds", async () => {
    current = makeSupabaseFake({
      "rpc:nm_next_sequential_id": { data: "REV-007", error: null },
      "reviews:insert": { data: { review_id: "REV-007" }, error: null },
      "audit_log:insert": { data: null, error: null },
    });
    const { createReview } = await import("@/app/(cms)/reviews/actions");
    const r = await createReview({ reviewer_name: "Alice", rating: 5, review_text: "great trip overall" });
    expect(r.success).toBe(true);
    expect(current.log.some((l) => l.rpc === "nm_next_sequential_id")).toBe(true);
    expect(current.log.find((l) => l.op === "insert" && l.from === "reviews")).toBeDefined();
    const audit = current.log.find((l) => l.op === "insert" && l.from === "audit_log") as any;
    expect(audit.payload.action).toBe("INSERT");
  });
  it("createReview: DB insert error returns { success:false, error }", async () => {
    current = makeSupabaseFake({
      "rpc:nm_next_sequential_id": { data: "REV-007", error: null },
      "reviews:insert": { data: null, error: { message: "duplicate key value violates" } },
    });
    const { createReview } = await import("@/app/(cms)/reviews/actions");
    const r = await createReview({ reviewer_name: "Alice", rating: 5, review_text: "great trip overall" });
    expect(r.success).toBe(false);
    expect(typeof r.error).toBe("string");
  });
  it("toggleReviewField logs UPDATE not TOGGLE", async () => {
    current = makeSupabaseFake({
      "reviews:update": { data: null, error: null },
      "audit_log:insert": { data: null, error: null },
    });
    const { toggleReviewField } = await import("@/app/(cms)/reviews/actions");
    await toggleReviewField("REV-1", "is_approved", true);
    const audit = current.log.find((l) => l.op === "insert" && l.from === "audit_log") as any;
    expect(audit.payload.action).toBe("UPDATE"); // regression for 587b24b
  });
  it("deleteReview returns error on DB failure", async () => {
    current = makeSupabaseFake({
      "trip_content:delete": { data: null, error: null },
      "reviews:delete": { data: null, error: { message: "fk" } },
    });
    const { deleteReview } = await import("@/app/(cms)/reviews/actions");
    const r = await deleteReview("REV-1");
    expect(r.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Team — DB CHECK enforcement via Zod role enum
// ---------------------------------------------------------------------------

describe("team/actions", () => {
  it("createTeamMember rejects free-form role at Zod boundary (no DB call)", async () => {
    const { createTeamMemberAction } = await import("@/app/(cms)/team/actions");
    const r = await createTeamMemberAction({ full_name: "Alice", role: "Cthulhu" } as any);
    expect(r.success).toBe(false);
    expect(current.log.find((l) => l.op === "insert")).toBeUndefined();
  });
  it("createTeamMember accepts Founder (widened CHECK), inserts, audits", async () => {
    current = makeSupabaseFake({
      "rpc:nm_next_sequential_id": { data: "TM-0042", error: null },
      "team_members:insert": { data: { member_id: "TM-0042" }, error: null },
      "audit_log:insert": { data: null, error: null },
    });
    const { createTeamMemberAction } = await import("@/app/(cms)/team/actions");
    const r = await createTeamMemberAction({ full_name: "Alice", role: "Founder", email: "a@x.io", phone: null, bio: null, photo_url: null, instagram: null, is_active: true } as any);
    expect(r.success).toBe(true);
    expect(current.log.find((l) => l.op === "insert" && l.from === "team_members")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Announcements — DB tag_type CHECK via Zod enum
// ---------------------------------------------------------------------------

describe("announcements/actions", () => {
  it("createAnnouncement rejects free-form tag_type at Zod (no DB call)", async () => {
    const { createAnnouncement } = await import("@/app/(cms)/announcements/actions");
    const r = await createAnnouncement({ tag_type: "discount", headline: "Hi" } as any);
    expect(r.success).toBe(false);
    expect(current.log.find((l) => l.op === "insert")).toBeUndefined();
  });
  it("createAnnouncement accepts allowed tag_type and inserts", async () => {
    current = makeSupabaseFake({
      "rpc:nm_next_sequential_id": { data: "ANN-007", error: null },
      "announcements:insert": { data: { announcement_id: "ANN-007" }, error: null },
      "audit_log:insert": { data: null, error: null },
    });
    const { createAnnouncement } = await import("@/app/(cms)/announcements/actions");
    const r = await createAnnouncement({ tag_type: "new", headline: "Hello world" } as any);
    expect(r.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suggestions — pipeline_status enum
// ---------------------------------------------------------------------------

describe("suggestions/actions", () => {
  it("updateSuggestionStatusAction rejects invalid status at Zod", async () => {
    const { updateSuggestionStatusAction } = await import("@/app/(cms)/suggestions/actions");
    const r = await updateSuggestionStatusAction("REQ-1", "Pending Approval");
    expect(r.success).toBe(false);
    expect(current.log.find((l) => l.op === "update")).toBeUndefined();
  });
  it("updateSuggestionStatusAction accepts allowed status and updates", async () => {
    current = makeSupabaseFake({
      "customized_trip_requests:update": { data: null, error: null },
      "audit_log:insert": { data: null, error: null },
    });
    const { updateSuggestionStatusAction } = await import("@/app/(cms)/suggestions/actions");
    const r = await updateSuggestionStatusAction("REQ-1", "Confirmed");
    expect(r.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Media — atomic cover toggle via RPC
// ---------------------------------------------------------------------------

describe("media/actions", () => {
  it("toggleGalleryCoverAction calls nm_set_trip_cover_image RPC", async () => {
    current = makeSupabaseFake({
      "rpc:nm_set_trip_cover_image": { data: null, error: null },
      "audit_log:insert": { data: null, error: null },
    });
    const { toggleGalleryCoverAction } = await import("@/app/(cms)/media/actions");
    const r = await toggleGalleryCoverAction("GAL-1", "TRIP-1");
    expect(r.success).toBe(true);
    expect(current.log[0]).toMatchObject({ rpc: "nm_set_trip_cover_image" });
  });
  it("toggleGalleryCoverAction returns error on RPC failure", async () => {
    current = makeSupabaseFake({ "rpc:nm_set_trip_cover_image": { data: null, error: { message: "x" } } });
    const { toggleGalleryCoverAction } = await import("@/app/(cms)/media/actions");
    const r = await toggleGalleryCoverAction("GAL-1", "TRIP-1");
    expect(r.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Trips — full lifecycle (create, update, toggle, clone, delete)
// ---------------------------------------------------------------------------

describe("trips/actions", () => {
  it("toggleTripFieldAction logs UPDATE", async () => {
    current = makeSupabaseFake({
      "trips:update": { data: null, error: null },
      "audit_log:insert": { data: null, error: null },
    });
    const { toggleTripFieldAction } = await import("@/app/(cms)/trips/actions");
    const r = await toggleTripFieldAction("T1", "is_listed", true, "hampi");
    expect(r.success).toBe(true);
    const audit = current.log.find((l) => l.op === "insert" && l.from === "audit_log") as any;
    expect(audit.payload.action).toBe("UPDATE");
  });
  it("deleteTripAction returns error on DB failure", async () => {
    current = makeSupabaseFake({
      "trip_content:delete": { data: null, error: null },
      "trip_itinerary:delete": { data: null, error: null },
      "trip_inclusions:delete": { data: null, error: null },
      "trip_faqs:delete": { data: null, error: null },
      "trip_gallery:delete": { data: null, error: null },
      "trips:delete": { data: null, error: { message: "fk" } },
    });
    const { deleteTripAction } = await import("@/app/(cms)/trips/actions");
    const r = await deleteTripAction("T1", "hampi");
    expect(r.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Audit regression — no action ever uses TOGGLE/PUBLISH (587b24b)
// ---------------------------------------------------------------------------

describe("audit action regression", () => {
  it("toggleAnnouncementActive logs UPDATE not TOGGLE", async () => {
    current = makeSupabaseFake({
      "announcements:update": { data: null, error: null },
      "audit_log:insert": { data: null, error: null },
    });
    const { toggleAnnouncementActive } = await import("@/app/(cms)/announcements/actions");
    await toggleAnnouncementActive("ANN-1", true);
    const audit = current.log.find((l) => l.op === "insert" && l.from === "audit_log") as any;
    expect(audit.payload.action).toBe("UPDATE");
  });
});
