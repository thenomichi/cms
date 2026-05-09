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
