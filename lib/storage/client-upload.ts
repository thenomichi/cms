// lib/storage/client-upload.ts
import type { UploadTicket } from "./provider";

export async function uploadWithTicket(file: File | Blob, ticket: UploadTicket): Promise<void> {
  const res = await fetch(ticket.uploadUrl, {
    method: ticket.method,
    headers: ticket.headers,
    body: file,
  });
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
  }
}

/**
 * Bounded-parallel iterator. Returns one entry per input — either the
 * resolved value or the thrown Error. Caller decides what to do with errors.
 * onProgress is called after each completion with the running done-count.
 */
export async function runWithConcurrency<TIn, TOut>(
  items: TIn[],
  cap: number,
  fn: (item: TIn, index: number) => Promise<TOut>,
  onProgress?: (done: number) => void,
): Promise<(TOut | Error)[]> {
  const results: (TOut | Error)[] = new Array(items.length);
  let cursor = 0;
  let done = 0;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = await fn(items[i], i);
      } catch (e) {
        results[i] = e instanceof Error ? e : new Error(String(e));
      } finally {
        done++;
        onProgress?.(done);
      }
    }
  }

  const workers = Array.from({ length: Math.min(cap, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
