import type { SuggestionTarget, WorkspaceManuscript } from "@/lib/workspace/types";

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function abstractWordCount(manuscript: WorkspaceManuscript): number {
  return countWords(manuscript.abstract) + manuscript.abstractWordOffset;
}

export function keywordsLine(keywords: string[]): string {
  return keywords.join("; ");
}

/* Replaces `from` with `to` in the suggestion's target. Used for accept (before→after) and undo (after→before). */
export function applySuggestionText(
  manuscript: WorkspaceManuscript,
  target: SuggestionTarget,
  from: string,
  to: string,
): WorkspaceManuscript {
  switch (target.kind) {
    case "abstract":
      return manuscript.abstract.includes(from)
        ? { ...manuscript, abstract: manuscript.abstract.replace(from, () => to) }
        : manuscript;
    case "keywords":
      return keywordsLine(manuscript.keywords) === from
        ? { ...manuscript, keywords: to.split("; ") }
        : manuscript;
    case "section":
      return {
        ...manuscript,
        sections: manuscript.sections.map((section) =>
          section.id !== target.sectionId
            ? section
            : {
                ...section,
                paragraphs: section.paragraphs.map((paragraph, index) =>
                  index === target.paragraphIndex && paragraph.text.includes(from)
                    ? { ...paragraph, text: paragraph.text.replace(from, () => to) }
                    : paragraph,
                ),
              },
        ),
      };
  }
}