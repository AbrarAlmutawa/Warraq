import type { Metadata } from "next";
import { JournalResults } from "@/components/journals/JournalResults";
import { JourneySteps } from "@/components/layout/JourneySteps";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { DEFAULT_JOURNAL_PREFERENCES } from "@/lib/mock-data/journal-preferences";
import { MOCK_JOURNAL_MATCHES } from "@/lib/mock-data/journal-matches";

export const metadata: Metadata = {
  title: "المجلات المقترحة لبحثك - وَرَّاق",
};

export default function JournalsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader aside={<JourneySteps current="journal" />} />
      <JournalResults
        matches={MOCK_JOURNAL_MATCHES}
        preferences={DEFAULT_JOURNAL_PREFERENCES}
        nextHref="/workspace/demo"
      />
    </div>
  );
}