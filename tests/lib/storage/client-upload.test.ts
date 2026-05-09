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
