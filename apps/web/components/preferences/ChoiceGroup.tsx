import type { ChoiceOption } from "@/lib/preferences/types";

const PILL_BASE =
  "inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-[3px] border px-4 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink";
const PILL_ON = "border-ink bg-ink font-semibold text-paper";
const PILL_OFF = "border-rule-strong bg-paper-raised text-ink hover:border-ink";

function OptionLabel({ label, latin }: { label: string; latin?: boolean }) {
  return latin ? (
    <span dir="ltr" className="font-latin">
      {label}
    </span>
  ) : (
    <span>{label}</span>
  );
}

type GroupFrameProps = {
  legend: string;
  hint?: string;
  hideLegend?: boolean;
  name: string;
  children: React.ReactNode;
};

function GroupFrame({ legend, hint, hideLegend, name, children }: GroupFrameProps) {
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <fieldset aria-describedby={hintId} className="m-0 min-w-0 border-0 p-0">
      <legend className={hideLegend ? "sr-only" : "mb-1 text-[13.5px] font-bold text-ink"}>{legend}</legend>
      {hint && (
        <p id={hintId} className="mb-2.5 text-xs text-muted">
          {hint}
        </p>
      )}
      <div className={`flex flex-wrap gap-2 ${hint || hideLegend ? "" : "mt-2.5"}`}>{children}</div>
    </fieldset>
  );
}

type SingleChoiceGroupProps<T extends string | number | null> = {
  legend: string;
  hint?: string;
  hideLegend?: boolean;
  name: string;
  options: ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SingleChoiceGroup<T extends string | number | null>({
  legend,
  hint,
  hideLegend,
  name,
  options,
  value,
  onChange,
}: SingleChoiceGroupProps<T>) {
  return (
    <GroupFrame legend={legend} hint={hint} hideLegend={hideLegend} name={name}>
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <label key={String(option.value)} className={`${PILL_BASE} ${checked ? PILL_ON : PILL_OFF}`}>
            <input
              type="radio"
              name={name}
              value={String(option.value)}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {checked && <span aria-hidden="true">✓</span>}
            <OptionLabel label={option.label} latin={option.latin} />
          </label>
        );
      })}
    </GroupFrame>
  );
}

type MultiChoiceGroupProps<T extends string> = {
  legend: string;
  hint?: string;
  name: string;
  options: ChoiceOption<T>[];
  values: T[];
  onToggle: (value: T) => void;
};

export function MultiChoiceGroup<T extends string>({
  legend,
  hint,
  name,
  options,
  values,
  onToggle,
}: MultiChoiceGroupProps<T>) {
  return (
    <GroupFrame legend={legend} hint={hint} name={name}>
      {options.map((option) => {
        const checked = values.includes(option.value);
        return (
          <label key={option.value} className={`${PILL_BASE} ${checked ? PILL_ON : PILL_OFF}`}>
            <input
              type="checkbox"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onToggle(option.value)}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className={`flex size-4 items-center justify-center rounded-[2px] border text-[11px] leading-none ${
                checked ? "border-paper" : "border-rule-strong"
              }`}
            >
              {checked ? "✓" : ""}
            </span>
            <OptionLabel label={option.label} latin={option.latin} />
          </label>
        );
      })}
    </GroupFrame>
  );
}