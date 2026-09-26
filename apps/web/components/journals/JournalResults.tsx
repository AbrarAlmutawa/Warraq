"use client";

import Link from "next/link";
import { useState } from "react";
import { CompareDialog, type ReadinessEntry } from "@/components/journals/CompareDialog";
import { JournalFilters } from "@/components/journals/JournalFilters";
import { JournalResultRow } from "@/components/journals/JournalResultRow";
import { SourceDialog } from "@/components/journals/SourceDialog";
import { toJournalReadiness } from "@/lib/api-adapters";
import { compareReadiness } from "@/lib/api-client";
import { describeError } from "@/lib/api-errors";
import {
  EMPTY_JOURNAL_FILTERS,
  activeFilterCount,
  applyJournalFilters,
  reviewThresholdDays,
  type JournalFilterState,
} from "@/lib/journals/filters";
import type { JournalMatch, JournalReadiness } from "@/lib/journals/types";
import { summarizePreferences } from "@/lib/preferences/summary";
import type { ArticleType, JournalPreferences } from "@/lib/preferences/types";

type JournalResultsProps = {
  manuscriptId: string;
  matches: JournalMatch[];
  preferences: JournalPreferences;
  articleType: ArticleType | null;
  nextHref: string;
};

const MAX_COMPARE = 2;

export function JournalResults({ manuscriptId, matches, preferences, articleType, nextHref }: JournalResultsProps) {
  const [filters, setFilters] = useState<JournalFilterState>(EMPTY_JOURNAL_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  /*
   * Readiness per journal id, from POST /validate/compare, for the life of this results page.
   * The manuscript cannot change within a journey, so a journal's readiness is fetched once.
   * "error" entries are not results: they are requested again on reopen or retry.
   */
  const [readiness, setReadiness] = useState<Record<string, ReadinessEntry>>({});

  const visible = applyJournalFilters(matches, filters, preferences);
  const activeCount = activeFilterCount(filters);
  const hasDemoJournals = matches.some((match) => match.sourceIsDemo);
  const selected = matches.find((match) => match.journalId === selectedId) ?? null;
  const sourceMatch = matches.find((match) => match.journalId === sourceId) ?? null;
  const compared = compareIds
    .map((id) => matches.find((match) => match.journalId === id))
    .filter((match): match is JournalMatch => Boolean(match));

  const toggleCompare = (journalId: string) => {
    setCompareIds((current) =>
      current.includes(journalId)
        ? current.filter((id) => id !== journalId)
        : current.length < MAX_COMPARE
          ? [...current, journalId]
          : current,
    );
  };

  /* Requests readiness only for journals that have no result yet (missing or failed), in one call. */
  const requestReadiness = (journalIds: string[]) => {
    const missing = journalIds.filter((id) => {
      const entry = readiness[id];
      return !entry || entry.status === "error";
    });
    if (missing.length === 0) return;

    setReadiness((current) => {
      const next = { ...current };
      for (const id of missing) next[id] = { status: "loading" };
      return next;
    });

    compareReadiness(manuscriptId, missing).then(
      (items) => {
        const byId = new Map<string, JournalReadiness>(
          items.map((item) => [item.journal_id, toJournalReadiness(item)]),
        );
        setReadiness((current) => {
          const next = { ...current };
          for (const id of missing) {
            const result = byId.get(id);
            next[id] = result
              ? { status: "ready", readiness: result }
              : {
                  status: "error",
                  error: {
                    title: "تعذّر حساب الجاهزية",
                    message: "لم يُرجع الخادم نتيجة لهذه المجلة.",
                    detail: null,
                    retryable: true,
                  },
                };
          }
          return next;
        });
      },
      (error: unknown) => {
        const presentation = describeError(error);
        setReadiness((current) => {
          const next = { ...current };
          for (const id of missing) next[id] = { status: "error", error: presentation };
          return next;
        });
      },
    );
  };

  const openComparison = () => {
    setCompareOpen(true);
    requestReadiness(compareIds);
  };

  return (
    <>
      <main className="flex-1 px-6 pt-9 pb-10 lg:px-[72px]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-[32px] font-bold">المجلات المقترحة لبحثك</h1>
            <p className="mt-2 max-w-[680px] text-[14.5px] leading-relaxed text-body">
              رتّبها وَرَّاق حسب توافق نطاقها مع بحثك، ثم حسب أولوياتك. «التوافق» تقدير مفسَّر من وَرَّاق،
              وليس شرطًا من شروط المجلة.
            </p>
          </div>
          {hasDemoJournals && (
            <span
              title="تتضمن القائمة مجلات تجريبية وهمية لأغراض العرض؛ قيمها ومتطلباتها ليست حقيقية."
              className="self-start rounded-full border border-rule-strong px-3 py-[3px] text-xs text-muted lg:self-auto"
            >
              بيانات تجريبية
            </span>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 border-y border-rule py-3 text-sm">
          <span className="font-semibold">أولوياتك الحالية:</span>
          <span className="text-body">{summarizePreferences(preferences, articleType)}</span>
          <Link
            href="/preferences"
            className="text-ink underline underline-offset-4 hover:text-terracotta-text"
          >
            تعديل الأولويات
          </Link>
        </div>

        <JournalFilters
          filters={filters}
          onChange={setFilters}
          onClear={() => setFilters(EMPTY_JOURNAL_FILTERS)}
          activeCount={activeCount}
          showBudgetFilter={preferences.maxApcUsd !== null}
          reviewThreshold={reviewThresholdDays(preferences)}
        />

        <section aria-labelledby="results-heading" className="mt-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="results-heading" className="sr-only">
              قائمة المجلات
            </h2>
            <p aria-live="polite" className="text-[13px] text-muted">
              تظهر {visible.length} من {matches.length} مجلات
            </p>
          </div>

          <div
            aria-hidden="true"
            className="mt-2 hidden gap-6 border-b border-ink py-2.5 ps-5 text-[12.5px] font-semibold text-muted lg:grid lg:grid-cols-[260px_minmax(0,1fr)_290px_180px]"
          >
            <span>المجلة</span>
            <span>لماذا تناسب بحثك</span>
            <span>الاعتبارات العملية</span>
            <span />
          </div>

          {visible.length > 0 ? (
            <ul className="m-0 list-none p-0">
              {visible.map((match) => (
                <JournalResultRow
                  key={match.journalId}
                  match={match}
                  preferences={preferences}
                  isSelected={selectedId === match.journalId}
                  onSelect={() => setSelectedId(match.journalId)}
                  isCompared={compareIds.includes(match.journalId)}
                  compareDisabled={
                    !compareIds.includes(match.journalId) && compareIds.length >= MAX_COMPARE
                  }
                  onToggleCompare={() => toggleCompare(match.journalId)}
                  onShowSource={() => setSourceId(match.journalId)}
                />
              ))}
            </ul>
          ) : (
            <div className="border-b border-rule py-10 text-center">
              <p className="text-[15px] font-semibold">لا توجد مجلات تطابق هذه الفلاتر.</p>
              <button
                type="button"
                onClick={() => setFilters(EMPTY_JOURNAL_FILTERS)}
                className="mt-3 text-sm underline underline-offset-4 hover:text-terracotta-text"
              >
                مسح الفلاتر
              </button>
            </div>
          )}
        </section>
      </main>

      <footer className="sticky bottom-0 z-10 flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3 border-t border-rule bg-paper px-6 py-4 lg:h-[88px] lg:flex-nowrap lg:px-[72px] lg:py-0">
        <p aria-live="polite" className="min-w-0 flex-1 basis-full text-sm text-body lg:basis-auto">
          {selected ? (
            <>
              المجلة المختارة:{" "}
              <span dir="ltr" className="font-latin font-semibold text-ink">
                {selected.name}
              </span>
            </>
          ) : (
            "اختر مجلة واحدة لتبدأ تجهيز بحثك لها."
          )}
        </p>
        {compareIds.length > 0 && (
          <button
            type="button"
            onClick={openComparison}
            disabled={compareIds.length < MAX_COMPARE}
            className="h-12 rounded-[3px] border border-ink px-5 text-sm font-semibold hover:bg-paper-raised disabled:cursor-not-allowed disabled:border-rule-strong disabled:text-muted"
          >
            {compareIds.length < MAX_COMPARE ? "اختر مجلة أخرى للمقارنة" : "مقارنة المجلتين"}
          </button>
        )}
        {selected ? (
          <Link
            href={`${nextHref}?journal=${selected.journalId}`}
            className="inline-flex h-12 items-center gap-2 rounded-[3px] bg-ink px-6 text-[15px] font-bold text-paper hover:bg-ink/90"
          >
            ابدأ تجهيز البحث لهذه المجلة
            <span aria-hidden="true">←</span>
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex h-12 cursor-not-allowed items-center gap-2 rounded-[3px] border border-rule-strong px-6 text-[15px] font-bold text-muted"
          >
            ابدأ تجهيز البحث لهذه المجلة
          </button>
        )}
      </footer>

      <SourceDialog match={sourceMatch} onClose={() => setSourceId(null)} />
      <CompareDialog
        open={compareOpen && compared.length === MAX_COMPARE}
        journals={compared}
        readiness={readiness}
        onRetryReadiness={() => requestReadiness(compareIds)}
        selectedId={selectedId}
        onClose={() => setCompareOpen(false)}
        onSelect={(journalId) => {
          setSelectedId(journalId);
          setCompareOpen(false);
        }}
      />
    </>
  );
}