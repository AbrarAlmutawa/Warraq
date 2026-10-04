"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  JOURNEY_ACTION_PRIMARY,
  JOURNEY_ACTION_SECONDARY,
  JourneyRecovery,
} from "@/components/feedback/JourneyRecovery";
import { JournalResults } from "@/components/journals/JournalResults";
import { toApiMatchPreferences, toJournalListMatch, toJournalMatch } from "@/lib/api-adapters";
import {
  createJournalList,
  isNotFound,
  listJournals,
  matchJournalList,
  matchJournals,
  uploadJournalList,
  type ApiJournalListEntry,
  type ApiJournalListExcludedEntry,
  type ApiJournalListDetail,
  type ApiJournalListMatchResponse,
  type ApiJournalSummary,
} from "@/lib/api-client";
import { describeError, type ErrorPresentation } from "@/lib/api-errors";
import type { JournalMatch } from "@/lib/journals/types";
import { summarizePreferences } from "@/lib/preferences/summary";
import type { ArticleType, JournalPreferences } from "@/lib/preferences/types";
import {
  clearApprovedJournalListSelection,
  clearSession,
  readSession,
  saveApprovedJournalListSelection,
  updateSession,
  type ApprovedJournalListSelection,
} from "@/lib/session";

type LoadState =
  /* First render (server and client): nothing is known yet. */
  | { status: "checking" }
  /* No stored journey in this tab. */
  | { status: "no-session" }
  /* A manuscript exists but the researcher has not set priorities yet. */
  | { status: "no-preferences" }
  /* POST /match is running. */
  | { status: "matching" }
  | {
      status: "ready";
      manuscriptId: string;
      matches: JournalMatch[];
      preferences: JournalPreferences;
      articleType: ArticleType | null;
    }
  | { status: "error"; error: ErrorPresentation };

type SourceMode = "catalog" | "custom-list";

type CustomListState =
  | { status: "idle" }
  | { status: "loading-catalog" }
  | { status: "uploading" }
  | { status: "uploaded"; result: ApiJournalListDetail }
  | { status: "matching"; result: ApiJournalListDetail }
  | { status: "error"; error: ErrorPresentation };

type CustomListDiagnostics = {
  providedCount: number;
  resolvedCount: number;
  unresolvedCount: number;
  eligibleCount: number;
  finalCount: number;
  unresolvedEntries: ApiJournalListEntry[];
  excludedEntries: ApiJournalListExcludedEntry[];
};

const RESOLUTION_STATUS_LABELS: Record<string, string> = {
  unresolved: "غير مطابق",
  duplicate: "مكرر",
  invalid: "غير صالح",
  ambiguous: "بحاجة لمراجعة",
};

const EXCLUSION_REASON_LABELS: Record<string, string> = {
  article_type: "نوع المقالة",
  language: "اللغة",
  open_access: "الوصول المفتوح",
  max_apc: "الرسوم القصوى",
  max_review_days: "مدة المراجعة القصوى",
  required_indexes: "الفهارس المطلوبة",
};

function selectionFromDetail(detail: ApiJournalListDetail): ApprovedJournalListSelection {
  return {
    journalListId: detail.journal_list.journal_list_id,
    name: detail.journal_list.name,
    journalCount: detail.journal_list.journal_count,
    resolvedCount: detail.journal_list.resolved_count,
    unresolvedCount: detail.journal_list.unresolved_count,
    duplicateCount: detail.journal_list.duplicate_count,
    invalidCount: detail.journal_list.invalid_count,
    ambiguousCount: detail.journal_list.ambiguous_count,
  };
}

function selectionToDetail(selection: ApprovedJournalListSelection): ApiJournalListDetail {
  return {
    journal_list: {
      journal_list_id: selection.journalListId,
      name: selection.name,
      description: null,
      institution: null,
      journal_count: selection.journalCount,
      resolved_count: selection.resolvedCount,
      unresolved_count: selection.unresolvedCount,
      duplicate_count: selection.duplicateCount,
      invalid_count: selection.invalidCount,
      ambiguous_count: selection.ambiguousCount,
      created_at: "",
    },
    entries: [],
  };
}

function diagnosticsFromResponse(response: ApiJournalListMatchResponse): CustomListDiagnostics {
  return {
    providedCount: response.provided_count,
    resolvedCount: response.resolved_count,
    unresolvedCount: response.unresolved_count,
    eligibleCount: response.eligible_count,
    finalCount: response.matches.length,
    unresolvedEntries: [...(response.unresolved_entries ?? [])],
    excludedEntries: [...(response.excluded_entries ?? [])],
  };
}

type JournalsFlowProps = {
  nextHref: string;
};

export function JournalsFlow({ nextHref }: JournalsFlowProps) {
  const [load, setLoad] = useState<LoadState>({ status: "checking" });
  const [attempt, setAttempt] = useState(0);
  const [sourceMode, setSourceMode] = useState<SourceMode>("catalog");
  const [useSavedApprovedList, setUseSavedApprovedList] = useState(true);
  const [customList, setCustomList] = useState<CustomListState>({ status: "idle" });
  const [customListDiagnostics, setCustomListDiagnostics] = useState<CustomListDiagnostics | null>(null);
  const [activeApprovedList, setActiveApprovedList] = useState<ApprovedJournalListSelection | null>(null);
  const [showListControls, setShowListControls] = useState(false);
  const [catalogJournals, setCatalogJournals] = useState<ApiJournalSummary[]>([]);
  const [selectedJournalIds, setSelectedJournalIds] = useState<string[]>([]);
  const activeApprovedMatchKey = useRef<string | null>(null);
  const approvedMatchGeneration = useRef(0);
  const sourceModeRef = useRef<SourceMode>(sourceMode);

  useEffect(() => {
    sourceModeRef.current = sourceMode;
  }, [sourceMode]);

  const approvedMatchKey = useCallback((
    selection: ApprovedJournalListSelection,
    manuscriptId: string,
    preferences: JournalPreferences,
    articleType: ArticleType | null,
  ) =>
    JSON.stringify({
      mode: "custom-list",
      journalListId: selection.journalListId,
      manuscriptId,
      preferences,
      articleType,
    }), []);

  const beginApprovedMatch = useCallback((matchKey: string) => {
    approvedMatchGeneration.current += 1;
    activeApprovedMatchKey.current = matchKey;
    return approvedMatchGeneration.current;
  }, []);

  const invalidateApprovedMatches = useCallback(() => {
    approvedMatchGeneration.current += 1;
    activeApprovedMatchKey.current = null;
  }, []);

  const isCurrentApprovedMatch = useCallback((generation: number, matchKey: string) => {
    if (approvedMatchGeneration.current !== generation) return false;
    if (activeApprovedMatchKey.current !== matchKey) return false;
    if (sourceModeRef.current !== "custom-list") return false;
    const session = readSession();
    if (!session?.preferences || !session.approvedJournalList) return false;
    return (
      approvedMatchKey(
        session.approvedJournalList,
        session.manuscriptId,
        session.preferences,
        session.articleType,
      ) === matchKey
    );
  }, [approvedMatchKey]);

  const matchApprovedJournalList = useCallback(
    (
      selection: ApprovedJournalListSelection,
      manuscriptId: string,
      preferences: JournalPreferences,
      articleType: ArticleType | null,
      generation: number,
      matchKey: string,
    ) => {
      matchJournalList(
        selection.journalListId,
        manuscriptId,
        toApiMatchPreferences(preferences, articleType),
      ).then(
        (response) => {
          if (!isCurrentApprovedMatch(generation, matchKey)) return;
          const matches = response.matches.map(toJournalListMatch);
          updateSession({ lastMatch: { journalIds: matches.map((match) => match.journalId) } });
          setActiveApprovedList(selection);
          setCustomListDiagnostics(diagnosticsFromResponse(response));
          setCustomList({ status: "uploaded", result: selectionToDetail(selection) });
          setLoad({
            status: "ready",
            manuscriptId,
            matches,
            preferences,
            articleType,
          });
        },
        (error: unknown) => {
          if (!isCurrentApprovedMatch(generation, matchKey)) return;
          setCustomList({ status: "error", error: describeError(error) });
        },
      );
    },
    [isCurrentApprovedMatch],
  );

  useEffect(() => {
    let cancelled = false;
    const apply = (next: LoadState) => {
      if (!cancelled) setLoad(next);
    };

    // Browser-only reads happen after the first render so server and client HTML match.
    void Promise.resolve().then(() => {
      // In development StrictMode runs this effect twice; the first run is already cancelled
      // here, so exactly one POST /match is sent per visit.
      if (cancelled) return;

      const session = readSession();
      if (!session) {
        apply({ status: "no-session" });
        return;
      }
      if (!session.preferences) {
        apply({ status: "no-preferences" });
        return;
      }

      const manuscriptId = session.manuscriptId;
      const preferences = session.preferences;
      const articleType = session.articleType;
      setActiveApprovedList(session.approvedJournalList);
      if (sourceMode === "catalog" && useSavedApprovedList && session.approvedJournalList) {
        setSourceMode("custom-list");
        return;
      }
      if (sourceMode !== "catalog") {
        if (session.approvedJournalList) {
          const matchKey = approvedMatchKey(session.approvedJournalList, manuscriptId, preferences, articleType);
          if (activeApprovedMatchKey.current !== matchKey) {
            const generation = beginApprovedMatch(matchKey);
            apply({
              status: "ready",
              manuscriptId,
              matches: [],
              preferences,
              articleType,
            });
            setCustomListDiagnostics(null);
            setCustomList({ status: "matching", result: selectionToDetail(session.approvedJournalList) });
            matchApprovedJournalList(
              session.approvedJournalList,
              manuscriptId,
              preferences,
              articleType,
              generation,
              matchKey,
            );
          }
          return;
        }
        apply({
          status: "ready",
          manuscriptId,
          matches: [],
          preferences,
          articleType,
        });
        return;
      }

      apply({ status: "matching" });

      matchJournals(manuscriptId, toApiMatchPreferences(preferences, articleType)).then(
        (views) => {
          if (cancelled) return;
          const matches = views.map(toJournalMatch);
          // The ranked ids of this successful match become the Switch Journal candidates.
          updateSession({ lastMatch: { journalIds: matches.map((match) => match.journalId) } });
          apply({ status: "ready", manuscriptId, matches, preferences, articleType });
        },
        (error: unknown) => {
          // /match checks the manuscript first: a 404 means the stored id no longer exists.
          if (isNotFound(error)) clearSession();
          apply({ status: "error", error: describeError(error, "manuscript") });
        },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [
    approvedMatchKey,
    attempt,
    beginApprovedMatch,
    matchApprovedJournalList,
    sourceMode,
    useSavedApprovedList,
  ]);

  const retry = () => {
    setLoad({ status: "checking" });
    setAttempt((current) => current + 1);
  };

  const switchToCatalog = () => {
    setUseSavedApprovedList(false);
    invalidateApprovedMatches();
    setSourceMode("catalog");
    setShowListControls(false);
    setCustomList({ status: "idle" });
    setCustomListDiagnostics(null);
    setCatalogJournals([]);
    setSelectedJournalIds([]);
    retry();
  };

  const resetCustomListSelection = () => {
    clearApprovedJournalListSelection();
    setUseSavedApprovedList(false);
    invalidateApprovedMatches();
    setActiveApprovedList(null);
    setShowListControls(false);
    setCustomList({ status: "idle" });
    setCustomListDiagnostics(null);
    setCatalogJournals([]);
    setSelectedJournalIds([]);
    setSourceMode("catalog");
    retry();
  };

  const recoveryFrame = (content: React.ReactNode) => (
    <main className="flex flex-1 justify-center px-6">
      <div className="mt-16 w-full max-w-[680px] pb-16 lg:mt-24">{content}</div>
    </main>
  );

  const runCustomMatch = (uploadResult: ApiJournalListDetail) => {
    const session = readSession();
    if (!session?.preferences) {
      setCustomList({
        status: "error",
        error: {
          title: "لم تُحدَّد الأولويات",
          message: "اختر أولويات المجلات قبل حصر الترشيح في قائمة معتمدة.",
          detail: null,
          retryable: false,
        },
      });
      return;
    }
    const preferences = session.preferences;
    const articleType = session.articleType;
    const selection = selectionFromDetail(uploadResult);
    saveApprovedJournalListSelection(selection);
    updateSession({ approvedJournalList: selection });
    const matchKey = approvedMatchKey(selection, session.manuscriptId, preferences, articleType);
    const generation = beginApprovedMatch(matchKey);
    setCustomList({ status: "matching", result: uploadResult });
    matchJournalList(
      uploadResult.journal_list.journal_list_id,
      session.manuscriptId,
      toApiMatchPreferences(preferences, articleType),
    ).then(
      (response) => {
        if (!isCurrentApprovedMatch(generation, matchKey)) return;
        const matches = response.matches.map(toJournalListMatch);
        setActiveApprovedList(selection);
        setCustomListDiagnostics(diagnosticsFromResponse(response));
        updateSession({
          approvedJournalList: selection,
          lastMatch: { journalIds: matches.map((match) => match.journalId) },
        });
        setCustomList({ status: "uploaded", result: uploadResult });
        setLoad({
          status: "ready",
          manuscriptId: session.manuscriptId,
          matches,
          preferences,
          articleType,
        });
      },
      (error: unknown) => {
        if (!isCurrentApprovedMatch(generation, matchKey)) return;
        setCustomList({ status: "error", error: describeError(error) });
      },
    );
  };

  const uploadCustomList = (file: File | null) => {
    if (!file) return;
    setShowListControls(false);
    invalidateApprovedMatches();
    setSourceMode("custom-list");
    setCustomList({ status: "uploading" });
    uploadJournalList({ file, name: file.name.replace(/\.[^.]+$/, "") }).then(
      (result) => {
        setCustomList({ status: "uploaded", result });
        runCustomMatch(result);
      },
      (error: unknown) => setCustomList({ status: "error", error: describeError(error, "upload") }),
    );
  };

  const loadKnownJournals = () => {
    setShowListControls(true);
    invalidateApprovedMatches();
    setSourceMode("custom-list");
    setCustomList({ status: "loading-catalog" });
    setCustomListDiagnostics(null);
    listJournals().then(
      (journals) => {
        setCatalogJournals(journals);
        setLoad((current) => {
          if (current.status === "ready") return current;
          const session = readSession();
          return session?.preferences
            ? {
                status: "ready",
                manuscriptId: session.manuscriptId,
                matches: [],
                preferences: session.preferences,
                articleType: session.articleType,
              }
            : current;
        });
        setCustomList({ status: "idle" });
      },
      (error: unknown) => setCustomList({ status: "error", error: describeError(error) }),
    );
  };

  const toggleKnownJournal = (journalId: string) => {
    setSelectedJournalIds((current) =>
      current.includes(journalId)
        ? current.filter((id) => id !== journalId)
        : [...current, journalId],
    );
  };

  const matchSelectedKnownJournals = () => {
    if (selectedJournalIds.length === 0) {
      setCustomList({
        status: "error",
        error: {
          title: "القائمة فارغة",
          message: "اختر مجلة واحدة على الأقل من مجلات ورّاق قبل المطابقة داخل القائمة المعتمدة.",
          detail: null,
          retryable: false,
        },
      });
      return;
    }
    const selected = catalogJournals.filter((journal) => selectedJournalIds.includes(journal.journal_id));
    setCustomList({ status: "uploading" });
    createJournalList({
      name: "مجلات مختارة من ورّاق",
      description: "مجلات اختيرت يدويًا من فهرس ورّاق.",
      journals: selected.map((journal) => ({
        journal_id: journal.journal_id,
        journal_name: journal.name,
        publisher: journal.publisher,
      })),
    }).then(
      (result) => {
        setShowListControls(false);
        setCustomList({ status: "uploaded", result });
        runCustomMatch(result);
      },
      (error: unknown) => setCustomList({ status: "error", error: describeError(error) }),
    );
  };

  const customListProblemEntries =
    customListDiagnostics?.unresolvedEntries ??
    (customList.status === "uploaded"
      ? customList.result.entries.filter((entry) => entry.resolution_status !== "resolved")
      : []);

  const visibleApprovedList =
    activeApprovedList ?? (customList.status === "uploaded" ? selectionFromDetail(customList.result) : null);

  const customListUnresolvedCount =
    visibleApprovedList
      ? visibleApprovedList.unresolvedCount + visibleApprovedList.invalidCount + visibleApprovedList.ambiguousCount
      : 0;

  const isCustomListContext =
    sourceMode === "custom-list" &&
    (customList.status === "uploaded" || customList.status === "matching" || catalogJournals.length > 0);

  const allResolvedExcludedByPreferences =
    sourceMode === "custom-list" &&
    customList.status === "uploaded" &&
    customListDiagnostics !== null &&
    customListDiagnostics.resolvedCount > 0 &&
    customListDiagnostics.eligibleCount === 0;

  const sourceChooser = (
    <section className="mt-5 border border-rule bg-paper-raised p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-bold">نطاق البحث عن المجلات</h2>
          <p className="mt-1 text-body">
            اختر هل تريد مطابقة البحث مع كل مجلات ورّاق أو حصرها في قائمة معتمدة.
          </p>
        </div>
        {visibleApprovedList && (
          <span className="border border-rule-strong px-3 py-1 text-xs font-semibold text-body">
            {visibleApprovedList.name}
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <button
          type="button"
          onClick={switchToCatalog}
          className={`flex min-h-[104px] gap-3 border p-4 text-start transition ${
            sourceMode === "catalog" ? "border-ink bg-paper" : "border-rule bg-paper-raised hover:border-rule-strong"
          }`}
        >
          <span
            className={`mt-1 size-4 shrink-0 rounded-full border ${
              sourceMode === "catalog" ? "border-ink bg-ink" : "border-rule-strong bg-paper"
            }`}
            aria-hidden="true"
          />
          <span>
            <span className="block font-bold">جميع مجلات ورّاق</span>
            <span className="mt-1 block leading-6 text-body">
              البحث والترتيب في كامل فهرس المجلات المتاح في ورّاق.
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setUseSavedApprovedList(true);
            setShowListControls(true);
            setSourceMode("custom-list");
          }}
          className={`flex min-h-[104px] gap-3 border p-4 text-start transition ${
            sourceMode === "custom-list"
              ? "border-ink bg-paper"
              : "border-rule bg-paper-raised hover:border-rule-strong"
          }`}
        >
          <span
            className={`mt-1 size-4 shrink-0 rounded-full border ${
              sourceMode === "custom-list" ? "border-ink bg-ink" : "border-rule-strong bg-paper"
            }`}
            aria-hidden="true"
          />
          <span>
            <span className="block font-bold">قائمة مجلات معتمدة / مخصصة</span>
            <span className="mt-1 block leading-6 text-body">
              حصر التوصيات في مجلات تعتمدها جامعتك أو الجهة البحثية أو قائمتك الشخصية.
            </span>
          </span>
        </button>
      </div>

      {sourceMode === "custom-list" && (
        <div className="mt-4 border-t border-rule pt-4">
          <p className="font-semibold">اختر طريقة إعداد القائمة</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={loadKnownJournals}
              className="h-10 border border-ink bg-ink px-4 text-sm font-semibold text-paper"
            >
              اختيار مجلات موجودة في ورّاق
            </button>
            <label className="inline-flex h-10 cursor-pointer items-center border border-rule-strong px-4 text-sm font-semibold">
              رفع قائمة CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => uploadCustomList(event.currentTarget.files?.[0] ?? null)}
              />
            </label>
            <span className="inline-flex h-10 items-center border border-rule px-3 text-xs font-semibold text-muted">
              CSV فقط
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted">
            بعد الرفع، ستشارك المجلات التي يتعرّف عليها ورّاق فقط في المطابقة.
          </p>
        </div>
      )}

      <div className="mt-3 min-h-5">
        {customList.status === "loading-catalog" && <span className="text-sm text-muted">نحمّل المجلات الموجودة في ورّاق…</span>}
        {customList.status === "uploading" && <span className="text-sm text-muted">نعالج القائمة…</span>}
        {customList.status === "matching" && <span className="text-sm text-muted">نرتّب المجلات من هذه القائمة…</span>}
        {visibleApprovedList && customList.status === "uploaded" && (
          <span className="text-sm text-body">
            القائمة: {visibleApprovedList.name} · إجمالي الصفوف {visibleApprovedList.journalCount} · المجلات المطابقة{" "}
            {visibleApprovedList.resolvedCount} · غير المطابقة {customListUnresolvedCount}
          </span>
        )}
        {customList.status === "error" && (
          <span className="text-sm text-terracotta-text">
            {customList.error.title}
            {customList.error.detail ? (
              <span className="ms-2 text-muted" dir="ltr">
                {customList.error.detail}
              </span>
            ) : null}
          </span>
        )}
      </div>
    </section>
  );

  if (load.status === "no-session") {
    return recoveryFrame(
      <JourneyRecovery
        tone="notice"
        title="لا يوجد بحث لاقتراح المجلات له"
        message="ارفع بحثك بصيغة DOCX أولًا، أو جرّب البحث التجريبي من صفحة البداية."
      >
        <Link href="/" className={JOURNEY_ACTION_PRIMARY}>
          رفع بحث
          <span aria-hidden="true">←</span>
        </Link>
      </JourneyRecovery>,
    );
  }

  if (load.status === "no-preferences") {
    return recoveryFrame(
      <JourneyRecovery
        tone="notice"
        title="حدّد أولوياتك أولًا"
        message="يرتّب وَرَّاق المجلات حسب أولوياتك، فاخترها أولًا ثم اطلب اقتراح المجلات."
      >
        <Link href="/preferences" className={JOURNEY_ACTION_PRIMARY}>
          تحديد الأولويات
          <span aria-hidden="true">←</span>
        </Link>
      </JourneyRecovery>,
    );
  }

  if (load.status === "error") {
    return recoveryFrame(
      <JourneyRecovery title={load.error.title} message={load.error.message} detail={load.error.detail}>
        {load.error.retryable ? (
          <>
            <button type="button" onClick={retry} className={JOURNEY_ACTION_PRIMARY}>
              إعادة المحاولة
            </button>
            <Link href="/preferences" className={JOURNEY_ACTION_SECONDARY}>
              العودة إلى الأولويات
            </Link>
          </>
        ) : (
          <Link href="/" className={JOURNEY_ACTION_PRIMARY}>
            رفع البحث من جديد
            <span aria-hidden="true">←</span>
          </Link>
        )}
      </JourneyRecovery>,
    );
  }

  if (
    load.status === "ready" &&
    sourceMode === "custom-list" &&
    customList.status !== "uploaded" &&
    catalogJournals.length === 0
  ) {
    return (
      <main className="flex-1 px-6 pt-9 pb-10 lg:px-[72px]">
        <h1 className="text-[32px] font-bold">المجلات المقترحة لبحثك</h1>
        <p className="mt-2 max-w-[680px] text-[14.5px] leading-relaxed text-body">
          اختر قائمة مجلات معتمدة ليقصر ورّاق الترشيح عليها فقط، أو عد إلى فهرس ورّاق الكامل.
        </p>
        {showListControls ? sourceChooser : null}
      </main>
    );
  }

  if (load.status === "ready" && load.matches.length === 0 && !isCustomListContext) {
    return recoveryFrame(
      <JourneyRecovery
        tone="notice"
        eyebrow="لا توجد نتائج"
        title="لا توجد مجلات تطابق أولوياتك الحالية"
        message={`استُبعدت المجلات لأنها لا تطابق شرطًا اخترته، لا بسبب بيانات ناقصة. جرّب تخفيف أحد الشروط ثم أعد الاقتراح. أولوياتك الحالية: ${summarizePreferences(load.preferences, load.articleType)}.`}
      >
        <Link href="/preferences" className={JOURNEY_ACTION_PRIMARY}>
          تعديل الأولويات
          <span aria-hidden="true">←</span>
        </Link>
      </JourneyRecovery>,
    );
  }

  if (load.status !== "ready") {
    return (
      <main className="flex-1 px-6 pt-9 pb-10 lg:px-[72px]" aria-busy="true">
        <h1 className="text-[32px] font-bold">المجلات المقترحة لبحثك</h1>
        {showListControls ? sourceChooser : null}
        <p role="status" className="mt-2 max-w-[680px] text-[14.5px] leading-relaxed text-muted">
          {load.status === "matching"
            ? "نبحث عن المجلات الأنسب لبحثك وأولوياتك… قد يستغرق أول بحث حتى دقيقة."
            : ""}
        </p>
      </main>
    );
  }

  return (
    <>
      <main className="px-6 pt-9 lg:px-[72px]">
        {showListControls ? sourceChooser : null}
        {sourceMode === "custom-list" && customList.status === "uploaded" && visibleApprovedList && (
          <div className="mt-4 border border-rule bg-paper-raised px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">النتائج محصورة في قائمة المجلات المعتمدة</p>
                <p className="mt-1 text-muted">
                  {visibleApprovedList.name} ·{" "}
                  {customListDiagnostics
                    ? `${customListDiagnostics.providedCount} في القائمة · ${customListDiagnostics.resolvedCount} معروفة في ورّاق · ${customListDiagnostics.eligibleCount} تطابق الأولويات · ${customListDiagnostics.finalCount} نتيجة مرتبة`
                    : `${visibleApprovedList.resolvedCount} مجلات في القائمة`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowListControls((current) => !current)}
                  className="h-9 border border-rule-strong px-3 text-xs font-semibold"
                >
                  تغيير القائمة المعتمدة
                </button>
                <button
                  type="button"
                  onClick={resetCustomListSelection}
                  className="h-9 border border-rule-strong px-3 text-xs font-semibold"
                >
                  إزالة القائمة
                </button>
                <button
                  type="button"
                  onClick={switchToCatalog}
                  className="h-9 border border-ink bg-ink px-3 text-xs font-semibold text-paper"
                >
                  العودة إلى جميع مجلات ورّاق
                </button>
              </div>
            </div>
            {allResolvedExcludedByPreferences && (
              <div className="mt-3 border-t border-rule pt-3">
                <p className="font-semibold text-terracotta-text">
                  لا توجد مجلات من قائمتك المعتمدة تطابق الأولويات الحالية.
                </p>
                <Link
                  href="/preferences"
                  className="mt-2 inline-flex h-9 items-center border border-ink bg-ink px-3 text-xs font-semibold text-paper"
                >
                  تعديل الأولويات
                </Link>
              </div>
            )}
            {customListDiagnostics && customListDiagnostics.excludedEntries.length > 0 && (
              <details className="mt-3 border-t border-rule pt-3">
                <summary className="cursor-pointer font-semibold text-terracotta-text">
                  {customListDiagnostics.excludedEntries.length} مجلة معروفة استُبعدت بسبب الأولويات
                </summary>
                <ol className="mt-3 grid gap-2">
                  {customListDiagnostics.excludedEntries.map((item) => (
                    <li key={item.entry.entry_id} className="border border-rule bg-paper p-3">
                      <p className="font-semibold" dir="auto">
                        {item.journal_name}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        سبب الاستبعاد:{" "}
                        {item.reasons
                          .map((reason) => EXCLUSION_REASON_LABELS[reason] ?? reason)
                          .join("، ")}
                      </p>
                    </li>
                  ))}
                </ol>
              </details>
            )}
            {customListDiagnostics && customListDiagnostics.unresolvedCount > 0 && (
              <p className="mt-3 text-body">
                {customListDiagnostics.unresolvedCount} مجلة من القائمة غير موجودة حاليًا في قاعدة مجلات ورّاق.
              </p>
            )}
            {customListProblemEntries.length > 0 && (
              <details className="mt-3 border-t border-rule pt-3">
                <summary className="cursor-pointer font-semibold text-terracotta-text">
                  استعراض المجلات غير المطابقة ({customListProblemEntries.length})
                </summary>
                <ol className="mt-3 grid max-h-72 gap-2 overflow-auto pe-2">
                  {customListProblemEntries.slice(0, 50).map((entry) => (
                    <li key={entry.entry_id} className="border border-rule bg-paper p-3">
                      <p className="font-semibold" dir="auto">
                        {entry.original_name || "مجلة بلا اسم"}
                      </p>
                      <dl className="mt-1 grid gap-x-4 gap-y-1 text-xs text-muted sm:grid-cols-2">
                        <div>
                          <dt className="inline font-semibold text-ink">الحالة: </dt>
                          <dd className="inline">
                            {RESOLUTION_STATUS_LABELS[entry.resolution_status] ?? entry.resolution_status}
                          </dd>
                        </div>
                        {entry.issn && (
                          <div>
                            <dt className="inline font-semibold text-ink">ISSN: </dt>
                            <dd className="inline font-latin">{entry.issn}</dd>
                          </div>
                        )}
                        {entry.eissn && (
                          <div>
                            <dt className="inline font-semibold text-ink">eISSN: </dt>
                            <dd className="inline font-latin">{entry.eissn}</dd>
                          </div>
                        )}
                        <div className="sm:col-span-2">
                          <dt className="inline font-semibold text-ink">السبب: </dt>
                          <dd className="inline">{entry.resolution_message ?? "لم يرجع سبب تفصيلي."}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ol>
                {customListProblemEntries.length > 50 && (
                  <p className="mt-2 text-xs text-muted">
                    نعرض أول 50 صفًا بحاجة للمراجعة. قسّم ملف CSV أو راجع مصدره لرؤية البقية.
                  </p>
                )}
              </details>
            )}
          </div>
        )}
        {sourceMode === "custom-list" && catalogJournals.length > 0 && customList.status !== "matching" && (
          <div className="mt-4 border border-rule bg-paper-raised p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">اختيار مجلات موجودة في ورّاق</p>
                <p className="mt-1 text-muted">
                  سيحصر ورّاق الترشيح في المجلات التي تختارها هنا.
                </p>
              </div>
              <button
                type="button"
                onClick={matchSelectedKnownJournals}
                disabled={selectedJournalIds.length === 0}
                className="h-10 rounded-[3px] bg-ink px-4 text-sm font-semibold text-paper disabled:cursor-not-allowed disabled:bg-rule-strong"
              >
                مطابقة {selectedJournalIds.length} مجلة مختارة
              </button>
            </div>
            <div className="mt-3 grid max-h-72 gap-2 overflow-auto pe-2 md:grid-cols-2">
              {catalogJournals.map((journal) => (
                <label key={journal.journal_id} className="flex cursor-pointer gap-2 border border-rule bg-paper p-3">
                  <input
                    type="checkbox"
                    checked={selectedJournalIds.includes(journal.journal_id)}
                    onChange={() => toggleKnownJournal(journal.journal_id)}
                    className="mt-1 size-4 accent-ink"
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold" dir="ltr">
                      {journal.name}
                    </span>
                    <span className="block text-xs text-muted" dir="ltr">
                      {journal.publisher} · {journal.journal_id}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </main>
      <JournalResults
        manuscriptId={load.manuscriptId}
        matches={load.matches}
        preferences={load.preferences}
        articleType={load.articleType}
        nextHref={nextHref}
      />
    </>
  );
}
