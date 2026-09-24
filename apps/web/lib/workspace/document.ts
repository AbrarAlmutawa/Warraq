import { keywordsLine } from "@/lib/workspace/manuscript";
import type {
  AnchorKey,
  CitationStyle,
  DocumentSection,
  EditorRange,
  JournalWorkspaceRules,
  ManuscriptDocument,
  ReferenceEntry,
  WarraqSuggestion,
  WorkspaceManuscript,
} from "@/lib/workspace/types";

const CITE_PATTERN = /\{cite:([\d,]+)\}/g;

export function renderCitations(
  text: string,
  references: ReferenceEntry[],
  style: CitationStyle,
): { text: string; spans: Array<[number, number]> } {
  let output = "";
  let last = 0;
  const spans: Array<[number, number]> = [];

  for (const match of text.matchAll(CITE_PATTERN)) {
    const index = match.index ?? 0;
    output += text.slice(last, index);
    const ids = match[1].split(",").map(Number);
    const rendered =
      style === "APA"
        ? `(${ids.map((id) => references.find((reference) => reference.id === id)?.inText ?? "?").join("; ")})`
        : ids.map((id) => `[${id}]`).join(", ");
    spans.push([output.length, output.length + rendered.length]);
    output += rendered;
    last = index + match[0].length;
  }

  output += text.slice(last);
  return { text: output, spans };
}

/* Builds the text shown in Monaco plus the ranges of every known span. */
export function buildManuscriptDocument(
  manuscript: WorkspaceManuscript,
  rules: JournalWorkspaceRules,
  suggestions: WarraqSuggestion[],
): ManuscriptDocument {
  const lines: string[] = [];
  const anchors: Partial<Record<AnchorKey, EditorRange[]>> = {};
  const sections: DocumentSection[] = [];

  const add = (key: AnchorKey, range: EditorRange) => {
    (anchors[key] ??= []).push(range);
  };
  const push = (text: string): number => {
    lines.push(text);
    return lines.length;
  };
  const blank = () => {
    lines.push("");
  };
  const span = (line: number, start: number, end: number): EditorRange => ({
    startLineNumber: line,
    startColumn: start + 1,
    endLineNumber: line,
    endColumn: end + 1,
  });
  const whole = (line: number, text: string, from = 0) => span(line, from, text.length);

  const markSuggestions = (line: number, text: string, belongs: (suggestion: WarraqSuggestion) => boolean) => {
    for (const suggestion of suggestions) {
      if (!belongs(suggestion)) continue;
      const index = text.indexOf(suggestion.before);
      if (index >= 0) add(`suggestion:${suggestion.id}`, span(line, index, index + suggestion.before.length));
    }
  };

  const pushParagraph = (raw: string, belongs: (suggestion: WarraqSuggestion) => boolean): number => {
    const rendered = renderCitations(raw, manuscript.references, manuscript.citationStyle);
    const line = push(rendered.text);
    rendered.spans.forEach(([start, end]) => add("citations", span(line, start, end)));
    markSuggestions(line, rendered.text, belongs);
    return line;
  };

  // Title
  const titleText = `# ${manuscript.title}`;
  const titleLine = push(titleText);
  add("title", whole(titleLine, titleText, 2));
  sections.push({ id: "title", label: "Title", line: titleLine, missing: false });
  blank();

  // Abstract
  sections.push({ id: "abstract", label: "Abstract", line: push("## Abstract"), missing: false });
  const abstractLine = pushParagraph(manuscript.abstract, (suggestion) => suggestion.target.kind === "abstract");
  add("abstract", whole(abstractLine, lines[abstractLine - 1]));
  blank();

  // Keywords
  const keywordsPrefix = "Keywords: ";
  const keywordsText = keywordsPrefix + keywordsLine(manuscript.keywords);
  const keywordsLineNumber = push(keywordsText);
  add("keywords", whole(keywordsLineNumber, keywordsText, keywordsPrefix.length));
  for (const suggestion of suggestions) {
    if (suggestion.target.kind === "keywords" && keywordsLine(manuscript.keywords) === suggestion.before) {
      add(`suggestion:${suggestion.id}`, whole(keywordsLineNumber, keywordsText, keywordsPrefix.length));
    }
  }
  blank();

  // Highlights
  if (manuscript.highlights) {
    const heading = "## Highlights";
    const headingLine = push(heading);
    sections.push({ id: "highlights", label: "Highlights", line: headingLine, missing: false });
    add("highlights", whole(headingLine, heading, 3));
    manuscript.highlights.content.forEach((bullet) => {
      const text = `• ${bullet}`;
      add("highlights", whole(push(text), text));
    });
    blank();
  } else if (rules.highlights) {
    const marker = "[Required by this journal: Highlights — not found in the manuscript]";
    const markerLine = push(marker);
    add("highlights", whole(markerLine, marker));
    sections.push({ id: "highlights", label: "Highlights", line: markerLine, missing: true });
    blank();
  }

  // Body sections
  manuscript.sections.forEach((section, sectionIndex) => {
    const heading = `## ${sectionIndex + 1}. ${section.heading}`;
    sections.push({ id: section.id, label: section.heading, line: push(heading), missing: false });
    section.paragraphs.forEach((paragraph, paragraphIndex) => {
      const line = pushParagraph(
        paragraph.text,
        (suggestion) =>
          suggestion.target.kind === "section" &&
          suggestion.target.sectionId === section.id &&
          suggestion.target.paragraphIndex === paragraphIndex,
      );
      if (paragraph.anchor) add(paragraph.anchor, whole(line, lines[line - 1]));
    });
    blank();
  });

  // Data availability
  if (manuscript.dataAvailability) {
    const heading = "## Data Availability Statement";
    const headingLine = push(heading);
    sections.push({ id: "data-availability", label: "Data Availability", line: headingLine, missing: false });
    add("data-availability", whole(headingLine, heading, 3));
    const content = manuscript.dataAvailability.content;
    add("data-availability", whole(push(content), content));
    blank();
  } else if (rules.requiresDataAvailability) {
    const marker = "[Required by this journal: Data Availability Statement — not found in the manuscript]";
    const markerLine = push(marker);
    add("data-availability", whole(markerLine, marker));
    sections.push({ id: "data-availability", label: "Data Availability", line: markerLine, missing: true });
    blank();
  }

  // References
  const referencesHeading = "## References";
  const referencesLine = push(referencesHeading);
  sections.push({ id: "references", label: "References", line: referencesLine, missing: false });
  add("references", whole(referencesLine, referencesHeading, 3));
  manuscript.references.forEach((reference) => {
    const text = manuscript.citationStyle === "APA" ? reference.apa : reference.ieee;
    add("citations", whole(push(text), text));
  });
  push(`… (${manuscript.referenceCount - manuscript.references.length} more references)`);

  return { text: lines.join("\n"), lineCount: lines.length, anchors, sections };
}