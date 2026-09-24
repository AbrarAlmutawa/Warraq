import { readinessStatus } from "@/lib/workspace/readiness";
import type { ReadinessSummary, RequirementResult } from "@/lib/workspace/types";

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

const TICK_CLASS: Record<RequirementResult["status"], string> = {
  failed: "h-2.5 flex-1 bg-terracotta",
  review: "h-2.5 flex-1 border-[1.5px] border-dashed border-subtle",
  passed: "h-2.5 flex-1 bg-mint",
};

export function ReadinessPanelSummary({
  summary,
  results,
}: {
  summary: ReadinessSummary;
  results: RequirementResult[];
}) {
  const status = readinessStatus(summary);
  const ordered = [
    ...results.filter((result) => result.status === "failed"),
    ...results.filter((result) => result.status === "review"),
    ...results.filter((result) => result.status === "passed"),
  ];

  return (
    <section aria-labelledby="readiness-heading" className="shrink-0 border-b border-rule px-5 py-4">
      <h2 id="readiness-heading" className="text-[15px] font-bold">
        جاهزية البحث للنشر
      </h2>
      <p id="readiness-status" aria-live="polite" className="mt-1.5 text-[13.5px] leading-relaxed">
        {status.tone === "ready" ? (
          <span className="bg-terracotta/25 px-1.5 font-bold">جاهز للتقديم</span>
        ) : (
          <span className={status.tone === "review" ? "font-semibold text-ink" : "text-ink"}>{status.text}</span>
        )}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <div className="flex flex-col">
          <span className="text-xl font-bold text-terracotta-text">✕ {summary.hardErrorCount}</span>
          <span className="text-[11.5px] text-muted">إلزامية غير مستوفاة</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-bold text-muted">◐ {summary.reviewCount}</span>
          <span className="text-[11.5px] text-muted">بحاجة إلى مراجعة</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-bold text-mint-text">✓ {summary.passedCount}</span>
          <span className="text-[11.5px] text-muted">مستوفاة</span>
        </div>
      </div>

      <div aria-hidden="true" className="mt-3 flex gap-0.5">
        {ordered.map((result) => (
          <span key={result.id} className={TICK_CLASS[result.status]} />
        ))}
      </div>
    </section>
  );
}