"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  JOURNEY_ACTION_PRIMARY,
  JOURNEY_ACTION_SECONDARY,
  JourneyRecovery,
} from "@/components/feedback/JourneyRecovery";
import { JournalResults } from "@/components/journals/JournalResults";
import { toApiMatchPreferences, toJournalMatch } from "@/lib/api-adapters";
import { isNotFound, matchJournals } from "@/lib/api-client";
import { describeError, type ErrorPresentation } from "@/lib/api-errors";
import type { JournalMatch } from "@/lib/journals/types";
import { summarizePreferences } from "@/lib/preferences/summary";
import type { ArticleType, JournalPreferences } from "@/lib/preferences/types";
import { clearSession, readSession, updateSession } from "@/lib/session";

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
      matches: JournalMatch[];
      preferences: JournalPreferences;
      articleType: ArticleType | null;
    }
  | { status: "error"; error: ErrorPresentation };

type JournalsFlowProps = {
  nextHref: string;
};

export function JournalsFlow({ nextHref }: JournalsFlowProps) {
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

      const preferences = session.preferences;
      const articleType = session.articleType;
      apply({ status: "matching" });

      matchJournals(session.manuscriptId, toApiMatchPreferences(preferences, articleType)).then(
        (views) => {
          if (cancelled) return;
          const matches = views.map(toJournalMatch);
          // The ranked ids of this successful match become the Switch Journal candidates.
          updateSession({ lastMatch: { journalIds: matches.map((match) => match.journalId) } });
          apply({ status: "ready", matches, preferences, articleType });
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
  }, [attempt]);

  const retry = () => {
    setLoad({ status: "checking" });
    setAttempt((current) => current + 1);
  };

  const recoveryFrame = (content: React.ReactNode) => (
    <main className="flex flex-1 justify-center px-6">
      <div className="mt-16 w-full max-w-[680px] pb-16 lg:mt-24">{content}</div>
    </main>
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

  if (load.status === "ready" && load.matches.length === 0) {
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
        <p role="status" className="mt-2 max-w-[680px] text-[14.5px] leading-relaxed text-muted">
          {load.status === "matching"
            ? "نبحث عن المجلات الأنسب لبحثك وأولوياتك… قد يستغرق أول بحث حتى دقيقة."
            : ""}
        </p>
      </main>
    );
  }

  return (
    <JournalResults
      matches={load.matches}
      preferences={load.preferences}
      articleType={load.articleType}
      nextHref={nextHref}
    />
  );
}