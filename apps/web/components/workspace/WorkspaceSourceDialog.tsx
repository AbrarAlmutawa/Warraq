"use client";

import Link from "next/link";
import { DialogFrame } from "@/components/journals/DialogFrame";
import { CONFIDENCE, formatCheckedDate } from "@/lib/journals/format";
import type { JournalSummary } from "@/lib/journals/types";
import { requirementLabel } from "@/lib/workspace/requirement-labels";
import type { WorkspaceRequirement } from "@/lib/workspace/types";

type WorkspaceSourceDialogProps = {
  requirement: WorkspaceRequirement | null;
  journal: JournalSummary;
  onClose: () => void;
};

/* Demo journals are fictional: their extraction metadata is not a real verification. */
const DEMO_NOT_APPLICABLE = "لا ينطبق — قيم تجريبية لم تُستخرج من دليل مؤلفين حقيقي ولم يُتحقق منها.";

export function WorkspaceSourceDialog({ requirement, journal, onClose }: WorkspaceSourceDialogProps) {
  const isDemo = journal.sourceIsDemo;
  const sourceUrl = requirement?.sourceUrl ?? journal.sourceUrl;
  const label = requirement ? requirementLabel(requirement) : null;

  return (
    <DialogFrame open={requirement !== null} onClose={onClose} titleId="requirement-source-title" title="مصدر المتطلب">
      {requirement && label && (
        <div className="flex flex-col gap-5 text-sm">
          {isDemo && (
            <p className="border border-dashed border-subtle bg-paper-raised px-4 py-3 text-[13px] leading-relaxed text-body">
              <span className="font-bold text-ink">بيانات تجريبية: </span>
              هذه مجلة وهمية لأغراض العرض. المتطلب ونصه ليسا حقيقيين ولم يُتحقق منهما.
            </p>
          )}

          <div>
            <p className="text-xs text-muted">المتطلب</p>
            <p className="mt-1 text-[16px] font-bold">
              {label.latin ? (
                <span dir="ltr" className="font-latin">
                  {label.text}
                </span>
              ) : (
                label.text
              )}
              :{" "}
              <span dir="ltr" className="font-latin">
                {requirement.requirement}
              </span>
            </p>
            {requirement.measured && (
              <p className="mt-1 text-body">
                في بحثك:{" "}
                <span dir="ltr" className="font-latin">
                  {requirement.measured}
                </span>
              </p>
            )}
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
            <p className="text-xs text-muted">{isDemo ? "نص الإرشادات (مقتطف تجريبي)" : "نص الإرشادات"}</p>
            {requirement.sourceExcerpt ? (
              <blockquote
                dir="ltr"
                className="mt-1.5 border-l-2 border-ink bg-paper-raised px-4 py-3 font-latin text-[14px] leading-relaxed"
              >
                “{requirement.sourceExcerpt}”
              </blockquote>
            ) : (
              <p className="mt-1.5 text-[13px] text-muted">لا يتضمن سجل هذه المجلة مقتطفًا من دليل المؤلفين لهذا المتطلب.</p>
            )}
          </div>

          <dl className="m-0 flex flex-col border-t border-rule">
            <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-4 border-b border-rule py-3">
              <dt className="text-[13px] text-muted">المصدر</dt>
              <dd className="m-0 flex flex-col gap-1">
                {isDemo ? (
                  <>
                    <span>مصدر تجريبي — سيُستبدل بالمصدر الرسمي عند الربط</span>
                    <span className="flex flex-wrap items-center gap-2">
                      <span dir="ltr" className="border border-rule-strong px-1.5 font-latin text-[11px] font-semibold">
                        DEMO
                      </span>
                      <span dir="ltr" className="font-latin text-[13px] break-all text-muted">
                        {sourceUrl}
                      </span>
                    </span>
                  </>
                ) : (
                  <Link
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="ltr"
                    className="font-latin text-[13px] break-all underline underline-offset-4 hover:text-terracotta-text"
                  >
                    {sourceUrl}
                  </Link>
                )}
              </dd>
            </div>
            <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-4 border-b border-rule py-3">
              <dt className="text-[13px] text-muted">آخر تحقق</dt>
              <dd className="m-0">
                {isDemo ? (
                  <span className="text-muted">لا يوجد — بيانات تجريبية لم يُتحقق منها</span>
                ) : (
                  formatCheckedDate(journal.lastCheckedAt)
                )}
              </dd>
            </div>
            <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-4 border-b border-rule py-3">
              <dt className="text-[13px] text-muted">الثقة في الاستخراج</dt>
              <dd className="m-0">
                {isDemo ? (
                  <span className="text-muted">{DEMO_NOT_APPLICABLE}</span>
                ) : (
                  <>
                    <span className="font-semibold">{CONFIDENCE[requirement.confidence].label}</span>
                    <span className="text-muted"> — {CONFIDENCE[requirement.confidence].detail}</span>
                  </>
                )}
              </dd>
            </div>
            <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-4 py-3">
              <dt className="text-[13px] text-muted">المراجعة البشرية</dt>
              <dd className="m-0">
                {requirement.status === "review"
                  ? "مطلوبة — لم يستطع وَرَّاق التحقق من هذا البند آليًا"
                  : "غير مطلوبة لهذا البند"}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </DialogFrame>
  );
}