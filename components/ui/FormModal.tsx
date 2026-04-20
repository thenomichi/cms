"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

function FormModal({ open, onClose, title, children, footer, wide }: FormModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={cn(
          "relative mt-10 flex max-h-[calc(100vh-80px)] w-full flex-col rounded-xl bg-surface shadow-xl",
          wide ? "max-w-[1000px]" : "max-w-[780px]"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-mid hover:bg-surface3 hover:text-ink transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export { FormModal };
export type { FormModalProps };
