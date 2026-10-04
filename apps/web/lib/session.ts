import type { ArticleType, JournalIndex, JournalPreferences, OpenAccessPreference } from "@/lib/preferences/types";

/*
 * The researcher's journey state, kept in sessionStorage (per browser tab).
 *
 * Stores only what is needed to find the real data again after a refresh:
 * the backend manuscript_id, the file summary, preferences, and the journal ids of the
 * last successful /match. Parsed data, validation results and journal details are always
 * re-fetched from the backend, never cached here.
 *
 * readSession() returns null when there is no usable session. Screens must treat null as
 * "start again from upload", never as a reason to show mock data.
 *
 * Browser-only: call these from effects or event handlers, not during server rendering.
 */

const STORAGE_KEY = "warraq:session:v1";
const APPROVED_JOURNAL_LIST_KEY = "warraq:approved-journal-list:v1";

export type SessionFile = {
  name: string;
  sizeBytes: number;
};

export type LastMatch = {
  /* Ranked journal ids from the last successful POST /match for this manuscript. */
  journalIds: string[];
};

export type ApprovedJournalListSelection = {
  journalListId: string;
  name: string;
  journalCount: number;
  resolvedCount: number;
  unresolvedCount: number;
  duplicateCount: number;
  invalidCount: number;
  ambiguousCount: number;
};

export type WarraqSession = {
  version: 1;
  manuscriptId: string;
  file: SessionFile;
  /* True when the manuscript came from the labelled "try a demo paper" action. */
  isDemoManuscript: boolean;
  /* null until the researcher has confirmed preferences on /preferences. */
  preferences: JournalPreferences | null;
  articleType: ArticleType | null;
  lastMatch: LastMatch | null;
  approvedJournalList: ApprovedJournalListSelection | null;
};

export type SessionPatch = Partial<
  Pick<WarraqSession, "preferences" | "articleType" | "lastMatch" | "approvedJournalList">
>;

/* ───────── Storage access (never throws) ───────── */

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function write(session: WarraqSession): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

/* ───────── Shape checks: anything unexpected makes the session unusable ───────── */

const OPEN_ACCESS_VALUES: readonly OpenAccessPreference[] = ["required", "preferred", "any"];
const INDEX_VALUES: readonly JournalIndex[] = ["scopus", "wos"];
const ARTICLE_TYPE_VALUES: readonly ArticleType[] = ["original-research", "review", "short-communication"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isSessionFile(value: unknown): value is SessionFile {
  return isRecord(value) && typeof value.name === "string" && typeof value.sizeBytes === "number";
}

function isPreferences(value: unknown): value is JournalPreferences {
  return (
    isRecord(value) &&
    isNumberOrNull(value.maxApcUsd) &&
    typeof value.openAccess === "string" &&
    (OPEN_ACCESS_VALUES as readonly string[]).includes(value.openAccess) &&
    isNumberOrNull(value.maxReviewDays) &&
    isStringArray(value.requiredIndexes) &&
    value.requiredIndexes.every((index) => (INDEX_VALUES as readonly string[]).includes(index))
  );
}

function isArticleTypeOrNull(value: unknown): value is ArticleType | null {
  return value === null || (typeof value === "string" && (ARTICLE_TYPE_VALUES as readonly string[]).includes(value));
}

function isLastMatchOrNull(value: unknown): value is LastMatch | null {
  return value === null || (isRecord(value) && isStringArray(value.journalIds));
}

function isApprovedJournalListSelection(value: unknown): value is ApprovedJournalListSelection {
  return (
    isRecord(value) &&
    typeof value.journalListId === "string" &&
    value.journalListId.length > 0 &&
    typeof value.name === "string" &&
    typeof value.journalCount === "number" &&
    typeof value.resolvedCount === "number" &&
    typeof value.unresolvedCount === "number" &&
    typeof value.duplicateCount === "number" &&
    typeof value.invalidCount === "number" &&
    typeof value.ambiguousCount === "number"
  );
}

function isApprovedJournalListSelectionOrNull(value: unknown): value is ApprovedJournalListSelection | null {
  return value === null || isApprovedJournalListSelection(value);
}

function isSession(value: unknown): value is WarraqSession {
  return (
    isRecord(value) &&
    value.version === 1 &&
    typeof value.manuscriptId === "string" &&
    value.manuscriptId.length > 0 &&
    isSessionFile(value.file) &&
    typeof value.isDemoManuscript === "boolean" &&
    (value.preferences === null || isPreferences(value.preferences)) &&
    isArticleTypeOrNull(value.articleType) &&
    isLastMatchOrNull(value.lastMatch) &&
    (value.approvedJournalList === undefined || isApprovedJournalListSelectionOrNull(value.approvedJournalList))
  );
}

/* ───────── Public API ───────── */

export function readSession(): WarraqSession | null {
  const store = storage();
  if (!store) return null;
  let raw: string | null;
  try {
    raw = store.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isSession(parsed) ? { ...parsed, approvedJournalList: parsed.approvedJournalList ?? null } : null;
  } catch {
    return null;
  }
}

export function readApprovedJournalListSelection(): ApprovedJournalListSelection | null {
  const current = readSession();
  if (current?.approvedJournalList) return current.approvedJournalList;

  const store = storage();
  if (!store) return null;
  let raw: string | null;
  try {
    raw = store.getItem(APPROVED_JOURNAL_LIST_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isApprovedJournalListSelection(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveApprovedJournalListSelection(selection: ApprovedJournalListSelection): void {
  const current = readSession();
  if (current) {
    void updateSession({ approvedJournalList: selection });
    return;
  }
  const store = storage();
  if (!store) return;
  try {
    store.setItem(APPROVED_JOURNAL_LIST_KEY, JSON.stringify(selection));
  } catch {
    // The journey still works without the optional approved-list preference.
  }
}

export function clearApprovedJournalListSelection(): void {
  const current = readSession();
  if (current) {
    void updateSession({ approvedJournalList: null });
  }
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(APPROVED_JOURNAL_LIST_KEY);
  } catch {
    // Ignore storage failures; the stored value is optional.
  }
}

/*
 * Starts a new journey after a successful upload. Replaces any previous session, so
 * preferences and match results from another manuscript can never leak into this one.
 * Returns the stored session, or null if the browser refused to store it.
 */
export function startSession(input: {
  manuscriptId: string;
  file: SessionFile;
  isDemoManuscript: boolean;
}): WarraqSession | null {
  const approvedJournalList = readApprovedJournalListSelection();
  const session: WarraqSession = {
    version: 1,
    manuscriptId: input.manuscriptId,
    file: { name: input.file.name, sizeBytes: input.file.sizeBytes },
    isDemoManuscript: input.isDemoManuscript,
    preferences: null,
    articleType: null,
    lastMatch: null,
    approvedJournalList,
  };
  return write(session) ? session : null;
}

/*
 * Updates preferences / article type / last match of the CURRENT session.
 * Returns null (and changes nothing) when there is no session: callers must not
 * create a journey without a real uploaded manuscript.
 */
export function updateSession(patch: SessionPatch): WarraqSession | null {
  const current = readSession();
  if (!current) return null;
  const next: WarraqSession = {
    ...current,
    ...patch,
    lastMatch: patch.lastMatch === undefined ? current.lastMatch : patch.lastMatch && { journalIds: [...patch.lastMatch.journalIds] },
    approvedJournalList:
      patch.approvedJournalList === undefined ? current.approvedJournalList : patch.approvedJournalList,
  };
  return write(next) ? next : null;
}

export function clearSession(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    // Nothing else to do: a session that cannot be removed will fail its shape check or be replaced on the next upload.
  }
}
