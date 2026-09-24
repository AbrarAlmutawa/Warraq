import type { Metadata } from "next";
import { JourneySteps } from "@/components/layout/JourneySteps";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { resolveWorkspaceJournalId } from "@/lib/workspace/journals";

export const metadata: Metadata = {
  title: "مساحة التجهيز - وَرَّاق",
};

type WorkspaceDemoPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WorkspaceDemoPage({ searchParams }: WorkspaceDemoPageProps) {
  const params = await searchParams;
  const initialJournalId = resolveWorkspaceJournalId(params.journal);

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      <SiteHeader aside={<JourneySteps current="preparation" />} />
      <WorkspaceShell key={initialJournalId} initialJournalId={initialJournalId} />
    </div>
  );
}