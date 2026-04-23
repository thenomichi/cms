"use client";

import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { updateSettingsAction } from "../actions";
import { normalizeSiteFeatures } from "@/lib/site-features";
import { FeatureControlsSection } from "./FeatureControlsSection";
import { ContentSettingsSection } from "./ContentSettingsSection";
import { SettingsHeader } from "./SettingsHeader";
import { setSettingsValue } from "./settings-form-utils";

interface Props {
  initialSettings: Record<string, unknown>;
}

export function SettingsClient({ initialSettings }: Props) {
  const [data, setData] = useState(initialSettings);
  useEffect(() => { setData(initialSettings); }, [initialSettings]);
  const [pending, startTransition] = useTransition();
  const siteFeatures = normalizeSiteFeatures(
    data && typeof data === "object" ? (data as { features?: unknown }).features : undefined,
  );

  const update = (path: string, value: unknown) => {
    setData((prev) => setSettingsValue(prev, path, value));
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        const result = await updateSettingsAction(data);
        if (!result.success) {
          throw new Error(result.error || "Failed to save settings");
        }
        toast.success("Settings saved!");
      } catch {
        toast.error("Failed to save settings");
      }
    });
  };

  return (
    <div className="space-y-6">
      <SettingsHeader pending={pending} onSave={handleSave} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.3fr)]">
        <div className="xl:self-start">
          <FeatureControlsSection data={data} siteFeatures={siteFeatures} onUpdate={update} />
        </div>
        <div>
          <ContentSettingsSection data={data} onUpdate={update} />
        </div>
      </div>
    </div>
  );
}
