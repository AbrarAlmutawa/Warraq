import type { Metadata } from "next";
import { AnalysisProgress } from "@/components/analysis/AnalysisProgress";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { MOCK_ANALYSIS_STAGES, MOCK_MANUSCRIPT_FILE } from "@/lib/mock-data/manuscript-analysis";

export const metadata: Metadata = {
  title: "نقرأ بحثك - وَرَّاق",
};

export default function AnalysisPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex flex-1 justify-center px-6">
        <AnalysisProgress
          file={MOCK_MANUSCRIPT_FILE}
          stages={MOCK_ANALYSIS_STAGES}
          nextHref="/preferences"
        />
      </main>
    </div>
  );
}