import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(
  amount: number | null | undefined,
  currency = "INR",
): string {
  if (amount == null) return "\u2014";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function generateId(prefix: string): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const seg = (n: number) =>
    Array.from(
      { length: n },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join("");
  return `${prefix}-${seg(4)}-${seg(4)}`;
}
