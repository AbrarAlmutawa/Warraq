import type { Metadata } from "next";
import { JourneySteps } from "@/components/layout/JourneySteps";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PreferencesFlow } from "@/components/preferences/PreferencesFlow";
// Phase 3 replaces these starting preferences with neutral defaults and real matching.
import { DEFAULT_JOURNAL_PREFERENCES } from "@/lib/mock-data/journal-preferences";

export const metadata: Metadata = {
  title: "هذا ما فهمناه من بحثك - وَرَّاق",
};

export default function PreferencesPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader aside={<JourneySteps current="priorities" />} />
      <PreferencesFlow initialPreferences={DEFAULT_JOURNAL_PREFERENCES} />
    </div>
  );
}