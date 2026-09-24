import type { RequirementResult } from "@/lib/workspace/types";

type RequirementCardProps = {
  result: RequirementResult;
  selected: boolean;
  canGoToText: boolean;
  onGoToText: () => void;
  onShowSource: () => void;
  onApplyFix: () => void;
};

export function RequirementCard({
  result,
  selected,
  canGoToText,
  onGoToText,
  onShowSource,
  onApplyFix,
}: RequirementCardProps) {
  const isReview = result.status === "review";
  const fix = result.fix;

  const fixClass = !fix
    ? ""
    : fix.kind === "confirm-review"
      ? "h-9 rounded-[3px] border-[1.5px] border-ink px-3 text-[13px] font-semibold hover:bg-paper"
      : fix.simulated
        ? "h-9 rounded-[3px] border border-dashed border-muted px-3 text-[13px] text-body hover:border-ink"
        : "h-9 rounded-[3px] bg-ink px-3 text-[13px] font-semibold text-paper hover:bg-ink/90";

  return (
    <article
      id={`req-card-${result.id}`}
      className={`rounded-[4px] p-4 ${
        isReview
          ? "border-[1.5px] border-dashed border-subtle bg-paper-raised"
          : "border border-terracotta/45 bg-terracotta-tint"
      } ${selected ? "outline-2 outline-offset-2 outline-ink" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {isReview ? (
          <span className="rounded-[3px] bg-stone/30 px-2 py-0.5 text-[11px] font-bold text-muted">◐ بحاجة إلى مراجعة</span>
        ) : (
          <span className="rounded-[3px] bg-terracotta/15 px-2 py-0.5 text-[11px] font-bold text-terracotta-text">
            ✕ متطلب المجلة
          </span>
        )}
        <span className="text-xs text-muted">{result.label}</span>
        {selected && <span className="sr-only">(البند المحدد)</span>}
      </div>

      <p className="mt-2 text-[14.5px] leading-relaxed font-semibold">{result.message}</p>

      {result.field === "citations" && result.measured ? (
        <p className="mt-1 text-[13px]">
          <span dir="ltr" className="font-latin font-bold">
            {result.measured} → {result.requirement}
          </span>
        </p>
      ) : (
        <p className="mt-1 text-[12.5px] text-body">
          {result.measured && (
            <>
              في بحثك: <span className={isReview ? "font-semibold" : "font-bold text-terracotta-text"}>{result.measured}</span>
              {" · "}
            </>
          )}
          الشرط: {result.requirement}
        </p>
      )}

      {result.note && <p className="mt-2 text-[12.5px] leading-relaxed text-body">{result.note}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canGoToText && (
          <button
            type="button"
            onClick={onGoToText}
            className="h-9 rounded-[3px] border border-rule-strong px-3 text-[13px] hover:border-ink"
          >
            انتقل إلى النص
          </button>
        )}
        <button
          type="button"
          onClick={onShowSource}
          className="h-9 px-1 text-[13px] underline underline-offset-4 hover:text-terracotta-text"
        >
          عرض المصدر
        </button>
        <span className="flex-1" />
        {fix && (
          <button type="button" onClick={onApplyFix} className={fixClass}>
            {fix.label}
          </button>
        )}
      </div>
    </article>
  );
}