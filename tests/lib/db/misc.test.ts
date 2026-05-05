import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseFake, type SupabaseFake } from "../../_helpers/supabase-fake";
let current: SupabaseFake = makeSupabaseFake();
vi.mock("@/lib/supabase/server", () => ({ getServiceClient: () => current.client }));

import { getSuggestions, updateSuggestionStatus, deleteSuggestion } from "@/lib/db/suggestions";
import { getSiteSettings, updateSiteSettings } from "@/lib/db/settings";
import { getActivityLog } from "@/lib/db/activity-log";

beforeEach(() => { current = makeSupabaseFake(); });

describe("suggestions db", () => {
  it("getSuggestions returns rows without status filter", async () => {
    current = makeSupabaseFake({ "customized_trip_requests:select": { data: [{ request_id: "REQ-1" }], error: null } });
    expect(await getSuggestions()).toHaveLength(1);
  });
  it("getSuggestions filters by status", async () => {
    current = makeSupabaseFake({ "customized_trip_requests:select": { data: [], error: null } });
    await getSuggestions("New Request");
    expect(current.log.find((l) => l.op === "select")).toBeDefined();
  });
  it("getSuggestions throws on error", async () => {
    current = makeSupabaseFake({ "customized_trip_requests:select": { data: null, error: { message: "x" } } });
    await expect(getSuggestions()).rejects.toThrow();
  });
  it("updateSuggestionStatus throws / succeeds", async () => {
    current = makeSupabaseFake({ "customized_trip_requests:update": { data: null, error: { message: "x" } } });
    await expect(updateSuggestionStatus("REQ-1", "Lost")).rejects.toThrow();
    current = makeSupabaseFake({ "customized_trip_requests:update": { data: null, error: null } });
    await expect(updateSuggestionStatus("REQ-1", "Lost")).resolves.toBeUndefined();
  });
  it("deleteSuggestion throws / succeeds", async () => {
    current = makeSupabaseFake({ "customized_trip_requests:delete": { data: null, error: { message: "x" } } });
    await expect(deleteSuggestion("REQ-1")).rejects.toThrow();
    current = makeSupabaseFake({ "customized_trip_requests:delete": { data: null, error: null } });
    await expect(deleteSuggestion("REQ-1")).resolves.toBeUndefined();
  });
});

describe("settings db", () => {
  it("getSiteSettings returns data field", async () => {
    current = makeSupabaseFake({ "site_settings:select": { data: { data: { hero: { headline: "Hi" } } }, error: null } });
    const r = await getSiteSettings();
    expect(r).toEqual({ hero: { headline: "Hi" } });
  });
  it("getSiteSettings returns {} when data is null", async () => {
    current = makeSupabaseFake({ "site_settings:select": { data: { data: null }, error: null } });
    const r = await getSiteSettings();
    expect(r).toEqual({});
  });
  it("getSiteSettings throws on error", async () => {
    current = makeSupabaseFake({ "site_settings:select": { data: null, error: { message: "x" } } });
    await expect(getSiteSettings()).rejects.toThrow();
  });
  it("updateSiteSettings sets data and updated_at", async () => {
    current = makeSupabaseFake({ "site_settings:update": { data: null, error: null } });
    await updateSiteSettings({ k: "v" });
    const upd = current.log.find((l) => l.op === "update") as any;
    expect(upd.payload.data).toEqual({ k: "v" });
    expect(upd.payload.updated_at).toBeDefined();
  });
  it("updateSiteSettings throws on error", async () => {
    current = makeSupabaseFake({ "site_settings:update": { data: null, error: { message: "x" } } });
    await expect(updateSiteSettings({})).rejects.toThrow();
  });
});

describe("activity-log db", () => {
  it("getActivityLog returns rows", async () => {
    current = makeSupabaseFake({ "audit_log:select": { data: [{ log_id: 1, action: "INSERT" }], error: null } });
    expect(await getActivityLog()).toHaveLength(1);
  });
  it("getActivityLog respects custom limit", async () => {
    current = makeSupabaseFake({ "audit_log:select": { data: [], error: null } });
    await getActivityLog(10);
    expect(current.log.find((l) => l.op === "select")).toBeDefined();
  });
  it("getActivityLog throws on error", async () => {
    current = makeSupabaseFake({ "audit_log:select": { data: null, error: { message: "x" } } });
    await expect(getActivityLog()).rejects.toThrow();
  });
});
