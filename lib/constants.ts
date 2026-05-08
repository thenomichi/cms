// ---------------------------------------------------------------------------
// Dropdown option sets
// ---------------------------------------------------------------------------

// trip_type values mirror the live trips_trip_type_check CHECK constraint.
// Updating this list also requires a DB migration.
export const TRIP_TYPE_OPTIONS = [
  { value: "Community", label: "Soulful Escapes (Community)" },
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
