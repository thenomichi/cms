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
