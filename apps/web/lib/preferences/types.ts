export type ArticleType = "original-research" | "review" | "short-communication";

/*
 * What Warraq read from the uploaded manuscript (ManuscriptParsedData via lib/api-adapters.ts).
 * Read-only: corrections are made in the Word file and re-uploaded. The backend exposes no
 * topic, article type or citation style, so none are represented here.
 */
export type ManuscriptUnderstanding = {
  title: string;
  keywords: string[];
  mainTextWordCount: number;
  abstractWordCount: number;
  referenceCount: number;
  figureCount: number;
  tableCount: number;
};

export type OpenAccessPreference = "required" | "preferred" | "any";

export type JournalIndex = "scopus" | "wos";

/* Researcher preferences — inputs for ranking, not journal hard requirements. */
export type JournalPreferences = {
  /** 0 = free only, null = no limit */
  maxApcUsd: number | null;
  openAccess: OpenAccessPreference;
  /** null = no limit */
  maxReviewDays: number | null;
  /** Indexes the researcher selected; empty = no indexing preference */
  requiredIndexes: JournalIndex[];
};

export type ChoiceOption<T> = {
  value: T;
  label: string;
  summary?: string;
  latin?: boolean;
};