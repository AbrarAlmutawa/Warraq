import { summarizeReadiness } from "@/lib/workspace/readiness";
import type { ReadinessSummary, RequirementResult, RequirementStatus } from "@/lib/workspace/types";

export type DiffItem = {
  id: string;
  label: string;
  detail: string;
  symbol: string;
  persists?: boolean;
};

export type ChangedRule = {
  id: string;
  label: string;
  from: string;
  to: string;
};

export type SwitchImpact = {
  becomesPassed: DiffItem[];
  needsAttention: DiffItem[];
  newRequirements: DiffItem[];
  newReviews: DiffItem[];
  changedRules: ChangedRule[];
  noLongerRequired: DiffItem[];
  unchangedCount: number;
  current: ReadinessSummary;
  candidate: ReadinessSummary;
};

const SYMBOL: Record<RequirementStatus, string> = {
  failed: "✕",
  review: "◐",
  passed: "✓",
};

/* Compares two evaluations of the SAME manuscript state against two journals' rules. */
export function diffValidation(current: RequirementResult[], candidate: RequirementResult[]): SwitchImpact {
  const currentById = new Map(current.map((result) => [result.id, result]));
  const candidateIds = new Set(candidate.map((result) => result.id));

  const impact: SwitchImpact = {
    becomesPassed: [],
    needsAttention: [],
    newRequirements: [],
    newReviews: [],
    changedRules: [],
    noLongerRequired: [],
    unchangedCount: 0,
    current: summarizeReadiness(current),
    candidate: summarizeReadiness(candidate),
  };

  for (const next of candidate) {
    const previous = currentById.get(next.id);

    if (!previous) {
      impact.newRequirements.push({
        id: next.id,
        label: next.label,
        detail: next.status === "passed" ? `مستوفى - ${next.requirement}` : next.message,
        symbol: SYMBOL[next.status],
      });
      continue;
    }

    if (next.status === "passed" && previous.status !== "passed") {
      impact.becomesPassed.push({
        id: next.id,
        label: next.label,
        detail: `${next.measured ? `${next.measured} · ` : ""}الشرط: ${next.requirement}`,
        symbol: SYMBOL.passed,
      });
      continue;
    }

    if (next.status === "failed") {
      impact.needsAttention.push({
        id: next.id,
        label: next.label,
        detail: next.message,
        symbol: SYMBOL.failed,
        persists: previous.status === "failed",
      });
      continue;
    }

    if (next.status === "review") {
      if (previous.status !== "review") {
        impact.newReviews.push({ id: next.id, label: next.label, detail: next.message, symbol: SYMBOL.review });
      } else {
        impact.unchangedCount += 1;
      }
      continue;
    }

    if (previous.requirement !== next.requirement) {
      impact.changedRules.push({ id: next.id, label: next.label, from: previous.requirement, to: next.requirement });
    } else {
      impact.unchangedCount += 1;
    }
  }

  for (const previous of current) {
    if (!candidateIds.has(previous.id)) {
      impact.noLongerRequired.push({
        id: previous.id,
        label: previous.label,
        detail: previous.requirement,
        symbol: "–",
      });
    }
  }

  return impact;
}