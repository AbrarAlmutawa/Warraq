"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { RequirementsPanel } from "@/components/workspace/RequirementsPanel";
import { SectionNavigator } from "@/components/workspace/SectionNavigator";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { WorkspaceSourceDialog } from "@/components/workspace/WorkspaceSourceDialog";
import type { JournalSummary } from "@/lib/journals/types";
import { buildRequirementDecorations, requirementRanges } from "@/lib/workspace/decorations";
import type {
  BlockDocument,
  BlockSection,
  EditorRange,
  ReadinessSummary,
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

export type WorkspaceStats = {
  wordCount: number;
  referenceCount: number;
  figureCount: number;
  tableCount: number;
  /** As measured by the backend's citation_style rule; null when this journal has no such rule */
  citationStyle: string | null;
};

type WorkspaceShellProps = {
  manuscriptDocument: BlockDocument;
  requirements: WorkspaceRequirement[];
  summary: ReadinessSummary;
  journal: JournalSummary;
  stats: WorkspaceStats;
};

/*
 * The real, read-only preparation workspace for one journal.
 * Everything shown comes from the backend: the parsed blocks (editor text), POST /validate
 * (checklist, highlights) and its summary (readiness). Nothing is evaluated or edited here.
 */
export function WorkspaceShell({ manuscriptDocument, requirements, summary, journal, stats }: WorkspaceShellProps) {
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [revealRange, setRevealRange] = useState<EditorRange | null>(null);
  const [revealNonce, setRevealNonce] = useState(0);
  const [sourceRuleId, setSourceRuleId] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    document.getElementById(`req-card-${selected.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  const decorations = useMemo(
    () => buildRequirementDecorations(manuscriptDocument, requirements, selected),
    [manuscriptDocument, requirements, selected],
  );

  const sourceRequirement = requirements.find((requirement) => requirement.ruleId === sourceRuleId) ?? null;

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

  return (
    <>
      <WorkspaceHeader
        journal={journal}
        summary={summary}
        readyHref={`/ready?journal=${encodeURIComponent(journal.journalId)}`}
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

      <WorkspaceSourceDialog
        requirement={sourceRequirement}
        journal={journal}
        onClose={() => setSourceRuleId(null)}
      />
    </>
  );
}