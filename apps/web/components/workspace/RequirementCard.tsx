import { LocateIcon, SourceIcon } from "@/components/ui/icons";
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

/* Quiet, text-style secondary actions (go to text, show source). */
const QUIET_ACTION =
  "inline-flex h-8 items-center gap-1.5 rounded-[3px] px-1.5 text-[12.5px] text-muted hover:bg-ink/5 hover:text-ink";

/*
 * One open requirement. Editorial treatment: a side rule carries the status (solid terracotta =
 * journal requirement not met, dashed = needs review) instead of a tinted, bordered box.
 */
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
      className={`py-3 ps-4 pe-2 ${
        isReview ? "border-s-2 border-dashed border-subtle" : "border-s-[3px] border-terracotta"
      } ${selected ? "bg-paper-raised outline-2 outline-offset-2 outline-ink" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px]">
        {isReview ? (
          <span className="font-bold text-muted">◐ بحاجة إلى مراجعة</span>
        ) : (
          <span className="font-bold text-terracotta-text">✕ متطلب المجلة</span>
        )}
        <span aria-hidden="true" className="text-subtle">
          ·
        </span>
        <span className="text-muted">
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

      <p className="mt-1.5 text-[14px] leading-relaxed font-semibold text-ink">
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
        <p className="mt-1 text-[12.5px] leading-relaxed text-body">
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

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {canGoToText && (
          <button type="button" onClick={onGoToText} className={QUIET_ACTION}>
            <LocateIcon className="text-[14px]" />
            انتقل إلى النص
          </button>
        )}
        <button type="button" onClick={onShowSource} className={QUIET_ACTION}>
          <SourceIcon className="text-[14px]" />
          عرض المصدر
        </button>
        <span className="flex-1" />
        {actionLabel && (
          <button
            type="button"
            onClick={onAction}
            className="h-8 rounded-[3px] bg-ink px-3 text-[12.5px] font-semibold text-paper hover:bg-ink/90"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </article>
  );
}