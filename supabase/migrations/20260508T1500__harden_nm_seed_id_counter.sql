-- Harden nm_seed_id_counter against legacy / non-conforming row IDs.
--
-- Bug: when seeding the id_counters scope for a (table, column, prefix)
-- combination, the function casts the last hyphen-segment of every row
-- matching `LIKE 'PREFIX-%'` to int. Rows like `TC-JPN-H1` (legacy
-- alphanumeric content_ids that predate the canonical `TC-{nnnn}`
-- pattern) blow up the cast: `H1` → invalid input syntax for type integer.
--
-- Fix: restrict the MAX to rows whose value matches `^PREFIX-[0-9]+$`
-- exactly, and substring out the digits part directly (no `split_part`
-- ambiguity for multi-hyphen prefixes). Legacy/non-conforming rows are
-- ignored — they keep working as data, they just don't participate in
-- sequence allocation.
--
-- All callers of nm_next_sequential_id (trip_content, trip_inclusions,
-- trip_itinerary, trip_gallery, careers, team_members, site_gallery,
-- raw_moments) benefit from this fix without code changes.

CREATE OR REPLACE FUNCTION public.nm_seed_id_counter(
  p_table  text,
  p_column text,
  p_prefix text,
  p_scope  text
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_max    int;
  v_regex  text;
BEGIN
  IF p_table  !~ '^[a-z_][a-z0-9_]*$' THEN RAISE EXCEPTION 'invalid table';  END IF;
  IF p_column !~ '^[a-z_][a-z0-9_]*$' THEN RAISE EXCEPTION 'invalid column'; END IF;
  IF p_prefix !~ '^[A-Za-z0-9_-]+$'   THEN RAISE EXCEPTION 'invalid prefix'; END IF;

  -- Match exactly: PREFIX-{one or more digits}, end of string.
  v_regex := '^' || p_prefix || '-[0-9]+$';

  EXECUTE format(
    $sql$
      SELECT COALESCE(
        MAX( substring(%I from $2)::int ),
        0
      )
      FROM public.%I
      WHERE %I ~ $1
    $sql$,
    p_column, p_table, p_column
  )
  -- $1: full-match regex used by WHERE
  -- $2: capture-group regex that pulls the trailing digits
  INTO v_max
  USING v_regex, p_prefix || '-([0-9]+)$';

  INSERT INTO public.id_counters (scope, next_value)
  VALUES (p_scope, v_max + 1)
  ON CONFLICT (scope) DO NOTHING;
END;
$function$;

-- Backfill safety: if a scope was already seeded with the buggy logic and
-- silently capped at the wrong value, the existing INSERT ... ON CONFLICT
-- DO NOTHING above won't repair it. But in practice the only scopes that
-- could be affected are those where the seeding ERROR'd — which means the
-- counter row was never created in the first place. Next call will re-seed
-- with the new function and produce the right value. No backfill needed.
