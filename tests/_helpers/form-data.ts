/**
 * Build a FormData instance for action tests.
 * Booleans stringify to "true"/"false" to mirror what the browser sends.
 */
export function fd(values: Record<string, unknown>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      for (const item of v) f.append(k, String(item));
    } else if (typeof v === "boolean") {
      f.set(k, v ? "true" : "false");
    } else {
      f.set(k, String(v));
    }
  }
  return f;
}
