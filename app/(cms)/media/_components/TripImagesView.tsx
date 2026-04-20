"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { GALLERY_CATEGORIES } from "@/lib/constants";
import type { DbTripGallery } from "@/lib/types";
import {
  deleteGalleryImageAction,
  toggleGalleryFeaturedAction,
  toggleGalleryCoverAction,
  uploadTripGalleryAction,
  linkImageToTripAction,
  changeCategoryAction,
} from "../actions";

type TripImage = DbTripGallery & { trip_name: string | null };

interface Props {
  initialTripImages: TripImage[];
  tripOptions: { value: string; label: string }[];
}

// Category display order
const CATEGORY_ORDER: Record<string, number> = {
  cover: 0,
  hero: 1,
  gallery: 2,
  itinerary: 3,
  accommodation: 4,
  activity: 5,
};

function categoryLabel(cat: string): string {
  return GALLERY_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

export function TripImagesView({ initialTripImages, tripOptions }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  // State
  const [tripImages, setTripImages] = useState(initialTripImages);
  useEffect(() => { setTripImages(initialTripImages); }, [initialTripImages]);

  const [selectedTripId, setSelectedTripId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Inline action menus — only one can be open at a time
  const [categoryMenuId, setCategoryMenuId] = useState<string | null>(null);
  const [linkMenuId, setLinkMenuId] = useState<string | null>(null);

  // Close menus when clicking outside
  const closeMenus = useCallback(() => {
    setCategoryMenuId(null);
    setLinkMenuId(null);
  }, []);

  useEffect(() => {
    if (categoryMenuId || linkMenuId) {
      const handler = () => closeMenus();
      document.addEventListener("click", handler);
      return () => document.removeEventListener("click", handler);
    }
  }, [categoryMenuId, linkMenuId, closeMenus]);

  // Filtered images for the selected trip
  const filteredImages = selectedTripId
    ? tripImages.filter((img) => img.trip_id === selectedTripId)
    : [];

  const selectedTrip = tripOptions.find((t) => t.value === selectedTripId);

  // Group images by category
  const imagesByCategory = filteredImages.reduce<Record<string, TripImage[]>>((acc, img) => {
    const cat = img.category || "gallery";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(img);
    return acc;
  }, {});

  const sortedCategories = Object.keys(imagesByCategory).sort(
    (a, b) => (CATEGORY_ORDER[a] ?? 99) - (CATEGORY_ORDER[b] ?? 99),
  );

  // ---- Handlers ----

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!selectedTripId) {
      toast.error("Select a trip first");
      return;
    }
    setUploading(true);
    let successCount = 0;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("trip_id", selectedTripId);
      fd.append("category", "gallery");
      const res = await uploadTripGalleryAction(fd);
      if (res.success) successCount++;
      else toast.error(`Failed: ${res.error}`);
    }
    if (successCount > 0) {
      toast.success(`${successCount} image(s) uploaded`);
      router.refresh();
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await deleteGalleryImageAction(deleteTarget);
    if (res.success) {
      setTripImages((prev) => prev.filter((i) => i.gallery_id !== deleteTarget));
      toast.success("Image deleted");
    } else {
      toast.error(res.error ?? "Delete failed");
    }
    setDeleteTarget(null);
  };

  const handleToggleFeatured = async (img: TripImage) => {
    const newVal = !img.is_featured;
    // Optimistic update
    setTripImages((prev) =>
      prev.map((i) => (i.gallery_id === img.gallery_id ? { ...i, is_featured: newVal } : i)),
    );
    const res = await toggleGalleryFeaturedAction(img.gallery_id, newVal);
    if (res.success) {
      toast.success(newVal ? "Marked as featured" : "Unfeatured");
    } else {
      // Revert
      setTripImages((prev) =>
        prev.map((i) => (i.gallery_id === img.gallery_id ? { ...i, is_featured: img.is_featured } : i)),
      );
      toast.error(res.error ?? "Toggle failed");
    }
  };

  const handleSetCover = async (img: TripImage) => {
    if (!img.trip_id) return;
    // Optimistic update
    setTripImages((prev) =>
      prev.map((i) => {
        if (i.trip_id !== img.trip_id) return i;
        return { ...i, is_cover: i.gallery_id === img.gallery_id };
      }),
    );
    const res = await toggleGalleryCoverAction(img.trip_id, img.gallery_id);
    if (res.success) {
      toast.success("Cover image updated");
      router.refresh();
    } else {
      toast.error(res.error ?? "Failed to set cover");
      router.refresh();
    }
  };

  const handleChangeCategory = async (galleryId: string, newCategory: string) => {
    setCategoryMenuId(null);
    // Optimistic
    setTripImages((prev) =>
      prev.map((i) => (i.gallery_id === galleryId ? { ...i, category: newCategory } : i)),
    );
    const res = await changeCategoryAction(galleryId, newCategory);
    if (res.success) {
      toast.success(`Category changed to ${categoryLabel(newCategory)}`);
    } else {
      toast.error(res.error ?? "Category change failed");
      router.refresh();
    }
  };

  const handleLinkToTrip = async (imageUrl: string, targetTripId: string) => {
    setLinkMenuId(null);
    const targetTrip = tripOptions.find((t) => t.value === targetTripId);
    const res = await linkImageToTripAction(imageUrl, targetTripId, "gallery");
    if (res.success) {
      toast.success(`Image linked to ${targetTrip?.label ?? "trip"}`);
      router.refresh();
    } else {
      toast.error(res.error ?? "Link failed");
    }
  };

  // ---- Render helpers ----

  const renderImageCard = (img: TripImage, isCoverSection: boolean) => {
    const isCover = isCoverSection;
    const isMenuOpen = categoryMenuId === img.gallery_id || linkMenuId === img.gallery_id;
    return (
      <div
        key={img.gallery_id}
        className={`relative rounded-xl border border-line bg-surface transition-shadow hover:shadow-md ${
          isCover ? "col-span-2 row-span-2" : ""
        }`}
      >
        {/* Thumbnail */}
        <div className={`overflow-hidden rounded-t-xl ${isCover ? "h-56" : "h-32"}`}>
          <img
            src={img.image_url}
            alt={img.alt_text ?? ""}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>

        {/* Info + badges */}
        <div className="flex items-center gap-1 px-2 pt-1.5">
          {img.is_cover && <Badge variant="rust">Cover</Badge>}
          {img.is_featured && <Badge variant="amber">Featured</Badge>}
          <Badge variant="gray">{img.category}</Badge>
        </div>

        {/* Actions bar — below image, no overflow issues */}
        <div className="relative flex flex-wrap items-center gap-1 px-2 pb-2 pt-1.5">
          {!img.is_cover && img.trip_id && (
            <button
              type="button"
              onClick={() => handleSetCover(img)}
              className="rounded border border-line bg-surface2 px-1.5 py-0.5 text-[10px] font-medium text-ink hover:bg-surface3"
            >
              Set Cover
            </button>
          )}
          <button
            type="button"
            onClick={() => handleToggleFeatured(img)}
            className="rounded border border-line bg-surface2 px-1.5 py-0.5 text-[10px] font-medium text-ink hover:bg-surface3"
          >
            {img.is_featured ? "Unfeature" : "Feature"}
          </button>

          {/* Category dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLinkMenuId(null);
                setCategoryMenuId(categoryMenuId === img.gallery_id ? null : img.gallery_id);
              }}
              className="rounded border border-line bg-surface2 px-1.5 py-0.5 text-[10px] font-medium text-ink hover:bg-surface3"
            >
              Category ▾
            </button>
            {categoryMenuId === img.gallery_id && (
              <div
                className="absolute left-0 top-full z-[200] mt-1 w-44 rounded-lg border border-line bg-surface py-1 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                {GALLERY_CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => handleChangeCategory(img.gallery_id, cat.value)}
                    className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-surface3 ${
                      img.category === cat.value ? "font-semibold text-rust" : "text-ink"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Link to trip dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCategoryMenuId(null);
                setLinkMenuId(linkMenuId === img.gallery_id ? null : img.gallery_id);
              }}
              className="rounded border border-line bg-surface2 px-1.5 py-0.5 text-[10px] font-medium text-ink hover:bg-surface3"
            >
              Link ▾
            </button>
            {linkMenuId === img.gallery_id && (
              <div
                className="absolute left-0 top-full z-[200] mt-1 max-h-48 w-52 overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                {tripOptions
                  .filter((t) => t.value !== img.trip_id)
                  .map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => handleLinkToTrip(img.image_url, t.value)}
                      className="block w-full px-3 py-1.5 text-left text-xs text-ink hover:bg-surface3"
                    >
                      <span className="block">{t.label}</span>
                      <span className="block font-mono text-[10px] text-fog">{t.value}</span>
                    </button>
                  ))}
                {tripOptions.filter((t) => t.value !== img.trip_id).length === 0 && (
                  <p className="px-3 py-1.5 text-xs text-mid">No other trips</p>
                )}
              </div>
            )}
          </div>

          {/* Delete */}
          <button
            type="button"
            onClick={() => setDeleteTarget(img.gallery_id)}
            className="rounded border border-line bg-sem-red-bg px-1.5 py-0.5 text-[10px] font-medium text-sem-red hover:bg-red-100"
          >
            Delete
          </button>
        </div>
      </div>
    );
  };

  // ---- Main render ----

  return (
    <>
      {/* Top bar: trip selector + upload */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <select
          className="min-w-[220px] rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-rust"
          value={selectedTripId}
          onChange={(e) => setSelectedTripId(e.target.value)}
        >
          <option value="">Select a trip...</option>
          {tripOptions.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label} — {t.value}
            </option>
          ))}
        </select>

        <Button
          onClick={() => fileRef.current?.click()}
          disabled={uploading || !selectedTripId}
        >
          {uploading ? "Uploading..." : "Upload Images"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {/* No trip selected */}
      {!selectedTripId && (
        <EmptyState
          icon="📁"
          title="Select a trip"
          description="Choose a trip from the dropdown above to manage its images"
        />
      )}

      {/* Trip selected but no images */}
      {selectedTripId && filteredImages.length === 0 && (
        <EmptyState
          icon="🖼"
          title="No images yet"
          description={`Upload images for ${selectedTrip?.label ?? "this trip"} using the button above`}
        />
      )}

      {/* Trip header + images grouped by category */}
      {selectedTripId && filteredImages.length > 0 && (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-lg font-semibold text-ink">{selectedTrip?.label}</h2>
            <Badge variant="blue">{filteredImages.length} images</Badge>
          </div>

          {sortedCategories.map((cat) => {
            const images = imagesByCategory[cat];
            const isCoverCategory = cat === "cover";
            return (
              <div key={cat} className="mb-6">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-mid">
                  {categoryLabel(cat)}
                  <span className="ml-2 text-xs font-normal">({images.length})</span>
                </h3>
                <div
                  className={`grid gap-3 ${
                    isCoverCategory
                      ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
                      : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                  }`}
                >
                  {images.map((img) => renderImageCard(img, isCoverCategory))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete image?"
        message="This image will be permanently removed."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
