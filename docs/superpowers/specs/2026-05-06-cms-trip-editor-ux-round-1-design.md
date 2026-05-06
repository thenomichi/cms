# CMS Trip Editor — UX Round 1

**Date:** 2026-05-06
**Author:** Deepak Handke (with Claude)
**Status:** Draft
**Scope:** CMS trip create/edit flow only

---

## Background

First-pass usage feedback on the CMS surfaced four pain points and one bug. This spec addresses all five together because they touch the same component tree (`app/(cms)/trips/_components/TripEditor.tsx` and the `tabs/*` files) and the same server action surface (`app/(cms)/trips/actions.ts`).

The CMS is operated by non-technical staff. Layman-proofing — autosave, draft recovery, foolproof inputs, low perceived latency — is the operating constraint, not a nice-to-have.

## Goals

1. Reduce perceived latency on save and content-update actions in the trip editor.
2. Make every numeric input impossible to leave in an invalid empty state.
3. Make a browser refresh during trip creation non-destructive — autosave with draft recovery.
4. Add an absolute-discount field (either/or with the existing percentage discount).
5. Replace the free-text departure-city input with a searchable list of popular cities, extensible inline.
6. Fix the end-date auto-calculation bug (and the related stale-closure issues in the pricing recompute).

## Non-goals

- Wizard redesign or step restructuring
- Mobile-first redesign
- Image upload UX
- Website-side rendering of the new `discount_amount` field (separate ticket)
- Dedicated `/settings/departure-cities` admin screen (deferred — inline add only for v1)
- Cross-tab editing safety (presence, version checks)

---

## Section 1 — Latency fixes

### Diagnosed sources

1. `isDirty` recomputes via `JSON.stringify(form)` of the entire form on every render (`TripEditor.tsx:55-58`). O(n) cost on a growing object causes keystroke lag in long itineraries.
2. `handleSave` awaits the full server-side work (DB writes + slug regen + `revalidateTrip` + `logActivity`) before the user gets feedback.
3. `uploadTripItineraryAction` dynamically imports `ensureCmsMediaBucketAllowsItineraryUploads` and calls it on every upload (`actions.ts:284-287`). Idempotent but pure round-trip tax.
4. `revalidateTrip(slug)` is awaited inside `createTripAction` and `updateTripAction`. CMS users shouldn't pay for public-cache revalidation interactively.
5. `logActivity` runs synchronously in the save path.

### Fixes

- **Dirty check:** replace `JSON.stringify` comparison with a dirty flag set as a `Set<string>` in a `useRef`. Fields mark themselves dirty in `updateField`. `isDirty = dirtySet.size > 0`. Reset on successful save.
- **Revalidation:** in `createTripAction` / `updateTripAction`, fire `revalidateTrip(slug)` and `logActivity(...)` non-awaited via `after()` from `next/server`. Action returns `{ success: true }` the moment DB writes commit.
  - Exception: when status crosses the public/non-public boundary (going public OR going from public to non-public), keep `revalidateTrip` awaited so the website is consistent immediately.
- **Bucket allowlist:** hoist `ensureCmsMediaBucketAllowsItineraryUploads` out of `uploadTripItineraryAction`. Either call once at module load or move to a one-time admin migration. The check is idempotent today; we just stop paying for it per-upload.
- **Optimistic save toast (optional polish):** show "Saving…" immediately on click; replace with success/error when the action returns. The current `loading` button state plus toast-on-return is acceptable; only add this if measurements show it's still slow after the above fixes.
- **Instrumentation:** add `console.time` blocks in dev around the three slowest paths (save, itinerary save, itinerary upload). Capture before/after numbers in the PR description.

### Risks

- `after()` requires Next 15+. The repo is on Next 16 per AGENTS.md, so it's available. Verify in `node_modules/next/dist/docs/` per AGENTS.md guidance before writing the import.
- Fire-and-forget `logActivity` swallows errors silently. Mitigation: wrap in `.catch(err => console.error(...))` so they surface in server logs.

---

## Section 2 — Numeric input correctness (`<NumberField>`)

### Component

New `components/ui/NumberField.tsx`, replacing the existing `NumericInput` (or extending it — pick whichever is less invasive after reading the current implementation).

**Props:**
```ts
interface NumberFieldProps {
  value: number | null;
  onChange: (n: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  allowNull?: boolean;       // default false
  showSteppers?: boolean;    // default true
  prefix?: string;           // e.g. "₹"
  suffix?: string;           // e.g. "%"
  placeholder?: string;
}
```

### Behavior

- Internal `useState<string>` for the editing buffer; outer numeric prop only updates on valid parses.
- While focused: free typing including empty string.
- On blur:
  - Empty + `allowNull` → `null`
  - Empty + `!allowNull` → `min ?? 0`
  - Below `min` → clamp to `min`
  - Above `max` → clamp to `max`
  - NaN → `min ?? 0`
- Steppers: `[-]` `[value]` `[+]` inline; disabled at bounds.
- `onWheel={e => e.currentTarget.blur()}` to prevent accidental scroll-changes-value.

### Migration map (every numeric input in the trips area)

| Field | min | max | allowNull |
|---|---|---|---|
| `duration_days` | 1 | 90 | false |
| `duration_nights` | 0 | 90 | false |
| `mrp_price` | 0 | — | true |
| `selling_price` | 0 | — | true (derived; rarely user-edited) |
| `quoted_price` | 0 | — | true |
| `discount_pct` | 0 | 100 | true |
| `discount_amount` (new) | 0 | — | true |
| `advance_pct` | 0 | 100 | false |
| `total_slots` | 1 | — | true |

### Tests

Unit tests for: clamp-on-blur, allowNull true/false, min/max, NaN paste, stepper bounds, prefix/suffix render, wheel-no-op.

---

## Section 3 — Autosave + draft recovery

### 3a. Data model

Migrations (additive, all nullable, safe):

```sql
ALTER TABLE trips
  ADD COLUMN last_autosaved_at timestamptz NULL,
  ADD COLUMN autosave_owner    uuid        NULL;
```

- `last_autosaved_at` set/NULL distinguishes autosave drafts from intentional drafts.
- `autosave_owner` scopes the resume prompt to the user who started the autosave (within tenant RLS).
- No `autosave_drafts` table — drafts live in `trips` with `status = 'Draft'`. `validateListableStatus` already prevents drafts from being public.

### 3b. Row materialization strategy

`nextTripId` requires a destination. To avoid generating throwaway IDs:

- **Phase A — local only:** while the user is on `/trips/new` and has not yet picked a destination, autosave is **localStorage only**. Status pill: "Saved on this device".
- **Phase B — server:** the moment a destination is picked, server-side `autosaveTripAction(null, payload)` materializes the row. Server returns the canonical `trip_id`. Client replaces the URL `/trips/new` → `/trips/<id>/edit` (using `router.replace`, no scroll).
- **Phase C — steady state:** all subsequent autosaves go to server, with localStorage mirror as a failure backstop.

### 3c. Server action

```ts
// app/(cms)/trips/actions.ts
export async function autosaveTripAction(
  tripId: string | null,
  payload: TripFormPayload,
): Promise<{ success: boolean; tripId?: string; savedAt?: string; error?: string }>;
```

Differences vs `createTripAction` / `updateTripAction`:

- Skips slug regen unless `trip_name` actually changed (and only writes the slug when the row is materialized).
- Skips `revalidateTrip` entirely — drafts are not public.
- Skips `logActivity` for individual autosaves; emits a single `AUTOSAVE_SESSION` event when the user closes the editor (post-MVP — for v1 we just skip).
- Partial update: writes only fields present and different from the current row.
- Bumps `last_autosaved_at = now()`, `autosave_owner = current_user_id`.

### 3d. Client behavior

- **Hook:** `useAutosave(form, { tripId, userId, onMaterialize })` — debounces 1500ms, manages localStorage mirror, retry, and status state.
- **Storage layers (in order of authority):**
  1. Server (`trips` row) — authoritative once row exists
  2. `localStorage["nomichi.trip-draft.<userId>.<tripId|NEW>"]`
- **On editor mount:**
  - Existing trip + localStorage mirror newer than `last_autosaved_at` → show "Restore unsaved changes from this device?" prompt.
  - `/trips/new` + localStorage `NEW`-keyed mirror exists → show "Pick up where you left off?" modal (Section 3e).
  - Otherwise → server state wins.
- **Manual Save click:**
  - If the form passes validation (existing `validateStep` for all steps + status-listable check): flushes pending debounce, cancels in-flight retry, calls full `updateTripAction`/`createTripAction` (which does revalidate + log), updates baseline.
  - If validation fails: behaves like today — toasts the first error, no save. The autosave row (if materialized) is unaffected and still holds the user's work as a Draft.
- **Failure handling (per Q4-A):**
  - Retry: exponential backoff at 2s, 5s, 15s, 30s, 60s. Cap at 60s interval.
  - After 30s of failed retries: non-blocking amber banner — *"We're having trouble saving to the server. Your changes are safe in this browser — don't close this tab."*
  - `beforeunload` warning if pending changes exist (extends current `useUnsavedChanges`).
  - On reconnect (`window.online` event): drain queue, resume.
- **localStorage cleanup:** key removed on every successful server save. On editor unmount with all changes saved, key removed.

### 3e. UI

**Status pill** (replaces current "Unsaved changes" text in editor top bar):

| State | Visual | Tooltip |
|---|---|---|
| `Saved · just now` / `Saved · 2 min ago` | green dot + relative time | "Your work is autosaved." |
| `Saving…` | spinner | — |
| `Saved on this device` | amber dot | "Saved locally. Will sync when connection is back / once you pick a destination." |
| `Couldn't save — retrying` | red dot | "We'll keep trying. Your changes are safe in this browser." |

**Resume modal** (`/trips/new` mount with existing draft):

- Title: *Pick up where you left off?*
- Card: trip name (or "Untitled draft"), destination (if set), last edited (relative), completeness bullets:
  - ✓ Trip info
  - ✓ 3 itinerary days
  - — Description not started
  - — Inclusions not started
- Primary: **Resume editing** (loads the draft into the editor, navigates to `/trips/<id>/edit` if materialized)
- Secondary: **Start fresh** — does NOT delete the existing draft (it goes to the Drafts list with its current name or "Untitled draft (2)" if name was empty). New blank editor opens.

**Trips list — Drafts surfacing:**

- Add a "Drafts" quick-filter chip at the top of the list with count: `Drafts (3)`.
- Each draft row: trip name (or "Untitled draft"), destination, last edited (relative), `X% complete` (count of wizard steps with non-default content / total steps).
- Inline action: **Delete draft** (hard delete; drafts are cheap and there's no audit need).

**Auto-purge:**

- Daily Vercel cron at 03:00 IST: `DELETE FROM trips WHERE status = 'Draft' AND last_autosaved_at < now() - interval '30 days'`.
- Soft warning: 7 days before purge, drafts list shows an amber pill on the row.
- Cron route: `app/api/cron/purge-drafts/route.ts`. Configured in `vercel.ts` cron config per AGENTS.md.

### Tests

- Integration test: mock failing server, verify localStorage mirror, retry backoff, banner appears at 30s, beforeunload triggers.
- Unit test: `useAutosave` hook state transitions.
- Manual scenarios:
  - Refresh mid-edit on `/trips/new` (no destination yet) → resume modal appears, state restored from localStorage.
  - Refresh mid-edit on `/trips/<id>/edit` → server state loads cleanly.
  - Network drop → status goes amber, recovers on reconnect.
  - 30-day-old draft → purged by cron; 23-day-old draft shows warning pill.

---

## Section 4 — Discount + departure city

### 4a. Absolute discount (either/or with %)

**Migration:**
```sql
ALTER TABLE trips
  ADD COLUMN discount_amount numeric(10,2) NULL,
  ADD CONSTRAINT trips_discount_either_or
    CHECK (discount_pct IS NULL OR discount_amount IS NULL);
```

**Type/schema updates:**
- `TripFormState`: add `discount_amount: number | null`.
- `tripBasicSchema` (Zod): add `discount_amount` with same nullability + cross-field refinement enforcing either/or.
- `TripFull` (`lib/db/trips`): add `discount_amount`.
- `TripFormPayload.basic`: add `discount_amount`.

**UI (`BasicTab.tsx` Pricing section, non-custom path only):**

Replace the single `discount_pct` field with a discount-type radio group:

- `( ) None  ( ) Percentage  ( ) Flat amount`
- Percentage selected → `<NumberField>` for `discount_pct` (0–100, suffix `%`)
- Flat amount selected → `<NumberField>` for `discount_amount` (min 0, prefix from `currency_code`)
- None → both null
- Switching radios clears the other value (no migration of values across radio change — explicit clear).

**Selling price recompute** (Section 5 covers the bug):

```ts
const mrp = form.mrp_price ?? 0;
let selling = mrp;
if (form.discount_pct && form.discount_pct > 0) {
  selling = Math.round(mrp * (1 - form.discount_pct / 100));
} else if (form.discount_amount && form.discount_amount > 0) {
  selling = Math.max(0, mrp - form.discount_amount);
}
```

**Discount badge on success card** (lines 218-227 of BasicTab):
- If `discount_amount` set → `"₹X,XXX off"`
- Else if `discount_pct` set → `"X% off"`
- Crossed-out MRP and final selling price unchanged.

**Tests:**
- Unit: switching radio clears the other value.
- Integration: DB rejects insert/update with both `discount_pct` and `discount_amount` set.
- Type test: Zod schema rejects payload with both set.

### 4b. Departure city — table + inline combobox

**Migration:**
```sql
CREATE TABLE departure_cities (
  departure_city_id text PRIMARY KEY,            -- IATA where applicable, else slug
  city_name         text NOT NULL,
  country_code      text NOT NULL,               -- ISO-3166-1 alpha-2
  country_name      text NOT NULL,
  is_popular        boolean NOT NULL DEFAULT false,
  is_active         boolean NOT NULL DEFAULT true,
  display_order     integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_departure_cities_active_popular
  ON departure_cities (is_active, is_popular DESC, display_order, city_name);
```

**Seed (initial popular set):**

- **India:** DEL/Delhi, BOM/Mumbai, BLR/Bangalore, MAA/Chennai, CCU/Kolkata, HYD/Hyderabad, PNQ/Pune, AMD/Ahmedabad, GOI/Goa, GAU/Guwahati, IXL/Leh, SXR/Srinagar, JAI/Jaipur, COK/Kochi, TRV/Trivandrum
- **International (Nomichi-relevant):** DPS/Bali, BKK/Bangkok, HKT/Phuket, KTM/Kathmandu, CMB/Colombo, DXB/Dubai, SIN/Singapore, KUL/Kuala Lumpur, HAN/Hanoi, SGN/Ho Chi Minh

All seeded with `is_popular = true`.

**`trips.departure_city`:** kept as text (denormalized `city_name`). No FK in v1 — existing rows keep working untouched. FK is a follow-up once data is clean.

**UI: searchable Combobox** (replaces the free-text input in BasicTab `Capacity & Logistics`):

- Behavior: shadcn `Command`-style popover with input + filtered list.
- Default open state: shows popular cities grouped by Domestic / International.
- Search: matches `city_name` and `country_name` (case-insensitive `ILIKE`).
- "Add new city…" appears at the bottom of results when input doesn't match any existing entry.
  - Click → small inline modal:
    - City name (text)
    - Country (dropdown of ISO countries — use a static list `lib/constants/countries.ts`)
    - Mark as popular (checkbox)
  - Submit calls new `addDepartureCityAction({ city_name, country_code, country_name, is_popular })` → returns the new row → combobox auto-selects it.
- Selecting a city writes its `city_name` to `form.departure_city`.
- Backward compat: if a trip has a `departure_city` value that doesn't match any row in `departure_cities`, the combobox shows it as the selected value (free text fallback). User can keep it or reselect.

**Server action:**

```ts
// app/(cms)/trips/actions.ts (or new app/(cms)/departure-cities/actions.ts)
export async function addDepartureCityAction(input: {
  city_name: string;
  country_code: string;
  country_name: string;
  is_popular?: boolean;
}): Promise<{ success: boolean; city?: DepartureCity; error?: string }>;
```

- Generates `departure_city_id` by slugifying `city_name` + country_code (e.g., "pokhara-np"). If a known IATA is provided, prefer that.
- Logs to `logActivity` (the city table is reference data; one log per add is fine).

**Loader:**
- New `lib/db/departure-cities.ts` with `listDepartureCities()` (cached at request scope).
- Loaded server-side and passed to `TripEditor` alongside `destinations`.

**Tests:**
- Unit: combobox surfaces popular first.
- Unit: inline add flow.
- Unit: backward-compat fallback for legacy free-text values.

---

## Section 5 — End-date + derived-field bug fixes

### Bugs

1. **End date doesn't recompute on duration change.** `BasicTab.tsx:92-100` updates `duration_days` and `duration_nights` but never recalculates `end_date`. End date only updates when `start_date` changes.
2. **Stale-closure risk in start-date handler** (`BasicTab.tsx:124-133`): reads `form.duration_days` from closure. Usually fine due to React batching, but a latent off-by-one-render bug.
3. **Stale-closure risk in MRP / discount handlers** (`BasicTab.tsx:184-186`, `198-200`): same pattern. `selling_price` recompute reads the other field from the closure.

### Fix

Centralize all derived-field calculations in `useEffect` hooks in `TripEditor` (or a `useDerivedTripFields(form, setForm)` hook). Remove the recalculation code from individual onChange handlers.

```ts
// End date <- start_date + duration_days
useEffect(() => {
  if (!form.start_date || form.duration_days <= 0) return;
  const end = new Date(form.start_date);
  end.setDate(end.getDate() + form.duration_days - 1);
  const newEnd = end.toISOString().split("T")[0];
  if (newEnd !== form.end_date) {
    setForm((prev) => ({ ...prev, end_date: newEnd }));
  }
}, [form.start_date, form.duration_days]);

// Selling price <- mrp_price + (discount_pct OR discount_amount)
useEffect(() => {
  const mrp = form.mrp_price ?? 0;
  if (mrp <= 0) return;
  let selling = mrp;
  if (form.discount_pct && form.discount_pct > 0) {
    selling = Math.round(mrp * (1 - form.discount_pct / 100));
  } else if (form.discount_amount && form.discount_amount > 0) {
    selling = Math.max(0, mrp - form.discount_amount);
  }
  if (selling !== form.selling_price) {
    setForm((prev) => ({ ...prev, selling_price: selling }));
  }
}, [form.mrp_price, form.discount_pct, form.discount_amount]);
```

`duration_nights` auto-calc stays in the duration onChange (line 96-97) since it's a one-shot suggestion the user can override; the existing amber-warning pattern handles the override.

### Edge cases

- User clears `start_date` → end date is left as last computed value. UX-wise that's fine since the field is read-only and the empty-start guard prevents recomputing wrong values; alternatively clear `end_date` when `start_date` is empty. **Decision: clear `end_date` when `start_date` is empty.**
- Timezone: `new Date("YYYY-MM-DD")` parses as UTC midnight. We re-format with `toISOString().split("T")[0]` immediately. No drift.

### Tests

Matrix:
- Set start, then change days → end recomputes
- Set days, then set start → end computes
- Both change in same render → end uses new values
- Clear start → end clears
- Set MRP, then set %; set %, then set MRP — selling recomputes from latest of both
- Switch from % to flat amount and back — selling tracks correctly

---

## Rollout

Five PRs, each independently shippable and revertable.

| PR | Scope | DB? |
|---|---|---|
| 1 | Latency fixes + Section 5 derived-field bug fixes | No |
| 2 | `<NumberField>` component + migrate every numeric input | No |
| 3 | `discount_amount` field + radio toggle | Yes (additive) |
| 4 | `departure_cities` table + inline combobox | Yes (additive) |
| 5 | Autosave + draft recovery + drafts list filter + purge cron | Yes (additive) |

Order chosen so the user feels speed first, then small UX wins, then gets the safety net.

## Risks & mitigations

- **`after()` hides errors:** wrap fire-and-forget calls in `.catch(err => console.error(...))` so they surface in server logs.
- **Cross-tab autosave race:** last-write-wins for v1; soft warning + `last_autosaved_at` make it recoverable. Pessimistic locking is a follow-up if it becomes a real complaint.
- **localStorage quota:** trip payload ~10–50KB; per-user-per-trip key keeps it bounded under 5MB. Cleared on successful server save.
- **Tab closed before destination picked:** localStorage mirror IS the safety net. Survives only on that device — explicit per Q4-A; status pill makes this visible ("Saved on this device").
- **Drafts list bloat from "hide don't delete":** 30-day auto-purge + 7-day warning + manual delete handle this.
- **Schema migrations:** all additive (new columns nullable, new tables). No backfill required, no coordinated downtime.
- **Currency on flat-amount discount:** uses `trips.currency_code` for the prefix; covered by existing logic.

## Follow-ups (out of scope, tracked here)

- Website-side rendering of `discount_amount` ("₹5,000 off") on trip detail and listing pages.
- Dedicated `/settings/departure-cities` admin screen for non-inline city management.
- Analytics on draft abandonment (Resume vs Start Fresh click rates).
- Optional FK from `trips.departure_city_id` → `departure_cities` once data is clean.
- Cross-tab editing safety (presence indicators, version checks).
- End-date manual override toggle if we ever make end-date editable.

## Testing strategy

- **Latency:** before/after `console.time` numbers in PR 1 description for save (small + large itinerary), itinerary edit, itinerary upload.
- **NumberField:** unit tests per spec in Section 2.
- **Discount toggle:** unit + DB constraint test.
- **Departure city:** unit tests for combobox grouping, search, inline add, legacy fallback.
- **Autosave:** unit (hook state machine) + integration (mocked failing server) + manual scenarios in Section 3.
- **Derived fields:** matrix tests in Section 5.
- **Purge cron:** unit test for cutoff and warning trigger.
