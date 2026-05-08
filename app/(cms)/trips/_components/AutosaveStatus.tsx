"use client";

import { useEffect, useState } from "react";

interface Props {
  status: "idle" | "saving" | "saved" | "retrying" | "localOnly";
  lastSavedAt: string | null;
}

function relTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 5_000) return "just now";
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min ago`;
  return `${Math.round(diff / 3_600_000)}h ago`;
}

/**
 * Top-bar pill that surfaces autosave state to the user. Tick re-renders
 * once a second so "just now" decays to "5s ago" without keystrokes.
 */
export function AutosaveStatus({ status, lastSavedAt }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const config = (() => {
    switch (status) {
      case "saving":   return { color: "bg-mid",       text: "Saving…",                       title: "Autosaving your changes." };
      case "saved":    return { color: "bg-sem-green", text: `Saved · ${relTime(lastSavedAt)}`, title: "Your work is autosaved." };
      case "retrying": return { color: "bg-rust",      text: "Couldn't save — retrying",       title: "Your changes are safe in this browser." };
      case "localOnly":return { color: "bg-sem-amber", text: "Saved on this device",           title: "Pick a destination to start syncing to the server." };
      default:         return { color: "bg-fog",       text: "",                               title: "" };
    }
  })();

  if (!config.text) return null;
  return (
    <span title={config.title} className="flex items-center gap-1.5 text-[11px] font-medium text-mid whitespace-nowrap">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${config.color}`} />
      {config.text}
    </span>
  );
}
