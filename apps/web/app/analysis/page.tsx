import type { Metadata } from "next";
import { AnalysisProgress } from "@/components/analysis/AnalysisProgress";
import { SiteHeader } from "@/components/layout/SiteHeader";

export const metadata: Metadata = {
  title: "نقرأ بحثك - وَرَّاق",
};

export default function AnalysisPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex flex-1 justify-center px-6">
        <AnalysisProgress nextHref="/preferences" />
      </main>
    </div>
  );
}