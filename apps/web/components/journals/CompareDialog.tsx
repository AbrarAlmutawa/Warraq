"use client";

import type { ReactNode } from "react";
import { DialogFrame } from "@/components/journals/DialogFrame";
import type { ErrorPresentation } from "@/lib/api-errors";
import {
  OPEN_ACCESS_FULL,
  SCOPE_FIT,
  formatApc,
  formatReviewDays,
  formatSimilarityScore,
  indexLabels,
} from "@/lib/journals/format";
import type { JournalMatch, JournalReadiness } from "@/lib/journals/types";

/* Readiness for one journal, as requested from POST /validate/compare. */
export type ReadinessEntry =
  | { status: "loading" }
  | { status: "ready"; readiness: JournalReadiness }
  | { status: "error"; error: ErrorPresentation };

type CompareDialogProps = {
  open: boolean;
  journals: JournalMatch[];
  readiness: Record<string, ReadinessEntry>;
  onRetryReadiness: () => void;
  selectedId: string | null;
  onClose: () => void;
  onSelect: (journalId: string) => void;
};

type CompareRow = {
  label: string;
  render: (journal: JournalMatch) => ReactNode;
};

const ROWS: CompareRow[] = [
  {
    label: "التوافق مع النطاق",
    render: (journal) => (
      <>
        <span className="block font-semibold">{SCOPE_FIT[journal.scopeFit].label}</span>
        <span className="mt-1 block leading-relaxed text-body">
          درجة تشابه النطاق مع بحثك:{" "}
          <span dir="ltr" className="font-latin font-semibold">
            {formatSimilarityScore(journal.similarityScore)}
          </span>{" "}
          من 1
        </span>
        {journal.matchedTopics.length > 0 && (
          <span className="mt-1 block leading-relaxed text-body">
            موضوعات مشتركة:{" "}
            <span dir="ltr" className="font-latin">
              {journal.matchedTopics.join(", ")}
            </span>
          </span>
        )}
      </>
    ),
  },
  { label: "رسوم النشر", render: (journal) => formatApc(journal.apcUsd) },
  { label: "الوصول المفتوح", render: (journal) => OPEN_ACCESS_FULL[journal.openAccess] },
  { label: "مدة المراجعة", render: (journal) => formatReviewDays(journal.reviewDaysAvg) },
  {
    label: "الفهرسة",
    render: (journal) => {
      const labels = indexLabels(journal.indexes);
      return labels.length > 0 ? (
        <span dir="ltr" className="font-latin">
          {labels.join(", ")}
        </span>
      ) : (
        "غير معلنة"
      );
    },
  },
];

/* Shows the backend's readiness summary as reported; nothing is recomputed here. */
function ReadinessCell({
  journal,
  entry,
  onRetry,
}: {
  journal: JournalMatch;
  entry: ReadinessEntry | undefined;
  onRetry: () => void;
}) {
  if (!entry || entry.status === "loading") {
    return <span className="text-muted">نفحص المتطلبات…</span>;
  }

  if (entry.status === "error") {
    return (
      <span className="flex flex-col gap-1">
        <span className="font-semibold text-terracotta-text">✕ تعذّر حساب الجاهزية</span>
        <span className="text-xs leading-relaxed text-muted">{entry.error.message}</span>
        <button
          type="button"
          onClick={onRetry}
          className="self-start text-[13px] underline underline-offset-4 hover:text-terracotta-text"
        >
          إعادة المحاولة
        </button>
      </span>
    );
  }

  const { readiness } = entry;
  return (
    <span className="flex flex-col gap-1">
      {readiness.isFullyReady ? (
        <span className="font-semibold text-mint-text">✓ جاهز للتقديم وفق فحص وَرَّاق</span>
      ) : (
        <>
          <span>
            لم تُستوفَ بعد: <span className="font-semibold">{readiness.failedCount}</span>
          </span>
          {readiness.reviewCount > 0 && (
            <span>
              بحاجة إلى مراجعتك: <span className="font-semibold">{readiness.reviewCount}</span>
            </span>
          )}
          <span className="text-muted">
            مستوفاة: {readiness.passedCount} من {readiness.total}
          </span>
        </>
      )}
      {journal.sourceIsDemo && <span className="text-xs text-muted">متطلبات تجريبية</span>}
    </span>
  );
}

export function CompareDialog({
  open,
  journals,
  readiness,
  onRetryReadiness,
  selectedId,
  onClose,
  onSelect,
}: CompareDialogProps) {
  return (
    <DialogFrame
      open={open}
      onClose={onClose}
      titleId="compare-dialog-title"
      title="مقارنة المجلتين"
      widthClass="max-w-[820px]"
    >
      {journals.length === 2 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[13.5px]">
            <thead>
              <tr>
                <th scope="col" className="w-[130px] border-b border-ink pb-3 text-start align-bottom">
                  <span className="sr-only">البند</span>
                </th>
                {journals.map((journal) => (
                  <th
                    key={journal.journalId}
                    scope="col"
                    className="border-b border-ink pe-4 pb-3 text-start align-bottom font-normal"
                  >
                    <span dir="ltr" className="block font-latin text-[15px] font-semibold">
                      {journal.name}
                    </span>
                    <span dir="ltr" className="block font-latin text-xs text-muted">
                      {journal.publisher}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label}>
                  <th
                    scope="row"
                    className="border-b border-rule py-3 text-start align-top text-xs font-normal text-muted"
                  >
                    {row.label}
                  </th>
                  {journals.map((journal) => (
                    <td key={journal.journalId} className="border-b border-rule py-3 pe-4 align-top">
                      {row.render(journal)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th
                  scope="row"
                  className="border-b border-rule py-3 text-start align-top text-xs font-normal text-muted"
                >
                  الجاهزية الحالية
                  <span className="mt-1 block text-[11px] leading-relaxed">
                    فحص آلي للمخطوطة كما رُفعت على متطلبات كل مجلة
                  </span>
                </th>
                {journals.map((journal) => (
                  <td
                    key={journal.journalId}
                    aria-live="polite"
                    className="border-b border-rule py-3 pe-4 align-top"
                  >
                    <ReadinessCell
                      journal={journal}
                      entry={readiness[journal.journalId]}
                      onRetry={onRetryReadiness}
                    />
                  </td>
                ))}
              </tr>
              <tr>
                <td />
                {journals.map((journal) => (
                  <td key={journal.journalId} className="pt-4 pe-4">
                    {selectedId === journal.journalId ? (
                      <span className="text-[13px] font-semibold text-terracotta-text">✓ المجلة المختارة</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelect(journal.journalId)}
                        className="h-10 rounded-[3px] border border-ink px-4 text-[13px] font-semibold hover:bg-ink hover:text-paper"
                      >
                        اختيار هذه المجلة
                        <span className="sr-only"> — {journal.name}</span>
                      </button>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </DialogFrame>
  );
}