import { Card } from "@/components/ui/Card";
import { FormSection } from "@/components/ui/FormSection";
import { Toggle } from "@/components/ui/Toggle";
import {
  SITE_FEATURE_FIELDS,
  SITE_FEATURE_GROUPS,
  type SiteFeatures,
} from "@/lib/site-features";
import { getBoolean } from "./settings-form-utils";

interface FeatureControlsSectionProps {
  data: Record<string, unknown>;
  siteFeatures: SiteFeatures;
  onUpdate: (path: string, value: unknown) => void;
}

function FeatureToggleRow({
  featureKey,
  title,
  description,
  enabled,
  checked,
  onChange,
}: {
  featureKey: string;
  title: string;
  description: string;
  enabled: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const titleId = `feature-control-${featureKey}`;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-soft/60 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p id={titleId} className="text-sm font-semibold text-ink">
            {title}
          </p>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              enabled ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
            }`}
          >
            {enabled ? "Live" : "Hidden"}
          </span>
        </div>
        <p className="mt-1 text-xs leading-5 text-mid">{description}</p>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line/80 pt-3 sm:min-w-[132px] sm:flex-col sm:items-end sm:justify-start sm:border-t-0 sm:pt-0">
        <span className="text-[11px] font-medium text-mid">
          {enabled ? "Visible to travellers" : "Hidden sitewide"}
        </span>
        <Toggle
          checked={checked}
          onChange={onChange}
          aria-labelledby={titleId}
          className="mt-0.5"
        />
      </div>
    </div>
  );
}

export function FeatureControlsSection({
  data,
  siteFeatures,
  onUpdate,
}: FeatureControlsSectionProps) {
  const visibleCount = Object.values(siteFeatures).filter(Boolean).length;
  const hiddenCount = Object.keys(siteFeatures).length - visibleCount;

  return (
    <section>
      <div className="mb-3">
        <h3 className="text-base font-semibold text-ink">Feature Controls</h3>
        <p className="mt-1 text-sm leading-6 text-mid">
          Keep all on/off switches in one predictable place. Each control is sitewide, so hiding a
          section removes its main entry points and blocks direct access too.
        </p>
      </div>

      <Card>
        <div className="space-y-5">
          <div className="rounded-2xl border border-rust/15 bg-rust/5 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink">
                {SITE_FEATURE_FIELDS.length} total controls
              </span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                {visibleCount} live
              </span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                {hiddenCount} hidden
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-mid">
              Tip: use these only for business decisions like “should this be available right now?”.
              For copy edits, use the content area below.
            </p>
          </div>

          {SITE_FEATURE_GROUPS.map((group) => {
            const fields = SITE_FEATURE_FIELDS.filter((feature) => feature.group === group.key);
            return (
              <FormSection
                key={group.key}
                title={group.title}
                description={group.description}
                className="bg-soft/35 p-4"
              >
                <div className="space-y-3">
                  {fields.map((feature) => {
                    const enabled = siteFeatures[feature.key];
                    return (
                      <FeatureToggleRow
                        key={feature.key}
                        featureKey={feature.key}
                        title={feature.title}
                        description={feature.description}
                        enabled={enabled}
                        checked={getBoolean(data, `features.${feature.key}.enabled`, enabled)}
                        onChange={(checked) => onUpdate(`features.${feature.key}.enabled`, checked)}
                      />
                    );
                  })}
                </div>
              </FormSection>
            );
          })}
        </div>
      </Card>
    </section>
  );
}
