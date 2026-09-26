import type { Metadata } from "next";
import { ReadyFlow } from "@/components/ready/ReadyFlow";

export const metadata: Metadata = {
  title: "جاهزية التقديم - وَرَّاق",
};

type ReadyPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReadyPage({ searchParams }: ReadyPageProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.journal) ? params.journal[0] : params.journal;
  const journalId = raw?.trim() || null;

  return (
    <div className="flex min-h-dvh flex-col">
      <ReadyFlow key={journalId ?? "no-journal"} journalId={journalId} />
    </div>
  );
}