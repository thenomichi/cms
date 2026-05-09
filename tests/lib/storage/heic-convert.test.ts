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
