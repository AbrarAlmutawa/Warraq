import type { ApiBlock, ApiParsedManuscript } from "@/lib/api-client";
import type { BlockDocument, BlockSection, EditorRange } from "@/lib/workspace/types";

/*
 * Builds the read-only Monaco document from the backend's parsed blocks.
 *
 * - One block = one editor line (whitespace collapsed); a blank line separates blocks.
 * - Every block id maps to the range of its own line, computed from the text built here,
 *   so validation block_ids can be highlighted without any hardcoded line numbers.
 * - Navigation uses the title block and heading blocks with their real text.
 * - Nothing is added that is not in the manuscript (no placeholder or "missing" lines).
 *   Table contents are not blocks in the backend parse, so only table captions appear.
 */

function orderedBlocks(blocks: readonly ApiBlock[]): ApiBlock[] {
  const allIndexed = blocks.every((block) => typeof block.paragraph_index === "number");
  if (!allIndexed) return [...blocks];
  // Array.prototype.sort is stable, so equal indexes keep the backend's order.
  return [...blocks].sort((a, b) => (a.paragraph_index as number) - (b.paragraph_index as number));
}

function normalizeBlockText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function buildBlockDocument(parsed: ApiParsedManuscript): BlockDocument {
  const lines: string[] = [];
  const blockRanges = new Map<string, EditorRange>();
  const sections: BlockSection[] = [];

  for (const block of orderedBlocks(parsed.blocks ?? [])) {
    const text = normalizeBlockText(block.text);
    if (!text || blockRanges.has(block.id)) continue;

    if (lines.length > 0) lines.push("");
    lines.push(text);
    const line = lines.length;

    blockRanges.set(block.id, {
      startLineNumber: line,
      startColumn: 1,
      endLineNumber: line,
      endColumn: text.length + 1,
    });

    if (block.type === "title" || block.type === "heading") {
      sections.push({
        blockId: block.id,
        kind: block.type === "title" ? "title" : "heading",
        label: text,
        line,
      });
    }
  }

  return {
    text: lines.join("\n"),
    lineCount: Math.max(1, lines.length),
    blockRanges,
    sections,
  };
}