import {
  APC_OPTIONS,
  INDEX_OPTIONS,
  OPEN_ACCESS_OPTIONS,
  REVIEW_SPEED_OPTIONS,
} from "@/lib/preferences/options";
import type { ChoiceOption, JournalPreferences } from "@/lib/preferences/types";

function summaryOf<T>(options: ChoiceOption<T>[], value: T): string {
  const option = options.find((item) => item.value === value);
  return option?.summary ?? option?.label ?? "";
}

export function summarizePreferences(preferences: JournalPreferences): string {
  const indexes = INDEX_OPTIONS.filter((option) =>
    preferences.requiredIndexes.includes(option.value),
  ).map((option) => option.label);

  const indexing = indexes.length > 0 ? `الفهرسة: ${indexes.join("، ")}` : "بلا شرط فهرسة";

  return [
    summaryOf(APC_OPTIONS, preferences.maxApcUsd),
    summaryOf(OPEN_ACCESS_OPTIONS, preferences.openAccess),
    summaryOf(REVIEW_SPEED_OPTIONS, preferences.maxReviewDays),
    indexing,
  ].join(" · ");
}