"use client";

import { useEffect, useState } from "react";
import {
  createJournalList,
  listJournals,
  uploadJournalList,
  type ApiJournalListDetail,
  type ApiJournalSummary,
} from "@/lib/api-client";
import { describeError, type ErrorPresentation } from "@/lib/api-errors";
import {
  clearApprovedJournalListSelection,
  readApprovedJournalListSelection,
  saveApprovedJournalListSelection,
  type ApprovedJournalListSelection,
} from "@/lib/session";

type SetupState =
  | { status: "idle" }
  | { status: "loading-catalog" }
  | { status: "uploading" }
  | { status: "saving" }
  | { status: "error"; error: ErrorPresentation };

function toSelection(detail: ApiJournalListDetail): ApprovedJournalListSelection {
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

function unresolvedTotal(selection: ApprovedJournalListSelection): number {
  return selection.unresolvedCount + selection.invalidCount + selection.ambiguousCount;
}

export function ApprovedJournalListCard() {
  const [state, setState] = useState<SetupState>({ status: "idle" });
  const [selection, setSelection] = useState<ApprovedJournalListSelection | null>(null);
  const [catalogJournals, setCatalogJournals] = useState<ApiJournalSummary[]>([]);
  const [selectedJournalIds, setSelectedJournalIds] = useState<string[]>([]);

  useEffect(() => {
    void Promise.resolve().then(() => setSelection(readApprovedJournalListSelection()));
  }, []);

  const storeSelection = (detail: ApiJournalListDetail) => {
    const next = toSelection(detail);
    saveApprovedJournalListSelection(next);
    setSelection(next);
  };

  const uploadCsv = (file: File | null) => {
    if (!file) return;
    setState({ status: "uploading" });
    uploadJournalList({ file, name: file.name.replace(/\.[^.]+$/, "") }).then(
      (detail) => {
        storeSelection(detail);
        setCatalogJournals([]);
        setSelectedJournalIds([]);
        setState({ status: "idle" });
      },
      (error: unknown) => setState({ status: "error", error: describeError(error, "upload") }),
    );
  };

  const loadKnownJournals = () => {
    setState({ status: "loading-catalog" });
    listJournals().then(
      (journals) => {
        setCatalogJournals(journals);
        setState({ status: "idle" });
      },
      (error: unknown) => setState({ status: "error", error: describeError(error) }),
    );
  };

  const toggleJournal = (journalId: string) => {
    setSelectedJournalIds((current) =>
      current.includes(journalId)
        ? current.filter((id) => id !== journalId)
        : [...current, journalId],
    );
  };

  const saveKnownJournalList = () => {
    const selected = catalogJournals.filter((journal) => selectedJournalIds.includes(journal.journal_id));
    if (selected.length === 0) {
      setState({
        status: "error",
        error: {
          title: "القائمة فارغة",
          message: "اختر مجلة واحدة على الأقل من مجلات ورّاق.",
          detail: null,
          retryable: false,
        },
      });
      return;
    }
    setState({ status: "saving" });
    createJournalList({
      name: "مجلات مختارة من ورّاق",
      description: "مجلات اختيرت قبل رفع البحث من فهرس ورّاق.",
      journals: selected.map((journal) => ({
        journal_id: journal.journal_id,
        journal_name: journal.name,
        publisher: journal.publisher,
      })),
    }).then(
      (detail) => {
        storeSelection(detail);
        setCatalogJournals([]);
        setSelectedJournalIds([]);
        setState({ status: "idle" });
      },
      (error: unknown) => setState({ status: "error", error: describeError(error) }),
    );
  };

  const removeSelection = () => {
    clearApprovedJournalListSelection();
    setSelection(null);
    setCatalogJournals([]);
    setSelectedJournalIds([]);
    setState({ status: "idle" });
  };

  const isBusy = state.status === "loading-catalog" || state.status === "uploading" || state.status === "saving";

  return (
    <aside className="border border-rule bg-paper-raised px-5 py-4 text-sm">
      <h2 className="text-[17px] font-bold">لديك قائمة مجلات معتمدة؟</h2>
      <p className="mt-1 leading-7 text-body">
        يمكنك حصر توصيات ورّاق في قائمة مجلات جامعتك أو الجهة البحثية.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <label className="inline-flex h-10 cursor-pointer items-center border border-ink bg-ink px-4 text-sm font-semibold text-paper">
          رفع قائمة مجلات CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => {
              uploadCsv(event.currentTarget.files?.[0] ?? null);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <button
          type="button"
          onClick={loadKnownJournals}
          disabled={isBusy}
          className="h-10 border border-rule-strong px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:text-muted"
        >
          اختيار مجلات من ورّاق
        </button>
        <span className="inline-flex h-10 items-center border border-rule px-3 text-xs font-semibold text-muted">
          CSV فقط
        </span>
      </div>

      {state.status === "loading-catalog" && <p className="mt-3 text-muted">نحمّل المجلات الموجودة في ورّاق…</p>}
      {state.status === "uploading" && <p className="mt-3 text-muted">نعالج قائمة CSV…</p>}
      {state.status === "saving" && <p className="mt-3 text-muted">نحفظ القائمة المختارة…</p>}
      {state.status === "error" && (
        <p role="alert" className="mt-3 font-semibold text-terracotta-text">
          {state.error.title}
          {state.error.detail ? (
            <span className="ms-2 text-muted" dir="ltr">
              {state.error.detail}
            </span>
          ) : null}
        </p>
      )}

      {selection && (
        <div className="mt-4 border-t border-rule pt-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">القائمة النشطة: {selection.name}</p>
              <p className="mt-1 text-body">
                إجمالي المجلات {selection.journalCount} · المطابقة {selection.resolvedCount} · غير المطابقة{" "}
                {unresolvedTotal(selection)}
              </p>
              <p className="mt-1 text-xs text-muted">المجلات المطابقة فقط ستشارك في الترشيح لاحقًا.</p>
            </div>
            <button
              type="button"
              onClick={removeSelection}
              className="text-xs font-semibold text-ink underline underline-offset-4"
            >
              إزالة القائمة
            </button>
          </div>
        </div>
      )}

      {catalogJournals.length > 0 && (
        <div className="mt-4 border-t border-rule pt-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">اختر المجلات التي تريد اعتمادها</p>
            <button
              type="button"
              onClick={saveKnownJournalList}
              disabled={selectedJournalIds.length === 0 || isBusy}
              className="h-9 border border-ink bg-ink px-3 text-xs font-semibold text-paper disabled:cursor-not-allowed disabled:bg-rule-strong"
            >
              حفظ {selectedJournalIds.length} مجلة
            </button>
          </div>
          <div className="mt-3 grid max-h-56 gap-2 overflow-auto pe-2 md:grid-cols-2">
            {catalogJournals.map((journal) => (
              <label key={journal.journal_id} className="flex cursor-pointer gap-2 border border-rule bg-paper p-3">
                <input
                  type="checkbox"
                  checked={selectedJournalIds.includes(journal.journal_id)}
                  onChange={() => toggleJournal(journal.journal_id)}
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
    </aside>
  );
}
