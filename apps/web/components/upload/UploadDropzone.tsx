"use client";

import { useRef, useState, type ChangeEvent, type DragEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { BookmarkMark } from "@/components/brand/BookmarkMark";
import {
  ACCEPT_ATTRIBUTE,
  MAX_UPLOAD_MB,
  fileTypeLabel,
  formatFileSize,
  validateManuscriptFile,
} from "@/lib/upload";

type DropzoneState =
  | { status: "idle" }
  | { status: "selected"; file: File }
  | { status: "error"; message: string };

function draggingFiles(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes("Files");
}

export function UploadDropzone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [state, setState] = useState<DropzoneState>({ status: "idle" });

  const openPicker = () => inputRef.current?.click();

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (files.length > 1) {
      setState({ status: "error", message: "ارفع ملفًا واحدًا فقط." });
      return;
    }
    const file = files[0];
    const result = validateManuscriptFile(file);
    setState(result.ok ? { status: "selected", file } : { status: "error", message: result.message });
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
    event.target.value = "";
  };

  const onDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!draggingFiles(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!draggingFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!draggingFiles(event)) return;
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  const onZoneClick = () => {
    if (state.status !== "selected") openPicker();
  };

  const onPickClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    openPicker();
  };

  const clearFile = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setState({ status: "idle" });
  };

  const showSelected = state.status === "selected" && !isDragging;

  const zoneTone = isDragging
    ? "border-2 border-dashed border-terracotta bg-terracotta-tint"
    : state.status === "selected"
      ? "border-[1.5px] border-solid border-mint bg-paper-raised"
      : state.status === "error"
        ? "cursor-pointer border-[1.5px] border-dashed border-terracotta bg-paper-raised"
        : "cursor-pointer border-[1.5px] border-dashed border-subtle bg-paper-raised hover:border-ink";

  const announcement =
    state.status === "selected"
      ? `تم اختيار الملف ${state.file.name}`
      : state.status === "error"
        ? state.message
        : "";

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        onChange={onInputChange}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />

      <div
        onClick={onZoneClick}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-[4px] px-8 py-10 text-center transition-colors lg:h-[440px] ${zoneTone}`}
      >
        <BookmarkMark />

        {showSelected && state.status === "selected" ? (
          <>
            <span className="text-sm font-semibold text-mint-text">✓ الملف جاهز</span>
            <span
              dir="ltr"
              className="max-w-full font-latin text-[17px] font-semibold break-all text-ink"
            >
              {state.file.name}
            </span>
            <span className="text-[13px] text-muted">
              {fileTypeLabel(state.file.name)} · {formatFileSize(state.file.size)}
            </span>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  router.push("/analysis");
                }}
                className="h-11 rounded-[3px] bg-ink px-6 text-[15px] font-bold text-paper hover:bg-ink/90"
              >
                متابعة
              </button>
              <button
                type="button"
                onClick={onPickClick}
                className="h-11 rounded-[3px] border border-rule-strong px-5 text-sm text-ink hover:border-ink"
              >
                تغيير الملف
              </button>
              <button
                type="button"
                onClick={clearFile}
                className="h-11 px-2 text-sm text-ink underline underline-offset-4 hover:text-terracotta-text"
              >
                إزالة
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="text-[22px] font-bold">
              {isDragging ? "أفلت الملف هنا" : "اسحب ملف البحث إلى هنا"}
            </span>
            <button
              type="button"
              onClick={onPickClick}
              className="text-[15px] underline underline-offset-4 hover:text-terracotta-text"
            >
              أو اختر ملفًا من جهازك
            </button>
            <span dir="ltr" className="mt-2 font-latin text-[13px] text-muted">
              PDF · DOCX · LaTeX (.tex / .zip)
            </span>
            <span className="text-[12.5px] text-muted">حتى {MAX_UPLOAD_MB} ميغابايت</span>
            {state.status === "error" && (
              <p role="alert" className="mt-1 text-[13.5px] font-semibold text-terracotta-text">
                ✕ {state.message}
              </p>
            )}
          </>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}