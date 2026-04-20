import { cn } from "@/lib/utils";

interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Visual grouping for form fields within a wizard step or tab.
 * Renders a subtle bordered card with a section title.
 */
export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <div className={cn("rounded-xl border border-line bg-surface p-5", className)}>
      <div className="mb-4">
        <h4 className="text-[13px] font-semibold text-ink">{title}</h4>
        {description && <p className="mt-0.5 text-[12px] text-mid">{description}</p>}
      </div>
      {children}
    </div>
  );
}
