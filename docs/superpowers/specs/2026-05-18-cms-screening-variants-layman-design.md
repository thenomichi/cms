# CMS — Screening & Trip Variants — Layman-First Design

**Target repo:** `/Users/deepakhandke/Desktop/code-repos/nomichi/new/cms`
**Companion (engineering reference, supersedes nothing in this doc when they conflict):**
`./2026-05-18-cms-screening-and-variants-design.md`

**Date:** 2026-05-18
**Status:** Approved for plan-writing. Implementation plan comes next.

---

## 1. Why this doc exists

The companion spec specifies the data model and server-side architecture for
adding Screening (Trip Fit Check) and Trip Variants to the CMS. That spec is
correct on data, RPCs, and migrations, but it surfaces engineering concepts
(catalog versions, immutability, question_keys, axis_keys, sort_order) directly
in the UI. The CMS is used by non-technical founders. This document is the
**UX contract** that overrides the companion spec wherever the two disagree on
user-facing surface.

**Rule of thumb:** if a user would have to ask "what does this word mean?", we
solved it wrong. Every input must reduce, not add to, cognitive load.

---

## 2. Scope

### In scope (this PR)
1. **Trip wizard — Screening step** (only for `trip_type === "Community"`,
   i.e. Soulful Escapes; default ON for new Community trips).
2. **Trip wizard — Variants step** (all trips, always visible, empty-state hero).
3. **`/screening` global catalog editor** (new sidebar entry, draft-managed,
   versions hidden from UI).

### Out of scope (explicit non-goals)
- **Flagged booking review queue.** The override workflow lives in the **Ops
  tool**, not the CMS. CMS does not read or write `screening_submissions`.
- Per-trip question subsets (`screening_question_keys` stays `[]` in DB).
- Schema migrations — tables already exist in `website/supabase/migrations/`.
- Website code changes.
- Per-user CMS auth / RBAC (existing cookie gate continues).

---

## 3. Trip-type gating (critical)

Screening UI appears **only when `trip_type === "Community"`**. The three
trip types in the CMS are:

| `trip_type` (DB)      | Label shown to founder    | Has Screening tab? |
|-----------------------|---------------------------|--------------------|
| `Community`           | "Soulful Escapes"         | **Yes — default ON** |
| `Beyond Ordinary`     | "Beyond Ordinary"         | No                 |
| `Signature Journey`   | "Signature"               | No                 |

Implementation note: the gating happens in the `TripEditor` tab list — the
Screening tab is filtered out client-side when `trip_type !== "Community"`.
If a founder changes a trip from Community → another type, `screening_enabled`
is force-set to `false` on save (server-side, in `updateTripAction`).

The Variants tab appears on **all** trips regardless of `trip_type`.

---

## 4. Trip wizard — Screening step

### 4.1 Location
New tab `ScreeningTab` in `app/(cms)/trips/_components/tabs/`, inserted into the
trip-edit stepper after `SettingsTab` and before `GalleryTab`. The wizard's
existing `STEPS` array gains a `screening` step that is **filtered out** of the
visible tab list when `trip_type !== "Community"`.

### 4.2 UI

```
┌───────────────────────────────────────────────────────────┐
│ Trip Fit Check                                            │
│                                                           │
│ ┌─ ℹ What is this? ────────────────────────────────────┐ │
│ │ A short questionnaire shown to customers between     │ │
│ │ Traveller Details and Payment. Customers whose       │ │
│ │ answers don't fit a Soulful Escapes vibe are         │ │
│ │ flagged — they can't pay until the Ops team reviews. │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                           │
│ ●━━━ Run Trip Fit Check for this trip                     │
│       (default ON for Soulful Escapes)                    │
│                                                           │
│ ── Questions customers will see ──────────────────────── │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ 1. What kind of trip excites you?                     │ │
│ │    ○ Adventure   ○ Balanced   ○ Relaxed               │ │
│ │                                                       │ │
│ │ 2. Vibe within the group?                             │ │
│ │    ○ Quiet      ○ Social      ○ Mixed                 │ │
│ │ …                                                     │ │
│ │ (8 questions in total — read-only preview)            │ │
│ │                                                       │ │
│ │ Want to change a question? → [Edit globally ↗]        │ │
│ └───────────────────────────────────────────────────────┘ │
│                                                           │
│ (When toggle is OFF, the question preview is replaced by) │
│ ▒ Customers will skip the Fit Check and go straight      │
│ ▒ from Traveller Details to Payment.                     │
└───────────────────────────────────────────────────────────┘
```

### 4.3 Components used
- `Card` for the explainer block (icon: `Info` from lucide).
- `Toggle` (single binary input on this tab).
- Plain divs / `Card` for the question preview — **no inputs anywhere in the
  preview**. The preview renders the active catalog via `getActiveCatalog()`
  from `lib/db/screening.ts`.
- `Button` (variant=`ghost`) with `ExternalLink` icon, opens `/screening` in
  the same tab.

### 4.4 Form state delta
Extend `TripFormState` in `app/(cms)/trips/_components/types.ts`:

```ts
export interface TripFormState {
  // … existing fields …
  screening_enabled: boolean;
}
```

`screening_question_keys` is NOT added to the form state in v1 — the trip
wizard cannot edit it. The DB column stays `[]` (= "use all active questions").

### 4.5 Defaults
- `buildInitialState(null)` (new trip): `screening_enabled = true` when
  `trip_type === "Community"`, else `false`.
- `buildInitialState(trip)` (existing trip): read `trip.screening_enabled`.

### 4.6 Server action
Extend `updateTripAction` in `app/(cms)/trips/actions.ts` and the trip update
zod schema in `lib/schemas/trip.ts` to accept `screening_enabled` (boolean).
On save:
- If `trip_type !== "Community"`, force `screening_enabled = false`
  server-side (defense-in-depth — the UI also enforces this).
- Call `revalidateTrip(slug)` after success so the website's trip detail page
  picks up the new value.
- `logActivityAsync({ entity_type: "trip", entity_id, action: "update",
  metadata: { screening_enabled } })`.

---

## 5. Trip wizard — Variants step

### 5.1 Location
New tab `VariantsTab` in `app/(cms)/trips/_components/tabs/`, inserted into the
trip-edit stepper after `ScreeningTab` (or after `SettingsTab` for non-Community
trips). Always visible — there is no trip-type gating for Variants.

### 5.2 Empty state (default for trips with no variants)

```
┌───────────────────────────────────────────────────────────┐
│ Trip Variants                                             │
│                                                           │
│ ┌─ 🎟 This trip has one fixed price per person ──────────┐ │
│ │                                                        │ │
│ │ Add a price choice if customers should pick between    │ │
│ │ options at booking — like room sharing or travel mode. │ │
│ │                                                        │ │
│ │              [ + Add a price choice ]                  │ │
│ └────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

Component: `EmptyState` with a primary `Button`.

### 5.3 Group-slug missing state
If `trip.group_slug` is null/empty, the entire tab body is replaced with:

```
┌───────────────────────────────────────────────────────────┐
│ ┌─ ⚠ No trip group set ──────────────────────────────────┐ │
│ │ Price options are shared across all batches of a trip │ │
│ │ group. Set a Trip Group on the Basic tab to add price │ │
│ │ choices.                                              │ │
│ │                                                       │ │
│ │              [ Set trip group → ]                     │ │
│ └───────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

The "Set trip group →" button uses the existing tab-navigation hook to switch
to BasicTab and focuses the `group_slug` input via `ref.focus()`.

### 5.4 Populated state (one or more axes exist)

```
┌───────────────────────────────────────────────────────────┐
│ Trip Variants                            [+ Add price choice]│
│                                                           │
│ ┌─ Room sharing ────────────────────────────────  [⋮] ──┐ │
│ │ ⚠ Price options apply to all batches in this group —  │ │
│ │   not just this batch.                                │ │
│ │                                                       │ │
│ │ Description: Pick how you'd like to share your room   │ │
│ │                                                       │ │
│ │ Options (drag to reorder):                            │ │
│ │ ┌──────────────────────────────────────────────────┐ │ │
│ │ │ ⠿  Double sharing   ₹ [ 45,000 ]   ●━━ Show     │ │ │
│ │ │    [Add description]                       [✕]   │ │ │
│ │ │ ⠿  Triple sharing   ₹ [ 38,000 ]   ●━━ Show     │ │ │
│ │ │    [Add description]                       [✕]   │ │ │
│ │ └──────────────────────────────────────────────────┘ │ │
│ │   ℹ Customers already in the funnel keep the price   │ │
│ │     they were quoted.                                 │ │
│ │ [ + Add option ]                                     │ │
│ └───────────────────────────────────────────────────────┘ │
│                                                           │
│ ┌─ Travel mode ────  (collapsed) ──────────────── [⋮] ─┐ │
│ └───────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

### 5.5 Add-axis flow (the 90% path)
Clicking `+ Add a price choice` opens a `FormModal` with **preset pills**:

```
┌─────── Add a price choice ───────┐
│                                  │
│ What kind of choice?             │
│                                  │
│ [ Room sharing ]                 │
│ [ Travel mode ]                  │
│ [ Departure city ]               │
│ [ Trek difficulty ]              │
│ [ Custom… ]                      │
│                                  │
│           [Cancel]   [Add]       │
└──────────────────────────────────┘
```

Selecting a preset (e.g. *Room sharing*) auto-creates the axis with:
- `axis_label = "Room sharing"`
- `axis_key = "room_sharing"` (auto-slugged)
- `axis_description = "Pick how you'd like to share your room"`
- Two starter options pre-populated: *Double sharing* (₹0), *Triple sharing* (₹0)
  — founder edits the prices in place.

"Custom…" reveals an inline label `FormField` (max 60 chars) and creates an
empty axis with zero starter options after submit.

Component: `FormModal` + `FilterPills`.

### 5.6 Axis menu (`[⋮]`)
Items:
- **Rename** — inline edit on the axis label.
- **Edit description** — inline edit on the axis description.
- **Delete this price choice** — opens `ConfirmDialog`:
  > Delete the *"Room sharing"* price choice?
  > Customers booking after now won't see it.
  > (Bookings already placed are not affected.)

### 5.7 Option editor (inline, per axis)
For each option:

| Field          | Component                                                            | Notes |
|----------------|----------------------------------------------------------------------|-------|
| Reorder        | `SortableList` drag handle                                           | Hides `sort_order` from UI |
| Label          | `FormField` text (max 60)                                            | Required |
| Sublabel       | Collapsed behind `Add description` link, `FormField` text (max 120)  | Hidden by default |
| Price          | `NumericInput` with ₹ prefix, comma-formatted, helper *"e.g. 45000 = ₹45,000"*, min 0, max 1,000,000 | Integer rupees |
| Is active      | `Toggle` labeled *"Show to customers"*                               | Replaces `is_active` checkbox |
| Delete         | Icon `Button` with `ConfirmDialog`                                   | Copy: *"Remove the 'Double sharing' option? Customers booking after now won't see it."* |
| `option_key`   | **NOT shown** — auto-slugged from label on create                    | Stable after creation |

`+ Add option` button at the bottom of the options list creates a blank option
inline (no modal needed — single field flow).

### 5.8 Validation

#### Soft (inline, while editing)
- Axis with <2 active options → red helper text beneath the options list:
  *"Add at least one more option, or remove this whole price choice."* +
  inline `Remove price choice` text-button.
- Option with price = 0 and is_active=true → yellow helper: *"This option will
  be free — is that intentional?"*

#### Hard (blocks save / publish)
- Axis label empty → *"Please enter a label for this price choice."*
- Option label empty → *"Please enter a label for this option."*
- Price not a non-negative integer → *"Please enter a price (e.g. 45000)."*
- DB-uniqueness violation on `(group_slug, axis_key)` or `(variant_axis_id,
  option_key)` → *"You already have a 'Room sharing' price choice on this
  trip group."*

#### Trip-status guard (spec §6.6)
On `updateTripAction` toggling `status` from `Draft` → `Upcoming`/`Ongoing`,
fetch all axes for the group and reject if any axis has <2 active options:
> Variant axis *"Room sharing"* needs at least 2 active options before publish.

### 5.9 Components used
`EmptyState`, `Card`, `FormModal`, `FilterPills`, `FormField`, `NumericInput`,
`Toggle`, `SortableList`, `ConfirmDialog`, `Badge`, `Button`.

### 5.10 Form state and persistence
Variant axes/options are **not** part of `TripFormState`. They are persisted
through their own server actions, mutated independently per axis/option, and
re-fetched after each mutation. This keeps the trip wizard's autosave flow
simple — variant edits don't go through the existing `useAutosave` loop.

The Variants tab loads `getVariantAxesForGroup(group_slug)` on mount and after
every mutation. Optimistic UI is **not** required for v1 — a brief loading
state on each mutation is acceptable.

### 5.11 Server actions (additive in `app/(cms)/trips/actions.ts`)

```ts
export async function upsertVariantAxisAction(
  groupSlug: string,
  input: VariantAxisInput
): Promise<{ ok: true; axisId: string } | { ok: false; error: string }>;

export async function deleteVariantAxisAction(
  axisId: string
): Promise<{ ok: true } | { ok: false; error: string }>;

export async function upsertVariantOptionAction(
  input: VariantOptionInput
): Promise<{ ok: true; optionId: string } | { ok: false; error: string }>;

export async function deleteVariantOptionAction(
  optionId: string
): Promise<{ ok: true } | { ok: false; error: string }>;

export async function reorderVariantOptionsAction(
  axisId: string,
  orderedIds: string[]
): Promise<{ ok: true } | { ok: false; error: string }>;
```

After every mutation: `revalidateTrip(slug)` + `logActivityAsync`.

---

## 6. `/screening` global catalog editor

### 6.1 Sidebar
Add to `components/ui/Sidebar.tsx` → `navItems`:

```ts
{ id: "screening", label: "Fit Check", icon: ShieldCheck },
```

Insert below `trips` for proximity to the related concept.

Add to `app/(cms)/CmsShell.tsx` → `PAGE_TITLES`:

```ts
"/screening": {
  title: "Trip Fit Check Questions",
  subtitle: "The questionnaire customers fill in before paying. Applies to all Soulful Escapes trips with Fit Check turned on.",
},
```

### 6.2 Route layout

```
app/(cms)/screening/
  ├── page.tsx                       # Server component — loads draft, passes to client
  └── _components/
      ├── ScreeningCatalogEditor.tsx # Client — owns form state, autosave, publish
      ├── QuestionCard.tsx           # One question's card (incl. inline options)
      ├── AddQuestionModal.tsx       # FormModal for creating a question
      ├── ScoringRulesCard.tsx       # flag_if_red / flag_if_yellow controls
      └── types.ts                   # CatalogFormState shape
```

No `/screening/new`, `/screening/[versionId]/edit`, or list view. The route is
a single page editing the current draft.

### 6.3 Draft auto-management (hides immutability)

On every visit to `/screening`:

1. `getOrCreateDraftCatalog()` runs server-side.
2. Find the row in `screening_catalog_versions` where `is_active=false AND
   is_immutable=false`. If found → that's the draft. Return it.
3. If not found → find the active row (`is_active=true`), clone it (version +
   all questions + all options) into a new row with `is_active=false,
   is_immutable=false, version_label = "draft @ <ISO timestamp>"`. Return the
   clone.

The founder always lands on an editable draft. They never see the "no editable
version exists" failure mode.

### 6.4 UI

```
┌───────────────────────────────────────────────────────────────┐
│ Trip Fit Check Questions                  ● Draft (unsaved)   │
│ Applies to all Soulful Escapes trips with Fit Check on.       │
│                                                               │
│  [ Save draft ]                  [ Publish to website ]       │
│                                                               │
│ ⚠ You have unsaved changes — customers still see the          │
│   currently-published questions until you publish.            │
│                                                               │
│ ── Scoring rules ─────────────────────────────────────────── │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ Flag a customer when they pick:                           │ │
│ │   [-] 1 [+] red answers (or more)        OR               │ │
│ │   [-] 2 [+] yellow answers (or more)                      │ │
│ │                                                           │ │
│ │ ℹ With these settings, picking 1 red OR 2 yellows = flag. │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                               │
│ ── Questions (drag to reorder) ────────────────────────────── │
│ ┌─ Q1. What kind of trip excites you? ──────────────── [⋮] ─┐ │
│ │ Answer style: [ ○ Pick one ] [ ☑ Pick many ] [ ✎ Long ]   │ │
│ │ ●━━ Use this answer to flag customers (scored)             │ │
│ │ ●━━ Customers must answer this (required)                  │ │
│ │                                                            │ │
│ │ Answer choices (drag to reorder):                          │ │
│ │ ⠿ Adventure              [ 🟢 Great fit ▾ ]    ○━━ Block  │ │
│ │ ⠿ Balanced               [ 🟡 Some friction ▾ ]            │ │
│ │ ⠿ Relaxed                [ 🔴 Not a fit ▾ ]    ●━━ Block  │ │
│ │ [ + Add answer choice ]                                   │ │
│ └────────────────────────────────────────────────────────────┘ │
│ …                                                             │
│ [ + Add question ]                                            │
└───────────────────────────────────────────────────────────────┘
```

### 6.5 Components and field-by-field mapping

| Field in DB                          | UI surface                                                                                   |
|--------------------------------------|----------------------------------------------------------------------------------------------|
| `version_label`                      | **Not shown.** Auto-set to "draft @ <ISO>" on draft creation; replaced on publish.            |
| `flag_if_red_at_least`               | `NumericInput` with `+/−` steppers, min 1, in the Scoring Rules card                          |
| `flag_if_yellow_at_least`            | `NumericInput` with `+/−` steppers, min 1, in the Scoring Rules card                          |
| `is_active`, `is_immutable`          | **Never shown.** Managed by the draft auto-clone + publish RPC.                               |
| `question_key`                       | **Auto-slugged** from prompt on first create. Stable after creation. Never visible.           |
| `prompt`                             | `FormField` text, multiline, max 200, label *"What customers will see"*, ghost example         |
| `prompt_highlight`                   | **Dropped from v1 UI.** Defaults to `null`. (Cosmetic — not worth the cognitive cost.)        |
| `step`                               | **Not shown.** Auto-set to 1 for all v1 questions. (Step-grouping is a website-only concern.) |
| `kind`                               | `FilterPills`: ○ *Pick one* (single), ☑ *Pick many* (multi), ✎ *Long answer* (textarea)       |
| `is_scored`                          | `Toggle` *"Use this answer to flag customers"*                                                 |
| `is_required`                        | `Toggle` *"Customers must answer this"*                                                        |
| `multi_select_rule`                  | **Not shown.** Server defaults to `worst_color` when `kind === "multi"`, else `null`.         |
| `placeholder`                        | **Not shown.** Server defaults `null`.                                                         |
| `max_length`                         | **Not shown.** Server defaults `500` when `kind === "textarea"`, else `null`.                  |
| `sort_order`                         | **Not shown.** Managed by `SortableList` drag-reorder.                                         |
| `option_key`                         | **Auto-slugged** from label on first create. Never visible.                                    |
| `option.label`                       | `FormField` text, max 60                                                                       |
| `option.tag`                         | `FilterPills` with color swatches: 🟢 *Great fit*, 🟡 *Some friction*, 🔴 *Not a fit*, ⚪ *No score* |
| `option.is_deal_breaker`             | `Toggle` *"Block payment if this answer is chosen"*. Auto-disabled (tooltip explains) unless `tag === "red"`. |

### 6.6 Add-question flow
Clicking `+ Add question` opens a `FormModal`:

```
┌─────── Add a question ───────────────┐
│                                      │
│ What customers will see              │
│ ┌────────────────────────────────┐   │
│ │                                │   │
│ └────────────────────────────────┘   │
│ (e.g. What kind of trip excites you?)│
│                                      │
│ Answer style                         │
│ [ ○ Pick one ]  [ ☑ Pick many ]      │
│ [ ✎ Long answer ]                    │
│                                      │
│ ●━━ Use this answer to flag customers│
│ ●━━ Customers must answer this       │
│                                      │
│          [Cancel]    [Add question]  │
└──────────────────────────────────────┘
```

Submit → creates the question. For `single`/`multi` kinds, two starter answer
choices (*Option 1*, *Option 2*) are auto-created so the founder isn't stuck
with an empty question card. For `textarea` kind, no options are created.
They edit the labels and tags inline.

### 6.7 Per-question menu (`[⋮]`)
- **Move up / Move down** (alternatives to drag for non-touch devices)
- **Delete this question** → `ConfirmDialog`:
  > Delete this question? It will be removed from the Fit Check the next time
  > you publish.

### 6.8 Change-kind safeguard
Changing `kind` between `single`/`multi`/`textarea` when options exist →
`ConfirmDialog`:
> Changing the answer style removes the current answer choices. Continue?

(For `single` ↔ `multi` we could preserve options, but to keep the rule
simple we wipe on every kind change. Documented behavior.)

### 6.9 Validation (surfaced as plain English)

| Rule | UI message |
|------|------------|
| `kind=single` or `multi` requires ≥2 options | *"This question needs at least two answer choices."* |
| `is_scored=true` requires a tag on every option | *"Pick a colour for every answer choice (Great fit / Some friction / Not a fit)."* |
| `is_deal_breaker=true` only on red options | Toggle auto-disabled with tooltip *"Only 'Not a fit' answers can block payment."* |
| Question prompt empty | *"Please enter the question."* |
| Option label empty | *"Please enter an answer choice."* |
| `flag_if_red_at_least` or `flag_if_yellow_at_least` < 1 | `NumericInput` min=1 prevents entry |

### 6.10 Autosave + Save draft + Publish

**Autosave** (debounced 800 ms, like existing `useAutosave.ts`):
- Every field edit fires a debounced save to the draft.
- Status pill at the top: `● Saving…` / `● Saved` / `● Unsaved changes`.

**[Save draft]** button — explicit save (force-flush autosave). Useful when
the founder wants to leave the page safely.

**[Publish to website]** button → `ConfirmDialog` with live preview counts:
> You're about to publish:
> • 8 questions
> • 24 answer choices
> Affects **N Soulful Escapes trips** with Fit Check turned on.
>
> Customers will see the new questions immediately.
> *[Cancel]* *[Publish to website]*

The N count comes from `SELECT COUNT(*) FROM trips WHERE trip_type='Community'
AND screening_enabled=true`.

Publish action:
1. Refuse if there are unsaved edits (force-flush autosave first).
2. Refuse if catalog has zero questions.
3. `SELECT public.nm_publish_screening_catalog(p_catalog_version_id)`.
4. `POST {WEBSITE_URL}/api/revalidate?tag=screening:active-catalog` —
   best-effort, wrapped in try/catch with toast on failure.
5. `getOrCreateDraftCatalog()` — auto-clone a fresh draft so the editor has
   something to edit immediately.
6. `revalidatePath("/screening")`.
7. `logActivityAsync({ entity_type: "screening_catalog", action: "publish",
   metadata: { question_count, option_count } })`.

### 6.11 Server actions (`app/(cms)/screening/actions.ts`)

```ts
"use server";

export async function saveDraftAction(
  draftVersionId: string,
  patch: CatalogDraftPatch
): Promise<{ ok: true } | { ok: false; error: string }>;
// Bulk-upserts questions + options + version-level fields.
// Used by autosave and the explicit [Save draft] button.

export async function publishCatalogAction(
  draftVersionId: string
): Promise<{ ok: true; newDraftId: string } | { ok: false; error: string }>;

export async function deleteQuestionAction(
  questionId: string
): Promise<{ ok: true } | { ok: false; error: string }>;

export async function deleteOptionAction(
  optionId: string
): Promise<{ ok: true } | { ok: false; error: string }>;
```

Granular reorder/upsert actions are NOT exposed individually — autosave bundles
them into a single `saveDraftAction(patch)` call to avoid per-keystroke
round-trips.

### 6.12 lib/db/screening.ts (new)

```ts
export type ScreeningTag = "green" | "yellow" | "red";
export type ScreeningKind = "single" | "multi" | "textarea";

export interface DbScreeningCatalogVersion { /* row shape */ }
export interface DbScreeningQuestion { /* row shape */ }
export interface DbScreeningOption { /* row shape */ }

export interface FullCatalogVersion {
  version: DbScreeningCatalogVersion;
  questions: Array<DbScreeningQuestion & { options: DbScreeningOption[] }>;
}

export async function getActiveCatalog(): Promise<FullCatalogVersion | null>;
// Read by the trip wizard's Screening preview.

export async function getOrCreateDraftCatalog(): Promise<FullCatalogVersion>;
// Returns the editable draft, cloning from the active row if needed.
// Idempotent — safe to call on every /screening load.

export async function saveDraftCatalog(
  draftVersionId: string,
  patch: CatalogDraftPatch
): Promise<void>;
// Bulk upsert. Refuses if draftVersionId resolves to an immutable row.

export async function publishCatalog(
  draftVersionId: string
): Promise<{ newDraftId: string }>;
// Calls nm_publish_screening_catalog, then auto-clones a fresh draft.

export async function deleteQuestion(questionId: string): Promise<void>;
export async function deleteOption(optionId: string): Promise<void>;

export async function countTripsWithScreeningEnabled(): Promise<number>;
// Used by the publish confirm dialog.
```

### 6.13 lib/schemas/screening.ts (new)

Zod schemas enforcing the rules in §6.9 + the DB CHECK constraints (`tag` enum,
`kind` enum, `multi_select_rule` enum). Schema lives in
`lib/schemas/screening.ts` and mirrors the existing `lib/schemas/trip.ts`
structure.

---

## 7. Layman-friendly conventions enforced project-wide

These rules apply to every surface added by this PR:

1. **No raw IDs in the UI.** `question_key`, `option_key`, `axis_key`, all
   table IDs — auto-generated and never displayed.
2. **No regex error messages.** Slug generation lives in `lib/slug.ts` (new
   helper); validation surfaces friendly English errors only.
3. **Every destructive or live-affecting action → `ConfirmDialog`** with
   specific copy naming what changes and who it affects.
4. **Toggles for binary settings**, not checkboxes. Reserve checkboxes for
   "select many from a list" cases.
5. **Empty states always have a next action.** Single primary `Button` in
   every empty state — no dead-end screens.
6. **Numeric inputs use steppers + helper text** (`NumericInput` already
   supports both).
7. **Advanced/optional fields hidden by default.** `prompt_highlight`,
   `placeholder`, `max_length`, `option_sublabel`, `multi_select_rule` are
   dropped or disclosed behind an inline link.
8. **Autosave on the catalog editor**, with a dirty-state status pill so the
   founder always knows whether their changes are local or saved.
9. **Dirty banner over the publish button** — the visual gap between "saved
   to draft" and "live to customers" must be unmissable.
10. **Page titles + subtitles via `PAGE_TITLES`** for every new route.

---

## 8. Build order

1. **`lib/schemas/screening.ts` + tests** — locks validation contract.
2. **`lib/schemas/trip-variants.ts` + tests**.
3. **`lib/schemas/trip.ts`** — extend with `screening_enabled`.
4. **`lib/slug.ts`** — shared kebab-to-snake auto-slug helper.
5. **`lib/ids.ts`** — verify/extend `VAX`/`VOP` prefix allowlist.
6. **`lib/db/screening.ts`** — including `getOrCreateDraftCatalog`,
   `getActiveCatalog`, `countTripsWithScreeningEnabled`.
7. **`lib/db/trip-variants.ts`**.
8. **`app/(cms)/screening/page.tsx` + `_components/*`** — catalog editor with
   autosave + publish + draft auto-clone.
9. **`app/(cms)/trips/_components/tabs/VariantsTab.tsx`** + axis/option modals
   + server actions in `trips/actions.ts`.
10. **Trip-publish guard** that requires ≥2 active options per axis.
11. **`app/(cms)/trips/_components/tabs/ScreeningTab.tsx`** — toggle + live
    catalog preview + Community-only gating.
12. **Sidebar + page titles update**.
13. **`npm run lint && npm run typecheck && npm test`** clean. Manual R8
    walkthroughs (see §9).

The flagged-review queue (§7 of the companion spec) is **not** in this build
order — it ships from the Ops tool.

---

## 9. Manual R8 walkthroughs (run after each surface lands)

**Catalog editor (`/screening`):**
1. Open `/screening` → draft auto-creates from the active version.
2. Edit a question prompt → status pill flips `Saving…` → `Saved`.
3. Reload → edits persist on the draft.
4. Open the website's `/book/<community-slug>/screening` → confirm OLD
   questions still shown.
5. Click *Publish to website* → confirm dialog shows the right trip count →
   confirm.
6. Reload `/book/<community-slug>/screening` → confirm NEW questions shown.
7. Reload `/screening` → fresh empty-style draft auto-created (recent publish
   is no longer editable).

**Trip wizard Screening tab:**
1. Open a Community trip → Screening tab visible, toggle defaults ON.
2. Toggle OFF → save → website's `/book/<slug>/screening` route returns to
   skipping the screen.
3. Change `trip_type` to `Signature Journey` → Screening tab disappears from
   the wizard. Save → DB `screening_enabled` flipped to `false`.

**Trip wizard Variants tab:**
1. Open a trip with no `group_slug` → Variants tab shows the "no group set"
   empty state with the "Set trip group →" CTA.
2. Set group → Variants tab now shows the standard empty state with
   `+ Add a price choice`.
3. Click `+ Add a price choice` → modal → pick *Room sharing* → axis created
   with starter Double/Triple options.
4. Edit prices → save → website's trip detail page reflects "Starting from"
   the new minimum.
5. Try to set trip status Draft → Upcoming with one axis having <2 active
   options → save fails with the named-axis error message.
6. Existing Pending bookings retain their `variants_snapshot` (verified in
   Supabase) after a price edit.

---

## 10. Risks & guardrails

### 10.1 Cache invalidation
After every publish, CMS MUST POST to
`{WEBSITE_URL}/api/revalidate?tag=screening:active-catalog`. Wire this into
`lib/revalidate.ts` so the call survives refactors. Toast on failure — but
do NOT roll back the publish if revalidate fails (the next 5-minute cache
expiry will pick it up).

### 10.2 Group-slug binding
Variants attach to `trips.group_slug`, not `trips.trip_id`. The "no group
set" empty state (§5.3) is the user-facing manifestation; the DB layer also
hard-refuses inserts when `groupSlug` is null/empty.

### 10.3 Snapshot isolation
Editing a variant option's price does NOT re-price in-flight bookings. The
inline ℹ chip beneath the price field (§5.4) is the user-facing reminder.

### 10.4 Immutability invisible
Founders never see the word "immutable" or "version". If the draft auto-clone
fails (e.g. DB outage), surface a generic toast: *"Couldn't open the editor —
please try again."* — never expose the version mechanics.

### 10.5 trip_type change clearing screening_enabled
If a founder changes a Community trip to another type, we force
`screening_enabled=false` server-side. The trip wizard should show a one-time
inline notice when the founder makes the change in BasicTab:
> Switching away from Soulful Escapes will turn off the Fit Check for this
> trip.
> *[Got it]*

### 10.6 Activity log
Every mutation (catalog save, publish, variant CRUD, screening toggle) writes
an `activity_log` entry via the existing `logActivityAsync` helper.

---

## 11. Open follow-ups (NOT in this PR)

- Per-trip question subsets (`screening_question_keys`) — the in-wizard
  preview becomes editable.
- Catalog version diff viewer (audit what changed between publishes).
- `prompt_highlight` editor (cosmetic rust-accent span inside the prompt).
- Variant per-batch pricing (one trip in a group prices differently from
  another).
- Per-option capacity (e.g. Leh "only 4 bike slots").
- Variant choice analytics (distribution of Double vs Triple per batch).
- Flagged review queue — owned by the Ops tool.

---

## 12. Companion docs

- `./2026-05-18-cms-screening-and-variants-design.md` — engineering reference
  for the data model, RPC behaviour, and cache invalidation contract. This
  layman-first design supersedes it on all UX/UI questions.
- `../../../website/docs/superpowers/specs/2026-05-17-screening-catalog-cms-design.md`
- `../../../website/docs/superpowers/specs/2026-05-18-trip-variants-design.md`
- `../../../website/docs/superpowers/specs/2026-05-18-ops-tool-screening-overrides.md`
  — the flagged-review surface, owned by Ops.
