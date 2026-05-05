/**
 * Tests for uploadTripItineraryAction. Covers the validation gates
 * (trip id, mime type, size) and the success path (storage upload +
 * audit row).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseFake, type SupabaseFake } from "../_helpers/supabase-fake";

let current: SupabaseFake = makeSupabaseFake();

vi.mock("@/lib/supabase/server", () => ({ getServiceClient: () => current.client }));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("@/lib/revalidate", () => ({
  revalidateHome: vi.fn(async () => {}),
  revalidateTrip: vi.fn(async () => {}),
  revalidateAbout: vi.fn(async () => {}),
  revalidateCareers: vi.fn(async () => {}),
  revalidateReview: vi.fn(async () => {}),
  revalidateWebsite: vi.fn(async () => {}),
}));

beforeEach(() => { current = makeSupabaseFake(); });

function makePdfFile(opts: { name?: string; size?: number; type?: string } = {}): File {
  const size = opts.size ?? 100;
  const data = new Uint8Array(size);
  return new File([data], opts.name ?? "itinerary.pdf", {
    type: opts.type ?? "application/pdf",
  });
}

describe("uploadTripItineraryAction", () => {
  it("rejects empty trip id", async () => {
    const { uploadTripItineraryAction } = await import("@/app/(cms)/trips/actions");
    const r = await uploadTripItineraryAction("", makePdfFile());
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/trip id/i);
  });

  it("rejects unsafe trip id characters", async () => {
    const { uploadTripItineraryAction } = await import("@/app/(cms)/trips/actions");
    const r = await uploadTripItineraryAction("../etc/passwd", makePdfFile());
    expect(r.success).toBe(false);
  });

  it("rejects non-PDF MIME types", async () => {
    const { uploadTripItineraryAction } = await import("@/app/(cms)/trips/actions");
    const r = await uploadTripItineraryAction(
      "TRIP-1",
      makePdfFile({ type: "image/jpeg" }),
    );
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/PDF/i);
  });

  it("rejects files over 25MB", async () => {
    const big = makePdfFile({ size: 26 * 1024 * 1024 });
    const { uploadTripItineraryAction } = await import("@/app/(cms)/trips/actions");
    const r = await uploadTripItineraryAction("TRIP-1", big);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/25/);
  });

  it("uploads, returns the public URL, and writes an audit log entry", async () => {
    current = makeSupabaseFake({
      "audit_log:insert": { data: null, error: null },
    });
    const { uploadTripItineraryAction } = await import("@/app/(cms)/trips/actions");
    const r = await uploadTripItineraryAction("TRIP-1", makePdfFile());
    expect(r.success).toBe(true);
    expect(r.url).toMatch(/^https:\/\/example\.com\/cms-media\/trip-itinerary\/TRIP-1-\d+\.pdf$/);
    const audit = current.log.find((l) => l.from === "audit_log") as any;
    expect(audit.payload.action).toBe("UPDATE");
    expect(audit.payload.new_values).toMatchObject({ itinerary_uploaded: true });
  });

  it("returns { success:false, error } when storage upload fails", async () => {
    current = makeSupabaseFake({
      "storage:cms-media:upload": { data: null, error: { message: "denied" } },
    });
    const { uploadTripItineraryAction } = await import("@/app/(cms)/trips/actions");
    const r = await uploadTripItineraryAction("TRIP-1", makePdfFile());
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Upload failed|denied/);
  });
});
