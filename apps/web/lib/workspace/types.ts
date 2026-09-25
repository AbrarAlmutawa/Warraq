import type { ExtractionConfidence } from "@/lib/journals/types";

/* ───────── Manuscript (parsed once) ───────── */

export type CitationStyle = "APA" | "IEEE";

export type ManuscriptFormat = "docx" | "latex";

export type DraftableBlock<T> = {
  isDraft: boolean;
  content: T;
};

export type ManuscriptSectionId =
  | "introduction"
  | "related-work"
  | "methodology"
  | "results"
  | "discussion"
  | "conclusion";

export type AnchorKey =
  | "title"
  | "abstract"
  | "keywords"
  | "highlights"
  | "citations"
  | "figure-3"
  | "data-availability"
  | "references"
  | `suggestion:${string}`;

export type ManuscriptParagraph = {
  text: string;
  anchor?: AnchorKey;
};

export type ManuscriptSection = {
  id: ManuscriptSectionId;
  heading: string;
  paragraphs: ManuscriptParagraph[];
};

export type ReferenceEntry = {
  id: number;
  inText: string;
  apa: string;
  ieee: string;
};

export type WorkspaceManuscript = {
  title: string;
  abstract: string;
  /** Declared abstract length minus the words of the demo abstract text shown */
  abstractWordOffset: number;
  keywords: string[];
  highlights: DraftableBlock<string[]> | null;
  dataAvailability: DraftableBlock<string> | null;
  sections: ManuscriptSection[];
  references: ReferenceEntry[];
  referenceCount: number;
  wordCount: number;
  figureCount: number;
  tableCount: number;
  citationStyle: CitationStyle;
  format: ManuscriptFormat;
};

/* ───────── Editor document ───────── */

export type EditorRange = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};

export type NavSectionId =
  | "title"
  | "abstract"
  | "highlights"
  | ManuscriptSectionId
  | "data-availability"
  | "references";

export type DocumentSection = {
  id: NavSectionId;
  label: string;
  line: number;
  missing: boolean;
};

export type ManuscriptDocument = {
  text: string;
  lineCount: number;
  anchors: Partial<Record<AnchorKey, EditorRange[]>>;
  sections: DocumentSection[];
};

/* ───────── Journal rules (mock, keyed by journalId) ───────── */

export type DynamicRuleId =
  | "title-length"
  | "abstract-length"
  | "word-count"
  | "reference-count"
  | "citation-style"
  | "highlights"
  | "data-availability"
  | "template";

export type ReviewItemRule = {
  id: string;
  field: string;
  label: string;
  requirement: string;
  message: string;
  note: string;
  anchor?: AnchorKey;
  confidence: ExtractionConfidence;
  excerpt: string;
};

export type StaticRequirement = {
  id: string;
  label: string;
  requirement: string;
  excerpt: string;
};

export type JournalWorkspaceRules = {
  journalId: string;
  defaultConfidence: ExtractionConfidence;
  maxTitleWords: number;
  maxAbstractWords: number;
  maxWords?: number;
  references: { min?: number; max?: number };
  requiredCitationStyle: CitationStyle;
  highlights?: { min: number; max: number };
  requiresDataAvailability?: boolean;
  requiredFormat?: ManuscriptFormat;
  reviewItems: ReviewItemRule[];
  staticRequirements: StaticRequirement[];
  excerpts: Partial<Record<DynamicRuleId, string>>;
};

/* ───────── Validation ───────── */

export type RequirementStatus = "failed" | "review" | "passed";

export type FixKind =
  | "shorten-title"
  | "convert-citations"
  | "insert-highlights"
  | "complete-highlights"
  | "insert-data-availability"
  | "complete-data-availability"
  | "export-latex"
  | "confirm-review";

export type FixAction = {
  kind: FixKind;
  label: string;
  /** Demo-only action standing in for the researcher's own edit */
  simulated: boolean;
  citationStyle?: CitationStyle;
};

/**
 * Frontend view of one journal requirement check.
 * status "failed" ≈ backend ValidationIssue { severity: HARD_ERROR, field, message,
 * source_span (≈ anchor), suggested_fix (≈ fix), confidence }.
 */
export type RequirementResult = {
  id: string;
  field: string;
  label: string;
  requirement: string;
  measured?: string;
  status: RequirementStatus;
  message: string;
  note?: string;
  anchor?: AnchorKey;
  fix?: FixAction;
  confidence: ExtractionConfidence;
  excerpt: string;
  confirmedByUser: boolean;
  isReviewRule: boolean;
};

export type ReadinessSummary = {
  hardErrorCount: number;
  reviewCount: number;
  passedCount: number;
  total: number;
  meetsHardRequirements: boolean;
  isFullyReady: boolean;
};

/* ───────── Warraq suggestions (AI guidance, never journal policy) ───────── */

export type SuggestionTarget =
  | { kind: "abstract" }
  | { kind: "keywords" }
  | { kind: "section"; sectionId: ManuscriptSectionId; paragraphIndex: number };

/** ≈ backend ValidationIssue { severity: SOFT_SUGGESTION } */
export type WarraqSuggestion = {
  id: string;
  field: string;
  label: string;
  title: string;
  rationale: string;
  target: SuggestionTarget;
  before: string;
  after: string;
};

export type SuggestionStatus = "pending" | "accepted" | "rejected";

/* ───────── UI state ───────── */

export type SelectedItem = {
  type: "requirement" | "suggestion";
  id: string;
};

export type PanelTab = "requirements" | "suggestions";