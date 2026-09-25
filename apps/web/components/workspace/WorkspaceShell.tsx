"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { RequirementsPanel } from "@/components/workspace/RequirementsPanel";
import { SectionNavigator } from "@/components/workspace/SectionNavigator";
import { SwitchJournalDialog } from "@/components/workspace/SwitchJournalDialog";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { WorkspaceSourceDialog } from "@/components/workspace/WorkspaceSourceDialog";
import { WorkspaceToast } from "@/components/workspace/WorkspaceToast";
import { WARRAQ_SUGGESTIONS } from "@/lib/mock-data/warraq-suggestions";
import {
  DEMO_COMPACT_TITLE,
  DEMO_DATA_AVAILABILITY_COMPLETE,
  DEMO_DATA_AVAILABILITY_DRAFT,
  DEMO_HIGHLIGHTS_COMPLETE,
  DEMO_HIGHLIGHTS_DRAFT,
  MOCK_WORKSPACE_MANUSCRIPT,
} from "@/lib/mock-data/workspace-manuscript";
import { buildDecorations } from "@/lib/workspace/decorations";
import { diffValidation } from "@/lib/workspace/diff";
import { buildManuscriptDocument } from "@/lib/workspace/document";
import { evaluateManuscript, reviewKey } from "@/lib/workspace/evaluate";
import { getSwitchCandidates, getWorkspaceJournal, getWorkspaceRules } from "@/lib/workspace/journals";
import { applySuggestionText } from "@/lib/workspace/manuscript";
import { summarizeReadiness } from "@/lib/workspace/readiness";
import type {
  AnchorKey,
  DocumentSection,
  EditorRange,
  PanelTab,
  RequirementResult,
  SelectedItem,
  SuggestionStatus,
  WarraqSuggestion,
  WorkspaceManuscript,
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

const RECHECK_MS = 750;
const TOAST_MS = 8000;

type RevealTarget = { anchor?: AnchorKey; line?: number };
type ToastState = { text: string; detail: string; previousJournalId: string };

function initialSuggestionStatus(): Record<string, SuggestionStatus> {
  return Object.fromEntries(WARRAQ_SUGGESTIONS.map((suggestion) => [suggestion.id, "pending" as SuggestionStatus]));
}

export function WorkspaceShell({ initialJournalId }: { initialJournalId: string }) {
  const [journalId, setJournalId] = useState(initialJournalId);
  const [manuscript, setManuscript] = useState<WorkspaceManuscript>(() => structuredClone(MOCK_WORKSPACE_MANUSCRIPT));
  const [confirmedReviewIds, setConfirmedReviewIds] = useState<string[]>([]);
  const [suggestionStatus, setSuggestionStatus] = useState<Record<string, SuggestionStatus>>(initialSuggestionStatus);
  const [tab, setTab] = useState<PanelTab>("requirements");
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [revealTarget, setRevealTarget] = useState<RevealTarget | null>(null);
  const [revealNonce, setRevealNonce] = useState(0);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switchSession, setSwitchSession] = useState(0);
  const [rechecking, setRechecking] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const scheduled = timers.current;
    return () => scheduled.forEach((timer) => window.clearTimeout(timer));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!selected) return;
    const prefix = selected.type === "requirement" ? "req" : "sug";
    document.getElementById(`${prefix}-card-${selected.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected, tab]);

  // ── Derived state: always recomputed from manuscript + selected journal rules
  const journal = getWorkspaceJournal(journalId);
  const rules = getWorkspaceRules(journalId);
  const results = useMemo(
    () => evaluateManuscript(manuscript, rules, confirmedReviewIds),
    [manuscript, rules, confirmedReviewIds],
  );
  const summary = summarizeReadiness(results);
  const manuscriptDocument = useMemo(
    () => buildManuscriptDocument(manuscript, rules, WARRAQ_SUGGESTIONS),
    [manuscript, rules],
  );
  const decorations = useMemo(
    () => buildDecorations(manuscriptDocument, results, WARRAQ_SUGGESTIONS, suggestionStatus, selected),
    [manuscriptDocument, results, suggestionStatus, selected],
  );

  const revealRange: EditorRange | null = !revealTarget
    ? null
    : revealTarget.line
      ? { startLineNumber: revealTarget.line, startColumn: 1, endLineNumber: revealTarget.line, endColumn: 1 }
      : revealTarget.anchor
        ? (manuscriptDocument.anchors[revealTarget.anchor]?.[0] ?? null)
        : null;

  const hasAnchor = (key: AnchorKey) => (manuscriptDocument.anchors[key]?.length ?? 0) > 0;
  const sourceResult = results.find((result) => result.id === sourceId) ?? null;
  const later = (callback: () => void, ms: number) => {
    timers.current.push(window.setTimeout(callback, ms));
  };

  const reveal = (target: RevealTarget) => {
    setRevealTarget(target);
    setRevealNonce((nonce) => nonce + 1);
  };

  const replaceJournalInUrl = (id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("journal", id);
    window.history.replaceState(null, "", url.toString());
  };

  // ── Selection & navigation
  const selectFromEditor = (target: SelectedItem) => {
    setSelected(target);
    setTab(target.type === "requirement" ? "requirements" : "suggestions");
  };

  const goToRequirement = (result: RequirementResult) => {
    setSelected({ type: "requirement", id: result.id });
    if (result.anchor) reveal({ anchor: result.anchor });
  };

  const goToSuggestion = (suggestion: WarraqSuggestion) => {
    setSelected({ type: "suggestion", id: suggestion.id });
    reveal({ anchor: `suggestion:${suggestion.id}` });
  };

  const goToSection = (section: DocumentSection) => reveal({ line: section.line });

  // ── Hard-requirement actions (local demo edits)
  const applyFix = (result: RequirementResult) => {
    const fix = result.fix;
    if (!fix) return;
    setSelected({ type: "requirement", id: result.id });

    switch (fix.kind) {
      case "shorten-title":
        setManuscript((current) => ({ ...current, title: DEMO_COMPACT_TITLE }));
        reveal({ anchor: "title" });
        break;
      case "convert-citations": {
        const style = fix.citationStyle;
        if (style) setManuscript((current) => ({ ...current, citationStyle: style }));
        reveal({ anchor: "citations" });
        break;
      }
      case "insert-highlights":
        setManuscript((current) => ({
          ...current,
          highlights: { isDraft: true, content: [...DEMO_HIGHLIGHTS_DRAFT] },
        }));
        reveal({ anchor: "highlights" });
        break;
      case "complete-highlights":
        setManuscript((current) => ({
          ...current,
          highlights: { isDraft: false, content: [...DEMO_HIGHLIGHTS_COMPLETE] },
        }));
        reveal({ anchor: "highlights" });
        break;
      case "insert-data-availability":
        setManuscript((current) => ({
          ...current,
          dataAvailability: { isDraft: true, content: DEMO_DATA_AVAILABILITY_DRAFT },
        }));
        reveal({ anchor: "data-availability" });
        break;
      case "complete-data-availability":
        setManuscript((current) => ({
          ...current,
          dataAvailability: { isDraft: false, content: DEMO_DATA_AVAILABILITY_COMPLETE },
        }));
        reveal({ anchor: "data-availability" });
        break;
      case "export-latex":
        setManuscript((current) => ({ ...current, format: "latex" }));
        break;
      case "confirm-review":
        setConfirmedReviewIds((ids) => [...ids, reviewKey(journalId, result.id)]);
        break;
    }
  };

  // ── Warraq suggestions
  const acceptSuggestion = (suggestion: WarraqSuggestion) => {
    setManuscript((current) => applySuggestionText(current, suggestion.target, suggestion.before, suggestion.after));
    setSuggestionStatus((current) => ({ ...current, [suggestion.id]: "accepted" }));
  };

  const rejectSuggestion = (suggestion: WarraqSuggestion) => {
    setSuggestionStatus((current) => ({ ...current, [suggestion.id]: "rejected" }));
  };

  const undoSuggestion = (suggestion: WarraqSuggestion) => {
    if (suggestionStatus[suggestion.id] === "accepted") {
      setManuscript((current) => applySuggestionText(current, suggestion.target, suggestion.after, suggestion.before));
    }
    setSuggestionStatus((current) => ({ ...current, [suggestion.id]: "pending" }));
  };

  // ── Switch journal (re-validation only)
  const evaluateFor = (id: string) => evaluateManuscript(manuscript, getWorkspaceRules(id), confirmedReviewIds);

  const openSwitch = () => {
    setSwitchSession((session) => session + 1);
    setSwitchOpen(true);
  };

  const confirmSwitch = (targetId: string) => {
    const fromId = journalId;
    const impact = diffValidation(results, evaluateFor(targetId));
    const shortName = getWorkspaceJournal(targetId).shortName;

    setSwitchOpen(false);
    setSourceId(null);
    setSelected(null);
    setToast(null);
    setRechecking(targetId);

    later(() => {
      setJournalId(targetId);
      setRechecking(null);
      setTab("requirements");
      replaceJournalInUrl(targetId);
      setToast({
        previousJournalId: fromId,
        text: `تم تغيير المجلة إلى ${shortName} وإعادة فحص المتطلبات.`,
        detail: `أصبح مستوفى: ${impact.becomesPassed.length} · يحتاج معالجة: ${impact.candidate.hardErrorCount}`,
      });
    }, RECHECK_MS);
  };

  const undoSwitch = () => {
    if (!toast) return;
    setJournalId(toast.previousJournalId);
    replaceJournalInUrl(toast.previousJournalId);
    setSelected(null);
    setToast(null);
  };

  return (
    <>
      <WorkspaceHeader
        journal={journal}
        summary={summary}
        readyHref={`/ready?journal=${journal.journalId}`}
        onSwitchJournal={openSwitch}
      />

      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        <SectionNavigator
          sections={manuscriptDocument.sections}
          decorations={decorations}
          lineCount={manuscriptDocument.lineCount}
          stats={{
            wordCount: manuscript.wordCount,
            referenceCount: manuscript.referenceCount,
            figureCount: manuscript.figureCount,
            tableCount: manuscript.tableCount,
            citationStyle: manuscript.citationStyle,
            format: manuscript.format,
          }}
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
              اقتراح وَرَّاق{" "}
              <span className="underline decoration-olive decoration-dotted decoration-2 underline-offset-4">خط منقّط</span>
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
              onSelectTarget={selectFromEditor}
            />
          </div>
        </main>

        <RequirementsPanel
          tab={tab}
          onTabChange={setTab}
          summary={summary}
          results={results}
          suggestions={WARRAQ_SUGGESTIONS}
          suggestionStatus={suggestionStatus}
          selected={selected}
          hasAnchor={hasAnchor}
          onGoToRequirement={goToRequirement}
          onShowSource={(result) => setSourceId(result.id)}
          onApplyFix={applyFix}
          onGoToSuggestion={goToSuggestion}
          onAcceptSuggestion={acceptSuggestion}
          onRejectSuggestion={rejectSuggestion}
          onUndoSuggestion={undoSuggestion}
        />

        {rechecking && (
          <div
            role="status"
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-paper/90 text-center"
          >
            <p className="text-lg font-bold">نعيد فحص البحث حسب متطلبات المجلة الجديدة...</p>
            <p className="text-sm text-body">
              <span dir="ltr" className="font-latin">
                {getWorkspaceJournal(rechecking).shortName}
              </span>{" "}
              · النص المحلَّل كما هو، دون إعادة قراءة البحث
            </p>
          </div>
        )}
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

      <WorkspaceSourceDialog result={sourceResult} journal={journal} onClose={() => setSourceId(null)} />

      <SwitchJournalDialog
        key={switchSession}
        open={switchOpen}
        currentJournal={journal}
        currentResults={results}
        candidates={getSwitchCandidates(journalId)}
        evaluateFor={evaluateFor}
        requiredStyleFor={(id) => getWorkspaceRules(id).requiredCitationStyle}
        onClose={() => setSwitchOpen(false)}
        onConfirm={confirmSwitch}
      />
    </>
  );
}