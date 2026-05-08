import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAutosave } from "../useAutosave";

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useAutosave", () => {
  it("starts in 'idle' status before any payload arrives", () => {
    const save = vi.fn();
    const { result } = renderHook(() =>
      useAutosave({ tripId: null, userId: "u1", save, debounceMs: 1500 }),
    );
    expect(result.current.status).toBe("idle");
  });

  it("debounces the save call by debounceMs", async () => {
    const save = vi.fn().mockResolvedValue({ success: true, tripId: "T1", savedAt: new Date().toISOString() });
    const { result } = renderHook(() =>
      useAutosave({ tripId: null, userId: "u1", save, debounceMs: 1500 }),
    );
    act(() => result.current.queue({ trip_name: "A" }));
    expect(save).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1499));
    expect(save).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  });

  it("only fires the latest payload after rapid edits", async () => {
    const save = vi.fn().mockResolvedValue({ success: true, tripId: "T1", savedAt: "" });
    const { result } = renderHook(() =>
      useAutosave({ tripId: null, userId: "u1", save, debounceMs: 1500 }),
    );
    act(() => result.current.queue({ trip_name: "A" }));
    act(() => vi.advanceTimersByTime(500));
    act(() => result.current.queue({ trip_name: "AB" }));
    act(() => vi.advanceTimersByTime(500));
    act(() => result.current.queue({ trip_name: "ABC" }));
    act(() => vi.advanceTimersByTime(1500));
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith(null, expect.objectContaining({ trip_name: "ABC" }));
  });

  it("mirrors to localStorage on every queue", () => {
    const save = vi.fn();
    const { result } = renderHook(() =>
      useAutosave({ tripId: null, userId: "u1", save, debounceMs: 1500 }),
    );
    act(() => result.current.queue({ trip_name: "A" }));
    const raw = localStorage.getItem("nomichi.trip-draft.u1.NEW");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toMatchObject({ trip_name: "A" });
  });

  it("retries on save failure with backoff", async () => {
    const save = vi.fn()
      .mockResolvedValueOnce({ success: false, error: "boom" })
      .mockResolvedValueOnce({ success: true, tripId: "T1", savedAt: "" });
    const { result } = renderHook(() =>
      useAutosave({ tripId: null, userId: "u1", save, debounceMs: 1500 }),
    );
    act(() => result.current.queue({ trip_name: "A" }));
    act(() => vi.advanceTimersByTime(1500));
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(result.current.status).toBe("retrying"));
    act(() => vi.advanceTimersByTime(2000));
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(result.current.status).toBe("saved"));
  });

  it("transitions to 'localOnly' status when DESTINATION_REQUIRED is returned", async () => {
    const save = vi.fn().mockResolvedValue({ success: false, error: "DESTINATION_REQUIRED" });
    const { result } = renderHook(() =>
      useAutosave({ tripId: null, userId: "u1", save, debounceMs: 1500 }),
    );
    act(() => result.current.queue({ trip_name: "A" }));
    act(() => vi.advanceTimersByTime(1500));
    await vi.waitFor(() => expect(result.current.status).toBe("localOnly"));
  });

  it("clears localStorage on successful save", async () => {
    const save = vi.fn().mockResolvedValue({ success: true, tripId: "T1", savedAt: "" });
    const { result } = renderHook(() =>
      useAutosave({ tripId: null, userId: "u1", save, debounceMs: 1500 }),
    );
    act(() => result.current.queue({ trip_name: "A" }));
    act(() => vi.advanceTimersByTime(1500));
    await vi.waitFor(() => expect(save).toHaveBeenCalled());
    await vi.waitFor(() => expect(localStorage.getItem("nomichi.trip-draft.u1.NEW")).toBeNull());
  });

  it("flush() saves immediately and cancels pending debounce", async () => {
    const save = vi.fn().mockResolvedValue({ success: true, tripId: "T1", savedAt: "" });
    const { result } = renderHook(() =>
      useAutosave({ tripId: null, userId: "u1", save, debounceMs: 1500 }),
    );
    act(() => result.current.queue({ trip_name: "A" }));
    await act(async () => { await result.current.flush(); });
    expect(save).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(1500));
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("updates internal tripId ref when server returns a materialized id", async () => {
    const save = vi.fn().mockResolvedValue({ success: true, tripId: "T_MAT", savedAt: "" });
    const { result } = renderHook(() =>
      useAutosave({ tripId: null, userId: "u1", save, debounceMs: 1500 }),
    );
    act(() => result.current.queue({ trip_name: "A", destination_id: "BLR" }));
    act(() => vi.advanceTimersByTime(1500));
    await vi.waitFor(() => expect(save).toHaveBeenCalled());
    await vi.waitFor(() => expect(result.current.tripId).toBe("T_MAT"));
    // Subsequent queue should pass T_MAT, not null.
    act(() => result.current.queue({ trip_name: "AB", destination_id: "BLR" }));
    act(() => vi.advanceTimersByTime(1500));
    await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save).toHaveBeenLastCalledWith("T_MAT", expect.any(Object));
  });
});
