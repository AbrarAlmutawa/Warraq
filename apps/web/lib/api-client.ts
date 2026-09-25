import type { components } from "@/lib/api-types";

/*
 * The only module that talks to the Warraq FastAPI backend.
 *
 * - Returns backend shapes exactly as defined in lib/api-types.ts (generated from /openapi.json).
 *   Conversion to frontend types happens in lib/api-adapters.ts, never in components.
 * - Never falls back to mock data: every failure becomes an ApiError for the UI to handle.
 * - Holds no secrets. NEXT_PUBLIC_API_BASE_URL is only the public backend base URL.
 */

type Schemas = components["schemas"];

export type ApiManuscriptUploadResponse = Schemas["ManuscriptUploadResponse"];
export type ApiManuscriptRecord = Schemas["ManuscriptRecord"];
export type ApiParsedManuscript = Schemas["ManuscriptParsedData"];
export type ApiBlock = Schemas["Block"];
export type ApiMatchPreferences = Schemas["MatchPreferences"];
export type ApiJournalMatch = Schemas["JournalMatchView"];
export type ApiJournalSummary = Schemas["JournalSummary"];
export type ApiJournalSpec = Schemas["JournalRequirementSpec"];
export type ApiValidationReport = Schemas["ValidationReport"];
export type ApiRequirementResult = Schemas["RequirementResult"];
export type ApiReadinessSummary = Schemas["ReadinessSummary"];
export type ApiJournalReadiness = Schemas["JournalReadiness"];
export type ApiSuggestionsResponse = Schemas["SuggestionsResponse"];
export type ApiSuggestion = Schemas["Suggestion"];
export type ApiCitationConversion = Schemas["CitationConversion"];

/*
 * Request body for `preferences` in POST /match.
 *
 * Every MatchPreferences field has a backend default (services/matcher/models.py), and the
 * OpenAPI schema lists none as required. openapi-typescript v7 marks fields that have a
 * non-null default (e.g. top_k = 5) as required, which is right for responses but not for
 * request bodies. So the request shape is the generated type with every field optional:
 * anything omitted takes the backend default. Never restate those defaults here.
 */
export type ApiMatchPreferencesRequest = Partial<ApiMatchPreferences>;

/* GET /health returns a plain dict, so it has no generated schema. */
export type ApiHealth = {
  status: string;
  llm_configured: boolean;
};

export type SuggestionDecision = "accepted" | "rejected" | "pending";

const DEFAULT_API_BASE_URL = "http://localhost:8000";

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, "");

const DEFAULT_TIMEOUT_MS = 30_000;
/* Parsing a DOCX can take a few seconds. */
const UPLOAD_TIMEOUT_MS = 120_000;
/* The first /match loads the embedding model (about 35 s on the dev machine). */
const MATCH_TIMEOUT_MS = 180_000;
/* AI calls: the backend LLM timeout is 60 s, plus validation and batching. */
const SUGGESTIONS_TIMEOUT_MS = 120_000;
const CITATIONS_TIMEOUT_MS = 180_000;

export type ApiErrorKind =
  /* The backend could not be reached (not running, wrong URL, CORS, offline). */
  | "network"
  /* The request took longer than its timeout. */
  | "timeout"
  /* The backend answered with a non-2xx status. See `status` and `detail`. */
  | "http"
  /* The backend answered 2xx but the body was not valid JSON. */
  | "invalid-response";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /* HTTP status, or 0 when no response was received. */
  readonly status: number;
  /* Backend `detail` text when available (English, from FastAPI). */
  readonly detail: string;

  constructor(kind: ApiErrorKind, status: number, detail: string) {
    super(`${kind}${status ? ` ${status}` : ""}: ${detail}`);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.detail = detail;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isNotFound(error: unknown): boolean {
  return isApiError(error) && error.kind === "http" && error.status === 404;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH";
  json?: unknown;
  formData?: FormData;
  timeoutMs?: number;
};

function parseJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/*
 * FastAPI errors: {"detail": "message"} for HTTPException,
 * {"detail": [{"msg": "...", ...}]} for 422 validation errors.
 */
function detailOf(data: unknown): string | null {
  if (!data || typeof data !== "object" || !("detail" in data)) return null;
  const detail = (data as { detail: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) =>
        item && typeof item === "object" && "msg" in item ? String((item as { msg: unknown }).msg) : null,
      )
      .filter((message): message is string => Boolean(message));
    return messages.length > 0 ? messages.join("; ") : null;
  }
  return null;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", json, formData, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        method,
        // FormData sets its own multipart Content-Type (with boundary), so only JSON gets a header.
        headers: json !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: json !== undefined ? JSON.stringify(json) : formData,
        signal: controller.signal,
        cache: "no-store",
      });
    } catch {
      throw controller.signal.aborted
        ? new ApiError("timeout", 0, `No response from ${API_BASE_URL} within ${timeoutMs / 1000}s.`)
        : new ApiError("network", 0, `Could not reach the Warraq API at ${API_BASE_URL}.`);
    }

    let text: string;
    try {
      text = await response.text();
    } catch {
      throw controller.signal.aborted
        ? new ApiError("timeout", response.status, `The response from ${API_BASE_URL} did not finish in time.`)
        : new ApiError("network", response.status, "The connection closed before the response finished.");
    }

    const data = parseJson(text);

    if (!response.ok) {
      throw new ApiError("http", response.status, detailOf(data) ?? `Request failed with HTTP ${response.status}.`);
    }
    if (data === undefined) {
      throw new ApiError("invalid-response", response.status, "The API returned an empty or non-JSON response.");
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

const id = (value: string) => encodeURIComponent(value);

/* ───────── Endpoints (paths and bodies exactly as in the backend routers) ───────── */

export function getHealth(): Promise<ApiHealth> {
  return request<ApiHealth>("/health");
}

/* POST /manuscripts/upload — DOCX only. Re-uploading the same file returns the same manuscript_id. */
export function uploadManuscript(file: File): Promise<ApiManuscriptUploadResponse> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  return request<ApiManuscriptUploadResponse>("/manuscripts/upload", {
    method: "POST",
    formData,
    timeoutMs: UPLOAD_TIMEOUT_MS,
  });
}

/* GET /manuscripts/{id} — the saved parse, used to recover after a refresh. Never re-parses. */
export function getManuscript(manuscriptId: string): Promise<ApiManuscriptRecord> {
  return request<ApiManuscriptRecord>(`/manuscripts/${id(manuscriptId)}`);
}

/* POST /match — an empty list is a valid result (no journal fits the preferences). */
export function matchJournals(
  manuscriptId: string,
  preferences: ApiMatchPreferencesRequest,
): Promise<ApiJournalMatch[]> {
  return request<ApiJournalMatch[]>("/match", {
    method: "POST",
    json: { manuscript_id: manuscriptId, preferences },
    timeoutMs: MATCH_TIMEOUT_MS,
  });
}

export function listJournals(): Promise<ApiJournalSummary[]> {
  return request<ApiJournalSummary[]>("/journals");
}

export function getJournal(journalId: string): Promise<ApiJournalSpec> {
  return request<ApiJournalSpec>(`/journals/${id(journalId)}`);
}

/* POST /validate — the only authority for checklist results and readiness.
 * Switch Journal = the same call with another journal_id (no upload, no re-parse). */
export function validateManuscript(manuscriptId: string, journalId: string): Promise<ApiValidationReport> {
  return request<ApiValidationReport>("/validate", {
    method: "POST",
    json: { manuscript_id: manuscriptId, journal_id: journalId },
  });
}

/* POST /validate/compare — readiness summaries only (1-10 journals). */
export function compareReadiness(manuscriptId: string, journalIds: string[]): Promise<ApiJournalReadiness[]> {
  return request<ApiJournalReadiness[]>("/validate/compare", {
    method: "POST",
    json: { manuscript_id: manuscriptId, journal_ids: journalIds },
  });
}

/* POST /suggestions — status ok | stored | unavailable | error. Never blocks the checklist. */
export function getSuggestions(
  manuscriptId: string,
  journalId: string,
  refresh = false,
): Promise<ApiSuggestionsResponse> {
  return request<ApiSuggestionsResponse>("/suggestions", {
    method: "POST",
    json: { manuscript_id: manuscriptId, journal_id: journalId, refresh },
    timeoutMs: SUGGESTIONS_TIMEOUT_MS,
  });
}

/* PATCH /suggestions/{id} — records the researcher's decision only; the manuscript is never edited. */
export function decideSuggestion(suggestionId: string, status: SuggestionDecision): Promise<ApiSuggestion> {
  return request<ApiSuggestion>(`/suggestions/${id(suggestionId)}`, {
    method: "PATCH",
    json: { status },
  });
}

/* POST /citations/convert — a proposal only; nothing is applied to the stored manuscript. */
export function convertCitations(manuscriptId: string, journalId: string): Promise<ApiCitationConversion> {
  return request<ApiCitationConversion>("/citations/convert", {
    method: "POST",
    json: { manuscript_id: manuscriptId, journal_id: journalId },
    timeoutMs: CITATIONS_TIMEOUT_MS,
  });
}