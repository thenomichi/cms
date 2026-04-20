"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterPills } from "@/components/ui/FilterPills";
import { formatDate } from "@/lib/utils";
import type { ActivityLogEntry } from "@/lib/db/activity-log";

const ACTION_BADGES: Record<string, "green" | "blue" | "amber" | "red" | "gray"> = {
  INSERT: "green",
  CREATE: "green",
  UPDATE: "blue",
  DELETE: "red",
  TOGGLE: "amber",
};

const TABLE_LABELS: Record<string, string> = {
  trips: "Trip",
  trip_content: "Trip Content",
  trip_itinerary: "Itinerary",
  trip_gallery: "Gallery Image",
  trip_inclusions: "Inclusion",
  trip_faqs: "FAQ",
  reviews: "Review",
  announcements: "Announcement",
  destinations: "Destination",
  team_members: "Team Member",
  career_listings: "Career",
  site_settings: "Website Config",
  site_gallery: "Site Gallery",
  raw_moments: "Real Moment",
  payment_orders: "Payment",
  bookings: "Booking",
};

function getTableLabel(table: string): string {
  return TABLE_LABELS[table] ?? table.replace(/_/g, " ");
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function summarizeChanges(entry: ActivityLogEntry): string {
  const { action, new_values, table_name } = entry;

  if (action === "INSERT" || action === "CREATE") {
    const name =
      (new_values as Record<string, unknown>)?.trip_name ??
      (new_values as Record<string, unknown>)?.question ??
      (new_values as Record<string, unknown>)?.headline ??
      (new_values as Record<string, unknown>)?.title ??
      (new_values as Record<string, unknown>)?.full_name ??
      (new_values as Record<string, unknown>)?.destination_name ??
      entry.record_id;
    return `Created ${getTableLabel(table_name)}: ${name}`;
  }

  if (action === "DELETE") {
    return `Deleted ${getTableLabel(table_name)}: ${entry.record_id}`;
  }

  if (action === "UPDATE") {
    if (!new_values) return `Updated ${getTableLabel(table_name)}`;
    const keys = Object.keys(new_values as Record<string, unknown>);
    const fields = keys.filter((k) => !["updated_at", "created_at"].includes(k));
    if (fields.length <= 3) {
      return `Updated ${getTableLabel(table_name)}: ${fields.join(", ")}`;
    }
    return `Updated ${getTableLabel(table_name)} (${fields.length} fields)`;
  }

  return `${action} on ${getTableLabel(table_name)}`;
}

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "trips", label: "Trips" },
  { value: "reviews", label: "Reviews" },
  { value: "announcements", label: "Announcements" },
  { value: "destinations", label: "Destinations" },
  { value: "settings", label: "Config" },
];

export function ActivityClient({ logs }: { logs: ActivityLogEntry[] }) {
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all"
    ? logs
    : filter === "settings"
      ? logs.filter((l) => l.table_name === "site_settings")
      : logs.filter((l) => l.table_name.includes(filter.replace(/s$/, "")));

  // Group by date
  const grouped: Record<string, ActivityLogEntry[]> = {};
  for (const log of filtered) {
    const day = formatDate(log.created_at);
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(log);
  }

  return (
    <div className="space-y-5">
      <FilterPills options={FILTER_OPTIONS} value={filter} onChange={setFilter} />

      {filtered.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No activity yet"
          description="Changes made through the CMS will appear here"
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, entries]) => (
            <div key={date}>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-mid">{date}</h3>
              <div className="space-y-1">
                {entries.map((entry) => (
                  <div
                    key={entry.log_id}
                    className="flex items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 transition-colors hover:bg-surface2"
                  >
                    {/* Time */}
                    <span className="shrink-0 pt-0.5 font-mono text-[11px] text-fog">
                      {formatTime(entry.created_at)}
                    </span>

                    {/* Action badge */}
                    <Badge variant={ACTION_BADGES[entry.action] ?? "gray"}>
                      {entry.action}
                    </Badge>

                    {/* Summary */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">{summarizeChanges(entry)}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-fog">
                        {entry.record_id}
                      </p>
                    </div>

                    {/* Who */}
                    {entry.performed_by && (
                      <span className="shrink-0 text-xs text-mid">
                        {entry.performed_by}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
