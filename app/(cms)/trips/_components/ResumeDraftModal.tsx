"use client";

import { useRouter } from "next/navigation";
import type { DbTrip } from "@/lib/types";

interface Props {
  draft: DbTrip;
  onDismiss: () => void;
}

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)} days ago`;
}

/**
 * Surfaced on /trips/new when the current admin has an autosave-tracked
 * Draft sitting in the database. "Start fresh" leaves the draft in place
 * — they'll see it again next time, and it shows up in the trips list
 * with a "Drafts" filter.
 */
export function ResumeDraftModal({ draft, onDismiss }: Props) {
  const router = useRouter();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-5 shadow-xl">
        <h3 className="text-base font-semibold text-ink">Pick up where you left off?</h3>
        <p className="mt-1 text-sm text-mid">
          You have an unfinished trip from {relTime(draft.last_autosaved_at)}.
        </p>
        <div className="mt-4 rounded-lg border border-line bg-surface3 p-3 text-sm">
          <div className="font-medium text-ink">{draft.trip_name || "Untitled draft"}</div>
          <div className="mt-0.5 text-xs text-mid">
            {draft.duration_days ? `${draft.duration_days} days` : "No duration set"}
            {draft.start_date ? ` · starts ${draft.start_date}` : ""}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-mid hover:bg-surface3"
          >
            Start fresh
          </button>
          <button
            type="button"
            onClick={() => router.push(`/trips/${draft.trip_id}/edit`)}
            className="rounded-lg bg-rust px-3 py-1.5 text-sm font-medium text-white hover:bg-rust/90"
          >
            Resume editing
          </button>
        </div>
      </div>
    </div>
  );
}
