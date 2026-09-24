"use client";

import { useState } from "react";
import type { SuggestionStatus, WarraqSuggestion } from "@/lib/workspace/types";

type SuggestionCardProps = {
  suggestion: WarraqSuggestion;
  status: SuggestionStatus;
  selected: boolean;
  canGoToText: boolean;
  onGoToText: () => void;
  onAccept: () => void;
  onReject: () => void;
  onUndo: () => void;
};

function ShaddaIcon() {
  return (
    <svg width="14" height="12" viewBox="0 0 32 26" aria-hidden="true">
      <path
        d="M4 14 L10 4 L16 12 L22 4 L28 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="4" y1="22" x2="28" y2="22" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" />
    </svg>
  );
}

export function SuggestionCard({
  suggestion,
  status,
  selected,
  canGoToText,
  onGoToText,
  onAccept,
  onReject,
  onUndo,
}: SuggestionCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewId = `suggestion-preview-${suggestion.id}`;

  return (
    <article
      id={`sug-card-${suggestion.id}`}
      className={`rounded-[4px] border-2 border-dotted border-olive/60 bg-paper-raised p-4 ${
        selected ? "outline-2 outline-offset-2 outline-ink" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-[3px] bg-olive/15 px-2 py-0.5 text-[11px] font-bold text-olive-text">
          <ShaddaIcon />
          اقتراح من وَرَّاق
        </span>
        <span className="text-xs text-muted">{suggestion.label}</span>
        {selected && <span className="sr-only">(البند المحدد)</span>}
      </div>

      <p className="mt-2 text-[14px] leading-relaxed font-semibold">{suggestion.title}</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-body">
        <span className="font-bold">لماذا؟ </span>
        {suggestion.rationale}
      </p>

      {status === "pending" && (
        <>
          {previewOpen && (
            <div id={previewId} className="mt-3 flex flex-col gap-2 border border-rule bg-paper p-3 text-[13px]">
              <div>
                <p className="text-[11px] font-bold text-muted">قبل</p>
                <p dir="ltr" className="font-latin leading-relaxed text-muted line-through">
                  {suggestion.before}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-olive-text">بعد</p>
                <p
                  dir="ltr"
                  className="font-latin leading-relaxed underline decoration-olive decoration-dotted decoration-2 underline-offset-4"
                >
                  {suggestion.after}
                </p>
              </div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewOpen((open) => !open)}
              aria-expanded={previewOpen}
              aria-controls={previewId}
              className="h-9 rounded-[3px] border border-rule-strong px-3 text-[13px] hover:border-ink"
            >
              {previewOpen ? "إخفاء المعاينة" : "معاينة"}
            </button>
            <button
              type="button"
              onClick={onAccept}
              className="h-9 rounded-[3px] bg-ink px-4 text-[13px] font-semibold text-paper hover:bg-ink/90"
            >
              قبول
            </button>
            <button
              type="button"
              onClick={onReject}
              className="h-9 rounded-[3px] border border-rule-strong px-3 text-[13px] hover:border-ink"
            >
              رفض
            </button>
            <span className="flex-1" />
            {canGoToText && (
              <button
                type="button"
                onClick={onGoToText}
                className="h-9 px-1 text-[13px] underline underline-offset-4 hover:text-terracotta-text"
              >
                انتقل إلى النص
              </button>
            )}
          </div>
        </>
      )}

      {status !== "pending" && (
        <div className="mt-3 flex items-center gap-3 text-[13px]">
          {status === "accepted" ? (
            <span className="font-semibold text-mint-text">✓ قُبل - عُدّل النص في المخطوطة</span>
          ) : (
            <span className="text-body">رُفض - بقي النص كما هو</span>
          )}
          <span className="flex-1" />
          <button type="button" onClick={onUndo} className="h-9 px-1 underline underline-offset-4 hover:text-terracotta-text">
            تراجع
          </button>
        </div>
      )}
    </article>
  );
}