-- Seedable, admin-editable list of common exclusions used in the trip
-- editor. Mirrors the departure_cities shape: a small reference table
-- the CMS combobox lists, with inline-add support.
--
-- Existing trip_inclusions rows (where inclusion_type='exclusion') are
-- NOT migrated to FK against this table — they keep storing the name
-- directly so legacy/freeform exclusions remain valid. This table is
-- the source of truth for *suggestions* in the editor, not for the
-- exclusions stored against a trip.

CREATE TABLE exclusions (
  exclusion_id  text PRIMARY KEY,
  name          text NOT NULL UNIQUE,
  is_popular    boolean NOT NULL DEFAULT false,
  is_active     boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Powers the combobox listing: active first, popular at top, then
-- alphabetical within tiers.
CREATE INDEX idx_exclusions_active_popular
  ON exclusions (is_active, is_popular DESC, display_order, name);

-- Seed: lift the 12 entries currently hardcoded in
-- lib/constants.ts EXCLUSION_REPOSITORY. Marked popular so they land
-- at the top of the dropdown by default. Slug-based ids so future
-- inline adds compose the same way.
INSERT INTO exclusions (exclusion_id, name, is_popular) VALUES
  ('personal-expenses',     'Personal expenses',     true),
  ('travel-insurance',      'Travel insurance',      true),
  ('visa-fees',             'Visa fees',             true),
  ('international-flights', 'International flights', true),
  ('tips-gratuities',       'Tips & gratuities',     true),
  ('alcoholic-beverages',   'Alcoholic beverages',   true),
  ('camera-drone-fees',     'Camera/drone fees',     true),
  ('adventure-gear-rental', 'Adventure gear rental', true),
  ('extra-meals',           'Extra meals',           true),
  ('laundry',               'Laundry',               true),
  ('medical-expenses',      'Medical expenses',      true),
  ('room-upgrades',         'Room upgrades',         true);
