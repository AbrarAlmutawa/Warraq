"use client";

import Link from "next/link";
import { BookmarkMark } from "@/components/brand/BookmarkMark";
import { AnalysisStageRow } from "@/components/analysis/AnalysisStageRow";
import type { ManuscriptFileSummary } from "@/lib/analysis/types";
import { useMockAnalysis } from "@/lib/analysis/useMockAnalysis";
import type { MockAnalysisStage } from "@/lib/mock-data/manuscript-analysis";

type AnalysisProgressProps = {
  file: ManuscriptFileSummary;
  stages: MockAnalysisStage[];
  nextHref: string;
};

export function AnalysisProgress({ file, stages, nextHref }: AnalysisProgressProps) {
  const { statuses, isComplete } = useMockAnalysis(stages);

  return (
    <section aria-labelledby="analysis-heading" className="mt-16 w-full max-w-[680px] pb-16 lg:mt-24">
      <h1 id="analysis-heading" className="text-[34px] font-bold lg:text-[40px]">
        نقرأ بحثك
      </h1>

      <div className="mt-3.5 flex items-center gap-2.5 text-sm text-body">
        <BookmarkMark className="h-[30px] w-[10px] shrink-0 text-terracotta" />
        <span dir="ltr" className="font-latin">
          {file.fileName}
        </span>
        <span className="text-muted">· {file.fileSizeLabel}</span>
      </div>

      <ol aria-label="مراحل قراءة البحث" className="mt-10 border-t border-rule">
        {stages.map((stage, index) => (
          <AnalysisStageRow key={stage.id} stage={stage} status={statuses[index]} />
        ))}
      </ol>

      <p className="mt-7 text-sm leading-[1.8] text-body">
        يتم هذا التحليل مرة واحدة فقط. إذا غيّرت المجلة لاحقًا، نعيد فحص المتطلبات دون إعادة قراءة البحث.
      </p>

      <div className="mt-7 h-12">
        {isComplete && (
          <Link
            href={nextHref}
            className="inline-flex h-12 items-center gap-2 rounded-[3px] bg-ink px-6 text-[15px] font-bold text-paper transition-[opacity,background-color] duration-300 hover:bg-ink/90 starting:opacity-0 motion-reduce:transition-none"
          >
            مراجعة ما فهمناه
            <span aria-hidden="true">←</span>
          </Link>
        )}
      </div>

      <p role="status" className="sr-only">
        {isComplete ? "اكتملت قراءة البحث. يمكنك الآن مراجعة ما فهمناه." : ""}
      </p>
    </section>
  );
}