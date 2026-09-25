import type {
  ArticleType,
  ChoiceOption,
  JournalIndex,
  OpenAccessPreference,
} from "@/lib/preferences/types";

export const ARTICLE_TYPE_OPTIONS: ChoiceOption<ArticleType>[] = [
  { value: "original-research", label: "بحث أصيل" },
  { value: "review", label: "مراجعة علمية" },
  { value: "short-communication", label: "اتصال قصير" },
];

export const APC_OPTIONS: ChoiceOption<number | null>[] = [
  { value: 0, label: "مجانية فقط", summary: "بلا رسوم نشر" },
  { value: 1500, label: "حتى 1,500 دولار", summary: "رسوم حتى 1,500 دولار" },
  { value: 3000, label: "حتى 3,000 دولار", summary: "رسوم حتى 3,000 دولار" },
  { value: null, label: "لا يهم", summary: "الرسوم لا تهم" },
];

export const OPEN_ACCESS_OPTIONS: ChoiceOption<OpenAccessPreference>[] = [
  { value: "required", label: "مطلوب", summary: "الوصول المفتوح مطلوب" },
  { value: "preferred", label: "مفضّل", summary: "الوصول المفتوح مفضّل" },
  { value: "any", label: "لا يهم", summary: "الوصول المفتوح لا يهم" },
];

export const REVIEW_SPEED_OPTIONS: ChoiceOption<number | null>[] = [
  { value: 30, label: "أقل من 30 يومًا", summary: "مراجعة أقل من 30 يومًا" },
  { value: 60, label: "أقل من 60 يومًا", summary: "مراجعة أقل من 60 يومًا" },
  { value: null, label: "لا يهم", summary: "السرعة لا تهم" },
];

export const INDEX_OPTIONS: ChoiceOption<JournalIndex>[] = [
  { value: "scopus", label: "Scopus", latin: true },
  { value: "wos", label: "Web of Science", latin: true },
];

export function articleTypeLabel(value: ArticleType): string {
  return ARTICLE_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? "";
}