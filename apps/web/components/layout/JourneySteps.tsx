import { JOURNEY_STAGES, type JourneyStageId } from "@/components/layout/JourneyTimeline";

const ARABIC_DIGITS = ["١", "٢", "٣", "٤"];

type JourneyStepsProps = {
  /** "ready" = every stage completed, final state shown as current */
  current: JourneyStageId | "ready";
};

/* Compact header stepper for screens after the start page. */
export function JourneySteps({ current }: JourneyStepsProps) {
  const isComplete = current === "ready";
  const currentIndex = isComplete
    ? JOURNEY_STAGES.length
    : JOURNEY_STAGES.findIndex((stage) => stage.id === current);

  return (
    <nav aria-label="مراحل العمل" className="hidden md:block">
      <ol className="flex items-center gap-3 text-[13.5px]">
        {JOURNEY_STAGES.map((stage, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <li key={stage.id} className="flex items-center gap-3">
              {index > 0 && <span aria-hidden="true" className="h-px w-7 bg-stone" />}
              <span
                aria-current={isCurrent ? "step" : undefined}
                className={
                  isDone
                    ? "font-semibold text-mint-text"
                    : isCurrent
                      ? "border-b-2 border-terracotta pb-0.5 font-bold text-ink"
                      : "text-muted"
                }
              >
                <span aria-hidden="true">{isDone ? "✓" : ARABIC_DIGITS[index]} </span>
                {stage.label}
                {isDone && <span className="sr-only"> (مكتملة)</span>}
              </span>
            </li>
          );
        })}
        {isComplete && (
          <li className="flex items-center gap-3">
            <span aria-hidden="true" className="h-px w-7 bg-stone" />
            <span aria-current="step" className="border-b-2 border-terracotta pb-0.5 font-bold text-ink">
              جاهز للتقديم
            </span>
          </li>
        )}
      </ol>
    </nav>
  );
}