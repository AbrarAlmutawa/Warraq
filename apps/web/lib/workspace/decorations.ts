import { REQUIREMENT_STATUS_PREFIX, requirementLabel } from "@/lib/workspace/requirement-labels";
import type { BlockDocument, EditorRange, SelectedItem, WorkspaceRequirement } from "@/lib/workspace/types";

export type DecorationKind = "hard" | "soft" | "review";

export type WorkspaceDecoration = {
  range: EditorRange;
  kind: DecorationKind;
  target: SelectedItem;
  message: string;
  selected: boolean;
};

/*
 * Editor ranges of a requirement's block_ids that exist in the document.
 * Ids the document does not contain are ignored; an empty result means "no place in the text".
 */
export function requirementRanges(document: BlockDocument, requirement: WorkspaceRequirement): EditorRange[] {
  const ranges: EditorRange[] = [];
  for (const blockId of requirement.blockIds) {
    const range = document.blockRanges.get(blockId);
    if (range) ranges.push(range);
  }
  return ranges;
}

/*
 * Backend status → existing decoration styles: failed = hard, review = review, passed = none.
 * Only block_ids present in the document are decorated.
 */
export function buildRequirementDecorations(
  document: BlockDocument,
  requirements: WorkspaceRequirement[],
  selected: SelectedItem | null,
): WorkspaceDecoration[] {
  const decorations: WorkspaceDecoration[] = [];

  for (const requirement of requirements) {
    if (requirement.status === "passed") continue;
    const kind: DecorationKind = requirement.status === "failed" ? "hard" : "review";
    const target: SelectedItem = { type: "requirement", id: requirement.ruleId };
    const isSelected = selected?.type === "requirement" && selected.id === requirement.ruleId;
    const message = `${REQUIREMENT_STATUS_PREFIX[requirement.status]}: ${requirementLabel(requirement).text}`;

    for (const range of requirementRanges(document, requirement)) {
      decorations.push({ range, kind, target, message, selected: isSelected });
    }
  }

  return decorations;
}