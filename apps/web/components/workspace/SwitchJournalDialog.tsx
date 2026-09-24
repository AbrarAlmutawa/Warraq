"use client";

import { useState } from "react";
import { DialogFrame } from "@/components/journals/DialogFrame";
import { OPEN_ACCESS_SHORT, formatApc, formatReviewDays } from "@/lib/journals/format";
import type { JournalMatch } from "@/lib/journals/types";
import { diffValidation, type DiffItem } from "@/lib/workspace/diff";
import { problemsPhrase, summarizeReadiness } from "@/lib/workspace/readiness";
import type { CitationStyle, RequirementResult } from "@/lib/workspace/types";

type SwitchJournalDialogProps = {
  open: boolean;
  currentJournal: JournalMatch;
  currentResults: RequirementResult[];
  candidates: JournalMatch[];
  evaluateFor: (journalId: string) => RequirementResult[];
  requiredStyleFor: (journalId: string) => CitationStyle;
  onClose: () => void;
  onConfirm: (journalId: string) => void;
};

type GroupItem = { key: string; symbol: string; label: string; detail: string };

function ImpactGroup({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "pass" | "fail" | "review" | "neutral";
  items: GroupItem[];
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
            <span className="font-semibold">{item.label}</span>
            <span className="text-body"> — {item.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const toItems = (items: DiffItem[]): GroupItem[] =>
  items.map((item) => ({
    key: item.id,
    symbol: item.symbol,
    label: item.label,
    detail: item.persists ? `${item.detail} (قائم حاليًا أيضًا)` : item.detail,
  }));

export function SwitchJournalDialog({
  open,
  currentJournal,
  currentResults,
  candidates,
  evaluateFor,
  requiredStyleFor,
  onClose,
  onConfirm,
}: SwitchJournalDialogProps) {
  const [step, setStep] = useState<"choose" | "preview">("choose");
  const [targetId, setTargetId] = useState<string | null>(null);

  const target = candidates.find((candidate) => candidate.journalId === targetId) ?? null;
  const impact = target ? diffValidation(currentResults, evaluateFor(target.journalId)) : null;

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
          بحثك محلَّل مسبقًا. سنعيد فحص النص الحالي نفسه، بما فيه تعديلاتك المقبولة، على متطلبات المجلة الجديدة — دون إعادة
          قراءة البحث.
        </p>

        {step === "choose" && (
          <>
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-2 text-[13px] font-semibold">اختر من قائمتك المقترحة</legend>
              {candidates.map((candidate) => {
                const checked = candidate.journalId === targetId;
                const outlook = summarizeReadiness(evaluateFor(candidate.journalId));
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
                      <span dir="ltr" className="text-start font-latin text-[15px] font-semibold">
                        {candidate.name}
                      </span>
                      <span dir="ltr" className="text-start font-latin text-xs text-muted">
                        {candidate.shortName} · {candidate.publisher}
                      </span>
                    </span>
                    <span className="flex gap-4 text-[12.5px]">
                      <span>{formatApc(candidate.apcUsd)}</span>
                      <span>{formatReviewDays(candidate.reviewDaysAvg)}</span>
                      <span>وصول مفتوح: {OPEN_ACCESS_SHORT[candidate.openAccess]}</span>
                    </span>
                    <span className="text-[12.5px] text-muted">
                      بعد التغيير: ✕ {outlook.hardErrorCount} · ◐ {outlook.reviewCount} · ✓ {outlook.passedCount}
                    </span>
                  </label>
                );
              })}
            </fieldset>
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
                onClick={() => setStep("preview")}
                className="h-11 rounded-[3px] bg-ink px-5 text-sm font-bold text-paper hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                معاينة الأثر
              </button>
            </div>
          </>
        )}

        {step === "preview" && target && impact && (
          <>
            <p className="text-[15px]">
              من{" "}
              <span dir="ltr" className="font-latin font-bold">
                {currentJournal.shortName}
              </span>{" "}
              <span aria-hidden="true" className="text-muted">
                ←
              </span>{" "}
              إلى{" "}
              <span dir="ltr" className="font-latin font-bold">
                {target.shortName}
              </span>
            </p>

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
                        {currentJournal.shortName}
                      </span>
                    </th>
                    <th scope="col" className="border-b-2 border-terracotta pb-2 text-start text-xs font-semibold text-ink">
                      الجديدة ·{" "}
                      <span dir="ltr" className="font-latin">
                        {target.shortName}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["رسوم النشر", formatApc(currentJournal.apcUsd), formatApc(target.apcUsd)],
                    ["مدة المراجعة", formatReviewDays(currentJournal.reviewDaysAvg), formatReviewDays(target.reviewDaysAvg)],
                    ["الوصول المفتوح", OPEN_ACCESS_SHORT[currentJournal.openAccess], OPEN_ACCESS_SHORT[target.openAccess]],
                    ["أسلوب الاستشهاد المطلوب", requiredStyleFor(currentJournal.journalId), requiredStyleFor(target.journalId)],
                    ["متطلبات إلزامية غير مستوفاة", `✕ ${impact.current.hardErrorCount}`, `✕ ${impact.candidate.hardErrorCount}`],
                    ["بنود تحتاج مراجعة", `◐ ${impact.current.reviewCount}`, `◐ ${impact.candidate.reviewCount}`],
                    ["متطلبات مستوفاة", `✓ ${impact.current.passedCount}`, `✓ ${impact.candidate.passedCount}`],
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
              الآن: {problemsPhrase(impact.current.hardErrorCount)} · بعد التغيير: {problemsPhrase(impact.candidate.hardErrorCount)}
            </p>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="flex flex-col gap-4">
                <ImpactGroup title="سيصبح مستوفى" tone="pass" items={toItems(impact.becomesPassed)} />
                <ImpactGroup title="لم يعد مطلوبًا" tone="neutral" items={toItems(impact.noLongerRequired)} />
                <ImpactGroup
                  title="تغيّر الشرط"
                  tone="neutral"
                  items={impact.changedRules.map((rule) => ({
                    key: rule.id,
                    symbol: "↔",
                    label: rule.label,
                    detail: `${rule.from} ← ${rule.to}`,
                  }))}
                />
              </div>
              <div className="flex flex-col gap-4">
                <ImpactGroup title="سيحتاج معالجة" tone="fail" items={toItems(impact.needsAttention)} />
                <ImpactGroup title="متطلب جديد" tone="neutral" items={toItems(impact.newRequirements)} />
                <ImpactGroup title="بحاجة إلى مراجعة" tone="review" items={toItems(impact.newReviews)} />
              </div>
            </div>

            <p className="text-[12.5px] text-muted">و{impact.unchangedCount} متطلبات أخرى بلا تغيير في النتيجة.</p>

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
              <button
                type="button"
                onClick={() => onConfirm(target.journalId)}
                className="h-11 rounded-[3px] bg-ink px-5 text-sm font-bold text-paper hover:bg-ink/90"
              >
                تأكيد تغيير المجلة
              </button>
            </div>
          </>
        )}
      </div>
    </DialogFrame>
  );
}