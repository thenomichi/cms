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
    case "tripCover":
      return `trip-cover/${input.tripId ?? "unassigned"}/${stamped}`;
    case "tripGallery":
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
