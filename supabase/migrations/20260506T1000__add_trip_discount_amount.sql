-- PR 3: Add absolute discount as an alternative to discount_pct.
-- Either/or constraint enforces UI invariant at the DB level.
-- Additive + nullable: existing rows are unaffected.

ALTER TABLE trips
  ADD COLUMN discount_amount numeric(10, 2) NULL;

ALTER TABLE trips
  ADD CONSTRAINT trips_discount_either_or
  CHECK (discount_pct IS NULL OR discount_amount IS NULL);
