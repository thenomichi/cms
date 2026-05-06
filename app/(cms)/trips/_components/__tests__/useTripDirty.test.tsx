import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTripDirty } from "../useTripDirty";

describe("useTripDirty", () => {
  it("starts clean", () => {
    const { result } = renderHook(() => useTripDirty());
    expect(result.current.isDirty).toBe(false);
  });

  it("becomes dirty when a field is marked", () => {
    const { result } = renderHook(() => useTripDirty());
    act(() => result.current.markDirty("trip_name"));
    expect(result.current.isDirty).toBe(true);
  });

  it("returns to clean after reset", () => {
    const { result } = renderHook(() => useTripDirty());
    act(() => result.current.markDirty("trip_name"));
    act(() => result.current.reset());
    expect(result.current.isDirty).toBe(false);
  });

  it("multiple marks of the same key still produce one dirty entry", () => {
    const { result } = renderHook(() => useTripDirty());
    act(() => {
      result.current.markDirty("trip_name");
      result.current.markDirty("trip_name");
    });
    expect(result.current.dirtyKeys).toEqual(["trip_name"]);
  });
});
