import Link from "next/link";
import { ReadinessCounts } from "@/components/workspace/ReadinessSummary";
import type { JournalSummary } from "@/lib/journals/types";
import type { ReadinessSummary } from "@/lib/workspace/types";

type WorkspaceHeaderProps = {
  journal: JournalSummary;
  summary: ReadinessSummary;
  readyHref: string;
  /* Omitted until real journal switching exists (Phase 5); the button is then not shown. */
  onSwitchJournal?: () => void;
};

export function WorkspaceHeader({ journal, summary, readyHref, onSwitchJournal }: WorkspaceHeaderProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-3 border-b border-rule px-6 py-3 lg:h-16 lg:flex-nowrap lg:px-8 lg:py-0">
      <h1 className="text-lg font-bold whitespace-nowrap">مساحة التجهيز</h1>
      <span aria-hidden="true" className="hidden h-7 w-px bg-rule lg:block" />

      <div className="flex min-w-0 flex-col">
        <span className="text-[11.5px] text-muted">المجلة المستهدفة</span>
        <span className="truncate text-sm font-semibold">
          <span dir="ltr" className="font-latin">
            {journal.name}
          </span>
          {journal.shortName && (
            <span className="font-normal text-muted">
              {" "}
              ·{" "}
              <span dir="ltr" className="font-latin">
                {journal.shortName}
              </span>
            </span>
          )}
        </span>
      </div>

      {onSwitchJournal && (
        <button
          type="button"
          onClick={onSwitchJournal}
          className="h-10 shrink-0 rounded-[3px] bg-terracotta px-4 text-sm font-bold text-ink hover:bg-terracotta/90"
        >
          تغيير المجلة
        </button>
      )}

      {journal.sourceIsDemo && (
        <span
          title="مجلة تجريبية وهمية لأغراض العرض؛ متطلباتها ليست حقيقية."
          className="shrink-0 rounded-full border border-rule-strong px-3 py-[3px] text-xs text-muted"
        >
          بيانات تجريبية
        </span>
      )}

      <div className="hidden flex-1 lg:block" />

      <ReadinessCounts summary={summary} />

      {/* Always available: submitting before every requirement is met is the researcher's choice.
          The ready page shows what is still open. */}
      <Link
        href={readyHref}
        aria-describedby="readiness-status"
        title={
          summary.isFullyReady
            ? undefined
            : summary.meetsHardRequirements
              ? "بعض البنود بحاجة إلى مراجعة، ويمكنك المتابعة إلى التقديم"
              : "لم تُستوفَ كل المتطلبات الإلزامية بعد، ويمكنك المتابعة إلى التقديم إن أردت"
        }
        className={
          summary.isFullyReady
            ? "inline-flex h-10 shrink-0 items-center gap-2 rounded-[3px] bg-ink px-5 text-sm font-bold text-paper hover:bg-ink/90"
            : "inline-flex h-10 shrink-0 items-center gap-2 rounded-[3px] border border-ink px-5 text-sm font-bold text-ink hover:bg-ink hover:text-paper"
        }
      >
        التقديم
        <span aria-hidden="true">←</span>
      </Link>
    </div>
  );
}