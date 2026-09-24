import {
  DEMO_COMPACT_TITLE,
  DEMO_DATA_AVAILABILITY_COMPLETE,
  DEMO_DATA_AVAILABILITY_DRAFT,
  DEMO_HIGHLIGHTS_COMPLETE,
  DEMO_HIGHLIGHTS_DRAFT,
  MOCK_WORKSPACE_MANUSCRIPT,
} from "@/lib/mock-data/workspace-manuscript";
import { evaluateManuscript, reviewKey } from "@/lib/workspace/evaluate";
import { getWorkspaceRules } from "@/lib/workspace/journals";
import { summarizeReadiness } from "@/lib/workspace/readiness";
import type {
  FixAction,
  ReadinessSummary,
  RequirementResult,
  WorkspaceManuscript,
} from "@/lib/workspace/types";

/* Pure version of the workspace's demo fix actions (same effects as the Phase 5 buttons). */
export function applyManuscriptFix(manuscript: WorkspaceManuscript, fix: FixAction): WorkspaceManuscript {
  switch (fix.kind) {
    case "shorten-title":
      return { ...manuscript, title: DEMO_COMPACT_TITLE };
    case "convert-citations":
      return fix.citationStyle ? { ...manuscript, citationStyle: fix.citationStyle } : manuscript;
    case "insert-highlights":
      return { ...manuscript, highlights: { isDraft: true, content: [...DEMO_HIGHLIGHTS_DRAFT] } };
    case "complete-highlights":
      return { ...manuscript, highlights: { isDraft: false, content: [...DEMO_HIGHLIGHTS_COMPLETE] } };
    case "insert-data-availability":
      return { ...manuscript, dataAvailability: { isDraft: true, content: DEMO_DATA_AVAILABILITY_DRAFT } };
    case "complete-data-availability":
      return { ...manuscript, dataAvailability: { isDraft: false, content: DEMO_DATA_AVAILABILITY_COMPLETE } };
    case "export-latex":
      return { ...manuscript, format: "latex" };
    case "confirm-review":
      return manuscript;
  }
}

export type ReadyDemoState = {
  manuscript: WorkspaceManuscript;
  results: RequirementResult[];
  summary: ReadinessSummary;
  confirmedReviewIds: string[];
};

const MAX_FIX_PASSES = 5;

/*
 * Until workspace progress is persisted (S4), /ready rebuilds the demo-ready state:
 * the parsed mock manuscript + the fixes the evaluation itself proposes,
 * with review items treated as confirmed by the researcher.
 * Readiness is still derived from evaluateManuscript — no separate validation.
 */
export function buildReadyDemoState(journalId: string): ReadyDemoState {
  const rules = getWorkspaceRules(journalId);
  const confirmedReviewIds = rules.reviewItems.map((item) => reviewKey(rules.journalId, item.id));
  let manuscript: WorkspaceManuscript = structuredClone(MOCK_WORKSPACE_MANUSCRIPT);

  for (let pass = 0; pass < MAX_FIX_PASSES; pass += 1) {
    const fixes = evaluateManuscript(manuscript, rules, confirmedReviewIds)
      .filter((result) => result.status === "failed" && result.fix && result.fix.kind !== "confirm-review")
      .map((result) => result.fix as FixAction);
    if (fixes.length === 0) break;
    manuscript = fixes.reduce(applyManuscriptFix, manuscript);
  }

  const results = evaluateManuscript(manuscript, rules, confirmedReviewIds);
  return { manuscript, results, summary: summarizeReadiness(results), confirmedReviewIds };
}