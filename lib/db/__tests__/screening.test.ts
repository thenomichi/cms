import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getServiceClient: vi.fn(),
}));
vi.mock("@/lib/ids", () => ({
  nextSequentialId: vi.fn(),
}));

import { getServiceClient } from "@/lib/supabase/server";
import { getActiveCatalog, countTripsWithScreeningEnabled } from "@/lib/db/screening";

type Mocked = ReturnType<typeof vi.fn>;

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
      eq: vi.fn().mockReturnThis().mockImplementationOnce(function (this: unknown) {
        return this;
      }),
    });
    // Replace with a chain that resolves at the second .eq()
    const finalEq = vi.fn().mockResolvedValue({ count: 7, error: null });
    const firstEq = vi.fn().mockReturnValue({ eq: finalEq });
    const select = vi.fn().mockReturnValue({ eq: firstEq });
    (getServiceClient as unknown as Mocked).mockReturnValue({
      from: vi.fn().mockReturnValue({ select }),
    });
    expect(await countTripsWithScreeningEnabled()).toBe(7);
  });
});
