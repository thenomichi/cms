-- PR 5: Autosave + draft recovery.
-- Additive: two nullable columns + a partial index over Draft rows scoped
-- to the autosave owner (Supabase Auth user id). Existing rows are
-- unaffected and continue to behave exactly as before.

ALTER TABLE trips
  ADD COLUMN last_autosaved_at timestamptz NULL,
  ADD COLUMN autosave_owner    uuid        NULL;

-- Powers the "resume your draft" lookup: most recent autosaved Draft for
-- the current admin. Partial index keeps it tiny since the vast majority
-- of trips are not Draft rows.
CREATE INDEX idx_trips_drafts_by_owner
  ON trips (autosave_owner, last_autosaved_at DESC)
  WHERE status = 'Draft';
