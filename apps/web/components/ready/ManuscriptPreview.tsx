"use client";

import { useMemo, useState } from "react";
import { DialogFrame } from "@/components/journals/DialogFrame";
import { EyeIcon } from "@/components/ui/icons";
import type { ApiParsedManuscript } from "@/lib/api-client";
import { buildBlockDocument } from "@/lib/workspace/block-document";

type ManuscriptPreviewProps = {
  /* The current saved version's parse, as GET /manuscripts/{id} returned it on this page. */
  parsed: ApiParsedManuscript;
  revision: number;
  /* Class for the trigger button (matches the other output actions). */
  className: string;
};

/*
 * "عرض البحث": a read-only reading view of the latest saved version. It reuses the data the
 * ready page already fetched and the same block document the workspace editor shows, so the text
 * and its order match the editor exactly. Nothing here can change the manuscript.
 */
export function ManuscriptPreview({ parsed, revision, className }: ManuscriptPreviewProps) {
  const [open, setOpen] = useState(false);
  const manuscriptDocument = useMemo(() => buildBlockDocument(parsed), [parsed]);

  const sectionsByLine = useMemo(
    () => new Map(manuscriptDocument.sections.map((section) => [section.line, section.kind])),
    [manuscriptDocument],
  );
  const lines = manuscriptDocument.text
    .split("\n")
    .map((text, index) => ({ text, line: index + 1 }))
    .filter((entry) => entry.text.trim() !== "");

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <EyeIcon className="text-[17px]" />
        عرض البحث
      </button>

      <DialogFrame
        open={open}
        onClose={() => setOpen(false)}
        titleId="manuscript-preview-title"
        title="عرض البحث"
        widthClass="max-w-[860px]"
      >
        <p className="border-b border-rule pb-3 text-[13px] leading-relaxed text-muted">
          {revision > 0 ? `أحدث نسخة محفوظة (النسخة ${revision})` : "النسخة الأصلية"} · للقراءة فقط. هذا عرض نصي
          للمخطوطة؛ التنسيق الكامل والصور والجداول موجودة في ملف Word.
        </p>

        {lines.length === 0 ? (
          <p className="mt-5 text-sm text-muted">لا يوجد نص لعرضه في هذه النسخة.</p>
        ) : (
          <article className="mt-5 flex flex-col gap-3 pb-2">
            {lines.map(({ text, line }) => {
              const kind = sectionsByLine.get(line);
              if (kind === "title") {
                return (
                  <h3 key={line} dir="auto" className="text-start text-[22px] leading-snug font-bold">
                    {text}
                  </h3>
                );
              }
              if (kind === "heading") {
                return (
                  <h4 key={line} dir="auto" className="mt-3 text-start text-[16px] font-bold">
                    {text}
                  </h4>
                );
              }
              return (
                <p key={line} dir="auto" className="text-start text-[15px] leading-[1.85] text-body">
                  {text}
                </p>
              );
            })}
          </article>
        )}
      </DialogFrame>
    </>
  );
}