import type { PresentedText } from "@/lib/workspace/requirement-labels";
import type { WorkspaceSuggestedFix, WorkspaceSuggestion } from "@/lib/workspace/types";

/*
 * Presentation-only Arabic text for AI suggestions and checklist actions (decision D4).
 * Keyed by the backend's stable `kind` values. The suggestion's own title, rationale and
 * before/after text are the backend's (or the model's) and are shown unchanged elsewhere.
 * Unknown kinds fall back to the backend's English text.
 */

const arabic = (text: string): PresentedText => ({ text, latin: false });
const backend = (text: string): PresentedText => ({ text, latin: true });

const SUGGESTION_KIND_LABELS = new Map<string, string>([
  ["scope_fit", "ملاءمة نطاق المجلة"],
  ["shorten_title", "عنوان أقصر"],
  ["shorten_abstract", "ملخص أقصر"],
  ["draft_highlights", "مسودة النقاط البارزة"],
  ["draft_statement", "مسودة بيان"],
]);

const SUGGESTION_KIND_TITLES = new Map<string, string>([
  ["scope_fit", "رأي وَرَّاق في ملاءمة بحثك لنطاق هذه المجلة"],
  ["shorten_title", "صيغة أقصر للعنوان ضمن حدّ المجلة"],
  ["shorten_abstract", "صيغة أقصر للملخص ضمن حدّ المجلة"],
  ["draft_highlights", "مسودة نقاط بارزة مستخلصة من ملخصك"],
]);

export function suggestionLabel(suggestion: WorkspaceSuggestion): PresentedText {
  const label = suggestion.kind ? SUGGESTION_KIND_LABELS.get(suggestion.kind) : undefined;
  return label ? arabic(label) : backend(suggestion.backendLabel);
}

/* The card's main line: Arabic by kind; a drafted statement also names the statement (backend text). */
export function suggestionTitle(suggestion: WorkspaceSuggestion): PresentedText[] {
  if (suggestion.kind === "draft_statement") {
    return [arabic("مسودة بيان تطلبه المجلة: "), backend(suggestion.backendLabel)];
  }
  const title = suggestion.kind ? SUGGESTION_KIND_TITLES.get(suggestion.kind) : undefined;
  return title ? [arabic(title)] : [backend(suggestion.title)];
}

/* ───────── Checklist actions (suggested_fix) ───────── */

export type RequirementAction =
  /* Show the AI suggestion that helps with this rule (POST /suggestions). */
  | { type: "suggestion"; label: string }
  /* Show a citation-conversion proposal (POST /citations/convert). */
  | { type: "citations"; label: string };

const SUGGESTION_ACTION_LABELS = new Map<string, string>([
  ["shorten_title", "عرض اقتراح عنوان أقصر"],
  ["shorten_abstract", "عرض اقتراح ملخص أقصر"],
  ["insert_highlights", "عرض مسودة النقاط البارزة"],
  ["insert_statement", "عرض مسودة البيان"],
]);

/*
 * Only actions the backend supports get a button. Anything else (e.g. export_latex, which has no
 * endpoint) returns null and shows no button.
 */
export function requirementAction(fix: WorkspaceSuggestedFix | null): RequirementAction | null {
  if (!fix) return null;
  if (fix.kind === "convert_citations") {
    const style = fix.params.to_style?.trim();
    return {
      type: "citations",
      label: style ? `اقتراح تحويل المراجع إلى ${style.toUpperCase()}` : "اقتراح تحويل المراجع",
    };
  }
  const label = SUGGESTION_ACTION_LABELS.get(fix.kind);
  return label ? { type: "suggestion", label } : null;
}