const MEALS_PREFIX = "Meals:";
const ACCOMMODATION_PREFIX = "Accommodation:";
const MEALS_WRAPPED_PREFIX = "Meals[";
const ACCOMMODATION_WRAPPED_PREFIX = "Accommodation[";

export interface ParsedItineraryTags {
  meals: string;
  accommodation: string;
  genericTags: string[];
}

function normalizeFreeText(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ");
}

function storageNormalizeReserved(value: string): string {
  return normalizeFreeText(value).replace(/\s*,\s*/g, " / ");
}

function uiNormalizeReserved(value: string): string {
  return normalizeFreeText(value).replace(/\s*\/\s*/g, ", ");
}

function splitTags(tags: string | null | undefined): string[] {
  const input = (tags ?? "").trim();
  if (!input) return [];

  const parts: string[] = [];
  let current = "";
  let bracketDepth = 0;

  for (const char of input) {
    if (char === "[") bracketDepth += 1;
    if (char === "]" && bracketDepth > 0) bracketDepth -= 1;

    if (char === "," && bracketDepth === 0) {
      const trimmed = current.trim();
      if (trimmed) parts.push(trimmed);
      current = "";
      continue;
    }

    current += char;
  }

  const tail = current.trim();
  if (tail) parts.push(tail);
  return parts;
}

export function parseItineraryTags(
  tags: string | null | undefined,
): ParsedItineraryTags {
  const parsed: ParsedItineraryTags = {
    meals: "",
    accommodation: "",
    genericTags: [],
  };

  for (const tag of splitTags(tags)) {
    const lower = tag.toLowerCase();
    if (
      lower.startsWith(MEALS_WRAPPED_PREFIX.toLowerCase()) &&
      tag.endsWith("]")
    ) {
      parsed.meals = uiNormalizeReserved(
        tag.slice(MEALS_WRAPPED_PREFIX.length, -1).trim(),
      );
      continue;
    }
    if (
      lower.startsWith(ACCOMMODATION_WRAPPED_PREFIX.toLowerCase()) &&
      tag.endsWith("]")
    ) {
      parsed.accommodation = uiNormalizeReserved(
        tag.slice(ACCOMMODATION_WRAPPED_PREFIX.length, -1).trim(),
      );
      continue;
    }
    if (lower.startsWith(MEALS_PREFIX.toLowerCase())) {
      parsed.meals = uiNormalizeReserved(tag.slice(MEALS_PREFIX.length).trim());
      continue;
    }
    if (lower.startsWith(ACCOMMODATION_PREFIX.toLowerCase())) {
      parsed.accommodation = uiNormalizeReserved(
        tag.slice(ACCOMMODATION_PREFIX.length).trim(),
      );
      continue;
    }
    parsed.genericTags.push(tag);
  }

  return parsed;
}

export function stringifyItineraryTags({
  meals,
  accommodation,
  genericTags,
}: ParsedItineraryTags): string | null {
  const cleanedGeneric = genericTags
    .map((tag) => normalizeFreeText(tag))
    .filter(Boolean)
    .filter((tag) => {
      const lower = tag.toLowerCase();
      return (
        !lower.startsWith(MEALS_PREFIX.toLowerCase()) &&
        !lower.startsWith(ACCOMMODATION_PREFIX.toLowerCase()) &&
        !lower.startsWith(MEALS_WRAPPED_PREFIX.toLowerCase()) &&
        !lower.startsWith(ACCOMMODATION_WRAPPED_PREFIX.toLowerCase())
      );
    });

  const next: string[] = [];
  const normalizedMeals = storageNormalizeReserved(meals);
  const normalizedAccommodation = storageNormalizeReserved(accommodation);

  if (normalizedMeals) next.push(`${MEALS_PREFIX} ${normalizedMeals}`);
  if (normalizedAccommodation) {
    next.push(`${ACCOMMODATION_PREFIX} ${normalizedAccommodation}`);
  }

  next.push(...cleanedGeneric);

  return next.length > 0 ? next.join(", ") : null;
}

