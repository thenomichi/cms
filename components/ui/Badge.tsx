import { type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        green: "bg-sem-green-bg text-sem-green",
        red: "bg-sem-red-bg text-sem-red",
        rust: "bg-rust-tint text-rust",
        blue: "bg-sem-blue-bg text-sem-blue",
        gray: "bg-surface3 text-mid",
        amber: "bg-sem-amber-bg text-sem-amber",
        purple: "bg-sem-purple-bg text-sem-purple",
      },
    },
    defaultVariants: {
      variant: "gray",
    },
  }
);

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: ReactNode;
  className?: string;
}

function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)}>
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
export type { BadgeProps };
