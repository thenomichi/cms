import { cn } from "@/lib/utils";

interface SkeletonProps {
  variant?: "text" | "card" | "table-row";
  className?: string;
}

function Skeleton({ variant = "text", className }: SkeletonProps) {
  const base = "animate-pulse rounded bg-surface3";

  switch (variant) {
    case "text":
      return <div className={cn(base, "h-4 w-3/4", className)} />;
    case "card":
      return <div className={cn(base, "h-32 w-full rounded-xl", className)} />;
    case "table-row":
      return <div className={cn(base, "h-12 w-full", className)} />;
    default:
      return <div className={cn(base, "h-4 w-3/4", className)} />;
  }
}

export { Skeleton };
export type { SkeletonProps };
