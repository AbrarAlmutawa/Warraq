import type { ReactNode } from "react";
import { FIGURES, TABLES, arabicCount } from "@/lib/analysis/stages";
import type { ManuscriptUnderstanding } from "@/lib/preferences/types";

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

type UnderstandingSectionProps = {
  understanding: ManuscriptUnderstanding;
  isDemoManuscript: boolean;
};

/*
 * Read-only: everything here comes from the backend parse of the uploaded file.
 * Corrections happen in the Word file, followed by a new upload.
 */
export function UnderstandingSection({ understanding, isDemoManuscript }: UnderstandingSectionProps) {
  return (
    <section aria-labelledby="understanding-heading" className="min-w-0 flex-1">
      <h1 id="understanding-heading" className="text-[30px] font-bold">
        هذا ما فهمناه من بحثك
      </h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-body">
        هذا ما استخرجه وَرَّاق من ملفك، وتعتمد عليه اقتراحات المجلات وفحص المتطلبات. إذا لاحظت خطأً، صحّحه في
        ملف Word ثم ارفعه من جديد.
      </p>

      {isDemoManuscript && (
        <p className="mt-3">
          <span className="rounded-full border border-rule-strong px-3 py-[3px] text-xs text-muted">بحث تجريبي</span>
        </p>
      )}

      <dl className="mt-6 border-t border-rule">
        <Row label="عنوان البحث">
          {understanding.title ? (
            <span dir="ltr" className="font-latin text-[15px] leading-relaxed font-semibold">
              {understanding.title}
            </span>
          ) : (
            <span className="text-[14px] text-muted">لم يتعرّف وَرَّاق على عنوان في الملف.</span>
          )}
        </Row>

        <Row label="الكلمات المفتاحية">
          {understanding.keywords.length > 0 ? (
            <span dir="ltr" className="font-latin text-[15px] leading-relaxed font-semibold">
              {understanding.keywords.join(" · ")}
            </span>
          ) : (
            <span className="text-[14px] text-muted">لم يجد وَرَّاق كلمات مفتاحية في الملف.</span>
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
            <dt className="text-xs text-muted">كلمات النص الرئيسي</dt>
            <dd className="m-0 text-xl font-bold">{understanding.mainTextWordCount.toLocaleString("en-US")}</dd>
          </div>
          <div className="flex flex-col-reverse gap-1 py-3">
            <dt className="text-xs text-muted">كلمات الملخص</dt>
            <dd className="m-0 text-xl font-bold">{understanding.abstractWordCount.toLocaleString("en-US")}</dd>
          </div>
          <div className="flex flex-col-reverse gap-1 py-3">
            <dt className="text-xs text-muted">عدد المراجع</dt>
            <dd className="m-0 text-xl font-bold">{understanding.referenceCount.toLocaleString("en-US")}</dd>
          </div>
          <div className="flex flex-col-reverse gap-1 py-3">
            <dt className="text-xs text-muted">الأشكال والجداول</dt>
            <dd className="m-0 text-lg font-bold">
              {arabicCount(understanding.figureCount, FIGURES)} · {arabicCount(understanding.tableCount, TABLES)}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}