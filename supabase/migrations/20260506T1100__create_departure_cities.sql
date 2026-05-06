-- PR 4: Searchable departure-city list, extensible by admins.
-- Additive: new table + index + seed. trips.departure_city stays text
-- (denormalized) for backward compat with existing rows.

CREATE TABLE departure_cities (
  departure_city_id text PRIMARY KEY,
  city_name         text NOT NULL,
  country_code      text NOT NULL,
  country_name      text NOT NULL,
  is_popular        boolean NOT NULL DEFAULT false,
  is_active         boolean NOT NULL DEFAULT true,
  display_order     integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_departure_cities_active_popular
  ON departure_cities (is_active, is_popular DESC, display_order, city_name);

-- Seed: popular Indian cities
INSERT INTO departure_cities (departure_city_id, city_name, country_code, country_name, is_popular) VALUES
  ('DEL', 'Delhi',     'IN', 'India', true),
  ('BOM', 'Mumbai',    'IN', 'India', true),
  ('BLR', 'Bangalore', 'IN', 'India', true),
  ('MAA', 'Chennai',   'IN', 'India', true),
  ('CCU', 'Kolkata',   'IN', 'India', true),
  ('HYD', 'Hyderabad', 'IN', 'India', true),
  ('PNQ', 'Pune',      'IN', 'India', true),
  ('AMD', 'Ahmedabad', 'IN', 'India', true),
  ('GOI', 'Goa',       'IN', 'India', true),
  ('GAU', 'Guwahati',  'IN', 'India', true),
  ('IXL', 'Leh',       'IN', 'India', true),
  ('SXR', 'Srinagar',  'IN', 'India', true),
  ('JAI', 'Jaipur',    'IN', 'India', true),
  ('COK', 'Kochi',     'IN', 'India', true),
  ('TRV', 'Trivandrum','IN', 'India', true);

-- Seed: international cities Nomichi runs trips from / to
INSERT INTO departure_cities (departure_city_id, city_name, country_code, country_name, is_popular) VALUES
  ('DPS', 'Bali (Denpasar)',  'ID', 'Indonesia',   true),
  ('BKK', 'Bangkok',           'TH', 'Thailand',    true),
  ('HKT', 'Phuket',            'TH', 'Thailand',    true),
  ('KTM', 'Kathmandu',         'NP', 'Nepal',       true),
  ('CMB', 'Colombo',           'LK', 'Sri Lanka',   true),
  ('DXB', 'Dubai',             'AE', 'UAE',         true),
  ('SIN', 'Singapore',         'SG', 'Singapore',   true),
  ('KUL', 'Kuala Lumpur',      'MY', 'Malaysia',    true),
  ('HAN', 'Hanoi',             'VN', 'Vietnam',     true),
  ('SGN', 'Ho Chi Minh City',  'VN', 'Vietnam',     true);
