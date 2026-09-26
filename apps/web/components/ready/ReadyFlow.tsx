"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  JOURNEY_ACTION_PRIMARY,
  JOURNEY_ACTION_SECONDARY,
  JourneyRecovery,
} from "@/components/feedback/JourneyRecovery";
import { JourneySteps } from "@/components/layout/JourneySteps";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ReadyView, type ReadyManuscript } from "@/components/ready/ReadyView";
import { toJournalSummary, toWorkspaceReadiness, toWorkspaceRequirement } from "@/lib/api-adapters";
import { getManuscript, isNotFound, listJournals, validateManuscript } from "@/lib/api-client";
import { describeError, type ErrorPresentation } from "@/lib/api-errors";
import type { JournalSummary } from "@/lib/journals/types";
import { clearSession, readSession } from "@/lib/session";
import type { ReadinessSummary, WorkspaceRequirement } from "@/lib/workspace/types";

type LoadState =
  /* First render (server and client): nothing is known yet. */
  | { status: "checking" }
  /* No stored journey in this tab. */
  | { status: "no-session" }
  /* /ready opened without ?journal= */
  | { status: "no-journal" }
  /* The requested journal is not in the backend's journal list (or /validate says it does not exist). */
  | { status: "journal-missing" }
  /* GET /manuscripts/{id}, GET /journals and POST /validate are running. */
  | { status: "loading" }
  | {
      status: "ready";
      journal: JournalSummary;
      manuscript: ReadyManuscript;
      requirements: WorkspaceRequirement[];
      summary: ReadinessSummary;
      isDemoManuscript: boolean;
    }
  | { status: "error"; error: ErrorPresentation; manuscriptGone: boolean };

type ReadyFlowProps = {
  journalId: string | null;
};

/*
 * The submission-readiness page. Readiness comes only from POST /validate for the stored
 * manuscript_id and the journal in the URL: nothing is uploaded, re-parsed, matched or edited,
 * and a ready state is never constructed on the frontend.
 */
export function ReadyFlow({ journalId }: ReadyFlowProps) {
  const [load, setLoad] = useState<LoadState>({ status: "checking" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const apply = (next: LoadState) => {
      if (!cancelled) setLoad(next);
    };

    // Browser-only reads happen after the first render so server and client HTML match.
    void Promise.resolve().then(() => {
      // In development StrictMode runs this effect twice; the first run is already cancelled
      // here, so each request is sent exactly once per visit.
      if (cancelled) return;

      const session = readSession();
      if (!session) {
        apply({ status: "no-session" });
        return;
      }
      if (!journalId) {
        apply({ status: "no-journal" });
        return;
      }

      const manuscriptId = session.manuscriptId;
      const isDemoManuscript = session.isDemoManuscript;
      apply({ status: "loading" });

      void Promise.allSettled([
        getManuscript(manuscriptId),
        listJournals(),
        validateManuscript(manuscriptId, journalId),
      ]).then(([manuscriptResult, journalsResult, reportResult]) => {
        if (manuscriptResult.status === "rejected") {
          const gone = isNotFound(manuscriptResult.reason);
          // The stored id no longer exists on the server: this session cannot be recovered.
          if (gone) clearSession();
          apply({ status: "error", error: describeError(manuscriptResult.reason, "manuscript"), manuscriptGone: gone });
          return;
        }

        if (journalsResult.status === "rejected") {
          apply({ status: "error", error: describeError(journalsResult.reason), manuscriptGone: false });
          return;
        }

        const journalView = journalsResult.value.find((journal) => journal.journal_id === journalId);
        if (!journalView) {
          apply({ status: "journal-missing" });
          return;
        }

        if (reportResult.status === "rejected") {
          if (isNotFound(reportResult.reason)) {
            apply({ status: "journal-missing" });
            return;
          }
          apply({ status: "error", error: describeError(reportResult.reason), manuscriptGone: false });
          return;
        }

        const parsed = manuscriptResult.value.parsed;
        const report = reportResult.value;
        const requirements = (report.results ?? []).map(toWorkspaceRequirement);

        apply({
          status: "ready",
          journal: toJournalSummary(journalView),
          manuscript: {
            title: parsed.title.trim(),
            mainTextWordCount: parsed.main_text_word_count,
            referenceCount: parsed.reference_count,
            figureCount: parsed.figure_count,
            tableCount: parsed.table_count,
            citationStyle:
              requirements.find((requirement) => requirement.ruleId === "citation_style")?.measured ?? null,
          },
          requirements,
          // The only readiness authority: the backend summary, unchanged.
          summary: toWorkspaceReadiness(report.summary),
          isDemoManuscript,
        });
      });
    });

    return () => {
      cancelled = true;
    };
  }, [journalId, attempt]);

  const retry = () => {
    setLoad({ status: "checking" });
    setAttempt((current) => current + 1);
  };

  const isReady = load.status === "ready" && load.summary.isFullyReady;
  const header = <SiteHeader aside={<JourneySteps current={isReady ? "ready" : "preparation"} />} />;

  const recoveryFrame = (content: ReactNode) => (
    <>
      {header}
      <main className="flex flex-1 justify-center px-6">
        <div className="mt-16 w-full max-w-[680px] pb-16 lg:mt-24">{content}</div>
      </main>
    </>
  );

  if (load.status === "no-session") {
    return recoveryFrame(
      <JourneyRecovery
        tone="notice"
        title="لا يوجد بحث لعرض جاهزيته"
        message="ارفع بحثك بصيغة DOCX أولًا، أو جرّب البحث التجريبي من صفحة البداية."
      >
        <Link href="/" className={JOURNEY_ACTION_PRIMARY}>
          رفع بحث
          <span aria-hidden="true">←</span>
        </Link>
      </JourneyRecovery>,
    );
  }

  if (load.status === "no-journal") {
    return recoveryFrame(
      <JourneyRecovery
        tone="notice"
        title="اختر مجلة أولًا"
        message="تُحسب جاهزية التقديم وفق متطلبات مجلة محددة. اختر مجلة من المجلات المقترحة لبحثك."
      >
        <Link href="/journals" className={JOURNEY_ACTION_PRIMARY}>
          المجلات المقترحة
          <span aria-hidden="true">←</span>
        </Link>
      </JourneyRecovery>,
    );
  }

  if (load.status === "journal-missing") {
    return recoveryFrame(
      <JourneyRecovery
        tone="notice"
        title="هذه المجلة غير متاحة"
        message="لم نجد المجلة المطلوبة في قائمة وَرَّاق. اختر مجلة من المجلات المقترحة لبحثك."
      >
        <Link href="/journals" className={JOURNEY_ACTION_PRIMARY}>
          المجلات المقترحة
          <span aria-hidden="true">←</span>
        </Link>
      </JourneyRecovery>,
    );
  }

  if (load.status === "error") {
    const backHref = journalId ? `/workspace?journal=${encodeURIComponent(journalId)}` : "/journals";
    return recoveryFrame(
      <JourneyRecovery title={load.error.title} message={load.error.message} detail={load.error.detail}>
        {load.error.retryable && !load.manuscriptGone ? (
          <>
            <button type="button" onClick={retry} className={JOURNEY_ACTION_PRIMARY}>
              إعادة المحاولة
            </button>
            <Link href={backHref} className={JOURNEY_ACTION_SECONDARY}>
              العودة إلى مساحة التجهيز
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

  if (load.status !== "ready") {
    return (
      <>
        {header}
        <main className="flex flex-1 items-center justify-center px-6" aria-busy="true">
          <p role="status" className="text-sm text-muted">
            {load.status === "loading" ? "نتحقق من جاهزية بحثك لهذه المجلة…" : ""}
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      {header}
      <ReadyView
        journal={load.journal}
        manuscript={load.manuscript}
        requirements={load.requirements}
        summary={load.summary}
        isDemoManuscript={load.isDemoManuscript}
      />
    </>
  );
}