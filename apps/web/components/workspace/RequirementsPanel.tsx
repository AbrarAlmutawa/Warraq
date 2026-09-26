"use client";

import Link from "next/link";
import { useState, type KeyboardEvent } from "react";
import { ReadinessPanelSummary } from "@/components/workspace/ReadinessSummary";
import { RequirementCard } from "@/components/workspace/RequirementCard";
import { SuggestionCard } from "@/components/workspace/SuggestionCard";
import type { ErrorPresentation } from "@/lib/api-errors";
import { requirementLabel } from "@/lib/workspace/requirement-labels";
import { requirementAction } from "@/lib/workspace/suggestion-labels";
import type {
  PanelTab,
  ReadinessSummary,
  SelectedItem,
  SuggestionStatus,
  SuggestionsResult,
  WorkspaceRequirement,
  WorkspaceSuggestion,
} from "@/lib/workspace/types";

/* The suggestions tab's data for the active journal (lazy: requested when the tab is first opened). */
export type SuggestionsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; result: SuggestionsResult }
  | { status: "failed"; error: ErrorPresentation };

export type DecisionState = { saving: boolean; error: string | null };

type RequirementsPanelProps = {
  tab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  summary: ReadinessSummary;
  requirements: WorkspaceRequirement[];
  selected: SelectedItem | null;
  canGoToText: (requirement: WorkspaceRequirement) => boolean;
  onGoToRequirement: (requirement: WorkspaceRequirement) => void;
  onShowSource: (requirement: WorkspaceRequirement) => void;
  onRequirementAction: (requirement: WorkspaceRequirement) => void;
  suggestions: SuggestionsState;
  decisions: Record<string, DecisionState>;
  onRetrySuggestions: () => void;
  canGoToSuggestion: (suggestion: WorkspaceSuggestion) => boolean;
  onGoToSuggestion: (suggestion: WorkspaceSuggestion) => void;
  onDecideSuggestion: (suggestion: WorkspaceSuggestion, status: SuggestionStatus) => void;
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
  requirements,
  selected,
  canGoToText,
  onGoToRequirement,
  onShowSource,
  onRequirementAction,
  suggestions,
  decisions,
  onRetrySuggestions,
  canGoToSuggestion,
  onGoToSuggestion,
  onDecideSuggestion,
}: RequirementsPanelProps) {
  const [showPassed, setShowPassed] = useState(false);

  const failed = requirements.filter((requirement) => requirement.status === "failed");
  const review = requirements.filter((requirement) => requirement.status === "review");
  const passed = requirements.filter((requirement) => requirement.status === "passed");

  const listed =
    suggestions.status === "ready" && (suggestions.result.status === "ok" || suggestions.result.status === "stored")
      ? suggestions.result.suggestions
      : null;
  const pendingCount = listed ? listed.filter((suggestion) => suggestion.status === "pending").length : null;
  const anyAccepted = listed ? listed.some((suggestion) => suggestion.status === "accepted") : false;

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

  const card = (requirement: WorkspaceRequirement) => {
    const action = requirementAction(requirement.suggestedFix);
    return (
      <RequirementCard
        key={requirement.ruleId}
        requirement={requirement}
        selected={isSelected("requirement", requirement.ruleId)}
        canGoToText={canGoToText(requirement)}
        actionLabel={action?.label ?? null}
        onGoToText={() => onGoToRequirement(requirement)}
        onShowSource={() => onShowSource(requirement)}
        onAction={() => onRequirementAction(requirement)}
      />
    );
  };

  return (
    <aside
      aria-label="لوحة الفحص"
      className="flex min-h-0 w-full shrink-0 flex-col border-t border-rule bg-paper lg:w-[420px] lg:border-s lg:border-t-0"
    >
      <ReadinessPanelSummary summary={summary} results={requirements} />

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
          {pendingCount !== null && (
            <span className="rounded-full bg-olive/20 px-2 text-[11px] font-semibold text-olive-text">{pendingCount}</span>
          )}
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
            منها على بحثك: قبولك يسجّل قرارك فقط.
          </p>

          {(suggestions.status === "idle" || suggestions.status === "loading") && (
            <p role="status" className="text-[13px] text-muted">
              نطلب اقتراحات وَرَّاق لهذه المجلة…
            </p>
          )}

          {suggestions.status === "failed" && (
            <div role="alert" className="flex flex-col gap-1 border border-terracotta/45 bg-terracotta-tint px-4 py-3">
              <p className="text-[13.5px] font-semibold text-terracotta-text">✕ {suggestions.error.title}</p>
              <p className="text-[13px] leading-relaxed text-body">{suggestions.error.message}</p>
              {suggestions.error.detail && (
                <p dir="ltr" className="font-latin text-[12px] break-words text-muted">
                  {suggestions.error.detail}
                </p>
              )}
              {suggestions.error.retryable && (
                <button
                  type="button"
                  onClick={onRetrySuggestions}
                  className="mt-1 self-start text-[13px] underline underline-offset-4 hover:text-terracotta-text"
                >
                  إعادة المحاولة
                </button>
              )}
            </div>
          )}

          {suggestions.status === "ready" && suggestions.result.status === "unavailable" && (
            <div className="flex flex-col gap-1 border border-dashed border-subtle bg-paper-raised px-4 py-3">
              <p className="text-[13.5px] font-semibold">اقتراحات الذكاء الاصطناعي غير مفعّلة على هذا الخادم.</p>
              <p className="text-[13px] leading-relaxed text-body">قائمة المتطلبات والجاهزية تعمل كالمعتاد.</p>
              {suggestions.result.message && (
                <p dir="ltr" className="font-latin text-[12px] break-words text-muted">
                  {suggestions.result.message}
                </p>
              )}
            </div>
          )}

          {suggestions.status === "ready" && suggestions.result.status === "error" && (
            <div role="alert" className="flex flex-col gap-1 border border-terracotta/45 bg-terracotta-tint px-4 py-3">
              <p className="text-[13.5px] font-semibold text-terracotta-text">✕ تعذّر الحصول على الاقتراحات هذه المرة.</p>
              <p className="text-[13px] leading-relaxed text-body">قائمة المتطلبات والجاهزية تعمل كالمعتاد.</p>
              {suggestions.result.message && (
                <p dir="ltr" className="font-latin text-[12px] break-words text-muted">
                  {suggestions.result.message}
                </p>
              )}
              <button
                type="button"
                onClick={onRetrySuggestions}
                className="mt-1 self-start text-[13px] underline underline-offset-4 hover:text-terracotta-text"
              >
                إعادة المحاولة
              </button>
            </div>
          )}

          {listed && anyAccepted && (
            <div className="flex flex-col gap-1 border border-mint/40 bg-mint/10 px-4 py-3 text-[13px]">
              <p className="leading-relaxed">
                قبلتَ اقتراحًا أو أكثر. لم يُعدَّل بحثك: طبّق التعديلات في ملف Word ثم ارفع النسخة المعدّلة لإعادة الفحص.
              </p>
              <Link href="/" className="self-start font-semibold underline underline-offset-4 hover:text-terracotta-text">
                رفع نسخة معدّلة
              </Link>
            </div>
          )}

          {listed && listed.length === 0 && (
            <p className="text-[13px] text-muted">لم يقدّم وَرَّاق اقتراحات لهذا البحث وهذه المجلة.</p>
          )}

          {listed?.map((suggestion) => {
            const decision = decisions[suggestion.id];
            return (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                selected={isSelected("suggestion", suggestion.id)}
                canGoToText={canGoToSuggestion(suggestion)}
                saving={decision?.saving ?? false}
                error={decision?.error ?? null}
                onGoToText={() => onGoToSuggestion(suggestion)}
                onDecide={(status) => onDecideSuggestion(suggestion, status)}
              />
            );
          })}
        </div>
      </div>
    </aside>
  );
}