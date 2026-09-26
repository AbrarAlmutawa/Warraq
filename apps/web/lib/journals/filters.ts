import { normalizeIndex } from "@/lib/journals/format";
import type { JournalMatch } from "@/lib/journals/types";
import type { JournalIndex, JournalPreferences } from "@/lib/preferences/types";

/*
 * Client-side filter chips on the journals screen. They only narrow the matcher's list
 * (never re-rank it) and follow the backend rule: a journal that does not publish a value
 * is never excluded because of it.
 */

export type JournalFilterState = {
  withinBudget: boolean;
  freeOnly: boolean;
  openAccessAvailable: boolean;
  fastReview: boolean;
  indexes: JournalIndex[];
};

export const EMPTY_JOURNAL_FILTERS: JournalFilterState = {
  withinBudget: false,
  freeOnly: false,
  openAccessAvailable: false,
  fastReview: false,
  indexes: [],
};

const DEFAULT_REVIEW_THRESHOLD_DAYS = 60;

export function reviewThresholdDays(preferences: JournalPreferences): number {
  return preferences.maxReviewDays ?? DEFAULT_REVIEW_THRESHOLD_DAYS;
}

/* Unknown APC is not excluded (missing data never excludes). */
export function isWithinBudget(match: JournalMatch, preferences: JournalPreferences): boolean {
  return preferences.maxApcUsd === null || match.apcUsd === null || match.apcUsd <= preferences.maxApcUsd;
}

/* Only a known subscription-only journal lacks open access; "unknown" is not excluded. */
export function isOpenAccessAvailable(match: JournalMatch): boolean {
  return match.openAccess !== "subscription";
}

/* The matcher keeps journals whose average review time is at most the preferred days. */
export function isFastEnough(match: JournalMatch, preferences: JournalPreferences): boolean {
  return (
    preferences.maxReviewDays === null ||
    match.reviewDaysAvg === null ||
    match.reviewDaysAvg <= preferences.maxReviewDays
  );
}

/* A journal that publishes no indexing information is not excluded. */
export function hasIndex(match: JournalMatch, index: JournalIndex): boolean {
  if (match.indexes.length === 0) return true;
  return match.indexes.some((value) => normalizeIndex(value) === index);
}

export function activeFilterCount(filters: JournalFilterState): number {
  return (
    Number(filters.withinBudget) +
    Number(filters.freeOnly) +
    Number(filters.openAccessAvailable) +
    Number(filters.fastReview) +
    filters.indexes.length
  );
}

/* Narrows the matcher's list; never re-ranks it. */
export function applyJournalFilters(
  matches: JournalMatch[],
  filters: JournalFilterState,
  preferences: JournalPreferences,
): JournalMatch[] {
  const threshold = reviewThresholdDays(preferences);
  return matches.filter(
    (match) =>
      (!filters.withinBudget || isWithinBudget(match, preferences)) &&
      (!filters.freeOnly || match.apcUsd === null || match.apcUsd === 0) &&
      (!filters.openAccessAvailable || isOpenAccessAvailable(match)) &&
      (!filters.fastReview || match.reviewDaysAvg === null || match.reviewDaysAvg <= threshold) &&
      filters.indexes.every((index) => hasIndex(match, index)),
  );
}