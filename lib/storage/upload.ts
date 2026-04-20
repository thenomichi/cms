import { getServiceClient } from "@/lib/supabase/server";

export async function uploadImage(
  file: File,
  path: string, // e.g. "trip-gallery/hampi/cover-1714567890.webp"
): Promise<string> {
  const db = getServiceClient();
  const { error } = await db.storage.from("cms-media").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const {
    data: { publicUrl },
  } = db.storage.from("cms-media").getPublicUrl(path);
  return publicUrl;
}

export async function deleteImage(path: string): Promise<void> {
  const db = getServiceClient();
  const { error } = await db.storage.from("cms-media").remove([path]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}
