import type { ReadinessSummary } from "@/lib/workspace/types";

/*
 * Arabic wording for readiness. Text only: every number and the ready/not-ready decision come
 * from the backend ReadinessSummary (POST /validate); nothing here computes readiness.
 */

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
  if (summary.isFullyReady) {
    return { tone: "ready", text: "جاهز للتقديم" };
  }
  if (summary.hardErrorCount > 0) {
    return { tone: "blocked", text: `غير جاهز بعد - ${hardErrorsPhrase(summary.hardErrorCount)} بحاجة إلى معالجة` };
  }
  if (summary.reviewCount > 0) {
    return { tone: "review", text: `المتطلبات الإلزامية مستوفاة · ${reviewPhrase(summary.reviewCount)}` };
  }
  return { tone: "blocked", text: "غير جاهز بعد" };
}