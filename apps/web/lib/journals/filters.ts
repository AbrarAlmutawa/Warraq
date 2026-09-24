import type { JournalMatch } from "@/lib/journals/types";
import type { JournalIndex, JournalPreferences } from "@/lib/preferences/types";

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

export function isWithinBudget(match: JournalMatch, preferences: JournalPreferences): boolean {
  return preferences.maxApcUsd === null || match.apcUsd <= preferences.maxApcUsd;
}

export function isOpenAccessAvailable(match: JournalMatch): boolean {
  return match.openAccess !== "subscription";
}

export function isFastEnough(match: JournalMatch, preferences: JournalPreferences): boolean {
  return preferences.maxReviewDays === null || match.reviewDaysAvg < preferences.maxReviewDays;
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
      (!filters.freeOnly || match.apcUsd === 0) &&
      (!filters.openAccessAvailable || isOpenAccessAvailable(match)) &&
      (!filters.fastReview || match.reviewDaysAvg < threshold) &&
      filters.indexes.every((index) => match.indexes.includes(index)),
  );
}