// lib/storage/heic-convert.ts
type Heic2Any = (opts: {
  blob: Blob;
  toType: string;
  quality?: number;
}) => Promise<Blob | Blob[]>;

let heicLib: Heic2Any | null = null;

export function isHeic(file: File): boolean {
  if (file.type === "image/heic" || file.type === "image/heif") return true;
  return /\.(heic|heif)$/i.test(file.name);
}

export async function maybeConvertHeic(file: File): Promise<File> {
  if (!isHeic(file)) return file;
  try {
    if (!heicLib) {
      const mod = await import("heic2any");
      heicLib = mod.default as Heic2Any;
    }
    const blob = await heicLib({ blob: file, toType: "image/jpeg", quality: 0.9 });
    const out = Array.isArray(blob) ? blob[0] : blob;
    const newName = file.name.replace(/\.(heic|heif)$/i, ".jpg");
    return new File([out], newName, { type: "image/jpeg" });
  } catch (e) {
    console.warn("[heic-convert] failed, uploading original:", e);
    return file;
  }
}
