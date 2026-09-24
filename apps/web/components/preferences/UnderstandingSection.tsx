"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { SingleChoiceGroup } from "@/components/preferences/ChoiceGroup";
import { ARTICLE_TYPE_OPTIONS, articleTypeLabel } from "@/lib/preferences/options";
import type { ArticleType, ManuscriptUnderstanding } from "@/lib/preferences/types";

type EditableField = "topic" | "articleType" | "keywords";

const FIELD_LABELS: Record<EditableField, string> = {
  topic: "موضوع البحث",
  articleType: "نوع المقال",
  keywords: "الكلمات المفتاحية",
};

function parseKeywords(raw: string): string[] {
  return raw
    .split(/[,،·;]/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

type RowProps = {
  label: string;
  children: ReactNode;
};

function Row({ label, children }: RowProps) {
  return (
    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 border-b border-rule py-3.5 sm:grid-cols-[140px_minmax(0,1fr)]">
      <dt className="pt-0.5 text-[13px] text-muted">{label}</dt>
      <dd className="m-0 flex min-w-0 items-start justify-between gap-4">{children}</dd>
    </div>
  );
}

type EditActionsProps = {
  onSave: () => void;
  onCancel: () => void;
  saveDisabled?: boolean;
};

function EditActions({ onSave, onCancel, saveDisabled }: EditActionsProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onSave}
        disabled={saveDisabled}
        className="h-9 rounded-[3px] bg-ink px-4 text-[13px] font-semibold text-paper hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        حفظ
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="h-9 px-1 text-[13px] text-ink underline underline-offset-4 hover:text-terracotta-text"
      >
        إلغاء
      </button>
    </div>
  );
}

type UnderstandingSectionProps = {
  understanding: ManuscriptUnderstanding;
  onChange: (next: ManuscriptUnderstanding) => void;
};

export function UnderstandingSection({ understanding, onChange }: UnderstandingSectionProps) {
  const [editing, setEditing] = useState<EditableField | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftType, setDraftType] = useState<ArticleType>(understanding.articleType);
  const [edited, setEdited] = useState<Record<EditableField, boolean>>({
    topic: false,
    articleType: false,
    keywords: false,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const typeGroupRef = useRef<HTMLDivElement>(null);
  const editButtons = useRef<Partial<Record<EditableField, HTMLButtonElement | null>>>({});
  const returnFocusTo = useRef<EditableField | null>(null);

  useEffect(() => {
    if (editing === "topic" || editing === "keywords") {
      inputRef.current?.focus();
    } else if (editing === "articleType") {
      typeGroupRef.current?.querySelector<HTMLInputElement>("input:checked")?.focus();
    } else if (returnFocusTo.current) {
      editButtons.current[returnFocusTo.current]?.focus();
      returnFocusTo.current = null;
    }
  }, [editing]);

  const startEdit = (field: EditableField) => {
    if (field === "topic") setDraftText(understanding.topic);
    if (field === "keywords") setDraftText(understanding.keywords.join("، "));
    if (field === "articleType") setDraftType(understanding.articleType);
    setEditing(field);
  };

  const finishEdit = (field: EditableField) => {
    returnFocusTo.current = field;
    setEditing(null);
  };

  const save = () => {
    if (!editing) return;
    if (editing === "topic") {
      const topic = draftText.trim();
      if (!topic) return;
      onChange({ ...understanding, topic });
    }
    if (editing === "keywords") {
      const keywords = parseKeywords(draftText);
      if (keywords.length === 0) return;
      onChange({ ...understanding, keywords });
    }
    if (editing === "articleType") {
      onChange({ ...understanding, articleType: draftType });
    }
    setEdited((current) => ({ ...current, [editing]: true }));
    finishEdit(editing);
  };

  const cancel = () => {
    if (editing) finishEdit(editing);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  };

  const editButton = (field: EditableField) => (
    <button
      type="button"
      ref={(element) => {
        editButtons.current[field] = element;
      }}
      onClick={() => startEdit(field)}
      aria-label={`تعديل ${FIELD_LABELS[field]}`}
      className="-my-1.5 shrink-0 px-2 py-1.5 text-[13px] text-ink underline underline-offset-4 hover:text-terracotta-text"
    >
      تعديل
    </button>
  );

  const editedMark = (field: EditableField) =>
    edited[field] ? <span className="ms-2 text-xs font-normal text-muted">· عدّلته</span> : null;

  const textInputClass =
    "h-10 w-full rounded-[3px] border border-rule-strong bg-paper-raised px-3 text-[15px] text-ink focus-visible:border-ink";

  return (
    <section aria-labelledby="understanding-heading" className="min-w-0 flex-1">
      <h1 id="understanding-heading" className="text-[30px] font-bold">
        هذا ما فهمناه من بحثك
      </h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-body">
        راجع ما استخرجه وَرَّاق من بحثك وصحّح ما يلزم — تعتمد اقتراحات المجلات على هذه المعلومات.
      </p>

      <dl className="mt-6 border-t border-rule">
        <Row label={FIELD_LABELS.topic}>
          {editing === "topic" ? (
            <div className="flex flex-1 flex-col gap-2">
              <input
                ref={inputRef}
                type="text"
                aria-label={FIELD_LABELS.topic}
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
                onKeyDown={onInputKeyDown}
                className={textInputClass}
              />
              <EditActions onSave={save} onCancel={cancel} saveDisabled={!draftText.trim()} />
            </div>
          ) : (
            <>
              <span className="text-[15px] font-semibold">
                {understanding.topic}
                {editedMark("topic")}
              </span>
              {editButton("topic")}
            </>
          )}
        </Row>

        <Row label={FIELD_LABELS.articleType}>
          {editing === "articleType" ? (
            <div ref={typeGroupRef} className="flex flex-1 flex-col gap-3">
              <SingleChoiceGroup
                legend={FIELD_LABELS.articleType}
                hideLegend
                name="article-type"
                options={ARTICLE_TYPE_OPTIONS}
                value={draftType}
                onChange={setDraftType}
              />
              <EditActions onSave={save} onCancel={cancel} />
            </div>
          ) : (
            <>
              <span className="text-[15px] font-semibold">
                {articleTypeLabel(understanding.articleType)}
                {editedMark("articleType")}
              </span>
              {editButton("articleType")}
            </>
          )}
        </Row>

        <Row label={FIELD_LABELS.keywords}>
          {editing === "keywords" ? (
            <div className="flex flex-1 flex-col gap-2">
              <input
                ref={inputRef}
                type="text"
                aria-label={FIELD_LABELS.keywords}
                aria-describedby="keywords-hint"
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
                onKeyDown={onInputKeyDown}
                className={textInputClass}
              />
              <p id="keywords-hint" className="text-xs text-muted">
                افصل بين الكلمات بفاصلة.
              </p>
              <EditActions
                onSave={save}
                onCancel={cancel}
                saveDisabled={parseKeywords(draftText).length === 0}
              />
            </div>
          ) : (
            <>
              <span className="text-[15px] font-semibold leading-relaxed">
                {understanding.keywords.join(" · ")}
                {editedMark("keywords")}
              </span>
              {editButton("keywords")}
            </>
          )}
        </Row>
      </dl>

      <div className="mt-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[13px] font-semibold">مستخرج من الملف</p>
          <p className="text-xs text-muted">نستخدمه لاحقًا في فحص متطلبات المجلة</p>
        </div>
        <dl className="mt-2 grid grid-cols-2 border-t border-b border-t-ink border-b-rule sm:grid-cols-4">
          <div className="flex flex-col-reverse gap-1 py-3">
            <dt className="text-xs text-muted">عدد الكلمات</dt>
            <dd className="m-0 text-xl font-bold">{understanding.wordCount.toLocaleString("en-US")}</dd>
          </div>
          <div className="flex flex-col-reverse gap-1 py-3">
            <dt className="text-xs text-muted">عدد المراجع</dt>
            <dd className="m-0 text-xl font-bold">{understanding.referenceCount}</dd>
          </div>
          <div className="flex flex-col-reverse gap-1 py-3">
            <dt className="text-xs text-muted">الأشكال والجداول</dt>
            <dd className="m-0 text-lg font-bold">
              {understanding.figureCount} أشكال · {understanding.tableCount} جداول
            </dd>
          </div>
          <div className="flex flex-col-reverse gap-1 py-3">
            <dt className="text-xs text-muted">أسلوب الاستشهاد</dt>
            <dd className="m-0 text-xl font-bold">
              <span dir="ltr" className="font-latin">
                {understanding.citationStyle}
              </span>
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}