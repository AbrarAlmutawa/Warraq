import type {
  EditorRange,
  ManuscriptDocument,
  RequirementResult,
  SelectedItem,
  SuggestionStatus,
  WarraqSuggestion,
} from "@/lib/workspace/types";

export type DecorationKind = "hard" | "soft" | "review";

export type WorkspaceDecoration = {
  range: EditorRange;
  kind: DecorationKind;
  target: SelectedItem;
  message: string;
  selected: boolean;
};

/* Only known spans are decorated; passed requirements get no inline decoration. */
export function buildDecorations(
  document: ManuscriptDocument,
  results: RequirementResult[],
  suggestions: WarraqSuggestion[],
  statuses: Record<string, SuggestionStatus>,
  selected: SelectedItem | null,
): WorkspaceDecoration[] {
  const decorations: WorkspaceDecoration[] = [];
  const isSelected = (target: SelectedItem) => selected?.type === target.type && selected.id === target.id;

  for (const result of results) {
    if (result.status === "passed" || !result.anchor) continue;
    const kind: DecorationKind = result.status === "failed" ? "hard" : "review";
    const target: SelectedItem = { type: "requirement", id: result.id };
    const prefix = kind === "hard" ? "✕ متطلب المجلة" : "◐ بحاجة إلى مراجعة";
    for (const range of document.anchors[result.anchor] ?? []) {
      decorations.push({ range, kind, target, message: `${prefix}: ${result.message}`, selected: isSelected(target) });
    }
  }

  for (const suggestion of suggestions) {
    if (statuses[suggestion.id] !== "pending") continue;
    const target: SelectedItem = { type: "suggestion", id: suggestion.id };
    for (const range of document.anchors[`suggestion:${suggestion.id}`] ?? []) {
      decorations.push({
        range,
        kind: "soft",
        target,
        message: `اقتراح من وَرَّاق: ${suggestion.title}`,
        selected: isSelected(target),
      });
    }
  }

  return decorations;
}