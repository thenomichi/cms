"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormSection } from "@/components/ui/FormSection";
import { Plus, AlertCircle, Calendar, ImageOff, FileEdit } from "lucide-react";
import { formatDate, formatPrice } from "@/lib/utils";
import type { DashboardStats } from "@/lib/db/dashboard";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function typeBadge(type: string | null) {
  const map: Record<string, "blue" | "purple" | "amber" | "green"> = {
    Community: "blue", "Beyond Ordinary": "purple",
    "Signature Journey": "amber", "Plan a Trip": "green",
  };
  return <Badge variant={map[type ?? ""] ?? "gray"}>{type ?? "—"}</Badge>;
}

function statusBadge(status: string | null) {
  const map: Record<string, "green" | "blue" | "amber" | "red" | "gray"> = {
    Draft: "gray", Upcoming: "blue", Ongoing: "green",
    Completed: "amber", Cancelled: "red",
  };
  return <Badge variant={map[status ?? ""] ?? "gray"}>{status ?? "—"}</Badge>;
}

function slotsDisplay(booked: number | null, total: number | null) {
  const b = booked ?? 0;
  const t = total ?? 0;
  if (t === 0) return <span className="text-xs text-fog">No slots set</span>;
  const pct = Math.round((b / t) * 100);
  const color = pct >= 85 ? "bg-sem-red" : pct >= 50 ? "bg-sem-amber" : "bg-sem-green";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-surface3">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs text-mid">{b}/{t}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardClient({ stats }: { stats: DashboardStats }) {
  const router = useRouter();

  const hasAttentionItems =
    stats.pendingReviews > 0 ||
    stats.newSuggestions > 0 ||
    stats.tripsNeedingImages.length > 0 ||
    stats.draftTrips.length > 0;

  return (
    <div className="space-y-6">

      {/* ── Row 1: Key metrics (what matters) ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          className="cursor-pointer rounded-xl border border-line bg-surface p-5 transition-shadow hover:shadow-md"
          onClick={() => router.push("/trips")}
        >
          <p className="text-xs font-medium uppercase tracking-wider text-mid">Active Trips</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-ink">{stats.activeTrips}</p>
          <p className="mt-1 text-xs text-fog">of {stats.totalTrips} total</p>
        </div>

        <div
          className="cursor-pointer rounded-xl border border-line bg-surface p-5 transition-shadow hover:shadow-md"
          onClick={() => router.push("/reviews")}
        >
          <p className="text-xs font-medium uppercase tracking-wider text-mid">Reviews</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-ink">{stats.totalReviews}</p>
          {stats.pendingReviews > 0 ? (
            <Badge variant="rust" className="mt-1">{stats.pendingReviews} pending approval</Badge>
          ) : (
            <p className="mt-1 text-xs text-fog">All approved</p>
          )}
        </div>

        <div
          className="cursor-pointer rounded-xl border border-line bg-surface p-5 transition-shadow hover:shadow-md"
          onClick={() => router.push("/suggestions")}
        >
          <p className="text-xs font-medium uppercase tracking-wider text-mid">Trip Inquiries</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-ink">{stats.totalSuggestions}</p>
          {stats.newSuggestions > 0 ? (
            <Badge variant="rust" className="mt-1">{stats.newSuggestions} new</Badge>
          ) : (
            <p className="mt-1 text-xs text-fog">All responded</p>
          )}
        </div>

        <div
          className="cursor-pointer rounded-xl border border-line bg-surface p-5 transition-shadow hover:shadow-md"
          onClick={() => router.push("/media")}
        >
          <p className="text-xs font-medium uppercase tracking-wider text-mid">Gallery</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-ink">{stats.totalGalleryImages}</p>
          <p className="mt-1 text-xs text-fog">images uploaded</p>
        </div>
      </div>

      {/* ── Row 2: Quick Actions ── */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => router.push("/trips")} variant="secondary" size="sm">
          <Plus className="h-3.5 w-3.5" /> New Trip
        </Button>
        <Button onClick={() => router.push("/reviews")} variant="secondary" size="sm">
          <Plus className="h-3.5 w-3.5" /> Add Review
        </Button>
        <Button onClick={() => router.push("/media")} variant="secondary" size="sm">
          <Plus className="h-3.5 w-3.5" /> Upload Photos
        </Button>
        <Button onClick={() => router.push("/announcements")} variant="secondary" size="sm">
          <Plus className="h-3.5 w-3.5" /> New Banner
        </Button>
      </div>

      {/* ── Row 3: Two columns — Attention + Upcoming ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

        {/* Needs Attention */}
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rust" />
            <h3 className="text-sm font-semibold text-ink">Needs Your Attention</h3>
          </div>

          {!hasAttentionItems ? (
            <div className="py-6 text-center text-sm text-mid">
              All caught up! Nothing needs attention right now.
            </div>
          ) : (
            <div className="space-y-2">
              {stats.pendingReviews > 0 && (
                <div
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-line px-4 py-3 transition-colors hover:bg-surface2"
                  onClick={() => router.push("/reviews")}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">⭐</span>
                    <div>
                      <p className="text-sm font-medium text-ink">{stats.pendingReviews} review{stats.pendingReviews > 1 ? "s" : ""} awaiting approval</p>
                      <p className="text-xs text-mid">Approve to show on website</p>
                    </div>
                  </div>
                  <Badge variant="rust">Action needed</Badge>
                </div>
              )}

              {stats.newSuggestions > 0 && (
                <div
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-line px-4 py-3 transition-colors hover:bg-surface2"
                  onClick={() => router.push("/suggestions")}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">💬</span>
                    <div>
                      <p className="text-sm font-medium text-ink">{stats.newSuggestions} new trip inquiry</p>
                      <p className="text-xs text-mid">Respond to potential travellers</p>
                    </div>
                  </div>
                  <Badge variant="rust">New</Badge>
                </div>
              )}

              {stats.tripsNeedingImages.length > 0 && (
                <div
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-line px-4 py-3 transition-colors hover:bg-surface2"
                  onClick={() => router.push("/media")}
                >
                  <div className="flex items-center gap-3">
                    <ImageOff className="h-5 w-5 text-mid" />
                    <div>
                      <p className="text-sm font-medium text-ink">{stats.tripsNeedingImages.length} trip{stats.tripsNeedingImages.length > 1 ? "s" : ""} without images</p>
                      <p className="text-xs text-mid">{stats.tripsNeedingImages.map((t) => t.trip_name).join(", ")}</p>
                    </div>
                  </div>
                  <Badge variant="amber">Upload</Badge>
                </div>
              )}

              {stats.draftTrips.length > 0 && (
                <div
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-line px-4 py-3 transition-colors hover:bg-surface2"
                  onClick={() => router.push("/trips")}
                >
                  <div className="flex items-center gap-3">
                    <FileEdit className="h-5 w-5 text-mid" />
                    <div>
                      <p className="text-sm font-medium text-ink">{stats.draftTrips.length} draft trip{stats.draftTrips.length > 1 ? "s" : ""}</p>
                      <p className="text-xs text-mid">{stats.draftTrips.map((t) => t.trip_name).join(", ")}</p>
                    </div>
                  </div>
                  <Badge variant="gray">Draft</Badge>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Upcoming Departures */}
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-rust" />
            <h3 className="text-sm font-semibold text-ink">Upcoming Departures</h3>
            <span className="text-xs text-fog">Next 60 days</span>
          </div>

          {stats.upcomingDepartures.length === 0 ? (
            <div className="py-6 text-center text-sm text-mid">
              No upcoming departures in the next 60 days
            </div>
          ) : (
            <div className="space-y-2">
              {stats.upcomingDepartures.map((t) => (
                <div
                  key={t.trip_id}
                  className="flex items-center justify-between rounded-lg border border-line px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{t.trip_name}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-xs text-mid">{formatDate(t.start_date)}</span>
                      <span className="text-[10px] text-fog">{t.duration_days}D/{t.duration_nights}N</span>
                    </div>
                  </div>
                  <div className="ml-3 flex items-center gap-3">
                    {slotsDisplay(t.booked_slots, t.total_slots)}
                    {typeBadge(t.trip_type)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Row 4: Recent Trips ── */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Recently Added Trips</h3>
          <Button variant="secondary" size="sm" onClick={() => router.push("/trips")}>
            View All
          </Button>
        </div>

        {stats.recentTrips.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-2xl">✈️</p>
            <p className="mt-2 text-sm text-mid">No trips yet</p>
            <Button className="mt-3" size="sm" onClick={() => router.push("/trips")}>
              <Plus className="h-3.5 w-3.5" /> Create Your First Trip
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-surface2">
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-mid">Trip</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-mid">Dates</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-mid">Traveller Pays</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-mid">Slots</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-mid">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentTrips.map((t) => (
                  <tr key={t.trip_id} className="border-t border-line2 hover:bg-surface2">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{t.trip_name ?? "Untitled"}</p>
                      <p className="text-xs text-mid">{t.destination_name ?? "—"}</p>
                      <p className="font-mono text-[10px] text-fog">{t.trip_id}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {t.start_date ? (
                        <div>
                          <p className="text-xs text-ink">{formatDate(t.start_date)}</p>
                          <p className="text-[10px] text-fog">{t.duration_days}D / {t.duration_nights}N</p>
                        </div>
                      ) : (
                        <span className="text-xs text-fog">Not set</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="text-sm font-medium text-ink">
                          {formatPrice(t.selling_price ?? t.quoted_price ?? t.mrp_price)}
                        </span>
                        {t.mrp_price && t.selling_price && t.mrp_price > t.selling_price && (
                          <p className="text-[10px] text-fog line-through">{formatPrice(t.mrp_price)}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {slotsDisplay(t.booked_slots, t.total_slots)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {statusBadge(t.status)}
                        {t.is_listed && <Badge variant="green">Live</Badge>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
