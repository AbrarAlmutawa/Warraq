import {
  APC_OPTIONS,
  ARTICLE_TYPE_OPTIONS,
  INDEX_OPTIONS,
  OPEN_ACCESS_OPTIONS,
  REVIEW_SPEED_OPTIONS,
} from "@/lib/preferences/options";
import type { ArticleType, ChoiceOption, JournalPreferences } from "@/lib/preferences/types";

function summaryOf<T>(options: ChoiceOption<T>[], value: T): string {
  const option = options.find((item) => item.value === value);
  return option?.summary ?? option?.label ?? "";
}

/*
 * One-line summary of the researcher's priorities.
 * articleType is optional so callers that only know the preferences keep working;
 * when given (including null = "لا يهم"), it leads the summary.
 */
export function summarizePreferences(preferences: JournalPreferences, articleType?: ArticleType | null): string {
  const indexes = INDEX_OPTIONS.filter((option) =>
    preferences.requiredIndexes.includes(option.value),
  ).map((option) => option.label);

  const indexing = indexes.length > 0 ? `الفهرسة: ${indexes.join("، ")}` : "بلا شرط فهرسة";

  return [
    articleType === undefined ? null : summaryOf(ARTICLE_TYPE_OPTIONS, articleType),
    summaryOf(APC_OPTIONS, preferences.maxApcUsd),
    summaryOf(OPEN_ACCESS_OPTIONS, preferences.openAccess),
    summaryOf(REVIEW_SPEED_OPTIONS, preferences.maxReviewDays),
    indexing,
  ]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}