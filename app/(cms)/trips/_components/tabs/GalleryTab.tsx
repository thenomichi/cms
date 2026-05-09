"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { UploadGuidelines } from "@/components/ui/UploadGuidelines";
import type { DbTripGallery } from "@/lib/types";
import {
  prepareTripGalleryUploadAction,
  registerTripGalleryAction,
  fetchTripGalleryImages,
  deleteGalleryImageAction,
  toggleGalleryFeaturedAction,
  toggleGalleryCoverAction,
} from "../../../media/actions";
import { validateFiles } from "@/lib/storage/validate";
import { uploadWithTicket, runWithConcurrency } from "@/lib/storage/client-upload";
import { maybeConvertHeic } from "@/lib/storage/heic-convert";
import { UPLOAD_RULES } from "@/lib/storage/upload-rules";

interface Props {
  tripId: string | null;
  gallery: DbTripGallery[];
  onGalleryChange: (gallery: DbTripGallery[]) => void;
}

// Default category sent with every upload. The website never reads
// gallery.category — it only consumes is_cover + is_featured + the
// raw image list — so categorizing per upload was pure cognitive
// load. Schema column stays, defaults to "gallery", existing rows
// keep working.
const DEFAULT_CATEGORY = "gallery";

// Hard cap on how many gallery images can be Featured. The website's
// gallery mosaic only renders the first non-cover slot pair (positions
// 1 & 2 after sort), so any 3rd+ featured image is invisible to users
// and creates "I clicked Feature but nothing happened" confusion in
// the preview pane.
const MAX_FEATURED = 2;

export function GalleryTab({ tripId, gallery: initialGallery, onGalleryChange }: Props) {
  const [images, setImages] = useState(initialGallery);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Single source of truth for state updates: keep local images and
  // the parent's galleryOverride in lockstep so the right-pane preview
  // reflects every optimistic change without a page reload.
  //
  // Parent setter must NOT fire from inside setImages' updater — that
  // would call setGalleryOverride during this component's render and
  // trip React's "setState in render" check. Resolve the next value
  // first, then dispatch both setters back-to-back from the caller's
  // render scope.
  function applyImages(
    next: DbTripGallery[] | ((prev: DbTripGallery[]) => DbTripGallery[]),
  ) {
    const resolved = typeof next === "function" ? next(images) : next;
    setImages(resolved);
    onGalleryChange(resolved);
  }

  // Refresh gallery from server
  async function refreshGallery() {
    if (!tripId) return;
    const fresh = await fetchTripGalleryImages(tripId);
    applyImages(fresh);
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files || !tripId) {
      if (!tripId) toast.error("Save the trip first before uploading images");
      return;
    }

    const list = Array.from(files) as File[];
    const { valid, rejected } = validateFiles(list, "tripGallery");
    for (const r of rejected) {
      toast.error(`${r.file.name}: ${r.reason}`);
    }
    if (valid.length === 0) return;

    setUploading(true);
    setProgress({ done: 0, total: valid.length });

    let successCount = 0;
    await runWithConcurrency(
      valid as File[],
      UPLOAD_RULES.tripGallery.maxConcurrency,
      async (file: File) => {
        const prep = await prepareTripGalleryUploadAction({
          tripId: tripId!,
          fileName: file.name,
          contentType: file.type || "image/jpeg",
          size: file.size,
        });
        if (!prep.success) {
          toast.error(`${file.name}: ${prep.error}`);
          return;
        }
        const converted = await maybeConvertHeic(file);
        await uploadWithTicket(converted, prep.ticket);
        const reg = await registerTripGalleryAction({
          tripId: tripId!,
          path: prep.ticket.path,
          publicUrl: prep.ticket.publicUrl,
          category: DEFAULT_CATEGORY,
        });
        if (reg.success) {
          successCount++;
        } else {
          toast.error(`${file.name}: ${reg.error ?? "Register failed"}`);
        }
      },
      (done) => setProgress({ done, total: valid.length }),
    );

    if (successCount > 0) {
      toast.success(`${successCount} image(s) uploaded`);
      await refreshGallery();
    }
    setUploading(false);
    setProgress(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    applyImages((prev) => prev.filter((g) => g.gallery_id !== deleteId));
    const res = await deleteGalleryImageAction(deleteId);
    if (res.success) {
      toast.success("Image deleted");
    } else {
      await refreshGallery(); // revert from server
      toast.error(res.error ?? "Delete failed");
    }
    setDeleteId(null);
  };

  const handleToggleFeatured = async (id: string, current: boolean) => {
    // Block a 3rd Feature; un-featuring is always allowed.
    if (!current) {
      const featuredCount = images.filter((g) => g.is_featured).length;
      if (featuredCount >= MAX_FEATURED) {
        toast.error(
          `Only ${MAX_FEATURED} images can be featured at a time. Unfeature one first.`,
        );
        return;
      }
    }
    applyImages((prev) =>
      prev.map((g) => (g.gallery_id === id ? { ...g, is_featured: !current } : g)),
    );
    const res = await toggleGalleryFeaturedAction(id, !current);
    if (!res.success) await refreshGallery();
  };

  const handleSetCover = async (id: string) => {
    if (!tripId) return;
    applyImages((prev) => prev.map((g) => ({ ...g, is_cover: g.gallery_id === id })));
    const res = await toggleGalleryCoverAction(tripId, id);
    if (res.success) {
      toast.success("Cover image set");
    } else {
      await refreshGallery();
    }
  };

  // Cap-aware UI state for the per-image Featured button.
  const featuredCount = images.filter((g) => g.is_featured).length;
  const featuredCapReached = featuredCount >= MAX_FEATURED;

  return (
    <div className="space-y-4">
      {/* Upload section */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => fileRef.current?.click()} disabled={uploading || !tripId}>
            {progress ? `Uploading ${progress.done} of ${progress.total}…` : "Upload Images"}
          </Button>
          <p className="text-xs text-mid">
            {tripId
              ? "After upload, hover an image to set it as cover or feature it."
              : "Save the trip first to upload images."}
          </p>
        </div>
        <label htmlFor="gallery-upload" className="sr-only">
          Upload
        </label>
        <input
          id="gallery-upload"
          ref={fileRef}
          type="file"
          multiple
          accept={UPLOAD_RULES.tripGallery.accept.join(",")}
          aria-label="Upload"
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
        <UploadGuidelines kind="tripGallery" className="w-full sm:w-auto" />
      </div>

      {/* Plain-language help so admins know what Cover/Featured do. */}
      {images.length > 0 && (
        <div className="rounded-lg border border-line bg-surface3 p-3 text-xs text-mid">
          <p className="mb-1">
            <span className="font-semibold text-ink">Cover</span> is the main image — shown on trip
            cards and at the top of the trip detail page. Pick one.
          </p>
          <p>
            <span className="font-semibold text-ink">Featured</span> images appear next to the
            cover at the top of the gallery section on the website. Pick up to{" "}
            <span className="font-semibold text-ink">{MAX_FEATURED}</span>. Other uploads sit in
            the regular gallery and show in the lightbox.
          </p>
        </div>
      )}

      {/* Gallery grid */}
      {images.length === 0 ? (
        <div className="py-10 text-center text-sm text-mid">
          No images yet. Upload images using the button above.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((img) => (
            <div
              key={img.gallery_id}
              className="overflow-hidden rounded-lg border border-line bg-surface"
            >
              <div className="relative">
                <img
                  src={img.image_url}
                  alt={img.alt_text ?? ""}
                  className="h-40 w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
                {/* Status chips, top-left over the image. */}
                <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                  {img.is_cover && <Badge variant="rust">Cover</Badge>}
                  {img.is_featured && <Badge variant="amber">Featured</Badge>}
                </div>
              </div>

              {/* Always-visible action row — no hover required, with explicit
                  text labels and active state. Layman-readable. */}
              <div className="grid grid-cols-3 border-t border-line text-xs">
                <button
                  type="button"
                  onClick={() => handleSetCover(img.gallery_id)}
                  disabled={img.is_cover ?? false}
                  className={`flex h-9 items-center justify-center gap-1 px-2 transition-colors ${
                    img.is_cover
                      ? "bg-rust/10 font-semibold text-rust cursor-default"
                      : "text-mid hover:bg-surface3 hover:text-ink"
                  }`}
                >
                  {img.is_cover ? "✓ Cover" : "Use as cover"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleToggleFeatured(img.gallery_id, img.is_featured ?? false)
                  }
                  disabled={!img.is_featured && featuredCapReached}
                  title={
                    !img.is_featured && featuredCapReached
                      ? `Up to ${MAX_FEATURED} featured. Unfeature one to swap.`
                      : undefined
                  }
                  className={`flex h-9 items-center justify-center gap-1 border-x border-line px-2 transition-colors ${
                    img.is_featured
                      ? "bg-sem-amber/10 font-semibold text-sem-amber"
                      : featuredCapReached
                        ? "cursor-not-allowed text-fog"
                        : "text-mid hover:bg-surface3 hover:text-ink"
                  }`}
                >
                  {img.is_featured ? "✓ Featured" : "Show as featured"}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(img.gallery_id)}
                  className="flex h-9 items-center justify-center gap-1 px-2 text-mid transition-colors hover:bg-sem-red-bg hover:text-sem-red"
                >
                  Remove
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
