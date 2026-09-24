export const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".tex", ".zip"] as const;
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
      message: "صيغة الملف غير مدعومة. ارفع ملف PDF أو DOCX أو LaTeX بامتداد tex أو zip.",
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
  switch (getFileExtension(fileName)) {
    case ".pdf":
      return "PDF";
    case ".docx":
      return "DOCX";
    case ".tex":
      return "LaTeX";
    case ".zip":
      return "LaTeX (ZIP)";
    default:
      return "";
  }
}