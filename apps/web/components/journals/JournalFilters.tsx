import type { ReactNode } from "react";
import type { JournalFilterState } from "@/lib/journals/filters";
import { INDEX_OPTIONS } from "@/lib/preferences/options";
import type { JournalIndex } from "@/lib/preferences/types";

type JournalFiltersProps = {
  filters: JournalFilterState;
  onChange: (next: JournalFilterState) => void;
  onClear: () => void;
  activeCount: number;
  showBudgetFilter: boolean;
  reviewThreshold: number;
};

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-[3px] border px-3 text-[13px] transition-colors ${
        pressed
          ? "border-ink bg-ink font-semibold text-paper"
          : "border-rule-strong bg-paper-raised text-ink hover:border-ink"
      }`}
    >
      {pressed && <span aria-hidden="true">✓</span>}
      {children}
    </button>
  );
}

function FilterGroup({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div role="group" aria-labelledby={id} className="flex items-center gap-2">
      <span id={id} className="text-[12.5px] text-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

export function JournalFilters({
  filters,
  onChange,
  onClear,
  activeCount,
  showBudgetFilter,
  reviewThreshold,
}: JournalFiltersProps) {
  const toggle = (key: "withinBudget" | "freeOnly" | "openAccessAvailable" | "fastReview") =>
    onChange({ ...filters, [key]: !filters[key] });

  const toggleIndex = (index: JournalIndex) => {
    const indexes = filters.indexes.includes(index)
      ? filters.indexes.filter((item) => item !== index)
      : [...filters.indexes, index];
    onChange({ ...filters, indexes });
  };

  return (
    <div
      role="group"
      aria-label="تصفية النتائج"
      className="mt-5 flex flex-wrap items-center gap-x-7 gap-y-3"
    >
      <FilterGroup id="filter-apc" label="رسوم النشر">
        {showBudgetFilter && (
          <Chip pressed={filters.withinBudget} onClick={() => toggle("withinBudget")}>
            ضمن ميزانيتك
          </Chip>
        )}
        <Chip pressed={filters.freeOnly} onClick={() => toggle("freeOnly")}>
          مجانية
        </Chip>
      </FilterGroup>

      <FilterGroup id="filter-oa" label="الوصول المفتوح">
        <Chip pressed={filters.openAccessAvailable} onClick={() => toggle("openAccessAvailable")}>
          متاح
        </Chip>
      </FilterGroup>

      <FilterGroup id="filter-review" label="سرعة المراجعة">
        <Chip pressed={filters.fastReview} onClick={() => toggle("fastReview")}>
          {reviewThreshold} يومًا أو أقل
        </Chip>
      </FilterGroup>

      <FilterGroup id="filter-index" label="الفهرسة">
        {INDEX_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            pressed={filters.indexes.includes(option.value)}
            onClick={() => toggleIndex(option.value)}
          >
            <span dir="ltr" className="font-latin">
              {option.label}
            </span>
          </Chip>
        ))}
      </FilterGroup>

      {activeCount > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="h-9 px-1 text-[13px] text-ink underline underline-offset-4 hover:text-terracotta-text"
        >
          مسح الفلاتر
        </button>
      )}
    </div>
  );
}