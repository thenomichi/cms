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

  it("trip cover path lives under trip-cover/, separate from trip-gallery", () => {
    const c = buildPath("tripCover", { tripId: "T1", fileName: "cover.jpg" });
    const g = buildPath("tripGallery", { tripId: "T1", fileName: "shot.jpg" });
    expect(c).toMatch(/^trip-cover\/T1\/\d+-cover\.jpg$/);
    expect(g).toMatch(/^trip-gallery\/T1\/\d+-shot\.jpg$/);
  });
});
