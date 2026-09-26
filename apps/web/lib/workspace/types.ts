import type { ExtractionConfidence } from "@/lib/journals/types";

/*
 * Types for the real, backend-driven workspace and ready screens.
 * Every value comes from the FastAPI backend via lib/api-adapters.ts.
 */

/* ───────── Editor ───────── */

export type EditorRange = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};

/* ───────── Validation ───────── */

export type RequirementStatus = "failed" | "review" | "passed";

/* The backend ReadinessSummary on the frontend (hardErrorCount = failed_count). Never computed here. */
export type ReadinessSummary = {
  hardErrorCount: number;
  reviewCount: number;
  passedCount: number;
  total: number;
  meetsHardRequirements: boolean;
  isFullyReady: boolean;
};

/* ───────── UI state ───────── */

export type SuggestionStatus = "pending" | "accepted" | "rejected";

export type SelectedItem = {
  type: "requirement" | "suggestion";
  id: string;
};

export type PanelTab = "requirements" | "suggestions";

/* ───────── Real workspace (backend data) ───────── */

/* An action the backend offers for a failed rule (SuggestedFix). */
export type WorkspaceSuggestedFix = {
  kind: string;
  label: string;
  params: Record<string, string>;
};

/*
 * One requirement check from POST /validate (RequirementResult), via lib/api-adapters.ts.
 * requirement / measured / backendLabel / backendMessage are the backend's own (English) text,
 * shown unchanged where values matter; Arabic presentation comes from requirement-labels.ts.
 */
export type WorkspaceRequirement = {
  /** Stable backend id, e.g. "title_length", "statement:funding"; also the selection id */
  ruleId: string;
  field: string;
  backendLabel: string;
  /** What the journal requires, e.g. "<= 15 words" */
  requirement: string;
  /** What the manuscript has, e.g. "20 words"; null when not measured */
  measured: string | null;
  status: RequirementStatus;
  backendMessage: string;
  /** Parsed-block ids to highlight; empty when there is no place in the text (e.g. a missing statement) */
  blockIds: string[];
  suggestedFix: WorkspaceSuggestedFix | null;
  /** Trust in the extracted rule (not in the check) */
  confidence: ExtractionConfidence;
  sourceExcerpt: string | null;
  sourceUrl: string | null;
};

/* A navigation entry: the title block or a heading block, labelled with its real text. */
export type BlockSection = {
  blockId: string;
  kind: "title" | "heading";
  label: string;
  line: number;
};

/* The Monaco document built from parsed.blocks (lib/workspace/block-document.ts). */
export type BlockDocument = {
  text: string;
  lineCount: number;
  /** Parsed-block id → the editor range of its line */
  blockRanges: ReadonlyMap<string, EditorRange>;
  sections: BlockSection[];
};

/*
 * One AI suggestion from POST /suggestions (Suggestion), via lib/api-adapters.ts.
 * A PROPOSAL only: accepting records the researcher's decision on the backend and never
 * changes the manuscript, the checklist or readiness. Text fields are the backend's own.
 */
export type WorkspaceSuggestion = {
  /** Backend suggestion_id (scoped to manuscript + journal) */
  id: string;
  /** scope_fit | shorten_title | shorten_abstract | draft_highlights | draft_statement | null */
  kind: string | null;
  /** The checklist rule this helps with, e.g. "title_length"; null for scope fit */
  ruleId: string | null;
  field: string;
  backendLabel: string;
  title: string;
  rationale: string;
  /** Parsed block it refers to, if any (navigation only) */
  blockId: string | null;
  before: string | null;
  after: string | null;
  status: SuggestionStatus;
};

/* A POST /suggestions answer for one journal. */
export type SuggestionsResult = {
  status: "ok" | "stored" | "unavailable" | "error";
  /** Backend message (English), e.g. why AI is unavailable */
  message: string | null;
  suggestions: WorkspaceSuggestion[];
};

/* One reference in a POST /citations/convert proposal. */
export type ConvertedReferenceProposal = {
  /** 1-based position in the manuscript's reference list */
  index: number;
  original: string;
  converted: string;
  inText: string | null;
  missingFields: string[];
  blockId: string | null;
};

/*
 * A citation-conversion PROPOSAL (CitationConversion). Nothing is applied to the manuscript;
 * the backend does not store it and records no decision about it.
 */
export type CitationProposal = {
  /** ok | partial | unavailable | error */
  status: string;
  message: string | null;
  fromStyle: string;
  toStyle: string;
  references: ConvertedReferenceProposal[];
  /** True when the converted list was detected as the target style; null when not checked */
  verified: boolean | null;
  failedIndexes: number[];
};