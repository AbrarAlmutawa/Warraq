import type { AnalysisStage, ManuscriptFileSummary } from "@/lib/analysis/types";

export type MockAnalysisStage = AnalysisStage & {
  durationMs: number;
};

export const MOCK_MANUSCRIPT_FILE: ManuscriptFileSummary = {
  fileName: "PalmNet-Lite_manuscript_v4.docx",
  fileSizeLabel: "2.1 ميغابايت",
};

/* Total ≈ 3.2 seconds */
export const MOCK_ANALYSIS_STAGES: MockAnalysisStage[] = [
  {
    id: "sections",
    label: "استخراج الأقسام وعدّ الكلمات",
    result: "10 أقسام · 7,850 كلمة",
    durationMs: 700,
  },
  {
    id: "figures",
    label: "قراءة الأشكال والجداول",
    result: "8 أشكال · 4 جداول",
    durationMs: 800,
  },
  {
    id: "references",
    label: "قراءة المراجع وأسلوب الاستشهاد",
    result: "45 مرجعًا · APA",
    durationMs: 800,
  },
  {
    id: "topic",
    label: "تحديد موضوع البحث ونوع المقال",
    result: "بحث أصيل · الرؤية الحاسوبية في الزراعة",
    durationMs: 900,
  },
];