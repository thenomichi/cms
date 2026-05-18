# CMS — Screening & Trip Variants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship CMS UI for managing the Trip Fit Check (Screening) catalog and per-trip Trip Variants, with a layman-first UX that hides catalog versions, immutability, and DB keys behind plain-English controls.

**Architecture:** Three surfaces — (1) a single-page `/screening` catalog editor with auto-managed drafts + publish-to-website; (2) a `ScreeningTab` inside the trip wizard, Community-only, default ON, read-only preview; (3) a `VariantsTab` inside the trip wizard, always visible, group-scoped CRUD. Data flows through new `lib/db/screening.ts` + `lib/db/trip-variants.ts` modules and new zod schemas. All mutations go through server actions that revalidate the website and write to `audit_log`.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Tailwind · zod 4 · react-hook-form · @supabase/supabase-js · sonner · lucide-react · vitest · @dnd-kit (SortableList).

**Spec:** `docs/superpowers/specs/2026-05-18-cms-screening-variants-layman-design.md` (UX contract — overrides) + `docs/superpowers/specs/2026-05-18-cms-screening-and-variants-design.md` (engineering reference).

**Out of scope:** flagged-review queue (owned by Ops tool), schema migrations (already in website repo), per-trip question subsets.

---

## File map

### New files
- `lib/slug.ts` — `toSlug(label)` helper (kebab → snake, lowercased, alphanumeric+underscore).
- `lib/schemas/screening.ts` — zod schemas for catalog/question/option + draft patch.
- `lib/schemas/trip-variants.ts` — zod schemas for axis + option inputs.
- `lib/db/screening.ts` — catalog CRUD, draft auto-clone, publish wrapper.
- `lib/db/trip-variants.ts` — axis/option CRUD scoped to `group_slug`.
- `lib/db/__tests__/screening.test.ts`
- `lib/db/__tests__/trip-variants.test.ts`
- `lib/schemas/__tests__/screening.test.ts`
- `lib/schemas/__tests__/trip-variants.test.ts`
- `lib/schemas/__tests__/slug.test.ts`
- `app/(cms)/screening/page.tsx` — server component, loads draft + active catalog.
- `app/(cms)/screening/actions.ts` — `saveDraftAction`, `publishCatalogAction`, `deleteQuestionAction`, `deleteOptionAction`.
- `app/(cms)/screening/_components/ScreeningCatalogEditor.tsx` — top-level client component.
- `app/(cms)/screening/_components/ScoringRulesCard.tsx`
- `app/(cms)/screening/_components/QuestionCard.tsx`
- `app/(cms)/screening/_components/AddQuestionModal.tsx`
- `app/(cms)/screening/_components/types.ts` — `CatalogFormState`, `CatalogDraftPatch`.
- `app/(cms)/screening/_components/__tests__/ScreeningCatalogEditor.test.tsx`
- `app/(cms)/trips/_components/tabs/ScreeningTab.tsx`
- `app/(cms)/trips/_components/tabs/__tests__/ScreeningTab.test.tsx`
- `app/(cms)/trips/_components/tabs/VariantsTab.tsx`
- `app/(cms)/trips/_components/tabs/AddVariantAxisModal.tsx`
- `app/(cms)/trips/_components/tabs/__tests__/VariantsTab.test.tsx`

### Modified files
- `lib/schemas/trip.ts` — add `screening_enabled: z.boolean()` to `tripBasicSchema`.
- `lib/revalidate.ts` — add `revalidateScreeningCatalog()` tag-based helper.
- `app/(cms)/trips/_components/types.ts` — add `screening_enabled: boolean` to `TripFormState`, extend `STEPS_CREATE`/`STEPS_EDIT`, update `buildInitialState`.
- `app/(cms)/trips/_components/TripEditor.tsx` — render new tabs conditional on trip type, pass variant data.
- `app/(cms)/trips/actions.ts` — accept `screening_enabled`, add 5 variant actions, add trip-publish guard.
- `app/(cms)/trips/[tripId]/edit/page.tsx` — load variant axes server-side for the editor.
- `app/(cms)/CmsShell.tsx` — add `/screening` to `PAGE_TITLES`.
- `components/ui/Sidebar.tsx` — add `screening` navItem with `ShieldCheck` icon.
- `lib/db/trips.ts` — extend `updateTrip()` patch type with `screening_enabled`.

---

## Phase 0 — Branch + smoke checks

### Task 0.1: Create implementation branch

- [ ] **Step 1: Create a fresh branch off main**

Run:
```bash
git checkout main && git pull && git checkout -b feat/cms-screening-and-variants
```
Expected: switched to new branch.

- [ ] **Step 2: Verify clean baseline**

Run:
```bash
npm run lint && npm run test && npx tsc --noEmit
```
Expected: all three pass. If any fail, stop and fix before proceeding — the plan assumes a green baseline.

- [ ] **Step 3: Commit empty progress marker** *(skip — nothing to commit yet)*.

---

## Phase 1 — Shared slug helper

### Task 1.1: `lib/slug.ts`

**Files:**
- Create: `lib/slug.ts`
- Test: `lib/schemas/__tests__/slug.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/schemas/__tests__/slug.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toSlug } from "@/lib/slug";

describe("toSlug", () => {
  it("converts spaces to underscores", () => {
    expect(toSlug("Room sharing")).toBe("room_sharing");
  });
  it("lowercases", () => {
    expect(toSlug("DOUBLE Sharing")).toBe("double_sharing");
  });
  it("strips punctuation", () => {
    expect(toSlug("What's the vibe?")).toBe("whats_the_vibe");
  });
  it("collapses repeated separators", () => {
    expect(toSlug("solo  ---  traveller")).toBe("solo_traveller");
  });
  it("trims leading/trailing separators", () => {
    expect(toSlug(" hello world ")).toBe("hello_world");
  });
  it("returns empty string for empty input", () => {
    expect(toSlug("")).toBe("");
    expect(toSlug("   ")).toBe("");
  });
  it("strips leading digits to satisfy ^[a-z]", () => {
    expect(toSlug("3 day trek")).toBe("day_trek");
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- lib/schemas/__tests__/slug.test.ts`
Expected: 7 failures, all "Cannot find module '@/lib/slug'".

- [ ] **Step 3: Implement `lib/slug.ts`**

Create `lib/slug.ts`:

```ts
/**
 * Convert a user-entered label into a stable snake_case slug used as a
 * DB key (question_key, option_key, axis_key). Result satisfies the
 * regex ^[a-z][a-z0-9_]*$ enforced by the website's CHECK constraints,
 * or is "" when no usable chars remain.
 */
export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")  // non-alphanumeric → underscore
    .replace(/^_+|_+$/g, "")      // trim leading/trailing
    .replace(/^[0-9]+/, "")       // strip leading digits (CHECK starts with letter)
    .replace(/^_+/, "");          // strip any underscores exposed by the previous strip
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- lib/schemas/__tests__/slug.test.ts`
Expected: 7 passes.

- [ ] **Step 5: Commit**

```bash
git add lib/slug.ts lib/schemas/__tests__/slug.test.ts
git commit -m "feat(slug): add toSlug helper for DB keys"
```

---

## Phase 2 — Zod schemas

### Task 2.1: Screening schemas

**Files:**
- Create: `lib/schemas/screening.ts`
- Test: `lib/schemas/__tests__/screening.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/schemas/__tests__/screening.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  screeningOptionInputSchema,
  screeningQuestionInputSchema,
  catalogDraftPatchSchema,
  SCREENING_TAGS,
  SCREENING_KINDS,
} from "@/lib/schemas/screening";

describe("screeningOptionInputSchema", () => {
  it("accepts a minimal valid option", () => {
    const r = screeningOptionInputSchema.safeParse({
      label: "Adventure",
      tag: "green",
      is_deal_breaker: false,
    });
    expect(r.success).toBe(true);
  });
  it("rejects empty label", () => {
    const r = screeningOptionInputSchema.safeParse({
      label: "",
      tag: "green",
      is_deal_breaker: false,
    });
    expect(r.success).toBe(false);
  });
  it("allows tag = null when unscored", () => {
    const r = screeningOptionInputSchema.safeParse({
      label: "Some text",
      tag: null,
      is_deal_breaker: false,
    });
    expect(r.success).toBe(true);
  });
  it("rejects is_deal_breaker=true when tag is not red", () => {
    const r = screeningOptionInputSchema.safeParse({
      label: "Adventure",
      tag: "green",
      is_deal_breaker: true,
    });
    expect(r.success).toBe(false);
  });
  it("accepts is_deal_breaker=true when tag=red", () => {
    const r = screeningOptionInputSchema.safeParse({
      label: "Not a fit",
      tag: "red",
      is_deal_breaker: true,
    });
    expect(r.success).toBe(true);
  });
});

describe("screeningQuestionInputSchema", () => {
  const baseSingle = {
    prompt: "What kind of trip excites you?",
    kind: "single" as const,
    is_scored: true,
    is_required: true,
    options: [
      { label: "Adventure", tag: "green" as const, is_deal_breaker: false },
      { label: "Relaxed", tag: "red" as const, is_deal_breaker: false },
    ],
  };
  it("accepts a minimal valid single question", () => {
    expect(screeningQuestionInputSchema.safeParse(baseSingle).success).toBe(true);
  });
  it("rejects empty prompt", () => {
    const r = screeningQuestionInputSchema.safeParse({ ...baseSingle, prompt: "" });
    expect(r.success).toBe(false);
  });
  it("requires >=2 options for kind=single", () => {
    const r = screeningQuestionInputSchema.safeParse({
      ...baseSingle,
      options: [{ label: "only one", tag: "green", is_deal_breaker: false }],
    });
    expect(r.success).toBe(false);
  });
  it("requires >=2 options for kind=multi", () => {
    const r = screeningQuestionInputSchema.safeParse({
      ...baseSingle,
      kind: "multi",
      options: [],
    });
    expect(r.success).toBe(false);
  });
  it("requires every option to have a tag when is_scored=true", () => {
    const r = screeningQuestionInputSchema.safeParse({
      ...baseSingle,
      options: [
        { label: "a", tag: "green", is_deal_breaker: false },
        { label: "b", tag: null, is_deal_breaker: false },
      ],
    });
    expect(r.success).toBe(false);
  });
  it("allows options with tag=null when is_scored=false", () => {
    const r = screeningQuestionInputSchema.safeParse({
      ...baseSingle,
      is_scored: false,
      options: [
        { label: "a", tag: null, is_deal_breaker: false },
        { label: "b", tag: null, is_deal_breaker: false },
      ],
    });
    expect(r.success).toBe(true);
  });
  it("accepts kind=textarea with zero options", () => {
    const r = screeningQuestionInputSchema.safeParse({
      prompt: "Anything else to share?",
      kind: "textarea",
      is_scored: false,
      is_required: false,
      options: [],
    });
    expect(r.success).toBe(true);
  });
});

describe("catalogDraftPatchSchema", () => {
  it("accepts a minimal patch", () => {
    const r = catalogDraftPatchSchema.safeParse({
      flag_if_red_at_least: 1,
      flag_if_yellow_at_least: 2,
      questions: [],
    });
    expect(r.success).toBe(true);
  });
  it("rejects flag thresholds < 1", () => {
    expect(
      catalogDraftPatchSchema.safeParse({
        flag_if_red_at_least: 0,
        flag_if_yellow_at_least: 2,
        questions: [],
      }).success,
    ).toBe(false);
  });
});

describe("constants", () => {
  it("exposes SCREENING_TAGS", () => {
    expect(SCREENING_TAGS).toEqual(["green", "yellow", "red"]);
  });
  it("exposes SCREENING_KINDS", () => {
    expect(SCREENING_KINDS).toEqual(["single", "multi", "textarea"]);
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- lib/schemas/__tests__/screening.test.ts`
Expected: all fail with module-not-found.

- [ ] **Step 3: Implement `lib/schemas/screening.ts`**

Create `lib/schemas/screening.ts`:

```ts
import { z } from "zod";

export const SCREENING_TAGS = ["green", "yellow", "red"] as const;
export const SCREENING_KINDS = ["single", "multi", "textarea"] as const;

export type ScreeningTag = (typeof SCREENING_TAGS)[number];
export type ScreeningKind = (typeof SCREENING_KINDS)[number];

export const screeningOptionInputSchema = z
  .object({
    option_id: z.string().optional(),
    label: z.string().min(1, "Please enter an answer choice").max(120),
    tag: z.enum(SCREENING_TAGS).nullable(),
    is_deal_breaker: z.boolean(),
  })
  .refine((v) => !v.is_deal_breaker || v.tag === "red", {
    message: "Only 'Not a fit' answers can block payment",
    path: ["is_deal_breaker"],
  });

export const screeningQuestionInputSchema = z
  .object({
    question_id: z.string().optional(),
    prompt: z.string().min(1, "Please enter the question").max(300),
    kind: z.enum(SCREENING_KINDS),
    is_scored: z.boolean(),
    is_required: z.boolean(),
    options: z.array(screeningOptionInputSchema),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "single" || v.kind === "multi") {
      if (v.options.length < 2) {
        ctx.addIssue({
          code: "custom",
          path: ["options"],
          message: "This question needs at least two answer choices",
        });
      }
    }
    if (v.kind === "textarea" && v.options.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Long-answer questions don't have answer choices",
      });
    }
    if (v.is_scored) {
      const untagged = v.options.findIndex((o) => o.tag === null);
      if (untagged >= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["options", untagged, "tag"],
          message: "Pick a colour for every answer choice",
        });
      }
    }
  });

export const catalogDraftPatchSchema = z.object({
  flag_if_red_at_least: z.coerce.number().int().min(1),
  flag_if_yellow_at_least: z.coerce.number().int().min(1),
  questions: z.array(screeningQuestionInputSchema),
});

export type ScreeningOptionInput = z.infer<typeof screeningOptionInputSchema>;
export type ScreeningQuestionInput = z.infer<typeof screeningQuestionInputSchema>;
export type CatalogDraftPatch = z.infer<typeof catalogDraftPatchSchema>;
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- lib/schemas/__tests__/screening.test.ts`
Expected: all 14 passes.

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/screening.ts lib/schemas/__tests__/screening.test.ts
git commit -m "feat(schemas): add screening catalog zod schemas"
```

### Task 2.2: Trip-variants schemas

**Files:**
- Create: `lib/schemas/trip-variants.ts`
- Test: `lib/schemas/__tests__/trip-variants.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/schemas/__tests__/trip-variants.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { variantAxisInputSchema, variantOptionInputSchema } from "@/lib/schemas/trip-variants";

describe("variantAxisInputSchema", () => {
  it("accepts a minimal axis", () => {
    const r = variantAxisInputSchema.safeParse({
      axis_label: "Room sharing",
      axis_description: "Pick how you'd like to share your room",
      is_required: true,
    });
    expect(r.success).toBe(true);
  });
  it("rejects empty label", () => {
    expect(
      variantAxisInputSchema.safeParse({
        axis_label: "",
        axis_description: null,
        is_required: true,
      }).success,
    ).toBe(false);
  });
  it("allows null description", () => {
    expect(
      variantAxisInputSchema.safeParse({
        axis_label: "Room sharing",
        axis_description: null,
        is_required: true,
      }).success,
    ).toBe(true);
  });
});

describe("variantOptionInputSchema", () => {
  const base = {
    option_label: "Double sharing",
    option_sublabel: null as string | null,
    price_per_pax: 45000,
    is_active: true,
  };
  it("accepts a minimal option", () => {
    expect(variantOptionInputSchema.safeParse(base).success).toBe(true);
  });
  it("rejects empty label", () => {
    expect(variantOptionInputSchema.safeParse({ ...base, option_label: "" }).success).toBe(false);
  });
  it("rejects negative price", () => {
    expect(variantOptionInputSchema.safeParse({ ...base, price_per_pax: -1 }).success).toBe(false);
  });
  it("rejects non-integer price", () => {
    expect(variantOptionInputSchema.safeParse({ ...base, price_per_pax: 45000.5 }).success).toBe(false);
  });
  it("rejects price > 1_000_000", () => {
    expect(variantOptionInputSchema.safeParse({ ...base, price_per_pax: 1_000_001 }).success).toBe(false);
  });
  it("accepts price = 0", () => {
    expect(variantOptionInputSchema.safeParse({ ...base, price_per_pax: 0 }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- lib/schemas/__tests__/trip-variants.test.ts`
Expected: module-not-found failures.

- [ ] **Step 3: Implement `lib/schemas/trip-variants.ts`**

Create `lib/schemas/trip-variants.ts`:

```ts
import { z } from "zod";

export const variantAxisInputSchema = z.object({
  variant_axis_id: z.string().optional(),
  axis_label: z.string().min(1, "Please enter a label for this price choice").max(80),
  axis_description: z.string().max(200).nullable(),
  is_required: z.boolean(),
});

export const variantOptionInputSchema = z.object({
  variant_option_id: z.string().optional(),
  variant_axis_id: z.string().optional(),
  option_label: z.string().min(1, "Please enter a label for this option").max(60),
  option_sublabel: z.string().max(120).nullable(),
  price_per_pax: z
    .number()
    .int("Price must be a whole number of rupees")
    .min(0, "Price cannot be negative")
    .max(1_000_000, "Price seems too high — please double-check"),
  is_active: z.boolean(),
});

export type VariantAxisInput = z.infer<typeof variantAxisInputSchema>;
export type VariantOptionInput = z.infer<typeof variantOptionInputSchema>;
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- lib/schemas/__tests__/trip-variants.test.ts`
Expected: 9 passes.

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/trip-variants.ts lib/schemas/__tests__/trip-variants.test.ts
git commit -m "feat(schemas): add trip-variants zod schemas"
```

### Task 2.3: Extend trip schema with `screening_enabled`

**Files:**
- Modify: `lib/schemas/trip.ts`

- [ ] **Step 1: Open `lib/schemas/trip.ts` and locate `tripBasicSchema`**

Read the file. The schema is `export const tripBasicSchema = z.object({...})`.

- [ ] **Step 2: Add `screening_enabled` to `tripBasicSchema`**

Inside the `z.object({...})` definition, add (place it near `booking_kind`/`currency_code`):

```ts
  screening_enabled: z.coerce.boolean().optional().default(false),
```

`.optional().default(false)` means: a missing field defaults to false (so existing form submissions without the field continue to work). Coercion handles strings from FormData when the field is sent.

- [ ] **Step 3: Verify no other places hard-code the form-state field list**

Run:
```bash
grep -rn "trip_name\|trip_type\|departure_city" lib/schemas/trip.ts | head -5
```
Expected: only references inside `tripBasicSchema` and the type export. No allow-list regex.

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add lib/schemas/trip.ts
git commit -m "feat(schemas): add screening_enabled to tripBasicSchema"
```

---

## Phase 3 — `lib/revalidate.ts` extension

### Task 3.1: Add `revalidateScreeningCatalog()`

**Files:**
- Modify: `lib/revalidate.ts`

- [ ] **Step 1: Read the file**

Confirm `revalidateWebsite(paths, tags)` already accepts tags.

- [ ] **Step 2: Add a tag-based helper at the bottom**

Append:

```ts
/**
 * Invalidate the website's cached active screening catalog after a publish.
 * Triggers tag-based revalidate on the website's /api/revalidate route.
 */
export const revalidateScreeningCatalog = () =>
  revalidateWebsite([], ["screening:active-catalog"]);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add lib/revalidate.ts
git commit -m "feat(revalidate): add revalidateScreeningCatalog tag helper"
```

---

## Phase 4 — DB layer: screening

### Task 4.1: Read-only `getActiveCatalog` + `getOrCreateDraftCatalog`

**Files:**
- Create: `lib/db/screening.ts`
- Test: `lib/db/__tests__/screening.test.ts`

- [ ] **Step 1: Write the failing test file**

The DB-layer tests will mock `getServiceClient`. Create `lib/db/__tests__/screening.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getServiceClient: vi.fn(),
}));
vi.mock("@/lib/ids", () => ({
  nextSequentialId: vi.fn(),
}));

import { getServiceClient } from "@/lib/supabase/server";
import { nextSequentialId } from "@/lib/ids";
import { getActiveCatalog, getOrCreateDraftCatalog, countTripsWithScreeningEnabled } from "@/lib/db/screening";

type Mocked = ReturnType<typeof vi.fn>;

function mockTable(rows: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: rows, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data: rows, error }),
    then: undefined,
  };
}

describe("getActiveCatalog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when there is no active version", async () => {
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    (getServiceClient as unknown as Mocked).mockReturnValue({ from });
    expect(await getActiveCatalog()).toBeNull();
  });
});

describe("countTripsWithScreeningEnabled", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the count", async () => {
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ count: 7, error: null }),
    });
    (getServiceClient as unknown as Mocked).mockReturnValue({ from });
    expect(await countTripsWithScreeningEnabled()).toBe(7);
  });
});
```

Note: deep integration of the multi-step draft-clone path is exercised in the manual R8 walkthrough — unit tests focus on the public contract.

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- lib/db/__tests__/screening.test.ts`
Expected: module-not-found.

- [ ] **Step 3: Implement `lib/db/screening.ts`**

Create `lib/db/screening.ts`:

```ts
import { getServiceClient } from "@/lib/supabase/server";
import { nextSequentialId } from "@/lib/ids";
import { toSlug } from "@/lib/slug";
import type {
  CatalogDraftPatch,
  ScreeningKind,
  ScreeningTag,
} from "@/lib/schemas/screening";

// ---------- Row types ----------

export interface DbScreeningCatalogVersion {
  catalog_version_id: string;
  version_label: string;
  is_active: boolean;
  flag_if_red_at_least: number;
  flag_if_yellow_at_least: number;
  is_immutable: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbScreeningQuestion {
  question_id: string;
  catalog_version_id: string;
  question_key: string;
  prompt: string;
  prompt_highlight: string | null;
  step: number;
  kind: ScreeningKind;
  is_scored: boolean;
  is_required: boolean;
  multi_select_rule: string | null;
  placeholder: string | null;
  max_length: number | null;
  sort_order: number;
}

export interface DbScreeningOption {
  option_id: string;
  question_id: string;
  option_key: string;
  label: string;
  tag: ScreeningTag | null;
  is_deal_breaker: boolean;
  sort_order: number;
}

export interface FullCatalogVersion {
  version: DbScreeningCatalogVersion;
  questions: Array<DbScreeningQuestion & { options: DbScreeningOption[] }>;
}

// ---------- Public API ----------

export async function getActiveCatalog(): Promise<FullCatalogVersion | null> {
  const db = getServiceClient();
  const { data: v, error: vErr } = await db
    .from("screening_catalog_versions")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  if (vErr) throw new Error(`getActiveCatalog (version) failed: ${vErr.message}`);
  if (!v) return null;
  return loadFullVersion(v as DbScreeningCatalogVersion);
}

export async function getOrCreateDraftCatalog(): Promise<FullCatalogVersion> {
  const db = getServiceClient();
  const { data: existing, error: dErr } = await db
    .from("screening_catalog_versions")
    .select("*")
    .eq("is_active", false)
    .eq("is_immutable", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (dErr) throw new Error(`getOrCreateDraftCatalog (lookup) failed: ${dErr.message}`);
  if (existing) return loadFullVersion(existing as DbScreeningCatalogVersion);
  return cloneActiveIntoDraft();
}

export async function saveDraftCatalog(
  draftVersionId: string,
  patch: CatalogDraftPatch,
): Promise<void> {
  const db = getServiceClient();
  // Refuse if not editable
  const { data: v, error: vErr } = await db
    .from("screening_catalog_versions")
    .select("catalog_version_id, is_immutable, is_active")
    .eq("catalog_version_id", draftVersionId)
    .single();
  if (vErr || !v) throw new Error(`saveDraftCatalog: version not found`);
  if (v.is_immutable || v.is_active) {
    throw new Error("saveDraftCatalog: this version is no longer editable. Reload the page.");
  }

  // Update version-level fields
  const { error: upErr } = await db
    .from("screening_catalog_versions")
    .update({
      flag_if_red_at_least: patch.flag_if_red_at_least,
      flag_if_yellow_at_least: patch.flag_if_yellow_at_least,
    })
    .eq("catalog_version_id", draftVersionId);
  if (upErr) throw new Error(`saveDraftCatalog (version update) failed: ${upErr.message}`);

  // Replace-and-upsert questions + options.
  // Strategy: delete all questions belonging to this draft, then re-insert in order.
  // This is the simplest correct path; the draft is short (<= ~12 questions).
  const { error: delErr } = await db
    .from("screening_questions")
    .delete()
    .eq("catalog_version_id", draftVersionId);
  if (delErr) throw new Error(`saveDraftCatalog (delete questions) failed: ${delErr.message}`);

  for (let qi = 0; qi < patch.questions.length; qi++) {
    const q = patch.questions[qi];
    const questionId = await nextSequentialId("screening_questions", "question_id", "NM-SCRQ");
    const questionKey = toSlug(q.prompt) || `q${qi + 1}`;
    const { error: qErr } = await db.from("screening_questions").insert({
      question_id: questionId,
      catalog_version_id: draftVersionId,
      question_key: questionKey,
      prompt: q.prompt,
      prompt_highlight: null,
      step: 1,
      kind: q.kind,
      is_scored: q.is_scored,
      is_required: q.is_required,
      multi_select_rule: q.kind === "multi" ? "worst_color" : null,
      placeholder: null,
      max_length: q.kind === "textarea" ? 500 : null,
      sort_order: qi,
    });
    if (qErr) throw new Error(`saveDraftCatalog (insert question ${qi}) failed: ${qErr.message}`);

    for (let oi = 0; oi < q.options.length; oi++) {
      const o = q.options[oi];
      const optionId = await nextSequentialId("screening_options", "option_id", "NM-SCRO");
      const optionKey = toSlug(o.label) || `opt${oi + 1}`;
      const { error: oErr } = await db.from("screening_options").insert({
        option_id: optionId,
        question_id: questionId,
        option_key: optionKey,
        label: o.label,
        tag: o.tag,
        is_deal_breaker: o.is_deal_breaker,
        sort_order: oi,
      });
      if (oErr) throw new Error(`saveDraftCatalog (insert option ${qi}.${oi}) failed: ${oErr.message}`);
    }
  }
}

export async function publishCatalog(
  draftVersionId: string,
): Promise<{ newDraftId: string }> {
  const db = getServiceClient();
  const { error: rpcErr } = await db.rpc("nm_publish_screening_catalog", {
    p_catalog_version_id: draftVersionId,
  });
  if (rpcErr) throw new Error(`publishCatalog: RPC failed: ${rpcErr.message}`);
  const fresh = await cloneActiveIntoDraft();
  return { newDraftId: fresh.version.catalog_version_id };
}

export async function deleteQuestion(questionId: string): Promise<void> {
  const db = getServiceClient();
  // Refuse if the question's version is immutable
  const { data: q, error: qErr } = await db
    .from("screening_questions")
    .select("catalog_version_id, screening_catalog_versions!inner(is_immutable, is_active)")
    .eq("question_id", questionId)
    .single();
  if (qErr || !q) throw new Error("deleteQuestion: question not found");
  const v = (q as any).screening_catalog_versions;
  if (v.is_immutable || v.is_active) {
    throw new Error("deleteQuestion: this version is no longer editable");
  }
  const { error } = await db.from("screening_questions").delete().eq("question_id", questionId);
  if (error) throw new Error(`deleteQuestion failed: ${error.message}`);
}

export async function deleteOption(optionId: string): Promise<void> {
  const db = getServiceClient();
  const { error } = await db.from("screening_options").delete().eq("option_id", optionId);
  if (error) throw new Error(`deleteOption failed: ${error.message}`);
}

export async function countTripsWithScreeningEnabled(): Promise<number> {
  const db = getServiceClient();
  const { count, error } = await db
    .from("trips")
    .select("trip_id", { count: "exact", head: true })
    .eq("trip_type", "Community")
    .eq("screening_enabled", true);
  if (error) throw new Error(`countTripsWithScreeningEnabled failed: ${error.message}`);
  return count ?? 0;
}

// ---------- Internals ----------

async function loadFullVersion(
  v: DbScreeningCatalogVersion,
): Promise<FullCatalogVersion> {
  const db = getServiceClient();
  const { data: qs, error: qErr } = await db
    .from("screening_questions")
    .select("*")
    .eq("catalog_version_id", v.catalog_version_id)
    .order("sort_order", { ascending: true });
  if (qErr) throw new Error(`loadFullVersion (questions) failed: ${qErr.message}`);

  const questions = (qs ?? []) as DbScreeningQuestion[];
  const questionIds = questions.map((q) => q.question_id);
  let optionsByQuestion = new Map<string, DbScreeningOption[]>();
  if (questionIds.length > 0) {
    const { data: opts, error: oErr } = await db
      .from("screening_options")
      .select("*")
      .in("question_id", questionIds)
      .order("sort_order", { ascending: true });
    if (oErr) throw new Error(`loadFullVersion (options) failed: ${oErr.message}`);
    for (const o of (opts ?? []) as DbScreeningOption[]) {
      const list = optionsByQuestion.get(o.question_id) ?? [];
      list.push(o);
      optionsByQuestion.set(o.question_id, list);
    }
  }

  return {
    version: v,
    questions: questions.map((q) => ({
      ...q,
      options: optionsByQuestion.get(q.question_id) ?? [],
    })),
  };
}

async function cloneActiveIntoDraft(): Promise<FullCatalogVersion> {
  const db = getServiceClient();
  const { data: active, error: aErr } = await db
    .from("screening_catalog_versions")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  if (aErr) throw new Error(`cloneActiveIntoDraft (lookup active) failed: ${aErr.message}`);

  const newVersionId = await nextSequentialId(
    "screening_catalog_versions",
    "catalog_version_id",
    "NM-SCRV",
  );
  const versionLabel = `draft @ ${new Date().toISOString()}`;
  const flagRed = active?.flag_if_red_at_least ?? 1;
  const flagYellow = active?.flag_if_yellow_at_least ?? 2;

  const { error: insErr } = await db.from("screening_catalog_versions").insert({
    catalog_version_id: newVersionId,
    version_label: versionLabel,
    is_active: false,
    flag_if_red_at_least: flagRed,
    flag_if_yellow_at_least: flagYellow,
    is_immutable: false,
  });
  if (insErr) throw new Error(`cloneActiveIntoDraft (insert version) failed: ${insErr.message}`);

  if (active) {
    const { data: oldQs } = await db
      .from("screening_questions")
      .select("*")
      .eq("catalog_version_id", active.catalog_version_id)
      .order("sort_order", { ascending: true });
    for (const q of (oldQs ?? []) as DbScreeningQuestion[]) {
      const newQId = await nextSequentialId("screening_questions", "question_id", "NM-SCRQ");
      await db.from("screening_questions").insert({
        question_id: newQId,
        catalog_version_id: newVersionId,
        question_key: q.question_key,
        prompt: q.prompt,
        prompt_highlight: q.prompt_highlight,
        step: q.step,
        kind: q.kind,
        is_scored: q.is_scored,
        is_required: q.is_required,
        multi_select_rule: q.multi_select_rule,
        placeholder: q.placeholder,
        max_length: q.max_length,
        sort_order: q.sort_order,
      });
      const { data: oldOpts } = await db
        .from("screening_options")
        .select("*")
        .eq("question_id", q.question_id)
        .order("sort_order", { ascending: true });
      for (const o of (oldOpts ?? []) as DbScreeningOption[]) {
        const newOId = await nextSequentialId("screening_options", "option_id", "NM-SCRO");
        await db.from("screening_options").insert({
          option_id: newOId,
          question_id: newQId,
          option_key: o.option_key,
          label: o.label,
          tag: o.tag,
          is_deal_breaker: o.is_deal_breaker,
          sort_order: o.sort_order,
        });
      }
    }
  }

  const { data: freshV } = await db
    .from("screening_catalog_versions")
    .select("*")
    .eq("catalog_version_id", newVersionId)
    .single();
  return loadFullVersion(freshV as DbScreeningCatalogVersion);
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- lib/db/__tests__/screening.test.ts`
Expected: 2 passes.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 6: Commit**

```bash
git add lib/db/screening.ts lib/db/__tests__/screening.test.ts
git commit -m "feat(db): screening catalog CRUD with draft auto-clone"
```

---

## Phase 5 — DB layer: trip-variants

### Task 5.1: `lib/db/trip-variants.ts`

**Files:**
- Create: `lib/db/trip-variants.ts`
- Test: `lib/db/__tests__/trip-variants.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/db/__tests__/trip-variants.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getServiceClient: vi.fn(),
}));
vi.mock("@/lib/ids", () => ({
  nextSequentialId: vi.fn(),
}));

import { getServiceClient } from "@/lib/supabase/server";
import { upsertVariantAxis, deleteVariantAxis } from "@/lib/db/trip-variants";

type Mocked = ReturnType<typeof vi.fn>;

describe("upsertVariantAxis", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects when groupSlug is missing", async () => {
    await expect(
      upsertVariantAxis("", { axis_label: "Room sharing", axis_description: null, is_required: true }),
    ).rejects.toThrow(/group/i);
  });
});

describe("deleteVariantAxis", () => {
  it("propagates DB errors", async () => {
    const from = vi.fn().mockReturnValue({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: { message: "boom" } }),
    });
    (getServiceClient as unknown as Mocked).mockReturnValue({ from });
    await expect(deleteVariantAxis("NM-VAX-001")).rejects.toThrow(/boom/);
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- lib/db/__tests__/trip-variants.test.ts`
Expected: module-not-found.

- [ ] **Step 3: Implement `lib/db/trip-variants.ts`**

Create `lib/db/trip-variants.ts`:

```ts
import { getServiceClient } from "@/lib/supabase/server";
import { nextSequentialId } from "@/lib/ids";
import { toSlug } from "@/lib/slug";
import type { VariantAxisInput, VariantOptionInput } from "@/lib/schemas/trip-variants";

export interface DbVariantAxis {
  variant_axis_id: string;
  group_slug: string;
  axis_key: string;
  axis_label: string;
  axis_description: string | null;
  sort_order: number;
  is_required: boolean;
}

export interface DbVariantOption {
  variant_option_id: string;
  variant_axis_id: string;
  option_key: string;
  option_label: string;
  option_sublabel: string | null;
  price_per_pax: number;
  sort_order: number;
  is_active: boolean;
}

export interface FullVariantAxis extends DbVariantAxis {
  options: DbVariantOption[];
}

export async function getVariantAxesForGroup(
  groupSlug: string,
): Promise<FullVariantAxis[]> {
  if (!groupSlug) return [];
  const db = getServiceClient();
  const { data: axes, error: aErr } = await db
    .from("trip_variant_axes")
    .select("*")
    .eq("group_slug", groupSlug)
    .order("sort_order", { ascending: true });
  if (aErr) throw new Error(`getVariantAxesForGroup (axes) failed: ${aErr.message}`);
  const axisRows = (axes ?? []) as DbVariantAxis[];
  if (axisRows.length === 0) return [];

  const axisIds = axisRows.map((a) => a.variant_axis_id);
  const { data: opts, error: oErr } = await db
    .from("trip_variant_options")
    .select("*")
    .in("variant_axis_id", axisIds)
    .order("sort_order", { ascending: true });
  if (oErr) throw new Error(`getVariantAxesForGroup (options) failed: ${oErr.message}`);

  const optionsByAxis = new Map<string, DbVariantOption[]>();
  for (const o of (opts ?? []) as DbVariantOption[]) {
    const list = optionsByAxis.get(o.variant_axis_id) ?? [];
    list.push(o);
    optionsByAxis.set(o.variant_axis_id, list);
  }
  return axisRows.map((a) => ({ ...a, options: optionsByAxis.get(a.variant_axis_id) ?? [] }));
}

export async function upsertVariantAxis(
  groupSlug: string,
  input: VariantAxisInput,
): Promise<string> {
  if (!groupSlug) {
    throw new Error("upsertVariantAxis: group_slug is required");
  }
  const db = getServiceClient();
  const axisKey = toSlug(input.axis_label);
  if (!axisKey) throw new Error("upsertVariantAxis: axis label produced an empty key");

  if (input.variant_axis_id) {
    const { error } = await db
      .from("trip_variant_axes")
      .update({
        axis_label: input.axis_label,
        axis_description: input.axis_description,
        is_required: input.is_required,
      })
      .eq("variant_axis_id", input.variant_axis_id);
    if (error) throw new Error(`upsertVariantAxis (update) failed: ${error.message}`);
    return input.variant_axis_id;
  }

  // New axis — compute next sort_order
  const { data: existing } = await db
    .from("trip_variant_axes")
    .select("sort_order")
    .eq("group_slug", groupSlug)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextSortOrder = ((existing?.[0] as { sort_order?: number })?.sort_order ?? -1) + 1;

  const newId = await nextSequentialId("trip_variant_axes", "variant_axis_id", "NM-VAX");
  const { error } = await db.from("trip_variant_axes").insert({
    variant_axis_id: newId,
    group_slug: groupSlug,
    axis_key: axisKey,
    axis_label: input.axis_label,
    axis_description: input.axis_description,
    sort_order: nextSortOrder,
    is_required: input.is_required,
  });
  if (error) throw new Error(`upsertVariantAxis (insert) failed: ${error.message}`);
  return newId;
}

export async function deleteVariantAxis(axisId: string): Promise<void> {
  const db = getServiceClient();
  const { error } = await db.from("trip_variant_axes").delete().eq("variant_axis_id", axisId);
  if (error) throw new Error(`deleteVariantAxis failed: ${error.message}`);
}

export async function upsertVariantOption(
  input: VariantOptionInput & { variant_axis_id: string },
): Promise<string> {
  const db = getServiceClient();
  const optionKey = toSlug(input.option_label);
  if (!optionKey) throw new Error("upsertVariantOption: option label produced an empty key");

  if (input.variant_option_id) {
    const { error } = await db
      .from("trip_variant_options")
      .update({
        option_label: input.option_label,
        option_sublabel: input.option_sublabel,
        price_per_pax: input.price_per_pax,
        is_active: input.is_active,
      })
      .eq("variant_option_id", input.variant_option_id);
    if (error) throw new Error(`upsertVariantOption (update) failed: ${error.message}`);
    return input.variant_option_id;
  }

  const { data: existing } = await db
    .from("trip_variant_options")
    .select("sort_order")
    .eq("variant_axis_id", input.variant_axis_id)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextSortOrder = ((existing?.[0] as { sort_order?: number })?.sort_order ?? -1) + 1;

  const newId = await nextSequentialId("trip_variant_options", "variant_option_id", "NM-VOP");
  const { error } = await db.from("trip_variant_options").insert({
    variant_option_id: newId,
    variant_axis_id: input.variant_axis_id,
    option_key: optionKey,
    option_label: input.option_label,
    option_sublabel: input.option_sublabel,
    price_per_pax: input.price_per_pax,
    sort_order: nextSortOrder,
    is_active: input.is_active,
  });
  if (error) throw new Error(`upsertVariantOption (insert) failed: ${error.message}`);
  return newId;
}

export async function deleteVariantOption(optionId: string): Promise<void> {
  const db = getServiceClient();
  const { error } = await db.from("trip_variant_options").delete().eq("variant_option_id", optionId);
  if (error) throw new Error(`deleteVariantOption failed: ${error.message}`);
}

export async function reorderVariantOptions(
  axisId: string,
  orderedIds: string[],
): Promise<void> {
  const db = getServiceClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await db
      .from("trip_variant_options")
      .update({ sort_order: i })
      .eq("variant_option_id", orderedIds[i])
      .eq("variant_axis_id", axisId);
    if (error) throw new Error(`reorderVariantOptions failed at ${i}: ${error.message}`);
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- lib/db/__tests__/trip-variants.test.ts`
Expected: 2 passes.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 6: Commit**

```bash
git add lib/db/trip-variants.ts lib/db/__tests__/trip-variants.test.ts
git commit -m "feat(db): trip-variants CRUD scoped to group_slug"
```

---

## Phase 6 — `/screening` server actions

### Task 6.1: `app/(cms)/screening/actions.ts`

**Files:**
- Create: `app/(cms)/screening/actions.ts`

- [ ] **Step 1: Implement the file**

Create `app/(cms)/screening/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { catalogDraftPatchSchema, type CatalogDraftPatch } from "@/lib/schemas/screening";
import {
  saveDraftCatalog,
  publishCatalog,
  deleteQuestion,
  deleteOption,
} from "@/lib/db/screening";
import { revalidateScreeningCatalog } from "@/lib/revalidate";
import { logActivity } from "@/lib/audit";

function logAsync(input: Parameters<typeof logActivity>[0]): void {
  void logActivity(input).catch((err) => {
    console.error("[logActivity] swallowed:", err);
  });
}

export async function saveDraftAction(
  draftVersionId: string,
  rawPatch: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = catalogDraftPatchSchema.safeParse(rawPatch);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `${issue.path.join(".") || "form"}: ${issue.message}` };
  }
  try {
    await saveDraftCatalog(draftVersionId, parsed.data as CatalogDraftPatch);
    revalidatePath("/screening");
    logAsync({
      table_name: "screening_catalog_versions",
      record_id: draftVersionId,
      action: "UPDATE",
      new_values: { question_count: parsed.data.questions.length },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function publishCatalogAction(
  draftVersionId: string,
): Promise<{ ok: true; newDraftId: string } | { ok: false; error: string }> {
  try {
    const { newDraftId } = await publishCatalog(draftVersionId);
    await revalidateScreeningCatalog();  // fire-and-forget inside helper
    revalidatePath("/screening");
    logAsync({
      table_name: "screening_catalog_versions",
      record_id: draftVersionId,
      action: "UPDATE",
      new_values: { published: true },
    });
    return { ok: true, newDraftId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteQuestionAction(
  questionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await deleteQuestion(questionId);
    revalidatePath("/screening");
    logAsync({
      table_name: "screening_questions",
      record_id: questionId,
      action: "DELETE",
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteOptionAction(
  optionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await deleteOption(optionId);
    revalidatePath("/screening");
    logAsync({
      table_name: "screening_options",
      record_id: optionId,
      action: "DELETE",
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add 'app/(cms)/screening/actions.ts'
git commit -m "feat(screening): server actions for draft save and publish"
```

---

## Phase 7 — `/screening` page + editor components

### Task 7.1: Form-state types

**Files:**
- Create: `app/(cms)/screening/_components/types.ts`

- [ ] **Step 1: Implement**

Create `app/(cms)/screening/_components/types.ts`:

```ts
import type { FullCatalogVersion } from "@/lib/db/screening";
import type { ScreeningKind, ScreeningTag } from "@/lib/schemas/screening";

export interface OptionFormState {
  option_id?: string;
  label: string;
  tag: ScreeningTag | null;
  is_deal_breaker: boolean;
}

export interface QuestionFormState {
  question_id?: string;
  prompt: string;
  kind: ScreeningKind;
  is_scored: boolean;
  is_required: boolean;
  options: OptionFormState[];
}

export interface CatalogFormState {
  flag_if_red_at_least: number;
  flag_if_yellow_at_least: number;
  questions: QuestionFormState[];
}

export function buildCatalogFormState(c: FullCatalogVersion): CatalogFormState {
  return {
    flag_if_red_at_least: c.version.flag_if_red_at_least,
    flag_if_yellow_at_least: c.version.flag_if_yellow_at_least,
    questions: c.questions.map((q) => ({
      question_id: q.question_id,
      prompt: q.prompt,
      kind: q.kind,
      is_scored: q.is_scored,
      is_required: q.is_required,
      options: q.options.map((o) => ({
        option_id: o.option_id,
        label: o.label,
        tag: o.tag,
        is_deal_breaker: o.is_deal_breaker,
      })),
    })),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add 'app/(cms)/screening/_components/types.ts'
git commit -m "feat(screening): form-state types"
```

### Task 7.2: `ScoringRulesCard`

**Files:**
- Create: `app/(cms)/screening/_components/ScoringRulesCard.tsx`

- [ ] **Step 1: Implement**

Create the file:

```tsx
"use client";

import { NumericInput } from "@/components/ui/NumericInput";

interface ScoringRulesCardProps {
  flagIfRedAtLeast: number;
  flagIfYellowAtLeast: number;
  onChange: (next: { flagIfRedAtLeast: number; flagIfYellowAtLeast: number }) => void;
}

export function ScoringRulesCard({
  flagIfRedAtLeast,
  flagIfYellowAtLeast,
  onChange,
}: ScoringRulesCardProps) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <h3 className="mb-3 text-sm font-semibold text-ink">Scoring rules</h3>
      <p className="mb-4 text-sm text-mid">Flag a customer when they pick:</p>
      <div className="flex flex-wrap items-center gap-3">
        <NumericInput
          value={flagIfRedAtLeast}
          onChange={(v) =>
            onChange({ flagIfRedAtLeast: Math.max(1, v ?? 1), flagIfYellowAtLeast })
          }
          min={1}
          step={1}
          showSteppers
          className="w-24"
        />
        <span className="text-sm text-ink">red answers (or more)</span>
        <span className="text-sm font-medium text-mid">OR</span>
        <NumericInput
          value={flagIfYellowAtLeast}
          onChange={(v) =>
            onChange({ flagIfRedAtLeast, flagIfYellowAtLeast: Math.max(1, v ?? 1) })
          }
          min={1}
          step={1}
          showSteppers
          className="w-24"
        />
        <span className="text-sm text-ink">yellow answers (or more)</span>
      </div>
      <p className="mt-3 text-xs text-mid">
        With these settings, picking {flagIfRedAtLeast} red OR {flagIfYellowAtLeast} yellows = flagged.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add 'app/(cms)/screening/_components/ScoringRulesCard.tsx'
git commit -m "feat(screening): ScoringRulesCard component"
```

### Task 7.3: `QuestionCard`

**Files:**
- Create: `app/(cms)/screening/_components/QuestionCard.tsx`

- [ ] **Step 1: Implement**

Create the file (this is a large component — render the question's editable fields, options inline with drag-reorder, and a menu for delete):

```tsx
"use client";

import { useState } from "react";
import { GripVertical, Trash2, ChevronUp, ChevronDown, MoreVertical } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";
import { FilterPills } from "@/components/ui/FilterPills";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SortableList } from "@/components/ui/SortableList";
import { SCREENING_TAGS, type ScreeningTag } from "@/lib/schemas/screening";
import type { OptionFormState, QuestionFormState } from "./types";

const KIND_OPTIONS = [
  { value: "single", label: "○ Pick one" },
  { value: "multi", label: "☑ Pick many" },
  { value: "textarea", label: "✎ Long answer" },
];

const TAG_OPTIONS = [
  { value: "green", label: "🟢 Great fit" },
  { value: "yellow", label: "🟡 Some friction" },
  { value: "red", label: "🔴 Not a fit" },
  { value: "none", label: "⚪ No score" },
];

interface QuestionCardProps {
  question: QuestionFormState;
  index: number;
  totalCount: number;
  onChange: (next: QuestionFormState) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function QuestionCard({
  question,
  index,
  totalCount,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: QuestionCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingKind, setPendingKind] = useState<string | null>(null);

  const updateOption = (i: number, next: OptionFormState) => {
    const options = [...question.options];
    options[i] = next;
    onChange({ ...question, options });
  };

  const addOption = () => {
    onChange({
      ...question,
      options: [
        ...question.options,
        { label: `Option ${question.options.length + 1}`, tag: null, is_deal_breaker: false },
      ],
    });
  };

  const deleteOption = (i: number) => {
    onChange({ ...question, options: question.options.filter((_, j) => j !== i) });
  };

  const reorderOptions = (orderedIndexes: number[]) => {
    onChange({ ...question, options: orderedIndexes.map((i) => question.options[i]) });
  };

  const applyKindChange = (newKind: string) => {
    onChange({
      ...question,
      kind: newKind as QuestionFormState["kind"],
      options: newKind === "textarea" ? [] : question.options,
    });
    setPendingKind(null);
  };

  const handleKindChange = (newKind: string) => {
    if (newKind === question.kind) return;
    if (question.options.length > 0 && (newKind === "textarea" || question.kind === "textarea")) {
      setPendingKind(newKind);
    } else {
      applyKindChange(newKind);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="text-xs font-semibold text-mid">Q{index + 1}</span>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded p-1 hover:bg-surface3"
            aria-label="Question menu"
          >
            <MoreVertical className="h-4 w-4 text-mid" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-line bg-surface shadow-lg">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => { setMenuOpen(false); onMoveUp(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-surface3 disabled:opacity-40"
              >
                <ChevronUp className="h-4 w-4" /> Move up
              </button>
              <button
                type="button"
                disabled={index === totalCount - 1}
                onClick={() => { setMenuOpen(false); onMoveDown(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-surface3 disabled:opacity-40"
              >
                <ChevronDown className="h-4 w-4" /> Move down
              </button>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-surface3"
              >
                <Trash2 className="h-4 w-4" /> Delete this question
              </button>
            </div>
          )}
        </div>
      </div>

      <FormField label="What customers will see">
        <textarea
          value={question.prompt}
          onChange={(e) => onChange({ ...question, prompt: e.target.value })}
          placeholder="e.g. What kind of trip excites you?"
          maxLength={300}
          rows={2}
          className="w-full rounded-lg border border-line bg-surface3 px-3 py-2 text-sm"
        />
      </FormField>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold text-mid">Answer style</p>
        <FilterPills
          options={KIND_OPTIONS}
          value={question.kind}
          onChange={handleKindChange}
        />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <label className="flex items-center gap-2">
          <Toggle
            checked={question.is_scored}
            onChange={(v) => onChange({ ...question, is_scored: v })}
          />
          <span className="text-sm text-ink">Use this answer to flag customers</span>
        </label>
        <label className="flex items-center gap-2">
          <Toggle
            checked={question.is_required}
            onChange={(v) => onChange({ ...question, is_required: v })}
          />
          <span className="text-sm text-ink">Customers must answer this</span>
        </label>
      </div>

      {question.kind !== "textarea" && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold text-mid">Answer choices (drag to reorder)</p>
          <SortableList
            items={question.options.map((_, i) => ({ id: String(i) }))}
            onReorder={(ids) => reorderOptions(ids.map((id) => Number(id)))}
            renderItem={(item) => {
              const i = Number(item.id);
              const o = question.options[i];
              if (!o) return null;
              return (
                <div className="flex items-start gap-2 rounded-lg border border-line bg-surface3 p-2">
                  <GripVertical className="mt-1 h-4 w-4 cursor-grab text-mid" />
                  <input
                    type="text"
                    value={o.label}
                    onChange={(e) => updateOption(i, { ...o, label: e.target.value })}
                    placeholder="Answer label"
                    className="flex-1 rounded border border-line bg-surface px-2 py-1 text-sm"
                  />
                  <FilterPills
                    options={TAG_OPTIONS}
                    value={o.tag ?? "none"}
                    onChange={(v) =>
                      updateOption(i, {
                        ...o,
                        tag: v === "none" ? null : (v as ScreeningTag),
                        is_deal_breaker: v === "red" ? o.is_deal_breaker : false,
                      })
                    }
                  />
                  <label className="flex items-center gap-1" title={o.tag !== "red" ? "Only 'Not a fit' answers can block payment" : ""}>
                    <Toggle
                      checked={o.is_deal_breaker}
                      onChange={(v) => updateOption(i, { ...o, is_deal_breaker: v })}
                      disabled={o.tag !== "red"}
                    />
                    <span className="text-xs text-mid">Block</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => deleteOption(i)}
                    className="rounded p-1 hover:bg-line"
                    aria-label="Delete option"
                  >
                    <Trash2 className="h-4 w-4 text-mid" />
                  </button>
                </div>
              );
            }}
          />
          <Button variant="ghost" onClick={addOption} className="mt-2">+ Add answer choice</Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this question?"
        message="It will be removed from the Fit Check the next time you publish."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { setConfirmDelete(false); onDelete(); }}
        onCancel={() => setConfirmDelete(false)}
      />
      <ConfirmDialog
        open={pendingKind !== null}
        title="Change the answer style?"
        message="Changing the answer style removes the current answer choices."
        confirmLabel="Yes, change it"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => pendingKind && applyKindChange(pendingKind)}
        onCancel={() => setPendingKind(null)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify `SortableList` and `FormField` props match by reading their source**

Run:
```bash
head -40 components/ui/SortableList.tsx
head -40 components/ui/FormField.tsx
```
If the prop signatures differ, adjust the `<SortableList>` and `<FormField>` usage above to match. Specifically:
- `SortableList` items shape — use whatever key the existing component expects.
- `FormField` may not accept `label` as a prop — wrap manually with `<label>` if needed.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes (or fix the component prop mismatches surfaced).

- [ ] **Step 4: Commit**

```bash
git add 'app/(cms)/screening/_components/QuestionCard.tsx'
git commit -m "feat(screening): QuestionCard with options editor"
```

### Task 7.4: `AddQuestionModal`

**Files:**
- Create: `app/(cms)/screening/_components/AddQuestionModal.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client";

import { useState } from "react";
import { FormModal } from "@/components/ui/FormModal";
import { Button } from "@/components/ui/Button";
import { FilterPills } from "@/components/ui/FilterPills";
import { Toggle } from "@/components/ui/Toggle";
import type { QuestionFormState } from "./types";
import type { ScreeningKind } from "@/lib/schemas/screening";

const KIND_OPTIONS = [
  { value: "single", label: "○ Pick one" },
  { value: "multi", label: "☑ Pick many" },
  { value: "textarea", label: "✎ Long answer" },
];

interface AddQuestionModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (q: QuestionFormState) => void;
}

export function AddQuestionModal({ open, onClose, onAdd }: AddQuestionModalProps) {
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState<ScreeningKind>("single");
  const [isScored, setIsScored] = useState(true);
  const [isRequired, setIsRequired] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError("Please enter the question.");
      return;
    }
    const options =
      kind === "textarea"
        ? []
        : [
            { label: "Option 1", tag: null, is_deal_breaker: false },
            { label: "Option 2", tag: null, is_deal_breaker: false },
          ];
    onAdd({
      prompt: trimmed,
      kind,
      is_scored: isScored,
      is_required: isRequired,
      options,
    });
    setPrompt("");
    setKind("single");
    setIsScored(true);
    setIsRequired(true);
    setError(null);
    onClose();
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Add a question"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAdd}>Add question</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="mb-1 block text-xs font-semibold text-mid">What customers will see</label>
          <textarea
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); setError(null); }}
            placeholder="e.g. What kind of trip excites you?"
            maxLength={300}
            rows={3}
            className="w-full rounded-lg border border-line bg-surface3 px-3 py-2 text-sm"
          />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-mid">Answer style</p>
          <FilterPills options={KIND_OPTIONS} value={kind} onChange={(v) => setKind(v as ScreeningKind)} />
        </div>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2">
            <Toggle checked={isScored} onChange={setIsScored} />
            <span className="text-sm text-ink">Use this answer to flag customers</span>
          </label>
          <label className="flex items-center gap-2">
            <Toggle checked={isRequired} onChange={setIsRequired} />
            <span className="text-sm text-ink">Customers must answer this</span>
          </label>
        </div>
      </div>
    </FormModal>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add 'app/(cms)/screening/_components/AddQuestionModal.tsx'
git commit -m "feat(screening): AddQuestionModal"
```

### Task 7.5: `ScreeningCatalogEditor` (top-level client)

**Files:**
- Create: `app/(cms)/screening/_components/ScreeningCatalogEditor.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ScoringRulesCard } from "./ScoringRulesCard";
import { QuestionCard } from "./QuestionCard";
import { AddQuestionModal } from "./AddQuestionModal";
import type { CatalogFormState, QuestionFormState } from "./types";
import { buildCatalogFormState } from "./types";
import type { FullCatalogVersion } from "@/lib/db/screening";
import { saveDraftAction, publishCatalogAction, deleteQuestionAction } from "../actions";

interface ScreeningCatalogEditorProps {
  draft: FullCatalogVersion;
  enabledTripCount: number;
}

export function ScreeningCatalogEditor({ draft, enabledTripCount }: ScreeningCatalogEditorProps) {
  const [form, setForm] = useState<CatalogFormState>(() => buildCatalogFormState(draft));
  const [draftVersionId, setDraftVersionId] = useState(draft.version.catalog_version_id);
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() => JSON.stringify(form));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [addOpen, setAddOpen] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDirty = JSON.stringify(form) !== savedSnapshot;

  // Debounced autosave (800ms)
  useEffect(() => {
    if (!isDirty) return;
    setStatus("saving");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void doSave(form); }, 800);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  async function doSave(snapshot: CatalogFormState) {
    const res = await saveDraftAction(draftVersionId, snapshot);
    if (res.ok) {
      setSavedSnapshot(JSON.stringify(snapshot));
      setStatus("saved");
    } else {
      setStatus("error");
      toast.error(res.error);
    }
  }

  const handleSaveDraft = async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setStatus("saving");
    await doSave(form);
  };

  const handlePublish = async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Force-flush save first
    if (isDirty) await doSave(form);
    if (form.questions.length === 0) {
      toast.error("Add at least one question before publishing.");
      return;
    }
    startTransition(async () => {
      const res = await publishCatalogAction(draftVersionId);
      if (res.ok) {
        toast.success("Published to website");
        setDraftVersionId(res.newDraftId);
        // The new draft is identical to what we just published; keep the form as-is
        setSavedSnapshot(JSON.stringify(form));
        setStatus("saved");
      } else {
        toast.error(res.error);
      }
      setConfirmPublish(false);
    });
  };

  const updateQuestion = (i: number, next: QuestionFormState) => {
    const questions = [...form.questions];
    questions[i] = next;
    setForm({ ...form, questions });
  };

  const moveQuestion = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= form.questions.length) return;
    const questions = [...form.questions];
    [questions[i], questions[j]] = [questions[j], questions[i]];
    setForm({ ...form, questions });
  };

  const handleDelete = async (i: number) => {
    const q = form.questions[i];
    if (q.question_id) {
      // Persist immediately to avoid a stale ghost after autosave
      const res = await deleteQuestionAction(q.question_id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
    }
    const questions = form.questions.filter((_, j) => j !== i);
    const next = { ...form, questions };
    setForm(next);
    setSavedSnapshot(JSON.stringify(next));
  };

  const handleAddQuestion = (q: QuestionFormState) => {
    setForm({ ...form, questions: [...form.questions, q] });
  };

  const optionsCount = form.questions.reduce((acc, q) => acc + q.options.length, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <StatusPill status={status} isDirty={isDirty} />
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={handleSaveDraft} disabled={!isDirty}>
            Save draft
          </Button>
          <Button onClick={() => setConfirmPublish(true)} disabled={isPending}>
            Publish to website
          </Button>
        </div>
      </div>

      {isDirty && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          You have unsaved changes — customers still see the currently-published questions until you publish.
        </div>
      )}

      <ScoringRulesCard
        flagIfRedAtLeast={form.flag_if_red_at_least}
        flagIfYellowAtLeast={form.flag_if_yellow_at_least}
        onChange={({ flagIfRedAtLeast, flagIfYellowAtLeast }) =>
          setForm({ ...form, flag_if_red_at_least: flagIfRedAtLeast, flag_if_yellow_at_least: flagIfYellowAtLeast })
        }
      />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-ink">Questions</h3>
        {form.questions.map((q, i) => (
          <QuestionCard
            key={q.question_id ?? `new-${i}`}
            question={q}
            index={i}
            totalCount={form.questions.length}
            onChange={(next) => updateQuestion(i, next)}
            onDelete={() => void handleDelete(i)}
            onMoveUp={() => moveQuestion(i, -1)}
            onMoveDown={() => moveQuestion(i, 1)}
          />
        ))}
        <Button variant="ghost" onClick={() => setAddOpen(true)}>+ Add question</Button>
      </div>

      <AddQuestionModal open={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAddQuestion} />

      <ConfirmDialog
        open={confirmPublish}
        title="Publish to website?"
        message={`You're about to publish ${form.questions.length} questions and ${optionsCount} answer choices. Affects ${enabledTripCount} Soulful Escapes trips with Fit Check turned on. Customers will see the new questions immediately.`}
        confirmLabel="Publish to website"
        cancelLabel="Cancel"
        onConfirm={handlePublish}
        onCancel={() => setConfirmPublish(false)}
      />
    </div>
  );
}

function StatusPill({ status, isDirty }: { status: string; isDirty: boolean }) {
  if (isDirty && status === "saving") return <span className="text-xs text-mid">● Saving…</span>;
  if (!isDirty && status === "saved") return <span className="text-xs text-green-700">● Saved</span>;
  if (status === "error") return <span className="text-xs text-red-600">● Save failed</span>;
  if (isDirty) return <span className="text-xs text-yellow-700">● Unsaved changes</span>;
  return <span className="text-xs text-mid">● Up to date</span>;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes. Fix any prop-shape mismatches against the actual `ConfirmDialog` / `Button` APIs.

- [ ] **Step 3: Commit**

```bash
git add 'app/(cms)/screening/_components/ScreeningCatalogEditor.tsx'
git commit -m "feat(screening): catalog editor with autosave + publish"
```

### Task 7.6: `/screening/page.tsx`

**Files:**
- Create: `app/(cms)/screening/page.tsx`

- [ ] **Step 1: Implement**

```tsx
import { ScreeningCatalogEditor } from "./_components/ScreeningCatalogEditor";
import { getOrCreateDraftCatalog, countTripsWithScreeningEnabled } from "@/lib/db/screening";

export const dynamic = "force-dynamic";

export default async function ScreeningPage() {
  const [draft, enabledTripCount] = await Promise.all([
    getOrCreateDraftCatalog(),
    countTripsWithScreeningEnabled(),
  ]);
  return <ScreeningCatalogEditor draft={draft} enabledTripCount={enabledTripCount} />;
}
```

- [ ] **Step 2: Commit**

```bash
git add 'app/(cms)/screening/page.tsx'
git commit -m "feat(screening): /screening server page"
```

### Task 7.7: Sidebar + page title

**Files:**
- Modify: `components/ui/Sidebar.tsx`
- Modify: `app/(cms)/CmsShell.tsx`

- [ ] **Step 1: Add `ShieldCheck` to lucide imports in `Sidebar.tsx`**

In the lucide-react import block, add `ShieldCheck` alphabetically:

```ts
ShieldCheck,
```

- [ ] **Step 2: Add the navItem**

Locate the `navItems` array; add (after `trips`):

```ts
  { id: "screening", label: "Fit Check", icon: ShieldCheck },
```

- [ ] **Step 3: Add the page-title entry**

In `app/(cms)/CmsShell.tsx`, find the `PAGE_TITLES` map. Add:

```ts
  "/screening": {
    title: "Trip Fit Check Questions",
    subtitle: "The questionnaire customers fill in before paying. Applies to all Soulful Escapes trips with Fit Check turned on.",
  },
```

- [ ] **Step 4: Lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add components/ui/Sidebar.tsx 'app/(cms)/CmsShell.tsx'
git commit -m "feat(nav): /screening sidebar entry + page title"
```

### Task 7.8: Manual smoke check of `/screening`

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Open `http://localhost:3001/screening`**

Verify:
1. The page loads with the active catalog cloned into an editable draft.
2. Edits trigger the "● Saving…" → "● Saved" status pill.
3. Reload — edits persist.
4. Click *Publish to website* — confirm dialog shows the trip count. Confirm → toast "Published to website". A fresh draft is created (verified by reloading and seeing the same content under a new draft ID).
5. Stop the dev server (Ctrl+C).

If anything fails, fix it before moving on. Common gotcha: the website's `/api/revalidate` endpoint may reject without a secret — ensure `REVALIDATION_SECRET` and `WEBSITE_URL` are in `.env.local`.

---

## Phase 8 — Trip wizard: extend types + form state

### Task 8.1: Add `screening_enabled` to `TripFormState`

**Files:**
- Modify: `app/(cms)/trips/_components/types.ts`

- [ ] **Step 1: Add the field to `TripFormState`**

Locate the `TripFormState` interface and add (next to `booking_kind`):

```ts
  screening_enabled: boolean;
```

- [ ] **Step 2: Default in `buildInitialState(null)`**

In the `if (!trip)` branch, the returned object literal — add right after `booking_kind: "trip", currency_code: "INR",`:

```ts
      // Default ON for new Community trips; the wizard toggles this when trip_type changes.
      screening_enabled: false,
```

- [ ] **Step 3: Default in `buildInitialState(trip)`**

In the `return { ...` for an existing trip, add (next to `currency_code`):

```ts
    screening_enabled:
      (trip as unknown as { screening_enabled?: boolean }).screening_enabled ?? false,
```

(Cast is needed because `DbTrip` doesn't have the field typed yet — that lives in the website repo. The runtime value is present.)

- [ ] **Step 4: Add a `screening` step to `STEPS_EDIT` and `STEPS_CREATE`**

Insert into both arrays between `settings` and `gallery`/`settings`:

**`STEPS_CREATE`** — add after `settings`:

```ts
  // Last step in create is settings; screening fits between inclusions and faqs visually
```

Actually, place it between `faqs` and `settings`. Updated arrays:

```ts
export const STEPS_CREATE: StepDef[] = [
  { id: "basic", label: "Trip Info", desc: "Name, type, dates & pricing", num: "1" },
  { id: "details", label: "Description", desc: "Overview, tagline & highlights", num: "2" },
  { id: "itinerary", label: "Itinerary", desc: "Day-by-day plan", num: "3" },
  { id: "inclusions", label: "What's Included", desc: "Inclusions & exclusions", num: "4" },
  { id: "faqs", label: "FAQs", desc: "Common questions & answers", num: "5" },
  { id: "variants", label: "Price Options", desc: "Optional choices customers pick at booking", num: "6" },
  { id: "screening", label: "Fit Check", desc: "Questionnaire shown before payment", num: "7" },
  { id: "settings", label: "Review & Publish", desc: "Status & visibility", num: "8" },
];

export const STEPS_EDIT: StepDef[] = [
  { id: "basic", label: "Trip Info", desc: "Name, type, dates & pricing", num: "1" },
  { id: "details", label: "Description", desc: "Overview, tagline & highlights", num: "2" },
  { id: "itinerary", label: "Itinerary", desc: "Day-by-day plan", num: "3" },
  { id: "inclusions", label: "What's Included", desc: "Inclusions & exclusions", num: "4" },
  { id: "faqs", label: "FAQs", desc: "Common questions & answers", num: "5" },
  { id: "variants", label: "Price Options", desc: "Optional choices customers pick at booking", num: "6" },
  { id: "screening", label: "Fit Check", desc: "Questionnaire shown before payment", num: "7" },
  { id: "gallery", label: "Gallery", desc: "Trip images & cover photo", num: "8" },
  { id: "settings", label: "Publish Settings", desc: "Status & visibility", num: "9" },
];
```

(Note: the wizard renumbers visually based on filtered steps when `trip_type !== "Community"` removes the `screening` step.)

- [ ] **Step 5: Add a no-op clause to `validateStep`**

In the `validateStep` switch, add:

```ts
    case "variants":
      return null;
    case "screening":
      return null;
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 7: Commit**

```bash
git add 'app/(cms)/trips/_components/types.ts'
git commit -m "feat(trips): add screening_enabled + variants/screening steps"
```

### Task 8.2: Wire `screening_enabled` into save flow

**Files:**
- Modify: `app/(cms)/trips/_components/TripEditor.tsx`

- [ ] **Step 1: Find the payload builder used by `handleSave`**

Search the file:
```bash
grep -n "buildBasicPayload\|payload" 'app/(cms)/trips/_components/TripEditor.tsx' | head -20
```

- [ ] **Step 2: Add `screening_enabled: f.screening_enabled` to that builder's return object**

There's already a `buildBasicPayload` helper in `TripEditor.tsx`. Inside its return object literal, add (alongside `currency_code`):

```ts
      screening_enabled: f.screening_enabled,
```

- [ ] **Step 3: Force off when trip_type changes away from Community**

Find the code that auto-derives fields (`useDerivedTripFields`). If editing that hook is too invasive, instead add a `useEffect` directly in `TripEditor.tsx`:

```ts
  useEffect(() => {
    if (form.trip_type !== "Community" && form.screening_enabled) {
      setForm((prev) => ({ ...prev, screening_enabled: false }));
    }
    if (form.trip_type === "Community" && !trip && !form.screening_enabled) {
      // Auto-enable for NEW community trips (not when editing existing non-Community → Community)
      // Detect "new" by checking if `trip` prop is null.
      setForm((prev) => ({ ...prev, screening_enabled: true }));
    }
  }, [form.trip_type, trip]);
```

Place this near the other `useEffect` blocks in the editor.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add 'app/(cms)/trips/_components/TripEditor.tsx'
git commit -m "feat(trips): wire screening_enabled into save + auto-default"
```

### Task 8.3: Filter `screening` step out for non-Community trips

**Files:**
- Modify: `app/(cms)/trips/_components/TripEditor.tsx`

- [ ] **Step 1: Find where `steps` is derived**

Currently: `const steps = isEditing ? STEPS_EDIT : STEPS_CREATE;`.

- [ ] **Step 2: Replace with a `useMemo`-filtered version**

```ts
  const steps = useMemo(() => {
    const base = isEditing ? STEPS_EDIT : STEPS_CREATE;
    return form.trip_type === "Community"
      ? base
      : base.filter((s) => s.id !== "screening");
  }, [isEditing, form.trip_type]);
```

Add `useMemo` to the React imports if not already imported.

- [ ] **Step 3: Verify `stepIndex` is bounded after filtering**

Add right after the `useMemo`:

```ts
  useEffect(() => {
    if (stepIndex >= steps.length) setStepIndex(steps.length - 1);
  }, [steps.length, stepIndex]);
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add 'app/(cms)/trips/_components/TripEditor.tsx'
git commit -m "feat(trips): hide Fit Check step for non-Community trips"
```

---

## Phase 9 — Trip wizard: `ScreeningTab`

### Task 9.1: Build the tab

**Files:**
- Create: `app/(cms)/trips/_components/tabs/ScreeningTab.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client";

import Link from "next/link";
import { Info, ExternalLink } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import type { FullCatalogVersion } from "@/lib/db/screening";

interface ScreeningTabProps {
  enabled: boolean;
  onEnabledChange: (next: boolean) => void;
  activeCatalog: FullCatalogVersion | null;
}

export function ScreeningTab({ enabled, onEnabledChange, activeCatalog }: ScreeningTabProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-line bg-surface3 p-5">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 text-rust" />
          <div>
            <h3 className="text-sm font-semibold text-ink">What is the Trip Fit Check?</h3>
            <p className="mt-1 text-sm text-mid">
              A short questionnaire shown to customers between Traveller Details and Payment.
              Customers whose answers don't fit a Soulful Escapes vibe are flagged — they can't pay
              until the Ops team reviews.
            </p>
          </div>
        </div>
      </div>

      <label className="flex items-center gap-3">
        <Toggle checked={enabled} onChange={onEnabledChange} />
        <span className="text-sm font-medium text-ink">
          Run Trip Fit Check for this trip
          <span className="ml-2 text-xs font-normal text-mid">(default ON for Soulful Escapes)</span>
        </span>
      </label>

      {enabled ? (
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Questions customers will see</h3>
            <Link href="/screening" target="_blank">
              <Button variant="ghost" className="gap-1">
                Edit globally <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          {activeCatalog ? (
            <ol className="space-y-4">
              {activeCatalog.questions.map((q, i) => (
                <li key={q.question_id} className="text-sm">
                  <p className="font-medium text-ink">{i + 1}. {q.prompt}</p>
                  {q.kind !== "textarea" && (
                    <ul className="ml-5 mt-1 list-disc text-mid">
                      {q.options.map((o) => (
                        <li key={o.option_id}>{o.label}</li>
                      ))}
                    </ul>
                  )}
                  {q.kind === "textarea" && <p className="ml-5 mt-1 italic text-mid">(long answer)</p>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-mid">
              No published catalog yet. <Link href="/screening" className="text-rust underline">Set up the questions →</Link>
            </p>
          )}
          <p className="mt-3 text-xs text-mid">
            ({activeCatalog?.questions.length ?? 0} questions in total — read-only preview)
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-line bg-surface3 p-5 text-sm text-mid">
          Customers will skip the Fit Check and go straight from Traveller Details to Payment.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add 'app/(cms)/trips/_components/tabs/ScreeningTab.tsx'
git commit -m "feat(trips): ScreeningTab with read-only catalog preview"
```

### Task 9.2: Render ScreeningTab inside TripEditor

**Files:**
- Modify: `app/(cms)/trips/_components/TripEditor.tsx`
- Modify: `app/(cms)/trips/[tripId]/edit/page.tsx`
- Modify: `app/(cms)/trips/new/page.tsx` (if it exists)

- [ ] **Step 1: Load the active catalog server-side**

In `app/(cms)/trips/[tripId]/edit/page.tsx`, add the import:

```ts
import { getActiveCatalog } from "@/lib/db/screening";
```

In the page's async render, alongside other awaits:

```ts
const activeCatalog = await getActiveCatalog();
```

Pass it as a prop: `<TripEditor ... activeCatalog={activeCatalog} />`.

Do the same in `app/(cms)/trips/new/page.tsx`.

- [ ] **Step 2: Add the prop to `TripEditorProps`**

In `TripEditor.tsx`, extend `TripEditorProps`:

```ts
import type { FullCatalogVersion } from "@/lib/db/screening";

interface TripEditorProps {
  // … existing props …
  activeCatalog: FullCatalogVersion | null;
}
```

Destructure it: `({ trip, destinations, ..., activeCatalog }: TripEditorProps)`.

- [ ] **Step 3: Render the tab body when active step is `screening`**

Find the existing per-step rendering switch in `TripEditor.tsx` (look for `currentStep.id === "basic"` or similar). Add a new branch:

```tsx
{steps[stepIndex].id === "screening" && (
  <ScreeningTab
    enabled={form.screening_enabled}
    onEnabledChange={(v) => setForm({ ...form, screening_enabled: v })}
    activeCatalog={activeCatalog}
  />
)}
```

Add the import: `import { ScreeningTab } from "./tabs/ScreeningTab";`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add 'app/(cms)/trips/_components/TripEditor.tsx' 'app/(cms)/trips/[tripId]/edit/page.tsx' 'app/(cms)/trips/new/page.tsx'
git commit -m "feat(trips): render ScreeningTab in wizard"
```

### Task 9.3: Server: persist `screening_enabled`

**Files:**
- Modify: `app/(cms)/trips/actions.ts`
- Modify: `lib/db/trips.ts`

- [ ] **Step 1: Find `updateTrip` in `lib/db/trips.ts`**

It's an existing function that takes a patch. Locate the patch type.

- [ ] **Step 2: Add `screening_enabled?: boolean` to the patch type**

In the patch parameter type (likely `Partial<DbTrip>` or a custom interface), ensure `screening_enabled?: boolean` is accepted. If the function already does `db.from("trips").update(patch)`, no further code change is needed — only the type.

- [ ] **Step 3: Extend `updateTripAction` in `app/(cms)/trips/actions.ts`**

Find where `parsed.data` from `tripBasicSchema` is mapped to the DB update. After the existing field assignments, add:

```ts
// Force-off when trip_type is not Community (defense-in-depth — the UI also enforces this).
const screeningEnabled = parsed.data.trip_type === "Community"
  ? (parsed.data.screening_enabled ?? false)
  : false;
```

Then include `screening_enabled: screeningEnabled` in the `updateTrip(id, { ... })` call.

Do the same in `createTripAction`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add 'app/(cms)/trips/actions.ts' lib/db/trips.ts
git commit -m "feat(trips): persist screening_enabled with Community guard"
```

---

## Phase 10 — Trip wizard: `VariantsTab`

### Task 10.1: Variant server actions

**Files:**
- Modify: `app/(cms)/trips/actions.ts`

- [ ] **Step 1: Add imports**

At the top of `actions.ts`:

```ts
import {
  upsertVariantAxis,
  deleteVariantAxis,
  upsertVariantOption,
  deleteVariantOption,
  reorderVariantOptions,
  getVariantAxesForGroup,
} from "@/lib/db/trip-variants";
import {
  variantAxisInputSchema,
  variantOptionInputSchema,
  type VariantAxisInput,
  type VariantOptionInput,
} from "@/lib/schemas/trip-variants";
```

- [ ] **Step 2: Append the action implementations**

```ts
export async function upsertVariantAxisAction(
  groupSlug: string,
  tripSlug: string,
  rawInput: unknown,
): Promise<{ ok: true; axisId: string } | { ok: false; error: string }> {
  const parsed = variantAxisInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  try {
    const axisId = await upsertVariantAxis(groupSlug, parsed.data);
    await revalidateTrip(tripSlug);
    logActivityAsync({
      table_name: "trip_variant_axes",
      record_id: axisId,
      action: parsed.data.variant_axis_id ? "UPDATE" : "INSERT",
      new_values: { axis_label: parsed.data.axis_label, group_slug: groupSlug },
    });
    return { ok: true, axisId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteVariantAxisAction(
  axisId: string,
  tripSlug: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await deleteVariantAxis(axisId);
    await revalidateTrip(tripSlug);
    logActivityAsync({
      table_name: "trip_variant_axes",
      record_id: axisId,
      action: "DELETE",
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function upsertVariantOptionAction(
  axisId: string,
  tripSlug: string,
  rawInput: unknown,
): Promise<{ ok: true; optionId: string } | { ok: false; error: string }> {
  const parsed = variantOptionInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  try {
    const optionId = await upsertVariantOption({ ...parsed.data, variant_axis_id: axisId });
    await revalidateTrip(tripSlug);
    logActivityAsync({
      table_name: "trip_variant_options",
      record_id: optionId,
      action: parsed.data.variant_option_id ? "UPDATE" : "INSERT",
      new_values: { option_label: parsed.data.option_label, price_per_pax: parsed.data.price_per_pax },
    });
    return { ok: true, optionId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteVariantOptionAction(
  optionId: string,
  tripSlug: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await deleteVariantOption(optionId);
    await revalidateTrip(tripSlug);
    logActivityAsync({
      table_name: "trip_variant_options",
      record_id: optionId,
      action: "DELETE",
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function reorderVariantOptionsAction(
  axisId: string,
  tripSlug: string,
  orderedIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await reorderVariantOptions(axisId, orderedIds);
    await revalidateTrip(tripSlug);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function refreshVariantAxesAction(groupSlug: string) {
  return getVariantAxesForGroup(groupSlug);
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc --noEmit
git add 'app/(cms)/trips/actions.ts'
git commit -m "feat(trips): variant server actions"
```

### Task 10.2: `AddVariantAxisModal`

**Files:**
- Create: `app/(cms)/trips/_components/tabs/AddVariantAxisModal.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client";

import { useState } from "react";
import { FormModal } from "@/components/ui/FormModal";
import { Button } from "@/components/ui/Button";
import { FilterPills } from "@/components/ui/FilterPills";

export interface AxisPresetResult {
  axis_label: string;
  axis_description: string;
  starter_options: Array<{ label: string; price: number }>;
}

const PRESETS: Record<string, AxisPresetResult> = {
  room_sharing: {
    axis_label: "Room sharing",
    axis_description: "Pick how you'd like to share your room",
    starter_options: [
      { label: "Double sharing", price: 0 },
      { label: "Triple sharing", price: 0 },
    ],
  },
  travel_mode: {
    axis_label: "Travel mode",
    axis_description: "Choose how you'd like to travel",
    starter_options: [
      { label: "Tempo traveller", price: 0 },
      { label: "Self drive", price: 0 },
    ],
  },
  departure_city: {
    axis_label: "Departure city",
    axis_description: "Where will you start your journey from?",
    starter_options: [
      { label: "Delhi", price: 0 },
      { label: "Mumbai", price: 0 },
    ],
  },
  trek_difficulty: {
    axis_label: "Trek difficulty",
    axis_description: "Pick your preferred difficulty level",
    starter_options: [
      { label: "Moderate", price: 0 },
      { label: "Challenging", price: 0 },
    ],
  },
};

interface AddVariantAxisModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (preset: AxisPresetResult | { custom: true; axis_label: string }) => void;
}

export function AddVariantAxisModal({ open, onClose, onAdd }: AddVariantAxisModalProps) {
  const [selected, setSelected] = useState("room_sharing");
  const [customLabel, setCustomLabel] = useState("");

  const handleAdd = () => {
    if (selected === "custom") {
      const trimmed = customLabel.trim();
      if (!trimmed) return;
      onAdd({ custom: true, axis_label: trimmed });
    } else {
      onAdd(PRESETS[selected]);
    }
    setSelected("room_sharing");
    setCustomLabel("");
    onClose();
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Add a price choice"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAdd}>Add</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-mid">What kind of choice?</p>
        <FilterPills
          options={[
            { value: "room_sharing", label: "Room sharing" },
            { value: "travel_mode", label: "Travel mode" },
            { value: "departure_city", label: "Departure city" },
            { value: "trek_difficulty", label: "Trek difficulty" },
            { value: "custom", label: "Custom…" },
          ]}
          value={selected}
          onChange={setSelected}
        />
        {selected === "custom" && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-mid">Label</label>
            <input
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="e.g. Add-on activity"
              maxLength={60}
              className="w-full rounded-lg border border-line bg-surface3 px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>
    </FormModal>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add 'app/(cms)/trips/_components/tabs/AddVariantAxisModal.tsx'
git commit -m "feat(trips): AddVariantAxisModal with preset picker"
```

### Task 10.3: `VariantsTab`

**Files:**
- Create: `app/(cms)/trips/_components/tabs/VariantsTab.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, Info, Trash2, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { NumericInput } from "@/components/ui/NumericInput";
import { Toggle } from "@/components/ui/Toggle";
import { Badge } from "@/components/ui/Badge";
import { AddVariantAxisModal, type AxisPresetResult } from "./AddVariantAxisModal";
import {
  upsertVariantAxisAction,
  deleteVariantAxisAction,
  upsertVariantOptionAction,
  deleteVariantOptionAction,
  refreshVariantAxesAction,
} from "../../actions";
import type { FullVariantAxis } from "@/lib/db/trip-variants";

interface VariantsTabProps {
  groupSlug: string | null;
  tripSlug: string;
  initialAxes: FullVariantAxis[];
  onGotoBasic: () => void;
}

export function VariantsTab({ groupSlug, tripSlug, initialAxes, onGotoBasic }: VariantsTabProps) {
  const [axes, setAxes] = useState<FullVariantAxis[]>(initialAxes);
  const [addOpen, setAddOpen] = useState(false);
  const [deletingAxisId, setDeletingAxisId] = useState<string | null>(null);
  const [deletingOptionId, setDeletingOptionId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!groupSlug) {
    return (
      <EmptyState
        icon="⚠"
        title="No trip group set"
        description="Price options are shared across all batches of a trip group. Set a Trip Group on the Basic tab to add price choices."
        action={<Button onClick={onGotoBasic}>Set trip group →</Button>}
      />
    );
  }

  const refresh = async () => {
    const updated = await refreshVariantAxesAction(groupSlug);
    setAxes(updated);
  };

  const handleAdd = async (preset: AxisPresetResult | { custom: true; axis_label: string }) => {
    const axisInput =
      "custom" in preset
        ? { axis_label: preset.axis_label, axis_description: null, is_required: true }
        : { axis_label: preset.axis_label, axis_description: preset.axis_description, is_required: true };
    const res = await upsertVariantAxisAction(groupSlug, tripSlug, axisInput);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (!("custom" in preset)) {
      // Create starter options
      for (const opt of preset.starter_options) {
        await upsertVariantOptionAction(res.axisId, tripSlug, {
          option_label: opt.label,
          option_sublabel: null,
          price_per_pax: opt.price,
          is_active: true,
        });
      }
    }
    await refresh();
    toast.success("Price choice added");
  };

  const handleUpdateOption = async (
    axisId: string,
    optionId: string | undefined,
    patch: Partial<{ option_label: string; price_per_pax: number; is_active: boolean }>,
  ) => {
    const axis = axes.find((a) => a.variant_axis_id === axisId);
    const opt = axis?.options.find((o) => o.variant_option_id === optionId);
    if (!opt) return;
    const res = await upsertVariantOptionAction(axisId, tripSlug, {
      variant_option_id: opt.variant_option_id,
      option_label: patch.option_label ?? opt.option_label,
      option_sublabel: opt.option_sublabel,
      price_per_pax: patch.price_per_pax ?? opt.price_per_pax,
      is_active: patch.is_active ?? opt.is_active,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    await refresh();
  };

  const handleAddOption = async (axisId: string) => {
    const res = await upsertVariantOptionAction(axisId, tripSlug, {
      option_label: "New option",
      option_sublabel: null,
      price_per_pax: 0,
      is_active: true,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    await refresh();
  };

  const handleDeleteAxis = async () => {
    if (!deletingAxisId) return;
    const res = await deleteVariantAxisAction(deletingAxisId, tripSlug);
    if (!res.ok) toast.error(res.error);
    setDeletingAxisId(null);
    await refresh();
  };

  const handleDeleteOption = async () => {
    if (!deletingOptionId) return;
    const res = await deleteVariantOptionAction(deletingOptionId, tripSlug);
    if (!res.ok) toast.error(res.error);
    setDeletingOptionId(null);
    await refresh();
  };

  if (axes.length === 0) {
    return (
      <>
        <EmptyState
          icon="🎟"
          title="This trip has one fixed price per person"
          description="Add a price choice if customers should pick between options at booking — like room sharing or travel mode."
          action={<Button onClick={() => setAddOpen(true)}>+ Add a price choice</Button>}
        />
        <AddVariantAxisModal open={addOpen} onClose={() => setAddOpen(false)} onAdd={(p) => void handleAdd(p)} />
      </>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Trip Variants</h3>
        <Button onClick={() => setAddOpen(true)}>+ Add price choice</Button>
      </div>

      {axes.map((axis) => {
        const activeCount = axis.options.filter((o) => o.is_active).length;
        return (
          <div key={axis.variant_axis_id} className="rounded-xl border border-line bg-surface p-5">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h4 className="text-sm font-semibold text-ink">{axis.axis_label}</h4>
                {axis.axis_description && (
                  <p className="mt-1 text-xs text-mid">{axis.axis_description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDeletingAxisId(axis.variant_axis_id)}
                className="rounded p-1 text-mid hover:bg-surface3"
                aria-label="Delete axis"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-3 flex items-start gap-2 rounded-lg bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
              Price options apply to all batches in this group — not just this batch.
            </div>

            <div className="space-y-2">
              {axis.options.map((opt) => (
                <div key={opt.variant_option_id} className="flex items-center gap-3 rounded-lg border border-line bg-surface3 p-3">
                  <input
                    type="text"
                    value={opt.option_label}
                    onChange={(e) =>
                      setAxes((prev) =>
                        prev.map((a) =>
                          a.variant_axis_id === axis.variant_axis_id
                            ? {
                                ...a,
                                options: a.options.map((o) =>
                                  o.variant_option_id === opt.variant_option_id
                                    ? { ...o, option_label: e.target.value }
                                    : o,
                                ),
                              }
                            : a,
                        ),
                      )
                    }
                    onBlur={(e) =>
                      void handleUpdateOption(axis.variant_axis_id, opt.variant_option_id, {
                        option_label: e.target.value,
                      })
                    }
                    className="flex-1 rounded border border-line bg-surface px-2 py-1 text-sm"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-mid">₹</span>
                    <NumericInput
                      value={opt.price_per_pax}
                      onChange={(v) =>
                        void handleUpdateOption(axis.variant_axis_id, opt.variant_option_id, {
                          price_per_pax: Math.max(0, v ?? 0),
                        })
                      }
                      min={0}
                      max={1_000_000}
                      className="w-28"
                      showSteppers={false}
                    />
                  </div>
                  <label className="flex items-center gap-1">
                    <Toggle
                      checked={opt.is_active}
                      onChange={(v) =>
                        void handleUpdateOption(axis.variant_axis_id, opt.variant_option_id, {
                          is_active: v,
                        })
                      }
                    />
                    <span className="text-xs text-mid">Show</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setDeletingOptionId(opt.variant_option_id)}
                    className="rounded p-1 text-mid hover:bg-line"
                    aria-label="Delete option"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <Button variant="ghost" onClick={() => void handleAddOption(axis.variant_axis_id)} className="mt-3">
              + Add option
            </Button>

            {activeCount < 2 && (
              <p className="mt-3 text-xs text-red-600">
                Add at least one more option, or remove this whole price choice.
              </p>
            )}

            <p className="mt-3 text-xs text-mid">
              <Info className="mr-1 inline h-3 w-3" />
              Customers already in the funnel keep the price they were quoted.
            </p>
          </div>
        );
      })}

      <AddVariantAxisModal open={addOpen} onClose={() => setAddOpen(false)} onAdd={(p) => void handleAdd(p)} />

      <ConfirmDialog
        open={deletingAxisId !== null}
        title="Delete this price choice?"
        message="Customers booking after now won't see it. (Bookings already placed are not affected.)"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void handleDeleteAxis()}
        onCancel={() => setDeletingAxisId(null)}
      />
      <ConfirmDialog
        open={deletingOptionId !== null}
        title="Remove this option?"
        message="Customers booking after now won't see it."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void handleDeleteOption()}
        onCancel={() => setDeletingOptionId(null)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add 'app/(cms)/trips/_components/tabs/VariantsTab.tsx'
git commit -m "feat(trips): VariantsTab with axis/option CRUD"
```

### Task 10.4: Render VariantsTab inside TripEditor

**Files:**
- Modify: `app/(cms)/trips/_components/TripEditor.tsx`
- Modify: `app/(cms)/trips/[tripId]/edit/page.tsx`
- Modify: `app/(cms)/trips/new/page.tsx`

- [ ] **Step 1: Load axes server-side in the edit page**

In `app/(cms)/trips/[tripId]/edit/page.tsx`:

```ts
import { getVariantAxesForGroup } from "@/lib/db/trip-variants";

// Inside the async page render:
const initialVariantAxes = trip.group_slug ? await getVariantAxesForGroup(trip.group_slug) : [];
```

Pass it: `<TripEditor ... initialVariantAxes={initialVariantAxes} />`.

In `app/(cms)/trips/new/page.tsx`, pass `initialVariantAxes={[]}` (new trips don't have variants yet).

- [ ] **Step 2: Add the prop to `TripEditorProps`**

```ts
import type { FullVariantAxis } from "@/lib/db/trip-variants";

interface TripEditorProps {
  // … existing …
  activeCatalog: FullCatalogVersion | null;
  initialVariantAxes: FullVariantAxis[];
}
```

Destructure: `({ ..., activeCatalog, initialVariantAxes }: TripEditorProps)`.

- [ ] **Step 3: Render the tab body**

In the per-step rendering switch:

```tsx
{steps[stepIndex].id === "variants" && (
  <VariantsTab
    groupSlug={form.group_slug}
    tripSlug={form.slug}
    initialAxes={initialVariantAxes}
    onGotoBasic={() => setStepIndex(steps.findIndex((s) => s.id === "basic"))}
  />
)}
```

Add the import: `import { VariantsTab } from "./tabs/VariantsTab";`.

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc --noEmit
git add 'app/(cms)/trips/_components/TripEditor.tsx' 'app/(cms)/trips/[tripId]/edit/page.tsx' 'app/(cms)/trips/new/page.tsx'
git commit -m "feat(trips): render VariantsTab in wizard"
```

### Task 10.5: Trip-publish guard (≥2 active options per axis)

**Files:**
- Modify: `app/(cms)/trips/actions.ts`

- [ ] **Step 1: In `updateTripAction`, before the DB save, add the guard**

Inside `updateTripAction`, after `parsed.success` check, locate where status is read from `payload.settings.status`. Add:

```ts
const currentTrip = await getTripById(id);
const isPromoting =
  currentTrip &&
  currentTrip.status === "Draft" &&
  ["Upcoming", "Ongoing"].includes(payload.settings.status);
if (isPromoting && currentTrip.group_slug) {
  const axes = await getVariantAxesForGroup(currentTrip.group_slug);
  for (const axis of axes) {
    const activeCount = axis.options.filter((o) => o.is_active).length;
    if (activeCount < 2) {
      return {
        success: false,
        error: `Variant axis "${axis.axis_label}" needs at least 2 active options before publish.`,
      };
    }
  }
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add 'app/(cms)/trips/actions.ts'
git commit -m "feat(trips): publish guard for variant active-option count"
```

---

## Phase 11 — Final checks + manual R8

### Task 11.1: Run the full test suite

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: passes. Fix any new warnings.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: passes.

- [ ] **Step 3: Tests**

Run: `npm run test`
Expected: all green.

- [ ] **Step 4: Commit any incidental fixes**

```bash
git status
# If anything changed, commit it with an appropriate message
```

### Task 11.2: Manual R8 walkthrough

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Walk through `/screening`**

Open `http://localhost:3001/screening`:
1. Confirm the page loads showing the current (active) catalog as an editable draft.
2. Edit a question prompt — status pill flips Saving → Saved.
3. Reload — your edit persists.
4. Open the website's `/book/<community-trip-slug>/screening` route and confirm OLD questions still rendered.
5. Click *Publish to website* → confirm dialog shows trip count → confirm.
6. Reload the website screening route → NEW questions appear.
7. Back in `/screening`, reload — a fresh editable draft is created.

- [ ] **Step 3: Walk through trip wizard Screening tab**

1. Open a Community trip → Fit Check tab is visible, toggle is ON by default for new trips.
2. Toggle OFF → save trip → confirm DB shows `screening_enabled=false`.
3. Switch the trip's type to Signature Journey → Fit Check tab disappears. Save → DB shows `screening_enabled=false`.

- [ ] **Step 4: Walk through trip wizard Variants tab**

1. Open a trip with no `group_slug` → "No trip group set" empty state with CTA → click it, focus jumps to Basic tab's group_slug field.
2. Set a group_slug → Variants tab now shows the "one fixed price" empty state.
3. Click *+ Add a price choice* → modal → pick *Room sharing* → axis created with Double + Triple at ₹0.
4. Edit Double price to 45000 → toast confirms. Reload page — value persists.
5. Open another trip in the same group → the Variants tab shows the same axis with the same prices.
6. Set is_active=false on Triple, save. Try to publish trip (Draft → Upcoming) — fails with `"Variant axis "Room sharing" needs at least 2 active options before publish."`.
7. Re-enable Triple → publish succeeds.

- [ ] **Step 5: Stop the dev server.**

### Task 11.3: Open pull request

- [ ] **Step 1: Push branch**

```bash
git push -u origin feat/cms-screening-and-variants
```

- [ ] **Step 2: Create PR**

```bash
gh pr create --title "feat(cms): screening + trip variants UI" --body "$(cat <<'EOF'
## Summary
- `/screening` catalog editor (draft autosaved, publish via RPC, versions hidden from UI)
- Trip wizard `ScreeningTab` (Community-only, default ON, read-only catalog preview)
- Trip wizard `VariantsTab` (always visible, axis + option CRUD with preset picker)

## Specs
- `docs/superpowers/specs/2026-05-18-cms-screening-variants-layman-design.md`
- `docs/superpowers/specs/2026-05-18-cms-screening-and-variants-design.md`

## Test plan
- [ ] /screening edit → autosave → publish → website picks up new questions
- [ ] Community trip: Fit Check tab visible, default ON, save persists
- [ ] Non-Community trip: Fit Check tab absent, screening_enabled forced false
- [ ] Variants empty state shows for trips with group_slug
- [ ] No group_slug shows the "set trip group" empty state
- [ ] Add Room Sharing preset → starter options created
- [ ] Publish guard rejects Draft→Upcoming when an axis has <2 active options
- [ ] Snapshot isolation: existing bookings keep their quoted price

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Spec-to-task coverage check

| Spec requirement                                              | Task(s)                       |
|---------------------------------------------------------------|-------------------------------|
| §3 Community-only gating                                      | 8.3 (filter steps), 9.3 (force-off server) |
| §4 ScreeningTab (toggle + preview)                            | 9.1, 9.2                      |
| §5 VariantsTab (empty state, preset modal, axis CRUD)         | 10.2, 10.3, 10.4              |
| §5.3 No-group-slug state                                      | 10.3 (in `VariantsTab`)       |
| §5.8 Soft + hard validation, publish guard                    | 10.3 (UI helpers), 10.5 (server) |
| §6 /screening editor with draft auto-clone + publish          | 6.1, 7.1–7.6                  |
| §6.10 Publish confirm with trip count                         | 7.5 (`ConfirmDialog`)         |
| §6.11 saveDraftAction / publishCatalogAction                  | 6.1                           |
| §7 Layman conventions: toggles, presets, no raw IDs, autosave | enforced throughout 7.x + 10.x|
| Sidebar + page title                                          | 7.7                           |
| `revalidateScreeningCatalog`                                  | 3.1                           |
| `screening_enabled` schema field                              | 2.3                           |
| Trip publish guard                                            | 10.5                          |
| Activity logging on all mutations                             | 6.1, 10.1                     |

No spec requirement is uncovered. The flagged-review queue (companion §7) is intentionally excluded per the layman design's §2 (owned by Ops tool).
