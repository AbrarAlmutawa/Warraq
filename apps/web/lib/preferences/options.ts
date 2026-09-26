import type {
  ArticleType,
  ChoiceOption,
  JournalIndex,
  OpenAccessPreference,
} from "@/lib/preferences/types";

/* Researcher-selected; null = no article-type filter. */
export const ARTICLE_TYPE_OPTIONS: ChoiceOption<ArticleType | null>[] = [
  { value: "original-research", label: "بحث أصيل", summary: "نوع المقال: بحث أصيل" },
  { value: "review", label: "مراجعة علمية", summary: "نوع المقال: مراجعة علمية" },
  { value: "short-communication", label: "اتصال قصير", summary: "نوع المقال: اتصال قصير" },
  { value: null, label: "لا يهم", summary: "نوع المقال لا يهم" },
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

/* The matcher keeps journals whose average review time is at most this many days. */
export const REVIEW_SPEED_OPTIONS: ChoiceOption<number | null>[] = [
  { value: 30, label: "30 يومًا أو أقل", summary: "مراجعة خلال 30 يومًا أو أقل" },
  { value: 60, label: "60 يومًا أو أقل", summary: "مراجعة خلال 60 يومًا أو أقل" },
  { value: null, label: "لا يهم", summary: "السرعة لا تهم" },
];

export const INDEX_OPTIONS: ChoiceOption<JournalIndex>[] = [
  { value: "scopus", label: "Scopus", latin: true },
  { value: "wos", label: "Web of Science", latin: true },
];