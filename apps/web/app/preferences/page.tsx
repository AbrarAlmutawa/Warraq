import type { Metadata } from "next";
import { JourneySteps } from "@/components/layout/JourneySteps";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PreferencesFlow } from "@/components/preferences/PreferencesFlow";

export const metadata: Metadata = {
  title: "هذا ما فهمناه من بحثك - وَرَّاق",
};

export default function PreferencesPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader aside={<JourneySteps current="priorities" />} />
      <PreferencesFlow />
    </div>
  );
}