// lib/storage/provider.ts

/**
 * UploadTicket: provider-agnostic envelope for a direct browser-to-storage
 * upload. The browser does `fetch(uploadUrl, { method, headers, body: file })`
 * and the bytes never pass through our server.
 */
export interface UploadTicket {
  uploadUrl: string;
  method: "PUT" | "POST";
  headers: Record<string, string>;
  path: string;
  publicUrl: string;
  expiresAt: number; // ms epoch — clients can refresh if elapsed
}

export interface TransformOpts {
  width?: number;
  height?: number;
  quality?: number; // 1-100
  format?: "webp" | "avif" | "auto";
  fit?: "cover" | "contain";
}

export interface CreateUploadTicketInput {
  path: string;
  contentType: string;
}

export interface StorageProvider {
  /** Server-only. Mints a short-lived upload URL the browser can PUT/POST to. */
  createUploadTicket(input: CreateUploadTicketInput): Promise<UploadTicket>;

  /** Server-only. Deletes by path. */
  deleteObject(path: string): Promise<void>;

  /** Pure. Canonical public URL for a stored object. */
  getPublicUrl(path: string): string;

  /** Pure. Provider's CDN transform URL. Falls back to public URL if unsupported. */
  getOptimizedUrl(path: string, opts: TransformOpts): string;
}
