"use client";

import { useState } from "react";
import type { PresentedText } from "@/lib/workspace/requirement-labels";
import { suggestionLabel, suggestionTitle } from "@/lib/workspace/suggestion-labels";
import type { SuggestionStatus, WorkspaceSuggestion } from "@/lib/workspace/types";

type SuggestionCardProps = {
  suggestion: WorkspaceSuggestion;
  selected: boolean;
  canGoToText: boolean;
  /* A PATCH /suggestions/{id} request for this card is in flight. */
  saving: boolean;
  /* The last decision request failed (Arabic message); the status did not change. */
  error: string | null;
  onGoToText: () => void;
  onDecide: (status: SuggestionStatus) => void;
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

function Segments({ parts }: { parts: PresentedText[] }) {
  return (
    <>
      {parts.map((part, index) =>
        part.latin ? (
          <span key={index} dir="ltr" className="font-latin">
            {part.text}
          </span>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

/*
 * A backend AI suggestion. A proposal only: accepting or rejecting records the researcher's
 * decision on the backend and never edits the manuscript or changes readiness.
 */
export function SuggestionCard({
  suggestion,
  selected,
  canGoToText,
  saving,
  error,
  onGoToText,
  onDecide,
}: SuggestionCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewId = `suggestion-preview-${suggestion.id}`;
  const label = suggestionLabel(suggestion);
  const hasPreview = Boolean(suggestion.before || suggestion.after);

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
        <span className="text-xs text-muted">
          <Segments parts={[label]} />
        </span>
        {selected && <span className="sr-only">(البند المحدد)</span>}
      </div>

      <p className="mt-2 text-[14px] leading-relaxed font-semibold">
        <Segments parts={suggestionTitle(suggestion)} />
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-body">
        <span className="font-bold">لماذا؟ </span>
        <span dir="ltr" className="font-latin">
          {suggestion.rationale}
        </span>
      </p>

      {suggestion.status === "pending" && (
        <>
          {previewOpen && hasPreview && (
            <div id={previewId} className="mt-3 flex flex-col gap-2 border border-rule bg-paper p-3 text-[13px]">
              {suggestion.before && (
                <div>
                  <p className="text-[11px] font-bold text-muted">قبل</p>
                  <p dir="ltr" className="font-latin leading-relaxed whitespace-pre-line text-muted line-through">
                    {suggestion.before}
                  </p>
                </div>
              )}
              {suggestion.after && (
                <div>
                  <p className="text-[11px] font-bold text-olive-text">{suggestion.before ? "بعد" : "النص المقترح"}</p>
                  <p
                    dir="ltr"
                    className="font-latin leading-relaxed whitespace-pre-line underline decoration-olive decoration-dotted decoration-2 underline-offset-4"
                  >
                    {suggestion.after}
                  </p>
                </div>
              )}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {hasPreview && (
              <button
                type="button"
                onClick={() => setPreviewOpen((open) => !open)}
                aria-expanded={previewOpen}
                aria-controls={previewId}
                className="h-9 rounded-[3px] border border-rule-strong px-3 text-[13px] hover:border-ink"
              >
                {previewOpen ? "إخفاء المعاينة" : "معاينة"}
              </button>
            )}
            <button
              type="button"
              onClick={() => onDecide("accepted")}
              disabled={saving}
              className="h-9 rounded-[3px] bg-ink px-4 text-[13px] font-semibold text-paper hover:bg-ink/90 disabled:cursor-wait disabled:opacity-60"
            >
              قبول
            </button>
            <button
              type="button"
              onClick={() => onDecide("rejected")}
              disabled={saving}
              className="h-9 rounded-[3px] border border-rule-strong px-3 text-[13px] hover:border-ink disabled:cursor-wait disabled:opacity-60"
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

      {suggestion.status !== "pending" && (
        <div className="mt-3 flex items-center gap-3 text-[13px]">
          {suggestion.status === "accepted" ? (
            <span className="leading-relaxed font-semibold text-mint-text">
              ✓ قبلتَ هذا الاقتراح — لم يُعدَّل البحث. طبّقه في ملف Word ثم ارفع النسخة المعدّلة لإعادة الفحص.
            </span>
          ) : (
            <span className="text-body">رفضتَ هذا الاقتراح.</span>
          )}
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => onDecide("pending")}
            disabled={saving}
            className="h-9 shrink-0 px-1 underline underline-offset-4 hover:text-terracotta-text disabled:cursor-wait disabled:opacity-60"
          >
            تراجع
          </button>
        </div>
      )}

      {saving && (
        <p role="status" className="mt-2 text-xs text-muted">
          نحفظ قرارك…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs font-semibold text-terracotta-text">
          ✕ {error}
        </p>
      )}
    </article>
  );
}