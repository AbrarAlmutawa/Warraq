"use client";

import { useState } from "react";
import { ReadinessPanelSummary } from "@/components/workspace/ReadinessSummary";
import { RequirementCard } from "@/components/workspace/RequirementCard";
import { requirementLabel } from "@/lib/workspace/requirement-labels";
import type { ReadinessSummary, SelectedItem, WorkspaceRequirement } from "@/lib/workspace/types";

type RequirementsPanelProps = {
  summary: ReadinessSummary;
  requirements: WorkspaceRequirement[];
  selected: SelectedItem | null;
  canGoToText: (requirement: WorkspaceRequirement) => boolean;
  onGoToRequirement: (requirement: WorkspaceRequirement) => void;
  onShowSource: (requirement: WorkspaceRequirement) => void;
};

export function RequirementsPanel({
  summary,
  requirements,
  selected,
  canGoToText,
  onGoToRequirement,
  onShowSource,
}: RequirementsPanelProps) {
  const [showPassed, setShowPassed] = useState(false);

  const failed = requirements.filter((requirement) => requirement.status === "failed");
  const review = requirements.filter((requirement) => requirement.status === "review");
  const passed = requirements.filter((requirement) => requirement.status === "passed");

  const isSelected = (ruleId: string) => selected?.type === "requirement" && selected.id === ruleId;

  const card = (requirement: WorkspaceRequirement) => (
    <RequirementCard
      key={requirement.ruleId}
      requirement={requirement}
      selected={isSelected(requirement.ruleId)}
      canGoToText={canGoToText(requirement)}
      onGoToText={() => onGoToRequirement(requirement)}
      onShowSource={() => onShowSource(requirement)}
    />
  );

  return (
    <aside
      aria-label="لوحة الفحص"
      className="flex min-h-0 w-full shrink-0 flex-col border-t border-rule bg-paper lg:w-[420px] lg:border-s lg:border-t-0"
    >
      <ReadinessPanelSummary summary={summary} results={requirements} />

      <div className="flex shrink-0 gap-1 border-b border-rule px-4">
        <h2 className="flex h-11 items-center gap-2 border-b-2 border-ink px-3 text-[13.5px] font-bold text-ink">
          متطلبات المجلة
          <span className="rounded-full bg-rule px-2 text-[11px] font-semibold">{failed.length + review.length}</span>
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-8">
        <div className="flex flex-col gap-3">
          {failed.length > 0 ? (
            <>
              <h3 className="flex items-center gap-2 text-xs font-bold text-terracotta-text">
                تحتاج معالجة · {failed.length}
                <span aria-hidden="true" className="h-px flex-1 bg-terracotta/30" />
              </h3>
              {failed.map(card)}
            </>
          ) : (
            <p className="rounded-[4px] border border-mint/40 bg-mint/10 px-4 py-3 text-[13px] font-semibold text-mint-text">
              ✓ كل المتطلبات الإلزامية مستوفاة
            </p>
          )}

          {review.length > 0 && (
            <>
              <h3 className="mt-2 flex items-center gap-2 text-xs font-bold text-muted">
                بحاجة إلى مراجعة · {review.length}
                <span aria-hidden="true" className="h-px flex-1 border-t border-dashed border-subtle" />
              </h3>
              {review.map(card)}
            </>
          )}

          <button
            type="button"
            onClick={() => setShowPassed((open) => !open)}
            aria-expanded={showPassed}
            aria-controls="passed-requirements"
            className="mt-2 flex w-full items-center gap-2 py-1.5 text-xs font-bold text-mint-text"
          >
            مستوفاة · {passed.length}
            <span aria-hidden="true" className="h-px flex-1 bg-mint/30" />
            <span className="font-medium text-muted">{showPassed ? "إخفاء" : "عرض"}</span>
          </button>
          {showPassed && (
            <ul id="passed-requirements" className="m-0 list-none p-0">
              {passed.map((requirement) => {
                const label = requirementLabel(requirement);
                return (
                  <li key={requirement.ruleId} className="flex items-center gap-2 border-b border-rule py-2 text-[13px]">
                    <span aria-hidden="true" className="font-bold text-mint-text">
                      ✓
                    </span>
                    <span className="flex-1">
                      {label.latin ? (
                        <span dir="ltr" className="font-latin">
                          {label.text}
                        </span>
                      ) : (
                        label.text
                      )}
                      <span className="text-muted">
                        {" — "}
                        <span dir="ltr" className="font-latin">
                          {requirement.requirement}
                        </span>
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onShowSource(requirement)}
                      className="px-1 py-1 text-xs underline underline-offset-4 hover:text-terracotta-text"
                    >
                      المصدر
                      <span className="sr-only"> — {label.text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}