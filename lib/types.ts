// ---------------------------------------------------------------------------
// Database row types — derived from the Supabase public schema
// ---------------------------------------------------------------------------

/** trips */
export interface DbTrip {
  trip_id: string;
  slug: string | null;
  trip_type: string | null; // "Community" | "Beyond Ordinary" | "Signature Journey" | "Plan a Trip"
  trip_sub_type: string | null;
  trip_category: string | null;
  destination_id: string | null;
  trip_name: string | null;
  tagline: string | null;
  tags: string[] | null;
  duration_nights: number | null;
  duration_days: number | null;
  start_date: string | null;
  end_date: string | null;
  mrp_price: number | null;
  selling_price: number | null;
  discount_pct: number | null;
  quoted_price: number | null;
  advance_pct: number | null;
  price_per: string | null;
  total_slots: number | null;
  booked_slots: number | null;
  number_of_pax: number | null;
  is_listed: boolean | null;
  show_on_homepage: boolean | null;
  status: string | null; // "Draft" | "Upcoming" | "Ongoing" | "Completed" | "Cancelled"
  batch_number: string | null;
  request_id: string | null;
  dossier_url: string | null;
  dossier_published_at: string | null;
  departure_city: string | null;
  departure_airport: string | null;
  booking_kind: string;
  currency_code: string | null;
  trip_captain_id: string | null;
  cancellation_policy_id: string | null;
  source_draft_id: string | null;
  legacy_trip_id: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

/** trip_content */
export interface DbTripContent {
  content_id: string;
  trip_id: string;
  content_type: string; // e.g. "overview", "highlight", "summary"
  content_text: string;
  content_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** trip_itinerary */
export interface DbTripItinerary {
  itinerary_id: string;
  trip_id: string;
  day_number: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  meals: string | null;
  accommodation: string | null;
  tags: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** trip_gallery */
export interface DbTripGallery {
  gallery_id: string;
  trip_id: string | null;
  image_url: string;
  thumbnail_url: string | null;
  alt_text: string | null;
  caption: string | null;
  category: string; // "cover" | "hero" | "itinerary" | "accommodation" | "activity" | "gallery"
  is_cover: boolean;
  photographer: string | null;
  display_order: number;
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** trip_inclusions — stores both inclusions and exclusions via inclusion_type */
export interface DbTripInclusion {
  inclusion_id: string;
  trip_id: string;
  inclusion_type: string; // "inclusion" | "exclusion"
  icon: string | null;
  name: string;
  note: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** trip_faqs */
export interface DbTripFaq {
  faq_id: string;
  trip_id: string;
  question: string;
  answer: string;
  category: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** reviews */
export interface DbReview {
  review_id: string;
  trip_id: string | null;
  customer_id: string | null;
  reviewer_name: string;
  reviewer_location: string | null;
  reviewer_image_url: string | null;
  trip_location: string | null;
  rating: number;
  review_text: string;
  is_approved: boolean;
  is_featured: boolean;
  show_on_homepage: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/** announcements */
export interface DbAnnouncement {
  announcement_id: string;
  tag_type: string;
  headline: string;
  sub_text: string | null;
  cta_label: string | null;
  cta_link: string | null;
  background_image_url: string | null;
  trip_id: string | null;
  display_order: number | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

/** site_gallery */
export interface DbSiteGallery {
  gallery_id: string;
  image_url: string;
  thumbnail_url: string | null;
  alt_text: string | null;
  caption: string | null;
  category: string;
  trip_id: string | null;
  location: string | null;
  photographer: string | null;
  is_featured: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/** raw_moments */
export interface DbRawMoment {
  moment_id: string;
  location: string | null;
  image_url: string;
  caption: string | null;
  tags: string[] | null;
  is_featured: boolean | null;
  display_order: number | null;
  created_at: string | null;
  updated_at: string | null;
}

/** destinations */
export interface DbDestination {
  destination_id: string;
  destination_code: string;
  destination_name: string;
  country: string;
  is_domestic: boolean;
  is_active: boolean;
  icon: string | null;
  description: string | null;
  display_order: number | null;
  created_at: string;
  updated_at: string;
}

/** team_members */
export interface DbTeamMember {
  member_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  bio: string | null;
  photo_url: string | null;
  instagram: string | null;
  is_active: boolean;
  user_id: string | null;
  display_order: number | null;
  created_at: string;
  updated_at: string;
}

/** career_listings */
export interface DbCareerListing {
  career_id: string;
  title: string;
  department: string;
  location: string | null;
  employment_type: string | null;
  description: string | null;
  responsibilities: string[] | null;
  requirements: string[] | null;
  is_open: boolean | null;
  display_order: number | null;
  created_at: string | null;
  updated_at: string | null;
}

/** company_values */
export interface DbCompanyValue {
  value_id: string;
  icon: string;
  title: string;
  description: string | null;
  page_context: string | null;
  is_active: boolean | null;
  display_order: number | null;
  created_at: string | null;
  updated_at: string | null;
}

/** process_steps */
export interface DbProcessStep {
  step_id: string;
  step_number: string;
  title: string;
  description: string | null;
  is_active: boolean | null;
  display_order: number | null;
  created_at: string | null;
  updated_at: string | null;
}

/** footer_sections */
export interface DbFooterSection {
  section_id: string;
  title: string;
  display_order: number | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

/** footer_links */
export interface DbFooterLink {
  link_id: string;
  section_id: string;
  label: string;
  href: string;
  display_order: number | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

/** gift_occasions */
export interface DbGiftOccasion {
  occasion_id: string;
  icon: string;
  name: string;
  description: string | null;
  is_active: boolean | null;
  display_order: number | null;
  created_at: string | null;
  updated_at: string | null;
}

/** gift_amounts */
export interface DbGiftAmount {
  amount_id: string;
  value: number;
  label: string;
  subtitle: string | null;
  is_active: boolean | null;
  display_order: number | null;
  created_at: string | null;
  updated_at: string | null;
}

/** gift_designs */
export interface DbGiftDesign {
  design_id: string;
  design_key: string;
  name: string;
  gradient: string;
  is_active: boolean | null;
  display_order: number | null;
  created_at: string | null;
  updated_at: string | null;
}

/** site_settings — single-row config */
export interface DbSiteSettings {
  id: string;
  data: Record<string, unknown>;
  updated_at: string | null;
}

/** customized_trip_requests */
export interface DbCustomizedTripRequest {
  request_id: string;
  lead_id: string;
  trip_category: string;
  signature_journey_id: string | null;
  destination_interested: string;
  travel_month: string | null;
  travel_dates_from: string | null;
  travel_dates_to: string | null;
  duration: string | null;
  number_of_pax: number;
  num_adults: number | null;
  num_kids: number | null;
  num_senior_citizens: number | null;
  who_planning_for: string | null;
  budget_per_person: string | null;
  total_budget: number | null;
  type_of_experience: string | null;
  occasion: string | null;
  flight_assistance: boolean | null;
  flights_booked: boolean | null;
  visa_assistance: boolean | null;
  vehicle_type: string | null;
  hotel_category: string | null;
  trip_style: string | null;
  specific_experiences: string | null;
  complete_details: string | null;
  special_requirements: string | null;
  owner_id: string | null;
  pipeline_status: string;
  source_type: string;
  source: string;
  platform: string | null;
  ad_form_responses: Record<string, unknown> | null;
  quoted_price: number | null;
  converted_from_lead_trip_id: string | null;
  converted_to_trip_id: string | null;
  created_at: string;
  updated_at: string;
}
