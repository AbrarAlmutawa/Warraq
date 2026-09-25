export type AnalysisStageStatus = "pending" | "active" | "done";

export type AnalysisStage = {
  id: string;
  label: string;
  result: string;
};

export type ManuscriptFileSummary = {
  fileName: string;
  fileSizeLabel: string;
};

export type AnalysisProgressState = {
  statuses: AnalysisStageStatus[];
  isComplete: boolean;
};