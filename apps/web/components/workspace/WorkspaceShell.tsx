"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CitationConversionDialog,
  type ConversionEntry,
} from "@/components/workspace/CitationConversionDialog";
import { ManuscriptToolbar } from "@/components/workspace/ManuscriptToolbar";
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
  toManuscriptVersion,
  toSuggestionsResult,
  toWorkspaceBaseStats,
  toWorkspaceReadiness,
  toWorkspaceRequirement,
  toWorkspaceSuggestion,
} from "@/lib/api-adapters";
import {
  applySuggestion,
  compareReadiness,
  convertCitations,
  decideSuggestion,
  downloadManuscript,
  getSuggestions,
  replaceReferences,
  resetManuscript,
  saveManuscriptText,
  undoLastEdit,
  validateManuscript,
  type ApiManuscriptRecord,
  type DownloadFormat,
} from "@/lib/api-client";
import { describeError, type ErrorPresentation } from "@/lib/api-errors";
import type { JournalSummary } from "@/lib/journals/types";
import { readSession } from "@/lib/session";
import { buildBlockDocument } from "@/lib/workspace/block-document";
import { buildRequirementDecorations, requirementRanges } from "@/lib/workspace/decorations";
import { isApplicable, placeholdersIn } from "@/lib/workspace/editing";
import { compareReports, type JournalReport } from "@/lib/workspace/switch-impact";
import type {
  BlockSection,
  CitationProposal,
  EditorRange,
  PanelTab,
  SelectedItem,
  SuggestionStatus,
  WorkspaceBaseStats,
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

export type WorkspaceStats = WorkspaceBaseStats & {
  /** As measured by the backend's citation_style rule; null when this journal has no such rule */
  citationStyle: string | null;
};

/* "switch": undo returns to the previous journal. "edit": undo removes the latest revision. */
type ToastState =
  | { kind: "switch"; text: string; detail: string; previousJournalId: string }
  | { kind: "edit"; text: string; detail: string; undoable: boolean };

type EditState = { busy: string | null; error: string | null };

type WorkspaceShellProps = {
  manuscriptId: string;
  /* GET /manuscripts/{id}: the current version (latest revision) of the manuscript. */
  initialRecord: ApiManuscriptRecord;
  journals: JournalSummary[];
  initialJournalId: string;
  initialReport: JournalReport;
};

function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function has<T>(record: Record<string, T>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function displayName(journal: JournalSummary | undefined): string {
  return journal?.shortName ?? journal?.name ?? "";
}

/*
 * The real preparation workspace.
 * Everything shown comes from the backend: the current version's parsed blocks (editor text)
 * and POST /validate per journal (checklist, highlights, readiness summary). Switching journals
 * only re-validates the same manuscript_id.
 *
 * Editing (docs/editing.md): the researcher changes the manuscript only through explicit
 * actions (edit a paragraph, apply a suggestion, apply a citation conversion). Each one is
 * saved on the backend as a new revision of their Word file; the response replaces the editor
 * text, cached results for the old version are dropped, and the checklist is re-run. Because
 * the revision lives on the backend, edits survive leaving and reopening the workspace.
 */
export function WorkspaceShell({
  manuscriptId,
  initialRecord,
  journals,
  initialJournalId,
  initialReport,
}: WorkspaceShellProps) {
  /* The current version of the manuscript (replaced by every edit response). */
  const [record, setRecord] = useState(initialRecord);
  const manuscriptDocument = useMemo(() => buildBlockDocument(record.parsed), [record]);
  const baseStats = useMemo(() => toWorkspaceBaseStats(record.parsed), [record]);
  const version = useMemo(() => toManuscriptVersion(record), [record]);

  const [editState, setEditState] = useState<EditState>({ busy: null, error: null });
  const [applyingSuggestionId, setApplyingSuggestionId] = useState<string | null>(null);
  const [revalidating, setRevalidating] = useState(false);
  const [downloading, setDownloading] = useState<DownloadFormat | null>(null);
  /* Direct editing: text typed in the editor that is not saved yet (null = in sync). */
  const [draft, setDraft] = useState<string | null>(null);
  const [textStatus, setTextStatus] = useState<"idle" | "saving" | "saved">("idle");
  const draftRef = useRef<string | null>(null);
  const savingTextRef = useRef(false);

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
  const allDecorations = useMemo(
    () => buildRequirementDecorations(manuscriptDocument, requirements, selected),
    [manuscriptDocument, requirements, selected],
  );
  // While there is unsaved typing, line positions no longer match the checked version.
  const decorations = draft === null ? allDecorations : [];

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

  // ── Citation conversion (a proposal until the researcher applies it)
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

  // ── Editing: every change is a backend revision; afterwards the old version's results go stale
  const revalidate = (journalId: string) => {
    setRevalidating(true);
    validateManuscript(manuscriptId, journalId).then(
      (report) => {
        const entry: JournalReport = {
          requirements: (report.results ?? []).map(toWorkspaceRequirement),
          summary: toWorkspaceReadiness(report.summary),
        };
        setReports((current) => ({ ...current, [journalId]: entry }));
        setRevalidating(false);
      },
      (error: unknown) => {
        setRevalidating(false);
        setEditState({ busy: null, error: `حُفظ التعديل، لكن تعذّر إعادة الفحص: ${describeError(error).title}` });
      },
    );
  };

  const adoptVersion = (next: ApiManuscriptRecord) => {
    setRecord(next);
    setSelected(null);
    // Results for the previous version are no longer true. Keep the active report on screen
    // until the new one arrives (so the panel never goes empty), drop everything else.
    setReports((current) => ({ [activeJournalId]: current[activeJournalId] }));
    setOutlooks({});
    setReportRequests({});
    setConversions({});
    setSuggestionsByJournal((current) =>
      has(current, activeJournalId) ? { [activeJournalId]: current[activeJournalId] } : {},
    );
    revalidate(activeJournalId);
  };

  const runEdit = (
    busyLabel: string,
    call: () => Promise<ApiManuscriptRecord>,
    onDone: (next: ApiManuscriptRecord) => void,
    onFail?: (message: string) => void,
  ) => {
    // Typing that isn't saved yet must reach the backend first, or it would be lost.
    if (editState.busy || draftRef.current !== null || savingTextRef.current) return;
    setEditState({ busy: busyLabel, error: null });
    call().then(
      (next) => {
        setEditState({ busy: null, error: null });
        adoptVersion(next);
        onDone(next);
      },
      (error: unknown) => {
        const presentation = describeError(error);
        const message = presentation.detail ? `${presentation.title}: ${presentation.detail}` : presentation.title;
        setEditState({ busy: null, error: message });
        onFail?.(message);
      },
    );
  };

  const editToast = (text: string, detail = "", undoable = true) => setToast({ kind: "edit", text, detail, undoable });

  const canApplySuggestion = (suggestion: WorkspaceSuggestion) => version.editable && isApplicable(suggestion);

  const applyAiSuggestion = (suggestion: WorkspaceSuggestion) => {
    setApplyingSuggestionId(suggestion.id);
    runEdit(
      "نطبّق الاقتراح على مخطوطتك…",
      () => applySuggestion(manuscriptId, suggestion.id),
      (next) => {
        setApplyingSuggestionId(null);
        const applied: WorkspaceSuggestion = { ...suggestion, status: "accepted", appliedRevision: next.revision ?? null };
        setSuggestionsByJournal((state) => {
          const copy: Record<string, SuggestionsState> = {};
          for (const [journalId, entry] of Object.entries(state)) {
            copy[journalId] =
              entry.status === "ready"
                ? {
                    status: "ready",
                    result: {
                      ...entry.result,
                      suggestions: entry.result.suggestions.map((item) => (item.id === applied.id ? applied : item)),
                    },
                  }
                : entry;
          }
          return copy;
        });
        const placeholders = placeholdersIn(suggestion.after);
        editToast(
          "طُبّق الاقتراح على مخطوطتك وأُعيد فحص المتطلبات.",
          placeholders.length > 0 ? `أكمل الحقول بين الأقواس قبل الإرسال: ${placeholders.join(" ")}` : "",
        );
      },
      () => setApplyingSuggestionId(null),
    );
  };

  const applyConversion = (proposal: CitationProposal) => {
    // References the AI could not convert stay, unchanged, at the end of the list.
    const kept = proposal.failedIndexes
      .map((index) => record.parsed.references[index - 1])
      .filter((reference): reference is string => Boolean(reference));
    const references = [...proposal.references.map((reference) => reference.converted), ...kept];
    const style = proposal.toStyle.toUpperCase();
    runEdit(
      "نطبّق تحويل المراجع…",
      () => replaceReferences(manuscriptId, references, `References converted to ${style}`),
      () => {
        setConversionOpen(false);
        editToast(`حُوّلت المراجع إلى ${style} في مخطوطتك.`, kept.length > 0 ? `بقي ${kept.length} مرجع بصيغته الأصلية في آخر القائمة.` : "");
      },
    );
  };

  // ── Direct editing: type in the editor, saved automatically (PUT /manuscripts/{id}/text)
  const textEditable = version.editable && editState.busy === null;
  const textBusy = draft !== null || textStatus === "saving";

  const saveText = () => {
    const text = draftRef.current;
    if (text === null || savingTextRef.current) return;
    savingTextRef.current = true;
    setTextStatus("saving");
    const paragraphs = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    saveManuscriptText(manuscriptId, paragraphs, record.revision ?? 0).then(
      (next) => {
        savingTextRef.current = false;
        const typedMeanwhile = draftRef.current !== text;
        if (!typedMeanwhile) {
          draftRef.current = null;
          setDraft(null);
        }
        if ((next.revision ?? 0) !== (record.revision ?? 0)) adoptVersion(next);
        setTextStatus(typedMeanwhile ? "idle" : "saved");
      },
      (error: unknown) => {
        savingTextRef.current = false;
        setTextStatus("idle");
        const presentation = describeError(error);
        setEditState({
          busy: null,
          error: `لم تُحفظ تعديلاتك: ${presentation.detail ? `${presentation.title} — ${presentation.detail}` : presentation.title}`,
        });
      },
    );
  };

  const changeText = (text: string) => {
    const next = text === manuscriptDocument.text ? null : text;
    draftRef.current = next;
    setDraft(next);
    if (next !== null) setTextStatus("idle");
  };

  // Save shortly after the researcher stops typing (and again if they kept typing during a save).
  useEffect(() => {
    if (draft === null || textStatus === "saving") return;
    const timer = window.setTimeout(saveText, 1200);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, textStatus]);

  // "Saved" is shown briefly, then the status line returns to the hint.
  useEffect(() => {
    if (textStatus !== "saved") return;
    const timer = window.setTimeout(() => setTextStatus("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [textStatus]);

  // Warn before closing the tab with typing that hasn't reached the backend yet.
  useEffect(() => {
    if (!textBusy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [textBusy]);

  const undoEdit = () => {
    setToast(null);
    runEdit("نتراجع عن آخر تعديل…", () => undoLastEdit(manuscriptId), () => {});
  };

  const resetToOriginal = () => {
    if (!window.confirm("ستُلغى كل التعديلات وتعود المخطوطة إلى نسختها الأصلية. هل تريد المتابعة؟")) return;
    setToast(null);
    runEdit("نعيد المخطوطة إلى نسختها الأصلية…", () => resetManuscript(manuscriptId), () =>
      editToast("أُعيدت المخطوطة إلى نسختها الأصلية.", "", false),
    );
  };

  const download = (format: DownloadFormat) => {
    if (downloading) return;
    setDownloading(format);
    downloadManuscript(manuscriptId, format).then(
      ({ blob, filename }) => {
        setDownloading(null);
        saveFile(blob, filename);
      },
      (error: unknown) => {
        setDownloading(null);
        setEditState({ busy: null, error: `تعذّر تنزيل الملف: ${describeError(error).title}` });
      },
    );
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
      kind: "switch",
      previousJournalId: activeJournalId,
      text: `تم تغيير المجلة إلى ${displayName(journalsById.get(targetId))} وإعادة فحص المتطلبات.`,
      detail: `أصبح مستوفى: ${impact.becomesPassed.length} · يحتاج معالجة: ${impact.target.hardErrorCount}`,
    });
    setSwitchOpen(false);
    activateJournal(targetId);
  };

  const undoToast = () => {
    if (!toast) return;
    if (toast.kind === "edit") {
      undoEdit();
      return;
    }
    // After an edit the previous journal's report is dropped; switching back needs a new one.
    if (has(reports, toast.previousJournalId)) activateJournal(toast.previousJournalId);
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
          <ManuscriptToolbar
            version={version}
            busyLabel={editState.busy}
            revalidating={revalidating}
            error={editState.error}
            textState={draft !== null ? "dirty" : textStatus}
            downloading={downloading}
            onUndo={undoEdit}
            onReset={resetToOriginal}
            onDownload={download}
            onDismissError={() => setEditState((state) => ({ ...state, error: null }))}
          />
          <div className="min-h-0 flex-1 bg-paper-raised">
            <ManuscriptEditor
              value={manuscriptDocument.text}
              dirty={draft !== null || textStatus === "saving"}
              editable={textEditable}
              decorations={decorations}
              revealRange={revealRange}
              revealNonce={revealNonce}
              onSelectTarget={setSelected}
              onChangeText={changeText}
              onBlur={saveText}
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
          canApplySuggestion={canApplySuggestion}
          applyingSuggestionId={applyingSuggestionId}
          editBusy={editState.busy !== null || textBusy}
          onApplySuggestion={applyAiSuggestion}
        />
      </div>

      <p aria-live="polite" className="sr-only">
        {toast?.text ?? ""}
      </p>

      {toast && (
        <WorkspaceToast
          text={toast.text}
          detail={toast.detail}
          onUndo={toast.kind === "edit" && !toast.undoable ? undefined : undoToast}
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
        canApply={version.editable}
        applying={editState.busy !== null && conversionOpen}
        applyError={conversionOpen ? editState.error : null}
        onApply={applyConversion}
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