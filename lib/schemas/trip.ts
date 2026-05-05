import { z } from "zod";

// ---------------------------------------------------------------------------
// Enum allowlists — mirror the live Postgres CHECK constraints exactly.
// Source of truth: website/supabase/migrations/*. If a CHECK widens or
// narrows, update this file in the same PR.
// ---------------------------------------------------------------------------

export const TRIP_TYPES = [
  "Community",
  "Beyond Ordinary",
  "Signature Journey",
  "Customized Trips Only",
] as const;

export const ANNOUNCEMENT_TAG_TYPES = [
  "new",
  "alert",
  "offer",
  "sold_out",
  "event",
] as const;

export const TEAM_ROLES = [
  "Admin",
  "Sales",
  "Operations",
  "Finance",
  "Marketing",
  "Founder",
  "Captain",
  "Other",
] as const;

export const TRIP_CONTENT_TYPES = [
  "overview",
  "description",
  "tagline",
  "highlight",
] as const;

export const TRIP_INCLUSION_TYPES = ["inclusion", "exclusion"] as const;

export const TRIP_GALLERY_CATEGORIES = [
  "cover",
  "hero",
  "itinerary",
  "accommodation",
  "activity",
  "gallery",
] as const;

export const SUGGESTION_PIPELINE_STATUSES = [
  "New Request",
  "In Discussion",
  "Proposal Sent",
  "Negotiating",
  "Confirmed",
  "Lost",
  "Moved to Group Trip",
] as const;

export const TRIP_STATUSES = [
  "Draft",
  "Upcoming",
  "Ongoing",
  "Completed",
  "Cancelled",
] as const;

// ---------------------------------------------------------------------------
// Trip — basic fields for the create / edit form
// ---------------------------------------------------------------------------

export const tripBasicSchema = z.object({
  trip_name: z.string().min(2, "Trip name is required"),
  // slug is auto-generated server-side — not in the form schema
  trip_type: z.enum(TRIP_TYPES),
  trip_sub_type: z.string().nullable().optional(),
  trip_category: z.string().nullable().optional(),
  destination_id: z.string().nullable(),
  duration_days: z.coerce.number().min(1).max(90),
  duration_nights: z.coerce.number().min(0).max(89),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  mrp_price: z.coerce.number().min(0).nullable(),
  selling_price: z.coerce.number().min(0).nullable(),
  discount_pct: z.coerce.number().min(0).max(100).nullable(),
  quoted_price: z.coerce.number().min(0).nullable(),
  advance_pct: z.coerce.number().min(0).max(100).default(50),
  total_slots: z.coerce.number().min(0).nullable(),
  batch_number: z.string().nullable(),
  group_slug: z.string().nullable().optional(),
  tagline: z.string().nullable().optional(),
  departure_city: z.string().nullable().optional(),
  departure_airport: z.string().nullable().optional(),
  booking_kind: z.string().default("trip"),
  currency_code: z.string().default("INR"),
});

// ---------------------------------------------------------------------------
// Trip itinerary day
// ---------------------------------------------------------------------------

export const tripItinerarySchema = z.object({
  day_number: z.coerce.number().min(1),
  title: z.string().min(2, "Day title is required"),
  subtitle: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  meals: z.string().nullable().optional(),
  accommodation: z.string().nullable().optional(),
  tags: z.string().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Trip content block
// ---------------------------------------------------------------------------

export const tripContentSchema = z.object({
  content_type: z.enum(TRIP_CONTENT_TYPES),
  content_text: z.string().min(1, "Content text is required"),
  content_order: z.coerce.number().min(0).default(0),
});

// ---------------------------------------------------------------------------
// Trip gallery image
// ---------------------------------------------------------------------------

export const tripGallerySchema = z.object({
  image_url: z.string().url("Valid image URL is required"),
  thumbnail_url: z.string().url().nullable().optional(),
  alt_text: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  category: z.enum(TRIP_GALLERY_CATEGORIES),
  is_cover: z.boolean().default(false),
  photographer: z.string().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Trip inclusion / exclusion
// ---------------------------------------------------------------------------

export const tripInclusionSchema = z.object({
  inclusion_type: z.enum(TRIP_INCLUSION_TYPES),
  icon: z.string().nullable().optional(),
  name: z.string().min(1, "Name is required"),
  note: z.string().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Trip FAQ
// ---------------------------------------------------------------------------

export const tripFaqSchema = z.object({
  question: z.string().min(3, "Question is required"),
  answer: z.string().min(3, "Answer is required"),
  category: z.string().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

export const reviewSchema = z.object({
  trip_id: z.string().nullable().optional(),
  reviewer_name: z.string().min(2, "Reviewer name is required"),
  reviewer_location: z.string().nullable().optional(),
  reviewer_image_url: z.string().url().nullable().optional(),
  trip_location: z.string().nullable().optional(),
  rating: z.coerce.number().min(1).max(5),
  review_text: z.string().min(10, "Review text must be at least 10 characters"),
  is_approved: z.boolean().default(false),
  is_featured: z.boolean().default(false),
  show_on_homepage: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Announcement
// ---------------------------------------------------------------------------

export const announcementSchema = z
  .object({
    tag_type: z.enum(ANNOUNCEMENT_TAG_TYPES),
    headline: z.string().min(2, "Headline is required"),
    sub_text: z.string().nullable().optional(),
    cta_label: z.string().nullable().optional(),
    cta_link: z.string().nullable().optional(),
    background_image_url: z.string().url().nullable().optional(),
    trip_id: z.string().nullable().optional(),
    is_active: z.boolean().default(true),
    starts_at: z.string().nullable().optional(),
    ends_at: z.string().nullable().optional(),
  })
  .refine(
    (v) => !v.starts_at || !v.ends_at || new Date(v.starts_at) <= new Date(v.ends_at),
    { message: "starts_at must be on or before ends_at", path: ["ends_at"] },
  );

// ---------------------------------------------------------------------------
// Destination
// ---------------------------------------------------------------------------

export const destinationSchema = z.object({
  destination_code: z
    .string()
    .min(2, "Destination code is required")
    .regex(/^[A-Z0-9-]+$/, "Code must be uppercase alphanumeric"),
  destination_name: z.string().min(2, "Destination name is required"),
  country: z.string().min(2, "Country is required"),
  is_domestic: z.boolean().default(true),
  is_active: z.boolean().default(true),
  icon: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Career listing
// ---------------------------------------------------------------------------

export const careerSchema = z.object({
  title: z.string().min(2, "Job title is required"),
  department: z.string().min(2, "Department is required"),
  location: z.string().default("Remote"),
  employment_type: z
    .enum(["full-time", "part-time", "contract", "internship"])
    .default("full-time"),
  description: z.string().nullable().optional(),
  responsibilities: z.array(z.string()).default([]),
  requirements: z.array(z.string()).default([]),
  is_open: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// Team member
// ---------------------------------------------------------------------------

export const teamMemberSchema = z.object({
  full_name: z.string().min(2, "Full name is required"),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  role: z.enum(TEAM_ROLES),
  bio: z.string().nullable().optional(),
  photo_url: z.string().url().nullable().optional(),
  instagram: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// Suggestion pipeline status
// ---------------------------------------------------------------------------

export const suggestionStatusSchema = z.enum(SUGGESTION_PIPELINE_STATUSES);

// ---------------------------------------------------------------------------
// Site gallery
// ---------------------------------------------------------------------------

export const siteGallerySchema = z.object({
  image_url: z.string().url("Valid image URL is required"),
  thumbnail_url: z.string().url().nullable().optional(),
  alt_text: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  category: z.string().min(1, "Category is required"),
  trip_id: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  photographer: z.string().nullable().optional(),
  is_featured: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// Raw moment
// ---------------------------------------------------------------------------

export const rawMomentSchema = z.object({
  image_url: z.string().url("Valid image URL is required"),
  location: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  is_featured: z.boolean().default(false),
});
