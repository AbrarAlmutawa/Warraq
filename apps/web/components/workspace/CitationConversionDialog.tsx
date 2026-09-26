"use client";

import { useState } from "react";
import { DialogFrame } from "@/components/journals/DialogFrame";
import type { ErrorPresentation } from "@/lib/api-errors";
import type { CitationProposal } from "@/lib/workspace/types";

/* A POST /citations/convert answer (or the failure to get one) for one journal. */
export type ConversionEntry =
  | { status: "loading" }
  /* `cacheable` is false for unavailable/error answers so reopening asks again. */
  | { status: "ready"; proposal: CitationProposal; cacheable: boolean }
  | { status: "error"; error: ErrorPresentation };

type CitationConversionDialogProps = {
  open: boolean;
  entry: ConversionEntry | undefined;
  onRetry: () => void;
  onClose: () => void;
};

const upper = (style: string) => style.toUpperCase();

/*
 * A read-only proposal: the manuscript's references are never changed, the backend stores no
 * decision about it, and readiness stays the same until a revised DOCX is uploaded.
 */
export function CitationConversionDialog({ open, entry, onRetry, onClose }: CitationConversionDialogProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const proposal = entry?.status === "ready" ? entry.proposal : null;
  const hasList = Boolean(proposal && (proposal.status === "ok" || proposal.status === "partial") && proposal.references.length > 0);

  const copyList = () => {
    if (!proposal) return;
    const text = proposal.references.map((reference) => reference.converted).join("\n");
    navigator.clipboard.writeText(text).then(
      () => setCopyState("copied"),
      () => setCopyState("failed"),
    );
  };

  return (
    <DialogFrame
      open={open}
      onClose={onClose}
      titleId="citation-conversion-title"
      title="اقتراح تحويل المراجع"
      widthClass="max-w-[860px]"
    >
      <div className="flex flex-col gap-5 text-sm">
        <p className="border border-dashed border-subtle bg-paper-raised px-4 py-3 text-[13px] leading-relaxed text-body">
          <span className="font-bold text-ink">هذا اقتراح فقط: </span>
          لم تتغيّر المراجع في مخطوطتك، ولن تتغيّر جاهزيتك حتى تطبّق التحويل في ملف Word وترفع النسخة المعدّلة.
        </p>

        {(!entry || entry.status === "loading") && (
          <p role="status" className="text-[13.5px] text-muted">
            نطلب اقتراح تحويل المراجع…
          </p>
        )}

        {entry?.status === "error" && (
          <div role="alert" className="flex flex-col gap-1 border border-terracotta/45 bg-terracotta-tint px-4 py-3">
            <p className="text-[13.5px] font-semibold text-terracotta-text">✕ {entry.error.title}</p>
            <p className="text-[13px] leading-relaxed text-body">{entry.error.message}</p>
            {entry.error.detail && (
              <p dir="ltr" className="font-latin text-[12px] break-words text-muted">
                {entry.error.detail}
              </p>
            )}
          </div>
        )}

        {proposal && (
          <>
            <p className="text-[15px]">
              من{" "}
              <span dir="ltr" className="font-latin font-bold">
                {upper(proposal.fromStyle)}
              </span>{" "}
              <span aria-hidden="true" className="text-muted">
                ←
              </span>{" "}
              إلى{" "}
              <span dir="ltr" className="font-latin font-bold">
                {upper(proposal.toStyle)}
              </span>
            </p>

            {proposal.status === "unavailable" && (
              <p className="text-[13.5px] leading-relaxed">
                تحويل المراجع يحتاج الذكاء الاصطناعي، وهو غير مفعّل على هذا الخادم. قائمة المتطلبات والجاهزية تعمل كالمعتاد.
              </p>
            )}
            {proposal.status === "error" && (
              <p className="text-[13.5px] leading-relaxed">تعذّر تحويل المراجع هذه المرة. يمكنك إعادة المحاولة بعد قليل.</p>
            )}

            {proposal.message && (
              <p className="text-[12.5px] text-muted">
                رسالة الخادم:{" "}
                <span dir="ltr" className="font-latin">
                  {proposal.message}
                </span>
              </p>
            )}

            {hasList && (
              <>
                {proposal.verified === true && (
                  <p className="text-[13px] font-semibold text-mint-text">
                    ✓ تعرّف وَرَّاق على القائمة المقترحة بأسلوب{" "}
                    <span dir="ltr" className="font-latin">
                      {upper(proposal.toStyle)}
                    </span>
                  </p>
                )}
                {proposal.verified === false && (
                  <p className="text-[13px] font-semibold text-muted">
                    ◐ لم يتأكد وَرَّاق من أن القائمة المقترحة بأسلوب{" "}
                    <span dir="ltr" className="font-latin">
                      {upper(proposal.toStyle)}
                    </span>
                    ؛ راجِعها بنفسك.
                  </p>
                )}
                {proposal.failedIndexes.length > 0 && (
                  <p className="text-[13px] text-terracotta-text">
                    تعذّر تحويل بعض المراجع (رقم{" "}
                    <span dir="ltr" className="font-latin">
                      {proposal.failedIndexes.join(", ")}
                    </span>
                    )؛ بقيت كما هي في الاقتراح.
                  </p>
                )}

                <ol className="m-0 flex max-h-[46vh] list-none flex-col overflow-y-auto border-t border-rule p-0">
                  {proposal.references.map((reference) => (
                    <li key={reference.index} className="flex flex-col gap-1 border-b border-rule py-3">
                      <span className="text-[11px] font-bold text-muted">المرجع {reference.index}</span>
                      <p dir="ltr" className="font-latin text-[12.5px] leading-relaxed text-muted line-through">
                        {reference.original}
                      </p>
                      <p
                        dir="ltr"
                        className="font-latin text-[13px] leading-relaxed underline decoration-olive decoration-dotted decoration-2 underline-offset-4"
                      >
                        {reference.converted}
                      </p>
                      {reference.inText && (
                        <p className="text-[12px] text-body">
                          داخل النص:{" "}
                          <span dir="ltr" className="font-latin">
                            {reference.inText}
                          </span>
                        </p>
                      )}
                      {reference.missingFields.length > 0 && (
                        <p className="text-[12px] text-terracotta-text">
                          حقول ناقصة يلزم استكمالها:{" "}
                          <span dir="ltr" className="font-latin">
                            {reference.missingFields.join(", ")}
                          </span>
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              </>
            )}
          </>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-4">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-[3px] border border-rule-strong px-4 text-sm hover:border-ink"
          >
            إغلاق
          </button>
          <span className="flex-1" />
          {copyState === "copied" && <span className="text-[13px] text-mint-text">✓ نُسخت القائمة</span>}
          {copyState === "failed" && <span className="text-[13px] text-terracotta-text">✕ تعذّر النسخ</span>}
          {hasList && (
            <button
              type="button"
              onClick={copyList}
              className="h-11 rounded-[3px] bg-ink px-5 text-sm font-bold text-paper hover:bg-ink/90"
            >
              نسخ القائمة المحوّلة
            </button>
          )}
          {((entry?.status === "error" && entry.error.retryable) ||
            (proposal !== null && proposal.status === "error")) && (
            <button
              type="button"
              onClick={onRetry}
              className="h-11 rounded-[3px] bg-ink px-5 text-sm font-bold text-paper hover:bg-ink/90"
            >
              إعادة المحاولة
            </button>
          )}
        </div>
      </div>
    </DialogFrame>
  );
}