import type { JournalPreferences } from "@/lib/preferences/types";

/*
 * Starting preferences for a new manuscript: no restriction anywhere ("لا يهم").
 * Neutral on purpose, so the default state never excludes journals the researcher did not
 * choose to exclude. Article type starts as null (no filter) and lives beside these.
 */
export function neutralJournalPreferences(): JournalPreferences {
  return {
    maxApcUsd: null,
    openAccess: "any",
    maxReviewDays: null,
    requiredIndexes: [],
  };
}