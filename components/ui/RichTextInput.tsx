"use client";

import { cn } from "@/lib/utils";

/**
 * Convert user-friendly *asterisk* notation to <em> tags for storage.
 * "Trip is *back* for booking" → "Trip is <em>back</em> for booking"
 */
export function toHtml(text: string): string {
  return text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

/**
 * Convert stored <em> tags back to *asterisk* for editing.
 * "Trip is <em>back</em> for booking" → "Trip is *back* for booking"
 */
export function fromHtml(html: string): string {
  return html.replace(/<em>([^<]+)<\/em>/g, "*$1*");
}

/**
 * Render a preview of text with *asterisks* shown as emphasized.
 */
function Preview({ text }: { text: string }) {
  if (!text) return null;
  // Split on *word* pattern, render emphasized spans
  const parts = text.split(/(\*[^*]+\*)/g);
  return (
    <div className="mt-2 rounded-lg bg-ink px-4 py-3 text-sm text-white/90">
      <p className="text-[10px] font-medium uppercase tracking-wider text-white/40 mb-1">Preview</p>
      <p>
        {parts.map((part, i) => {
          if (part.startsWith("*") && part.endsWith("*")) {
            return <em key={i} className="text-rust-l font-medium not-italic">{part.slice(1, -1)}</em>;
          }
          return <span key={i}>{part}</span>;
        })}
      </p>
    </div>
  );
}

interface RichTextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Text input that supports *emphasis* notation.
 * - User types: "Trip is *back* for booking"
 * - Preview shows emphasized word
 * - On save, caller converts to HTML via toHtml()
 * - On load, caller converts from HTML via fromHtml()
 */
export function RichTextInput({ value, onChange, placeholder, className }: RichTextInputProps) {
  return (
    <div>
      <input
        type="text"
        className={cn(
          "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20",
          className,
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <p className="mt-1 text-[11px] text-fog">
        Wrap words in *asterisks* to highlight them — e.g. Trip is *back* for booking
      </p>
      {value.includes("*") && <Preview text={value} />}
    </div>
  );
}
