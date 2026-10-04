"""
Export a manuscript revision as a LaTeX project (S4).

Input: the DOCX of a revision plus the parser's view of it (block types such as
title, heading, keywords, reference, captions). Output: a zip with

    main.tex        the paper (article class; works on Overleaf or locally)
    figures/        images taken from the Word file
    README.txt      how to compile

Mapping:
    title / author lines   -> \\title, \\author, \\maketitle
    Abstract + Keywords    -> abstract environment
    headings               -> \\section / \\subsection / \\subsubsection (numbers dropped,
                              LaTeX numbers them); statements and Highlights -> \\section*
    paragraphs             -> text with bold / italic kept
    images + captions      -> figure environments
    tables + captions      -> table environments (tabularx)
    references             -> thebibliography; numeric citations [1], [2-4] -> \\cite

The exporter never invents content: anything it cannot convert (for example an
image format LaTeX can't include) is kept as a visible LaTeX comment.
"""

import io
import re
import zipfile
from dataclasses import dataclass, field

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph

from models.journal import CitationStyle
from services.analyzer.models import ManuscriptParsedData
from services.validator import detect_citation_style

UNNUMBERED_SECTIONS = {
    "highlights", "data availability statement", "data availability", "funding", "ethics statement",
    "conflict of interest", "conflicts of interest", "competing interests", "acknowledgments",
    "acknowledgements", "author contributions", "declarations",
}

# Characters pdfLaTeX can't take directly, mapped to LaTeX.
UNICODE_TO_LATEX = {
    "\u2264": r"$\leq$", "\u2265": r"$\geq$", "\u00d7": r"$\times$", "\u00b1": r"$\pm$",
    "\u2212": r"$-$", "\u2248": r"$\approx$", "\u2260": r"$\neq$", "\u2192": r"$\rightarrow$",
    "\u2190": r"$\leftarrow$", "\u221e": r"$\infty$", "\u00b0": r"\textdegree{}", "\u00b5": r"\textmu{}",
    "\u03bc": r"$\mu$", "\u03b1": r"$\alpha$", "\u03b2": r"$\beta$", "\u03b3": r"$\gamma$",
    "\u03b4": r"$\delta$", "\u03bb": r"$\lambda$", "\u03c3": r"$\sigma$", "\u2022": r"\textbullet{}",
    "\u2026": r"\ldots{}", "\u00a0": "~", "\u2009": r"\,", "\u2010": "-", "\u2011": "-",
}

ARABIC = re.compile(r"[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]")
LEADING_NUMBER = re.compile(r"^\s*(?:\d+(?:\.\d+)*\.?|[IVXLC]+\.)\s+")
CAPTION_PREFIX = re.compile(r"^\s*(?:figure|fig\.?|table)\s*\d+\s*[.:\-\u2013]?\s*", re.IGNORECASE)
REF_PREFIX = re.compile(r"^\s*(?:\[\d+\]|\d+\.)\s*")
NUMERIC_CITATION = re.compile(r"\[(\d+(?:\s*[\u2013\-]\s*\d+)?(?:\s*,\s*\d+(?:\s*[\u2013\-]\s*\d+)?)*)\]")
GRAPHIC_EXTENSIONS = {"png": ".png", "jpeg": ".jpg", "jpg": ".jpg", "gif": None, "bmp": None,
                      "emf": None, "wmf": None, "tiff": None, "svg+xml": None, "pdf": ".pdf"}


def escape(text: str, *, unicode_safe: bool = True) -> str:
    """Escape LaTeX special characters (and, for pdfLaTeX, common symbols)."""
    out = []
    for ch in text:
        if ch == "\\":
            out.append(r"\textbackslash{}")
        elif ch in "&%$#_{}":
            out.append("\\" + ch)
        elif ch == "~":
            out.append(r"\textasciitilde{}")
        elif ch == "^":
            out.append(r"\textasciicircum{}")
        elif unicode_safe and ch in UNICODE_TO_LATEX:
            out.append(UNICODE_TO_LATEX[ch])
        else:
            out.append(ch)
    return "".join(out)


@dataclass
class _Context:
    parsed: ManuscriptParsedData
    xelatex: bool
    numeric_citations: bool
    figures: dict[str, bytes] = field(default_factory=dict)
    lines: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def _block_map(parsed: ManuscriptParsedData):
    return {block.paragraph_index: block for block in parsed.blocks}


def _plain(paragraph: Paragraph, ctx: _Context) -> str:
    return _cite(escape(paragraph.text.strip(), unicode_safe=not ctx.xelatex), ctx)


def _rich(paragraph: Paragraph, ctx: _Context) -> str:
    """Paragraph text with bold and italic runs kept."""
    parts = []
    for run in paragraph.runs:
        if not run.text:
            continue
        text = escape(run.text, unicode_safe=not ctx.xelatex)
        if run.bold and text.strip():
            text = rf"\textbf{{{text}}}"
        if run.italic and text.strip():
            text = rf"\textit{{{text}}}"
        parts.append(text)
    text = "".join(parts).strip() or escape(paragraph.text.strip(), unicode_safe=not ctx.xelatex)
    return _cite(_language(text, paragraph.text, ctx), ctx)


def _arabic_share(raw: str) -> float:
    letters = [c for c in raw if c.isalpha()]
    return (sum(bool(ARABIC.match(c)) for c in letters) / len(letters)) if letters else 0.0


def _language(latex: str, raw: str, ctx: _Context) -> str:
    """Mark paragraphs written in the document's other language so XeLaTeX sets their direction."""
    if not ctx.xelatex or not raw.strip():
        return latex
    share = _arabic_share(raw)
    if getattr(ctx, "arabic_main", False):
        return rf"\begin{{english}}{latex}\end{{english}}" if share < 0.5 else latex
    return rf"\begin{{Arabic}}{latex}\end{{Arabic}}" if share > 0.5 else latex


def _cite(text: str, ctx: _Context) -> str:
    if not ctx.numeric_citations:
        return text

    def replace(match):
        keys = []
        for part in match.group(1).split(","):
            bounds = re.split(r"\s*[\u2013\-]\s*", part.strip())
            if len(bounds) == 2 and bounds[0].isdigit() and bounds[1].isdigit() and int(bounds[1]) - int(bounds[0]) < 50:
                keys += [f"ref{n}" for n in range(int(bounds[0]), int(bounds[1]) + 1)]
            elif bounds[0].isdigit():
                keys.append(f"ref{bounds[0]}")
        return rf"\cite{{{','.join(keys)}}}" if keys else match.group(0)

    return NUMERIC_CITATION.sub(replace, text)


def _images(paragraph: Paragraph, ctx: _Context) -> list[str]:
    """Save the paragraph's inline images into figures/ and return their paths."""
    paths = []
    for blip in paragraph._p.xpath(".//a:blip"):
        rid = blip.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed")
        part = paragraph.part.related_parts.get(rid) if rid else None
        if part is None:
            continue
        kind = part.content_type.split("/")[-1].lower()
        extension = GRAPHIC_EXTENSIONS.get(kind)
        if extension is None:
            ctx.notes.append(f"An image in {kind.upper()} format was left out; export it as PNG and add it by hand.")
            paths.append(None)
            continue
        name = f"figures/figure{len(ctx.figures) + 1}{extension}"
        ctx.figures[name] = part.blob
        paths.append(name)
    return paths


def _heading_command(paragraph: Paragraph, text: str) -> str:
    style = (paragraph.style.name if paragraph.style is not None else "").lower()
    number = re.match(r"^\s*(\d+(?:\.\d+)*)", text)
    depth = number.group(1).count(".") + 1 if number else 1
    if "heading 3" in style or depth >= 3:
        return "subsubsection"
    if "heading 2" in style or depth == 2:
        return "subsection"
    return "section"


def _table(table: Table, caption: str | None, ctx: _Context) -> list[str]:
    rows = []
    for row in table.rows:
        cells, seen = [], set()
        for cell in row.cells:
            if id(cell._tc) in seen:  # merged cells repeat; keep one
                continue
            seen.add(id(cell._tc))
            cells.append(escape(" ".join(p.text.strip() for p in cell.paragraphs).strip(), unicode_safe=not ctx.xelatex))
        rows.append(cells)
    if not rows:
        return []
    columns = max(len(r) for r in rows)
    out = [r"\begin{table}[htbp]", r"\centering", r"\small"]
    if caption:
        out.append(rf"\caption{{{caption}}}")
    out.append(rf"\begin{{tabularx}}{{\linewidth}}{{{'X' * columns}}}")
    out.append(r"\toprule")
    for i, cells in enumerate(rows):
        cells = cells + [""] * (columns - len(cells))
        out.append(" & ".join(cells) + r" \\")
        if i == 0 and len(rows) > 1:
            out.append(r"\midrule")
    out += [r"\bottomrule", r"\end{tabularx}", r"\end{table}", ""]
    return out


def _caption_text(paragraph: Paragraph, ctx: _Context) -> str:
    return CAPTION_PREFIX.sub("", _plain(paragraph, ctx))


def _preamble(title: str, authors: list[str], ctx: _Context, arabic_main: bool) -> list[str]:
    lines = [r"\documentclass[11pt]{article}"]
    if ctx.xelatex:
        lines.append(r"% Compile with XeLaTeX (Overleaf: Menu > Compiler > XeLaTeX).")
    lines += [
        r"\usepackage[margin=2.5cm]{geometry}",
        r"\usepackage{graphicx}",
        r"\usepackage{booktabs}",
        r"\usepackage{tabularx}",
        r"\usepackage{amssymb}",
    ]
    if not ctx.xelatex:
        lines.append(r"\usepackage{textcomp}")
    lines.append(r"\usepackage[hidelinks]{hyperref}")
    if ctx.xelatex:
        # polyglossia loads bidi, which has to come after hyperref.
        lines += [
            r"\usepackage{fontspec}",
            r"\usepackage{polyglossia}",
            r"\setmainlanguage{arabic}" if arabic_main else r"\setmainlanguage{english}",
            r"\setotherlanguage{english}" if arabic_main else r"\setotherlanguage{arabic}",
            r"\newfontfamily\arabicfont[Script=Arabic]{Amiri}",
        ]
        if arabic_main:
            lines.append(r"\setmainfont[Script=Arabic]{Amiri}")
    author = (r"\author{" + " \\\\ ".join(authors) + "}") if authors else r"\author{}"
    lines += ["", rf"\title{{{title}}}", author, r"\date{}", "", r"\begin{document}", r"\maketitle", ""]
    return lines


def to_latex(docx: bytes, parsed: ManuscriptParsedData) -> tuple[str, dict[str, bytes], list[str], bool]:
    """Returns (main.tex text, figure files, notes for the researcher, needs XeLaTeX)."""
    doc = Document(io.BytesIO(docx))
    blocks = _block_map(parsed)
    full_text = parsed.full_text
    letters = [c for c in full_text if c.isalpha()]
    arabic_share = (sum(bool(ARABIC.match(c)) for c in letters) / len(letters)) if letters else 0
    ctx = _Context(
        parsed=parsed,
        xelatex=arabic_share > 0.02,
        numeric_citations=detect_citation_style(parsed.references) == CitationStyle.IEEE,
    )
    ctx.arabic_main = arabic_share > 0.5

    # Walk the body in order: paragraphs and tables.
    elements = []
    index = 0
    for child in doc.element.body.iterchildren():
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "p":
            elements.append(("p", index, Paragraph(child, doc)))
            index += 1
        elif tag == "tbl":
            elements.append(("tbl", None, Table(child, doc)))

    title = escape(parsed.title or "Untitled", unicode_safe=not ctx.xelatex)
    authors: list[str] = []
    body: list[str] = []
    in_abstract = in_references = in_itemize = False
    seen_heading = False
    references = 0
    used_captions: set[int] = set()

    def close_open():
        nonlocal in_abstract, in_itemize
        if in_itemize:
            body.append(r"\end{itemize}")
            in_itemize = False
        if in_abstract:
            body.extend([r"\end{abstract}", ""])
            in_abstract = False

    for position, (kind, p_index, element) in enumerate(elements):
        if kind == "tbl":
            caption = None
            nxt = elements[position + 1] if position + 1 < len(elements) else None
            prv = elements[position - 1] if position > 0 else None
            for neighbour in (nxt, prv):
                if neighbour and neighbour[0] == "p":
                    block = blocks.get(neighbour[1])
                    if block and block.type == "table_caption" and neighbour[1] not in used_captions:
                        caption = _caption_text(neighbour[2], ctx)
                        used_captions.add(neighbour[1])
                        break
            body += _table(element, caption, ctx)
            continue

        paragraph: Paragraph = element
        block = blocks.get(p_index)
        images = _images(paragraph, ctx)

        if images:
            caption = None
            for offset in (1, -1):
                k = position + offset
                if 0 <= k < len(elements) and elements[k][0] == "p":
                    neighbour_block = blocks.get(elements[k][1])
                    if neighbour_block and neighbour_block.type == "figure_caption" and elements[k][1] not in used_captions:
                        caption = _caption_text(elements[k][2], ctx)
                        used_captions.add(elements[k][1])
                        break
            for path in images:
                if path is None:
                    body.append("% [image omitted: unsupported format, add it as PNG]")
                    continue
                body += [r"\begin{figure}[htbp]", r"\centering",
                         rf"\includegraphics[width=0.8\linewidth]{{{path}}}"]
                if caption:
                    body.append(rf"\caption{{{caption}}}")
                body += [r"\end{figure}", ""]
            if block is None or not paragraph.text.strip():
                continue

        if block is None:
            continue
        if p_index in used_captions:
            continue

        text = paragraph.text.strip()
        if block.type == "title":
            continue
        if not seen_heading and block.section is None and block.type == "paragraph":
            authors.append(_plain(paragraph, ctx))
            continue

        if block.type == "heading":
            seen_heading = True
            close_open()
            name = (block.section or text).strip()
            key = name.lower()
            if key == "abstract":
                body.append(r"\begin{abstract}")
                in_abstract = True
                continue
            if key == "references" or key == "bibliography":
                in_references = True
                body += [rf"\begin{{thebibliography}}{{{max(len(parsed.references), 9)}}}"]
                continue
            heading = escape(LEADING_NUMBER.sub("", text), unicode_safe=not ctx.xelatex)
            if key in UNNUMBERED_SECTIONS:
                body.append(rf"\section*{{{heading}}}")
                if key == "highlights":
                    body.append(r"\begin{itemize}")
                    in_itemize = True
            else:
                body.append(rf"\{_heading_command(paragraph, text)}{{{heading}}}")
            continue

        if in_references:
            if block.type == "reference" or REF_PREFIX.match(text):
                references += 1
                raw_reference = REF_PREFIX.sub("", text)
                content = escape(raw_reference, unicode_safe=not ctx.xelatex)
                if ctx.xelatex and getattr(ctx, "arabic_main", False) and _arabic_share(raw_reference) < 0.5:
                    content = rf"\textenglish{{{content}}}"
                body.append(rf"\bibitem{{ref{references}}} {content}")
            continue

        if block.type == "keywords":
            keywords = re.sub(r"^\s*(key\s*words|keywords|index terms)\s*[:\u2014\-]\s*", "", text, flags=re.I)
            body += ["", rf"\noindent\textbf{{Keywords:}} {escape(keywords, unicode_safe=not ctx.xelatex)}"]
            continue

        if block.type in {"table_caption", "figure_caption"}:
            # A caption with no table or figure next to it: keep it as text.
            body += [rf"\noindent\textit{{{_plain(paragraph, ctx)}}}", ""]
            continue

        if in_itemize:
            body.append(rf"\item {_rich(paragraph, ctx).lstrip(chr(0x2022)).lstrip()}")
            continue

        body += [_rich(paragraph, ctx), ""]

    close_open()
    if in_references:
        body.append(r"\end{thebibliography}")

    tex = _preamble(title, authors, ctx, ctx.arabic_main) + body + ["", r"\end{document}", ""]
    return "\n".join(tex), ctx.figures, ctx.notes, ctx.xelatex


def latex_zip(docx: bytes, parsed: ManuscriptParsedData, *, folder: str = "manuscript") -> bytes:
    tex, figures, notes, xelatex = to_latex(docx, parsed)
    engine = "XeLaTeX" if xelatex else "pdfLaTeX"
    readme = [
        "LaTeX export from Warraq",
        "",
        f"Compile main.tex with {engine} (run it twice so references and numbering settle).",
        "On Overleaf: New Project > Upload Project > choose this zip"
        + (", then Menu > Compiler > XeLaTeX." if xelatex else "."),
        "",
        "This is a clean article-class version of your manuscript. If the journal provides its own",
        "LaTeX template, copy the sections from main.tex into it.",
    ]
    if notes:
        readme += ["", "Please check:"] + [f"- {note}" for note in dict.fromkeys(notes)]
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(f"{folder}/main.tex", tex)
        archive.writestr(f"{folder}/README.txt", "\n".join(readme) + "\n")
        for name, data in figures.items():
            archive.writestr(f"{folder}/{name}", data)
    return buffer.getvalue()
