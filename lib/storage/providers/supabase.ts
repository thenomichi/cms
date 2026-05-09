// lib/storage/providers/supabase.ts
import { getServiceClient } from "@/lib/supabase/server";
import type {
  StorageProvider,
  UploadTicket,
  CreateUploadTicketInput,
  TransformOpts,
} from "../provider";

const BUCKET = "cms-media";
const TICKET_TTL_MS = 60 * 60 * 1000; // 1 hour

export class SupabaseStorageProvider implements StorageProvider {
  async createUploadTicket(input: CreateUploadTicketInput): Promise<UploadTicket> {
    const sb = getServiceClient();
    const { data, error } = await sb.storage
      .from(BUCKET)
      .createSignedUploadUrl(input.path);
    if (error || !data) {
      throw new Error(`createSignedUploadUrl failed: ${error?.message ?? "unknown"}`);
    }
    return {
      uploadUrl: data.signedUrl,
      method: "PUT",
      headers: {
        "content-type": input.contentType,
        "x-upsert": "false",
        authorization: `Bearer ${data.token}`,
      },
      path: data.path ?? input.path,
      publicUrl: this.getPublicUrl(input.path),
      expiresAt: Date.now() + TICKET_TTL_MS,
    };
  }

  async deleteObject(path: string): Promise<void> {
    const sb = getServiceClient();
    const { error } = await sb.storage.from(BUCKET).remove([path]);
    if (error) throw new Error(`storage.remove failed: ${error.message}`);
  }

  getPublicUrl(path: string): string {
    const sb = getServiceClient();
    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  getOptimizedUrl(path: string, opts: TransformOpts): string {
    const params = new URLSearchParams();
    if (opts.width) params.set("width", String(opts.width));
    if (opts.height) params.set("height", String(opts.height));
    if (opts.quality) params.set("quality", String(opts.quality));
    if (opts.format && opts.format !== "auto") params.set("format", opts.format);
    if (opts.fit) params.set("resize", opts.fit);
    if (params.size === 0) return this.getPublicUrl(path);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    return `${url}/storage/v1/render/image/public/${BUCKET}/${path}?${params.toString()}`;
  }
}
