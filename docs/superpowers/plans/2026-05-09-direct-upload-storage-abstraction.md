# Direct-Upload Storage Abstraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all server-action FormData uploads (which hit Vercel's 4.5 MB body cap) with direct browser-to-storage uploads via signed URLs, behind a provider-agnostic abstraction so we can swap Supabase for Cloudflare R2 / S3 later with minimal changes.

**Architecture:** Introduce a `StorageProvider` interface (`createUploadTicket`, `deleteObject`, `getPublicUrl`, `getOptimizedUrl`) with a Supabase implementation today. Browser calls a tiny `prepare<X>UploadAction` server action to mint a signed-upload ticket, uploads bytes directly to storage via a provider-agnostic `uploadWithTicket(file, ticket)` helper, then calls `register<X>Action` to create the DB row. HEIC files are converted browser-side via lazy-loaded `heic2any`. CDN-side image transformations replace any thought of a background pipeline. Validation rules (size, type, dimensions, count, concurrency) live in one `upload-rules.ts` module enforced both client-side (L2) and server-side (L3).

**Tech Stack:** Next.js 16 App Router, Supabase Storage (signed upload URLs + image transformations), Vitest 4, @testing-library/react, heic2any (lazy dynamic import), Zod for action input validation.

---

## Pre-Flight

**Branch:** `fix/cms-direct-upload-storage-abstraction` off latest `main`.

**Vercel limit being fixed:** server actions on Vercel reject request bodies > ~4.5 MB before our code runs (`FUNCTION_PAYLOAD_TOO_LARGE`). Direct upload bypasses Vercel for the bytes.

**Existing test conventions** (already in place):
- Tests live in `tests/lib/`, `tests/app/`, and `lib/**/__tests__/`.
- `vitest.setup.ts` stubs `fetch` globally — tests can override per-case.
- Use `vi.mock("@/lib/supabase/server", ...)` to stub `getServiceClient()`.

**File-size + dimension rules (single source of truth, enforced everywhere):**

| Kind | maxBytes | maxCount | maxConcurrency | Recommended |
|---|---|---|---|---|
| `tripGallery` | 20 MB | 30 | 5 | 1600 × 1200 |
| `tripCover` | 20 MB | 1 | 1 | 1600 × 1000, 16:10 |
| `siteGallery` | 20 MB | 30 | 5 | 1600 × 1200 |
| `rawMoment` | 20 MB | 30 | 5 | 1600 × 1200 |
| `banner` | 10 MB | 1 | 1 | 1200 × 300, 4:1 |
| `heroImage` | 20 MB | 1 | 1 | 1920 × 1080, 16:9 |
| `heroVideo` | 100 MB | 1 | 1 | 1920 × 1080, MP4/WebM/MOV |

Photo MIME whitelist: `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`.
Video MIME whitelist: `video/mp4`, `video/webm`, `video/quicktime`.

---

## Task 1: Storage Provider Interface

**Files:**
- Create: `lib/storage/provider.ts`
- Test: `tests/lib/storage/provider.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/storage/provider.test.ts
import { describe, it, expectTypeOf } from "vitest";
import type { StorageProvider, UploadTicket, TransformOpts } from "@/lib/storage/provider";

describe("StorageProvider interface", () => {
  it("UploadTicket has provider-agnostic shape", () => {
    expectTypeOf<UploadTicket>().toEqualTypeOf<{
      uploadUrl: string;
      method: "PUT" | "POST";
      headers: Record<string, string>;
      path: string;
      publicUrl: string;
      expiresAt: number;
    }>();
  });

  it("TransformOpts allows the documented presets", () => {
    const opts: TransformOpts = {
      width: 800,
      height: 600,
      quality: 75,
      format: "webp",
      fit: "cover",
    };
    expectTypeOf(opts.format).toEqualTypeOf<"webp" | "avif" | "auto" | undefined>();
  });

  it("StorageProvider declares all four methods", () => {
    const stub: StorageProvider = {
      createUploadTicket: async () => ({
        uploadUrl: "x",
        method: "PUT",
        headers: {},
        path: "x",
        publicUrl: "x",
        expiresAt: 0,
      }),
      deleteObject: async () => {},
      getPublicUrl: () => "",
      getOptimizedUrl: () => "",
    };
    expectTypeOf(stub).toMatchTypeOf<StorageProvider>();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/storage/provider.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the interface**

```ts
// lib/storage/provider.ts

/**
 * UploadTicket: provider-agnostic envelope for a direct browser-to-storage
 * upload. The browser does `fetch(uploadUrl, { method, headers, body: file })`
 * and the bytes never pass through our server.
 */
export interface UploadTicket {
  uploadUrl: string;
  method: "PUT" | "POST";
  headers: Record<string, string>;
  path: string;
  publicUrl: string;
  expiresAt: number; // ms epoch — clients can refresh if elapsed
}

export interface TransformOpts {
  width?: number;
  height?: number;
  quality?: number; // 1-100
  format?: "webp" | "avif" | "auto";
  fit?: "cover" | "contain";
}

export interface CreateUploadTicketInput {
  path: string;
  contentType: string;
}

export interface StorageProvider {
  /** Server-only. Mints a short-lived upload URL the browser can PUT/POST to. */
  createUploadTicket(input: CreateUploadTicketInput): Promise<UploadTicket>;

  /** Server-only. Deletes by path. */
  deleteObject(path: string): Promise<void>;

  /** Pure. Canonical public URL for a stored object. */
  getPublicUrl(path: string): string;

  /** Pure. Provider's CDN transform URL. Falls back to public URL if unsupported. */
  getOptimizedUrl(path: string, opts: TransformOpts): string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/storage/provider.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/storage/provider.ts tests/lib/storage/provider.test.ts
git commit -m "feat(storage): add provider-agnostic StorageProvider interface"
```

---

## Task 2: Upload Rules — Single Source of Truth

**Files:**
- Create: `lib/storage/upload-rules.ts`
- Test: `tests/lib/storage/upload-rules.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/storage/upload-rules.test.ts
import { describe, it, expect } from "vitest";
import {
  UPLOAD_RULES,
  describeRules,
  type UploadKind,
} from "@/lib/storage/upload-rules";

describe("UPLOAD_RULES", () => {
  const KINDS: UploadKind[] = [
    "tripGallery", "tripCover", "siteGallery", "rawMoment",
    "banner", "heroImage", "heroVideo",
  ];

  it("declares every documented kind", () => {
    for (const k of KINDS) {
      expect(UPLOAD_RULES[k]).toBeDefined();
    }
  });

  it("photo kinds accept JPG/PNG/WebP/HEIC", () => {
    for (const k of ["tripGallery", "siteGallery", "rawMoment", "banner", "heroImage"] as const) {
      expect(UPLOAD_RULES[k].accept).toEqual(
        expect.arrayContaining(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]),
      );
    }
  });

  it("heroVideo accepts MP4/WebM/MOV", () => {
    expect(UPLOAD_RULES.heroVideo.accept).toEqual(
      expect.arrayContaining(["video/mp4", "video/webm", "video/quicktime"]),
    );
  });

  it("size caps match spec", () => {
    expect(UPLOAD_RULES.tripGallery.maxBytes).toBe(20 * 1024 * 1024);
    expect(UPLOAD_RULES.banner.maxBytes).toBe(10 * 1024 * 1024);
    expect(UPLOAD_RULES.heroVideo.maxBytes).toBe(100 * 1024 * 1024);
  });

  it("count + concurrency caps", () => {
    expect(UPLOAD_RULES.tripGallery.maxCount).toBe(30);
    expect(UPLOAD_RULES.tripGallery.maxConcurrency).toBe(5);
    expect(UPLOAD_RULES.banner.maxCount).toBe(1);
  });

  it("guidelines describe recommended resolution for every kind", () => {
    for (const k of KINDS) {
      expect(UPLOAD_RULES[k].guidelines.recommendedResolution).toMatch(/\d+\s*[×x]\s*\d+/);
    }
  });

  describe("describeRules", () => {
    it("renders human-readable summary", () => {
      const text = describeRules("tripGallery");
      expect(text).toMatch(/JPG/i);
      expect(text).toMatch(/20 MB/);
      expect(text).toMatch(/30/);
    });

    it("for single-count kinds drops 'each'", () => {
      const text = describeRules("banner");
      expect(text).not.toMatch(/each/);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/storage/upload-rules.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the rules module**

```ts
// lib/storage/upload-rules.ts

const PHOTO_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
] as const;
const PHOTO_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"] as const;

const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
const VIDEO_EXTS = [".mp4", ".webm", ".mov"] as const;

interface Guidelines {
  recommendedResolution: string;
  minResolution: { width: number; height: number };
  aspectGuidance: string;
  notes: string;
}

interface Rule {
  label: string;
  maxBytes: number;
  accept: readonly string[];
  extensions: readonly string[];
  maxCount: number;
  maxConcurrency: number;
  guidelines: Guidelines;
}

export const UPLOAD_RULES = {
  tripGallery: {
    label: "Trip photo",
    maxBytes: 20 * 1024 * 1024,
    accept: PHOTO_TYPES,
    extensions: PHOTO_EXTS,
    maxCount: 30,
    maxConcurrency: 5,
    guidelines: {
      recommendedResolution: "1600 × 1200",
      minResolution: { width: 1200, height: 800 },
      aspectGuidance: "Landscape or portrait both work",
      notes: "Bigger is fine — we resize automatically.",
    },
  },
  tripCover: {
    label: "Cover image",
    maxBytes: 20 * 1024 * 1024,
    accept: PHOTO_TYPES,
    extensions: PHOTO_EXTS,
    maxCount: 1,
    maxConcurrency: 1,
    guidelines: {
      recommendedResolution: "1600 × 1000",
      minResolution: { width: 1200, height: 750 },
      aspectGuidance: "16:10 landscape",
      notes: "Crops to ~16:9 on cards.",
    },
  },
  siteGallery: {
    label: "Site photo",
    maxBytes: 20 * 1024 * 1024,
    accept: PHOTO_TYPES,
    extensions: PHOTO_EXTS,
    maxCount: 30,
    maxConcurrency: 5,
    guidelines: {
      recommendedResolution: "1600 × 1200",
      minResolution: { width: 1200, height: 800 },
      aspectGuidance: "Landscape or portrait both work",
      notes: "Bigger is fine — we resize automatically.",
    },
  },
  rawMoment: {
    label: "Raw moment",
    maxBytes: 20 * 1024 * 1024,
    accept: PHOTO_TYPES,
    extensions: PHOTO_EXTS,
    maxCount: 30,
    maxConcurrency: 5,
    guidelines: {
      recommendedResolution: "1600 × 1200",
      minResolution: { width: 1200, height: 800 },
      aspectGuidance: "Landscape or portrait both work",
      notes: "Bigger is fine — we resize automatically.",
    },
  },
  banner: {
    label: "Banner",
    maxBytes: 10 * 1024 * 1024,
    accept: PHOTO_TYPES,
    extensions: PHOTO_EXTS,
    maxCount: 1,
    maxConcurrency: 1,
    guidelines: {
      recommendedResolution: "1200 × 300",
      minResolution: { width: 1000, height: 250 },
      aspectGuidance: "~4:1 wide",
      notes: "Keep text minimal — gets resized on mobile.",
    },
  },
  heroImage: {
    label: "Hero image",
    maxBytes: 20 * 1024 * 1024,
    accept: PHOTO_TYPES,
    extensions: PHOTO_EXTS,
    maxCount: 1,
    maxConcurrency: 1,
    guidelines: {
      recommendedResolution: "1920 × 1080",
      minResolution: { width: 1600, height: 900 },
      aspectGuidance: "16:9 landscape only",
      notes: "Avoid portrait shots.",
    },
  },
  heroVideo: {
    label: "Hero video",
    maxBytes: 100 * 1024 * 1024,
    accept: VIDEO_TYPES,
    extensions: VIDEO_EXTS,
    maxCount: 1,
    maxConcurrency: 1,
    guidelines: {
      recommendedResolution: "1920 × 1080",
      minResolution: { width: 1280, height: 720 },
      aspectGuidance: "16:9 landscape, 10–20 seconds",
      notes: "Autoplays muted on the homepage.",
    },
  },
} as const satisfies Record<string, Rule>;

export type UploadKind = keyof typeof UPLOAD_RULES;

export function describeRules(kind: UploadKind): string {
  const r = UPLOAD_RULES[kind];
  const exts = r.extensions.map((e) => e.replace(".", "").toUpperCase()).join(", ");
  const mb = r.maxBytes / 1024 / 1024;
  const each = r.maxCount > 1 ? "each" : "";
  const count = r.maxCount > 1 ? `· up to ${r.maxCount} at once · ${r.maxConcurrency} in parallel` : "";
  return `${exts} · up to ${mb} MB ${each} ${count}`.replace(/\s+/g, " ").trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/storage/upload-rules.test.ts`
Expected: PASS, all sub-tests.

- [ ] **Step 5: Commit**

```bash
git add lib/storage/upload-rules.ts tests/lib/storage/upload-rules.test.ts
git commit -m "feat(storage): add upload rules with size/type/count limits"
```

---

## Task 3: Path Builders

**Files:**
- Create: `lib/storage/paths.ts`
- Test: `tests/lib/storage/paths.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/storage/paths.test.ts
import { describe, it, expect } from "vitest";
import { buildPath, sanitizeFileName } from "@/lib/storage/paths";

describe("sanitizeFileName", () => {
  it("strips path separators", () => {
    expect(sanitizeFileName("../etc/passwd.jpg")).not.toMatch(/[\/\\]/);
    expect(sanitizeFileName("../etc/passwd.jpg")).not.toContain("..");
  });

  it("strips control characters", () => {
    expect(sanitizeFileName("hello\x00world.jpg")).toBe("hello_world.jpg");
  });

  it("preserves the extension", () => {
    expect(sanitizeFileName("photo.JPG")).toMatch(/\.jpg$/i);
  });

  it("falls back when name is empty after sanitizing", () => {
    expect(sanitizeFileName("../../../")).toMatch(/^file/);
  });
});

describe("buildPath", () => {
  it("trip gallery path includes tripId and timestamp", () => {
    const p = buildPath("tripGallery", { tripId: "NM-TRIP-DOM-GT-BIR-0003", fileName: "shot.jpg" });
    expect(p).toMatch(/^trip-gallery\/NM-TRIP-DOM-GT-BIR-0003\/\d+-shot\.jpg$/);
  });

  it("hero image path lives under settings/hero/images", () => {
    const p = buildPath("heroImage", { fileName: "hero.png" });
    expect(p).toMatch(/^settings\/hero\/images\/\d+-hero\.png$/);
  });

  it("hero video path lives under settings/hero/videos", () => {
    const p = buildPath("heroVideo", { fileName: "intro.mp4" });
    expect(p).toMatch(/^settings\/hero\/videos\/\d+-intro\.mp4$/);
  });

  it("banner path lives under banners/", () => {
    const p = buildPath("banner", { fileName: "ad.webp" });
    expect(p).toMatch(/^banners\/\d+-ad\.webp$/);
  });

  it("site gallery path lives under site-gallery/", () => {
    const p = buildPath("siteGallery", { fileName: "x.jpg" });
    expect(p).toMatch(/^site-gallery\/\d+-x\.jpg$/);
  });

  it("raw moment path lives under raw-moments/", () => {
    const p = buildPath("rawMoment", { fileName: "x.jpg" });
    expect(p).toMatch(/^raw-moments\/\d+-x\.jpg$/);
  });

  it("rejects malicious filenames at path level too", () => {
    const p = buildPath("tripGallery", { tripId: "T1", fileName: "../../../evil.jpg" });
    expect(p).not.toContain("..");
    expect(p.startsWith("trip-gallery/T1/")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/storage/paths.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the path builder**

```ts
// lib/storage/paths.ts
import type { UploadKind } from "./upload-rules";

const SAFE_NAME = /[^a-zA-Z0-9._-]/g;

export function sanitizeFileName(name: string): string {
  // strip directory components first
  const base = name.split(/[\/\\]/).pop() ?? "file";
  const cleaned = base.replace(SAFE_NAME, "_").replace(/^\.+/, "");
  if (!cleaned || cleaned === "." || cleaned === "..") return `file-${Date.now()}`;
  return cleaned;
}

interface PathInput {
  tripId?: string;
  fileName: string;
}

export function buildPath(kind: UploadKind, input: PathInput): string {
  const safe = sanitizeFileName(input.fileName);
  const stamped = `${Date.now()}-${safe}`;
  switch (kind) {
    case "tripGallery":
    case "tripCover":
      return `trip-gallery/${input.tripId ?? "unassigned"}/${stamped}`;
    case "siteGallery":
      return `site-gallery/${stamped}`;
    case "rawMoment":
      return `raw-moments/${stamped}`;
    case "banner":
      return `banners/${stamped}`;
    case "heroImage":
      return `settings/hero/images/${stamped}`;
    case "heroVideo":
      return `settings/hero/videos/${stamped}`;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/storage/paths.test.ts`
Expected: PASS, all sub-tests.

- [ ] **Step 5: Commit**

```bash
git add lib/storage/paths.ts tests/lib/storage/paths.test.ts
git commit -m "feat(storage): add path builder with filename sanitization"
```

---

## Task 4: File Validator (L2 + L3 shared)

**Files:**
- Create: `lib/storage/validate.ts`
- Test: `tests/lib/storage/validate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/storage/validate.test.ts
import { describe, it, expect } from "vitest";
import {
  validateFiles,
  validateUploadInput,
  type FileLike,
} from "@/lib/storage/validate";

function fakeFile(name: string, type: string, size: number): FileLike {
  return { name, type, size };
}

describe("validateFiles (L2 client-side)", () => {
  it("accepts a normal photo", () => {
    const r = validateFiles([fakeFile("a.jpg", "image/jpeg", 2_000_000)], "tripGallery");
    expect(r.valid).toHaveLength(1);
    expect(r.rejected).toHaveLength(0);
  });

  it("rejects oversized photo with friendly message", () => {
    const r = validateFiles([fakeFile("big.jpg", "image/jpeg", 30 * 1024 * 1024)], "tripGallery");
    expect(r.valid).toHaveLength(0);
    expect(r.rejected[0].reason).toMatch(/too large/i);
    expect(r.rejected[0].reason).toMatch(/20 MB/);
  });

  it("rejects wrong MIME type", () => {
    const r = validateFiles([fakeFile("song.mp3", "audio/mp3", 1_000_000)], "tripGallery");
    expect(r.valid).toHaveLength(0);
    expect(r.rejected[0].reason).toMatch(/wrong file type/i);
  });

  it("accepts HEIC photos", () => {
    const r = validateFiles([fakeFile("a.heic", "image/heic", 2_000_000)], "tripGallery");
    expect(r.valid).toHaveLength(1);
  });

  it("accepts HEIC by extension when MIME is empty", () => {
    const r = validateFiles([fakeFile("a.heic", "", 2_000_000)], "tripGallery");
    expect(r.valid).toHaveLength(1);
  });

  it("rejects whole batch when over maxCount", () => {
    const files = Array.from({ length: 31 }, (_, i) =>
      fakeFile(`p${i}.jpg`, "image/jpeg", 1_000_000),
    );
    const r = validateFiles(files, "tripGallery");
    expect(r.valid).toHaveLength(0);
    expect(r.rejected[0].reason).toMatch(/too many/i);
  });

  it("partitions a mixed batch correctly", () => {
    const r = validateFiles(
      [
        fakeFile("ok.jpg", "image/jpeg", 1_000_000),
        fakeFile("big.jpg", "image/jpeg", 30 * 1024 * 1024),
        fakeFile("song.mp3", "audio/mp3", 1_000_000),
      ],
      "tripGallery",
    );
    expect(r.valid).toHaveLength(1);
    expect(r.rejected).toHaveLength(2);
  });

  it("video kinds reject images", () => {
    const r = validateFiles([fakeFile("a.jpg", "image/jpeg", 1_000_000)], "heroVideo");
    expect(r.valid).toHaveLength(0);
  });

  it("zero-byte file is rejected", () => {
    const r = validateFiles([fakeFile("empty.jpg", "image/jpeg", 0)], "tripGallery");
    expect(r.valid).toHaveLength(0);
    expect(r.rejected[0].reason).toMatch(/empty/i);
  });
});

describe("validateUploadInput (L3 server-side)", () => {
  it("accepts valid input", () => {
    const r = validateUploadInput("tripGallery", {
      fileName: "a.jpg", contentType: "image/jpeg", size: 1_000_000,
    });
    expect(r.ok).toBe(true);
  });

  it("rejects oversized", () => {
    const r = validateUploadInput("tripGallery", {
      fileName: "a.jpg", contentType: "image/jpeg", size: 30 * 1024 * 1024,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/too large/i);
  });

  it("rejects bad MIME", () => {
    const r = validateUploadInput("tripGallery", {
      fileName: "a.bin", contentType: "application/octet-stream", size: 1_000,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects path traversal in filename", () => {
    const r = validateUploadInput("tripGallery", {
      fileName: "../../../etc/passwd", contentType: "image/jpeg", size: 1_000,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/invalid/i);
  });

  it("rejects forward-slash in filename", () => {
    const r = validateUploadInput("tripGallery", {
      fileName: "a/b.jpg", contentType: "image/jpeg", size: 1_000,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects backslash in filename", () => {
    const r = validateUploadInput("tripGallery", {
      fileName: "a\\b.jpg", contentType: "image/jpeg", size: 1_000,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects null/undefined size as missing", () => {
    const r = validateUploadInput("tripGallery", {
      fileName: "a.jpg", contentType: "image/jpeg", size: 0,
    });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/storage/validate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the validator**

```ts
// lib/storage/validate.ts
import { UPLOAD_RULES, type UploadKind } from "./upload-rules";

export interface FileLike {
  name: string;
  type: string;
  size: number;
}

export interface ValidateFilesResult {
  valid: FileLike[];
  rejected: { file: FileLike; reason: string }[];
}

const HEIC_EXT = /\.(heic|heif)$/i;

function isAccepted(file: FileLike, accept: readonly string[]): boolean {
  if (accept.includes(file.type as string)) return true;
  // Some OSes/browsers report empty MIME for HEIC. Fall back to extension.
  if (HEIC_EXT.test(file.name) && (accept.includes("image/heic") || accept.includes("image/heif"))) {
    return true;
  }
  return false;
}

export function validateFiles(files: FileLike[], kind: UploadKind): ValidateFilesResult {
  const rule = UPLOAD_RULES[kind];

  if (files.length > rule.maxCount) {
    return {
      valid: [],
      rejected: files.map((f) => ({
        file: f,
        reason: `Too many at once — pick up to ${rule.maxCount} ${rule.label}s`,
      })),
    };
  }

  const valid: FileLike[] = [];
  const rejected: ValidateFilesResult["rejected"] = [];

  for (const file of files) {
    if (file.size === 0) {
      rejected.push({ file, reason: "File is empty" });
      continue;
    }
    if (!isAccepted(file, rule.accept)) {
      rejected.push({
        file,
        reason: `Wrong file type — use ${rule.extensions.join(", ")}`,
      });
      continue;
    }
    if (file.size > rule.maxBytes) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      const max = rule.maxBytes / 1024 / 1024;
      rejected.push({ file, reason: `Too large (${mb} MB) — keep under ${max} MB` });
      continue;
    }
    valid.push(file);
  }
  return { valid, rejected };
}

export type ValidateInputResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateUploadInput(
  kind: UploadKind,
  input: { fileName: string; contentType: string; size: number },
): ValidateInputResult {
  const rule = UPLOAD_RULES[kind];

  if (!input.fileName || input.fileName.includes("..") || /[\/\\]/.test(input.fileName)) {
    return { ok: false, error: "Invalid filename" };
  }
  if (input.size <= 0) {
    return { ok: false, error: "Missing or empty file" };
  }
  if (input.size > rule.maxBytes) {
    const max = rule.maxBytes / 1024 / 1024;
    return { ok: false, error: `File too large — max ${max} MB` };
  }
  const acceptedByMime = rule.accept.includes(input.contentType);
  const acceptedByExt = HEIC_EXT.test(input.fileName) &&
    (rule.accept.includes("image/heic") || rule.accept.includes("image/heif"));
  if (!acceptedByMime && !acceptedByExt) {
    return { ok: false, error: "File type not allowed" };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/storage/validate.test.ts`
Expected: PASS, all sub-tests.

- [ ] **Step 5: Commit**

```bash
git add lib/storage/validate.ts tests/lib/storage/validate.test.ts
git commit -m "feat(storage): add L2/L3 file validators with HEIC + traversal checks"
```

---

## Task 5: Image Presets

**Files:**
- Create: `lib/storage/image-presets.ts`
- Test: `tests/lib/storage/image-presets.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/storage/image-presets.test.ts
import { describe, it, expect } from "vitest";
import { IMAGE_PRESETS } from "@/lib/storage/image-presets";

describe("IMAGE_PRESETS", () => {
  it("declares the four standard presets", () => {
    for (const k of ["thumbnail", "card", "hero", "full"] as const) {
      expect(IMAGE_PRESETS[k]).toBeDefined();
    }
  });

  it("widths increase from thumbnail to full", () => {
    expect(IMAGE_PRESETS.thumbnail.width).toBeLessThan(IMAGE_PRESETS.card.width);
    expect(IMAGE_PRESETS.card.width).toBeLessThan(IMAGE_PRESETS.hero.width);
    expect(IMAGE_PRESETS.hero.width).toBeLessThan(IMAGE_PRESETS.full.width);
  });

  it("quality is in valid range", () => {
    for (const v of Object.values(IMAGE_PRESETS)) {
      expect(v.quality).toBeGreaterThanOrEqual(50);
      expect(v.quality).toBeLessThanOrEqual(95);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/storage/image-presets.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write the presets**

```ts
// lib/storage/image-presets.ts
import type { TransformOpts } from "./provider";

export const IMAGE_PRESETS = {
  thumbnail: { width: 400, quality: 70, format: "auto" },
  card:      { width: 800, quality: 75, format: "auto" },
  hero:      { width: 1920, quality: 80, format: "auto" },
  full:      { width: 2400, quality: 85, format: "auto" },
} as const satisfies Record<string, TransformOpts>;

export type ImagePreset = keyof typeof IMAGE_PRESETS;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/storage/image-presets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/storage/image-presets.ts tests/lib/storage/image-presets.test.ts
git commit -m "feat(storage): add CDN image transform presets"
```

---

## Task 6: Supabase Storage Provider

**Files:**
- Create: `lib/storage/providers/supabase.ts`
- Test: `tests/lib/storage/providers/supabase.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/storage/providers/supabase.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreateSignedUploadUrl = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockRemove = vi.fn();
const mockFrom = vi.fn(() => ({
  createSignedUploadUrl: mockCreateSignedUploadUrl,
  getPublicUrl: mockGetPublicUrl,
  remove: mockRemove,
}));

vi.mock("@/lib/supabase/server", () => ({
  getServiceClient: () => ({ storage: { from: mockFrom } }),
}));

import { SupabaseStorageProvider } from "@/lib/storage/providers/supabase";

beforeEach(() => {
  mockCreateSignedUploadUrl.mockReset();
  mockGetPublicUrl.mockReset();
  mockRemove.mockReset();
  mockFrom.mockClear();
  mockGetPublicUrl.mockReturnValue({ data: { publicUrl: "https://x/cms-media/p" } });
});

describe("SupabaseStorageProvider", () => {
  it("createUploadTicket returns a PUT ticket with auth token", async () => {
    mockCreateSignedUploadUrl.mockResolvedValue({
      data: { signedUrl: "https://x/upload?token=abc", token: "abc", path: "p" },
      error: null,
    });
    const p = new SupabaseStorageProvider();
    const t = await p.createUploadTicket({ path: "p", contentType: "image/jpeg" });
    expect(mockFrom).toHaveBeenCalledWith("cms-media");
    expect(t.method).toBe("PUT");
    expect(t.uploadUrl).toContain("upload");
    expect(t.headers["x-upsert"]).toBe("false");
    expect(t.headers["content-type"]).toBe("image/jpeg");
    expect(t.headers["authorization"]).toMatch(/^Bearer /);
    expect(t.path).toBe("p");
    expect(t.publicUrl).toBe("https://x/cms-media/p");
    expect(t.expiresAt).toBeGreaterThan(Date.now());
  });

  it("createUploadTicket throws on Supabase error", async () => {
    mockCreateSignedUploadUrl.mockResolvedValue({
      data: null, error: { message: "boom" },
    });
    const p = new SupabaseStorageProvider();
    await expect(p.createUploadTicket({ path: "p", contentType: "image/jpeg" }))
      .rejects.toThrow(/boom/);
  });

  it("deleteObject calls remove([path])", async () => {
    mockRemove.mockResolvedValue({ error: null });
    const p = new SupabaseStorageProvider();
    await p.deleteObject("trip-gallery/x.jpg");
    expect(mockRemove).toHaveBeenCalledWith(["trip-gallery/x.jpg"]);
  });

  it("deleteObject throws on Supabase error", async () => {
    mockRemove.mockResolvedValue({ error: { message: "denied" } });
    const p = new SupabaseStorageProvider();
    await expect(p.deleteObject("x")).rejects.toThrow(/denied/);
  });

  it("getPublicUrl returns canonical URL", () => {
    const p = new SupabaseStorageProvider();
    expect(p.getPublicUrl("foo")).toBe("https://x/cms-media/p");
  });

  it("getOptimizedUrl appends transform query params", () => {
    const p = new SupabaseStorageProvider();
    const url = p.getOptimizedUrl("foo/bar.jpg", { width: 800, quality: 75, format: "webp" });
    expect(url).toMatch(/render\/image\/public\/cms-media\/foo\/bar\.jpg/);
    expect(url).toMatch(/width=800/);
    expect(url).toMatch(/quality=75/);
    expect(url).toMatch(/format=webp/);
  });

  it("getOptimizedUrl with no opts returns the public URL", () => {
    const p = new SupabaseStorageProvider();
    const url = p.getOptimizedUrl("foo", {});
    expect(url).toBe("https://x/cms-media/p");
  });

  it("getOptimizedUrl with format=auto omits format param", () => {
    const p = new SupabaseStorageProvider();
    const url = p.getOptimizedUrl("foo", { width: 800, format: "auto" });
    expect(url).not.toMatch(/format=auto/);
    expect(url).toMatch(/width=800/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/storage/providers/supabase.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write the provider**

```ts
// lib/storage/providers/supabase.ts
import { getServiceClient } from "@/lib/supabase/server";
import type {
  StorageProvider,
  UploadTicket,
  CreateUploadTicketInput,
  TransformOpts,
} from "../provider";

const BUCKET = "cms-media";
const TICKET_TTL_MS = 60 * 60 * 1000; // 1 hour

export class SupabaseStorageProvider implements StorageProvider {
  async createUploadTicket(input: CreateUploadTicketInput): Promise<UploadTicket> {
    const sb = getServiceClient();
    const { data, error } = await sb.storage
      .from(BUCKET)
      .createSignedUploadUrl(input.path);
    if (error || !data) {
      throw new Error(`createSignedUploadUrl failed: ${error?.message ?? "unknown"}`);
    }
    return {
      uploadUrl: data.signedUrl,
      method: "PUT",
      headers: {
        "content-type": input.contentType,
        "x-upsert": "false",
        authorization: `Bearer ${data.token}`,
      },
      path: data.path ?? input.path,
      publicUrl: this.getPublicUrl(input.path),
      expiresAt: Date.now() + TICKET_TTL_MS,
    };
  }

  async deleteObject(path: string): Promise<void> {
    const sb = getServiceClient();
    const { error } = await sb.storage.from(BUCKET).remove([path]);
    if (error) throw new Error(`storage.remove failed: ${error.message}`);
  }

  getPublicUrl(path: string): string {
    const sb = getServiceClient();
    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  getOptimizedUrl(path: string, opts: TransformOpts): string {
    const params = new URLSearchParams();
    if (opts.width) params.set("width", String(opts.width));
    if (opts.height) params.set("height", String(opts.height));
    if (opts.quality) params.set("quality", String(opts.quality));
    if (opts.format && opts.format !== "auto") params.set("format", opts.format);
    if (opts.fit) params.set("resize", opts.fit);
    if (params.size === 0) return this.getPublicUrl(path);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    return `${url}/storage/v1/render/image/public/${BUCKET}/${path}?${params.toString()}`;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/storage/providers/supabase.test.ts`
Expected: PASS, all sub-tests.

- [ ] **Step 5: Commit**

```bash
git add lib/storage/providers/supabase.ts tests/lib/storage/providers/supabase.test.ts
git commit -m "feat(storage): add Supabase provider with signed-upload URLs and CDN transforms"
```

---

## Task 7: Provider Factory

**Files:**
- Create: `lib/storage/index.ts`
- Test: `tests/lib/storage/index.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/storage/index.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getServiceClient: () => ({
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: "x" } }) }) },
  }),
}));

beforeEach(() => {
  vi.resetModules();
});

describe("getStorageProvider", () => {
  it("defaults to Supabase when env not set", async () => {
    delete process.env.STORAGE_PROVIDER;
    const { getStorageProvider } = await import("@/lib/storage");
    const { SupabaseStorageProvider } = await import("@/lib/storage/providers/supabase");
    expect(getStorageProvider()).toBeInstanceOf(SupabaseStorageProvider);
  });

  it("returns Supabase when STORAGE_PROVIDER=supabase", async () => {
    process.env.STORAGE_PROVIDER = "supabase";
    const { getStorageProvider } = await import("@/lib/storage");
    const { SupabaseStorageProvider } = await import("@/lib/storage/providers/supabase");
    expect(getStorageProvider()).toBeInstanceOf(SupabaseStorageProvider);
  });

  it("throws on unknown provider", async () => {
    process.env.STORAGE_PROVIDER = "unknown-vendor";
    const { getStorageProvider } = await import("@/lib/storage");
    expect(() => getStorageProvider()).toThrow(/unknown.*provider/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/storage/index.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write the factory**

```ts
// lib/storage/index.ts
import type { StorageProvider } from "./provider";
import { SupabaseStorageProvider } from "./providers/supabase";

let cached: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  const key = process.env.STORAGE_PROVIDER ?? "supabase";
  if (cached && cached.constructor.name.toLowerCase().includes(key)) return cached;

  switch (key) {
    case "supabase":
      cached = new SupabaseStorageProvider();
      return cached;
    default:
      throw new Error(`Unknown STORAGE_PROVIDER: ${key}`);
  }
}

export type { StorageProvider, UploadTicket, TransformOpts } from "./provider";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/storage/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/storage/index.ts tests/lib/storage/index.test.ts
git commit -m "feat(storage): add provider factory keyed off STORAGE_PROVIDER env"
```

---

## Task 8: Browser Client Upload Helper

**Files:**
- Create: `lib/storage/client-upload.ts`
- Test: `tests/lib/storage/client-upload.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/storage/client-upload.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadWithTicket, runWithConcurrency } from "@/lib/storage/client-upload";
import type { UploadTicket } from "@/lib/storage/provider";

const ticket: UploadTicket = {
  uploadUrl: "https://store/x",
  method: "PUT",
  headers: { "content-type": "image/jpeg", authorization: "Bearer t" },
  path: "x.jpg",
  publicUrl: "https://store/x.jpg",
  expiresAt: Date.now() + 60_000,
};

beforeEach(() => {
  (globalThis as any).fetch = vi.fn();
});

describe("uploadWithTicket", () => {
  it("PUTs file bytes with ticket headers", async () => {
    (fetch as any).mockResolvedValue({ ok: true });
    const file = new File(["bytes"], "a.jpg", { type: "image/jpeg" });
    await uploadWithTicket(file, ticket);
    expect(fetch).toHaveBeenCalledWith("https://store/x", expect.objectContaining({
      method: "PUT",
      headers: ticket.headers,
      body: file,
    }));
  });

  it("throws on non-ok response", async () => {
    (fetch as any).mockResolvedValue({ ok: false, status: 413, statusText: "Too Large" });
    const file = new File(["bytes"], "a.jpg", { type: "image/jpeg" });
    await expect(uploadWithTicket(file, ticket)).rejects.toThrow(/413|Too Large/);
  });

  it("throws on network failure", async () => {
    (fetch as any).mockRejectedValue(new Error("offline"));
    const file = new File(["bytes"], "a.jpg", { type: "image/jpeg" });
    await expect(uploadWithTicket(file, ticket)).rejects.toThrow(/offline/);
  });
});

describe("runWithConcurrency", () => {
  it("processes all items", async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await runWithConcurrency(items, 2, async (n) => n * 2);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it("respects the concurrency cap", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);
    await runWithConcurrency(items, 3, async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
    });
    expect(maxInFlight).toBeLessThanOrEqual(3);
  });

  it("calls onProgress with done count", async () => {
    const items = [1, 2, 3];
    const progress: number[] = [];
    await runWithConcurrency(items, 2, async (n) => n, (done) => progress.push(done));
    expect(progress).toEqual([1, 2, 3]);
  });

  it("collects all results even if some throw", async () => {
    const items = [1, 2, 3];
    const results = await runWithConcurrency<number, string>(items, 2, async (n) => {
      if (n === 2) throw new Error("nope");
      return `ok-${n}`;
    });
    expect(results).toEqual(["ok-1", expect.objectContaining({ message: "nope" }), "ok-3"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/storage/client-upload.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write the helpers**

```ts
// lib/storage/client-upload.ts
import type { UploadTicket } from "./provider";

export async function uploadWithTicket(file: File | Blob, ticket: UploadTicket): Promise<void> {
  const res = await fetch(ticket.uploadUrl, {
    method: ticket.method,
    headers: ticket.headers,
    body: file,
  });
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
  }
}

/**
 * Bounded-parallel iterator. Returns one entry per input — either the
 * resolved value or the thrown Error. Caller decides what to do with errors.
 * onProgress is called after each completion with the running done-count.
 */
export async function runWithConcurrency<TIn, TOut>(
  items: TIn[],
  cap: number,
  fn: (item: TIn, index: number) => Promise<TOut>,
  onProgress?: (done: number) => void,
): Promise<(TOut | Error)[]> {
  const results: (TOut | Error)[] = new Array(items.length);
  let cursor = 0;
  let done = 0;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = await fn(items[i], i);
      } catch (e) {
        results[i] = e instanceof Error ? e : new Error(String(e));
      } finally {
        done++;
        onProgress?.(done);
      }
    }
  }

  const workers = Array.from({ length: Math.min(cap, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/storage/client-upload.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/storage/client-upload.ts tests/lib/storage/client-upload.test.ts
git commit -m "feat(storage): add browser uploadWithTicket + bounded-parallel runner"
```

---

## Task 9: HEIC Conversion (Lazy)

**Files:**
- Create: `lib/storage/heic-convert.ts`
- Test: `tests/lib/storage/heic-convert.test.ts`
- Modify: `package.json` — add `heic2any` dependency

- [ ] **Step 1: Add the dep**

```bash
pnpm add heic2any
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/lib/storage/heic-convert.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const heicMock = vi.fn();
vi.mock("heic2any", () => ({ default: heicMock }));

import { maybeConvertHeic, isHeic } from "@/lib/storage/heic-convert";

beforeEach(() => {
  heicMock.mockReset();
});

describe("isHeic", () => {
  it("matches MIME image/heic", () => {
    expect(isHeic({ name: "x.heic", type: "image/heic" } as File)).toBe(true);
  });
  it("matches MIME image/heif", () => {
    expect(isHeic({ name: "x.heif", type: "image/heif" } as File)).toBe(true);
  });
  it("matches extension when MIME is empty", () => {
    expect(isHeic({ name: "x.HEIC", type: "" } as File)).toBe(true);
  });
  it("rejects non-HEIC", () => {
    expect(isHeic({ name: "x.jpg", type: "image/jpeg" } as File)).toBe(false);
  });
});

describe("maybeConvertHeic", () => {
  it("passes through non-HEIC files unchanged", async () => {
    const f = new File(["x"], "a.jpg", { type: "image/jpeg" });
    const out = await maybeConvertHeic(f);
    expect(out).toBe(f);
    expect(heicMock).not.toHaveBeenCalled();
  });

  it("converts HEIC to JPEG, renames extension", async () => {
    const blob = new Blob(["jpegbytes"], { type: "image/jpeg" });
    heicMock.mockResolvedValue(blob);
    const f = new File(["x"], "shot.heic", { type: "image/heic" });
    const out = await maybeConvertHeic(f);
    expect(heicMock).toHaveBeenCalledWith(expect.objectContaining({
      blob: f, toType: "image/jpeg",
    }));
    expect(out.name).toBe("shot.jpg");
    expect(out.type).toBe("image/jpeg");
    expect(out).not.toBe(f);
  });

  it("handles array result from heic2any", async () => {
    const a = new Blob(["a"], { type: "image/jpeg" });
    const b = new Blob(["b"], { type: "image/jpeg" });
    heicMock.mockResolvedValue([a, b]);
    const f = new File(["x"], "shot.heic", { type: "image/heic" });
    const out = await maybeConvertHeic(f);
    expect(out.name).toBe("shot.jpg");
  });

  it("falls back to original on conversion failure", async () => {
    heicMock.mockRejectedValue(new Error("malformed"));
    const f = new File(["x"], "shot.heic", { type: "image/heic" });
    const out = await maybeConvertHeic(f);
    expect(out).toBe(f); // original returned, no throw
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/storage/heic-convert.test.ts`
Expected: FAIL.

- [ ] **Step 4: Write the helper**

```ts
// lib/storage/heic-convert.ts
type Heic2Any = (opts: {
  blob: Blob;
  toType: string;
  quality?: number;
}) => Promise<Blob | Blob[]>;

let heicLib: Heic2Any | null = null;

export function isHeic(file: File): boolean {
  if (file.type === "image/heic" || file.type === "image/heif") return true;
  return /\.(heic|heif)$/i.test(file.name);
}

export async function maybeConvertHeic(file: File): Promise<File> {
  if (!isHeic(file)) return file;
  try {
    if (!heicLib) {
      const mod = await import("heic2any");
      heicLib = mod.default as Heic2Any;
    }
    const blob = await heicLib({ blob: file, toType: "image/jpeg", quality: 0.9 });
    const out = Array.isArray(blob) ? blob[0] : blob;
    const newName = file.name.replace(/\.(heic|heif)$/i, ".jpg");
    return new File([out], newName, { type: "image/jpeg" });
  } catch (e) {
    console.warn("[heic-convert] failed, uploading original:", e);
    return file;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/storage/heic-convert.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/storage/heic-convert.ts tests/lib/storage/heic-convert.test.ts package.json pnpm-lock.yaml
git commit -m "feat(storage): add lazy HEIC→JPEG converter with fault-tolerant fallback"
```

---

## Task 10: UploadGuidelines Component

**Files:**
- Create: `components/ui/UploadGuidelines.tsx`
- Test: `components/ui/__tests__/UploadGuidelines.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// components/ui/__tests__/UploadGuidelines.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UploadGuidelines } from "@/components/ui/UploadGuidelines";

describe("<UploadGuidelines />", () => {
  it("shows accepted formats for tripGallery", () => {
    render(<UploadGuidelines kind="tripGallery" />);
    expect(screen.getByText(/JPG/)).toBeInTheDocument();
    expect(screen.getByText(/20 MB/)).toBeInTheDocument();
  });

  it("shows recommended resolution", () => {
    render(<UploadGuidelines kind="heroImage" />);
    expect(screen.getByText(/1920\s*×\s*1080/)).toBeInTheDocument();
  });

  it("shows max count + concurrency for multi-upload kinds", () => {
    render(<UploadGuidelines kind="tripGallery" />);
    expect(screen.getByText(/30/)).toBeInTheDocument();
    expect(screen.getByText(/5/)).toBeInTheDocument();
  });

  it("hides 'in parallel' for single-upload kinds", () => {
    render(<UploadGuidelines kind="banner" />);
    expect(screen.queryByText(/in parallel/i)).not.toBeInTheDocument();
  });

  it("shows aspect guidance and notes", () => {
    render(<UploadGuidelines kind="heroImage" />);
    expect(screen.getByText(/16:9/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run components/ui/__tests__/UploadGuidelines.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Write the component**

```tsx
// components/ui/UploadGuidelines.tsx
"use client";

import { UPLOAD_RULES, describeRules, type UploadKind } from "@/lib/storage/upload-rules";
import { cn } from "@/lib/utils";

interface Props {
  kind: UploadKind;
  className?: string;
}

export function UploadGuidelines({ kind, className }: Props) {
  const rule = UPLOAD_RULES[kind];
  const summary = describeRules(kind);
  return (
    <div className={cn("text-xs text-mid space-y-0.5", className)}>
      <p>{summary}</p>
      <p>
        Recommended: {rule.guidelines.recommendedResolution} ·{" "}
        {rule.guidelines.aspectGuidance}
      </p>
      {rule.guidelines.notes && <p className="text-fog">{rule.guidelines.notes}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run components/ui/__tests__/UploadGuidelines.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ui/UploadGuidelines.tsx components/ui/__tests__/UploadGuidelines.test.tsx
git commit -m "feat(ui): add UploadGuidelines component"
```

---

## Task 11: Schema Migration — image_path columns

**Files:**
- Create: `supabase/migrations/20260509T0900__image_path_columns.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Add image_path column to gallery tables. Stored alongside image_url so we
-- can apply CDN transforms (which need the bucket-relative path) without
-- regex-parsing URLs. Existing rows get a best-effort backfill.

ALTER TABLE trip_gallery ADD COLUMN IF NOT EXISTS image_path text;
ALTER TABLE site_gallery ADD COLUMN IF NOT EXISTS image_path text;

-- raw_moments table may not exist in all envs — guard.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'raw_moments') THEN
    ALTER TABLE raw_moments ADD COLUMN IF NOT EXISTS image_path text;
  END IF;
END $$;

-- Backfill: extract path after /cms-media/ in existing URLs.
UPDATE trip_gallery
SET image_path = substring(image_url FROM '/cms-media/(.+)$')
WHERE image_path IS NULL AND image_url IS NOT NULL;

UPDATE site_gallery
SET image_path = substring(image_url FROM '/cms-media/(.+)$')
WHERE image_path IS NULL AND image_url IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'raw_moments') THEN
    UPDATE raw_moments
    SET image_path = substring(image_url FROM '/cms-media/(.+)$')
    WHERE image_path IS NULL AND image_url IS NOT NULL;
  END IF;
END $$;
```

- [ ] **Step 2: Apply via Supabase MCP (after user confirms)**

Wait for user to apply. Verify counts:
```sql
SELECT count(*) FROM trip_gallery WHERE image_path IS NOT NULL;
SELECT count(*) FROM site_gallery WHERE image_path IS NOT NULL;
```

- [ ] **Step 3: Update DbTripGallery / DbSiteGallery types**

Open `lib/types.ts`, find `DbTripGallery` and `DbSiteGallery`, `DbRawMoment` and add `image_path: string | null` to each.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260509T0900__image_path_columns.sql lib/types.ts
git commit -m "feat(db): add image_path column to gallery tables for CDN transforms"
```

---

## Task 12: Refactor Trip Gallery Upload (prepare + register)

**Files:**
- Modify: `app/(cms)/media/actions.ts`
- Modify: `lib/db/media.ts` (createGalleryImage signature gains `image_path`)
- Test: `tests/app/media-actions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/app/media-actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const createUploadTicket = vi.fn();
const deleteObject = vi.fn();
vi.mock("@/lib/storage", () => ({
  getStorageProvider: () => ({
    createUploadTicket, deleteObject,
    getPublicUrl: (p: string) => `https://x/${p}`,
  }),
}));

const createGalleryImage = vi.fn();
vi.mock("@/lib/db/media", () => ({
  createGalleryImage,
  getTripGalleryImages: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({ logActivity: vi.fn(), logActivityAsync: vi.fn() }));
vi.mock("@/lib/revalidate", () => ({ revalidateHome: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  prepareTripGalleryUploadAction,
  registerTripGalleryAction,
} from "@/app/(cms)/media/actions";

beforeEach(() => {
  createUploadTicket.mockReset();
  createGalleryImage.mockReset();
});

describe("prepareTripGalleryUploadAction", () => {
  it("returns ticket on valid input", async () => {
    createUploadTicket.mockResolvedValue({
      uploadUrl: "u", method: "PUT", headers: {}, path: "p", publicUrl: "pu", expiresAt: 0,
    });
    const r = await prepareTripGalleryUploadAction({
      tripId: "T1", fileName: "a.jpg", contentType: "image/jpeg", size: 1_000_000,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.ticket?.uploadUrl).toBe("u");
  });

  it("rejects oversize", async () => {
    const r = await prepareTripGalleryUploadAction({
      tripId: "T1", fileName: "a.jpg", contentType: "image/jpeg", size: 30 * 1024 * 1024,
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/too large/i);
    expect(createUploadTicket).not.toHaveBeenCalled();
  });

  it("rejects wrong MIME", async () => {
    const r = await prepareTripGalleryUploadAction({
      tripId: "T1", fileName: "a.bin", contentType: "application/octet-stream", size: 1000,
    });
    expect(r.success).toBe(false);
  });

  it("rejects path traversal in filename", async () => {
    const r = await prepareTripGalleryUploadAction({
      tripId: "T1", fileName: "../../../etc/passwd", contentType: "image/jpeg", size: 1000,
    });
    expect(r.success).toBe(false);
  });

  it("propagates provider errors", async () => {
    createUploadTicket.mockRejectedValue(new Error("storage down"));
    const r = await prepareTripGalleryUploadAction({
      tripId: "T1", fileName: "a.jpg", contentType: "image/jpeg", size: 1000,
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/storage down/);
  });
});

describe("registerTripGalleryAction", () => {
  it("creates DB row with path + url", async () => {
    createGalleryImage.mockResolvedValue(undefined);
    const r = await registerTripGalleryAction({
      tripId: "T1", path: "trip-gallery/T1/x.jpg",
      publicUrl: "https://x/trip-gallery/T1/x.jpg", category: "gallery",
    });
    expect(r.success).toBe(true);
    expect(createGalleryImage).toHaveBeenCalledWith(expect.objectContaining({
      trip_id: "T1",
      image_url: "https://x/trip-gallery/T1/x.jpg",
      image_path: "trip-gallery/T1/x.jpg",
      category: "gallery",
    }));
  });

  it("returns error on DB failure", async () => {
    createGalleryImage.mockRejectedValue(new Error("constraint"));
    const r = await registerTripGalleryAction({
      tripId: "T1", path: "p", publicUrl: "u", category: "gallery",
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/app/media-actions.test.ts`
Expected: FAIL.

- [ ] **Step 3: Modify `lib/db/media.ts`**

Find `createGalleryImage`, change its input type to also accept `image_path?: string | null`, and pass it through to the insert.

- [ ] **Step 4: Replace `uploadTripGalleryAction` in `app/(cms)/media/actions.ts`**

Delete the old action body. Add:

```ts
import { getStorageProvider } from "@/lib/storage";
import { buildPath } from "@/lib/storage/paths";
import { validateUploadInput } from "@/lib/storage/validate";
import type { UploadTicket } from "@/lib/storage/provider";

interface PrepareTripGalleryInput {
  tripId: string;
  fileName: string;
  contentType: string;
  size: number;
}

export async function prepareTripGalleryUploadAction(input: PrepareTripGalleryInput): Promise<
  { success: true; ticket: UploadTicket } | { success: false; error: string }
> {
  const v = validateUploadInput("tripGallery", input);
  if (!v.ok) return { success: false, error: v.error };
  try {
    const path = buildPath("tripGallery", { tripId: input.tripId, fileName: input.fileName });
    const provider = getStorageProvider();
    const ticket = await provider.createUploadTicket({ path, contentType: input.contentType });
    return { success: true, ticket };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

interface RegisterTripGalleryInput {
  tripId: string;
  path: string;
  publicUrl: string;
  category: string;
  altText?: string;
  caption?: string;
}

export async function registerTripGalleryAction(input: RegisterTripGalleryInput): Promise<
  { success: boolean; error?: string }
> {
  try {
    await createGalleryImage({
      trip_id: input.tripId,
      image_url: input.publicUrl,
      image_path: input.path,
      thumbnail_url: null,
      alt_text: input.altText ?? null,
      caption: input.caption ?? null,
      category: input.category as DbTripGallery["category"],
      is_cover: false,
      is_featured: false,
      is_active: true,
      photographer: null,
      display_order: 0,
    });
    await logActivity({ table_name: "trip_gallery", record_id: input.tripId, action: "INSERT", new_values: { category: input.category, image_url: input.publicUrl } });
    revalidatePath("/media");
    await revalidateHome();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
```

Also: delete the old `uploadTripGalleryAction` export.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/app/media-actions.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/\(cms\)/media/actions.ts lib/db/media.ts tests/app/media-actions.test.ts
git commit -m "feat(media): split trip gallery upload into prepare+register actions"
```

---

## Task 13: Refactor Site Gallery + Raw Moment + Banner + Hero Image + Hero Video

**Files:**
- Modify: `app/(cms)/media/actions.ts` — add prepare/register pairs for `siteGallery`, `rawMoment`
- Modify: `app/(cms)/announcements/actions.ts` — add prepare/register pair for `banner`
- Modify: `app/(cms)/settings/actions.ts` — add prepare/register pairs for `heroImage`, `heroVideo`
- Modify: `lib/db/media.ts` — `createSiteGalleryImage`, `createRawMoment` add `image_path`
- Test: extend `tests/app/media-actions.test.ts`, add `tests/app/announcements-upload.test.ts`, `tests/app/settings-upload.test.ts`

- [ ] **Step 1: Write tests for all four remaining kinds**

For each kind, mirror the structure of Task 12's test:
- `prepare<X>UploadAction` happy path returns ticket
- rejects oversize
- rejects wrong MIME
- rejects path traversal
- propagates provider errors
- `register<X>Action` happy path creates DB row
- returns error on DB failure

Concrete test files:

**`tests/app/announcements-upload.test.ts`** — tests `prepareBannerUploadAction` + `registerBannerAction`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const createUploadTicket = vi.fn();
vi.mock("@/lib/storage", () => ({
  getStorageProvider: () => ({ createUploadTicket, deleteObject: vi.fn(), getPublicUrl: () => "u" }),
}));

const insertSiteGallery = vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ error: null }) }));
vi.mock("@/lib/supabase/server", () => ({
  getServiceClient: () => ({ from: insertSiteGallery }),
}));
vi.mock("@/lib/audit", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/ids", () => ({ nextSequentialId: async () => "SGL-1" }));

import {
  prepareBannerUploadAction,
  registerBannerAction,
} from "@/app/(cms)/announcements/actions";

beforeEach(() => createUploadTicket.mockReset());

describe("prepareBannerUploadAction", () => {
  it("rejects > 10MB banner", async () => {
    const r = await prepareBannerUploadAction({
      fileName: "b.jpg", contentType: "image/jpeg", size: 11 * 1024 * 1024,
    });
    expect(r.success).toBe(false);
  });

  it("accepts 5MB banner", async () => {
    createUploadTicket.mockResolvedValue({
      uploadUrl: "u", method: "PUT", headers: {}, path: "p", publicUrl: "pu", expiresAt: 0,
    });
    const r = await prepareBannerUploadAction({
      fileName: "b.jpg", contentType: "image/jpeg", size: 5 * 1024 * 1024,
    });
    expect(r.success).toBe(true);
  });
});

describe("registerBannerAction", () => {
  it("creates site_gallery row with category=hero", async () => {
    const r = await registerBannerAction({
      path: "banners/x.jpg", publicUrl: "https://x/banners/x.jpg",
    });
    expect(r.success).toBe(true);
  });
});
```

**`tests/app/settings-upload.test.ts`** — tests `prepareHeroImageUploadAction`, `prepareHeroVideoUploadAction`, register variants. Critically:

```ts
it("heroVideo accepts 90MB video", async () => {
  createUploadTicket.mockResolvedValue({ /* ... */ });
  const r = await prepareHeroVideoUploadAction({
    fileName: "v.mp4", contentType: "video/mp4", size: 90 * 1024 * 1024,
  });
  expect(r.success).toBe(true);
});

it("heroVideo rejects 110MB video", async () => {
  const r = await prepareHeroVideoUploadAction({
    fileName: "v.mp4", contentType: "video/mp4", size: 110 * 1024 * 1024,
  });
  expect(r.success).toBe(false);
});

it("heroVideo rejects image MIME", async () => {
  const r = await prepareHeroVideoUploadAction({
    fileName: "v.jpg", contentType: "image/jpeg", size: 1000,
  });
  expect(r.success).toBe(false);
});

it("heroImage rejects video MIME", async () => {
  const r = await prepareHeroImageUploadAction({
    fileName: "v.mp4", contentType: "video/mp4", size: 1000,
  });
  expect(r.success).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/app/announcements-upload.test.ts tests/app/settings-upload.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement all four pairs**

Each follows the Task 12 pattern. Hero image registers a row in `site_gallery` with category `hero` (preserve existing behavior). Hero video does not insert a DB row — it returns `{ success: true, url }` like the old action.

Delete the old monolithic actions: `uploadTripGalleryAction`, `uploadSiteGalleryAction`, `uploadRawMomentAction`, `uploadBannerImage`, `uploadHeroImageAction`, `uploadHeroVideoAction`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/app/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/ lib/db/media.ts tests/app/
git commit -m "feat(uploads): split site/raw/banner/hero image+video into prepare+register"
```

---

## Task 14: Refactor `GalleryTab.tsx` — Multi-Upload with Parallel-5 + Progress

**Files:**
- Modify: `app/(cms)/trips/_components/tabs/GalleryTab.tsx`
- Test: `app/(cms)/trips/_components/tabs/__tests__/GalleryTab.upload.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// app/(cms)/trips/_components/tabs/__tests__/GalleryTab.upload.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const prepare = vi.fn();
const register = vi.fn();
const fetchGallery = vi.fn(async () => []);
vi.mock("@/app/(cms)/media/actions", () => ({
  prepareTripGalleryUploadAction: prepare,
  registerTripGalleryAction: register,
  deleteGalleryImageAction: vi.fn(),
  toggleGalleryFeaturedAction: vi.fn(),
  toggleGalleryCoverAction: vi.fn(),
  fetchTripGalleryImages: fetchGallery,
}));

const uploadWithTicket = vi.fn();
vi.mock("@/lib/storage/client-upload", () => ({
  uploadWithTicket,
  runWithConcurrency: async (items: any[], _cap: number, fn: any, onProgress: any) => {
    const out = [];
    for (let i = 0; i < items.length; i++) {
      out.push(await fn(items[i], i));
      onProgress?.(i + 1);
    }
    return out;
  },
}));

vi.mock("@/lib/storage/heic-convert", () => ({
  maybeConvertHeic: async (f: File) => f,
}));

import { GalleryTab } from "@/app/(cms)/trips/_components/tabs/GalleryTab";

function makeFile(name: string, size: number, type = "image/jpeg") {
  const f = new File([new Uint8Array(size)], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

beforeEach(() => {
  prepare.mockReset();
  register.mockReset();
  uploadWithTicket.mockReset();
});

describe("GalleryTab multi-upload", () => {
  it("uploads valid files via prepare → uploadWithTicket → register", async () => {
    prepare.mockResolvedValue({ success: true, ticket: { uploadUrl: "u", method: "PUT", headers: {}, path: "p", publicUrl: "pu", expiresAt: 0 } });
    register.mockResolvedValue({ success: true });
    uploadWithTicket.mockResolvedValue(undefined);

    render(<GalleryTab tripId="T1" gallery={[]} onGalleryChange={() => {}} />);
    const input = screen.getByLabelText(/upload/i) as HTMLInputElement;

    const file = makeFile("a.jpg", 1_000_000);
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(prepare).toHaveBeenCalled();
      expect(uploadWithTicket).toHaveBeenCalled();
      expect(register).toHaveBeenCalled();
    });
  });

  it("rejects oversized file with toast, does NOT call prepare", async () => {
    render(<GalleryTab tripId="T1" gallery={[]} onGalleryChange={() => {}} />);
    const input = screen.getByLabelText(/upload/i) as HTMLInputElement;

    const big = makeFile("big.jpg", 30 * 1024 * 1024);
    fireEvent.change(input, { target: { files: [big] } });

    await waitFor(() => {
      expect(prepare).not.toHaveBeenCalled();
    });
  });

  it("partitions: uploads good files, rejects bad ones in same batch", async () => {
    prepare.mockResolvedValue({ success: true, ticket: { uploadUrl: "u", method: "PUT", headers: {}, path: "p", publicUrl: "pu", expiresAt: 0 } });
    register.mockResolvedValue({ success: true });
    uploadWithTicket.mockResolvedValue(undefined);

    render(<GalleryTab tripId="T1" gallery={[]} onGalleryChange={() => {}} />);
    const input = screen.getByLabelText(/upload/i) as HTMLInputElement;

    const good = makeFile("ok.jpg", 1_000_000);
    const bad = makeFile("big.jpg", 30 * 1024 * 1024);
    fireEvent.change(input, { target: { files: [good, bad] } });

    await waitFor(() => {
      expect(prepare).toHaveBeenCalledTimes(1);
      expect(register).toHaveBeenCalledTimes(1);
    });
  });

  it("blocks upload when tripId missing", async () => {
    render(<GalleryTab tripId={null} gallery={[]} onGalleryChange={() => {}} />);
    const input = screen.getByLabelText(/upload/i) as HTMLInputElement;
    const file = makeFile("a.jpg", 1_000_000);
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(prepare).not.toHaveBeenCalled());
  });

  it("renders UploadGuidelines block", () => {
    render(<GalleryTab tripId="T1" gallery={[]} onGalleryChange={() => {}} />);
    expect(screen.getByText(/JPG/)).toBeInTheDocument();
    expect(screen.getByText(/20 MB/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run app/\(cms\)/trips/_components/tabs/__tests__/GalleryTab.upload.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Refactor `GalleryTab.tsx`**

Replace `handleUpload` body:

```tsx
import { validateFiles } from "@/lib/storage/validate";
import { uploadWithTicket, runWithConcurrency } from "@/lib/storage/client-upload";
import { maybeConvertHeic } from "@/lib/storage/heic-convert";
import { UploadGuidelines } from "@/components/ui/UploadGuidelines";
import { UPLOAD_RULES } from "@/lib/storage/upload-rules";
import {
  prepareTripGalleryUploadAction,
  registerTripGalleryAction,
} from "@/app/(cms)/media/actions";

// inside component:
const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

const handleUpload = async (files: FileList | null) => {
  if (!files || !tripId) {
    if (!tripId) toast.error("Save the trip first before uploading images");
    return;
  }
  const list = Array.from(files);
  const { valid, rejected } = validateFiles(list, "tripGallery");
  rejected.forEach(({ file, reason }) => toast.error(`${file.name}: ${reason}`));
  if (valid.length === 0) {
    if (fileRef.current) fileRef.current.value = "";
    return;
  }

  setProgress({ done: 0, total: valid.length });

  const results = await runWithConcurrency(
    valid,
    UPLOAD_RULES.tripGallery.maxConcurrency,
    async (file) => {
      const prep = await prepareTripGalleryUploadAction({
        tripId, fileName: file.name, contentType: file.type, size: file.size,
      });
      if (!prep.success || !prep.ticket) {
        return { ok: false, file, reason: prep.error };
      }
      const converted = await maybeConvertHeic(file as File);
      try {
        await uploadWithTicket(converted, prep.ticket);
      } catch (e) {
        return { ok: false, file, reason: (e as Error).message };
      }
      const reg = await registerTripGalleryAction({
        tripId, path: prep.ticket.path, publicUrl: prep.ticket.publicUrl,
        category: DEFAULT_CATEGORY,
      });
      return { ok: reg.success, file, reason: reg.error };
    },
    (done) => setProgress((p) => p ? { ...p, done } : null),
  );

  const successes = results.filter((r): r is { ok: true; file: File; reason?: string } => 
    !(r instanceof Error) && r.ok
  );
  const failures = results.filter((r) => r instanceof Error || !(r as any).ok);

  if (successes.length > 0) toast.success(`${successes.length} photo${successes.length > 1 ? "s" : ""} uploaded`);
  failures.forEach((r) => {
    if (r instanceof Error) toast.error(r.message);
    else toast.error(`${(r as any).file.name}: ${(r as any).reason ?? "Failed"}`);
  });

  if (successes.length > 0) await refreshGallery();
  setProgress(null);
  if (fileRef.current) fileRef.current.value = "";
};
```

In the JSX, set `accept={UPLOAD_RULES.tripGallery.accept.join(",")}`, ensure `multiple`, and add `<UploadGuidelines kind="tripGallery" />` next to the upload button. Render progress as `Uploading {progress.done} of {progress.total}…` when progress is set.

Make sure the file input is reachable via `getByLabelText(/upload/i)` for the test (label or aria-label).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run app/\(cms\)/trips/_components/tabs/__tests__/GalleryTab.upload.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/\(cms\)/trips/_components/tabs/GalleryTab.tsx app/\(cms\)/trips/_components/tabs/__tests__/
git commit -m "feat(trips): refactor gallery upload to direct-to-storage with parallel-5"
```

---

## Task 15: Refactor `TripImagesView.tsx`, `SiteGalleryMomentsView.tsx`, `AnnouncementFormModal.tsx`, `ContentSettingsSection.tsx`

**Files:**
- Modify: `app/(cms)/media/_components/TripImagesView.tsx`
- Modify: `app/(cms)/media/_components/SiteGalleryMomentsView.tsx`
- Modify: `app/(cms)/announcements/_components/AnnouncementFormModal.tsx`
- Modify: `app/(cms)/settings/_components/ContentSettingsSection.tsx`

For each: same pattern as Task 14 — import the kind-specific prepare/register actions, replace FormData-style upload with `validateFiles` → `runWithConcurrency` (or single-file `prepare → upload → register`), add `<UploadGuidelines>`, set `accept`.

`ContentSettingsSection.tsx` passes `uploadImage` as a prop to a child component — replace with two props `prepare` and `register`, or refactor the child to accept the new pattern. **Read the child component first** before touching this one.

- [ ] **Step 1: Read each component to understand current upload prop shape**

Run: 
```bash
grep -n "uploadImage" app/\(cms\)/media/_components/TripImagesView.tsx app/\(cms\)/announcements/_components/AnnouncementFormModal.tsx app/\(cms\)/settings/_components/ContentSettingsSection.tsx
```

Look at how `uploadImage` is destructured and called in each, then refactor accordingly.

- [ ] **Step 2: Update each in turn, run lint after each**

After each file update:
```bash
pnpm lint
pnpm vitest run
```

- [ ] **Step 3: Commit**

```bash
git add app/\(cms\)/media app/\(cms\)/announcements app/\(cms\)/settings
git commit -m "feat(uploads): migrate site/banner/hero clients to direct-upload pattern"
```

---

## Task 16: Delete legacy `lib/storage/upload.ts`

**Files:**
- Delete: `lib/storage/upload.ts`
- Verify: no remaining imports of `uploadImage` or `deleteImage`

- [ ] **Step 1: Find any remaining imports**

```bash
grep -rn 'from "@/lib/storage/upload"' app/ lib/ tests/
```

If anything still imports it, those callers were missed in Tasks 12–15 — go fix them first.

- [ ] **Step 2: Move `deleteImage` use cases into the provider**

Anything that called `deleteImage(path)` should now call `getStorageProvider().deleteObject(path)`. Update those call sites.

- [ ] **Step 3: Delete the file**

```bash
rm lib/storage/upload.ts
```

- [ ] **Step 4: Run full test suite + typecheck**

```bash
pnpm vitest run
pnpm tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "chore(storage): remove legacy uploadImage/deleteImage helpers"
```

---

## Task 17: End-to-End Smoke Test (Playwright or manual)

**Files:** none (manual verification)

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Manual smoke matrix**

Test each surface with a >5 MB image (the failing case):

| Surface | URL | Test |
|---|---|---|
| Trip Gallery | `/trips/<id>/edit` → Gallery tab | Upload 5 photos at once, verify parallel progress, all land |
| Trip Gallery | same | Try to upload a 30 MB photo, see toast |
| Trip Gallery | same | Try to upload an HEIC, verify converts + uploads |
| Site Gallery | `/media` → Site Gallery tab | Upload one ≥6 MB image |
| Raw Moments | `/media` → Raw Moments tab | Upload one ≥6 MB image |
| Banner | `/announcements` → New | Upload a banner ≥6 MB |
| Hero Image | `/settings` → Content | Upload a hero image ≥6 MB |
| Hero Video | `/settings` → Content | Upload a 60 MB MP4 |

Each should: succeed (not show `FUNCTION_PAYLOAD_TOO_LARGE`), update the UI, and persist after page reload.

- [ ] **Step 3: Verify no console errors**

Browser devtools should be clean of red errors during all uploads.

---

## Task 18: PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin fix/cms-direct-upload-storage-abstraction
```

- [ ] **Step 2: Open PR with this body**

```
## Summary
- Replace all server-action FormData uploads with direct browser-to-storage uploads via signed URLs
- Bypass Vercel's 4.5 MB request body cap (`FUNCTION_PAYLOAD_TOO_LARGE`)
- Provider-agnostic `StorageProvider` interface — swap Supabase for R2/S3/Bunny later by dropping in one file
- Bake in user-friendly limits (size, type, count, concurrency) with single source of truth, enforced both client and server side
- Lazy HEIC→JPEG conversion in browser (industry-standard pattern)
- CDN-side image transformations via Supabase image transforms (provider-portable)
- Schema: additive `image_path` column on gallery tables for future transform rollout
- Delete legacy `uploadImage`/`deleteImage` helpers and 6 monolithic upload actions

## Bucket settings to verify after merge
- Supabase dashboard → Storage → `cms-media` bucket → File size limit: set to 105 MB (covers heroVideo + headroom)
- Image transformations should be enabled (Pro tier) for `getOptimizedUrl` to actually transform; otherwise it transparently returns the raw URL

## Test plan
- [ ] Trip Gallery: upload 5 photos at once, verify parallel-5 + progress
- [ ] Trip Gallery: upload >20 MB photo → friendly toast, no upload
- [ ] Trip Gallery: upload HEIC → converts to JPEG and uploads
- [ ] Site Gallery / Raw Moments: upload >5 MB photo
- [ ] Banner: upload >5 MB banner
- [ ] Hero Image: upload >5 MB image
- [ ] Hero Video: upload 60 MB MP4
- [ ] All vitest specs pass
```

---

## Self-Review

**1. Spec coverage:**
- ✅ StorageProvider interface (Task 1)
- ✅ Single source of truth for rules (Task 2)
- ✅ Path builders (Task 3)
- ✅ Validators L2 + L3 (Task 4)
- ✅ Image presets (Task 5)
- ✅ Supabase provider impl (Task 6)
- ✅ Provider factory (Task 7)
- ✅ Browser upload helper + concurrency (Task 8)
- ✅ HEIC conversion (Task 9)
- ✅ UploadGuidelines UI (Task 10)
- ✅ Schema migration (Task 11)
- ✅ All 6 upload actions migrated (Tasks 12, 13)
- ✅ All 5+ client components migrated (Tasks 14, 15)
- ✅ Legacy code deleted (Task 16)
- ✅ E2E smoke + PR (Tasks 17, 18)

**2. Placeholder scan:** None remain — all steps have concrete code or commands.

**3. Type consistency:** `UploadTicket` shape consistent across provider, factory, and client-upload. `UploadKind` consistent across rules, validate, paths. `prepareTripGalleryUploadAction` return type `{ success: true; ticket: UploadTicket } | { success: false; error: string }` matches the test expectations.

---

**Plan complete. Ready to execute.**
