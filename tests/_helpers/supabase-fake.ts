/**
 * Chainable Supabase client fake for unit tests.
 *
 * The chain remembers the originating root operation (select/insert/update/
 * delete/upsert). Results are keyed by `${table}:${rootOp}` so subsequent
 * `.eq().select().single()` calls all resolve to the same programmed value.
 *
 *   programmed = {
 *     "team_members:select": { data: [{ member_id: "TM-001" }], error: null },
 *     "team_members:insert": { data: { member_id: "TM-002" }, error: null },
 *     "team_members:update": { data: { member_id: "TM-001" }, error: null },
 *     "rpc:nm_next_sequential_id": { data: "TM-002", error: null },
 *     "storage:cms-media:upload": { data: { path: "x.jpg" }, error: null },
 *   };
 */

type ProgrammedResult = { data: unknown; error: { message: string; code?: string } | null; count?: number };
type Programmed = Record<string, ProgrammedResult>;

export interface SupabaseFake {
  client: any;
  log: Array<Record<string, unknown>>;
  reset: () => void;
}

export function makeSupabaseFake(programmed: Programmed = {}): SupabaseFake {
  const log: Array<Record<string, unknown>> = [];

  function makeChain(table: string, rootOp: string): any {
    const key = `${table}:${rootOp}`;
    const programmedResult = programmed[key] ?? { data: null, error: null };

    const thenable = (resolve: any, reject?: any) => Promise.resolve(programmedResult).then(resolve, reject);

    const chain: any = {
      then: thenable,
      catch: (reject: any) => Promise.resolve(programmedResult).catch(reject),
      finally: (cb: any) => Promise.resolve(programmedResult).finally(cb),
      eq: () => chain,
      neq: () => chain,
      ilike: () => chain,
      like: () => chain,
      in: () => chain,
      gt: () => chain,
      gte: () => chain,
      lt: () => chain,
      lte: () => chain,
      not: () => chain,
      or: () => chain,
      filter: () => chain,
      order: () => chain,
      limit: () => chain,
      range: () => chain,
      single: () => chain,
      select: () => chain,
      maybeSingle: () => chain,
    };
    return chain;
  }

  const client = {
    from: (table: string) => ({
      select: (cols?: string, opts?: any) => {
        log.push({ from: table, op: "select", cols, opts });
        return makeChain(table, "select");
      },
      insert: (payload: unknown) => {
        log.push({ from: table, op: "insert", payload });
        return makeChain(table, "insert");
      },
      update: (payload: unknown) => {
        log.push({ from: table, op: "update", payload });
        return makeChain(table, "update");
      },
      delete: () => {
        log.push({ from: table, op: "delete" });
        return makeChain(table, "delete");
      },
      upsert: (payload: unknown) => {
        log.push({ from: table, op: "upsert", payload });
        return makeChain(table, "upsert");
      },
    }),
    rpc: (fn: string, args?: unknown) => {
      log.push({ rpc: fn, args });
      const key = `rpc:${fn}`;
      const result = programmed[key] ?? { data: null, error: null };
      return Promise.resolve(result);
    },
    storage: {
      from: (bucket: string) => ({
        upload: (path: string, file: unknown, opts?: unknown) => {
          log.push({ storage: bucket, op: "upload", path, opts });
          const key = `storage:${bucket}:upload`;
          return Promise.resolve(programmed[key] ?? { data: { path }, error: null });
        },
        remove: (paths: string[]) => {
          log.push({ storage: bucket, op: "remove", paths });
          const key = `storage:${bucket}:remove`;
          return Promise.resolve(programmed[key] ?? { data: paths, error: null });
        },
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://example.com/${bucket}/${path}` },
        }),
        updateBucket: (_id: string, _opts: unknown) => Promise.resolve({ data: null, error: null }),
        getBucket: (_id: string) => Promise.resolve({
          data: { id: _id, allowed_mime_types: [] },
          error: null,
        }),
      }),
    },
  };

  return {
    client,
    log,
    reset: () => log.splice(0, log.length),
  };
}
