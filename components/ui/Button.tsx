"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rust/40 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-rust text-white hover:bg-rust-d active:bg-rust-d",
        secondary:
          "bg-surface3 text-ink border border-line hover:bg-line2 active:bg-line",
        danger: "bg-sem-red-bg text-sem-red hover:bg-sem-red-bg/80",
        success: "bg-sem-green-bg text-sem-green hover:bg-sem-green-bg/80",
        ghost: "bg-transparent text-ink hover:bg-surface3 active:bg-line2",
      },
      size: {
        default: "h-9 px-4 text-sm",
        sm: "h-7 px-3 text-xs",
      },
      icon: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      { icon: true, size: "default", class: "h-9 w-9 px-0" },
      { icon: true, size: "sm", class: "h-7 w-7 px-0" },
    ],
    defaultVariants: {
      variant: "primary",
      size: "default",
      icon: false,
    },
  }
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  children?: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, icon, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, icon }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
export type { ButtonProps };
