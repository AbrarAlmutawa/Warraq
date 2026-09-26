import type { ApiMatchPreferencesRequest, ApiParsedManuscript } from "@/lib/api-client";
import type { ArticleType, JournalPreferences, ManuscriptUnderstanding } from "@/lib/preferences/types";

/*
 * The single place where backend (snake_case) shapes and frontend (camelCase) shapes meet.
 * Components never convert field names themselves.
 *
 * Pure functions only: no fetching, no defaults invented for missing backend data,
 * no business logic duplicated from the backend.
 *
 * Adapters are added phase by phase, next to the frontend types they produce.
 */

/* ───────── Manuscript (ManuscriptParsedData → read-only understanding) ───────── */

/*
 * main_text_word_count (not full_document_word_count) is the figure the backend's
 * word_count rule measures, so the researcher sees the same number the checklist uses.
 */
export function toManuscriptUnderstanding(parsed: ApiParsedManuscript): ManuscriptUnderstanding {
  return {
    title: parsed.title.trim(),
    keywords: parsed.keywords.map((keyword) => keyword.trim()).filter(Boolean),
    mainTextWordCount: parsed.main_text_word_count,
    abstractWordCount: parsed.abstract_word_count,
    referenceCount: parsed.reference_count,
    figureCount: parsed.figure_count,
    tableCount: parsed.table_count,
  };
}

/* ───────── Preferences → POST /match (docs/contracts.md, "Frontend preferences → /match request") ───────── */

/*
 * Frontend article-type ids → the ids journals publish in accepted_article_types.
 * The matcher normalizes case, "-" and spaces, but "original-research" is not the same id as
 * "research_article", so the mapping must be explicit.
 */
const ARTICLE_TYPE_TO_API: Record<ArticleType, string> = {
  "original-research": "research_article",
  review: "review",
  "short-communication": "short_communication",
};

export function toApiArticleType(articleType: ArticleType | null): string | null {
  return articleType ? ARTICLE_TYPE_TO_API[articleType] : null;
}

/*
 * Researcher preferences → MatchPreferences request body.
 *
 * - Max APC: 0 = free only, null = any              → max_apc
 * - Open access "required"                          → open_access_only: true (hybrid also passes, per contract)
 * - Open access "preferred"                         → prefer_open_access: true (ranking bonus only)
 * - Open access "any"                               → both false
 * - Max review days (null = any)                    → max_review_days
 * - Required indexes (empty = no requirement)       → required_indexes
 * - Article type (null = no filter)                 → article_type
 *
 * top_k, language, apc_currency and the preferred_* lists are not sent:
 * the backend defaults apply (see ApiMatchPreferencesRequest).
 */
export function toApiMatchPreferences(
  preferences: JournalPreferences,
  articleType: ArticleType | null,
): ApiMatchPreferencesRequest {
  return {
    max_apc: preferences.maxApcUsd,
    open_access_only: preferences.openAccess === "required",
    prefer_open_access: preferences.openAccess === "preferred",
    max_review_days: preferences.maxReviewDays,
    required_indexes: [...preferences.requiredIndexes],
    article_type: toApiArticleType(articleType),
  };
}