import type { JournalIndex } from "@/lib/preferences/types";

export type ScopeFit = "strong" | "good" | "possible";

export type OpenAccessModel = "full" | "hybrid" | "subscription";

export type ExtractionConfidence = "high" | "medium" | "low";

/* One item of the matcher output: match(paper, prefs) -> JournalMatch[] (already ordered). */
export type JournalMatch = {
  journalId: string;
  name: string;
  shortName: string;
  publisher: string;

  scopeFit: ScopeFit;
  scopeReason: string;

  /** 0 = no publication fee */
  apcUsd: number;
  openAccess: OpenAccessModel;
  reviewDaysAvg: number;
  indexes: JournalIndex[];

  /** Short, human-readable preview of key hard requirements */
  requirementsSummary: string[];

  sourceUrl: string;
  sourceIsDemo: boolean;
  extractionConfidence: ExtractionConfidence;
  needsHumanReview: boolean;
  /** ISO date, e.g. "2026-09-18" */
  lastCheckedAt: string;
};