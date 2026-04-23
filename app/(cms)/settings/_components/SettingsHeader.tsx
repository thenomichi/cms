import { Button } from "@/components/ui/Button";

interface SettingsHeaderProps {
  pending: boolean;
  onSave: () => void;
}

export function SettingsHeader({ pending, onSave }: SettingsHeaderProps) {
  return (
    <div className="mb-6 rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rust">
            Website Settings
          </p>
          <h2 className="mt-2 text-lg font-bold text-ink">One place to manage what is live</h2>
          <p className="mt-1 text-sm leading-6 text-mid">
            Use <span className="font-semibold text-ink">Feature controls</span> to turn parts of
            the website on or off. Use <span className="font-semibold text-ink">Content settings</span>{" "}
            to change the text, contact details, and brand copy that visitors see.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Button onClick={onSave} disabled={pending}>
            {pending ? "Saving..." : "Save All Settings"}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-dashed border-line/80 bg-transparent px-4 py-3">
          <p className="text-sm font-semibold text-ink">Feature controls</p>
          <p className="mt-1 text-xs leading-5 text-mid">
            Best for simple yes or no decisions like whether travellers can browse a section, apply
            a coupon, or access a booking flow.
          </p>
        </div>
        <div className="rounded-lg border border-dashed border-line/80 bg-transparent px-4 py-3">
          <p className="text-sm font-semibold text-ink">Content settings</p>
          <p className="mt-1 text-xs leading-5 text-mid">
            Best for editing the copy and contact details inside sections that are already live.
          </p>
        </div>
      </div>
    </div>
  );
}
