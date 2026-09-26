import { requirementLabel, requirementMessage, type PresentedText } from "@/lib/workspace/requirement-labels";
import type { ReadinessSummary, RequirementStatus, WorkspaceRequirement } from "@/lib/workspace/types";

/*
 * Compares two BACKEND validation reports of the same parsed manuscript for two journals
 * (POST /validate), to explain what a journal switch changes.
 *
 * Presentation only: each rule's status, requirement and measured value are the backend's;
 * rules are grouped by rule_id, and the readiness numbers are the two backend summaries,
 * never recomputed here.
 */

export type JournalReport = {
  requirements: WorkspaceRequirement[];
  summary: ReadinessSummary;
};

export type ImpactItem = {
  key: string;
  symbol: string;
  label: PresentedText;
  /* Text segments; `latin` segments are backend values rendered LTR. */
  detail: PresentedText[];
  /* The rule already fails for the current journal too. */
  persists: boolean;
};

export type SwitchImpact = {
  becomesPassed: ImpactItem[];
  needsAttention: ImpactItem[];
  newRequirements: ImpactItem[];
  newReviews: ImpactItem[];
  changedRules: ImpactItem[];
  noLongerRequired: ImpactItem[];
  unchangedCount: number;
  current: ReadinessSummary;
  target: ReadinessSummary;
};

const SYMBOL: Record<RequirementStatus, string> = {
  failed: "✕",
  review: "◐",
  passed: "✓",
};

const arabic = (text: string): PresentedText => ({ text, latin: false });
const backend = (text: string): PresentedText => ({ text, latin: true });

function valueDetail(requirement: WorkspaceRequirement): PresentedText[] {
  const parts: PresentedText[] = [];
  if (requirement.measured) parts.push(backend(requirement.measured), arabic(" · "));
  parts.push(arabic("الشرط: "), backend(requirement.requirement));
  return parts;
}

export function compareReports(current: JournalReport, target: JournalReport): SwitchImpact {
  const currentById = new Map(current.requirements.map((requirement) => [requirement.ruleId, requirement]));
  const targetIds = new Set(target.requirements.map((requirement) => requirement.ruleId));

  const impact: SwitchImpact = {
    becomesPassed: [],
    needsAttention: [],
    newRequirements: [],
    newReviews: [],
    changedRules: [],
    noLongerRequired: [],
    unchangedCount: 0,
    current: current.summary,
    target: target.summary,
  };

  for (const next of target.requirements) {
    const previous = currentById.get(next.ruleId);
    const label = requirementLabel(next);

    if (!previous) {
      impact.newRequirements.push({
        key: next.ruleId,
        symbol: SYMBOL[next.status],
        label,
        detail: next.status === "passed" ? [arabic("مستوفى — "), backend(next.requirement)] : [requirementMessage(next)],
        persists: false,
      });
      continue;
    }

    if (next.status === "passed" && previous.status !== "passed") {
      impact.becomesPassed.push({ key: next.ruleId, symbol: SYMBOL.passed, label, detail: valueDetail(next), persists: false });
      continue;
    }

    if (next.status === "failed") {
      impact.needsAttention.push({
        key: next.ruleId,
        symbol: SYMBOL.failed,
        label,
        detail: [requirementMessage(next)],
        persists: previous.status === "failed",
      });
      continue;
    }

    if (next.status === "review") {
      if (previous.status !== "review") {
        impact.newReviews.push({
          key: next.ruleId,
          symbol: SYMBOL.review,
          label,
          detail: [requirementMessage(next)],
          persists: false,
        });
      } else {
        impact.unchangedCount += 1;
      }
      continue;
    }

    // Passed for both journals: only the stated requirement may differ.
    if (previous.requirement !== next.requirement) {
      impact.changedRules.push({
        key: next.ruleId,
        symbol: "↔",
        label,
        detail: [backend(previous.requirement), arabic(" ← "), backend(next.requirement)],
        persists: false,
      });
    } else {
      impact.unchangedCount += 1;
    }
  }

  for (const previous of current.requirements) {
    if (!targetIds.has(previous.ruleId)) {
      impact.noLongerRequired.push({
        key: previous.ruleId,
        symbol: "–",
        label: requirementLabel(previous),
        detail: [backend(previous.requirement)],
        persists: false,
      });
    }
  }

  return impact;
}

/* The citation style a journal requires, exactly as its backend citation_style rule states it. */
export function requiredCitationStyle(report: JournalReport): string | null {
  return report.requirements.find((requirement) => requirement.ruleId === "citation_style")?.requirement ?? null;
}