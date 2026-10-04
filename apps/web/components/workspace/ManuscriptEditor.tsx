"use client";

import Editor, { type BeforeMount, type EditorProps, type OnMount } from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";
import { setupLocalMonaco } from "@/components/workspace/monaco/setupMonaco";
import type { DecorationKind, WorkspaceDecoration } from "@/lib/workspace/decorations";
import type { EditorRange, SelectedItem } from "@/lib/workspace/types";
import "./manuscript-editor.css";

// Use the locally bundled Monaco (no CDN). Runs once, in the browser only.
setupLocalMonaco();

type EditorInstance = Parameters<OnMount>[0];
type MonacoApi = Parameters<OnMount>[1];
type DecorationsCollection = ReturnType<EditorInstance["createDecorationsCollection"]>;

type ManuscriptEditorProps = {
  /* The saved text of the current version (one paragraph per line, blank lines between). */
  value: string;
  /* The researcher has typed changes that are not saved yet: never overwrite them. */
  dirty: boolean;
  /* False when the manuscript can't be edited (uploaded before editing existed). */
  editable: boolean;
  decorations: WorkspaceDecoration[];
  revealRange: EditorRange | null;
  revealNonce: number;
  onSelectTarget: (target: SelectedItem) => void;
  /* Every change the researcher types (the whole editor text). */
  onChangeText: (text: string) => void;
  /* The editor lost focus: a good moment to save. */
  onBlur: () => void;
};

const THEME = "warraq-paper";

const INLINE_CLASS: Record<DecorationKind, string> = {
  hard: "warraq-deco-hard",
  soft: "warraq-deco-soft",
  review: "warraq-deco-review",
};

const GLYPH_CLASS: Record<DecorationKind, string> = {
  hard: "warraq-glyph-hard",
  soft: "warraq-glyph-soft",
  review: "warraq-glyph-review",
};

const RULER_COLOR: Record<DecorationKind, string> = {
  hard: "#E8593E",
  soft: "#7C8B6B",
  review: "#8C857A",
};

const EDITOR_OPTIONS: EditorProps["options"] = {
  readOnlyMessage: { value: "التعديل غير متاح لهذه النسخة. ارفع الملف نفسه مرة أخرى لتفعيله." },
  ariaLabel: "نص المخطوطة (قابل للتعديل)",
  wordWrap: "on",
  wrappingIndent: "none",
  minimap: { enabled: false },
  glyphMargin: true,
  lineNumbers: "on",
  lineNumbersMinChars: 3,
  lineDecorationsWidth: 8,
  folding: false,
  scrollBeyondLastLine: false,
  renderLineHighlight: "none",
  fontSize: 14,
  lineHeight: 26,
  fontFamily: "var(--font-plex-sans), ui-sans-serif, system-ui, sans-serif",
  padding: { top: 24, bottom: 48 },
  overviewRulerLanes: 2,
  hideCursorInOverviewRuler: true,
  contextmenu: false,
  selectionHighlight: false,
  matchBrackets: "never",
  renderWhitespace: "none",
  links: false,
  guides: { indentation: false },
  unicodeHighlight: { ambiguousCharacters: false, invisibleCharacters: false, nonBasicASCII: false },
  automaticLayout: true,
};

/* Index of the paragraph (non-empty line) the cursor is on, so it can be restored after the text is reloaded. */
function paragraphIndexAt(lines: string[], lineNumber: number): number {
  let index = -1;
  for (let i = 0; i < Math.min(lineNumber, lines.length); i += 1) {
    if (lines[i].trim()) index += 1;
  }
  return Math.max(index, 0);
}

function lineOfParagraph(lines: string[], paragraph: number): number {
  let index = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim()) {
      index += 1;
      if (index === paragraph) return i + 1;
    }
  }
  return Math.max(lines.length, 1);
}

function containsPosition(range: EditorRange, line: number, column: number): boolean {
  if (line < range.startLineNumber || line > range.endLineNumber) return false;
  if (line === range.startLineNumber && column < range.startColumn) return false;
  if (line === range.endLineNumber && column > range.endColumn) return false;
  return true;
}

function rangeSize(range: EditorRange): number {
  return (range.endLineNumber - range.startLineNumber) * 100000 + (range.endColumn - range.startColumn);
}

const defineTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme(THEME, {
    base: "vs",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#FBF8F2",
      "editor.foreground": "#1B1B2F",
      "editorGutter.background": "#FBF8F2",
      "editorLineNumber.foreground": "#B7B0A6",
      "editorLineNumber.activeForeground": "#4A4640",
      "editorCursor.foreground": "#1B1B2F",
      "editor.selectionBackground": "#E8593E33",
      "editor.inactiveSelectionBackground": "#E8593E26",
      "editor.lineHighlightBackground": "#F4EFE6",
      "editorOverviewRuler.border": "#00000000",
      "editorHoverWidget.background": "#F4EFE6",
      "editorHoverWidget.border": "#D9D0C0",
      "editorWidget.background": "#F4EFE6",
      "scrollbarSlider.background": "#B7B0A666",
      "scrollbarSlider.hoverBackground": "#8C857A88",
      "scrollbarSlider.activeBackground": "#8C857AAA",
    },
  });
};

export function ManuscriptEditor({
  value,
  dirty,
  editable,
  decorations,
  revealRange,
  revealNonce,
  onSelectTarget,
  onChangeText,
  onBlur,
}: ManuscriptEditorProps) {
  const editorRef = useRef<EditorInstance | null>(null);
  const monacoRef = useRef<MonacoApi | null>(null);
  const collectionRef = useRef<DecorationsCollection | null>(null);
  const decorationsRef = useRef(decorations);
  const onSelectRef = useRef(onSelectTarget);
  const onChangeTextRef = useRef(onChangeText);
  const onBlurRef = useRef(onBlur);
  // True while the editor text is replaced from `value` (not typed by the researcher).
  const applyingValueRef = useRef(false);
  const revealRangeRef = useRef(revealRange);
  const [ready, setReady] = useState(false);

  // Keep latest values for Monaco event handlers
  useEffect(() => {
    decorationsRef.current = decorations;
    onSelectRef.current = onSelectTarget;
    onChangeTextRef.current = onChangeText;
    onBlurRef.current = onBlur;
    revealRangeRef.current = revealRange;
  });

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    collectionRef.current = editor.createDecorationsCollection();

    editor.onMouseDown((event) => {
      const position = event.target.position;
      if (!position) return;
      const hits = decorationsRef.current.filter((decoration) =>
        containsPosition(decoration.range, position.lineNumber, position.column),
      );
      if (hits.length === 0) return;
      hits.sort((a, b) => rangeSize(a.range) - rangeSize(b.range));
      onSelectRef.current(hits[0].target);
    });

    editor.onDidChangeModelContent(() => {
      if (!applyingValueRef.current) onChangeTextRef.current(editor.getValue());
    });
    editor.onDidBlurEditorText(() => onBlurRef.current());

    void document.fonts.ready.then(() => monaco.editor.remeasureFonts());
    setReady(true);
  };

  // A new saved version arrived: show it, unless the researcher has unsaved typing.
  // The cursor stays on the same paragraph even if blank lines around it changed.
  useEffect(() => {
    const editor = editorRef.current;
    if (!ready || !editor || dirty) return;
    const current = editor.getValue();
    if (current === value) return;
    const position = editor.getPosition();
    const scrollTop = editor.getScrollTop();
    const paragraph = position ? paragraphIndexAt(current.split(/\r?\n/), position.lineNumber) : 0;
    applyingValueRef.current = true;
    editor.setValue(value);
    applyingValueRef.current = false;
    if (position && editor.hasTextFocus()) {
      const line = lineOfParagraph(value.split(/\r?\n/), paragraph);
      editor.setPosition({ lineNumber: line, column: position.column });
    }
    editor.setScrollTop(scrollTop);
  }, [value, dirty, ready]);

  useEffect(() => {
    editorRef.current?.updateOptions({ readOnly: !editable });
  }, [editable, ready]);

  // Decorations: replaced as a whole on every validation/selection change
  useEffect(() => {
    const monaco = monacoRef.current;
    const collection = collectionRef.current;
    if (!ready || !monaco || !collection) return;
    collection.set(
      decorations.map((decoration) => ({
        range: decoration.range,
        options: {
          inlineClassName: `${INLINE_CLASS[decoration.kind]}${decoration.selected ? " warraq-deco-selected" : ""}`,
          glyphMarginClassName: GLYPH_CLASS[decoration.kind],
          glyphMarginHoverMessage: { value: decoration.message },
          hoverMessage: { value: decoration.message },
          overviewRuler: {
            color: RULER_COLOR[decoration.kind],
            position: monaco.editor.OverviewRulerLane.Center,
          },
        },
      })),
    );
  }, [decorations, value, ready]);

  // Reveal a range when a new request (nonce) arrives
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const range = revealRangeRef.current;
    if (!ready || !editor || !monaco || !range || revealNonce === 0) return;
    editor.revealRangeInCenter(range, monaco.editor.ScrollType.Smooth);
    editor.setSelection(range);
  }, [revealNonce, ready]);

  return (
    <div dir="ltr" className="h-full w-full">
      <Editor
        height="100%"
        language="plaintext"
        defaultValue={value}
        theme={THEME}
        beforeMount={defineTheme}
        onMount={handleMount}
        options={EDITOR_OPTIONS}
        loading={<div className="text-sm text-muted">يُحمَّل محرر المخطوطة…</div>}
      />
    </div>
  );
}