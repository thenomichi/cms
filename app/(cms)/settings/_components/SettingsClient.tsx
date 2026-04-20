"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { RichTextInput, toHtml, fromHtml } from "@/components/ui/RichTextInput";
import { updateSettingsAction } from "../actions";

interface Props {
  initialSettings: Record<string, unknown>;
}

function get(obj: Record<string, unknown>, path: string): string {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return "";
    }
  }
  return String(cur ?? "");
}

function set(obj: Record<string, unknown>, path: string, value: string): Record<string, unknown> {
  const copy = JSON.parse(JSON.stringify(obj));
  const parts = path.split(".");
  let cur = copy;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in cur) || typeof cur[parts[i]] !== "object") {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
  return copy;
}

export function SettingsClient({ initialSettings }: Props) {
  const [data, setData] = useState(initialSettings);
  useEffect(() => { setData(initialSettings); }, [initialSettings]);
  const [pending, startTransition] = useTransition();

  const update = (path: string, value: string) => {
    setData((prev) => set(prev, path, value));
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        await updateSettingsAction(data);
        toast.success("Settings saved!");
      } catch {
        toast.error("Failed to save settings");
      }
    });
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-ink">Website Config</h2>
          <p className="text-xs text-mid">Changes are applied to your website after save</p>
        </div>
        <Button onClick={handleSave} disabled={pending}>
          {pending ? "Saving..." : "Save All Settings"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Hero Section */}
        <Card title="Hero Section" subtitle="Homepage hero banner">
          <div className="mt-4 flex flex-col gap-3">
            <FormField label="Headline">
              <RichTextInput
                value={fromHtml(get(data, "hero.headline"))}
                onChange={(v) => update("hero.headline", toHtml(v))}
                placeholder="e.g. Travel experiences for people who want to *feel something*"
              />
            </FormField>
            <FormField label="Subline">
              <input
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-rust"
                value={get(data, "hero.subline")}
                onChange={(e) => update("hero.subline", e.target.value)}
                placeholder="Community-first. Handcrafted. Always offbeat."
              />
            </FormField>
          </div>
        </Card>

        {/* Stats Band */}
        <Card title="Stats Band" subtitle="Numbers shown on the about page">
          <div className="mt-4 flex flex-col gap-3">
            <FormField label="Trips Completed">
              <input
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-rust"
                value={get(data, "stats.trips_completed")}
                onChange={(e) => update("stats.trips_completed", e.target.value)}
                placeholder="100+"
              />
            </FormField>
            <FormField label="Travellers Count">
              <input
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-rust"
                value={get(data, "stats.travellers_count")}
                onChange={(e) => update("stats.travellers_count", e.target.value)}
                placeholder="350+"
              />
            </FormField>
            <FormField label="Average Rating">
              <input
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-rust"
                value={get(data, "stats.avg_rating")}
                onChange={(e) => update("stats.avg_rating", e.target.value)}
                placeholder="4.9"
              />
            </FormField>
          </div>
        </Card>

        {/* Contact Information */}
        <Card title="Contact Information" subtitle="Displayed in footer and contact page">
          <div className="mt-4 flex flex-col gap-3">
            <FormField label="Phone">
              <input
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-rust"
                value={get(data, "contact.phone")}
                onChange={(e) => update("contact.phone", e.target.value)}
                placeholder="+91 70009 62406"
              />
            </FormField>
            <FormField label="Email">
              <input
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-rust"
                value={get(data, "contact.email")}
                onChange={(e) => update("contact.email", e.target.value)}
                placeholder="hello@thenomichi.com"
              />
            </FormField>
            <FormField label="Instagram URL">
              <input
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-rust"
                value={get(data, "contact.instagram")}
                onChange={(e) => update("contact.instagram", e.target.value)}
                placeholder="https://instagram.com/thenomichi"
              />
            </FormField>
            <FormField label="WhatsApp Number">
              <input
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-rust"
                value={get(data, "contact.whatsapp")}
                onChange={(e) => update("contact.whatsapp", e.target.value)}
                placeholder="917000962406"
              />
            </FormField>
            <FormField label="Location">
              <input
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-rust"
                value={get(data, "contact.location")}
                onChange={(e) => update("contact.location", e.target.value)}
                placeholder="Bengaluru, India"
              />
            </FormField>
          </div>
        </Card>

        {/* Brand Copy */}
        <Card title="Brand Copy" subtitle="Footer and general brand messaging">
          <div className="mt-4 flex flex-col gap-3">
            <FormField label="Brand Description">
              <textarea
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-rust"
                rows={3}
                value={get(data, "brand.description")}
                onChange={(e) => update("brand.description", e.target.value)}
                placeholder="Travel experiences for people who want to feel something..."
              />
            </FormField>
            <FormField label="Footer Tagline">
              <input
                className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-rust"
                value={get(data, "brand.tagline")}
                onChange={(e) => update("brand.tagline", e.target.value)}
                placeholder="Find Your Kind of Travel"
              />
            </FormField>
          </div>
        </Card>
      </div>
    </div>
  );
}
