"use client";

import Link from "next/link";
import { useState } from "react";
import { PrioritiesSection } from "@/components/preferences/PrioritiesSection";
import { UnderstandingSection } from "@/components/preferences/UnderstandingSection";
import { summarizePreferences } from "@/lib/preferences/summary";
import type { JournalPreferences, ManuscriptUnderstanding } from "@/lib/preferences/types";

type PreferencesFlowProps = {
  initialUnderstanding: ManuscriptUnderstanding;
  initialPreferences: JournalPreferences;
};

export function PreferencesFlow({ initialUnderstanding, initialPreferences }: PreferencesFlowProps) {
  const [understanding, setUnderstanding] = useState(initialUnderstanding);
  const [preferences, setPreferences] = useState(initialPreferences);

  return (
    <>
      <main className="flex flex-1 flex-col gap-10 px-6 pt-10 pb-12 lg:flex-row lg:gap-16 lg:px-[72px] lg:pt-11 lg:pb-10">
        <UnderstandingSection understanding={understanding} onChange={setUnderstanding} />
        <div aria-hidden="true" className="hidden w-px shrink-0 bg-rule lg:block" />
        <hr className="border-rule lg:hidden" />
        <PrioritiesSection preferences={preferences} onChange={setPreferences} />
      </main>

      <footer className="sticky bottom-0 z-10 flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3 border-t border-rule bg-paper px-6 py-4 lg:h-[88px] lg:flex-nowrap lg:px-[72px] lg:py-0">
        <p className="min-w-0 flex-1 basis-full text-sm leading-relaxed text-body lg:basis-auto">
          <span className="font-semibold text-ink">أولوياتك: </span>
          {summarizePreferences(preferences)}
        </p>
        <Link
          href="/analysis"
          className="text-sm text-muted underline underline-offset-4 hover:text-ink"
        >
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