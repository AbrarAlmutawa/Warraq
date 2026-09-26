import { redirect } from "next/navigation";

/*
 * The old mock route. The real workspace lives at /workspace; this only forwards,
 * keeping the requested journal, and renders nothing itself.
 */

type WorkspaceDemoRedirectProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WorkspaceDemoRedirect({ searchParams }: WorkspaceDemoRedirectProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.journal) ? params.journal[0] : params.journal;
  const journalId = raw?.trim();
  redirect(journalId ? `/workspace?journal=${encodeURIComponent(journalId)}` : "/workspace");
}