import type { JournalPreferences } from "@/lib/preferences/types";

export const DEFAULT_JOURNAL_PREFERENCES: JournalPreferences = {
  maxApcUsd: 1500,
  openAccess: "preferred",
  maxReviewDays: 60,
  requiredIndexes: ["scopus", "wos"],
};