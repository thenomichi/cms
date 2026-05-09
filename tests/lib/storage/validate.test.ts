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
