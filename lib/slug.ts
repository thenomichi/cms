/**
 * Convert a user-entered label into a stable snake_case slug used as a
 * DB key (question_key, option_key, axis_key). Result satisfies the
 * regex ^[a-z][a-z0-9_]*$ enforced by the website's CHECK constraints,
 * or is "" when no usable chars remain.
 */
export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/['"]+/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[0-9]+/, "")
    .replace(/^_+/, "");
}
