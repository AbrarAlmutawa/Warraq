"use client";

import { DialogFrame } from "@/components/journals/DialogFrame";
import { CONFIDENCE, formatCheckedDate } from "@/lib/journals/format";
import type { JournalMatch } from "@/lib/journals/types";
import type { RequirementResult } from "@/lib/workspace/types";

type WorkspaceSourceDialogProps = {
  result: RequirementResult | null;
  journal: JournalMatch;
  onClose: () => void;
};

export function WorkspaceSourceDialog({ result, journal, onClose }: WorkspaceSourceDialogProps) {
  return (
    <DialogFrame open={result !== null} onClose={onClose} titleId="requirement-source-title" title="مصدر المتطلب">
      {result && (
        <div className="flex flex-col gap-5 text-sm">
          {journal.sourceIsDemo && (
            <p className="border border-dashed border-subtle bg-paper-raised px-4 py-3 text-[13px] leading-relaxed text-body">
              <span className="font-bold text-ink">بيانات تجريبية: </span>
              هذه مجلة وهمية لأغراض العرض. المتطلب ونصه ليسا حقيقيين ولم يُتحقق منهما.
            </p>
          )}

          <div>
            <p className="text-xs text-muted">المتطلب</p>
            <p className="mt-1 text-[16px] font-bold">
              {result.label}: {result.requirement}
            </p>
            {result.measured && <p className="mt-1 text-body">في بحثك: {result.measured}</p>}
          </div>

          <div>
            <p className="text-xs text-muted">المجلة</p>
            <p className="mt-1 font-semibold">
              <span dir="ltr" className="font-latin">
                {journal.name}
              </span>
            </p>
            <p className="text-[13px] text-muted">
              <span dir="ltr" className="font-latin">
                {journal.publisher}
              </span>
            </p>
          </div>

          <div>
            <p className="text-xs text-muted">نص الإرشادات (مقتطف تجريبي)</p>
            <blockquote
              dir="ltr"
              className="mt-1.5 border-l-2 border-ink bg-paper-raised px-4 py-3 font-latin text-[14px] leading-relaxed"
            >
              “{result.excerpt}”
            </blockquote>
          </div>

          <dl className="m-0 flex flex-col border-t border-rule">
            <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-4 border-b border-rule py-3">
              <dt className="text-[13px] text-muted">المصدر</dt>
              <dd className="m-0 flex flex-col gap-1">
                <span>مصدر تجريبي — سيُستبدل بالمصدر الرسمي عند الربط</span>
                <span className="flex flex-wrap items-center gap-2">
                  <span dir="ltr" className="border border-rule-strong px-1.5 font-latin text-[11px] font-semibold">
                    DEMO
                  </span>
                  <span dir="ltr" className="font-latin text-[13px] break-all text-muted">
                    {journal.sourceUrl}
                  </span>
                </span>
              </dd>
            </div>
            <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-4 border-b border-rule py-3">
              <dt className="text-[13px] text-muted">آخر تحقق</dt>
              <dd className="m-0">{formatCheckedDate(journal.lastCheckedAt)}</dd>
            </div>
            <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-4 border-b border-rule py-3">
              <dt className="text-[13px] text-muted">الثقة في الاستخراج</dt>
              <dd className="m-0">
                <span className="font-semibold">{CONFIDENCE[result.confidence].label}</span>
                <span className="text-muted"> — {CONFIDENCE[result.confidence].detail}</span>
              </dd>
            </div>
            <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-4 py-3">
              <dt className="text-[13px] text-muted">المراجعة البشرية</dt>
              <dd className="m-0">
                {result.isReviewRule
                  ? result.confirmedByUser
                    ? "أكّدته أنت يدويًا"
                    : "مطلوبة — لم يستطع وَرَّاق التحقق من هذا البند بشكل مؤكد"
                  : "غير مطلوبة لهذا البند"}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </DialogFrame>
  );
}