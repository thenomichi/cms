// lib/storage/validate.ts
import path from "node:path";
import { UPLOAD_RULES, type UploadKind } from "./upload-rules";

export interface FileLike {
  name: string;
  type: string;
  size: number;
}

export interface ValidateFilesResult {
  valid: FileLike[];
  rejected: { file: FileLike; reason: string }[];
}

const HEIC_EXT = /\.(heic|heif)$/i;

function isAccepted(file: FileLike, accept: readonly string[]): boolean {
  if (accept.includes(file.type as string)) return true;
  // Some OSes/browsers report empty MIME for HEIC. Fall back to extension.
  if (HEIC_EXT.test(file.name) && (accept.includes("image/heic") || accept.includes("image/heif"))) {
    return true;
  }
  return false;
}

export function validateFiles(files: FileLike[], kind: UploadKind): ValidateFilesResult {
  const rule = UPLOAD_RULES[kind];

  if (files.length > rule.maxCount) {
    return {
      valid: [],
      rejected: files.map((f) => ({
        file: f,
        reason: `Too many at once — pick up to ${rule.maxCount} ${rule.label}s`,
      })),
    };
  }

  const valid: FileLike[] = [];
  const rejected: ValidateFilesResult["rejected"] = [];

  for (const file of files) {
    if (file.size === 0) {
      rejected.push({ file, reason: "File is empty" });
      continue;
    }
    if (!isAccepted(file, rule.accept)) {
      rejected.push({
        file,
        reason: `Wrong file type — use ${rule.extensions.join(", ")}`,
      });
      continue;
    }
    if (file.size > rule.maxBytes) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      const max = rule.maxBytes / 1024 / 1024;
      rejected.push({ file, reason: `Too large (${mb} MB) — keep under ${max} MB` });
      continue;
    }
    valid.push(file);
  }
  return { valid, rejected };
}

export type ValidateInputResult =
  | { ok: true }
  | { ok: false; error: string };

export function validateUploadInput(
  kind: UploadKind,
  input: { fileName: string; contentType: string; size: number },
): ValidateInputResult {
  const rule = UPLOAD_RULES[kind];

  if (
    !input.fileName ||
    input.fileName.includes("\x00") ||
    input.fileName.includes("\\") ||
    path.basename(input.fileName) !== input.fileName
  ) {
    return { ok: false, error: "Invalid filename" };
  }
  if (input.size <= 0) {
    return { ok: false, error: "Missing or empty file" };
  }
  if (input.size > rule.maxBytes) {
    const max = rule.maxBytes / 1024 / 1024;
    return { ok: false, error: `File too large — max ${max} MB` };
  }
  const acceptedByMime = rule.accept.includes(input.contentType);
  const acceptedByExt = HEIC_EXT.test(input.fileName) &&
    (rule.accept.includes("image/heic") || rule.accept.includes("image/heif"));
  if (!acceptedByMime && !acceptedByExt) {
    return { ok: false, error: "File type not allowed" };
  }
  return { ok: true };
}
