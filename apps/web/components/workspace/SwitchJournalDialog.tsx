"use client";

import Link from "next/link";
import { useState } from "react";
import { DialogFrame } from "@/components/journals/DialogFrame";
import type { ErrorPresentation } from "@/lib/api-errors";
import { OPEN_ACCESS_SHORT, formatApc, formatReviewDays } from "@/lib/journals/format";
import type { JournalSummary } from "@/lib/journals/types";
import { problemsPhrase } from "@/lib/workspace/readiness";
import type { PresentedText } from "@/lib/workspace/requirement-labels";
import {
  compareReports,
  requiredCitationStyle,
  type ImpactItem,
  type JournalReport,
} from "@/lib/workspace/switch-impact";
import type { ReadinessSummary } from "@/lib/workspace/types";

/* Readiness outlook for one candidate (from /validate/compare, or a full report already fetched). */
export type OutlookEntry =
  | { status: "loading" }
  | { status: "ready"; summary: ReadinessSummary }
  | { status: "error"; error: ErrorPresentation };

/* Full POST /validate result for one candidate, needed for the impact preview. */
export type ReportEntry =
  | { status: "loading" }
  | { status: "ready"; report: JournalReport }
  | { status: "error"; error: ErrorPresentation };

type SwitchJournalDialogProps = {
  open: boolean;
  currentJournal: JournalSummary;
  currentReport: JournalReport;
  candidates: JournalSummary[];
  outlooks: Record<string, OutlookEntry>;
  reports: Record<string, ReportEntry | undefined>;
  onRetryOutlooks: () => void;
  onRequestReport: (journalId: string) => void;
  onClose: () => void;
  onConfirm: (journalId: string) => void;
};

function Segments({ parts }: { parts: PresentedText[] }) {
  return (
    <>
      {parts.map((part, index) =>
        part.latin ? (
          <span key={index} dir="ltr" className="font-latin">
            {part.text}
          </span>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

function ImpactGroup({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "pass" | "fail" | "review" | "neutral";
  items: ImpactItem[];
}) {
  if (items.length === 0) return null;
  const headingClass = {
    pass: "border-mint/40 text-mint-text",
    fail: "border-terracotta/40 text-terracotta-text",
    review: "border-dashed border-subtle text-muted",
    neutral: "border-rule text-ink",
  }[tone];
  return (
    <section>
      <h3 className={`border-b pb-1.5 text-[13px] font-bold ${headingClass}`}>
        {title} · {items.length}
      </h3>
      <ul className="m-0 list-none p-0">
        {items.map((item) => (
          <li key={item.key} className="border-b border-rule py-2 text-[13px] leading-relaxed">
            <span aria-hidden="true" className="me-1 font-bold">
              {item.symbol}
            </span>
            <span className="font-semibold">
              <Segments parts={[item.label]} />
            </span>
            <span className="text-body">
              {" — "}
              <Segments parts={item.detail} />
              {item.persists ? " (قائم حاليًا أيضًا)" : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function shortOf(journal: JournalSummary): string {
  return journal.shortName ?? journal.name;
}

function OutlookText({ entry }: { entry: OutlookEntry | undefined }) {
  if (!entry || entry.status === "loading") {
    return <span className="text-[12.5px] text-muted">نفحص المتطلبات…</span>;
  }
  if (entry.status === "error") {
    return <span className="text-[12.5px] font-semibold text-terracotta-text">✕ تعذّر حساب الجاهزية</span>;
  }
  return (
    <span className="text-[12.5px] text-muted">
      بعد التغيير: ✕ {entry.summary.hardErrorCount} · ◐ {entry.summary.reviewCount} · ✓ {entry.summary.passedCount}
    </span>
  );
}

export function SwitchJournalDialog({
  open,
  currentJournal,
  currentReport,
  candidates,
  outlooks,
  reports,
  onRetryOutlooks,
  onRequestReport,
  onClose,
  onConfirm,
}: SwitchJournalDialogProps) {
  const [step, setStep] = useState<"choose" | "preview">("choose");
  const [targetId, setTargetId] = useState<string | null>(null);

  const target = candidates.find((candidate) => candidate.journalId === targetId) ?? null;
  const targetEntry = target ? reports[target.journalId] : undefined;
  const targetReport = targetEntry?.status === "ready" ? targetEntry.report : null;
  const impact = targetReport ? compareReports(currentReport, targetReport) : null;
  const hasOutlookErrors = candidates.some((candidate) => outlooks[candidate.journalId]?.status === "error");

  const openPreview = () => {
    if (!target) return;
    setStep("preview");
    onRequestReport(target.journalId);
  };

  const styleOf = (report: JournalReport) => requiredCitationStyle(report) ?? "غير محدد";

  return (
    <DialogFrame
      open={open}
      onClose={onClose}
      titleId="switch-journal-title"
      title="تغيير المجلة المستهدفة"
      widthClass="max-w-[920px]"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <span className={step === "choose" ? "font-bold text-ink" : ""}>١ اختيار المجلة</span>
          <span aria-hidden="true" className="h-px w-8 bg-stone" />
          <span className={step === "preview" ? "font-bold text-ink" : ""}>٢ معاينة الأثر</span>
        </div>
        <p className="text-[13.5px] leading-relaxed text-body">
          بحثك محلَّل مسبقًا. نفحص النص نفسه الذي رفعته على متطلبات المجلة الجديدة، دون إعادة قراءة البحث أو تعديله.
        </p>

        {step === "choose" && candidates.length === 0 && (
          <>
            <p className="text-[13.5px] leading-relaxed">
              لا توجد مجلات أخرى في آخر اقتراح للمجلات. ارجع إلى المجلات المقترحة لاختيار مجلة أخرى أو لتعديل أولوياتك.
            </p>
            <div className="flex items-center gap-3 border-t border-rule pt-4">
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-[3px] border border-rule-strong px-4 text-sm hover:border-ink"
              >
                إلغاء
              </button>
              <span className="flex-1" />
              <Link
                href="/journals"
                className="inline-flex h-11 items-center rounded-[3px] bg-ink px-5 text-sm font-bold text-paper hover:bg-ink/90"
              >
                المجلات المقترحة
              </Link>
            </div>
          </>
        )}

        {step === "choose" && candidates.length > 0 && (
          <>
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-2 text-[13px] font-semibold">اختر من قائمتك المقترحة</legend>
              {candidates.map((candidate) => {
                const checked = candidate.journalId === targetId;
                const identity = [candidate.shortName, candidate.publisher].filter(Boolean).join(" · ");
                return (
                  <label
                    key={candidate.journalId}
                    className={`flex cursor-pointer flex-wrap items-center gap-x-5 gap-y-2 rounded-[4px] border px-4 py-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
                      checked ? "border-2 border-ink bg-paper-raised" : "border-rule hover:border-ink"
                    }`}
                  >
                    <input
                      type="radio"
                      name="switch-target"
                      value={candidate.journalId}
                      checked={checked}
                      onChange={() => setTargetId(candidate.journalId)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={`size-4 shrink-0 rounded-full ${checked ? "border-[5px] border-ink" : "border-[1.5px] border-subtle"}`}
                    />
                    <span className="flex min-w-[240px] flex-1 flex-col">
                      <span className="flex flex-wrap items-center gap-2">
                        <span dir="ltr" className="text-start font-latin text-[15px] font-semibold">
                          {candidate.name}
                        </span>
                        {candidate.sourceIsDemo && (
                          <span className="rounded-full border border-rule-strong px-2 py-[1px] text-[11px] text-muted">
                            تجريبية
                          </span>
                        )}
                      </span>
                      <span dir="ltr" className="text-start font-latin text-xs text-muted">
                        {identity}
                      </span>
                    </span>
                    <span className="flex gap-4 text-[12.5px]">
                      <span>{formatApc(candidate.apcUsd)}</span>
                      <span>{formatReviewDays(candidate.reviewDaysAvg)}</span>
                      <span>وصول مفتوح: {OPEN_ACCESS_SHORT[candidate.openAccess]}</span>
                    </span>
                    <OutlookText entry={outlooks[candidate.journalId]} />
                  </label>
                );
              })}
            </fieldset>
            {hasOutlookErrors && (
              <p className="text-[12.5px] text-body">
                تعذّر حساب جاهزية بعض المجلات. يمكنك إعادة المحاولة، أو المتابعة إلى معاينة الأثر مباشرة.{" "}
                <button
                  type="button"
                  onClick={onRetryOutlooks}
                  className="underline underline-offset-4 hover:text-terracotta-text"
                >
                  إعادة المحاولة
                </button>
              </p>
            )}
            <div className="flex items-center gap-3 border-t border-rule pt-4">
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-[3px] border border-rule-strong px-4 text-sm hover:border-ink"
              >
                إلغاء
              </button>
              <span className="flex-1" />
              <button
                type="button"
                disabled={!target}
                onClick={openPreview}
                className="h-11 rounded-[3px] bg-ink px-5 text-sm font-bold text-paper hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                معاينة الأثر
              </button>
            </div>
          </>
        )}

        {step === "preview" && target && (
          <>
            <p className="text-[15px]">
              من{" "}
              <span dir="ltr" className="font-latin font-bold">
                {shortOf(currentJournal)}
              </span>{" "}
              <span aria-hidden="true" className="text-muted">
                ←
              </span>{" "}
              إلى{" "}
              <span dir="ltr" className="font-latin font-bold">
                {shortOf(target)}
              </span>
            </p>

            {(!targetEntry || targetEntry.status === "loading") && (
              <p role="status" className="text-[13.5px] text-muted">
                نفحص البحث على متطلبات هذه المجلة…
              </p>
            )}

            {targetEntry?.status === "error" && (
              <div role="alert" className="flex flex-col gap-1 border border-terracotta/45 bg-terracotta-tint px-4 py-3">
                <p className="text-[13.5px] font-semibold text-terracotta-text">✕ {targetEntry.error.title}</p>
                <p className="text-[13px] leading-relaxed text-body">{targetEntry.error.message}</p>
                {targetEntry.error.detail && (
                  <p dir="ltr" className="font-latin text-[12px] break-words text-muted">
                    {targetEntry.error.detail}
                  </p>
                )}
              </div>
            )}

            {targetReport && impact && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] border-collapse text-[13.5px]">
                    <thead>
                      <tr>
                        <th scope="col" className="w-[190px] border-b border-ink pb-2 text-start font-normal">
                          <span className="sr-only">البند</span>
                        </th>
                        <th scope="col" className="border-b border-ink pb-2 text-start text-xs font-semibold text-muted">
                          الحالية ·{" "}
                          <span dir="ltr" className="font-latin">
                            {shortOf(currentJournal)}
                          </span>
                        </th>
                        <th scope="col" className="border-b-2 border-terracotta pb-2 text-start text-xs font-semibold text-ink">
                          الجديدة ·{" "}
                          <span dir="ltr" className="font-latin">
                            {shortOf(target)}
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["رسوم النشر", formatApc(currentJournal.apcUsd), formatApc(target.apcUsd)],
                        ["مدة المراجعة", formatReviewDays(currentJournal.reviewDaysAvg), formatReviewDays(target.reviewDaysAvg)],
                        ["الوصول المفتوح", OPEN_ACCESS_SHORT[currentJournal.openAccess], OPEN_ACCESS_SHORT[target.openAccess]],
                        ["أسلوب الاستشهاد المطلوب", styleOf(currentReport), styleOf(targetReport)],
                        ["متطلبات إلزامية غير مستوفاة", `✕ ${impact.current.hardErrorCount}`, `✕ ${impact.target.hardErrorCount}`],
                        ["بنود تحتاج مراجعة", `◐ ${impact.current.reviewCount}`, `◐ ${impact.target.reviewCount}`],
                        ["متطلبات مستوفاة", `✓ ${impact.current.passedCount}`, `✓ ${impact.target.passedCount}`],
                      ].map(([label, from, to]) => (
                        <tr key={label}>
                          <th scope="row" className="border-b border-rule py-2 text-start text-xs font-normal text-muted">
                            {label}
                          </th>
                          <td className="border-b border-rule py-2">{from}</td>
                          <td className="border-b border-rule py-2 font-semibold">{to}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-[14px] font-semibold">
                  الآن: {problemsPhrase(impact.current.hardErrorCount)} · بعد التغيير:{" "}
                  {problemsPhrase(impact.target.hardErrorCount)}
                </p>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="flex flex-col gap-4">
                    <ImpactGroup title="سيصبح مستوفى" tone="pass" items={impact.becomesPassed} />
                    <ImpactGroup title="لم يعد مطلوبًا" tone="neutral" items={impact.noLongerRequired} />
                    <ImpactGroup title="تغيّر الشرط" tone="neutral" items={impact.changedRules} />
                  </div>
                  <div className="flex flex-col gap-4">
                    <ImpactGroup title="سيحتاج معالجة" tone="fail" items={impact.needsAttention} />
                    <ImpactGroup title="متطلب جديد" tone="neutral" items={impact.newRequirements} />
                    <ImpactGroup title="بحاجة إلى مراجعة" tone="review" items={impact.newReviews} />
                  </div>
                </div>

                <p className="text-[12.5px] text-muted">و{impact.unchangedCount} متطلبات أخرى بلا تغيير في النتيجة.</p>
              </>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-4">
              <button
                type="button"
                onClick={() => setStep("choose")}
                className="h-11 rounded-[3px] border border-rule-strong px-4 text-sm hover:border-ink"
              >
                رجوع
              </button>
              <button type="button" onClick={onClose} className="h-11 px-2 text-sm underline underline-offset-4">
                إلغاء
              </button>
              <span className="flex-1" />
              {targetEntry?.status === "error" ? (
                <button
                  type="button"
                  onClick={() => onRequestReport(target.journalId)}
                  className="h-11 rounded-[3px] bg-ink px-5 text-sm font-bold text-paper hover:bg-ink/90"
                >
                  إعادة المحاولة
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!targetReport}
                  onClick={() => onConfirm(target.journalId)}
                  className="h-11 rounded-[3px] bg-ink px-5 text-sm font-bold text-paper hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  تأكيد تغيير المجلة
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </DialogFrame>
  );
}