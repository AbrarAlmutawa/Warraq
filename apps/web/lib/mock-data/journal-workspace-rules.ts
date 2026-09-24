import type { JournalWorkspaceRules, StaticRequirement } from "@/lib/workspace/types";

/* Demo rules keyed by journalId from MOCK_JOURNAL_MATCHES. All journals and excerpts are fictional. */

function commonStaticRequirements(): StaticRequirement[] {
  return [
    { id: "language", label: "لغة البحث", requirement: "الإنجليزية", excerpt: "Manuscripts must be written in English." },
    { id: "article-type", label: "نوع المقال", requirement: "بحث أصيل", excerpt: "The journal accepts original research articles." },
    {
      id: "core-sections",
      label: "الأقسام الأساسية",
      requirement: "مقدمة، منهجية، نتائج، مناقشة",
      excerpt: "Articles should include Introduction, Methods, Results and Discussion sections.",
    },
    { id: "conflict-of-interest", label: "إقرار تعارض المصالح", requirement: "مطلوب", excerpt: "All authors must disclose any conflicts of interest." },
    { id: "funding", label: "بيان التمويل", requirement: "مطلوب", excerpt: "Please list all funding sources for the research." },
    { id: "ethics", label: "بيان الأخلاقيات", requirement: "مطلوب", excerpt: "Include an ethics statement where applicable." },
    { id: "tables", label: "عدد الجداول", requirement: "≤ 6 جداول", excerpt: "Articles may include up to 6 tables." },
    { id: "keywords", label: "الكلمات المفتاحية", requirement: "4–6 كلمات", excerpt: "Provide 4 to 6 keywords." },
    { id: "orcid", label: "معرّف ORCID للمؤلف المراسل", requirement: "مطلوب", excerpt: "The corresponding author must provide an ORCID iD." },
  ];
}

export const MOCK_JOURNAL_WORKSPACE_RULES: Record<string, JournalWorkspaceRules> = {
  jaas: {
    journalId: "jaas",
    defaultConfidence: "high",
    maxTitleWords: 15,
    maxAbstractWords: 250,
    maxWords: 9000,
    references: { min: 30, max: 60 },
    requiredCitationStyle: "IEEE",
    highlights: { min: 3, max: 5 },
    reviewItems: [
      {
        id: "jaas-figure-resolution",
        field: "figures",
        label: "دقة الأشكال",
        requirement: "≥ 300 dpi (مستنتج)",
        message: "تعذر التحقق من دقة الأشكال بشكل مؤكد",
        note: "الدليل يطلب «دقة كافية للطباعة» دون رقم صريح. تأكد من أن أشكالك بدقة 300 dpi على الأقل.",
        anchor: "figure-3",
        confidence: "medium",
        excerpt: "Figures should be supplied at a resolution sufficient for print reproduction.",
      },
    ],
    staticRequirements: commonStaticRequirements(),
    excerpts: {
      "title-length": "Titles should be concise and informative and must not exceed 15 words.",
      "abstract-length": "The abstract must not exceed 250 words.",
      "word-count": "Research articles should not exceed 9,000 words, excluding references.",
      "reference-count": "Research articles typically cite between 30 and 60 references.",
      "citation-style": "References must follow IEEE style, numbered in order of first citation.",
      highlights: "Highlights are mandatory: provide 3 to 5 bullet points, each with a maximum of 85 characters.",
    },
  },

  sfvr: {
    journalId: "sfvr",
    defaultConfidence: "high",
    maxTitleWords: 20,
    maxAbstractWords: 300,
    maxWords: 10000,
    references: { max: 50 },
    requiredCitationStyle: "APA",
    requiresDataAvailability: true,
    reviewItems: [
      {
        id: "sfvr-figure-limit",
        field: "figures",
        label: "عدد الأشكال",
        requirement: "غير محدد بوضوح",
        message: "تعذر التحقق من الحد الأقصى لعدد الأشكال بشكل مؤكد",
        note: "الدليل يطلب عددًا «معقولًا» من الأشكال دون حد صريح. راجع الأشكال الثمانية وأكّد أنها ضرورية.",
        anchor: "figure-3",
        confidence: "medium",
        excerpt: "Authors are encouraged to keep the number of figures and tables reasonable.",
      },
    ],
    staticRequirements: commonStaticRequirements(),
    excerpts: {
      "title-length": "Titles should not exceed 20 words.",
      "abstract-length": "Abstracts should be no longer than 300 words.",
      "word-count": "Manuscripts should not exceed 10,000 words.",
      "reference-count": "The reference list should not exceed 50 entries.",
      "citation-style": "References should follow APA style (7th edition).",
      "data-availability": "All research articles must include a Data Availability Statement.",
    },
  },

  car: {
    journalId: "car",
    defaultConfidence: "medium",
    maxTitleWords: 18,
    maxAbstractWords: 250,
    maxWords: 8000,
    references: { min: 35, max: 60 },
    requiredCitationStyle: "IEEE",
    requiredFormat: "latex",
    reviewItems: [],
    staticRequirements: commonStaticRequirements(),
    excerpts: {
      "title-length": "Titles are limited to 18 words.",
      "abstract-length": "Abstracts must not exceed 250 words.",
      "word-count": "Articles should not exceed 8,000 words.",
      "reference-count": "Articles should cite between 35 and 60 references.",
      "citation-style": "Use numbered IEEE-style references.",
      template: "Submissions must be prepared using the journal's LaTeX template.",
    },
  },

  dam: {
    journalId: "dam",
    defaultConfidence: "low",
    maxTitleWords: 16,
    maxAbstractWords: 200,
    maxWords: 5000,
    references: { max: 40 },
    requiredCitationStyle: "APA",
    reviewItems: [
      {
        id: "dam-word-limit-scope",
        field: "length",
        label: "احتساب طول البحث",
        requirement: "غير واضح إن كان يشمل المراجع",
        message: "تعذر التحقق مما إذا كان حد الكلمات يشمل المراجع",
        note: "الدليل يذكر حدًّا للكلمات دون توضيح ما يدخل فيه. راجع صفحة المجلة أو راسل المحرر.",
        confidence: "low",
        excerpt: "Manuscripts should not exceed 5,000 words.",
      },
    ],
    staticRequirements: commonStaticRequirements(),
    excerpts: {
      "title-length": "Keep titles to 16 words or fewer.",
      "abstract-length": "Abstracts must not exceed 200 words.",
      "word-count": "Manuscripts should not exceed 5,000 words.",
      "reference-count": "No more than 40 references are permitted.",
      "citation-style": "Use APA style for references.",
    },
  },
};