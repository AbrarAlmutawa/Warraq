import { useEffect, useState } from "react";
import type { AnalysisProgressState, AnalysisStageStatus } from "@/lib/analysis/types";

type TimedStage = {
  durationMs: number;
};

/*
 * Frontend-only simulation of manuscript analysis.
 * Replace with a hook that reads real backend progress and returns the same shape.
 */
export function useMockAnalysis(stages: readonly TimedStage[]): AnalysisProgressState {
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: number[] = [];
    let elapsed = 0;

    stages.forEach((stage, index) => {
      elapsed += reduceMotion ? 0 : stage.durationMs;
      timers.push(window.setTimeout(() => setCompletedCount(index + 1), elapsed));
    });

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [stages]);

  const statuses: AnalysisStageStatus[] = stages.map((_, index) => {
    if (index < completedCount) return "done";
    if (index === completedCount) return "active";
    return "pending";
  });

  return {
    statuses,
    isComplete: completedCount >= stages.length,
  };
}