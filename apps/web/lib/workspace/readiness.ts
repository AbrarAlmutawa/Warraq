import type { ReadinessSummary, RequirementResult } from "@/lib/workspace/types";

export function summarizeReadiness(results: RequirementResult[]): ReadinessSummary {
  const hardErrorCount = results.filter((result) => result.status === "failed").length;
  const reviewCount = results.filter((result) => result.status === "review").length;
  const passedCount = results.filter((result) => result.status === "passed").length;
  return {
    hardErrorCount,
    reviewCount,
    passedCount,
    total: results.length,
    meetsHardRequirements: hardErrorCount === 0,
    isFullyReady: hardErrorCount === 0 && reviewCount === 0,
  };
}

export function hardErrorsPhrase(count: number): string {
  if (count === 1) return "متطلب إلزامي واحد";
  if (count === 2) return "متطلبان إلزاميان";
  if (count <= 10) return `${count} متطلبات إلزامية`;
  return `${count} متطلبًا إلزاميًا`;
}

export function reviewPhrase(count: number): string {
  if (count === 1) return "يوجد بند يحتاج مراجعتك";
  if (count === 2) return "يوجد بندان يحتاجان مراجعتك";
  return `توجد ${count} بنود تحتاج مراجعتك`;
}

export function problemsPhrase(count: number): string {
  if (count === 0) return "لا مشكلات إلزامية";
  if (count === 1) return "مشكلة واحدة";
  if (count === 2) return "مشكلتان";
  if (count <= 10) return `${count} مشكلات`;
  return `${count} مشكلة`;
}

export type ReadinessStatus = {
  tone: "blocked" | "review" | "ready";
  text: string;
};

export function readinessStatus(summary: ReadinessSummary): ReadinessStatus {
  if (summary.hardErrorCount > 0) {
    return { tone: "blocked", text: `غير جاهز بعد — ${hardErrorsPhrase(summary.hardErrorCount)} بحاجة إلى معالجة` };
  }
  if (summary.reviewCount > 0) {
    return { tone: "review", text: `المتطلبات الإلزامية مستوفاة · ${reviewPhrase(summary.reviewCount)}` };
  }
  return { tone: "ready", text: "جاهز للتقديم" };
}