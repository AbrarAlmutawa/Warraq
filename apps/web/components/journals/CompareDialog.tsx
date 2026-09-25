"use client";

import type { ReactNode } from "react";
import { DialogFrame } from "@/components/journals/DialogFrame";
import {
  OPEN_ACCESS_FULL,
  SCOPE_FIT,
  formatApc,
  formatReviewDays,
  indexLabels,
} from "@/lib/journals/format";
import type { JournalMatch } from "@/lib/journals/types";

type CompareDialogProps = {
  open: boolean;
  journals: JournalMatch[];
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
        <span className="mt-1 block leading-relaxed text-body">{journal.scopeReason}</span>
      </>
    ),
  },
  { label: "رسوم النشر", render: (journal) => formatApc(journal.apcUsd) },
  { label: "الوصول المفتوح", render: (journal) => OPEN_ACCESS_FULL[journal.openAccess] },
  { label: "مدة المراجعة", render: (journal) => formatReviewDays(journal.reviewDaysAvg) },
  {
    label: "الفهرسة",
    render: (journal) => (
      <span dir="ltr" className="font-latin">
        {indexLabels(journal.indexes).join(", ")}
      </span>
    ),
  },
];

export function CompareDialog({ open, journals, selectedId, onClose, onSelect }: CompareDialogProps) {
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