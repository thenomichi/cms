-- Unified suggestion pools for trip Inclusions (icon + name + category)
-- and Exclusions (name + category, no icon). Both are admin-extensible
-- via inline-add. Replaces the hardcoded INCLUSION_REPOSITORY constant
-- in lib/constants.ts and re-seeds the existing exclusions table to
-- match the master pool the operator curated from 8 real itineraries.
--
-- Idempotent drop-and-rebuild — staging-safe. Existing trip_inclusions /
-- exclusions / inclusion_chips rows are throwaway test data per the
-- operator. Trips will need their inclusions/exclusions re-picked after
-- this runs.

-- ---------------------------------------------------------------------------
-- 1. Drop everything we own. Order matters: drop the suggestion pools
--    after wiping the per-trip rows that reference them by string.
-- ---------------------------------------------------------------------------

TRUNCATE trip_inclusions;
DROP TABLE IF EXISTS inclusion_chips;
DROP TABLE IF EXISTS exclusions;

-- ---------------------------------------------------------------------------
-- 2. inclusion_chips — DB-backed suggestion pool with icons + category
--    grouping. Same admin-extensible shape as departure_cities.
-- ---------------------------------------------------------------------------

CREATE TABLE inclusion_chips (
  chip_id       text PRIMARY KEY,
  name          text NOT NULL UNIQUE,
  icon          text NOT NULL,
  category      text NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inclusion_chips_active_category
  ON inclusion_chips (is_active, category, display_order, name);

INSERT INTO inclusion_chips (chip_id, name, icon, category, display_order) VALUES
  -- Travel & Transfers
  ('airport-transfer',       'Airport Transfer',         '✈️',  'Travel & Transfers',   10),
  ('bus-stop-transfer',      'Bus Stop Transfer',        '🚏',  'Travel & Transfers',   20),
  ('train-transfer',         'Train Transfer',           '🚆',  'Travel & Transfers',   30),
  ('overnight-transfer',     'Overnight Transfer',       '🌙',  'Travel & Transfers',   40),
  ('local-transport',        'Local Transport',          '🚐',  'Travel & Transfers',   50),
  ('backup-support-vehicle', 'Backup Support Vehicle',   '🚙',  'Travel & Transfers',   60),
  ('motorcycle',             'Motorcycle',               '🏍️', 'Travel & Transfers',   70),
  ('fuel',                   'Fuel',                     '⛽',  'Travel & Transfers',   80),
  ('international-flights',  'International Flights',    '🌍',  'Travel & Transfers',   90),

  -- Accommodation
  ('hotel',         'Hotel',           '🏨',  'Accommodation', 10),
  ('homestay',      'Homestay',        '🏠',  'Accommodation', 20),
  ('camping-tents', 'Camping / Tents', '⛺',  'Accommodation', 30),
  ('hostel',        'Hostel',          '🛏️', 'Accommodation', 40),
  ('rest-house',    'Rest House',      '🏚️', 'Accommodation', 50),

  -- Meals
  ('breakfast', 'Breakfast', '🥐',  'Meals', 10),
  ('lunch',     'Lunch',     '🍱',  'Meals', 20),
  ('dinner',    'Dinner',    '🍽️', 'Meals', 30),
  ('snacks',    'Snacks',    '🍿',  'Meals', 40),

  -- Activities & Experiences
  ('activities',         'Activities',                 '🎯',  'Activities & Experiences', 10),
  ('festival-pass',      'Festival Pass',              '🎫',  'Activities & Experiences', 20),
  ('treks-hikes',        'Treks & Hikes',              '🥾',  'Activities & Experiences', 30),
  ('live-music',         'Live Music / Jam Sessions',  '🎵',  'Activities & Experiences', 40),
  ('rafting',            'Rafting',                    '🛶',  'Activities & Experiences', 50),
  ('cycling',            'Cycling',                    '🚴',  'Activities & Experiences', 60),
  ('photography',        'Photography',                '📸',  'Activities & Experiences', 70),
  ('sunset-sessions',    'Sunset Sessions',            '🌅',  'Activities & Experiences', 80),

  -- Gear & Equipment
  ('riding-gear',          'Riding Gear',           '🪖',  'Gear & Equipment', 10),
  ('team-gear',            'Team Gear',             '🎽',  'Gear & Equipment', 20),
  ('ropes',                'Ropes',                 '🪢',  'Gear & Equipment', 30),
  ('camp-equipment',       'Camp Equipment',        '🔦',  'Gear & Equipment', 40),
  ('camera-drone-fees',    'Camera / Drone Fees',   '📷',  'Gear & Equipment', 50),
  ('adventure-gear-rental','Adventure Gear Rental', '🎒',  'Gear & Equipment', 60),
  ('photography-equipment','Photography Equipment', '📸',  'Gear & Equipment', 70),

  -- Permits & Tickets
  ('inner-line-permits', 'Inner Line Permits', '📋',  'Permits & Tickets', 10),
  ('entry-tickets',      'Entry Tickets',      '🎟️', 'Permits & Tickets', 20),
  ('visa-fees',          'Visa Fees',          '🪪',  'Permits & Tickets', 30),

  -- People & Support
  ('trip-captain',     'Trip Captain / Local Buddy', '🧭',   'People & Support', 10),
  ('marshall',         'Marshall',                   '🚩',   'People & Support', 20),
  ('mechanic-support', 'Mechanic Support',           '🛠️',  'People & Support', 30),
  ('guide-charges',    'Guide Charges',              '🧑‍✈️', 'People & Support', 40),
  ('helpline-247',     '24/7 Helpline',              '📞',   'People & Support', 50),

  -- Safety & Health
  ('medical-kit',          'Medical Kit',           '🏥',  'Safety & Health', 10),
  ('oxygen-cylinder',      'Oxygen Cylinder',       '🫁',  'Safety & Health', 20),
  ('repellent-sunscreen',  'Repellent & Sunscreen', '🧴',  'Safety & Health', 30),
  ('toilet',               'Toilet',                '🚻',  'Safety & Health', 40),
  ('health-insurance',     'Health Insurance',      '🛡️', 'Safety & Health', 50),

  -- Extras
  ('welcome-kit', 'Welcome Kit / Giveaways', '🎁', 'Extras', 10);

-- ---------------------------------------------------------------------------
-- 3. exclusions — DB-backed suggestion pool, name + category, no icon.
--    Recreated from scratch; the column shape used by the prior version
--    is preserved (id, name, is_popular, is_active, display_order) plus
--    the new category column.
-- ---------------------------------------------------------------------------

CREATE TABLE exclusions (
  exclusion_id  text PRIMARY KEY,
  name          text NOT NULL UNIQUE,
  category      text NOT NULL DEFAULT 'Other',
  is_popular    boolean NOT NULL DEFAULT false,
  is_active     boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_exclusions_active_category
  ON exclusions (is_active, category, display_order, name);

INSERT INTO exclusions (exclusion_id, name, category, display_order, is_popular) VALUES
  -- Travel & Transfers
  ('domestic-flights',      'Domestic Flights',            'Travel & Transfers', 10, true),
  ('pickup-drop-offsched',  'Pickup & Drop (off-schedule)','Travel & Transfers', 20, true),

  -- Accommodation
  ('room-upgrades',         'Room Upgrades',               'Accommodation',      10, true),

  -- Meals
  ('extra-meals',           'Extra Meals',                 'Meals',              10, true),
  ('alcoholic-beverages',   'Alcoholic Beverages',         'Meals',              20, true),

  -- Activities
  ('paragliding',           'Paragliding',                 'Activities',         10, false),
  ('additional-activities', 'Additional Activities',       'Activities',         20, true),

  -- Safety & Health
  ('travel-insurance',      'Travel Insurance',            'Safety & Health',    10, true),
  ('medical-emergencies',   'Medical Emergencies',         'Safety & Health',    20, true),

  -- Personal
  ('personal-expenses',     'Personal Expenses',           'Personal',           10, true),
  ('tips-gratuities',       'Tips & Gratuities',           'Personal',           20, true),
  ('porterage',             'Porterage',                   'Personal',           30, true),
  ('laundry',               'Laundry',                     'Personal',           40, true),

  -- Catch-alls & Disclaimers
  ('unforeseen',            'Unforeseen Circumstances',    'Catch-alls',         10, true),
  ('lost-stolen',           'Lost / Stolen Belongings',    'Catch-alls',         20, true),
  ('not-mentioned',         'Anything Not Mentioned',      'Catch-alls',         30, true);
