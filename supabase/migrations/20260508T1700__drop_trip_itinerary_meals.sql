-- Drop trip_itinerary.meals and trip_itinerary.accommodation.
--
-- The CMS editor exposed two text fields per day — meals (CSV-ish) and
-- accommodation — that confused admins (no clear distinction from the
-- existing tags column; accommodation was never rendered on the public
-- site at all). The new layman-friendly UX is a single chip-input on
-- `tags`, with Enter creating chips and × removing.
--
-- Verified before running: 0 prod rows have meals data; accommodation
-- has never been rendered on the public site. Dropping both keeps the
-- schema honest (no dead-data columns left behind).

ALTER TABLE trip_itinerary
  DROP COLUMN meals,
  DROP COLUMN accommodation;
