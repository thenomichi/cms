export type SiteFeatureKey =
  | "join_a_trip"
  | "beyond_ordinary"
  | "signature_journeys"
  | "plan_a_trip"
  | "gift_a_trip"
  | "about"
  | "careers";

export type SiteFeatures = Record<SiteFeatureKey, boolean>;

export type SiteFeatureGroupKey =
  | "trip_discovery"
  | "planning_and_gifting"
  | "company_pages";

export const DEFAULT_SITE_FEATURES: SiteFeatures = {
  join_a_trip: true,
  beyond_ordinary: true,
  signature_journeys: true,
  plan_a_trip: true,
  gift_a_trip: true,
  about: true,
  careers: true,
};

export const SITE_FEATURE_GROUPS: Array<{
  key: SiteFeatureGroupKey;
  title: string;
  description: string;
}> = [
  {
    key: "trip_discovery",
    title: "Trips people can browse",
    description:
      "Main travel categories that appear in navigation, homepage discovery, and other browse surfaces.",
  },
  {
    key: "planning_and_gifting",
    title: "Planning and gifting",
    description:
      "Support journeys where someone is planning a custom trip or gifting a travel experience.",
  },
  {
    key: "company_pages",
    title: "Brand and company pages",
    description:
      "Informational pages that help travellers understand the brand and career opportunities.",
  },
];

export const SITE_FEATURE_FIELDS: Array<{
  key: SiteFeatureKey;
  title: string;
  description: string;
  group: SiteFeatureGroupKey;
}> = [
  {
    key: "join_a_trip",
    title: "Soulful Escapes",
    group: "trip_discovery",
    description:
      "Soulful Escapes (community trip) pages and all their entry points. Hides desktop nav, mobile nav, footer links, homepage trip discovery, and blocks direct access. Route remains /join-a-trip for backward compatibility.",
  },
  {
    key: "beyond_ordinary",
    title: "Beyond Ordinary",
    group: "trip_discovery",
    description:
      "Invite-only journey pages and all related discovery links, including homepage filters and route access.",
  },
  {
    key: "signature_journeys",
    title: "Signature Journeys",
    group: "trip_discovery",
    description:
      "Signature honeymoon and milestone journeys across navigation, homepage entry points, footer, and direct URLs.",
  },
  {
    key: "plan_a_trip",
    title: "Plan a Trip",
    group: "planning_and_gifting",
    description:
      "Custom trip planner surfaces, including homepage cards, nav links, footer links, and direct route access.",
  },
  {
    key: "gift_a_trip",
    title: "Gift a Trip",
    group: "planning_and_gifting",
    description: "Gift trip page visibility in desktop nav, mobile nav, footer entry points, and direct route access.",
  },
  {
    key: "about",
    title: "About Us",
    group: "company_pages",
    description: "About page visibility in navigation, footer, and direct route access.",
  },
  {
    key: "careers",
    title: "Build With Us / Careers",
    group: "company_pages",
    description: "Careers page visibility in navigation, footer, and direct route access.",
  },
];

function coerceFeatureValue(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value && typeof value === "object" && "enabled" in value) {
    const enabled = (value as { enabled?: unknown }).enabled;
    if (typeof enabled === "boolean") return enabled;
  }
  return fallback;
}

export function normalizeSiteFeatures(raw: unknown): SiteFeatures {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const normalized = { ...DEFAULT_SITE_FEATURES };

  for (const feature of SITE_FEATURE_FIELDS) {
    normalized[feature.key] = coerceFeatureValue(
      source[feature.key],
      DEFAULT_SITE_FEATURES[feature.key],
    );
  }

  return normalized;
}
