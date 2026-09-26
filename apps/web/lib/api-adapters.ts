import type {
  ApiJournalMatch,
  ApiJournalReadiness,
  ApiJournalSummary,
  ApiMatchPreferencesRequest,
  ApiParsedManuscript,
  ApiReadinessSummary,
  ApiRequirementResult,
} from "@/lib/api-client";
import type {
  JournalMatch,
  JournalReadiness,
  JournalSummary,
  OpenAccessModel,
} from "@/lib/journals/types";
import type { ArticleType, JournalPreferences, ManuscriptUnderstanding } from "@/lib/preferences/types";
import type { ReadinessSummary, WorkspaceRequirement } from "@/lib/workspace/types";

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

/* ───────── Journals (JournalSummary / JournalMatchView → frontend journal types) ───────── */

const ACCESS_MODEL_FROM_API: Record<ApiJournalSummary["access_model"], OpenAccessModel> = {
  open_access: "full",
  hybrid: "hybrid",
  subscription: "subscription",
  unknown: "unknown",
};

/* "2026-09-25T12:54:55.123456" → "2026-09-25" (the UI shows dates only). */
function toIsoDate(value: string): string {
  return value.slice(0, 10);
}

/*
 * A journal's published facts (GET /journals). Missing facts stay null / empty:
 * nothing is filled in on the frontend.
 */
export function toJournalSummary(view: ApiJournalSummary): JournalSummary {
  return {
    journalId: view.journal_id,
    name: view.name,
    shortName: view.short_name ?? null,
    publisher: view.publisher,
    apcUsd: view.apc_usd ?? null,
    openAccess: ACCESS_MODEL_FROM_API[view.access_model] ?? "unknown",
    reviewDaysAvg: view.review_days_avg ?? null,
    indexes: [...(view.indexes ?? [])],
    requirementsSummary: [...(view.requirements_summary ?? [])],
    sourceUrl: view.source_url,
    sourceIsDemo: view.is_demo === true,
    extractionConfidence: view.extraction_confidence_level,
    needsHumanReview: view.needs_human_review,
    lastCheckedAt: toIsoDate(view.last_checked_at),
  };
}

/*
 * A ranked recommendation (POST /match): the journal's facts plus the matcher's ranking.
 * `reasons` (English free text) is intentionally not used; the UI explains scope fit from the
 * structured similarity_score and matched_topics instead.
 */
export function toJournalMatch(view: ApiJournalMatch): JournalMatch {
  return {
    ...toJournalSummary(view),
    rank: view.rank,
    scopeFit: view.scope_fit,
    similarityScore: view.similarity_score,
    matchedTopics: [...(view.matched_topics ?? [])],
  };
}

/* ───────── Readiness (POST /validate/compare → JournalReadiness) ───────── */

/* The backend summary, field for field. Nothing is derived or recomputed here. */
export function toJournalReadiness(item: ApiJournalReadiness): JournalReadiness {
  return {
    journalId: item.journal_id,
    total: item.summary.total,
    passedCount: item.summary.passed_count,
    failedCount: item.summary.failed_count,
    reviewCount: item.summary.review_count,
    meetsHardRequirements: item.summary.meets_hard_requirements,
    isFullyReady: item.summary.is_fully_ready,
  };
}

/* ───────── Workspace (POST /validate → checklist + readiness) ───────── */

/*
 * One backend requirement check, unchanged in meaning: requirement / measured stay exactly as
 * the backend wrote them, block_ids are kept (de-duplicated) for highlighting, and suggested_fix
 * is carried for later phases. Arabic presentation lives in lib/workspace/requirement-labels.ts.
 */
export function toWorkspaceRequirement(result: ApiRequirementResult): WorkspaceRequirement {
  const fix = result.suggested_fix ?? null;
  return {
    ruleId: result.rule_id,
    field: result.field,
    backendLabel: result.label,
    requirement: result.requirement,
    measured: result.measured ?? null,
    status: result.status,
    backendMessage: result.message,
    blockIds: [...new Set(result.block_ids ?? [])],
    suggestedFix: fix ? { kind: fix.kind, label: fix.label, params: { ...(fix.params ?? {}) } } : null,
    confidence: result.confidence_level,
    sourceExcerpt: result.source_excerpt ?? null,
    sourceUrl: result.source_url ?? null,
  };
}

/*
 * The backend ReadinessSummary on the frontend readiness shape the workspace components read.
 * The only authority for readiness in the real workspace; nothing is recomputed.
 */
export function toWorkspaceReadiness(summary: ApiReadinessSummary): ReadinessSummary {
  return {
    hardErrorCount: summary.failed_count,
    reviewCount: summary.review_count,
    passedCount: summary.passed_count,
    total: summary.total,
    meetsHardRequirements: summary.meets_hard_requirements,
    isFullyReady: summary.is_fully_ready,
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