import type { Metadata } from "next";
import { JourneySteps } from "@/components/layout/JourneySteps";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { WorkspaceFlow } from "@/components/workspace/WorkspaceFlow";

export const metadata: Metadata = {
  title: "مساحة التجهيز - وَرَّاق",
};

type WorkspacePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WorkspacePage({ searchParams }: WorkspacePageProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.journal) ? params.journal[0] : params.journal;
  const journalId = raw?.trim() || null;

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      <SiteHeader aside={<JourneySteps current="preparation" />} />
      <WorkspaceFlow key={journalId ?? "no-journal"} journalId={journalId} />
    </div>
  );
}