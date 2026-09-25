import type { JournalMatch } from "@/lib/journals/types";
import { MOCK_JOURNAL_MATCHES } from "@/lib/mock-data/journal-matches";
import { MOCK_JOURNAL_WORKSPACE_RULES } from "@/lib/mock-data/journal-workspace-rules";
import type { JournalWorkspaceRules } from "@/lib/workspace/types";

export const DEFAULT_WORKSPACE_JOURNAL_ID = "jaas";

function isWorkspaceJournalId(id: string): boolean {
  return MOCK_JOURNAL_MATCHES.some((match) => match.journalId === id) && id in MOCK_JOURNAL_WORKSPACE_RULES;
}

export function resolveWorkspaceJournalId(raw: string | string[] | undefined): string {
  const id = Array.isArray(raw) ? raw[0] : raw;
  return id && isWorkspaceJournalId(id) ? id : DEFAULT_WORKSPACE_JOURNAL_ID;
}

export function getWorkspaceJournal(journalId: string): JournalMatch {
  return (
    MOCK_JOURNAL_MATCHES.find((match) => match.journalId === journalId) ??
    MOCK_JOURNAL_MATCHES.find((match) => match.journalId === DEFAULT_WORKSPACE_JOURNAL_ID) ??
    MOCK_JOURNAL_MATCHES[0]
  );
}

export function getWorkspaceRules(journalId: string): JournalWorkspaceRules {
  return MOCK_JOURNAL_WORKSPACE_RULES[journalId] ?? MOCK_JOURNAL_WORKSPACE_RULES[DEFAULT_WORKSPACE_JOURNAL_ID];
}

export function getSwitchCandidates(currentJournalId: string): JournalMatch[] {
  return MOCK_JOURNAL_MATCHES.filter(
    (match) => match.journalId !== currentJournalId && isWorkspaceJournalId(match.journalId),
  );
}