/*
 * Client-side checks before upload. The backend (POST /manuscripts/upload) accepts DOCX only
 * for now (docs/contracts.md, decision 2), so the UI accepts and advertises DOCX only.
 * The backend repeats these checks and remains the authority.
 */

export const ACCEPTED_EXTENSIONS = [".docx"] as const;

/* Helps the operating-system file picker show only Word .docx files; validation still checks the extension. */
const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const ACCEPT_ATTRIBUTE = [...ACCEPTED_EXTENSIONS, DOCX_MIME_TYPE].join(",");
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
      // \u200E keeps ".docx" displayed left-to-right inside the Arabic sentence.
      message: "هذا الملف غير مدعوم. ارفع مستند Word بصيغة \u200E.docx\u200E فقط.",
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