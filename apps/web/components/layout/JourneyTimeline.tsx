export const JOURNEY_STAGES = [
  { id: "manuscript", label: "البحث", hint: "نقرأه مرة واحدة" },
  { id: "priorities", label: "الأولويات", hint: "الرسوم، السرعة، الوصول" },
  { id: "journal", label: "المجلة", hint: "توصيات مفسَّرة" },
  { id: "preparation", label: "التجهيز", hint: "حتى الجاهزية للتقديم" },
] as const;

export type JourneyStageId = (typeof JOURNEY_STAGES)[number]["id"];

type JourneyTimelineProps = {
  current: JourneyStageId;
};

export function JourneyTimeline({ current }: JourneyTimelineProps) {
  return (
    <div className="relative">
      <div aria-hidden="true" className="absolute top-[6px] right-[6px] left-[30px] h-px bg-rule-strong" />
      <ol aria-label="مراحل العمل" className="relative grid grid-cols-4">
        {JOURNEY_STAGES.map((stage) => {
          const isCurrent = stage.id === current;
          return (
            <li
              key={stage.id}
              aria-current={isCurrent ? "step" : undefined}
              className="flex flex-col gap-2.5"
            >
              <span
                aria-hidden="true"
                className={`size-[13px] rounded-full ${isCurrent ? "bg-terracotta" : "bg-ink"}`}
              />
              <span className="text-sm font-bold">{stage.label}</span>
              <span className="text-xs leading-relaxed text-muted">{stage.hint}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}