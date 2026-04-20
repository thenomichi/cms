"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FormField } from "@/components/ui/FormField";
import { FormModal } from "@/components/ui/FormModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { DbSiteGallery, DbRawMoment } from "@/lib/types";
import {
  uploadSiteGalleryAction,
  uploadRawMomentAction,
  deleteSiteGalleryImageAction,
  deleteRawMomentAction,
  updateSiteGalleryImageAction,
} from "../actions";

const INPUT =
  "h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-fog outline-none transition-colors focus:border-rust focus:ring-1 focus:ring-rust/20";

interface Props {
  initialSiteImages: DbSiteGallery[];
  initialRawMoments: DbRawMoment[];
}

export function SiteGalleryMomentsView({ initialSiteImages, initialRawMoments }: Props) {
  const router = useRouter();
  const siteFileRef = useRef<HTMLInputElement>(null);
  const momentFileRef = useRef<HTMLInputElement>(null);

  const [siteImages, setSiteImages] = useState(initialSiteImages);
  useEffect(() => { setSiteImages(initialSiteImages); }, [initialSiteImages]);

  const [moments, setMoments] = useState(initialRawMoments);
  useEffect(() => { setMoments(initialRawMoments); }, [initialRawMoments]);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: "site" | "moment" } | null>(null);

  // Upload staging — file selected but not yet uploaded
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [stagedPreview, setStagedPreview] = useState<string>("");
  const [stagedType, setStagedType] = useState<"site" | "moment">("site");
  const [stagedCaption, setStagedCaption] = useState("");
  const [stagedLocation, setStagedLocation] = useState("");
  const [uploading, setUploading] = useState(false);

  // Editing an existing image's caption
  const [editingImage, setEditingImage] = useState<DbSiteGallery | null>(null);
  const [editCaption, setEditCaption] = useState("");

  // Stage a file for preview before upload
  const handleFileSelect = (files: FileList | null, type: "site" | "moment") => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setStagedFile(file);
    setStagedType(type);
    setStagedCaption("");
    setStagedLocation("");
    setStagedPreview(URL.createObjectURL(file));
  };

  // Confirm upload with caption
  const handleConfirmUpload = async () => {
    if (!stagedFile) return;
    setUploading(true);

    const fd = new FormData();
    fd.append("file", stagedFile);
    if (stagedCaption) fd.append("caption", stagedCaption);
    if (stagedType === "moment" && stagedLocation) fd.append("location", stagedLocation);
    if (stagedType === "site" && stagedCaption) fd.append("alt_text", stagedCaption);

    const res = stagedType === "site"
      ? await uploadSiteGalleryAction(fd)
      : await uploadRawMomentAction(fd);

    if (res.success) {
      toast.success("Image uploaded");
      router.refresh();
    } else {
      toast.error(res.error ?? "Upload failed");
    }

    setUploading(false);
    setStagedFile(null);
    setStagedPreview("");
    if (siteFileRef.current) siteFileRef.current.value = "";
    if (momentFileRef.current) momentFileRef.current.value = "";
  };

  const cancelUpload = () => {
    setStagedFile(null);
    setStagedPreview("");
    if (siteFileRef.current) siteFileRef.current.value = "";
    if (momentFileRef.current) momentFileRef.current.value = "";
  };

  // Save edited caption
  const handleSaveCaption = async () => {
    if (!editingImage) return;
    const res = await updateSiteGalleryImageAction(editingImage.gallery_id, {
      caption: editCaption || null,
      alt_text: editCaption || null,
    });
    if (res.success) {
      setSiteImages((prev) =>
        prev.map((i) => i.gallery_id === editingImage.gallery_id
          ? { ...i, caption: editCaption || null, alt_text: editCaption || null }
          : i),
      );
      toast.success("Caption updated");
    } else {
      toast.error(res.error ?? "Update failed");
    }
    setEditingImage(null);
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { id, type } = deleteTarget;
    let res: { success: boolean; error?: string };
    if (type === "site") {
      res = await deleteSiteGalleryImageAction(id);
      if (res.success) setSiteImages((prev) => prev.filter((i) => i.gallery_id !== id));
    } else {
      res = await deleteRawMomentAction(id);
      if (res.success) setMoments((prev) => prev.filter((m) => m.moment_id !== id));
    }
    if (res!.success) toast.success("Image deleted");
    else toast.error(res!.error ?? "Delete failed");
    setDeleteTarget(null);
  };

  // Featured toggle
  const handleToggleSiteFeatured = async (img: DbSiteGallery) => {
    const newVal = !img.is_featured;
    setSiteImages((prev) =>
      prev.map((i) => (i.gallery_id === img.gallery_id ? { ...i, is_featured: newVal } : i)),
    );
    const res = await updateSiteGalleryImageAction(img.gallery_id, { is_featured: newVal });
    if (res.success) {
      toast.success(newVal ? "Featured" : "Unfeatured");
    } else {
      setSiteImages((prev) =>
        prev.map((i) => (i.gallery_id === img.gallery_id ? { ...i, is_featured: img.is_featured } : i)),
      );
      toast.error(res.error ?? "Toggle failed");
    }
  };

  return (
    <div className="space-y-10">
      {/* ═══ Upload Preview Modal ═══ */}
      <FormModal
        open={!!stagedFile}
        onClose={cancelUpload}
        title={stagedType === "site" ? "Upload to Site Gallery" : "Upload Real Moment"}
        footer={
          <>
            <Button variant="secondary" onClick={cancelUpload}>Cancel</Button>
            <Button onClick={handleConfirmUpload} loading={uploading}>Upload</Button>
          </>
        }
      >
        <div className="space-y-4">
          {stagedPreview && (
            <img
              src={stagedPreview}
              alt="Preview"
              className="h-48 w-full rounded-lg border border-line object-cover"
            />
          )}
          <FormField
            label={stagedType === "site" ? "Caption" : "Caption"}
            hint="This text appears below the image on the website"
            required
          >
            <input
              className={INPUT}
              value={stagedCaption}
              onChange={(e) => setStagedCaption(e.target.value)}
              placeholder={stagedType === "site" ? "e.g. Sunset over the Hampi ruins" : "e.g. Our group at the summit"}
              autoFocus
            />
          </FormField>
          {stagedType === "moment" && (
            <FormField label="Location" hint="Where was this photo taken?">
              <input
                className={INPUT}
                value={stagedLocation}
                onChange={(e) => setStagedLocation(e.target.value)}
                placeholder="e.g. Hampi, Karnataka"
              />
            </FormField>
          )}
        </div>
      </FormModal>

      {/* ═══ Edit Caption Modal ═══ */}
      <FormModal
        open={!!editingImage}
        onClose={() => setEditingImage(null)}
        title="Edit Caption"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingImage(null)}>Cancel</Button>
            <Button onClick={handleSaveCaption}>Save</Button>
          </>
        }
      >
        {editingImage && (
          <div className="space-y-4">
            <img
              src={editingImage.image_url}
              alt=""
              className="h-40 w-full rounded-lg border border-line object-cover"
            />
            <FormField label="Caption" hint="Shown below the image on the website">
              <input
                className={INPUT}
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                placeholder="e.g. Sunset over the Hampi ruins"
                autoFocus
              />
            </FormField>
          </div>
        )}
      </FormModal>

      {/* ═══ Site Gallery ═══ */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-ink">Site Gallery</h2>
            <Badge variant="blue">{siteImages.length} images</Badge>
          </div>
          <div>
            <Button onClick={() => siteFileRef.current?.click()} size="sm">Upload</Button>
            <input
              ref={siteFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files, "site")}
            />
          </div>
        </div>

        {siteImages.length === 0 ? (
          <EmptyState icon="🏞" title="No site gallery images" description="Upload images for the homepage gallery" />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {siteImages.map((img) => (
              <div
                key={img.gallery_id}
                className="group relative overflow-hidden rounded-xl border border-line bg-surface transition-shadow hover:shadow-md"
              >
                <div className="relative h-32">
                  <img
                    src={img.image_url}
                    alt={img.alt_text ?? ""}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="flex w-full items-center gap-1 p-2">
                      <button
                        type="button"
                        onClick={() => { setEditingImage(img); setEditCaption(img.caption ?? ""); }}
                        className="rounded bg-white/90 px-2 py-0.5 text-[11px] font-medium text-ink hover:bg-white"
                      >
                        Edit Caption
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleSiteFeatured(img)}
                        className="rounded bg-white/90 px-2 py-0.5 text-[11px] font-medium text-ink hover:bg-white"
                      >
                        {img.is_featured ? "Unfeature" : "Feature"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ id: img.gallery_id, type: "site" })}
                        className="rounded bg-red-500/90 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-2">
                  <p className="flex-1 truncate text-[11px] text-mid">
                    {img.caption || <span className="italic text-fog">No caption</span>}
                  </p>
                  {img.is_featured && <Badge variant="amber">Featured</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ═══ Real Moments ═══ */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-ink">Real Moments</h2>
            <Badge variant="blue">{moments.length} images</Badge>
          </div>
          <div>
            <Button onClick={() => momentFileRef.current?.click()} size="sm">Upload</Button>
            <input
              ref={momentFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files, "moment")}
            />
          </div>
        </div>

        {moments.length === 0 ? (
          <EmptyState icon="📸" title="No real moments" description="Upload traveller moments" />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {moments.map((m) => (
              <div
                key={m.moment_id}
                className="group relative overflow-hidden rounded-xl border border-line bg-surface transition-shadow hover:shadow-md"
              >
                <div className="relative h-32">
                  <img src={m.image_url} alt={m.caption ?? ""} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="flex w-full items-center gap-1 p-2">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ id: m.moment_id, type: "moment" })}
                        className="rounded bg-red-500/90 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
                <div className="px-2.5 py-2">
                  <p className="truncate text-[11px] font-medium text-ink">{m.location ?? "Unknown"}</p>
                  <p className="truncate text-[10px] text-mid">{m.caption || "No caption"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Confirm delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget?.type === "moment" ? "Delete moment?" : "Delete image?"}
        message="This image will be permanently removed."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
