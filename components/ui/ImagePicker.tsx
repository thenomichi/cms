"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Check, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { validateFiles } from "@/lib/storage/validate";
import { uploadWithTicket } from "@/lib/storage/client-upload";
import { maybeConvertHeic } from "@/lib/storage/heic-convert";
import { UPLOAD_RULES, type UploadKind } from "@/lib/storage/upload-rules";
import type { UploadTicket } from "@/lib/storage/provider";
import { UploadGuidelines } from "./UploadGuidelines";

interface ImagePickerProps {
  value: string;
  onChange: (url: string) => void;
  /** Server action to fetch existing images for this category */
  fetchImages: () => Promise<{ url: string; alt?: string }[]>;
  /** Server action to prepare an upload ticket */
  prepareUpload: (input: { fileName: string; contentType: string; size: number }) =>
    Promise<{ success: true; ticket: UploadTicket } | { success: false; error: string }>;
  /** Server action to register the uploaded asset and return its public URL */
  registerUpload: (input: { path: string; publicUrl: string }) =>
    Promise<{ success: boolean; url?: string; error?: string }>;
  /** Upload kind — used for validateFiles + UploadGuidelines + accept attribute */
  kind: UploadKind;
  label?: string;
  hint?: string;
  aspectHint?: string;
}

/**
 * Image picker with:
 * 1. Grid of existing images to choose from
 * 2. Upload new image button (prepare → upload → register)
 * 3. Preview of selected image
 * 4. Clear selection
 */
export function ImagePicker({
  value,
  onChange,
  fetchImages,
  prepareUpload,
  registerUpload,
  kind,
  label = "Image",
  hint,
  aspectHint,
}: ImagePickerProps) {
  const [images, setImages] = useState<{ url: string; alt?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const accept = UPLOAD_RULES[kind].accept.join(",");
  const defaultAspectHint = aspectHint ?? UPLOAD_RULES[kind].guidelines.aspectGuidance;

  // Fetch existing images on mount
  useEffect(() => {
    fetchImages()
      .then(setImages)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchImages]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files) as File[];
    const { valid, rejected } = validateFiles(fileArray, kind);
    for (const r of rejected) {
      toast.error(`${r.file.name}: ${r.reason}`);
    }
    if (valid.length === 0) return;

    const file = valid[0] as File;
    setUploading(true);

    try {
      const prep = await prepareUpload({
        fileName: file.name,
        contentType: file.type || "image/jpeg",
        size: file.size,
      });
      if (!prep.success) {
        toast.error(prep.error);
        return;
      }
      const converted = await maybeConvertHeic(file);
      await uploadWithTicket(converted, prep.ticket);
      const reg = await registerUpload({ path: prep.ticket.path, publicUrl: prep.ticket.publicUrl });
      if (reg.success) {
        const url = reg.url ?? prep.ticket.publicUrl;
        onChange(url);
        setImages((prev) => [{ url }, ...prev]);
        toast.success("Image uploaded");
        setShowPicker(false);
      } else {
        toast.error(reg.error ?? "Upload failed");
      }
    } catch (err) {
      toast.error((err as Error).message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {/* Current selection preview or trigger */}
      {value ? (
        <div className="relative overflow-hidden rounded-lg border border-line">
          <img
            src={value}
            alt=""
            className="h-32 w-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent p-3">
            <div className="flex w-full items-center justify-between">
              <p className="truncate text-xs text-white/80">{value.split("/").pop()}</p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="rounded-md bg-white/20 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm hover:bg-white/30"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={() => onChange("")}
                  className="rounded-md bg-white/20 p-1 text-white backdrop-blur-sm hover:bg-red-500/50"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line bg-surface2 text-mid transition-colors hover:border-rust hover:bg-rust-tint"
        >
          <Upload className="h-5 w-5" />
          <span className="text-xs font-medium">Choose or upload an image</span>
        </button>
      )}

      {hint && <p className="text-[11px] text-fog">{hint}</p>}

      {/* Image picker modal */}
      {showPicker && (
        <div className="rounded-xl border border-line bg-surface p-4 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">Select {label}</p>
              <p className="text-[11px] text-fog">{defaultAspectHint}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rust px-3 py-1.5 text-xs font-medium text-white hover:bg-rust-d disabled:opacity-50"
              >
                <Upload className="h-3 w-3" />
                {uploading ? "Uploading..." : "Upload New"}
              </button>
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-mid hover:text-ink"
              >
                Cancel
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept={accept}
              aria-label={`Upload ${label}`}
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
          </div>

          <UploadGuidelines kind={kind} className="mb-3" />

          {/* Image grid */}
          {loading ? (
            <div className="py-8 text-center text-xs text-mid">Loading images...</div>
          ) : images.length === 0 ? (
            <div className="py-8 text-center text-xs text-mid">
              No images yet. Upload one to get started.
            </div>
          ) : (
            <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {images.map((img) => (
                <button
                  key={img.url}
                  type="button"
                  onClick={() => {
                    onChange(img.url);
                    setShowPicker(false);
                  }}
                  className={cn(
                    "relative overflow-hidden rounded-lg border-2 transition-all hover:border-rust",
                    value === img.url ? "border-rust ring-2 ring-rust/20" : "border-transparent",
                  )}
                >
                  <img
                    src={img.url}
                    alt={img.alt ?? ""}
                    className="h-20 w-full object-cover"
                  />
                  {value === img.url && (
                    <div className="absolute inset-0 flex items-center justify-center bg-rust/20">
                      <Check className="h-5 w-5 text-white drop-shadow-md" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
