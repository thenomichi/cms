"use client";

import { useRef, useState, useCallback, type DragEvent } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadZoneProps {
  onUpload: (files: FileList) => void;
  uploading?: boolean;
  accept?: string;
  multiple?: boolean;
  className?: string;
}

function UploadZone({
  onUpload,
  uploading = false,
  accept = "image/*",
  multiple = false,
  className,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        onUpload(e.dataTransfer.files);
      }
    },
    [onUpload]
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
        dragOver
          ? "border-rust bg-rust-tint"
          : "border-line hover:border-fog hover:bg-surface2",
        uploading && "pointer-events-none opacity-60",
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onUpload(e.target.files);
          }
        }}
        className="hidden"
      />
      {uploading ? (
        <svg
          className="h-8 w-8 animate-spin text-rust"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : (
        <Upload className="h-8 w-8 text-fog" />
      )}
      <p className="mt-3 text-sm font-medium text-ink">
        {uploading ? "Uploading..." : "Drop files here or click to browse"}
      </p>
      <p className="mt-1 text-xs text-mid">
        {accept === "image/*" ? "PNG, JPG, WebP up to 5MB" : accept}
      </p>
    </div>
  );
}

export { UploadZone };
export type { UploadZoneProps };
