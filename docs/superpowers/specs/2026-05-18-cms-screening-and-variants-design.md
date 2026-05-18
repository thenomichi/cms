# CMS — Screening & Trip Variants — Design & Implementation Plan

**Target repo:** `/Users/deepakhandke/Desktop/code-repos/nomichi/new/cms`
**Companion website specs** (already implemented, do NOT re-design — read for context):
- `../../../website/docs/superpowers/specs/2026-05-17-screening-catalog-cms-design.md`
- `../../../website/docs/superpowers/specs/2026-05-18-ops-tool-screening-overrides.md`
- `../../../website/docs/superpowers/specs/2026-05-18-trip-variants-design.md`

**Date:** 2026-05-18
**Status:** Ready for implementation. CMS agent owns this spec end-to-end.

---

## 1. Problem & scope

The Nomichi website ships two features that have **zero CMS surface today** —
the founder is editing Supabase directly. This spec adds CMS editors for both
so founders can self-serve.

**Two features to surface:**

### 1.1 Screening (Quick Fit Check / "Trip Fit Check")
A 8-question fit-check screen between Traveller Details and Pay. Customers
who FLAG are blocked from paying; ops follows up via WhatsApp. The website
reads its catalog (questions, options, scoring) from a versioned set of
Supabase tables. Each trip declares whether screening is enabled and, if
so, which subset of catalog question_keys to ask.

### 1.2 Trip Variants
A trip group (`group_slug`) can declare 1+ variant axes (e.g. Room sharing,
Travel mode). Customers pick one option per axis on /details; the booking's
per-pax total is the sum of chosen options' prices. The website reads axes
from `trip_variant_axes` + `trip_variant_options`; bookings snapshot the
selection into `bookings.variants_snapshot`.

### Scope of THIS spec — what CMS must build

1. **Screening catalog editor** — versions → questions → options, with a
   publish flow that calls the existing `nm_publish_screening_catalog` RPC.
2. **Per-trip screening config** — extend the existing Trips editor with a
   "Screening" section (toggle + question picker).
3. **Trip Variants editor** — new sibling section inside the Trips editor
   for axes + options.
4. **Flagged booking review queue** (the override surface from the
   `2026-05-18-ops-tool-screening-overrides.md` spec). Lower priority than
   1–3 but in scope.

### Out of scope (explicit non-goals)

- Live customer-facing changes to website code. The website is already
  built against these tables.
- Per-user CMS auth / RBAC — keep the existing cookie+env-credentials
  auth gate; `CMS_SHARED_OWNER_ID` continues as the actor.
- Migration writes from CMS — schema changes belong in
  `website/supabase/migrations/`. CMS only reads/writes existing tables.
- Variant batch-level pricing (one price per option globally — see website
  variants spec §14).

---

## 2. CMS conventions to follow

The CMS agent MUST match these patterns. They are the existing house style
in this repo — deviating creates inconsistency.

### Stack (verified — do not re-investigate)
- Next.js 16.2.4, App Router (`app/(cms)/<entity>/...`)
- React 19, `react-hook-form` + `zod` for validated forms
- `@supabase/supabase-js` via `getServiceClient()` in
  `lib/supabase/server.ts`
- Tailwind CSS with CVA
- `sonner` for toast notifications
- `lucide-react` for icons

### File layout per entity (mirror `app/(cms)/trips/`)
```
app/(cms)/<entity>/
  ├── page.tsx              # List view (server component; uses lib/db)
  ├── new/page.tsx          # Create page (optional; trips uses /new)
  ├── [id]/edit/page.tsx    # Edit page (server component, loads + passes to client)
  ├── actions.ts            # "use server" server actions, all mutations route through here
  └── _components/
      ├── <Entity>Editor.tsx  # Client component, owns form state + tabs
      ├── <Entity>Client.tsx  # Optional list-view client wrapper
      ├── tabs/              # Per-section tab components
      └── types.ts           # TripFormState-equivalent shape + STEPS_*
```

### Data access (mirror `lib/db/trips.ts`)
- One file per table or per logical entity in `lib/db/`.
- Functions return `Db<Entity>` rows. Use `getServiceClient()` directly.
- Throw on error: `throw new Error(\`getTrips failed: ${error.message}\`)`.
- Generate IDs with `nextSequentialId()` or `nextTripId()` from `lib/ids.ts`.
  For variant axes/options use the same generator with prefixes `VAX` / `VOP`.

### Zod schemas (mirror `lib/schemas/trip.ts`)
- One file per entity in `lib/schemas/`.
- Export `<entity>BasicSchema`, `<entity>Schema`, and any sub-schemas
  (e.g. `screeningQuestionSchema`, `variantOptionSchema`).
- Enum allowlists mirror live Postgres CHECK constraints exactly. Source
  of truth = `website/supabase/migrations/`. If a CHECK widens, the schema
  file is updated in the same PR.

### Forms (mirror `app/(cms)/trips/_components/tabs/*`)
- Tab-style editors when an entity has >5 fields or logical sub-groups.
- Use `<FormField>`, `<FormSection>`, `<Toggle>`, `<NumericInput>`,
  `<SortableList>`, `<ListBuilder>` from `components/ui/`.
- Submit via server actions in `actions.ts`. Pattern:
  ```ts
  "use server";
  export async function updateThingAction(input: FormData) {
    const parsed = thingSchema.safeParse(rawFromFormData);
    if (!parsed.success) return { ok: false, error: parsed.error.flatten() };
    await dbUpdateThing(id, parsed.data);
    revalidatePath("/<entity>");
    revalidateTrip(slug); // if it affects website cache
    void logActivity({ ... });  // best-effort
    return { ok: true };
  }
  ```
- Toast on success/failure with `sonner`.

### Sidebar nav
- Add new top-level entities to
  `components/ui/Sidebar.tsx` → `navItems`. Use a lucide icon. Add the page
  title + subtitle in `app/(cms)/CmsShell.tsx` → `PAGE_TITLES`.

### Activity logging
- Every mutating server action calls `logActivityAsync({ ... })` (fire and
  forget). Match the shape used in `trips/actions.ts`.

### Auth
- `app/(cms)/layout.tsx` already gates with `isAuthenticated()`. New routes
  under `(cms)/` inherit it automatically. No additional guards needed.

---

## 3. Data model — tables CMS reads/writes

All tables already exist (migrations live in the website repo). CMS only
INSERT/UPDATE/DELETEs against them. **Do not duplicate the migrations in
`cms/supabase/migrations/`.** Read `website/canonical-schema.sql` for the
authoritative schema.

### 3.1 Screening tables

```
screening_catalog_versions
  catalog_version_id    text PK         (e.g. "NM-SCRV-...")
  version_label         text            (human label, e.g. "v1 — pre-launch")
  is_active             boolean         (exactly one row is true)
  flag_if_red_at_least  integer         (default 1)
  flag_if_yellow_at_least integer       (default 2)
  is_immutable          boolean         (true once published — see RPC below)
  created_at, updated_at

screening_questions
  question_id           text PK
  catalog_version_id    text FK
  question_key          text            (stable across versions: 'q1'…'q8')
  prompt                text
  prompt_highlight      text | null     (rust-accented span inside prompt)
  step                  integer         (1/2/3 — UI step grouping)
  kind                  'single' | 'multi' | 'textarea'
  is_scored             boolean         (q1, q9 are unscored)
  is_required           boolean
  multi_select_rule     'worst_color' | null
  placeholder           text | null     (textarea only)
  max_length            integer | null  (textarea only)
  sort_order            integer
  UNIQUE (catalog_version_id, question_key)

screening_options
  option_id             text PK
  question_id           text FK
  option_key            text            (stable per question, e.g. 'q3_balanced')
  label                 text
  tag                   'green' | 'yellow' | 'red' | null
  is_deal_breaker       boolean         (only q8.q8_independent today)
  sort_order            integer
  UNIQUE (question_id, option_key)

screening_submissions   -- READ ONLY for CMS purposes, mutated by website
  screening_submission_id text PK
  booking_id, lead_id, trip_id, customer_id
  phone, full_name
  answers               jsonb
  scores                jsonb
  outcome               'pass' | 'flag'
  flag_reasons          jsonb
  notes_optional        text
  overridden_at         timestamptz | null    -- CMS sets this on override
  overridden_by         text | null           -- CMS sets actor id
  override_reason       text | null
  created_at, updated_at

-- on trips:
trips.screening_enabled            boolean (default false)
trips.screening_question_keys      text[]  (default {} — empty means "use all active")
```

### 3.2 Variant tables

```
trip_variant_axes
  variant_axis_id       text PK           ("NM-VAX-...")
  group_slug            text NOT NULL     -- logical FK to trips.group_slug
  axis_key              text              ('room_sharing' | 'travel_mode' | …)
  axis_label            text              ('Room sharing')
  axis_description      text | null
  sort_order            integer
  is_required           boolean (true)
  UNIQUE (group_slug, axis_key)

trip_variant_options
  variant_option_id     text PK           ("NM-VOP-...")
  variant_axis_id       text FK ON DELETE CASCADE
  option_key            text              ('double' | 'triple' | 'tempo' | …)
  option_label          text              ('Double sharing')
  option_sublabel       text | null
  price_per_pax         integer           -- absolute ₹, integer rupees
  sort_order            integer
  is_active             boolean (true)
  UNIQUE (variant_axis_id, option_key)

-- on bookings (READ ONLY for CMS):
bookings.variants_snapshot   jsonb | null
```

### 3.3 Publish RPC (use, don't reimplement)

`SELECT public.nm_publish_screening_catalog(p_catalog_version_id text)`

Sets `is_active=true` on the given version, `is_active=false` on the
prior active row, and flips `is_immutable=true` on the new active version.
After publish, **no row in `screening_questions` or `screening_options`
under that version_id may be edited or deleted** — the constraint is
enforced by a database trigger. CMS must disable edit UI on
`is_immutable=true` versions.

---

## 4. Feature A — Screening Catalog editor

### 4.1 Routes

```
app/(cms)/screening/
  ├── page.tsx                       # List all catalog versions
  ├── new/page.tsx                   # Create-version flow (label only; questions cloned from active)
  ├── [versionId]/edit/page.tsx      # Edit a draft version's questions/options
  └── _components/
      ├── ScreeningVersionsClient.tsx
      ├── ScreeningCatalogEditor.tsx
      ├── tabs/
      │   ├── VersionTab.tsx         # label, scoring thresholds
      │   ├── QuestionsTab.tsx       # ordered list + drag-to-reorder
      │   └── PreviewTab.tsx         # renders the catalog the way the website will
      └── types.ts
```

### 4.2 List view (`/screening`)

Columns: `Version label · Active? · Question count · Created · Status (Draft/Active/Archived) · Actions`.

Actions:
- **Edit** — only enabled for non-immutable rows (`is_immutable=false`).
- **Publish** — calls `nm_publish_screening_catalog`. Confirm dialog: "This
  freezes the version. You can't edit questions or options after publish.
  Continue?"
- **Clone as new draft** — duplicates rows into a fresh version with
  `is_active=false`, `is_immutable=false`.

### 4.3 Edit view (`/screening/[versionId]/edit`)

**VersionTab fields:**
- `version_label` (required, text)
- `flag_if_red_at_least` (integer, default 1, min 1)
- `flag_if_yellow_at_least` (integer, default 2, min 1)

**QuestionsTab:**
- Drag-to-reorder using `<SortableList>` (per `step`, then `sort_order`).
- Each question card shows: `question_key (read-only)`, `prompt`,
  `prompt_highlight` (optional), `step (1/2/3)`, `kind` (single/multi/textarea),
  `is_scored`, `is_required`, `multi_select_rule` (only for kind=multi).
- Inline list of options under each question (also drag-reorder).
- Each option: `option_key (read-only after creation)`, `label`, `tag`
  (green/yellow/red/none), `is_deal_breaker`.
- Add Question / Add Option buttons.

**Validation rules (enforce in `lib/schemas/screening.ts`):**
- `question_key` ≥1 char, unique per version, `^[a-z][a-z0-9_]*$`.
- `option_key` ≥1 char, unique per question, same regex.
- `kind=single` or `multi` → at least 2 options required.
- `kind=textarea` → zero options, `max_length` required, `placeholder`
  optional.
- `is_scored=true` → every option MUST have a `tag`.
- `is_scored=false` → options may have `tag=null`.
- `is_deal_breaker=true` only allowed on `tag='red'` options.
- Saving a question with `kind` change clears option-set (require confirm
  dialog).

**Publish button:** appears on the version edit page, top-right. Disabled
when there are unsaved changes (dirty state).

### 4.4 Server actions (`screening/actions.ts`)

```ts
export async function createCatalogVersionAction(input: {
  label: string;
  cloneFromVersionId?: string;  // copies questions + options if set
}): Promise<{ ok: true; versionId: string } | { ok: false; error: string }>;

export async function updateCatalogVersionAction(
  versionId: string,
  input: { version_label: string; flag_if_red_at_least: number; flag_if_yellow_at_least: number }
): Promise<{ ok: true } | { ok: false; error: string }>;

export async function upsertQuestionAction(input: ScreeningQuestionInput): Promise<...>;
export async function deleteQuestionAction(questionId: string): Promise<...>;
export async function reorderQuestionsAction(versionId: string, orderedIds: string[]): Promise<...>;

export async function upsertOptionAction(input: ScreeningOptionInput): Promise<...>;
export async function deleteOptionAction(optionId: string): Promise<...>;
export async function reorderOptionsAction(questionId: string, orderedIds: string[]): Promise<...>;

export async function publishCatalogVersionAction(versionId: string): Promise<...>;
```

Every mutation:
1. Refuses if target version `is_immutable=true` (publish-action exempted).
2. `revalidatePath("/screening")` after success.
3. Calls website cache revalidate: `revalidate.ts` already has a helper for
   tag-based invalidation — fire
   `fetch(WEBSITE_URL + "/api/revalidate?tag=screening:active-catalog", { method: "POST" })`
   after publish.
4. `logActivityAsync({ entity: "screening", action: "...", actor_id: CMS_SHARED_OWNER_ID })`.

### 4.5 lib/db/screening.ts (new)

```ts
export async function getCatalogVersions(): Promise<ScreeningCatalogVersionRow[]>;
export async function getCatalogVersion(versionId: string): Promise<FullCatalogVersion | null>;
// FullCatalogVersion = version + nested questions[] + nested options[]
export async function createCatalogVersion(input: { label: string; cloneFromVersionId?: string }): Promise<string>;
export async function updateCatalogVersion(versionId: string, input: VersionPatch): Promise<void>;
export async function upsertQuestion(input: QuestionInput): Promise<string>;
export async function deleteQuestion(questionId: string): Promise<void>;
export async function reorderQuestions(versionId: string, orderedIds: string[]): Promise<void>;
export async function upsertOption(input: OptionInput): Promise<string>;
export async function deleteOption(optionId: string): Promise<void>;
export async function reorderOptions(questionId: string, orderedIds: string[]): Promise<void>;
export async function publishCatalogVersion(versionId: string): Promise<void>;
// Read-only — used by trip editor's question picker
export async function getActiveQuestionKeys(): Promise<{ question_key: string; prompt: string; step: number }[]>;
```

---

## 5. Feature B — Per-trip Screening config (extend Trips editor)

### 5.1 Location

New tab `ScreeningTab` inside the existing
`app/(cms)/trips/_components/tabs/` directory. Insert into the trip-edit
stepper after `SettingsTab`, before `GalleryTab`.

### 5.2 Tab UI

```
┌────────────────────────────────────────────────────┐
│ Screening                                          │
│                                                    │
│ [●] Enable Trip Fit Check for this trip            │
│     When on, customers must complete the screening │
│     before payment. Failed customers go to the     │
│     destination expert queue.                      │
│                                                    │
│ ── Question selection ─────                        │
│ [○] Use all active catalog questions               │
│ [●] Use a custom subset                            │
│     ┌─ Question picker (multi-select) ───────────┐ │
│     │ ☑ q1 What kind of trip excites you?     ▲ │ │
│     │ ☐ q2 Vibe within the group?              │ │
│     │ ☑ q3 Pace expectations?                  │ │
│     │   …                                       │ │
│     │ Active catalog: "v1 — pre-launch"         │ │
│     └────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

### 5.3 Form state (extend `trips/_components/types.ts`)

```ts
interface TripFormState {
  // … existing fields …
  screening_enabled: boolean;
  screening_question_keys: string[];  // empty = "use all"
}
```

### 5.4 Validation
- If `screening_enabled=true` AND `screening_question_keys.length > 0`:
  every key must exist in the active catalog's `getActiveQuestionKeys()`.
  Otherwise saving fails with a per-key error.
- If `screening_enabled=false`: `screening_question_keys` is cleared to `[]`
  on save (cosmetic; no functional impact on website).

### 5.5 Server action

Extend the existing `trips/actions.ts` → `updateTripAction` to accept
`screening_enabled` + `screening_question_keys` and propagate to
`lib/db/trips.ts` → `updateTrip()`. Add the columns to the trip update
zod schema (`lib/schemas/trip.ts`).

After save, call `revalidateTrip(slug)` (already wired) so the website's
trip detail page picks up the new config.

---

## 6. Feature C — Trip Variants editor (new tab in Trips editor)

### 6.1 Location

New tab `VariantsTab` inside the existing trip-edit stepper. Insert after
the new `ScreeningTab`. Bound to `group_slug` — when the trip group has
multiple batches, **the variants are shared across all batches in the
group**. The tab edits the group-level row.

### 6.2 Tab UI

```
┌────────────────────────────────────────────────────┐
│ Trip Variants                                      │
│ Optional commercial choices the customer picks at  │
│ booking time. Each chosen option contributes its   │
│ price to the per-pax total.                        │
│                                                    │
│ [ + Add variant axis ]                             │
│                                                    │
│ ┌─ Room sharing ─────────────────────────  [⋮] ─┐ │
│ │ Description: Pick how you'd like to share…    │ │
│ │                                                │ │
│ │ Options:                                       │ │
│ │ ┌────────────────────────────────────────────┐ │ │
│ │ │ Double sharing     ₹45,000 / person  [✏][✕]│ │ │
│ │ │ Triple sharing     ₹38,000 / person  [✏][✕]│ │ │
│ │ └────────────────────────────────────────────┘ │ │
│ │ [ + Add option ]                              │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
│ ┌─ Travel mode ─── (collapsed) ─────────── [⋮] ─┐ │
│ └────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

`[⋮]` menu: Rename axis · Edit description · Delete axis (with confirm).
`[✏]` on an option: edit label/sublabel/price/active.
`[✕]` on an option: delete (with confirm; cascades to no booking — see
website variants spec §7 for snapshot isolation).

### 6.3 Form schema

```ts
// lib/schemas/trip-variants.ts
export const variantAxisSchema = z.object({
  variant_axis_id: z.string().optional(),
  axis_key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  axis_label: z.string().min(1).max(80),
  axis_description: z.string().max(200).nullable(),
  sort_order: z.number().int().nonnegative(),
});

export const variantOptionSchema = z.object({
  variant_option_id: z.string().optional(),
  variant_axis_id: z.string(),
  option_key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  option_label: z.string().min(1).max(60),
  option_sublabel: z.string().max(120).nullable(),
  price_per_pax: z.number().int().min(0),  // ₹ rupees, NOT paise
  sort_order: z.number().int().nonnegative(),
  is_active: z.boolean(),
});
```

**Validation:**
- An axis must have ≥2 active options before the trip can be published
  (`status` toggled out of Draft). Surface as a warning on the
  Settings/Publish path: "Variant axis 'Room sharing' needs at least 2
  options."
- `axis_key` unique within a `group_slug` (DB-enforced; surface friendly
  error if the upsert fails).
- `option_key` unique within an axis (DB-enforced).
- `price_per_pax` ≥ 0. Warn on save if any active option is 0 ("This
  option will be free — confirm?").

### 6.4 Server actions (`trips/actions.ts`, additive)

```ts
export async function upsertVariantAxisAction(
  groupSlug: string,
  input: VariantAxisInput
): Promise<{ ok: true; axisId: string } | { ok: false; error: string }>;

export async function deleteVariantAxisAction(axisId: string): Promise<...>;

export async function upsertVariantOptionAction(input: VariantOptionInput): Promise<...>;

export async function deleteVariantOptionAction(optionId: string): Promise<...>;

export async function reorderVariantOptionsAction(axisId: string, orderedIds: string[]): Promise<...>;
```

After every mutation:
- `revalidatePath(\`/trips/${tripId}/edit\`)`
- `revalidateTrip(slug)` — website caches the listing/detail price
  computation which depends on variant min-cost; the rust-themed website
  uses ISR for trip pages.
- Activity log entry.

### 6.5 lib/db/trip-variants.ts (new)

```ts
export async function getVariantAxesForGroup(groupSlug: string): Promise<FullVariantAxis[]>;
// FullVariantAxis = axis row + nested active options[] ordered by sort_order

export async function upsertVariantAxis(groupSlug: string, input: VariantAxisInput): Promise<string>;
export async function deleteVariantAxis(axisId: string): Promise<void>;

export async function upsertVariantOption(input: VariantOptionInput): Promise<string>;
export async function deleteVariantOption(optionId: string): Promise<void>;
export async function reorderVariantOptions(axisId: string, orderedIds: string[]): Promise<void>;
```

ID generation:
```ts
import { nextSequentialId } from "@/lib/ids";
const variantAxisId   = await nextSequentialId("VAX");
const variantOptionId = await nextSequentialId("VOP");
```
Verify in `lib/ids.ts` that `VAX`/`VOP` prefixes work; if the function
enforces an allowlist, add them.

### 6.6 Trip publishing guard

When `updateTripAction` toggles status from Draft → Upcoming/Ongoing on a
trip whose `group_slug` has variant axes, run the validation:

```ts
const axes = await getVariantAxesForGroup(trip.group_slug);
for (const axis of axes) {
  const activeCount = axis.options.filter(o => o.is_active).length;
  if (activeCount < 2) {
    return { ok: false, error: `Variant axis "${axis.axis_label}" needs at least 2 active options before publish.` };
  }
}
```

---

## 7. Feature D — Flagged booking review queue

**Priority:** lower than A–C. Build only if time permits in v1, otherwise
queue for a follow-up PR.

### 7.1 Location

New route: `app/(cms)/screening/flagged/page.tsx`.

### 7.2 UI

A `<DataTable>` listing screening_submissions where
`outcome='flag' AND overridden_at IS NULL`. Columns:

- Submitted (created_at)
- Customer (full_name + phone)
- Trip (trip_slug → linked to trip edit)
- Flag reasons (jsonb → comma-joined)
- Booking status (joined from bookings)
- Actions: [View detail] [Override...]

### 7.3 Detail drawer

Opening a row shows answers, scores, the customer's optional note, and
the linked booking detail (status, expires_at, total_amount).

### 7.4 Override action

```ts
export async function overrideFlaggedSubmissionAction(
  submissionId: string,
  reason: string
): Promise<...>;
```

Writes `overridden_at = now()`, `overridden_by = CMS_SHARED_OWNER_ID`,
`override_reason = reason` on the submission row. After override:
- The website's FLAG-block guard stops firing for that customer/trip.
- Booking expires_at remains NULL (set by website at FLAG time) — ops
  decides whether to extend.

Confirm dialog before write: "Override the flag for {customer name} on
{trip}? This lets them complete payment. Reason will be recorded."

### 7.5 lib/db/screening-flagged.ts

```ts
export async function listFlaggedSubmissions(): Promise<FlaggedSubmissionRow[]>;
export async function getFlaggedSubmission(id: string): Promise<FlaggedSubmissionDetail | null>;
export async function overrideFlaggedSubmission(id: string, reason: string, actorId: string): Promise<void>;
```

---

## 8. Sidebar nav + page titles

Add to `components/ui/Sidebar.tsx` → `navItems`:

```ts
{ id: "screening", label: "Screening", icon: ShieldCheck },
```
(Use lucide's `ShieldCheck`; import the icon at top.)

Add to `app/(cms)/CmsShell.tsx` → `PAGE_TITLES`:

```ts
"/screening":           { title: "Screening Catalog", subtitle: "Trip Fit Check questions, options, and publishing" },
"/screening/flagged":   { title: "Flagged Bookings",  subtitle: "Customers who failed the Trip Fit Check" },
```

(Trip Variants does not need its own nav entry — it lives inside the trip
editor as a tab.)

---

## 9. Tests

CMS has vitest set up (see `lib/schemas/__tests__/`). For each new feature,
ship:

### 9.1 Schema tests (`lib/schemas/__tests__/`)
- `screening.test.ts` — validation table-tested for every rule in §4.3.
- `trip-variants.test.ts` — validation table-tested for every rule in §6.3.

### 9.2 DB-layer tests (`lib/db/__tests__/`)
- `screening.test.ts` — happy path + immutability rejection.
- `trip-variants.test.ts` — happy path + uniqueness violation handling.

### 9.3 Component tests (`app/(cms)/trips/_components/__tests__/`)
- `ScreeningTab.test.tsx` — toggle + question picker render + onChange.
- `VariantsTab.test.tsx` — adding axis + adding option + reorder.

### 9.4 Server action tests (vitest with mocked DB)
- `screening/actions.test.ts` — publish rejects when version is already
  active; publish rejects when there's no question.

### 9.5 Manual checklist (R8-style — run actual code)

After each surface lands, walk through:

**Screening catalog:**
1. Create new draft version → add 2 questions → add options → save.
2. Publish — confirm dialog → publish RPC fires → version flips to active.
3. Open website `/book/<slug>/screening` (where `screening_enabled=true`)
   → verify the new catalog is rendered.
4. Try to edit a published version → all inputs disabled, "Immutable"
   banner shown.

**Per-trip screening:**
1. Open a trip's edit page → Screening tab → toggle enabled → save.
2. Open website `/book/<slug>/start` → walk to /screening → verify the
   chosen subset is rendered, in order.

**Trip variants:**
1. Open the Bir Billing trip → Variants tab → axis "Room sharing" with
   Double ₹45,000, Triple ₹38,000 should be visible (seeded by
   `website/scripts/seed-variants-bir-billing.sql`).
2. Edit Triple's price to ₹40,000 → save → confirm activity log entry.
3. Open website `/trips/bir-billing…` → "Starting from ₹40,000" reflects
   the edit.
4. Pre-existing Pending bookings on the trip do NOT re-price — snapshot
   wins (verified by reading `bookings.variants_snapshot` in Supabase).

**Flagged review:**
1. Submit a FLAG screening from the website with a test customer.
2. CMS `/screening/flagged` lists the row.
3. Click Override → enter reason → save → row disappears from the active
   list.
4. Same customer can now book the same trip on the website
   (FLAG-block guard cleared).

---

## 10. Build order

1. **`lib/schemas/screening.ts` + tests** — locks the validation contract
   for the catalog editor.
2. **`lib/db/screening.ts`** — CRUD against existing tables.
3. **`app/(cms)/screening/page.tsx` (list view)** — minimal, just version
   list + publish button.
4. **`app/(cms)/screening/[versionId]/edit/page.tsx` + tabs** — full
   editor.
5. **Publish flow + revalidate-website call** — ties the catalog edit to
   the live website.
6. **`lib/schemas/trip-variants.ts` + tests**.
7. **`lib/db/trip-variants.ts`** + ID generator allowlist update.
8. **`VariantsTab.tsx` inside trips editor** — wire into existing
   `TripEditor`.
9. **`ScreeningTab.tsx` inside trips editor** — also wires into
   `TripEditor`.
10. **Trip-publish guard** that requires ≥2 active options per axis.
11. **Sidebar + page titles update**.
12. **Flagged review queue** (lower priority — defer to v2 if time-boxed).
13. **`npm run lint && npm run typecheck && npm test`** clean. Manual R8
    walkthroughs.

---

## 11. Risks & guardrails

### 11.1 Cache invalidation
The website caches `screening:active-catalog` for 5 minutes (see website
spec §lifecycle). After ANY catalog publish, CMS must `POST` to
`{WEBSITE_URL}/api/revalidate?tag=screening:active-catalog`. Wire this
into `lib/revalidate.ts` so it survives refactors.

The trip detail page (which now shows variant "Starting from") is rendered
with `force-dynamic` after the variants feature, but `revalidateTrip(slug)`
should still be called after variant edits in case a future change adds
caching.

### 11.2 Immutability lock-out
Once a catalog version is published, even ops can't edit it. The only
escape is "clone as new draft". The UI MUST make this obvious to prevent
"why can't I just fix this typo?" panic — show a banner on every
immutable version: `🔒 Published 2026-05-17 · Clone to create a new draft`.

### 11.3 Variant pricing display
Variant `price_per_pax` is the ABSOLUTE price per traveller, in INR
rupees, not a delta and not paise. Surface this with helper text under
every price input: `"Price per traveller in ₹. e.g. 45000 = ₹45,000"`.

### 11.4 Group-slug binding
Variants attach to `trips.group_slug`, not `trips.trip_id`. Two batches
of the same trip share variants. The CMS must:
- Load `group_slug` from the trip being edited.
- Refuse to save variants if `group_slug IS NULL` (legacy trips without a
  group): inline error `"This trip has no group_slug — variants are
  per-trip-group. Set the slug first."`

### 11.5 Snapshot isolation (don't panic on edits)
Editing a variant option's price does NOT re-price in-flight bookings.
Display a info-tooltip on the Variants tab: `"Editing prices here only
affects future bookings — bookings already in the funnel keep the price
they were quoted."`

### 11.6 Activity log
Every mutation gets a log entry. Pattern from `trips/actions.ts`:
```ts
logActivityAsync({
  entity_type: "screening_question" | "variant_axis" | …,
  entity_id: id,
  action: "create" | "update" | "delete" | "publish",
  actor_id: CMS_SHARED_OWNER_ID,
  metadata: { ... },
});
```

---

## 12. Open follow-ups (NOT in this PR)

- Variant per-batch pricing — schema-extend `trip_variant_options` with
  optional `trip_id` (NULL = applies to all batches in the group).
- Per-option capacity (Leh "only 4 bike slots"). Requires extending
  `nm_reserve_confirmed_seat` server-side. Don't touch in CMS v1.
- Bulk override of flagged bookings.
- Catalog version diff viewer (highlight what changed between v1 and v2).
- Variant choice analytics (distribution of Double vs Triple per batch).

---

## 13. Companion website specs — what each one is for

When the CMS agent needs context, read in this order:

1. **`2026-05-17-screening-catalog-cms-design.md`** — primary reference for
   screening data model + publish lifecycle + cache invalidation. Sections
   to read: Data model, Lifecycle, Read path, Failure modes, "CMS team
   contract".
2. **`2026-05-18-trip-variants-design.md`** — primary reference for the
   variants data model + snapshot semantics + business rules. Sections to
   read: Data model (§3), Edge cases (§7), Rollout (§13).
3. **`2026-05-18-ops-tool-screening-overrides.md`** — primary reference
   for the Flagged-review queue.

The CMS agent does NOT need to read the website's `lib/screening/` or
`lib/variants/` code — those are website-internal consumers of the same
tables CMS edits. Trust the data model in this doc + the migrations.
