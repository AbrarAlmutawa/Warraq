import type { RequirementStatus, WorkspaceRequirement } from "@/lib/workspace/types";

/*
 * Presentation-only Arabic text for backend requirement checks (decision D4).
 * Keyed by stable backend identifiers (rule_id, status); it never changes backend meaning.
 * Numbers and values are NOT restated here: the UI shows the backend's own `requirement` and
 * `measured` text next to these words. Unknown rules fall back to the backend's English text.
 */

export type PresentedText = {
  text: string;
  /** True when the text is the backend's own English (render LTR, Latin font) */
  latin: boolean;
};

const RULE_LABELS = new Map<string, string>([
  ["title_length", "طول العنوان"],
  ["abstract_length", "طول الملخص"],
  ["word_count", "طول النص الرئيسي"],
  ["table_count", "عدد الجداول"],
  ["figure_count", "عدد الأشكال"],
  ["reference_count", "عدد المراجع"],
  ["keyword_count", "عدد الكلمات المفتاحية"],
  ["citation_style", "أسلوب الاستشهاد"],
  ["template", "صيغة التقديم"],
  ["highlights", "النقاط البارزة (Highlights)"],
  ["page_count", "عدد الصفحات"],
]);

const STATEMENT_LABELS = new Map<string, string>([
  ["data_availability", "بيان إتاحة البيانات"],
  ["conflict_of_interest", "بيان تضارب المصالح"],
  ["funding", "بيان التمويل"],
  ["ethics", "بيان الأخلاقيات"],
]);

const SECTION_LABELS = new Map<string, string>([
  ["abstract", "الملخص"],
  ["introduction", "المقدمة"],
  ["methodology", "المنهجية"],
  ["results", "النتائج"],
  ["discussion", "المناقشة"],
  ["conclusion", "الخاتمة"],
  ["references", "المراجع"],
]);

/* Rules whose failure means "the measured value is outside the journal's limit or range". */
const LIMIT_RULES = new Set([
  "title_length",
  "abstract_length",
  "word_count",
  "table_count",
  "figure_count",
  "reference_count",
  "keyword_count",
]);

const STATEMENT_PREFIX = "statement:";
const SECTION_PREFIX = "section:";

function arabic(text: string): PresentedText {
  return { text, latin: false };
}

function backend(text: string): PresentedText {
  return { text, latin: true };
}

/* Whether this rule id is one Warraq has Arabic wording for. */
function isKnownRule(ruleId: string): boolean {
  if (RULE_LABELS.has(ruleId)) return true;
  if (ruleId.startsWith(STATEMENT_PREFIX)) return STATEMENT_LABELS.has(ruleId.slice(STATEMENT_PREFIX.length));
  if (ruleId.startsWith(SECTION_PREFIX)) return SECTION_LABELS.has(ruleId.slice(SECTION_PREFIX.length));
  return false;
}

export function requirementLabel(requirement: WorkspaceRequirement): PresentedText {
  const { ruleId } = requirement;
  const known = RULE_LABELS.get(ruleId);
  if (known) return arabic(known);

  if (ruleId.startsWith(STATEMENT_PREFIX)) {
    const statement = STATEMENT_LABELS.get(ruleId.slice(STATEMENT_PREFIX.length));
    if (statement) return arabic(statement);
  }

  if (ruleId.startsWith(SECTION_PREFIX)) {
    const section = SECTION_LABELS.get(ruleId.slice(SECTION_PREFIX.length));
    if (section) return arabic(`قسم ${section}`);
  }

  return backend(requirement.backendLabel);
}

export function requirementMessage(requirement: WorkspaceRequirement): PresentedText {
  const { ruleId, status } = requirement;
  if (!isKnownRule(ruleId)) return backend(requirement.backendMessage);

  if (status === "passed") return arabic("يطابق متطلب المجلة.");

  if (status === "failed") {
    if (LIMIT_RULES.has(ruleId)) return arabic("القيمة في بحثك خارج الحد الذي تطلبه المجلة.");
    if (ruleId === "citation_style") return arabic("أسلوب الاستشهاد في بحثك يختلف عن الأسلوب الذي تطلبه المجلة.");
    if (ruleId === "template") return arabic("صيغة الملف لا تطابق صيغة التقديم التي تطلبها المجلة.");
    if (ruleId === "highlights") return arabic("النقاط البارزة (Highlights) لا تطابق ما تطلبه المجلة.");
    if (ruleId.startsWith(STATEMENT_PREFIX)) return arabic("تطلب المجلة هذا البيان ولم يُعثر عليه في بحثك.");
    if (ruleId.startsWith(SECTION_PREFIX)) return arabic("تطلب المجلة هذا القسم ولم يُعثر عليه في بحثك.");
    return backend(requirement.backendMessage);
  }

  // status === "review": the check could not be completed automatically.
  if (ruleId === "page_count") {
    return arabic("لا يستطيع وَرَّاق قياس عدد الصفحات من ملف DOCX؛ تحقّق منه بعد تنسيق البحث وفق قالب المجلة.");
  }
  if (ruleId.startsWith(STATEMENT_PREFIX)) return arabic("يذكر بحثك هذا البيان دون قسم مستقل؛ راجِعه بنفسك.");
  return arabic("لم يتمكن وَرَّاق من التحقق من هذا المتطلب آليًا؛ راجِعه بنفسك.");
}

/* Prefix used in editor hover messages and anywhere a compact status marker is needed. */
export const REQUIREMENT_STATUS_PREFIX: Record<RequirementStatus, string> = {
  failed: "✕ متطلب المجلة",
  review: "◐ بحاجة إلى مراجعة",
  passed: "✓ مستوفى",
};