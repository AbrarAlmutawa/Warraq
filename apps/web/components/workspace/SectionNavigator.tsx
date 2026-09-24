import type { WorkspaceDecoration } from "@/lib/workspace/decorations";
import type { CitationStyle, DocumentSection, ManuscriptFormat } from "@/lib/workspace/types";

type SectionNavigatorProps = {
  sections: DocumentSection[];
  decorations: WorkspaceDecoration[];
  lineCount: number;
  stats: {
    wordCount: number;
    referenceCount: number;
    figureCount: number;
    tableCount: number;
    citationStyle: CitationStyle;
    format: ManuscriptFormat;
  };
  onNavigate: (section: DocumentSection) => void;
};

type Marker = { text: string; className: string; srText: string };

function sectionMarker(section: DocumentSection, nextLine: number, decorations: WorkspaceDecoration[]): Marker {
  if (section.missing) {
    return {
      text: "مطلوب · غير موجود",
      className: "text-[11px] font-bold text-terracotta-text",
      srText: "قسم مطلوب غير موجود",
    };
  }
  const inSection = decorations.filter(
    (decoration) => decoration.range.startLineNumber >= section.line && decoration.range.startLineNumber < nextLine,
  );
  const unique = (kind: WorkspaceDecoration["kind"]) =>
    new Set(inSection.filter((decoration) => decoration.kind === kind).map((decoration) => decoration.target.id)).size;

  const hard = unique("hard");
  if (hard > 0) {
    return { text: `✕ ${hard}`, className: "text-xs font-bold text-terracotta-text", srText: `${hard} متطلب غير مستوفى` };
  }
  if (unique("review") > 0) {
    return { text: "◐", className: "text-xs font-bold text-muted", srText: "بند يحتاج مراجعة" };
  }
  if (unique("soft") > 0) {
    return {
      text: "اقتراح",
      className: "border border-dotted border-olive px-1.5 text-[11px] font-semibold text-olive-text",
      srText: "اقتراح من وَرَّاق",
    };
  }
  return { text: "✓", className: "text-xs font-bold text-mint-text", srText: "لا ملاحظات" };
}

export function SectionNavigator({ sections, decorations, lineCount, stats, onNavigate }: SectionNavigatorProps) {
  return (
    <nav
      aria-label="هيكل المخطوطة"
      className="hidden w-[220px] shrink-0 flex-col border-e border-rule px-3 py-4 lg:flex"
    >
      <p className="px-2 pb-2 text-xs font-semibold text-muted">هيكل البحث</p>
      <ul className="m-0 flex list-none flex-col gap-0.5 overflow-y-auto p-0">
        {sections.map((section, index) => {
          const nextLine = sections[index + 1]?.line ?? lineCount + 1;
          const marker = sectionMarker(section, nextLine, decorations);
          return (
            <li key={`${section.id}-${section.line}`}>
              <button
                type="button"
                onClick={() => onNavigate(section)}
                className="flex min-h-9 w-full items-center justify-between gap-2 rounded-[3px] px-2 py-1.5 text-start hover:bg-paper-raised"
              >
                <span dir="ltr" className={`font-latin text-[13px] ${section.missing ? "text-muted italic" : ""}`}>
                  {section.label}
                </span>
                <span aria-hidden="true" className={marker.className}>
                  {marker.text}
                </span>
                <span className="sr-only">{marker.srText}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto flex flex-col gap-1.5 border-t border-rule px-2 pt-3 text-xs text-muted">
        <span>
          {stats.wordCount.toLocaleString("en-US")} كلمة · {stats.referenceCount} مرجعًا
        </span>
        <span>
          {stats.figureCount} أشكال · {stats.tableCount} جداول
        </span>
        <span>
          الاستشهاد:{" "}
          <span dir="ltr" className="font-latin font-semibold text-ink">
            {stats.citationStyle}
          </span>{" "}
          · الصيغة:{" "}
          <span dir="ltr" className="font-latin font-semibold text-ink">
            {stats.format === "latex" ? "LaTeX" : "DOCX"}
          </span>
        </span>
        <span className="leading-relaxed">تغيير المجلة لا يعيد تحليل البحث.</span>
      </div>
    </nav>
  );
}