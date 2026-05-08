"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Status = "idle" | "saving" | "saved" | "retrying" | "localOnly";

interface SaveResult {
  success: boolean;
  tripId?: string;
  savedAt?: string;
  error?: string;
}

interface UseAutosaveOpts {
  tripId: string | null;
  userId: string;
  save: (tripId: string | null, payload: Record<string, unknown>) => Promise<SaveResult>;
  debounceMs?: number;
  /** Backoff schedule for retries (ms). Caps at last value indefinitely. */
  backoffMs?: readonly number[];
}

const DEFAULT_BACKOFF = [2000, 5000, 15000, 30000, 60000] as const;

/**
 * Debounced autosave with localStorage mirror + retry.
 *
 * State transitions:
 *   idle -> saving -> saved
 *   saving -> retrying (on failure) -> (backoff) -> saving -> saved
 *   saving -> localOnly (when server returns DESTINATION_REQUIRED)
 *
 * The hook owns its own tripId ref so consumers don't need to manage
 * materialization state. After the server materializes a row, the hook's
 * `tripId` updates and subsequent saves go to the resolved id.
 */
export function useAutosave({
  tripId: initialTripId,
  userId,
  save,
  debounceMs = 1500,
  backoffMs = DEFAULT_BACKOFF,
}: UseAutosaveOpts) {
  const [status, setStatus] = useState<Status>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [tripId, setTripId] = useState<string | null>(initialTripId);

  const tripIdRef = useRef(initialTripId);
  const pendingRef = useRef<Record<string, unknown> | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttempt = useRef(0);

  const lsKey = useCallback(
    (id: string | null) => `nomichi.trip-draft.${userId}.${id ?? "NEW"}`,
    [userId],
  );

  const writeMirror = useCallback(
    (payload: Record<string, unknown>) => {
      try {
        localStorage.setItem(lsKey(tripIdRef.current), JSON.stringify(payload));
      } catch {
        // Quota or access errors are non-fatal — server save still tries.
      }
    },
    [lsKey],
  );

  const clearMirror = useCallback(() => {
    try {
      localStorage.removeItem(lsKey(tripIdRef.current));
    } catch {}
  }, [lsKey]);

  const performSave = useCallback(async () => {
    const payload = pendingRef.current;
    if (!payload) return;
    setStatus("saving");
    const res = await save(tripIdRef.current, payload);
    if (res.success) {
      retryAttempt.current = 0;
      if (res.tripId && res.tripId !== tripIdRef.current) {
        // Migrate localStorage from NEW (or old id) to materialized id.
        clearMirror();
        tripIdRef.current = res.tripId;
        setTripId(res.tripId);
      } else {
        clearMirror();
      }
      pendingRef.current = null;
      setLastSavedAt(res.savedAt ?? new Date().toISOString());
      setStatus("saved");
      return;
    }
    if (res.error === "DESTINATION_REQUIRED") {
      setStatus("localOnly");
      return;
    }
    setStatus("retrying");
    const delay = backoffMs[Math.min(retryAttempt.current, backoffMs.length - 1)];
    retryAttempt.current += 1;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => {
      void performSave();
    }, delay);
  }, [save, backoffMs, clearMirror]);

  const queue = useCallback(
    (payload: Record<string, unknown>) => {
      pendingRef.current = payload;
      writeMirror(payload);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        void performSave();
      }, debounceMs);
    },
    [debounceMs, performSave, writeMirror],
  );

  const flush = useCallback(async () => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    await performSave();
  }, [performSave]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  return { status, lastSavedAt, tripId, queue, flush };
}
