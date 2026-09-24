import type { AnalysisStage, AnalysisStageStatus } from "@/lib/analysis/types";

type AnalysisStageRowProps = {
  stage: AnalysisStage;
  status: AnalysisStageStatus;
};

const STATUS_TEXT: Record<AnalysisStageStatus, string> = {
  done: "مكتمل",
  active: "جارٍ الآن",
  pending: "بالانتظار",
};

function StatusIndicator({ status }: { status: AnalysisStageStatus }) {
  if (status === "done") {
    return (
      <span
        aria-hidden="true"
        className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-mint text-[13px] font-bold text-paper-raised transition-colors duration-300"
      >
        ✓
      </span>
    );
  }

  if (status === "active") {
    return (
      <span
        aria-hidden="true"
        className="flex size-[26px] shrink-0 items-center justify-center rounded-full border-2 border-terracotta"
      >
        <span className="size-2 rounded-full bg-terracotta motion-safe:animate-pulse" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="size-[26px] shrink-0 rounded-full border-[1.5px] border-rule-strong"
    />
  );
}

export function AnalysisStageRow({ stage, status }: AnalysisStageRowProps) {
  return (
    <li
      aria-current={status === "active" ? "step" : undefined}
      className="flex items-center gap-4 border-b border-rule py-[18px]"
    >
      <StatusIndicator status={status} />

      <span
        className={`flex-1 text-base font-semibold transition-colors duration-300 ${
          status === "pending" ? "text-muted" : "text-ink"
        }`}
      >
        {stage.label}
        <span className="sr-only"> — {STATUS_TEXT[status]}</span>
      </span>

      {status === "done" && (
        <span className="text-sm text-body transition-opacity duration-300 starting:opacity-0 motion-reduce:transition-none">
          {stage.result}
        </span>
      )}

      {status === "active" && (
        <span aria-hidden="true" className="text-sm font-semibold text-terracotta-text">
          جارٍ…
        </span>
      )}
    </li>
  );
}