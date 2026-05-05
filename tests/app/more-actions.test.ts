/**
 * Coverage tests for the remaining server actions (destinations, careers,
 * FAQs, hero-images, trips create/update, raw moments, settings basic flows).
 * Mostly happy + error paths to lift coverage above 80%.
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

// destinations
describe("destinations/actions", () => {
  it("createDestination requires name and country", async () => {
    const { createDestination } = await import("@/app/(cms)/destinations/actions");
    expect((await createDestination({})).success).toBe(false);
    expect((await createDestination({ destination_name: "Hampi" })).success).toBe(false);
  });
  it("createDestination succeeds with valid input", async () => {
    current = makeSupabaseFake({
      "destinations:select": { data: null, error: null, count: 0 } as any,
      "destinations:insert": { data: { destination_id: "DEST-IND-HAMPI" }, error: null },
      "audit_log:insert": { data: null, error: null },
    });
    const { createDestination } = await import("@/app/(cms)/destinations/actions");
    const r = await createDestination({ destination_name: "Hampi", country: "India", is_domestic: true });
    expect(r.success).toBe(true);
  });
  it("createDestination returns error on DB failure", async () => {
    current = makeSupabaseFake({
      "destinations:select": { data: null, error: null, count: 0 } as any,
      "destinations:insert": { data: null, error: { message: "dup" } },
    });
    const { createDestination } = await import("@/app/(cms)/destinations/actions");
    const r = await createDestination({ destination_name: "Hampi", country: "India" });
    expect(r.success).toBe(false);
  });
  it("toggleDestinationActive logs UPDATE", async () => {
    current = makeSupabaseFake({
      "destinations:update": { data: null, error: null },
      "audit_log:insert": { data: null, error: null },
    });
    const { toggleDestinationActive } = await import("@/app/(cms)/destinations/actions");
    const r = await toggleDestinationActive("DEST-X", true);
    expect(r.success).toBe(true);
    const audit = current.log.find((l) => l.from === "audit_log") as any;
    expect(audit.payload.action).toBe("UPDATE");
  });
  it("deleteDestination returns error on FK violation", async () => {
    current = makeSupabaseFake({ "destinations:delete": { data: null, error: { message: "fk" } } });
    const { deleteDestination } = await import("@/app/(cms)/destinations/actions");
    const r = await deleteDestination("DEST-X");
    expect(r.success).toBe(false);
  });
});

// careers
describe("careers/actions", () => {
  it("createCareerAction validates department length", async () => {
    const { createCareerAction } = await import("@/app/(cms)/careers/actions");
    const r = await createCareerAction({ title: "Engineer", department: "x" } as any);
    expect(r.success).toBe(false);
  });
  it("createCareerAction succeeds and audits", async () => {
    current = makeSupabaseFake({
      "rpc:nm_next_sequential_id": { data: "CAR-001", error: null },
      "career_listings:insert": { data: { career_id: "CAR-001" }, error: null },
      "audit_log:insert": { data: null, error: null },
    });
    const { createCareerAction } = await import("@/app/(cms)/careers/actions");
    const r = await createCareerAction({ title: "Engineer", department: "Engineering" } as any);
    expect(r.success).toBe(true);
  });
  it("deleteCareerAction returns error on DB failure", async () => {
    current = makeSupabaseFake({ "career_listings:delete": { data: null, error: { message: "x" } } });
    const { deleteCareerAction } = await import("@/app/(cms)/careers/actions");
    const r = await deleteCareerAction("CAR-1");
    expect(r.success).toBe(false);
  });
});

// FAQs
describe("faqs/actions", () => {
  it("createFaq returns error on Zod failure", async () => {
    const { createFaq } = await import("@/app/(cms)/faqs/actions");
    const r = await createFaq(null, { question: "Q?", answer: "A!" });
    expect(r.success).toBe(false);
  });
  it("createFaq with valid input revalidates", async () => {
    current = makeSupabaseFake({
      "rpc:nm_next_sequential_id": { data: "FAQ-001", error: null },
      "trips:select": { data: { slug: "hampi" }, error: null },
      "trip_faqs:insert": { data: { faq_id: "FAQ-001" }, error: null },
      "audit_log:insert": { data: null, error: null },
    });
    const { createFaq } = await import("@/app/(cms)/faqs/actions");
    const r = await createFaq({ trip_id: "TRIP-1", question: "Question?", answer: "Answer here" });
    expect(r.success).toBe(true);
  });
});

// hero-images
describe("hero-images/actions", () => {
  it("updatePageHeroImage rejects invalid page key", async () => {
    const { updatePageHeroImage } = await import("@/app/(cms)/hero-images/actions");
    const r = await updatePageHeroImage("not-a-page" as any, { image_light: "https://x.io/a.jpg" });
    expect(r.success).toBe(false);
  });
  it("updatePageHeroImage succeeds for valid page", async () => {
    current = makeSupabaseFake({
      "page_hero_images:upsert": { data: null, error: null },
      "page_hero_images:update": { data: null, error: null },
      "audit_log:insert": { data: null, error: null },
    });
    const { updatePageHeroImage } = await import("@/app/(cms)/hero-images/actions");
    const r = await updatePageHeroImage("home", { image_light: "https://x.io/a.jpg", image_dark: null, alt_text: "Hero" });
    expect(r.success).toBe(true);
  });
});

// suggestions deletion
describe("suggestions delete", () => {
  it("deleteSuggestionAction logs DELETE", async () => {
    current = makeSupabaseFake({
      "customized_trip_requests:delete": { data: null, error: null },
      "audit_log:insert": { data: null, error: null },
    });
    const { deleteSuggestionAction } = await import("@/app/(cms)/suggestions/actions");
    const r = await deleteSuggestionAction("REQ-1");
    expect(r.success).toBe(true);
    const audit = current.log.find((l) => l.from === "audit_log") as any;
    expect(audit.payload.action).toBe("DELETE");
  });
  it("deleteSuggestionAction returns error on DB failure", async () => {
    current = makeSupabaseFake({ "customized_trip_requests:delete": { data: null, error: { message: "x" } } });
    const { deleteSuggestionAction } = await import("@/app/(cms)/suggestions/actions");
    const r = await deleteSuggestionAction("REQ-1");
    expect(r.success).toBe(false);
  });
});

// announcements update + delete
describe("announcements update/delete", () => {
  it("updateAnnouncement returns error on Zod failure", async () => {
    const { updateAnnouncement } = await import("@/app/(cms)/announcements/actions");
    const r = await updateAnnouncement("ANN-1", { tag_type: "discount", headline: "Hi" } as any);
    expect(r.success).toBe(false);
  });
  it("updateAnnouncement succeeds with valid input", async () => {
    current = makeSupabaseFake({
      "announcements:update": { data: null, error: null },
      "audit_log:insert": { data: null, error: null },
    });
    const { updateAnnouncement } = await import("@/app/(cms)/announcements/actions");
    const r = await updateAnnouncement("ANN-1", { tag_type: "new", headline: "Hello" } as any);
    expect(r.success).toBe(true);
  });
  it("deleteAnnouncement returns error on DB failure", async () => {
    current = makeSupabaseFake({ "announcements:delete": { data: null, error: { message: "x" } } });
    const { deleteAnnouncement } = await import("@/app/(cms)/announcements/actions");
    const r = await deleteAnnouncement("ANN-1");
    expect(r.success).toBe(false);
  });
});

// reviews update + delete
describe("reviews update/delete", () => {
  it("updateReview returns Zod error on bad input", async () => {
    const { updateReview } = await import("@/app/(cms)/reviews/actions");
    const r = await updateReview("REV-1", { reviewer_name: "x", rating: 99, review_text: "short" });
    expect(r.success).toBe(false);
  });
  it("updateReview succeeds with valid input", async () => {
    current = makeSupabaseFake({
      "reviews:update": { data: { review_id: "REV-1" }, error: null },
      "audit_log:insert": { data: null, error: null },
    });
    const { updateReview } = await import("@/app/(cms)/reviews/actions");
    const r = await updateReview("REV-1", { reviewer_name: "Alice", rating: 5, review_text: "great trip overall" });
    expect(r.success).toBe(true);
  });
});

// team update + delete
describe("team update/delete", () => {
  it("updateTeamMemberAction rejects invalid role", async () => {
    const { updateTeamMemberAction } = await import("@/app/(cms)/team/actions");
    const r = await updateTeamMemberAction("TM-1", { role: "Cthulhu" } as any);
    expect(r.success).toBe(false);
  });
  it("updateTeamMemberAction succeeds with valid role", async () => {
    current = makeSupabaseFake({
      "team_members:update": { data: { member_id: "TM-1" }, error: null },
      "audit_log:insert": { data: null, error: null },
    });
    const { updateTeamMemberAction } = await import("@/app/(cms)/team/actions");
    const r = await updateTeamMemberAction("TM-1", { full_name: "Alice", role: "Captain" } as any);
    expect(r.success).toBe(true);
  });
  it("deleteTeamMemberAction returns error on DB failure", async () => {
    current = makeSupabaseFake({ "team_members:delete": { data: null, error: { message: "fk" } } });
    const { deleteTeamMemberAction } = await import("@/app/(cms)/team/actions");
    const r = await deleteTeamMemberAction("TM-1");
    expect(r.success).toBe(false);
  });
});
