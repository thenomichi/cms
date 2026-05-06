import { describe, it, expect } from "vitest";
import {
  tripBasicSchema,
  tripItinerarySchema,
  tripContentSchema,
  tripGallerySchema,
  tripInclusionSchema,
  tripFaqSchema,
  reviewSchema,
  announcementSchema,
  destinationSchema,
  careerSchema,
  teamMemberSchema,
  suggestionStatusSchema,
  siteGallerySchema,
  rawMomentSchema,
  TRIP_TYPES,
  ANNOUNCEMENT_TAG_TYPES,
  TEAM_ROLES,
  TRIP_CONTENT_TYPES,
  TRIP_INCLUSION_TYPES,
  TRIP_GALLERY_CATEGORIES,
  SUGGESTION_PIPELINE_STATUSES,
} from "@/lib/schemas/trip";

const baseTrip = {
  trip_name: "Hampi", trip_type: "Community" as const,
  destination_id: "DEST-IND-HMP",
  duration_days: 3, duration_nights: 2,
  start_date: null, end_date: null,
  mrp_price: 30000, selling_price: 25000,
  discount_pct: 16, discount_amount: null, quoted_price: null,
  total_slots: 10,
  batch_number: null,
};

describe("tripBasicSchema", () => {
  it.each(TRIP_TYPES)("accepts trip_type=%s", (t) => {
    expect(tripBasicSchema.safeParse({ ...baseTrip, trip_type: t }).success).toBe(true);
  });

  it("rejects 'Plan a Trip' (DB CHECK removed it)", () => {
    const r = tripBasicSchema.safeParse({ ...baseTrip, trip_type: "Plan a Trip" as never });
    expect(r.success).toBe(false);
  });

  it("requires trip_name >= 2 chars", () => {
    expect(tripBasicSchema.safeParse({ ...baseTrip, trip_name: "x" }).success).toBe(false);
  });

  it("rejects duration_days > 90 or < 1", () => {
    expect(tripBasicSchema.safeParse({ ...baseTrip, duration_days: 0 }).success).toBe(false);
    expect(tripBasicSchema.safeParse({ ...baseTrip, duration_days: 91 }).success).toBe(false);
  });

  it("rejects discount_pct outside 0-100", () => {
    expect(tripBasicSchema.safeParse({ ...baseTrip, discount_pct: -1 }).success).toBe(false);
    expect(tripBasicSchema.safeParse({ ...baseTrip, discount_pct: 101 }).success).toBe(false);
  });

  it("defaults advance_pct to 50", () => {
    const r = tripBasicSchema.safeParse(baseTrip);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.advance_pct).toBe(50);
  });

  it("defaults booking_kind=trip and currency_code=INR", () => {
    const r = tripBasicSchema.safeParse(baseTrip);
    if (r.success) {
      expect(r.data.booking_kind).toBe("trip");
      expect(r.data.currency_code).toBe("INR");
    }
  });
});

describe("tripItinerarySchema", () => {
  it("requires day_number >= 1 and title >= 2 chars", () => {
    expect(tripItinerarySchema.safeParse({ day_number: 0, title: "x" }).success).toBe(false);
    expect(tripItinerarySchema.safeParse({ day_number: 1, title: "Day One" }).success).toBe(true);
  });
});

describe("tripContentSchema", () => {
  it.each(TRIP_CONTENT_TYPES)("accepts content_type=%s", (t) => {
    expect(tripContentSchema.safeParse({ content_type: t, content_text: "x" }).success).toBe(true);
  });
  it("rejects unknown content_type", () => {
    expect(tripContentSchema.safeParse({ content_type: "intro", content_text: "x" }).success).toBe(false);
  });
});

describe("tripGallerySchema", () => {
  it.each(TRIP_GALLERY_CATEGORIES)("accepts category=%s", (c) => {
    expect(tripGallerySchema.safeParse({ image_url: "https://x.io/1.jpg", category: c }).success).toBe(true);
  });
  it("rejects unknown category", () => {
    expect(tripGallerySchema.safeParse({ image_url: "https://x.io/1.jpg", category: "banner" }).success).toBe(false);
  });
  it("requires a valid URL", () => {
    expect(tripGallerySchema.safeParse({ image_url: "not-a-url", category: "gallery" }).success).toBe(false);
  });
  it("defaults is_cover=false", () => {
    const r = tripGallerySchema.safeParse({ image_url: "https://x.io/1.jpg", category: "gallery" });
    if (r.success) expect(r.data.is_cover).toBe(false);
  });
});

describe("tripInclusionSchema", () => {
  it.each(TRIP_INCLUSION_TYPES)("accepts inclusion_type=%s", (t) => {
    expect(tripInclusionSchema.safeParse({ inclusion_type: t, name: "x" }).success).toBe(true);
  });
  it("rejects free-form inclusion_type", () => {
    expect(tripInclusionSchema.safeParse({ inclusion_type: "extra", name: "x" }).success).toBe(false);
  });
});

describe("tripFaqSchema", () => {
  it("requires question and answer >= 3 chars", () => {
    expect(tripFaqSchema.safeParse({ question: "Q?", answer: "A." }).success).toBe(false);
    expect(tripFaqSchema.safeParse({ question: "Why?", answer: "Because" }).success).toBe(true);
  });
});

describe("reviewSchema", () => {
  it.each([
    [1, true], [3, true], [5, true],
    [0, false], [6, false], [-1, false],
  ])("rating=%s -> success=%s", (rating, ok) => {
    const r = reviewSchema.safeParse({ reviewer_name: "Alice", rating, review_text: "great trip overall" });
    expect(r.success).toBe(ok);
  });
  it("requires review_text >= 10 chars", () => {
    expect(reviewSchema.safeParse({ reviewer_name: "Alice", rating: 5, review_text: "short" }).success).toBe(false);
  });
  it("defaults toggle flags to false", () => {
    const r = reviewSchema.safeParse({ reviewer_name: "Alice", rating: 5, review_text: "great trip overall" });
    if (r.success) {
      expect(r.data.is_approved).toBe(false);
      expect(r.data.is_featured).toBe(false);
      expect(r.data.show_on_homepage).toBe(false);
    }
  });
});

describe("announcementSchema", () => {
  it.each(ANNOUNCEMENT_TAG_TYPES)("accepts tag_type=%s", (t) => {
    expect(announcementSchema.safeParse({ tag_type: t, headline: "Hello" }).success).toBe(true);
  });
  it("rejects unknown tag_type (DB CHECK)", () => {
    expect(announcementSchema.safeParse({ tag_type: "discount", headline: "Hi" }).success).toBe(false);
  });
  it("rejects starts_at > ends_at", () => {
    const r = announcementSchema.safeParse({
      tag_type: "new", headline: "Hello",
      starts_at: "2026-12-31", ends_at: "2026-01-01",
    });
    expect(r.success).toBe(false);
  });
  it("accepts starts_at <= ends_at", () => {
    const r = announcementSchema.safeParse({
      tag_type: "new", headline: "Hello",
      starts_at: "2026-01-01", ends_at: "2026-12-31",
    });
    expect(r.success).toBe(true);
  });
});

describe("destinationSchema", () => {
  it("rejects lowercase destination_code", () => {
    expect(destinationSchema.safeParse({ destination_code: "hmp", destination_name: "Hampi", country: "India" }).success).toBe(false);
  });
  it("accepts uppercase alphanumeric with dashes", () => {
    expect(destinationSchema.safeParse({ destination_code: "HMP-2", destination_name: "Hampi", country: "India" }).success).toBe(true);
  });
});

describe("careerSchema", () => {
  it("requires title and department >= 2 chars", () => {
    expect(careerSchema.safeParse({ title: "x", department: "Eng" }).success).toBe(false);
    expect(careerSchema.safeParse({ title: "Engineer", department: "x" }).success).toBe(false);
  });
  it("rejects unknown employment_type", () => {
    expect(careerSchema.safeParse({ title: "Engineer", department: "Eng", employment_type: "permanent" as never }).success).toBe(false);
  });
});

describe("teamMemberSchema", () => {
  it.each(TEAM_ROLES)("accepts role=%s", (role) => {
    expect(teamMemberSchema.safeParse({ full_name: "Alice", role }).success).toBe(true);
  });
  it("rejects free-form role", () => {
    expect(teamMemberSchema.safeParse({ full_name: "Alice", role: "Cthulhu" }).success).toBe(false);
  });
  it("rejects invalid email", () => {
    expect(teamMemberSchema.safeParse({ full_name: "Alice", role: "Admin", email: "not-email" }).success).toBe(false);
  });
});

describe("suggestionStatusSchema", () => {
  it.each(SUGGESTION_PIPELINE_STATUSES)("accepts %s", (s) => {
    expect(suggestionStatusSchema.safeParse(s).success).toBe(true);
  });
  it("rejects unknown status", () => {
    expect(suggestionStatusSchema.safeParse("Pending Approval").success).toBe(false);
  });
});

describe("siteGallerySchema and rawMomentSchema", () => {
  it("siteGallerySchema requires a valid image URL and non-empty category", () => {
    expect(siteGallerySchema.safeParse({ image_url: "https://x.io/1.jpg", category: "hero" }).success).toBe(true);
    expect(siteGallerySchema.safeParse({ image_url: "https://x.io/1.jpg", category: "" }).success).toBe(false);
  });
  it("rawMomentSchema defaults tags to empty array and is_featured to false", () => {
    const r = rawMomentSchema.safeParse({ image_url: "https://x.io/1.jpg" });
    if (r.success) {
      expect(r.data.tags).toEqual([]);
      expect(r.data.is_featured).toBe(false);
    }
  });
});
