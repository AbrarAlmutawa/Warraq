export type ArticleType = "original-research" | "review" | "short-communication";

export type ManuscriptUnderstanding = {
  topic: string;
  articleType: ArticleType;
  keywords: string[];
  citationStyle: string;
  referenceCount: number;
  wordCount: number;
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