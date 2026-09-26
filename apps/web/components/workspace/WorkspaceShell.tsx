"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { RequirementsPanel } from "@/components/workspace/RequirementsPanel";
import { SectionNavigator } from "@/components/workspace/SectionNavigator";
import {
  SwitchJournalDialog,
  type OutlookEntry,
  type ReportEntry,
} from "@/components/workspace/SwitchJournalDialog";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { WorkspaceSourceDialog } from "@/components/workspace/WorkspaceSourceDialog";
import { WorkspaceToast } from "@/components/workspace/WorkspaceToast";
import { toWorkspaceReadiness, toWorkspaceRequirement } from "@/lib/api-adapters";
import { compareReadiness, validateManuscript } from "@/lib/api-client";
import { describeError, type ErrorPresentation } from "@/lib/api-errors";
import type { JournalSummary } from "@/lib/journals/types";
import { readSession } from "@/lib/session";
import { buildRequirementDecorations, requirementRanges } from "@/lib/workspace/decorations";
import { compareReports, type JournalReport } from "@/lib/workspace/switch-impact";
import type {
  BlockDocument,
  BlockSection,
  EditorRange,
  SelectedItem,
  WorkspaceRequirement,
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

  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [revealRange, setRevealRange] = useState<EditorRange | null>(null);
  const [revealNonce, setRevealNonce] = useState(0);
  const [sourceRuleId, setSourceRuleId] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    document.getElementById(`req-card-${selected.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

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

  const decorations = useMemo(
    () => buildRequirementDecorations(manuscriptDocument, requirements, selected),
    [manuscriptDocument, requirements, selected],
  );

  const stats: WorkspaceStats = {
    ...baseStats,
    citationStyle: requirements.find((requirement) => requirement.ruleId === "citation_style")?.measured ?? null,
  };

  const sourceRequirement = requirements.find((requirement) => requirement.ruleId === sourceRuleId) ?? null;

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

  // ── Switch journal: dialog, confirm, undo (confirm and undo make no requests)
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

  const confirmSwitch = (targetId: string) => {
    if (!has(reports, targetId)) return;
    const impact = compareReports(activeReport, reports[targetId]);

    setToast({
      previousJournalId: activeJournalId,
      text: `تم تغيير المجلة إلى ${displayName(journalsById.get(targetId))} وإعادة فحص المتطلبات.`,
      detail: `أصبح مستوفى: ${impact.becomesPassed.length} · يحتاج معالجة: ${impact.target.hardErrorCount}`,
    });
    setActiveJournalId(targetId);
    setSwitchOpen(false);
    setSelected(null);
    setSourceRuleId(null);
    replaceJournalInUrl(targetId);
  };

  const undoSwitch = () => {
    if (!toast) return;
    setActiveJournalId(toast.previousJournalId);
    replaceJournalInUrl(toast.previousJournalId);
    setSelected(null);
    setSourceRuleId(null);
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
          summary={summary}
          requirements={requirements}
          selected={selected}
          canGoToText={canGoToText}
          onGoToRequirement={goToRequirement}
          onShowSource={(requirement) => setSourceRuleId(requirement.ruleId)}
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