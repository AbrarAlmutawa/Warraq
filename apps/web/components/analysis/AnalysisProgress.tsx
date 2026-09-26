"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnalysisStageRow } from "@/components/analysis/AnalysisStageRow";
import { BookmarkMark } from "@/components/brand/BookmarkMark";
import {
  JOURNEY_ACTION_PRIMARY,
  JOURNEY_ACTION_SECONDARY,
  JourneyRecovery,
} from "@/components/feedback/JourneyRecovery";
import { buildAnalysisStages, pendingAnalysisStages } from "@/lib/analysis/stages";
import type { AnalysisStage, AnalysisStageStatus } from "@/lib/analysis/types";
import { getManuscript, isNotFound, type ApiParsedManuscript } from "@/lib/api-client";
import { describeError, type ErrorPresentation } from "@/lib/api-errors";
import { clearActiveUpload, getActiveUpload, retryActiveUpload } from "@/lib/manuscript-upload";
import { clearSession, readSession } from "@/lib/session";
import { formatFileSize } from "@/lib/upload";

type FileInfo = { name: string; sizeBytes: number };

type ViewState =
  /* First render (server and client): nothing is known yet. */
  | { status: "checking" }
  /* No upload in this tab and no stored session: nothing to show. */
  | { status: "no-session" }
  /* POST /manuscripts/upload is running. */
  | { status: "uploading"; file: FileInfo; isDemo: boolean }
  /* GET /manuscripts/{id} is running (refresh / revisit after a successful upload). */
  | { status: "restoring"; file: FileInfo; isDemo: boolean }
  | { status: "done"; file: FileInfo; isDemo: boolean; parsed: ApiParsedManuscript; fromCache: boolean }
  | {
      status: "error";
      error: ErrorPresentation;
      /* What the retry button repeats, if anything can be retried. */
      retry: "upload" | "restore" | null;
    };

type AnalysisProgressProps = {
  nextHref: string;
};

export function AnalysisProgress({ nextHref }: AnalysisProgressProps) {
  const [view, setView] = useState<ViewState>({ status: "checking" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const apply = (next: ViewState) => {
      if (!cancelled) setView(next);
    };

    // Browser-only reads (active upload, sessionStorage) happen after the first render,
    // so the server-rendered HTML and the first client render always match.
    void Promise.resolve().then(() => {
      const upload = getActiveUpload();
      if (upload) {
        const file = { name: upload.file.name, sizeBytes: upload.file.size };
        const isDemo = upload.isDemoManuscript;
        apply({ status: "uploading", file, isDemo });
        upload.promise.then(
          (response) =>
            apply({ status: "done", file, isDemo, parsed: response.parsed, fromCache: response.from_cache }),
          (error: unknown) => {
            const presentation = describeError(error, "upload");
            apply({ status: "error", error: presentation, retry: presentation.retryable ? "upload" : null });
          },
        );
        return;
      }

      const session = readSession();
      if (!session) {
        apply({ status: "no-session" });
        return;
      }

      const file = session.file;
      const isDemo = session.isDemoManuscript;
      apply({ status: "restoring", file, isDemo });
      getManuscript(session.manuscriptId).then(
        (record) => apply({ status: "done", file, isDemo, parsed: record.parsed, fromCache: false }),
        (error: unknown) => {
          // The stored id no longer exists on the server: this session cannot be recovered.
          if (isNotFound(error)) clearSession();
          const presentation = describeError(error, "manuscript");
          apply({ status: "error", error: presentation, retry: presentation.retryable ? "restore" : null });
        },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    if (view.status !== "error" || !view.retry) return;
    if (view.retry === "upload") retryActiveUpload();
    setView({ status: "checking" });
    setAttempt((current) => current + 1);
  };

  if (view.status === "no-session") {
    return (
      <div className="mt-16 w-full max-w-[680px] pb-16 lg:mt-24">
        <JourneyRecovery
          tone="notice"
          title="لا يوجد بحث قيد القراءة"
          message="ابدأ برفع بحثك بصيغة DOCX، أو جرّب البحث التجريبي من صفحة البداية."
        >
          <Link href="/" className={JOURNEY_ACTION_PRIMARY}>
            رفع بحث
            <span aria-hidden="true">←</span>
          </Link>
        </JourneyRecovery>
      </div>
    );
  }

  if (view.status === "error") {
    return (
      <div className="mt-16 w-full max-w-[680px] pb-16 lg:mt-24">
        <JourneyRecovery title={view.error.title} message={view.error.message} detail={view.error.detail}>
          {view.retry && (
            <button type="button" onClick={retry} className={JOURNEY_ACTION_PRIMARY}>
              إعادة المحاولة
            </button>
          )}
          <Link href="/" onClick={clearActiveUpload} className={JOURNEY_ACTION_SECONDARY}>
            العودة إلى رفع البحث
          </Link>
        </JourneyRecovery>
      </div>
    );
  }

  const isComplete = view.status === "done";
  const file = view.status === "checking" ? null : view.file;
  const isDemo = view.status !== "checking" && view.isDemo;
  const stages: AnalysisStage[] = isComplete ? buildAnalysisStages(view.parsed) : pendingAnalysisStages();
  const stageStatus: AnalysisStageStatus =
    view.status === "done" ? "done" : view.status === "uploading" ? "active" : "pending";

  return (
    <section aria-labelledby="analysis-heading" className="mt-16 w-full max-w-[680px] pb-16 lg:mt-24">
      <h1 id="analysis-heading" className="text-[34px] font-bold lg:text-[40px]">
        نقرأ بحثك
      </h1>

      <div className="mt-3.5 flex min-h-[30px] flex-wrap items-center gap-2.5 text-sm text-body">
        {file && (
          <>
            <BookmarkMark className="h-[30px] w-[10px] shrink-0 text-terracotta" />
            <span dir="ltr" className="font-latin">
              {file.name}
            </span>
            <span className="text-muted">· {formatFileSize(file.sizeBytes)}</span>
            {isDemo && (
              <span className="rounded-full border border-rule-strong px-3 py-[3px] text-xs text-muted">
                بحث تجريبي
              </span>
            )}
          </>
        )}
      </div>

      <ol aria-label="مراحل قراءة البحث" className="mt-10 border-t border-rule">
        {stages.map((stage) => (
          <AnalysisStageRow key={stage.id} stage={stage} status={stageStatus} />
        ))}
      </ol>

      <p className="mt-7 text-sm leading-[1.8] text-body">
        يتم هذا التحليل مرة واحدة فقط. إذا غيّرت المجلة لاحقًا، نعيد فحص المتطلبات دون إعادة قراءة البحث.
      </p>

      {view.status === "restoring" && (
        <p className="mt-3 text-sm text-muted">نسترجع نتيجة القراءة المحفوظة لهذا البحث…</p>
      )}

      {view.status === "done" && view.fromCache && (
        <p className="mt-3 text-sm text-muted">
          قرأ وَرَّاق هذا الملف نفسه من قبل، فأعاد استخدام نتيجة القراءة المحفوظة دون إعادة تحليله.
        </p>
      )}

      <div className="mt-7 h-12">
        {isComplete && (
          <Link
            href={nextHref}
            className="inline-flex h-12 items-center gap-2 rounded-[3px] bg-ink px-6 text-[15px] font-bold text-paper transition-[opacity,background-color] duration-300 hover:bg-ink/90 starting:opacity-0 motion-reduce:transition-none"
          >
            مراجعة ما فهمناه
            <span aria-hidden="true">←</span>
          </Link>
        )}
      </div>

      <p role="status" className="sr-only">
        {view.status === "uploading"
          ? "نقرأ بحثك الآن."
          : isComplete
            ? "اكتملت قراءة البحث. يمكنك الآن مراجعة ما فهمناه."
            : ""}
      </p>
    </section>
  );
}