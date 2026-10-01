"use client";

import { revisionLabel } from "@/lib/workspace/editing";
import type { ManuscriptVersion } from "@/lib/workspace/types";

type ManuscriptToolbarProps = {
  version: ManuscriptVersion;
  /* Arabic label of the edit in progress (e.g. "نحفظ التعديل…"), or null. */
  busyLabel: string | null;
  /* The checklist is being re-run for the new version. */
  revalidating: boolean;
  /* Arabic message of the last failed edit, or null. */
  error: string | null;
  canEditParagraph: boolean;
  downloading: boolean;
  onEditParagraph: () => void;
  onUndo: () => void;
  onReset: () => void;
  onDownload: () => void;
  onDismissError: () => void;
};

const BUTTON =
  "h-8 shrink-0 rounded-[3px] border border-rule-strong px-3 text-[12.5px] hover:border-ink disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-rule-strong";

/*
 * The manuscript's current version and the actions on it. Every change is saved on the
 * backend as a new revision of the researcher's Word file (docs/editing.md), so it survives
 * leaving the page; undo and start-over are backend operations too.
 */
export function ManuscriptToolbar({
  version,
  busyLabel,
  revalidating,
  error,
  canEditParagraph,
  downloading,
  onEditParagraph,
  onUndo,
  onReset,
  onDownload,
  onDismissError,
}: ManuscriptToolbarProps) {
  const latest = version.history.at(-1);
  const busy = busyLabel !== null;
  const status = busyLabel ?? (revalidating ? "نعيد فحص المتطلبات للنسخة الجديدة…" : null);

  if (!version.editable) {
    return (
      <div className="flex min-h-10 shrink-0 items-center gap-3 border-b border-rule bg-paper px-4 py-1.5 text-[12.5px] text-body">
        <span className="font-bold text-ink">التعديل غير متاح لهذه النسخة.</span>
        <span>رُفعت قبل إتاحة التعديل؛ ارفع الملف نفسه مرة أخرى لتفعيله دون أن تفقد شيئًا.</span>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col border-b border-rule bg-paper">
      <div className="flex min-h-11 items-center gap-2 overflow-x-auto px-4 py-1.5 whitespace-nowrap">
        <span className="text-[12.5px] text-muted">
          {version.revision === 0 ? (
            <span className="font-semibold text-ink">النسخة الأصلية</span>
          ) : (
            <>
              <span className="font-semibold text-ink">النسخة {version.revision}</span>
              {latest && <span> · آخر تعديل: {revisionLabel(latest)}</span>}
            </>
          )}
        </span>

        <span className="flex-1" />

        <button
          type="button"
          onClick={onEditParagraph}
          disabled={busy || !canEditParagraph}
          title={canEditParagraph ? undefined : "ضع المؤشر على فقرة في المحرر أولًا"}
          className={BUTTON}
        >
          تعديل الفقرة
        </button>
        <button type="button" onClick={onUndo} disabled={busy || version.revision === 0} className={BUTTON}>
          تراجع
        </button>
        <button type="button" onClick={onReset} disabled={busy || version.revision === 0} className={BUTTON}>
          العودة إلى الأصل
        </button>
        <button
          type="button"
          onClick={onDownload}
          disabled={downloading}
          className="h-8 shrink-0 rounded-[3px] bg-ink px-3 text-[12.5px] font-semibold text-paper hover:bg-ink/90 disabled:cursor-wait disabled:opacity-60"
        >
          {downloading ? "نجهّز الملف…" : "تنزيل ملف Word"}
        </button>
      </div>

      {(status || error) && (
        <div className="flex items-center gap-3 border-t border-rule px-4 py-1.5 text-[12.5px]">
          {status && (
            <p role="status" className="text-muted">
              {status}
            </p>
          )}
          {error && (
            <>
              <p role="alert" className="font-semibold text-terracotta-text">
                ✕ {error}
              </p>
              <span className="flex-1" />
              <button type="button" onClick={onDismissError} className="underline underline-offset-4 hover:text-ink">
                إخفاء
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
