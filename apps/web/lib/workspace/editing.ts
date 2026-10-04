import type { ManuscriptRevision, WorkspaceSuggestion } from "@/lib/workspace/types";

/*
 * Editing the manuscript (docs/editing.md).
 * The backend applies changes to the researcher's Word file and keeps each one as a revision;
 * this module only decides what to offer and how to label it in Arabic.
 */

/* Suggestion kinds the backend can apply to the text (POST .../apply-suggestion). */
const APPLICABLE_KINDS = new Set(["shorten_title", "shorten_abstract", "draft_highlights", "draft_statement"]);

export function isApplicable(suggestion: WorkspaceSuggestion): boolean {
  return suggestion.kind !== null && APPLICABLE_KINDS.has(suggestion.kind) && Boolean(suggestion.after?.trim());
}

/* AI drafts mark details they could not know as [placeholders] for the researcher to fill in. */
export function placeholdersIn(text: string | null): string[] {
  return text ? [...new Set(text.match(/\[[^\]\n]+\]/g) ?? [])] : [];
}

const STATEMENT_NAMES: Record<string, string> = {
  "data availability statement": "بيان إتاحة البيانات",
  "conflict of interest": "بيان تعارض المصالح",
  funding: "بيان التمويل",
  "ethics statement": "بيان الأخلاقيات",
};

/* Arabic label for a backend revision description (unknown descriptions are shown as they are). */
export function revisionLabel(revision: ManuscriptRevision): string {
  const text = revision.description.trim();
  const lower = text.toLowerCase();

  if (revision.revision === 0 || lower === "original upload") return "النسخة الأصلية";
  if (lower.startsWith("title shortened")) return "تقصير العنوان (اقتراح وَرَّاق)";
  if (lower.startsWith("abstract shortened")) return "تقصير الملخص (اقتراح وَرَّاق)";
  if (lower.startsWith("highlights added")) return "إضافة النقاط البارزة (اقتراح وَرَّاق)";
  if (lower.startsWith("title updated")) return "تعديل العنوان";
  if (lower.startsWith("abstract updated")) return "تعديل الملخص";
  if (lower.startsWith("edited paragraph")) return "تعديل فقرة";
  if (lower.startsWith("text edited")) return "تعديل مباشر في النص";
  if (lower.startsWith("references converted to ")) return `تحويل المراجع إلى ${text.slice(25).trim()}`;
  if (lower.startsWith("references replaced")) return "تحديث قائمة المراجع";

  const added = /^(.*) added \(ai suggestion\)$/i.exec(text);
  if (added) {
    const name = STATEMENT_NAMES[added[1].trim().toLowerCase()];
    return name ? `إضافة ${name} (اقتراح وَرَّاق)` : `إضافة ${added[1].trim()} (اقتراح وَرَّاق)`;
  }
  return text;
}
