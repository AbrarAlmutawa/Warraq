export type AnalysisStageStatus = "pending" | "active" | "done";

export type AnalysisStage = {
  id: string;
  label: string;
  result: string;
};