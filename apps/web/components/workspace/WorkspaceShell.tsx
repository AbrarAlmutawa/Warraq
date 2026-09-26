"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  CitationConversionDialog,
  type ConversionEntry,
} from "@/components/workspace/CitationConversionDialog";
import {
  RequirementsPanel,
  type DecisionState,
  type SuggestionsState,
} from "@/components/workspace/RequirementsPanel";
import { SectionNavigator } from "@/components/workspace/SectionNavigator";
import {
  SwitchJournalDialog,
  type OutlookEntry,
  type ReportEntry,
} from "@/components/workspace/SwitchJournalDialog";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { WorkspaceSourceDialog } from "@/components/workspace/WorkspaceSourceDialog";
import { WorkspaceToast } from "@/components/workspace/WorkspaceToast";
import {
  toCitationProposal,
  toSuggestionsResult,
  toWorkspaceReadiness,
  toWorkspaceRequirement,
  toWorkspaceSuggestion,
} from "@/lib/api-adapters";
import {
  compareReadiness,
  convertCitations,
  decideSuggestion,
  getSuggestions,
  validateManuscript,
} from "@/lib/api-client";
import { describeError, type ErrorPresentation } from "@/lib/api-errors";
import type { JournalSummary } from "@/lib/journals/types";
import { readSession } from "@/lib/session";
import { buildRequirementDecorations, requirementRanges } from "@/lib/workspace/decorations";
import { compareReports, type JournalReport } from "@/lib/workspace/switch-impact";
import type {
  BlockDocument,
  BlockSection,
  EditorRange,
  PanelTab,
  SelectedItem,
  SuggestionStatus,
  WorkspaceRequirement,
  WorkspaceSuggestion,
} from "@/lib/workspace/types";

const ManuscriptEditor = dynamic(
  () => import("@/components/workspace/ManuscriptEditor").then((module) => module.ManuscriptEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-paper-raised text-sm text-muted">
        يُحمَّل محرر المخطوطة…
      </div>
    ),
  },
);

const TOAST_MS = 8000;
/* POST /validate/compare accepts at most 10 journal ids per request. */
const COMPARE_BATCH_SIZE = 10;

const MISSING_RESULT: ErrorPresentation = {
  title: "تعذّر حساب الجاهزية",
  message: "لم يُرجع الخادم نتيجة لهذه المجلة.",
  detail: null,
  retryable: true,
};

const IDLE_SUGGESTIONS: SuggestionsState = { status: "idle" };

export type WorkspaceStats = {
  wordCount: number;
  referenceCount: number;
  figureCount: number;
  tableCount: number;
  /** As measured by the backend's citation_style rule; null when this journal has no such rule */
  citationStyle: string | null;
};

export type WorkspaceBaseStats = Omit<WorkspaceStats, "citationStyle">;

type ToastState = { text: string; detail: string; previousJournalId: string };

type WorkspaceShellProps = {
  manuscriptId: string;
  manuscriptDocument: BlockDocument;
  journals: JournalSummary[];
  initialJournalId: string;
  initialReport: JournalReport;
  baseStats: WorkspaceBaseStats;
};

function has<T>(record: Record<string, T>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function displayName(journal: JournalSummary | undefined): string {
  return journal?.shortName ?? journal?.name ?? "";
}

/*
 * The real, read-only preparation workspace.
 * Everything shown comes from the backend: the parsed blocks (editor text, parsed once), and
 * POST /validate per journal (checklist, highlights, readiness summary). Switching journals only
 * re-validates the same manuscript_id; confirm and undo reuse results already fetched.
 * Suggestions and citation conversions are proposals: they never feed the checklist, the
 * editor, the decorations or readiness.
 */
export function WorkspaceShell({
  manuscriptId,
  manuscriptDocument,
  journals,
  initialJournalId,
  initialReport,
  baseStats,
}: WorkspaceShellProps) {
  const [activeJournalId, setActiveJournalId] = useState(initialJournalId);
  /* Full /validate results per journal id, for the life of this page. */
  const [reports, setReports] = useState<Record<string, JournalReport>>(() => ({ [initialJournalId]: initialReport }));
  /* /validate/compare summaries per journal id (only for journals without a full report). */
  const [outlooks, setOutlooks] = useState<Record<string, OutlookEntry>>({});
  /* In-flight or failed /validate requests per journal id (successes move into `reports`). */
  const [reportRequests, setReportRequests] = useState<Record<string, ReportEntry>>({});
  const [candidateIds, setCandidateIds] = useState<string[]>([]);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switchSession, setSwitchSession] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [tab, setTab] = useState<PanelTab>("requirements");
  /* POST /suggestions per journal id (lazy; unavailable answers are kept, errors are retried). */
  const [suggestionsByJournal, setSuggestionsByJournal] = useState<Record<string, SuggestionsState>>({});
  /* PATCH /suggestions/{id} progress per suggestion id. */
  const [decisions, setDecisions] = useState<Record<string, DecisionState>>({});
  /* POST /citations/convert per journal id (ok/partial kept; unavailable/error asked again on reopen). */
  const [conversions, setConversions] = useState<Record<string, ConversionEntry>>({});
  const [conversionOpen, setConversionOpen] = useState(false);

  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [revealRange, setRevealRange] = useState<EditorRange | null>(null);
  const [revealNonce, setRevealNonce] = useState(0);
  const [sourceRuleId, setSourceRuleId] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    const prefix = selected.type === "requirement" ? "req" : "sug";
    document.getElementById(`${prefix}-card-${selected.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected, tab]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const journalsById = useMemo(() => new Map(journals.map((journal) => [journal.journalId, journal])), [journals]);

  // The active journal always has a report: the initial one, or one fetched before confirming a switch.
  const activeReport = reports[activeJournalId];
  const journal = journalsById.get(activeJournalId) as JournalSummary;
  const requirements = activeReport.requirements;
  const summary = activeReport.summary;

  // Decorations depend only on the backend checklist and the selection — never on suggestions.
  const decorations = useMemo(
    () => buildRequirementDecorations(manuscriptDocument, requirements, selected),
    [manuscriptDocument, requirements, selected],
  );

  const stats: WorkspaceStats = {
    ...baseStats,
    citationStyle: requirements.find((requirement) => requirement.ruleId === "citation_style")?.measured ?? null,
  };

  const sourceRequirement = requirements.find((requirement) => requirement.ruleId === sourceRuleId) ?? null;
  const activeSuggestions = has(suggestionsByJournal, activeJournalId)
    ? suggestionsByJournal[activeJournalId]
    : IDLE_SUGGESTIONS;
  const activeConversion = has(conversions, activeJournalId) ? conversions[activeJournalId] : undefined;

  // ── Editor navigation
  const reveal = (range: EditorRange) => {
    setRevealRange(range);
    setRevealNonce((nonce) => nonce + 1);
  };

  const canGoToText = (requirement: WorkspaceRequirement) =>
    requirementRanges(manuscriptDocument, requirement).length > 0;

  const goToRequirement = (requirement: WorkspaceRequirement) => {
    setSelected({ type: "requirement", id: requirement.ruleId });
    const [first] = requirementRanges(manuscriptDocument, requirement);
    if (first) reveal(first);
  };

  const goToSection = (section: BlockSection) =>
    reveal({ startLineNumber: section.line, startColumn: 1, endLineNumber: section.line, endColumn: 1 });

  const canGoToSuggestion = (suggestion: WorkspaceSuggestion) =>
    suggestion.blockId !== null && manuscriptDocument.blockRanges.has(suggestion.blockId);

  const goToSuggestion = (suggestion: WorkspaceSuggestion) => {
    setSelected({ type: "suggestion", id: suggestion.id });
    const range = suggestion.blockId ? manuscriptDocument.blockRanges.get(suggestion.blockId) : undefined;
    if (range) reveal(range);
  };

  // ── Suggestions (proposals; decisions are recorded on the backend only)
  const loadSuggestions = (journalId: string, focusRuleId?: string) => {
    const current = has(suggestionsByJournal, journalId) ? suggestionsByJournal[journalId] : undefined;
    const answered = current?.status === "ready" && current.result.status !== "error";
    if (current?.status === "loading" || answered) return;

    setSuggestionsByJournal((state) => ({ ...state, [journalId]: { status: "loading" } }));
    getSuggestions(manuscriptId, journalId).then(
      (response) => {
        const result = toSuggestionsResult(response);
        setSuggestionsByJournal((state) => ({ ...state, [journalId]: { status: "ready", result } }));
        if (focusRuleId) {
          const match = result.suggestions.find((suggestion) => suggestion.ruleId === focusRuleId);
          if (match) setSelected({ type: "suggestion", id: match.id });
        }
      },
      (error: unknown) => {
        setSuggestionsByJournal((state) => ({ ...state, [journalId]: { status: "failed", error: describeError(error) } }));
      },
    );
  };

  const changeTab = (next: PanelTab) => {
    setTab(next);
    if (next === "suggestions") loadSuggestions(activeJournalId);
  };

  const recordDecision = (suggestion: WorkspaceSuggestion, status: SuggestionStatus) => {
    if (has(decisions, suggestion.id) && decisions[suggestion.id].saving) return;
    setDecisions((state) => ({ ...state, [suggestion.id]: { saving: true, error: null } }));

    decideSuggestion(suggestion.id, status).then(
      (updated) => {
        const next = toWorkspaceSuggestion(updated);
        // Only the suggestion itself changes: the status the backend returned.
        setSuggestionsByJournal((state) => {
          const copy: Record<string, SuggestionsState> = {};
          for (const [journalId, entry] of Object.entries(state)) {
            copy[journalId] =
              entry.status === "ready"
                ? {
                    status: "ready",
                    result: {
                      ...entry.result,
                      suggestions: entry.result.suggestions.map((item) => (item.id === next.id ? next : item)),
                    },
                  }
                : entry;
          }
          return copy;
        });
        setDecisions((state) => ({ ...state, [suggestion.id]: { saving: false, error: null } }));
      },
      (error: unknown) => {
        setDecisions((state) => ({ ...state, [suggestion.id]: { saving: false, error: describeError(error).title } }));
      },
    );
  };

  // ── Citation conversion (read-only proposal)
  const loadConversion = (journalId: string) => {
    const current = has(conversions, journalId) ? conversions[journalId] : undefined;
    if (current?.status === "loading" || (current?.status === "ready" && current.cacheable)) return;

    setConversions((state) => ({ ...state, [journalId]: { status: "loading" } }));
    convertCitations(manuscriptId, journalId).then(
      (response) => {
        const proposal = toCitationProposal(response);
        const cacheable = proposal.status === "ok" || proposal.status === "partial";
        setConversions((state) => ({ ...state, [journalId]: { status: "ready", proposal, cacheable } }));
      },
      (error: unknown) => {
        setConversions((state) => ({ ...state, [journalId]: { status: "error", error: describeError(error) } }));
      },
    );
  };

  const runRequirementAction = (requirement: WorkspaceRequirement) => {
    const fix = requirement.suggestedFix;
    if (!fix) return;
    setSelected({ type: "requirement", id: requirement.ruleId });

    if (fix.kind === "convert_citations") {
      setConversionOpen(true);
      loadConversion(activeJournalId);
      return;
    }

    setTab("suggestions");
    const current = has(suggestionsByJournal, activeJournalId) ? suggestionsByJournal[activeJournalId] : undefined;
    if (current?.status === "ready") {
      const match = current.result.suggestions.find((suggestion) => suggestion.ruleId === requirement.ruleId);
      if (match) setSelected({ type: "suggestion", id: match.id });
    }
    loadSuggestions(activeJournalId, requirement.ruleId);
  };

  // ── Switch journal: backend requests (only for journals without a result yet)
  const requestOutlooks = (ids: string[]) => {
    const missing = ids.filter(
      (id) => !has(reports, id) && (!has(outlooks, id) || outlooks[id].status === "error"),
    );
    if (missing.length === 0) return;

    setOutlooks((current) => {
      const next = { ...current };
      for (const id of missing) next[id] = { status: "loading" };
      return next;
    });

    for (let start = 0; start < missing.length; start += COMPARE_BATCH_SIZE) {
      const batch = missing.slice(start, start + COMPARE_BATCH_SIZE);
      compareReadiness(manuscriptId, batch).then(
        (items) => {
          const byId = new Map(items.map((item) => [item.journal_id, toWorkspaceReadiness(item.summary)]));
          setOutlooks((current) => {
            const next = { ...current };
            for (const id of batch) {
              const result = byId.get(id);
              next[id] = result ? { status: "ready", summary: result } : { status: "error", error: MISSING_RESULT };
            }
            return next;
          });
        },
        (error: unknown) => {
          const presentation = describeError(error);
          setOutlooks((current) => {
            const next = { ...current };
            for (const id of batch) next[id] = { status: "error", error: presentation };
            return next;
          });
        },
      );
    }
  };

  const requestReport = (journalId: string) => {
    if (has(reports, journalId)) return;
    if (has(reportRequests, journalId) && reportRequests[journalId].status === "loading") return;

    setReportRequests((current) => ({ ...current, [journalId]: { status: "loading" } }));
    validateManuscript(manuscriptId, journalId).then(
      (report) => {
        const entry: JournalReport = {
          requirements: (report.results ?? []).map(toWorkspaceRequirement),
          summary: toWorkspaceReadiness(report.summary),
        };
        setReports((current) => ({ ...current, [journalId]: entry }));
        setReportRequests((current) => {
          const next = { ...current };
          delete next[journalId];
          return next;
        });
      },
      (error: unknown) => {
        setReportRequests((current) => ({ ...current, [journalId]: { status: "error", error: describeError(error) } }));
      },
    );
  };

  // ── Switch journal: dialog, confirm, undo (confirm and undo make no validation requests)
  const openSwitch = () => {
    // Candidates: the ranked ids of the last successful /match, minus the current journal,
    // limited to journals the backend still lists.
    const lastIds = readSession()?.lastMatch?.journalIds ?? [];
    const ids = [...new Set(lastIds)].filter((id) => id !== activeJournalId && journalsById.has(id));
    setCandidateIds(ids);
    setSwitchSession((session) => session + 1);
    setSwitchOpen(true);
    requestOutlooks(ids);
  };

  const replaceJournalInUrl = (journalId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("journal", journalId);
    window.history.replaceState(null, "", url.toString());
  };

  const activateJournal = (journalId: string) => {
    setActiveJournalId(journalId);
    setSelected(null);
    setSourceRuleId(null);
    replaceJournalInUrl(journalId);
    // The suggestions tab shows the new journal's own suggestions (cached after the first load).
    if (tab === "suggestions") loadSuggestions(journalId);
  };

  const confirmSwitch = (targetId: string) => {
    if (!has(reports, targetId)) return;
    const impact = compareReports(activeReport, reports[targetId]);

    setToast({
      previousJournalId: activeJournalId,
      text: `تم تغيير المجلة إلى ${displayName(journalsById.get(targetId))} وإعادة فحص المتطلبات.`,
      detail: `أصبح مستوفى: ${impact.becomesPassed.length} · يحتاج معالجة: ${impact.target.hardErrorCount}`,
    });
    setSwitchOpen(false);
    activateJournal(targetId);
  };

  const undoSwitch = () => {
    if (!toast) return;
    activateJournal(toast.previousJournalId);
    setToast(null);
  };

  // ── Dialog data for the current candidates
  const candidates = candidateIds
    .map((id) => journalsById.get(id))
    .filter((candidate): candidate is JournalSummary => Boolean(candidate));

  const candidateOutlooks: Record<string, OutlookEntry> = {};
  const candidateReports: Record<string, ReportEntry | undefined> = {};
  for (const id of candidateIds) {
    if (has(reports, id)) {
      candidateOutlooks[id] = { status: "ready", summary: reports[id].summary };
      candidateReports[id] = { status: "ready", report: reports[id] };
    } else {
      candidateOutlooks[id] = has(outlooks, id) ? outlooks[id] : { status: "loading" };
      candidateReports[id] = has(reportRequests, id) ? reportRequests[id] : undefined;
    }
  }

  return (
    <>
      <WorkspaceHeader
        journal={journal}
        summary={summary}
        readyHref={`/ready?journal=${encodeURIComponent(journal.journalId)}`}
        onSwitchJournal={openSwitch}
      />

      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        <SectionNavigator
          sections={manuscriptDocument.sections}
          decorations={decorations}
          lineCount={manuscriptDocument.lineCount}
          stats={stats}
          onNavigate={goToSection}
        />

        <main className="flex h-[70dvh] min-w-0 flex-1 flex-col lg:h-auto">
          <div className="flex h-10 shrink-0 items-center gap-5 overflow-x-auto border-b border-rule px-4 text-xs whitespace-nowrap text-muted">
            <span className="font-semibold text-ink">المخطوطة</span>
            <span>
              <span className="font-bold text-terracotta-text">✕</span> متطلب المجلة{" "}
              <span className="bg-terracotta/15 underline decoration-terracotta decoration-2 underline-offset-4">خط متصل</span>
            </span>
            <span>
              <span className="font-bold">◐</span> بحاجة إلى مراجعة{" "}
              <span className="underline decoration-subtle decoration-dashed underline-offset-4">خط متقطع</span>
            </span>
            <span>
              <span className="font-bold text-mint-text">✓</span> مستوفى - بلا تظليل
            </span>
          </div>
          <div className="min-h-0 flex-1 bg-paper-raised">
            <ManuscriptEditor
              value={manuscriptDocument.text}
              decorations={decorations}
              revealRange={revealRange}
              revealNonce={revealNonce}
              onSelectTarget={setSelected}
            />
          </div>
        </main>

        <RequirementsPanel
          tab={tab}
          onTabChange={changeTab}
          summary={summary}
          requirements={requirements}
          selected={selected}
          canGoToText={canGoToText}
          onGoToRequirement={goToRequirement}
          onShowSource={(requirement) => setSourceRuleId(requirement.ruleId)}
          onRequirementAction={runRequirementAction}
          suggestions={activeSuggestions}
          decisions={decisions}
          onRetrySuggestions={() => loadSuggestions(activeJournalId)}
          canGoToSuggestion={canGoToSuggestion}
          onGoToSuggestion={goToSuggestion}
          onDecideSuggestion={recordDecision}
        />
      </div>

      <p aria-live="polite" className="sr-only">
        {toast?.text ?? ""}
      </p>

      {toast && (
        <WorkspaceToast
          text={toast.text}
          detail={toast.detail}
          onUndo={undoSwitch}
          onClose={() => setToast(null)}
        />
      )}

      <WorkspaceSourceDialog
        requirement={sourceRequirement}
        journal={journal}
        onClose={() => setSourceRuleId(null)}
      />

      <CitationConversionDialog
        open={conversionOpen}
        entry={activeConversion}
        onRetry={() => loadConversion(activeJournalId)}
        onClose={() => setConversionOpen(false)}
      />

      <SwitchJournalDialog
        key={switchSession}
        open={switchOpen}
        currentJournal={journal}
        currentReport={activeReport}
        candidates={candidates}
        outlooks={candidateOutlooks}
        reports={candidateReports}
        onRetryOutlooks={() => requestOutlooks(candidateIds)}
        onRequestReport={requestReport}
        onClose={() => setSwitchOpen(false)}
        onConfirm={confirmSwitch}
      />
    </>
  );
}