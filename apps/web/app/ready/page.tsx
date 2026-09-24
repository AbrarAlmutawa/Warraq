import type { Metadata } from "next";
import { JourneySteps } from "@/components/layout/JourneySteps";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ReadyView } from "@/components/ready/ReadyView";
import { getWorkspaceJournal, resolveWorkspaceJournalId } from "@/lib/workspace/journals";
import { buildReadyDemoState } from "@/lib/workspace/ready";

export const metadata: Metadata = {
  title: "جاهز للتقديم - وَرَّاق",
};

type ReadyPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReadyPage({ searchParams }: ReadyPageProps) {
  const params = await searchParams;
  const journalId = resolveWorkspaceJournalId(params.journal);
  const journal = getWorkspaceJournal(journalId);
  const state = buildReadyDemoState(journalId);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader aside={<JourneySteps current={state.summary.isFullyReady ? "ready" : "preparation"} />} />
      <ReadyView journal={journal} state={state} />
    </div>
  );
}