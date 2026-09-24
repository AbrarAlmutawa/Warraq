import type { Metadata } from "next";
import { JourneySteps } from "@/components/layout/JourneySteps";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PreferencesFlow } from "@/components/preferences/PreferencesFlow";
import { DEFAULT_JOURNAL_PREFERENCES } from "@/lib/mock-data/journal-preferences";
import { MOCK_MANUSCRIPT_UNDERSTANDING } from "@/lib/mock-data/manuscript-understanding";

export const metadata: Metadata = {
  title: "هذا ما فهمناه من بحثك — وَرَّاق",
};

export default function PreferencesPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader aside={<JourneySteps current="priorities" />} />
      <PreferencesFlow
        initialUnderstanding={MOCK_MANUSCRIPT_UNDERSTANDING}
        initialPreferences={DEFAULT_JOURNAL_PREFERENCES}
      />
    </div>
  );
}