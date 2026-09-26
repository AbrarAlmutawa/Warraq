import type { ReactNode } from "react";
import {
  OPEN_ACCESS_SHORT,
  SCOPE_FIT,
  formatApc,
  formatCheckedDate,
  formatReviewDays,
  formatSimilarityScore,
  indexLabels,
} from "@/lib/journals/format";
import { isFastEnough, isOpenAccessAvailable, isWithinBudget } from "@/lib/journals/filters";
import type { JournalMatch } from "@/lib/journals/types";
import type { JournalPreferences } from "@/lib/preferences/types";

type JournalResultRowProps = {
  match: JournalMatch;
  preferences: JournalPreferences;
  isSelected: boolean;
  onSelect: () => void;
  isCompared: boolean;
  compareDisabled: boolean;
  onToggleCompare: () => void;
  onShowSource: () => void;
};

function FitMarks({ level }: { level: number }) {
  return (
    <span aria-hidden="true" className="flex gap-[3px]">
      {[1, 2, 3].map((step) => (
        <span key={step} className={`h-4 w-1.5 border border-ink ${step <= level ? "bg-ink" : ""}`} />
      ))}
    </span>
  );
}

function Fact({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="m-0 font-semibold">{value}</dd>
      {note && <dd className="m-0 text-xs">{note}</dd>}
    </div>
  );
}

function PreferenceNote({ ok, okText, notText }: { ok: boolean; okText: string; notText: string }) {
  return ok ? (
    <span className="text-mint-text">✓ {okText}</span>
  ) : (
    <span className="text-muted">{notText}</span>
  );
}

export function JournalResultRow({
  match,
  preferences,
  isSelected,
  onSelect,
  isCompared,
  compareDisabled,
  onToggleCompare,
  onShowSource,
}: JournalResultRowProps) {
  const fit = SCOPE_FIT[match.scopeFit];
  const wantsOpenAccess = preferences.openAccess !== "any";

  return (
    <li
      className={`relative grid gap-5 border-b border-rule py-5 ps-5 lg:grid-cols-[260px_minmax(0,1fr)_290px_180px] lg:gap-6 ${
        isSelected ? "bg-paper-raised" : ""
      }`}
    >
      {isSelected && <span aria-hidden="true" className="absolute inset-y-0 right-0 w-[3px] bg-terracotta" />}

      {/* Identity */}
      <div className="flex flex-col gap-1">
        <h3 className="text-[17px] leading-snug font-semibold">
          <span dir="ltr" className="font-latin">
            {match.name}
          </span>
        </h3>
        <p className="text-[13px] text-muted">
          <span dir="ltr" className="font-latin">
            {match.shortName} · {match.publisher}
          </span>
        </p>
        {isSelected && <p className="mt-2 text-[13px] font-semibold text-terracotta-text">✓ المجلة المختارة</p>}
      </div>

      {/* Why it fits */}
      <div className="flex min-w-0 flex-col gap-2.5">
        <div className="flex items-center gap-2.5">
          <FitMarks level={fit.level} />
          <span className="text-[14.5px] font-bold">{fit.label}</span>
        </div>
        <p className="text-[13.5px] leading-[1.75]">
          درجة تشابه النطاق مع بحثك:{" "}
          <span dir="ltr" className="font-latin font-semibold">
            {formatSimilarityScore(match.similarityScore)}
          </span>{" "}
          من 1
        </p>
        {match.matchedTopics.length > 0 && (
          <p className="text-[13px] leading-[1.75] text-body">
            موضوعات مشتركة:{" "}
            <span dir="ltr" className="font-latin">
              {match.matchedTopics.join(", ")}
            </span>
          </p>
        )}
        <p className="text-[12.5px] leading-relaxed text-muted">
          <span className="font-semibold text-ink">أبرز المتطلبات: </span>
          {match.requirementsSummary.map((requirement, index) => (
            <span key={requirement}>
              {index > 0 && <span aria-hidden="true"> · </span>}
              {requirement}
            </span>
          ))}
        </p>
        {match.needsHumanReview && (
          <p className="text-xs text-muted">
            <span aria-hidden="true" className="font-bold">
              ◐{" "}
            </span>
            بعض المتطلبات بحاجة إلى مراجعة
          </p>
        )}
      </div>

      {/* Practical trade-offs */}
      <dl className="m-0 grid grid-cols-2 content-start gap-x-5 gap-y-3 text-[13.5px]">
        <Fact
          label="رسوم النشر"
          value={formatApc(match.apcUsd)}
          note={
            preferences.maxApcUsd !== null && (
              <PreferenceNote
                ok={isWithinBudget(match, preferences)}
                okText="ضمن ميزانيتك"
                notText="أعلى من ميزانيتك"
              />
            )
          }
        />
        <Fact
          label="الوصول المفتوح"
          value={OPEN_ACCESS_SHORT[match.openAccess]}
          note={
            wantsOpenAccess && !isOpenAccessAvailable(match) ? (
              <span className="text-muted">لا يطابق تفضيلك</span>
            ) : undefined
          }
        />
        <Fact
          label="مدة المراجعة"
          value={formatReviewDays(match.reviewDaysAvg)}
          note={
            preferences.maxReviewDays !== null && (
              <PreferenceNote
                ok={isFastEnough(match, preferences)}
                okText="ضمن المدة المفضّلة"
                notText="أطول من المفضّل"
              />
            )
          }
        />
        <Fact
          label="الفهرسة"
          value={
            <span dir="ltr" className="font-latin">
              {indexLabels(match.indexes).join(", ")}
            </span>
          }
        />
      </dl>

      {/* Actions */}
      <div className="flex flex-col items-start gap-3">
        <label
          className={`inline-flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-[3px] border px-3 text-[13.5px] font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
            isSelected ? "border-ink bg-ink text-paper" : "border-ink bg-transparent text-ink hover:bg-paper-raised"
          }`}
        >
          <input
            type="radio"
            name="target-journal"
            value={match.journalId}
            checked={isSelected}
            onChange={onSelect}
            className="sr-only"
          />
          {isSelected ? "✓ مختارة" : "اختيار هذه المجلة"}
          <span className="sr-only"> — {match.name}</span>
        </label>

        <label
          className={`inline-flex items-center gap-2 text-[13px] ${
            compareDisabled ? "cursor-not-allowed text-muted" : "cursor-pointer"
          }`}
          title={compareDisabled ? "يمكن مقارنة مجلتين فقط" : undefined}
        >
          <input
            type="checkbox"
            checked={isCompared}
            disabled={compareDisabled}
            onChange={onToggleCompare}
            className="size-4 accent-ink"
          />
          مقارنة
          <span className="sr-only"> — {match.name}</span>
        </label>

        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={onShowSource}
            className="self-start text-[13px] underline underline-offset-4 hover:text-terracotta-text"
          >
            عرض المصدر
            <span className="sr-only"> — {match.name}</span>
          </button>
          <span className="text-xs text-muted">تحقق {formatCheckedDate(match.lastCheckedAt)}</span>
        </div>
      </div>
    </li>
  );
}