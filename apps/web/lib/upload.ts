/*
 * Client-side checks before upload. The backend (POST /manuscripts/upload) accepts DOCX only
 * for now (docs/contracts.md, decision 2), so the UI accepts and advertises DOCX only.
 * The backend repeats these checks and remains the authority.
 */

export const ACCEPTED_EXTENSIONS = [".docx"] as const;
export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.join(",");
export const MAX_UPLOAD_MB = 25;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export type FileValidation = { ok: true } | { ok: false; message: string };

export function getFileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

function isAcceptedExtension(extension: string): boolean {
  return (ACCEPTED_EXTENSIONS as readonly string[]).includes(extension);
}

export function validateManuscriptFile(file: File): FileValidation {
  if (!isAcceptedExtension(getFileExtension(file.name))) {
    return {
      ok: false,
      message: "صيغة الملف غير مدعومة حاليًا. ارفع مستند Word بصيغة DOCX.",
    };
  }
  if (file.size === 0) {
    return { ok: false, message: "الملف فارغ. اختر ملفًا آخر." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, message: `حجم الملف أكبر من ${MAX_UPLOAD_MB} ميغابايت.` };
  }
  return { ok: true };
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} ميغابايت`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} كيلوبايت`;
}

export function fileTypeLabel(fileName: string): string {
  return getFileExtension(fileName) === ".docx" ? "DOCX" : "";
}