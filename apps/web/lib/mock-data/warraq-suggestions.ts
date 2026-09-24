import type { WarraqSuggestion } from "@/lib/workspace/types";

/* AI guidance (mock). Never journal policy; never applied without approval. */
export const WARRAQ_SUGGESTIONS: WarraqSuggestion[] = [
  {
    id: "abstract-opening",
    field: "abstract",
    label: "الملخص",
    title: "يمكن جعل مساهمة البحث أكثر وضوحًا في الجملة الافتتاحية.",
    rationale: "الجملة الحالية تصف مجال الدراسة ولا تذكر ما يضيفه البحث، والمحكّمون يقرؤون المساهمة أولًا.",
    target: { kind: "abstract" },
    before: "This study examines computer vision methods for plant disease recognition in agriculture.",
    after:
      "We show that plant diseases can be recognized directly on board low-cost drones using a lightweight computer vision model.",
  },
  {
    id: "discussion-field",
    field: "discussion",
    label: "المناقشة",
    title: "قد يكون من المفيد ربط النتائج بشكل أوضح بالتطبيق الميداني.",
    rationale: "الجملة الختامية عامة؛ ذكر ما يتيحه النموذج للمزارع في الحقل يوضّح أثر النتائج.",
    target: { kind: "section", sectionId: "discussion", paragraphIndex: 1 },
    before: "These findings suggest that lightweight models are promising for agriculture.",
    after:
      "Because the model runs on board the drone, farmers could receive disease alerts during a single field flight, without uploading images to the cloud.",
  },
  {
    id: "keywords-overlap",
    field: "keywords",
    label: "الكلمات المفتاحية",
    title: "يمكن تقليل التداخل بين بعض الكلمات المفتاحية.",
    rationale: "«Image classification» و«Image recognition» متقاربتان؛ الإبقاء على إحداهما أوضح للفهرسة.",
    target: { kind: "keywords" },
    before: "Computer vision; Smart agriculture; Deep learning; Image classification; Plant disease detection; Image recognition",
    after: "Computer vision; Smart agriculture; Deep learning; Image classification; Plant disease detection",
  },
];