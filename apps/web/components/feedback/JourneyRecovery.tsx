import { useId, type ReactNode } from "react";

/*
 * Warraq's error / recovery block, in the existing editorial style (home page margin rule,
 * terracotta accent, ✕ eyebrow). Used whenever real data cannot be shown: the screen explains
 * what happened and offers a real next step. It never substitutes mock data.
 */

export const JOURNEY_ACTION_PRIMARY =
  "inline-flex h-12 items-center gap-2 rounded-[3px] bg-ink px-6 text-[15px] font-bold text-paper hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40";

export const JOURNEY_ACTION_SECONDARY =
  "text-sm text-ink underline underline-offset-4 hover:text-terracotta-text";

type JourneyRecoveryProps = {
  /* "error": something failed. "notice": nothing failed, but the journey cannot continue here. */
  tone?: "error" | "notice";
  eyebrow?: string;
  title: string;
  message: string;
  /* Technical detail from the server (usually English). Shown small, LTR, unchanged. */
  detail?: string | null;
  headingLevel?: 1 | 2;
  /* Actions (links/buttons) using JOURNEY_ACTION_PRIMARY / JOURNEY_ACTION_SECONDARY. */
  children?: ReactNode;
};

export function JourneyRecovery({
  tone = "error",
  eyebrow,
  title,
  message,
  detail,
  headingLevel = 1,
  children,
}: JourneyRecoveryProps) {
  const headingId = useId();
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const eyebrowText = eyebrow ?? (tone === "error" ? "✕ تعذّرت المتابعة" : "لا يمكن المتابعة من هنا");

  return (
    <section
      role={tone === "error" ? "alert" : "status"}
      aria-labelledby={headingId}
      className="relative w-full max-w-[680px] ps-7"
    >
      <div aria-hidden="true" className="absolute top-1.5 right-0 h-full w-px bg-rule" />
      <div aria-hidden="true" className="absolute top-1.5 -right-px h-16 w-[3px] bg-terracotta" />

      <p className={`text-sm font-semibold ${tone === "error" ? "text-terracotta-text" : "text-muted"}`}>
        {eyebrowText}
      </p>

      <Heading id={headingId} className="mt-3 text-[30px] leading-tight font-bold lg:text-[34px]">
        {title}
      </Heading>

      <p className="mt-4 max-w-[560px] text-[15.5px] leading-[1.85] text-body">{message}</p>

      {detail && (
        <p dir="ltr" className="mt-3 max-w-[560px] font-latin text-[12.5px] leading-relaxed break-words text-muted">
          {detail}
        </p>
      )}

      {children && <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">{children}</div>}
    </section>
  );
}