import { MultiChoiceGroup, SingleChoiceGroup } from "@/components/preferences/ChoiceGroup";
import {
  APC_OPTIONS,
  ARTICLE_TYPE_OPTIONS,
  IMPACT_FACTOR_OPTIONS,
  INDEX_OPTIONS,
  OPEN_ACCESS_OPTIONS,
  REVIEW_SPEED_OPTIONS,
} from "@/lib/preferences/options";
import type { ArticleType, JournalIndex, JournalPreferences } from "@/lib/preferences/types";

type PrioritiesSectionProps = {
  preferences: JournalPreferences;
  onChange: (next: JournalPreferences) => void;
  articleType: ArticleType | null;
  onArticleTypeChange: (next: ArticleType | null) => void;
};

export function PrioritiesSection({
  preferences,
  onChange,
  articleType,
  onArticleTypeChange,
}: PrioritiesSectionProps) {
  const update = <K extends keyof JournalPreferences>(key: K, value: JournalPreferences[K]) => {
    onChange({ ...preferences, [key]: value });
  };

  const toggleIndex = (index: JournalIndex) => {
    const selected = preferences.requiredIndexes.includes(index)
      ? preferences.requiredIndexes.filter((item) => item !== index)
      : [...preferences.requiredIndexes, index];
    const ordered = INDEX_OPTIONS.map((option) => option.value).filter((value) =>
      selected.includes(value),
    );
    update("requiredIndexes", ordered);
  };

  return (
    <section aria-labelledby="priorities-heading" className="w-full shrink-0 lg:w-[500px]">
      <h2 id="priorities-heading" className="text-2xl font-bold">
        ما الذي يهمك في المجلة؟
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-body">
        سنستخدم هذه الأولويات لترتيب المجلات الأنسب لبحثك.
      </p>

      <div className="mt-6 flex flex-col gap-6">
        <SingleChoiceGroup
          legend="نوع المقال"
          hint="نستبعد المجلات التي تعلن أنها لا تقبل هذا النوع من المقالات."
          name="article-type"
          options={ARTICLE_TYPE_OPTIONS}
          value={articleType}
          onChange={onArticleTypeChange}
        />
        <SingleChoiceGroup
          legend="رسوم النشر"
          hint="الرسوم التي تدفعها عند قبول البحث (APC)."
          name="apc"
          options={APC_OPTIONS}
          value={preferences.maxApcUsd}
          onChange={(value) => update("maxApcUsd", value)}
        />
        <SingleChoiceGroup
          legend="الوصول المفتوح"
          hint="حدد مدى أهمية إتاحة البحث للقراءة بوصول مفتوح."
          name="open-access"
          options={OPEN_ACCESS_OPTIONS}
          value={preferences.openAccess}
          onChange={(value) => update("openAccess", value)}
        />
        <SingleChoiceGroup
          legend="سرعة المراجعة"
          hint="المدة المتوقعة لمراجعة البحث قبل قرار المجلة."
          name="review-speed"
          options={REVIEW_SPEED_OPTIONS}
          value={preferences.maxReviewDays}
          onChange={(value) => update("maxReviewDays", value)}
        />
        <MultiChoiceGroup
          legend="الفهرسة"
          hint="إذا اخترت أكثر من فهرس، نعرض المجلات المفهرسة فيها جميعًا."
          name="indexing"
          options={INDEX_OPTIONS}
          values={preferences.requiredIndexes}
          onToggle={toggleIndex}
        />
        <div className="flex flex-col gap-3">
          <SingleChoiceGroup
            legend="معامل التأثير"
            hint="حدّد الحد الأدنى المفضّل لمعامل التأثير (JIF). ستُفضَّل المجلات التي تحقق هذا الحد، دون استبعاد غيرها إلا إذا فعّلت خيار الاستبعاد."
            name="impact-factor"
            options={IMPACT_FACTOR_OPTIONS}
            value={preferences.minImpactFactor}
            onChange={(value) =>
              onChange({
                ...preferences,
                minImpactFactor: value,
                excludeBelowImpactFactor: value === null ? false : preferences.excludeBelowImpactFactor,
              })
            }
          />
          <label
            className={`flex items-start gap-2 text-sm ${
              preferences.minImpactFactor === null ? "cursor-not-allowed text-muted" : "cursor-pointer text-ink"
            }`}
          >
            <input
              type="checkbox"
              checked={preferences.excludeBelowImpactFactor}
              disabled={preferences.minImpactFactor === null}
              onChange={(event) => update("excludeBelowImpactFactor", event.target.checked)}
              aria-describedby="impact-factor-exclude-hint"
              className="mt-0.5 size-4 accent-ink"
            />
            <span>
              استبعاد المجلات التي يقل معامل تأثيرها عن الحد المحدد
              <span id="impact-factor-exclude-hint" className="mt-0.5 block text-xs text-muted">
                لن تُستبعد المجلات التي لا تتوفر لها قيمة JIF
              </span>
            </span>
          </label>
        </div>
      </div>
    </section>
  );
}