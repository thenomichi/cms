"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FormField } from "@/components/ui/FormField";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { GALLERY_CATEGORIES } from "@/lib/constants";
import type { DbTripGallery } from "@/lib/types";
import {
  uploadTripGalleryAction,
  fetchTripGalleryImages,
  deleteGalleryImageAction,
  toggleGalleryFeaturedAction,
  toggleGalleryCoverAction,
} from "../../../media/actions";

interface Props {
  tripId: string | null;
  gallery: DbTripGallery[];
  onGalleryChange: (gallery: DbTripGallery[]) => void;
}

export function GalleryTab({ tripId, gallery: initialGallery, onGalleryChange }: Props) {
  const [images, setImages] = useState(initialGallery);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("gallery");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Refresh gallery from server
  async function refreshGallery() {
    if (!tripId) return;
    const fresh = await fetchTripGalleryImages(tripId);
    setImages(fresh);
    onGalleryChange(fresh);
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files || !tripId) {
      if (!tripId) toast.error("Save the trip first before uploading images");
      return;
    }
    setUploading(true);
    let count = 0;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("trip_id", tripId);
      fd.append("category", category);
      const res = await uploadTripGalleryAction(fd);
      if (res.success) count++;
      else toast.error(res.error ?? "Upload failed");
    }
    if (count > 0) {
      toast.success(`${count} image(s) uploaded`);
      await refreshGallery();
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setImages((prev) => prev.filter((g) => g.gallery_id !== deleteId));
    const res = await deleteGalleryImageAction(deleteId);
    if (res.success) {
      toast.success("Image deleted");
    } else {
      await refreshGallery(); // revert
      toast.error(res.error ?? "Delete failed");
    }
    setDeleteId(null);
  };

  const handleToggleFeatured = async (id: string, current: boolean) => {
    setImages((prev) => prev.map((g) => g.gallery_id === id ? { ...g, is_featured: !current } : g));
    const res = await toggleGalleryFeaturedAction(id, !current);
    if (!res.success) await refreshGallery();
  };

  const handleSetCover = async (id: string) => {
    if (!tripId) return;
    setImages((prev) => prev.map((g) => ({ ...g, is_cover: g.gallery_id === id })));
    const res = await toggleGalleryCoverAction(tripId, id);
    if (res.success) {
      toast.success("Cover image set");
    } else {
      await refreshGallery();
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload section */}
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Category">
          <select
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-rust"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {GALLERY_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </FormField>
        <div>
          <Button onClick={() => fileRef.current?.click()} disabled={uploading || !tripId}>
            {uploading ? "Uploading..." : "Upload Images"}
          </Button>
          {!tripId && (
            <p className="mt-1 text-[11px] text-mid">Save the trip first to upload images</p>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {/* Gallery grid */}
      {images.length === 0 ? (
        <div className="py-10 text-center text-sm text-mid">
          No images yet. Upload images using the button above.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img) => (
            <div key={img.gallery_id} className="group relative overflow-hidden rounded-lg border border-line bg-surface">
              <img
                src={img.image_url}
                alt={img.alt_text ?? ""}
                className="h-24 w-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div className="p-2">
                <div className="flex flex-wrap gap-1">
                  {img.is_cover && <Badge variant="rust">Cover</Badge>}
                  {img.is_featured && <Badge variant="amber">Featured</Badge>}
                  <Badge variant="gray">{img.category}</Badge>
                </div>
              </div>
              <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white"
                  onClick={() => handleSetCover(img.gallery_id)}
                  title="Set as cover"
                >
                  🖼
                </button>
                <button
                  className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white"
                  onClick={() => handleToggleFeatured(img.gallery_id, img.is_featured ?? false)}
                  title="Toggle featured"
                >
                  ⭐
                </button>
                <button
                  className="rounded bg-red-600/80 px-1.5 py-0.5 text-[10px] text-white"
                  onClick={() => setDeleteId(img.gallery_id)}
                  title="Delete"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete image?"
        message="This image will be permanently removed."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
