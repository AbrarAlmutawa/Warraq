import Link from "next/link";
import { CONFIDENCE, formatCheckedDate } from "@/lib/journals/format";
import type { JournalMatch } from "@/lib/journals/types";
import type { ReadyDemoState } from "@/lib/workspace/ready";
import type { RequirementResult } from "@/lib/workspace/types";

type ReadyViewProps = {
  journal: JournalMatch;
  state: ReadyDemoState;
};

function CheckRow({ result }: { result: RequirementResult }) {
  const symbol = result.status === "passed" ? "✓" : result.status === "failed" ? "✕" : "◐";
  const symbolClass =
    result.status === "passed"
      ? "text-mint-text"
      : result.status === "failed"
        ? "text-terracotta-text"
        : "text-muted";
  return (
    <li className="flex gap-3 border-b border-rule py-3">
      <span aria-hidden="true" className={`font-bold ${symbolClass}`}>
        {symbol}
      </span>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold">{result.label}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-body">
          {result.message}
          {result.measured && <span className="text-muted"> · {result.measured}</span>}
        </p>
      </div>
    </li>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 border-b border-rule py-2.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="m-0 font-semibold">{children}</dd>
    </div>
  );
}

export function ReadyView({ journal, state }: ReadyViewProps) {
  const { manuscript, results, summary } = state;
  const isReady = summary.isFullyReady;

  const journalChecks = results.filter((result) => !result.isReviewRule && result.field !== "general");
  const generalChecks = results.filter((result) => result.field === "general");
  const reviewChecks = results.filter((result) => result.isReviewRule);
  const remaining = results.filter((result) => result.status !== "passed");

  const addedSections = [
    manuscript.highlights && !manuscript.highlights.isDraft ? "Highlights" : null,
    manuscript.dataAvailability && !manuscript.dataAvailability.isDraft ? "Data Availability Statement" : null,
  ].filter((section): section is string => Boolean(section));

  const workspaceHref = `/workspace/demo?journal=${journal.journalId}`;

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
            {isReady
              ? "استوفت المخطوطة المتطلبات التي تحقّق منها وَرَّاق لهذه المجلة."
              : "بعض متطلبات هذه المجلة تحتاج تعديلًا منك في المخطوطة لا يمكن محاكاته في هذا النموذج."}
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
                  {journal.shortName} · {journal.publisher}
                </span>
              </p>
            </div>
            {journal.sourceIsDemo && (
              <span className="rounded-full border border-rule-strong px-3 py-[3px] text-xs text-muted">
                بيانات تجريبية
              </span>
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
          <p className="mt-2 max-w-[720px] text-xs leading-relaxed text-muted">
            حالة تجريبية: تُبنى بتطبيق إجراءات التجهيز نفسها المتاحة في مساحة التجهيز على المخطوطة التجريبية، مع اعتبار
            البنود غير المؤكدة قد راجعها الباحث.
          </p>
        </section>

        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_420px]">
          {/* Checklist */}
          <section aria-labelledby="checklist-heading">
            <h2 id="checklist-heading" className="text-xl font-bold">
              {isReady ? "القائمة النهائية" : "ما زال بحاجة إلى معالجة"}
            </h2>

            {isReady ? (
              <div className="mt-4 flex flex-col gap-8">
                <div>
                  <h3 className="border-b border-ink pb-2 text-[15px] font-bold">متطلبات المجلة</h3>
                  <ul className="m-0 list-none p-0">
                    {journalChecks.map((result) => (
                      <CheckRow key={result.id} result={result} />
                    ))}
                  </ul>
                  {generalChecks.length > 0 && (
                    <p className="mt-3 text-[13px] leading-relaxed text-body">
                      <span className="font-semibold text-mint-text">✓ متطلبات عامة: </span>
                      {generalChecks.map((result) => result.label).join("، ")}
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="border-b border-ink pb-2 text-[15px] font-bold">تحقق الباحث</h3>
                  {reviewChecks.length > 0 ? (
                    <ul className="m-0 list-none p-0">
                      {reviewChecks.map((result) => (
                        <li key={result.id} className="flex gap-3 border-b border-rule py-3">
                          <span aria-hidden="true" className="font-bold text-mint-text">
                            ✓
                          </span>
                          <div>
                            <p className="text-[14px] font-semibold">{result.label}</p>
                            <p className="mt-0.5 text-[13px] text-body">
                              بند غير مؤكد في الاستخراج — أكّدته أنت بعد مراجعة المصدر
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="border-b border-rule py-3 text-[13px] text-body">
                      لم تُعلَّم بنود غير مؤكدة لهذه المجلة.
                    </p>
                  )}
                  <p className="mt-3 text-[13px] font-semibold text-mint-text">✓ لا توجد عناصر معلّقة</p>
                </div>

                <p className="text-xs leading-relaxed text-muted">
                  اقتراحات وَرَّاق اختيارية، ولا تدخل في حساب الجاهزية.
                </p>
              </div>
            ) : (
              <ul className="mt-4 m-0 list-none p-0">
                {remaining.map((result) => (
                  <CheckRow key={result.id} result={result} />
                ))}
              </ul>
            )}
          </section>

          <aside className="flex flex-col gap-10">
            {/* Manuscript summary */}
            <section aria-labelledby="manuscript-heading">
              <h2 id="manuscript-heading" className="text-xl font-bold">
                المخطوطة المجهّزة
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed font-semibold">
                <span dir="ltr" className="font-latin">
                  {manuscript.title}
                </span>
              </p>
              <dl className="mt-3 border-t border-rule">
                <SummaryRow label="عدد الكلمات">{manuscript.wordCount.toLocaleString("en-US")}</SummaryRow>
                <SummaryRow label="المراجع">{manuscript.referenceCount}</SummaryRow>
                <SummaryRow label="الأشكال والجداول">
                  {manuscript.figureCount} أشكال · {manuscript.tableCount} جداول
                </SummaryRow>
                <SummaryRow label="أسلوب الاستشهاد">
                  <span dir="ltr" className="font-latin">
                    {manuscript.citationStyle}
                  </span>
                </SummaryRow>
                <SummaryRow label="صيغة المخطوطة">
                  <span dir="ltr" className="font-latin">
                    {manuscript.format === "latex" ? "LaTeX" : "Word (DOCX)"}
                  </span>
                </SummaryRow>
                <SummaryRow label="أقسام أُضيفت">
                  {addedSections.length > 0 ? (
                    <span dir="ltr" className="font-latin">
                      {addedSections.join(", ")}
                    </span>
                  ) : (
                    "لا شيء"
                  )}
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
                    {journal.sourceIsDemo && <span>مصدر تجريبي — سيُستبدل بالمصدر الرسمي عند الربط</span>}
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
                  <dd className="m-0">{formatCheckedDate(journal.lastCheckedAt)}</dd>
                </div>
                <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 border-b border-rule py-2.5">
                  <dt className="text-muted">الثقة في الاستخراج</dt>
                  <dd className="m-0">
                    <span className="font-semibold">{CONFIDENCE[journal.extractionConfidence].label}</span>
                    <span className="text-muted"> — {CONFIDENCE[journal.extractionConfidence].detail}</span>
                  </dd>
                </div>
                <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 border-b border-rule py-2.5">
                  <dt className="text-muted">المراجعة البشرية</dt>
                  <dd className="m-0">
                    {reviewChecks.length > 0
                      ? `${reviewChecks.filter((result) => result.confirmedByUser).length} من ${reviewChecks.length} بنود راجعتها أنت`
                      : "لم تُعلَّم بنود للمراجعة"}
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

          <Link
            href="/journals"
            className="text-sm underline underline-offset-4 hover:text-terracotta-text"
          >
            اختيار مجلة أخرى
          </Link>

          <span className="flex-1" />

          {journal.sourceIsDemo ? (
            <p className="text-[13px] text-muted">
              الانتقال إلى موقع المجلة غير متاح: هذه مجلة تجريبية.
            </p>
          ) : (
            <a
              href={journal.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline underline-offset-4 hover:text-terracotta-text"
            >
              الانتقال إلى موقع المجلة ↗
            </a>
          )}
        </div>
      </div>
    </main>
  );
}