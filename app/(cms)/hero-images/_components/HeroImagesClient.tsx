"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { updatePageHeroImage, type PageHeroKey } from "../actions";

interface HeroImageRow {
  page_key: PageHeroKey;
  image_light: string | null;
  image_dark: string | null;
  alt_text: string | null;
  updated_at: string;
}

interface Props {
  rows: HeroImageRow[];
}

const PAGE_LABELS: Record<PageHeroKey, string> = {
  "soulful-escapes": "Soulful Escapes",
  "beyond-ordinary": "Beyond Ordinary",
  "signature-journeys": "Signature Journeys",
  home: "Home",
  "plan-a-trip": "Plan a Trip",
  about: "About",
};

function HeroRowEditor({ row }: { row: HeroImageRow }) {
  const [light, setLight] = useState(row.image_light ?? "");
  const [dark, setDark] = useState(row.image_dark ?? "");
  const [alt, setAlt] = useState(row.alt_text ?? "");
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const res = await updatePageHeroImage(row.page_key, {
        image_light: light || null,
        image_dark: dark || null,
        alt_text: alt || null,
      });
      if (res.success) {
        toast.success(`${PAGE_LABELS[row.page_key]} updated`);
      } else {
        toast.error(res.error ?? "Save failed");
      }
    });
  };

  const inputClass =
    "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20 placeholder:text-fog";

  return (
    <div className="rounded-xl border border-line bg-surface p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{PAGE_LABELS[row.page_key]}</h3>
        <span className="text-[11px] text-fog font-mono">{row.page_key}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Light image */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-mid">Light image URL</label>
          <input
            type="url"
            className={inputClass}
            placeholder="https://..."
            value={light}
            onChange={(e) => setLight(e.target.value)}
          />
          {light && (
            <div className="h-20 w-full overflow-hidden rounded-lg border border-line">
              <img src={light} alt="light preview" className="h-full w-full object-cover" />
            </div>
          )}
        </div>

        {/* Dark image */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-mid">
            Dark image URL{" "}
            <span className="text-fog font-normal">(falls back to light)</span>
          </label>
          <input
            type="url"
            className={inputClass}
            placeholder="https://..."
            value={dark}
            onChange={(e) => setDark(e.target.value)}
          />
          {dark && (
            <div className="h-20 w-full overflow-hidden rounded-lg border border-line">
              <img src={dark} alt="dark preview" className="h-full w-full object-cover" />
            </div>
          )}
        </div>
      </div>

      {/* Alt text */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-mid">Alt text</label>
        <input
          type="text"
          className={inputClass}
          placeholder="Describe the image for accessibility..."
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-[11px] text-fog">
          Last updated: {new Date(row.updated_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
        </span>
        <Button onClick={handleSave} disabled={isPending} size="sm">
          {isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}

export function HeroImagesClient({ rows }: Props) {
  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <HeroRowEditor key={row.page_key} row={row} />
      ))}
    </div>
  );
}
