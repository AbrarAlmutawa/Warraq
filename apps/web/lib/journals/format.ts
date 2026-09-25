import type { ExtractionConfidence, OpenAccessModel, ScopeFit } from "@/lib/journals/types";
import { INDEX_OPTIONS } from "@/lib/preferences/options";
import type { JournalIndex } from "@/lib/preferences/types";

export const SCOPE_FIT: Record<ScopeFit, { label: string; level: number }> = {
  strong: { label: "توافق قوي مع نطاق البحث", level: 3 },
  good: { label: "توافق جيد", level: 2 },
  possible: { label: "توافق محتمل", level: 1 },
};

export const OPEN_ACCESS_SHORT: Record<OpenAccessModel, string> = {
  full: "كامل",
  hybrid: "هجينة",
  subscription: "غير متاح",
};

export const OPEN_ACCESS_FULL: Record<OpenAccessModel, string> = {
  full: "وصول مفتوح كامل",
  hybrid: "هجينة - وصول مفتوح اختياري برسوم",
  subscription: "اشتراك - بلا وصول مفتوح",
};

export const CONFIDENCE: Record<ExtractionConfidence, { label: string; detail: string }> = {
  high: { label: "عالية", detail: "القيم مستخرجة من نص صريح في دليل المؤلفين." },
  medium: { label: "متوسطة", detail: "بعض القيم مستنتجة من صياغة عامة في الدليل." },
  low: { label: "منخفضة", detail: "يلزم التحقق من القيم يدويًا قبل الاعتماد عليها." },
};

export function formatApc(usd: number): string {
  return usd === 0 ? "بلا رسوم" : `${usd.toLocaleString("en-US")} دولار`;
}

export function formatReviewDays(days: number): string {
  return `نحو ${days} يومًا`;
}

export function indexLabels(indexes: JournalIndex[]): string[] {
  return INDEX_OPTIONS.filter((option) => indexes.includes(option.value)).map((option) => option.label);
}

const CHECKED_DATE = new Intl.DateTimeFormat("ar-u-ca-gregory-nu-latn", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatCheckedDate(isoDate: string): string {
  return CHECKED_DATE.format(new Date(`${isoDate}T00:00:00Z`));
}