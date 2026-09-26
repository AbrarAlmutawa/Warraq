import type { Metadata } from "next";
import { JournalsFlow } from "@/components/journals/JournalsFlow";
import { JourneySteps } from "@/components/layout/JourneySteps";
import { SiteHeader } from "@/components/layout/SiteHeader";

export const metadata: Metadata = {
  title: "المجلات المقترحة لبحثك - وَرَّاق",
};

export default function JournalsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader aside={<JourneySteps current="journal" />} />
      {/* Interim until Phase 4: the workspace route is still the mock /workspace/demo. */}
      <JournalsFlow nextHref="/workspace/demo" />
    </div>
  );
}