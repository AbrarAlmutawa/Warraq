import { readinessStatus } from "@/lib/workspace/readiness";
import type { ReadinessSummary, RequirementStatus } from "@/lib/workspace/types";

export function ReadinessCounts({ summary }: { summary: ReadinessSummary }) {
  return (
    <p className="flex items-center gap-4 text-[13px] whitespace-nowrap">
      <span className="font-bold text-terracotta-text">
        ✕ {summary.hardErrorCount} <span className="font-normal">متطلبات إلزامية</span>
      </span>
      <span className="font-semibold text-muted">
        ◐ {summary.reviewCount} <span className="font-normal">يحتاج مراجعة</span>
      </span>
      <span className="font-semibold text-mint-text">
        ✓ {summary.passedCount} <span className="font-normal">مستوفى</span>
      </span>
    </p>
  );
}

const TICK_CLASS: Record<RequirementStatus, string> = {
  failed: "h-2 flex-1 bg-terracotta",
  review: "h-2 flex-1 border-[1.5px] border-dashed border-subtle",
  passed: "h-2 flex-1 bg-mint",
};

/*
 * The panel's readiness line: a heading, the status sentence and the tick bar. The counts are
 * shown once, in the workspace header (ReadinessCounts), so they are not repeated here.
 */
export function ReadinessPanelSummary({
  summary,
  results,
}: {
  summary: ReadinessSummary;
  /* Only each check's status is used, for the tick bar; the counts come from `summary`. */
  results: ReadonlyArray<{ status: RequirementStatus }>;
}) {
  const status = readinessStatus(summary);
  const ordered = [
    ...results.filter((result) => result.status === "failed"),
    ...results.filter((result) => result.status === "review"),
    ...results.filter((result) => result.status === "passed"),
  ];

  return (
    <section aria-labelledby="readiness-heading" className="shrink-0 border-b border-rule px-5 pt-4 pb-3.5">
      <h2 id="readiness-heading" className="text-[13px] font-bold text-muted">
        جاهزية البحث للنشر
      </h2>
      <p id="readiness-status" aria-live="polite" className="mt-1 text-[14px] leading-relaxed">
        {status.tone === "ready" ? (
          <span className="bg-terracotta/25 px-1.5 font-bold">جاهز للتقديم</span>
        ) : (
          <span className={status.tone === "review" ? "font-semibold text-ink" : "text-ink"}>{status.text}</span>
        )}
      </p>

      <div aria-hidden="true" className="mt-2.5 flex gap-0.5">
        {ordered.map((result, index) => (
          <span key={index} className={TICK_CLASS[result.status]} />
        ))}
      </div>
    </section>
  );
}