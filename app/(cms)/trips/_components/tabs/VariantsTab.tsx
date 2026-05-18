"use client";

// Implementation lives in phase 10. This stub satisfies TripEditor's import
// during the screening-tab phase and is replaced atomically by the next commit.

import type { FullVariantAxis } from "@/lib/db/trip-variants";

interface VariantsTabProps {
  groupSlug: string | null;
  tripSlug: string;
  initialAxes: FullVariantAxis[];
  onGotoBasic: () => void;
}

export function VariantsTab(_props: VariantsTabProps) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface3 p-6 text-sm text-mid">
      Trip Variants coming up next.
    </div>
  );
}
