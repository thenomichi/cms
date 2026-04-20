import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

function FormField({
  label,
  hint,
  error,
  required,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-[11px] font-bold uppercase tracking-wider text-ink3">
        {label}
        {required && <span className="ml-0.5 text-sem-red">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-mid">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-sem-red">{error}</p>
      )}
    </div>
  );
}

export { FormField };
export type { FormFieldProps };
