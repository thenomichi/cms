// ---------------------------------------------------------------------------
// Inclusion / exclusion preset repositories
// ---------------------------------------------------------------------------

export const INCLUSION_REPOSITORY = [
  { icon: "\u{1F3E8}", name: "Accommodation" },
  { icon: "\u{1F3AF}", name: "Activities" },
  { icon: "\u{1F690}", name: "Airport Transfer" },
  { icon: "\u{1F950}", name: "Breakfast" },
  { icon: "\u26FA", name: "Camps" },
  { icon: "\u{1F6B4}", name: "Cycling" },
  { icon: "\u2708\uFE0F", name: "Flight" },
  { icon: "\u{1F37D}\uFE0F", name: "Food & Meals" },
  { icon: "\u26FD", name: "Fuel" },
  { icon: "\u{1F9ED}", name: "Guide" },
  { icon: "\u{1F3E5}", name: "Health Insurance" },
  { icon: "\u{1F3E9}", name: "Hotel" },
  { icon: "\u{1F957}", name: "Lunch" },
  { icon: "\u{1F4DC}", name: "Permits" },
  { icon: "\u{1F4F8}", name: "Photography Equipment" },
  { icon: "\u{1F6A3}", name: "Rafting" },
  { icon: "\u{1F3AE}", name: "Recreation" },
  { icon: "\u{1F9F4}", name: "Repellent & Sunscreen" },
  { icon: "\u{1F3A2}", name: "Rides" },
  { icon: "\u{1F9D7}", name: "Ropes" },
  { icon: "\u{1F37F}", name: "Snacks" },
  { icon: "\u{1F305}", name: "Sunset" },
  { icon: "\u{1F392}", name: "Team Gear" },
  { icon: "\u{1F6BB}", name: "Toilet" },
  { icon: "\u{1F697}", name: "Transfers" },
] as const;

export const EXCLUSION_REPOSITORY = [
  "Personal expenses",
  "Travel insurance",
  "Visa fees",
  "International flights",
  "Tips & gratuities",
  "Alcoholic beverages",
  "Camera/drone fees",
  "Adventure gear rental",
  "Extra meals",
  "Laundry",
  "Medical expenses",
  "Room upgrades",
] as const;

// ---------------------------------------------------------------------------
// Dropdown option sets
// ---------------------------------------------------------------------------

// trip_type values mirror the live trips_trip_type_check CHECK constraint.
// Updating this list also requires a DB migration.
export const TRIP_TYPE_OPTIONS = [
  { value: "Community", label: "Join a Trip (Community)" },
  { value: "Beyond Ordinary", label: "Beyond Ordinary (Invite-Only)" },
  { value: "Signature Journey", label: "Signature Journey (Bespoke)" },
  { value: "Customized Trips Only", label: "Customized Trip" },
] as const;

export const TRIP_STATUS_OPTIONS = [
  { value: "Draft", label: "Draft" },
  { value: "Upcoming", label: "Upcoming" },
  { value: "Ongoing", label: "Ongoing" },
  { value: "Completed", label: "Completed" },
  { value: "Cancelled", label: "Cancelled" },
] as const;

export const TRIP_ORIGIN_OPTIONS = [
  { value: "Group Trip", label: "Group Trip" },
  { value: "Customized Trip", label: "Customized Trip" },
] as const;

export const GALLERY_CATEGORIES = [
  { value: "cover", label: "Cover Image" },
  { value: "hero", label: "Hero Banner" },
  { value: "itinerary", label: "Itinerary" },
  { value: "accommodation", label: "Accommodation" },
  { value: "activity", label: "Activity" },
  { value: "gallery", label: "General Gallery" },
] as const;

// role values mirror the live team_members_role_check CHECK constraint
// (widened in 20260505010000_widen_team_role_check.sql).
export const TEAM_ROLES = [
  { value: "Admin", label: "Admin" },
  { value: "Sales", label: "Sales" },
  { value: "Operations", label: "Operations" },
  { value: "Finance", label: "Finance" },
  { value: "Marketing", label: "Marketing" },
  { value: "Founder", label: "Founder" },
  { value: "Captain", label: "Trip Captain" },
  { value: "Other", label: "Other" },
] as const;

// tag_type values mirror the live announcements_tag_type_check.
export const ANNOUNCEMENT_TAG_OPTIONS = [
  { value: "new", label: "New" },
  { value: "alert", label: "Alert" },
  { value: "offer", label: "Offer" },
  { value: "sold_out", label: "Sold Out" },
  { value: "event", label: "Event" },
] as const;

// pipeline_status values mirror customized_trip_requests_pipeline_status_check.
export const SUGGESTION_STATUS_OPTIONS = [
  { value: "New Request", label: "New Request" },
  { value: "In Discussion", label: "In Discussion" },
  { value: "Proposal Sent", label: "Proposal Sent" },
  { value: "Negotiating", label: "Negotiating" },
  { value: "Confirmed", label: "Confirmed" },
  { value: "Lost", label: "Lost" },
  { value: "Moved to Group Trip", label: "Moved to Group Trip" },
] as const;

export const EMPLOYMENT_TYPES = [
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
] as const;
