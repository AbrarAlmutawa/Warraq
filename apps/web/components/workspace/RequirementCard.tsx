import { requirementLabel, requirementMessage } from "@/lib/workspace/requirement-labels";
import type { WorkspaceRequirement } from "@/lib/workspace/types";

type RequirementCardProps = {
  requirement: WorkspaceRequirement;
  selected: boolean;
  canGoToText: boolean;
  /* Arabic label of the supported backend action for this rule; null = no button. */
  actionLabel: string | null;
  onGoToText: () => void;
  onShowSource: () => void;
  onAction: () => void;
};

export function RequirementCard({
  requirement,
  selected,
  canGoToText,
  actionLabel,
  onGoToText,
  onShowSource,
  onAction,
}: RequirementCardProps) {
  const isReview = requirement.status === "review";
  const label = requirementLabel(requirement);
  const message = requirementMessage(requirement);

  return (
    <article
      id={`req-card-${requirement.ruleId}`}
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
        <span className="text-xs text-muted">
          {label.latin ? (
            <span dir="ltr" className="font-latin">
              {label.text}
            </span>
          ) : (
            label.text
          )}
        </span>
        {selected && <span className="sr-only">(البند المحدد)</span>}
      </div>

      <p className="mt-2 text-[14.5px] leading-relaxed font-semibold">
        {message.latin ? (
          <span dir="ltr" className="block font-latin">
            {message.text}
          </span>
        ) : (
          message.text
        )}
      </p>

      {requirement.ruleId === "citation_style" && requirement.measured ? (
        <p className="mt-1 text-[13px]">
          <span dir="ltr" className="font-latin font-bold">
            {requirement.measured} → {requirement.requirement}
          </span>
        </p>
      ) : (
        <p className="mt-1 text-[12.5px] text-body">
          {requirement.measured && (
            <>
              في بحثك:{" "}
              <span dir="ltr" className={`font-latin ${isReview ? "font-semibold" : "font-bold text-terracotta-text"}`}>
                {requirement.measured}
              </span>
              {" · "}
            </>
          )}
          الشرط:{" "}
          <span dir="ltr" className="font-latin">
            {requirement.requirement}
          </span>
        </p>
      )}

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
        {actionLabel && (
          <button
            type="button"
            onClick={onAction}
            className="h-9 rounded-[3px] bg-ink px-3 text-[13px] font-semibold text-paper hover:bg-ink/90"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </article>
  );
}