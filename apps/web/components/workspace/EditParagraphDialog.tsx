"use client";

import { useState } from "react";
import { DialogFrame } from "@/components/journals/DialogFrame";

export type ParagraphTarget = { blockId: string; text: string };

type EditParagraphDialogProps = {
  target: ParagraphTarget | null;
  saving: boolean;
  error: string | null;
  onSave: (text: string) => void;
  onClose: () => void;
};

/* Edit one paragraph. The change is written into the researcher's Word file as a new revision. */
export function EditParagraphDialog({ target, saving, error, onSave, onClose }: EditParagraphDialogProps) {
  return (
    <DialogFrame
      open={target !== null}
      onClose={onClose}
      titleId="edit-paragraph-title"
      title="تعديل الفقرة"
      widthClass="max-w-[760px]"
    >
      {/* Keyed by block so the text resets when another paragraph is opened. */}
      {target && (
        <ParagraphForm key={target.blockId} initial={target.text} saving={saving} error={error} onSave={onSave} onClose={onClose} />
      )}
    </DialogFrame>
  );
}

function ParagraphForm({
  initial,
  saving,
  error,
  onSave,
  onClose,
}: {
  initial: string;
  saving: boolean;
  error: string | null;
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initial);
  const trimmed = text.trim();
  const unchanged = trimmed === initial.trim();

  return (
    <form
      className="flex flex-col gap-4 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed && !unchanged && !saving) onSave(trimmed);
      }}
    >
      <p className="text-[13px] leading-relaxed text-body">
        يُحفظ التعديل في نسخة جديدة من ملف Word مع الإبقاء على تنسيقه، ويُعاد فحص المتطلبات تلقائيًا. يمكنك التراجع في أي وقت.
      </p>
      <label className="flex flex-col gap-2">
        <span className="text-[12px] font-bold text-muted">نص الفقرة</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          dir="auto"
          rows={8}
          className="w-full resize-y rounded-[3px] border border-rule-strong bg-paper-raised p-3 text-[14px] leading-relaxed focus:border-ink focus:outline-none"
        />
      </label>
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-terracotta-text">
          ✕ {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-4">
        <button
          type="button"
          onClick={onClose}
          className="h-11 rounded-[3px] border border-rule-strong px-4 text-sm hover:border-ink"
        >
          إلغاء
        </button>
        <span className="flex-1" />
        <button
          type="submit"
          disabled={!trimmed || unchanged || saving}
          className="h-11 rounded-[3px] bg-ink px-5 text-sm font-bold text-paper hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "نحفظ التعديل…" : "حفظ التعديل"}
        </button>
      </div>
    </form>
  );
}
