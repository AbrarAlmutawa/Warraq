"use client";

import { DialogFrame } from "@/components/journals/DialogFrame";
import { CONFIDENCE, formatCheckedDate } from "@/lib/journals/format";
import type { JournalMatch } from "@/lib/journals/types";

type SourceDialogProps = {
  match: JournalMatch | null;
  onClose: () => void;
};

/* Demo journals are fictional: their extraction metadata is not a real verification. */
const DEMO_NOT_APPLICABLE = "لا ينطبق — قيم تجريبية لم تُستخرج من دليل مؤلفين حقيقي ولم يُتحقق منها.";

export function SourceDialog({ match, onClose }: SourceDialogProps) {
  return (
    <DialogFrame open={match !== null} onClose={onClose} titleId="source-dialog-title" title="مصدر متطلبات المجلة">
      {match && (
        <div className="flex flex-col gap-5 text-sm">
          <div>
            <p className="text-[16px] font-semibold">
              <span dir="ltr" className="font-latin">
                {match.name}
              </span>
            </p>
            <p className="mt-0.5 text-[13px] text-muted">
              <span dir="ltr" className="font-latin">
                {match.publisher}
              </span>
            </p>
          </div>

          {match.sourceIsDemo && (
            <p className="border border-dashed border-subtle bg-paper-raised px-4 py-3 text-[13px] leading-relaxed text-body">
              <span className="font-bold text-ink">بيانات تجريبية: </span>
              هذه مجلة وهمية لأغراض العرض. قيمها ومتطلباتها ليست حقيقية ولم يُتحقق منها.
            </p>
          )}

          <dl className="flex flex-col border-t border-rule">
            <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 border-b border-rule py-3">
              <dt className="text-[13px] text-muted">المصدر</dt>
              <dd className="m-0 flex flex-col gap-1">
                {match.sourceIsDemo && <span>مصدر تجريبي - سيُستبدل بالمصدر الرسمي عند الربط</span>}
                <span className="flex flex-wrap items-center gap-2">
                  {match.sourceIsDemo && (
                    <span dir="ltr" className="border border-rule-strong px-1.5 font-latin text-[11px] font-semibold">
                      DEMO
                    </span>
                  )}
                  <span dir="ltr" className="font-latin text-[13px] break-all text-muted">
                    {match.sourceUrl}
                  </span>
                </span>
              </dd>
            </div>
            <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 border-b border-rule py-3">
              <dt className="text-[13px] text-muted">آخر تحقق</dt>
              <dd className="m-0">
                {match.sourceIsDemo ? (
                  <span className="text-muted">لا يوجد — بيانات تجريبية لم يُتحقق منها</span>
                ) : (
                  formatCheckedDate(match.lastCheckedAt)
                )}
              </dd>
            </div>
            <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 border-b border-rule py-3">
              <dt className="text-[13px] text-muted">الثقة في الاستخراج</dt>
              <dd className="m-0">
                {match.sourceIsDemo ? (
                  <span className="text-muted">{DEMO_NOT_APPLICABLE}</span>
                ) : (
                  <>
                    <span className="font-semibold">{CONFIDENCE[match.extractionConfidence].label}</span>
                    <span className="text-muted"> — {CONFIDENCE[match.extractionConfidence].detail}</span>
                  </>
                )}
              </dd>
            </div>
            <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 border-b border-rule py-3">
              <dt className="text-[13px] text-muted">المراجعة البشرية</dt>
              <dd className="m-0">
                {match.sourceIsDemo ? (
                  <span className="text-muted">{DEMO_NOT_APPLICABLE}</span>
                ) : match.needsHumanReview ? (
                  <span>
                    <span aria-hidden="true" className="font-bold text-muted">◐ </span>
                    بعض المتطلبات بحاجة إلى مراجعة قبل الاعتماد عليها
                  </span>
                ) : (
                  <span>
                    <span aria-hidden="true" className="font-bold text-mint-text">✓ </span>
                    لا توجد متطلبات معلّمة للمراجعة
                  </span>
                )}
              </dd>
            </div>
            <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 py-3">
              <dt className="text-[13px] text-muted">أبرز المتطلبات</dt>
              <dd className="m-0">
                {match.requirementsSummary.length > 0 ? (
                  <ul className="m-0 flex list-none flex-col gap-1 p-0">
                    {match.requirementsSummary.map((requirement) => (
                      <li key={requirement}>
                        <span dir="ltr" className="font-latin">
                          {requirement}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted">لم تُنشر متطلبات لهذه المجلة بعد.</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </DialogFrame>
  );
}