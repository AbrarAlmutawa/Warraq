"use client";

import { useState, type KeyboardEvent } from "react";
import { ReadinessPanelSummary } from "@/components/workspace/ReadinessSummary";
import { RequirementCard } from "@/components/workspace/RequirementCard";
import { SuggestionCard } from "@/components/workspace/SuggestionCard";
import type {
  AnchorKey,
  PanelTab,
  ReadinessSummary,
  RequirementResult,
  SelectedItem,
  SuggestionStatus,
  WarraqSuggestion,
} from "@/lib/workspace/types";

type RequirementsPanelProps = {
  tab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  summary: ReadinessSummary;
  results: RequirementResult[];
  suggestions: WarraqSuggestion[];
  suggestionStatus: Record<string, SuggestionStatus>;
  selected: SelectedItem | null;
  hasAnchor: (key: AnchorKey) => boolean;
  onGoToRequirement: (result: RequirementResult) => void;
  onShowSource: (result: RequirementResult) => void;
  onApplyFix: (result: RequirementResult) => void;
  onGoToSuggestion: (suggestion: WarraqSuggestion) => void;
  onAcceptSuggestion: (suggestion: WarraqSuggestion) => void;
  onRejectSuggestion: (suggestion: WarraqSuggestion) => void;
  onUndoSuggestion: (suggestion: WarraqSuggestion) => void;
};

function tabClass(active: boolean): string {
  return `flex h-11 items-center gap-2 border-b-2 px-3 text-[13.5px] ${
    active ? "border-ink font-bold text-ink" : "border-transparent font-medium text-muted hover:text-ink"
  }`;
}

export function RequirementsPanel({
  tab,
  onTabChange,
  summary,
  results,
  suggestions,
  suggestionStatus,
  selected,
  hasAnchor,
  onGoToRequirement,
  onShowSource,
  onApplyFix,
  onGoToSuggestion,
  onAcceptSuggestion,
  onRejectSuggestion,
  onUndoSuggestion,
}: RequirementsPanelProps) {
  const [showPassed, setShowPassed] = useState(false);

  const failed = results.filter((result) => result.status === "failed");
  const review = results.filter((result) => result.status === "review");
  const passed = results.filter((result) => result.status === "passed");
  const pendingSuggestions = suggestions.filter((suggestion) => suggestionStatus[suggestion.id] === "pending").length;

  const isSelected = (type: SelectedItem["type"], id: string) => selected?.type === type && selected.id === id;

  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next: PanelTab =
      event.key === "Home"
        ? "requirements"
        : event.key === "End"
          ? "suggestions"
          : tab === "requirements"
            ? "suggestions"
            : "requirements";
    onTabChange(next);
    document.getElementById(`workspace-tab-${next}`)?.focus();
  };

  return (
    <aside
      aria-label="لوحة الفحص"
      className="flex min-h-0 w-full shrink-0 flex-col border-t border-rule bg-paper lg:w-[420px] lg:border-s lg:border-t-0"
    >
      <ReadinessPanelSummary summary={summary} results={results} />

      <div role="tablist" aria-label="نوع الملاحظات" onKeyDown={onTabKeyDown} className="flex shrink-0 gap-1 border-b border-rule px-4">
        <button
          id="workspace-tab-requirements"
          type="button"
          role="tab"
          aria-selected={tab === "requirements"}
          aria-controls="workspace-panel-requirements"
          tabIndex={tab === "requirements" ? 0 : -1}
          onClick={() => onTabChange("requirements")}
          className={tabClass(tab === "requirements")}
        >
          متطلبات المجلة
          <span className="rounded-full bg-rule px-2 text-[11px] font-semibold">{failed.length + review.length}</span>
        </button>
        <button
          id="workspace-tab-suggestions"
          type="button"
          role="tab"
          aria-selected={tab === "suggestions"}
          aria-controls="workspace-panel-suggestions"
          tabIndex={tab === "suggestions" ? 0 : -1}
          onClick={() => onTabChange("suggestions")}
          className={tabClass(tab === "suggestions")}
        >
          اقتراحات وَرَّاق
          <span className="rounded-full bg-olive/20 px-2 text-[11px] font-semibold text-olive-text">{pendingSuggestions}</span>
        </button>
      </div>

      <div
        id="workspace-panel-requirements"
        role="tabpanel"
        aria-labelledby="workspace-tab-requirements"
        hidden={tab !== "requirements"}
        className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-8"
      >
        <div className="flex flex-col gap-3">
          {failed.length > 0 ? (
            <>
              <h3 className="flex items-center gap-2 text-xs font-bold text-terracotta-text">
                تحتاج معالجة · {failed.length}
                <span aria-hidden="true" className="h-px flex-1 bg-terracotta/30" />
              </h3>
              {failed.map((result) => (
                <RequirementCard
                  key={result.id}
                  result={result}
                  selected={isSelected("requirement", result.id)}
                  canGoToText={Boolean(result.anchor && hasAnchor(result.anchor))}
                  onGoToText={() => onGoToRequirement(result)}
                  onShowSource={() => onShowSource(result)}
                  onApplyFix={() => onApplyFix(result)}
                />
              ))}
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
              {review.map((result) => (
                <RequirementCard
                  key={result.id}
                  result={result}
                  selected={isSelected("requirement", result.id)}
                  canGoToText={Boolean(result.anchor && hasAnchor(result.anchor))}
                  onGoToText={() => onGoToRequirement(result)}
                  onShowSource={() => onShowSource(result)}
                  onApplyFix={() => onApplyFix(result)}
                />
              ))}
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
              {passed.map((result) => (
                <li key={result.id} className="flex items-center gap-2 border-b border-rule py-2 text-[13px]">
                  <span aria-hidden="true" className="font-bold text-mint-text">
                    ✓
                  </span>
                  <span className="flex-1">
                    {result.label}
                    <span className="text-muted"> — {result.requirement}</span>
                  </span>
                  {result.confirmedByUser && (
                    <span className="rounded-full border border-mint px-2 text-[11px] text-mint-text">أكّدته أنت</span>
                  )}
                  <button
                    type="button"
                    onClick={() => onShowSource(result)}
                    className="px-1 py-1 text-xs underline underline-offset-4 hover:text-terracotta-text"
                  >
                    المصدر
                    <span className="sr-only"> — {result.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div
        id="workspace-panel-suggestions"
        role="tabpanel"
        aria-labelledby="workspace-tab-suggestions"
        hidden={tab !== "suggestions"}
        className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-8"
      >
        <div className="flex flex-col gap-3">
          <p className="text-[12.5px] leading-relaxed text-body">
            اقتراحات اختيارية من وَرَّاق لتحسين البحث، وليست من متطلبات المجلة. لا تؤثر في جاهزية التقديم، ولا يُطبَّق أي
            منها دون موافقتك.
          </p>
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              status={suggestionStatus[suggestion.id] ?? "pending"}
              selected={isSelected("suggestion", suggestion.id)}
              canGoToText={hasAnchor(`suggestion:${suggestion.id}`)}
              onGoToText={() => onGoToSuggestion(suggestion)}
              onAccept={() => onAcceptSuggestion(suggestion)}
              onReject={() => onRejectSuggestion(suggestion)}
              onUndo={() => onUndoSuggestion(suggestion)}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}