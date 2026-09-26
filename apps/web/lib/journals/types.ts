export type ScopeFit = "strong" | "good" | "possible";

/* Frontend access model. "full" = backend "open_access"; "unknown" = not published. */
export type OpenAccessModel = "full" | "hybrid" | "subscription" | "unknown";

export type ExtractionConfidence = "high" | "medium" | "low";

/*
 * One ranked recommendation from POST /match (JournalMatchView, via lib/api-adapters.ts),
 * already ordered by the matcher. Facts the journal does not publish are null / empty:
 * the matcher never excludes a journal for missing data, and neither does the UI.
 *
 * Also used by the workspace and ready screens; the field names they read are kept stable.
 */
export type JournalMatch = {
  journalId: string;
  name: string;
  shortName: string | null;
  publisher: string;

  /** 1-based position in the matcher's ranking */
  rank: number;
  scopeFit: ScopeFit;
  /** The matcher's semantic similarity between the manuscript and the journal scope, 0–1 */
  similarityScore: number;
  /** Manuscript topics that also appear in the journal's stated scope (English, as published) */
  matchedTopics: string[];

  /** 0 = no publication fee; null = not published */
  apcUsd: number | null;
  openAccess: OpenAccessModel;
  /** null = not published */
  reviewDaysAvg: number | null;
  /** Index ids as the backend sends them (e.g. "scopus", "wos"); empty = not published */
  indexes: string[];

  /** Short preview of key hard requirements, exactly as the backend sends them (English) */
  requirementsSummary: string[];

  sourceUrl: string;
  /** True for fictional demo journals (backend is_demo) */
  sourceIsDemo: boolean;
  extractionConfidence: ExtractionConfidence;
  needsHumanReview: boolean;
  /** ISO date, e.g. "2026-09-18" */
  lastCheckedAt: string;
};

/*
 * Readiness of the uploaded manuscript for one journal, exactly as POST /validate/compare
 * reports it (ReadinessSummary). Displayed only — never recomputed on the frontend.
 */
export type JournalReadiness = {
  journalId: string;
  total: number;
  passedCount: number;
  failedCount: number;
  reviewCount: number;
  meetsHardRequirements: boolean;
  isFullyReady: boolean;
};