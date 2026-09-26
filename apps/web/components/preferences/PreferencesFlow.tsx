"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  JOURNEY_ACTION_PRIMARY,
  JOURNEY_ACTION_SECONDARY,
  JourneyRecovery,
} from "@/components/feedback/JourneyRecovery";
import { PrioritiesSection } from "@/components/preferences/PrioritiesSection";
import { UnderstandingSection } from "@/components/preferences/UnderstandingSection";
import { toManuscriptUnderstanding } from "@/lib/api-adapters";
import { getManuscript, isNotFound } from "@/lib/api-client";
import { describeError, type ErrorPresentation } from "@/lib/api-errors";
import { summarizePreferences } from "@/lib/preferences/summary";
import type { JournalPreferences, ManuscriptUnderstanding } from "@/lib/preferences/types";
import { clearSession, readSession } from "@/lib/session";

type LoadState =
  /* First render (server and client): nothing is known yet. */
  | { status: "checking" }
  /* No stored journey in this tab. */
  | { status: "no-session" }
  /* GET /manuscripts/{id} is running. */
  | { status: "loading" }
  | { status: "ready"; understanding: ManuscriptUnderstanding; isDemoManuscript: boolean }
  | { status: "error"; error: ErrorPresentation };

type PreferencesFlowProps = {
  initialPreferences: JournalPreferences;
};

export function PreferencesFlow({ initialPreferences }: PreferencesFlowProps) {
  const [load, setLoad] = useState<LoadState>({ status: "checking" });
  const [attempt, setAttempt] = useState(0);
  const [preferences, setPreferences] = useState(initialPreferences);

  useEffect(() => {
    let cancelled = false;
    const apply = (next: LoadState) => {
      if (!cancelled) setLoad(next);
    };

    // Browser-only reads happen after the first render so server and client HTML match.
    void Promise.resolve().then(() => {
      const session = readSession();
      if (!session) {
        apply({ status: "no-session" });
        return;
      }
      apply({ status: "loading" });
      getManuscript(session.manuscriptId).then(
        (record) =>
          apply({
            status: "ready",
            understanding: toManuscriptUnderstanding(record.parsed),
            isDemoManuscript: session.isDemoManuscript,
          }),
        (error: unknown) => {
          // The stored id no longer exists on the server: this session cannot be recovered.
          if (isNotFound(error)) clearSession();
          apply({ status: "error", error: describeError(error, "manuscript") });
        },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = () => {
    setLoad({ status: "checking" });
    setAttempt((current) => current + 1);
  };

  if (load.status === "no-session") {
    return (
      <main className="flex flex-1 justify-center px-6">
        <div className="mt-16 w-full max-w-[680px] pb-16 lg:mt-24">
          <JourneyRecovery
            tone="notice"
            title="لا يوجد بحث لعرض ما فهمناه منه"
            message="ارفع بحثك بصيغة DOCX أولًا، أو جرّب البحث التجريبي من صفحة البداية."
          >
            <Link href="/" className={JOURNEY_ACTION_PRIMARY}>
              رفع بحث
              <span aria-hidden="true">←</span>
            </Link>
          </JourneyRecovery>
        </div>
      </main>
    );
  }

  if (load.status === "error") {
    return (
      <main className="flex flex-1 justify-center px-6">
        <div className="mt-16 w-full max-w-[680px] pb-16 lg:mt-24">
          <JourneyRecovery title={load.error.title} message={load.error.message} detail={load.error.detail}>
            {load.error.retryable ? (
              <>
                <button type="button" onClick={retry} className={JOURNEY_ACTION_PRIMARY}>
                  إعادة المحاولة
                </button>
                <Link href="/" className={JOURNEY_ACTION_SECONDARY}>
                  العودة إلى رفع البحث
                </Link>
              </>
            ) : (
              <Link href="/" className={JOURNEY_ACTION_PRIMARY}>
                رفع البحث من جديد
                <span aria-hidden="true">←</span>
              </Link>
            )}
          </JourneyRecovery>
        </div>
      </main>
    );
  }

  if (load.status !== "ready") {
    return (
      <main className="flex flex-1 flex-col gap-10 px-6 pt-10 pb-12 lg:px-[72px] lg:pt-11 lg:pb-10">
        <section aria-labelledby="understanding-heading" aria-busy="true" className="min-w-0 flex-1">
          <h1 id="understanding-heading" className="text-[30px] font-bold">
            هذا ما فهمناه من بحثك
          </h1>
          <p role="status" className="mt-2 text-[14.5px] leading-relaxed text-muted">
            {load.status === "loading" ? "نسترجع ما قرأه وَرَّاق من بحثك…" : ""}
          </p>
        </section>
      </main>
    );
  }

  return (
    <>
      <main className="flex flex-1 flex-col gap-10 px-6 pt-10 pb-12 lg:flex-row lg:gap-16 lg:px-[72px] lg:pt-11 lg:pb-10">
        <UnderstandingSection understanding={load.understanding} isDemoManuscript={load.isDemoManuscript} />
        <div aria-hidden="true" className="hidden w-px shrink-0 bg-rule lg:block" />
        <hr className="border-rule lg:hidden" />
        <PrioritiesSection preferences={preferences} onChange={setPreferences} />
      </main>

      <footer className="sticky bottom-0 z-10 flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3 border-t border-rule bg-paper px-6 py-4 lg:h-[88px] lg:flex-nowrap lg:px-[72px] lg:py-0">
        <p className="min-w-0 flex-1 basis-full text-sm leading-relaxed text-body lg:basis-auto">
          <span className="font-semibold text-ink">أولوياتك: </span>
          {summarizePreferences(preferences)}
        </p>
        <Link href="/analysis" className="text-sm text-muted underline underline-offset-4 hover:text-ink">
          العودة إلى التحليل
        </Link>
        <Link
          href="/journals"
          className="inline-flex h-12 items-center gap-2 rounded-[3px] bg-ink px-6 text-[15px] font-bold text-paper hover:bg-ink/90"
        >
          اقتراح المجلات
          <span aria-hidden="true">←</span>
        </Link>
      </footer>
    </>
  );
}