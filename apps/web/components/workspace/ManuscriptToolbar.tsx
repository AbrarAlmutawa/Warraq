"use client";

import { RestoreIcon, UndoIcon } from "@/components/ui/icons";
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
  /* Direct typing in the editor: unsaved ("dirty"), being saved, or just saved. */
  textState: "idle" | "dirty" | "saving" | "saved";
  onUndo: () => void;
  onReset: () => void;
  onDismissError: () => void;
};

const BUTTON =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[3px] border border-rule-strong px-2.5 text-[12.5px] text-ink hover:border-ink disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-rule-strong";

/* How the highlights in the text read (was a separate strip above the toolbar). */
function HighlightLegend() {
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted">
      <span className="whitespace-nowrap">
        <span className="font-bold text-terracotta-text">✕</span> متطلب المجلة{" "}
        <span className="bg-terracotta/15 underline decoration-terracotta decoration-2 underline-offset-4">خط متصل</span>
      </span>
      <span className="whitespace-nowrap">
        <span className="font-bold">◐</span> بحاجة إلى مراجعة{" "}
        <span className="underline decoration-subtle decoration-dashed underline-offset-4">خط متقطع</span>
      </span>
      <span className="whitespace-nowrap">
        <span className="font-bold text-mint-text">✓</span> مستوفى - بلا تظليل
      </span>
    </span>
  );
}

/*
 * The manuscript's current version and the editing actions on it. Every change is saved on the
 * backend as a new revision of the researcher's Word file (docs/editing.md), so it survives
 * leaving the page; undo and start-over are backend operations too. Final output (Word / LaTeX)
 * lives on the submission page.
 */
export function ManuscriptToolbar({
  version,
  busyLabel,
  revalidating,
  error,
  textState,
  onUndo,
  onReset,
  onDismissError,
}: ManuscriptToolbarProps) {
  const latest = version.history.at(-1);
  const typing = textState === "dirty" || textState === "saving";
  const busy = busyLabel !== null || typing;
  const status =
    busyLabel ??
    (textState === "saving"
      ? "نحفظ تعديلاتك…"
      : textState === "dirty"
        ? "تعديلات لم تُحفظ بعد…"
        : revalidating
          ? "نعيد فحص المتطلبات للنسخة الجديدة…"
          : textState === "saved"
            ? "✓ حُفظت تعديلاتك"
            : null);

  if (!version.editable) {
    return (
      <div className="flex shrink-0 flex-col border-b border-rule bg-paper">
        <div className="flex min-h-11 items-center gap-3 px-4 py-1.5 text-[12.5px] text-body">
          <span className="font-bold text-ink">التعديل غير متاح لهذه النسخة.</span>
          <span>رُفعت قبل إتاحة التعديل؛ ارفع الملف نفسه مرة أخرى لتفعيله دون أن تفقد شيئًا.</span>
        </div>
        <div className="flex min-h-8 items-center border-t border-rule px-4 py-1">
          <span className="flex-1" />
          <HighlightLegend />
        </div>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col border-b border-rule bg-paper">
      <div className="flex min-h-11 items-center gap-2 overflow-x-auto px-4 py-1.5 whitespace-nowrap">
        <span className="text-[13px] font-semibold text-ink">المخطوطة</span>
        <span aria-hidden="true" className="text-subtle">
          ·
        </span>
        <span className="text-[12.5px] text-muted">
          {version.revision === 0 ? (
            "النسخة الأصلية"
          ) : (
            <>
              النسخة {version.revision}
              {latest && <span> · آخر تعديل: {revisionLabel(latest)}</span>}
            </>
          )}
        </span>

        <span className="flex-1" />

        <button type="button" onClick={onUndo} disabled={busy || version.revision === 0} className={BUTTON}>
          <UndoIcon className="text-[14px]" />
          تراجع
        </button>
        <button type="button" onClick={onReset} disabled={busy || version.revision === 0} className={BUTTON}>
          <RestoreIcon className="text-[14px]" />
          العودة إلى الأصل
        </button>
      </div>

      <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1 border-t border-rule px-4 py-1.5 text-[12.5px]">
        {status ? (
          <p role="status" className="text-muted">
            {status}
          </p>
        ) : (
          !error && (
            <p className="text-subtle">
              اكتب مباشرة في النص، ويُحفظ تلقائيًا. كل سطر فقرة، واضغط Enter لإضافة فقرة أو مرجع جديد.
            </p>
          )
        )}
        {error && (
          <>
            <p role="alert" className="font-semibold text-terracotta-text">
              ✕ {error}
            </p>
            <button type="button" onClick={onDismissError} className="underline underline-offset-4 hover:text-ink">
              إخفاء
            </button>
          </>
        )}
        <span className="flex-1" />
        <HighlightLegend />
      </div>
    </div>
  );
}