import type { ApiParsedManuscript } from "@/lib/api-client";
import type { AnalysisStage } from "@/lib/analysis/types";

/*
 * The four rows of the analysis screen, built only from the real parse (POST /manuscripts/upload
 * or GET /manuscripts/{id}). Presentation only: counts are the backend's, unchanged.
 *
 * The backend exposes no citation style, topic or article type, so no stage claims them.
 */

/* ───────── Arabic counted nouns ───────── */

export type CountForms = {
  zero: string;
  one: string;
  two: string;
  /* 3-10: "3 أشكال" */
  few: string;
  /* 11+: "11 شكلًا" */
  many: string;
};

export function arabicCount(count: number, forms: CountForms): string {
  if (count === 0) return forms.zero;
  if (count === 1) return forms.one;
  if (count === 2) return forms.two;
  const lastTwo = count % 100;
  const noun = lastTwo >= 3 && lastTwo <= 10 ? forms.few : forms.many;
  return `${count.toLocaleString("en-US")} ${noun}`;
}

export const SECTIONS: CountForms = { zero: "بلا أقسام", one: "قسم واحد", two: "قسمان", few: "أقسام", many: "قسمًا" };
export const WORDS: CountForms = { zero: "بلا كلمات", one: "كلمة واحدة", two: "كلمتان", few: "كلمات", many: "كلمة" };
export const FIGURES: CountForms = { zero: "بلا أشكال", one: "شكل واحد", two: "شكلان", few: "أشكال", many: "شكلًا" };
export const TABLES: CountForms = { zero: "بلا جداول", one: "جدول واحد", two: "جدولان", few: "جداول", many: "جدولًا" };
export const REFERENCES: CountForms = { zero: "بلا مراجع", one: "مرجع واحد", two: "مرجعان", few: "مراجع", many: "مرجعًا" };
export const KEYWORDS: CountForms = {
  zero: "بلا كلمات مفتاحية",
  one: "كلمة مفتاحية واحدة",
  two: "كلمتان مفتاحيتان",
  few: "كلمات مفتاحية",
  many: "كلمة مفتاحية",
};

/* ───────── Stages ───────── */

export const ANALYSIS_STAGE_DEFINITIONS: ReadonlyArray<Pick<AnalysisStage, "id" | "label">> = [
  { id: "sections", label: "استخراج الأقسام وعدّ الكلمات" },
  { id: "figures", label: "قراءة الأشكال والجداول" },
  { id: "references", label: "قراءة المراجع" },
  { id: "title-keywords", label: "استخراج العنوان والكلمات المفتاحية" },
];

/* Stages with no results yet (used while the upload request is running). */
export function pendingAnalysisStages(): AnalysisStage[] {
  return ANALYSIS_STAGE_DEFINITIONS.map((stage) => ({ ...stage, result: "" }));
}

export function buildAnalysisStages(parsed: ApiParsedManuscript): AnalysisStage[] {
  const results: Record<string, string> = {
    sections: `${arabicCount(parsed.sections.length, SECTIONS)} · ${arabicCount(parsed.main_text_word_count, WORDS)}`,
    figures: `${arabicCount(parsed.figure_count, FIGURES)} · ${arabicCount(parsed.table_count, TABLES)}`,
    references: arabicCount(parsed.reference_count, REFERENCES),
    "title-keywords": arabicCount(parsed.keywords.length, KEYWORDS),
  };
  return ANALYSIS_STAGE_DEFINITIONS.map((stage) => ({ ...stage, result: results[stage.id] ?? "" }));
}