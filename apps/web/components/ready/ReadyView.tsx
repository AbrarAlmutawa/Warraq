import Link from "next/link";
import type { ReactNode } from "react";
import { FIGURES, TABLES, arabicCount } from "@/lib/analysis/stages";
import { CONFIDENCE, formatCheckedDate } from "@/lib/journals/format";
import type { JournalSummary } from "@/lib/journals/types";
import { requirementLabel, requirementMessage } from "@/lib/workspace/requirement-labels";
import type { ReadinessSummary, WorkspaceRequirement } from "@/lib/workspace/types";

/* Parser facts shown on the ready page (from GET /manuscripts/{id}). */
export type ReadyManuscript = {
  title: string;
  mainTextWordCount: number;
  referenceCount: number;
  figureCount: number;
  tableCount: number;
  /** Measured by the backend's citation_style rule for this journal; null when it has no such rule */
  citationStyle: string | null;
};

type ReadyViewProps = {
  journal: JournalSummary;
  manuscript: ReadyManuscript;
  requirements: WorkspaceRequirement[];
  summary: ReadinessSummary;
  isDemoManuscript: boolean;
};

/* Demo journals are fictional: their extraction metadata is not a real verification. */
const DEMO_NOT_APPLICABLE = "لا ينطبق — قيم تجريبية لم تُستخرج من دليل مؤلفين حقيقي ولم يُتحقق منها.";

function CheckRow({ requirement }: { requirement: WorkspaceRequirement }) {
  const symbol = requirement.status === "passed" ? "✓" : requirement.status === "failed" ? "✕" : "◐";
  const symbolClass =
    requirement.status === "passed"
      ? "text-mint-text"
      : requirement.status === "failed"
        ? "text-terracotta-text"
        : "text-muted";
  const label = requirementLabel(requirement);
  const message = requirementMessage(requirement);

  return (
    <li className="flex gap-3 border-b border-rule py-3">
      <span aria-hidden="true" className={`font-bold ${symbolClass}`}>
        {symbol}
      </span>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold">
          {label.latin ? (
            <span dir="ltr" className="font-latin">
              {label.text}
            </span>
          ) : (
            label.text
          )}
        </p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-body">
          {message.latin ? (
            <span dir="ltr" className="font-latin">
              {message.text}
            </span>
          ) : (
            message.text
          )}
          <span className="text-muted">
            {" · "}
            {requirement.measured && (
              <>
                <span dir="ltr" className="font-latin">
                  {requirement.measured}
                </span>
                {" · "}
              </>
            )}
            الشرط:{" "}
            <span dir="ltr" className="font-latin">
              {requirement.requirement}
            </span>
          </span>
        </p>
      </div>
    </li>
  );
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 border-b border-rule py-2.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="m-0 font-semibold">{children}</dd>
    </div>
  );
}

/*
 * Readiness exactly as POST /validate reports it for the uploaded manuscript. When the backend
 * says it is not fully ready, this page says so; nothing here can make it ready.
 */
export function ReadyView({ journal, manuscript, requirements, summary, isDemoManuscript }: ReadyViewProps) {
  const isReady = summary.isFullyReady;
  const remaining = requirements.filter((requirement) => requirement.status !== "passed");
  const workspaceHref = `/workspace?journal=${encodeURIComponent(journal.journalId)}`;
  const identity = [journal.shortName, journal.publisher].filter(Boolean).join(" · ");

  const notReadyText = summary.meetsHardRequirements
    ? "المتطلبات الإلزامية مستوفاة حسب فحص وَرَّاق، وما زالت بنود بحاجة إلى مراجعتك قبل التقديم."
    : "حسب فحص وَرَّاق لمخطوطتك كما رُفعت، ما زالت بعض المتطلبات غير مستوفاة. صحّحها في ملف Word ثم ارفع النسخة المعدّلة لإعادة الفحص.";

  return (
    <main className="flex-1 px-6 pt-12 pb-16 lg:px-[72px]">
      <div className="mx-auto w-full max-w-[1120px]">
        {/* Final state */}
        <section aria-labelledby="ready-heading" className="relative ps-7">
          <div aria-hidden="true" className="absolute top-1.5 right-0 h-full w-px bg-rule" />
          <div aria-hidden="true" className="absolute top-1.5 -right-px h-24 w-[3px] bg-terracotta" />

          <p className="text-sm font-semibold text-terracotta-text">نتيجة التجهيز</p>
          <h1 id="ready-heading" className="mt-3 text-[40px] leading-tight font-bold lg:text-[52px]">
            {isReady ? <span className="bg-terracotta/25 px-2">جاهز للتقديم</span> : "لم تكتمل الجاهزية بعد"}
          </h1>
          <p className="mt-4 max-w-[640px] text-[17px] leading-[1.85] text-body">
            {isReady ? "استوفت المخطوطة المتطلبات التي تحقّق منها وَرَّاق لهذه المجلة." : notReadyText}
          </p>

          <div className="mt-7 flex flex-wrap items-end gap-4">
            <div>
              <p className="text-xs text-muted">المجلة المستهدفة</p>
              <p className="mt-1 text-xl font-semibold">
                <span dir="ltr" className="font-latin">
                  {journal.name}
                </span>
              </p>
              <p className="text-sm text-muted">
                <span dir="ltr" className="font-latin">
                  {identity}
                </span>
              </p>
            </div>
            {journal.sourceIsDemo && (
              <span className="rounded-full border border-rule-strong px-3 py-[3px] text-xs text-muted">
                بيانات تجريبية
              </span>
            )}
            {isDemoManuscript && (
              <span className="rounded-full border border-rule-strong px-3 py-[3px] text-xs text-muted">بحث تجريبي</span>
            )}
          </div>

          <dl className="mt-7 grid border-t border-b border-t-ink border-b-rule sm:grid-cols-3">
            <div className="flex flex-col-reverse gap-1 py-3">
              <dt className="text-xs text-muted">متطلبات إلزامية غير مستوفاة</dt>
              <dd className={`m-0 text-lg font-bold ${summary.hardErrorCount === 0 ? "text-mint-text" : "text-terracotta-text"}`}>
                {summary.hardErrorCount === 0 ? "✓" : "✕"} {summary.hardErrorCount}
              </dd>
            </div>
            <div className="flex flex-col-reverse gap-1 py-3">
              <dt className="text-xs text-muted">بنود معلّقة للمراجعة</dt>
              <dd className={`m-0 text-lg font-bold ${summary.reviewCount === 0 ? "text-mint-text" : "text-muted"}`}>
                {summary.reviewCount === 0 ? "✓" : "◐"} {summary.reviewCount}
              </dd>
            </div>
            <div className="flex flex-col-reverse gap-1 py-3">
              <dt className="text-xs text-muted">متطلبات مستوفاة</dt>
              <dd className="m-0 text-lg font-bold text-mint-text">
                ✓ {summary.passedCount} من {summary.total}
              </dd>
            </div>
          </dl>

          <p className="mt-4 max-w-[720px] text-[13px] leading-relaxed text-muted">
            الجاهزية تعني توافق المخطوطة مع متطلبات التجهيز التي تم التحقق منها، ولا تعني ضمان قبولها للنشر.
          </p>
        </section>

        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_420px]">
          {/* Checklist */}
          <section aria-labelledby="checklist-heading">
            <h2 id="checklist-heading" className="text-xl font-bold">
              {isReady ? "القائمة النهائية" : "ما زال بحاجة إلى معالجة"}
            </h2>

            {isReady ? (
              <div className="mt-4 flex flex-col gap-4">
                <div>
                  <h3 className="border-b border-ink pb-2 text-[15px] font-bold">متطلبات المجلة</h3>
                  <ul className="m-0 list-none p-0">
                    {requirements.map((requirement) => (
                      <CheckRow key={requirement.ruleId} requirement={requirement} />
                    ))}
                  </ul>
                </div>
                <p className="text-xs leading-relaxed text-muted">اقتراحات وَرَّاق اختيارية، ولا تدخل في حساب الجاهزية.</p>
              </div>
            ) : (
              <ul className="mt-4 m-0 list-none p-0">
                {remaining.map((requirement) => (
                  <CheckRow key={requirement.ruleId} requirement={requirement} />
                ))}
              </ul>
            )}
          </section>

          <aside className="flex flex-col gap-10">
            {/* Manuscript summary */}
            <section aria-labelledby="manuscript-heading">
              <h2 id="manuscript-heading" className="text-xl font-bold">
                المخطوطة
              </h2>
              {manuscript.title && (
                <p className="mt-3 text-[15px] leading-relaxed font-semibold">
                  <span dir="ltr" className="font-latin">
                    {manuscript.title}
                  </span>
                </p>
              )}
              <dl className="mt-3 border-t border-rule">
                <SummaryRow label="كلمات النص الرئيسي">{manuscript.mainTextWordCount.toLocaleString("en-US")}</SummaryRow>
                <SummaryRow label="المراجع">{manuscript.referenceCount.toLocaleString("en-US")}</SummaryRow>
                <SummaryRow label="الأشكال والجداول">
                  {arabicCount(manuscript.figureCount, FIGURES)} · {arabicCount(manuscript.tableCount, TABLES)}
                </SummaryRow>
                {manuscript.citationStyle && (
                  <SummaryRow label="أسلوب الاستشهاد">
                    <span dir="ltr" className="font-latin">
                      {manuscript.citationStyle}
                    </span>
                  </SummaryRow>
                )}
                <SummaryRow label="صيغة المخطوطة">
                  <span dir="ltr" className="font-latin">
                    Word (DOCX)
                  </span>
                </SummaryRow>
              </dl>
            </section>

            {/* Source transparency */}
            <section aria-labelledby="sources-heading">
              <h2 id="sources-heading" className="text-xl font-bold">
                مصادر المتطلبات
              </h2>
              <dl className="mt-3 border-t border-rule text-sm">
                <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 border-b border-rule py-2.5">
                  <dt className="text-muted">المصدر</dt>
                  <dd className="m-0 flex flex-col gap-1">
                    {journal.sourceIsDemo && <span>مصدر تجريبي - سيُستبدل بالمصدر الرسمي عند الربط</span>}
                    <span className="flex flex-wrap items-center gap-2">
                      {journal.sourceIsDemo && (
                        <span dir="ltr" className="border border-rule-strong px-1.5 font-latin text-[11px] font-semibold">
                          DEMO
                        </span>
                      )}
                      <span dir="ltr" className="font-latin text-[13px] break-all text-muted">
                        {journal.sourceUrl}
                      </span>
                    </span>
                  </dd>
                </div>
                <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 border-b border-rule py-2.5">
                  <dt className="text-muted">آخر تحقق</dt>
                  <dd className="m-0">
                    {journal.sourceIsDemo ? (
                      <span className="text-muted">لا يوجد — بيانات تجريبية لم يُتحقق منها</span>
                    ) : (
                      formatCheckedDate(journal.lastCheckedAt)
                    )}
                  </dd>
                </div>
                <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 border-b border-rule py-2.5">
                  <dt className="text-muted">الثقة في الاستخراج</dt>
                  <dd className="m-0">
                    {journal.sourceIsDemo ? (
                      <span className="text-muted">{DEMO_NOT_APPLICABLE}</span>
                    ) : (
                      <>
                        <span className="font-semibold">{CONFIDENCE[journal.extractionConfidence].label}</span>
                        <span className="text-muted"> — {CONFIDENCE[journal.extractionConfidence].detail}</span>
                      </>
                    )}
                  </dd>
                </div>
                <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 border-b border-rule py-2.5">
                  <dt className="text-muted">المراجعة البشرية</dt>
                  <dd className="m-0">
                    {journal.sourceIsDemo ? (
                      <span className="text-muted">{DEMO_NOT_APPLICABLE}</span>
                    ) : journal.needsHumanReview ? (
                      "بعض متطلبات هذه المجلة بحاجة إلى مراجعة قبل الاعتماد عليها"
                    ) : (
                      "لا توجد متطلبات معلّمة للمراجعة"
                    )}
                  </dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>

        {/* Actions */}
        <div className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-rule pt-6">
          <Link
            href={workspaceHref}
            className="inline-flex h-12 items-center rounded-[3px] bg-ink px-6 text-[15px] font-bold text-paper hover:bg-ink/90"
          >
            العودة إلى مساحة التجهيز
          </Link>

          {!isReady && (
            <Link href="/" className="text-sm underline underline-offset-4 hover:text-terracotta-text">
              رفع نسخة معدّلة
            </Link>
          )}

          <Link href="/journals" className="text-sm underline underline-offset-4 hover:text-terracotta-text">
            اختيار مجلة أخرى
          </Link>

          <span className="flex-1" />

          {journal.sourceIsDemo ? (
            <p className="text-[13px] text-muted">الانتقال إلى موقع المجلة غير متاح: هذه مجلة تجريبية.</p>
          ) : (
            <Link
              href={journal.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline underline-offset-4 hover:text-terracotta-text"
            >
              الانتقال إلى موقع المجلة ↗
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}