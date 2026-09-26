import type { ExtractionConfidence, OpenAccessModel, ScopeFit } from "@/lib/journals/types";
import { INDEX_OPTIONS } from "@/lib/preferences/options";

export const SCOPE_FIT: Record<ScopeFit, { label: string; level: number }> = {
  strong: { label: "توافق قوي مع نطاق البحث", level: 3 },
  good: { label: "توافق جيد", level: 2 },
  possible: { label: "توافق محتمل", level: 1 },
};

export const OPEN_ACCESS_SHORT: Record<OpenAccessModel, string> = {
  full: "كامل",
  hybrid: "هجينة",
  subscription: "غير متاح",
  unknown: "غير معروف",
};

export const OPEN_ACCESS_FULL: Record<OpenAccessModel, string> = {
  full: "وصول مفتوح كامل",
  hybrid: "هجينة - وصول مفتوح اختياري برسوم",
  subscription: "اشتراك - بلا وصول مفتوح",
  unknown: "غير معروف - تحقق من موقع المجلة",
};

export const CONFIDENCE: Record<ExtractionConfidence, { label: string; detail: string }> = {
  high: { label: "عالية", detail: "القيم مستخرجة من نص صريح في دليل المؤلفين." },
  medium: { label: "متوسطة", detail: "بعض القيم مستنتجة من صياغة عامة في الدليل." },
  low: { label: "منخفضة", detail: "يلزم التحقق من القيم يدويًا قبل الاعتماد عليها." },
};

/* Shown when a journal does not publish a value (APC, review time). */
export const NOT_PUBLISHED = "غير منشورة";

export function formatApc(usd: number | null): string {
  if (usd === null) return NOT_PUBLISHED;
  return usd === 0 ? "بلا رسوم" : `${usd.toLocaleString("en-US", { maximumFractionDigits: 2 })} دولار`;
}

export function formatReviewDays(days: number | null): string {
  return days === null ? NOT_PUBLISHED : `نحو ${days} يومًا`;
}

/* The matcher's 0–1 similarity, shown as published (two decimals). */
export function formatSimilarityScore(score: number): string {
  return score.toFixed(2);
}

/* Same normalization idea as the backend matcher: case, spaces and "-" do not matter. */
export function normalizeIndex(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/* Known indexes get their display label; any other index is shown as the backend sent it. */
export function indexLabels(indexes: readonly string[]): string[] {
  const labels: string[] = [];
  for (const raw of indexes) {
    const normalized = normalizeIndex(raw);
    const known = INDEX_OPTIONS.find((option) => option.value === normalized);
    const label = known ? known.label : raw.trim();
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels;
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