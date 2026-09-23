from pathlib import Path
import re

from docx import Document

from models import ManuscriptParsedData, SectionInfo, Block


SAMPLE_PATH = Path(__file__).parent / "samples" / "demo.docx"


def count_words(text: str) -> int:
    """
    Count words in Arabic or English text.
    """
    words = re.findall(r"\b[\w'-]+\b", text, flags=re.UNICODE)
    return len(words)


def extract_title(doc: Document) -> str:
    """
    Extract the manuscript title.

    First, look for a paragraph using Word's 'Title' style.
    If no Title style exists, use the first non-empty paragraph.
    """
    for paragraph in doc.paragraphs:
        text = paragraph.text.strip()

        if (
            text
            and paragraph.style
            and paragraph.style.name.lower() == "title"
        ):
            return text

    for paragraph in doc.paragraphs:
        text = paragraph.text.strip()

        if text:
            return text

    return ""


def extract_abstract(doc: Document) -> str:
    """
    Extract the abstract from the manuscript.

    Start after a heading called 'Abstract' or 'الملخص'
    and stop when the next heading begins.
    """
    collecting = False
    abstract_parts = []

    for paragraph in doc.paragraphs:
        text = paragraph.text.strip()

        if not text:
            continue

        style_name = paragraph.style.name.lower() if paragraph.style else ""

        if text.lower() in {"abstract", "الملخص"}:
            collecting = True
            continue

        if collecting and style_name.startswith("heading"):
            break

        if collecting:
            if text.lower().startswith("keywords:"):
                continue

            if text.startswith("الكلمات المفتاحية"):
                continue

            abstract_parts.append(text)

    return "\n".join(abstract_parts)


def normalize_heading_name(text: str) -> str:
    """
    Remove numbering from section headings.

    Examples:
    '1. Introduction' -> 'Introduction'
    '2 Methodology' -> 'Methodology'
    '3.1 Data Collection' -> 'Data Collection'
    """
    text = text.strip()

    cleaned = re.sub(
        r"^\s*\d+(?:\.\d+)*[\.\)]?\s*",
        "",
        text,
    )

    return cleaned.strip()


def extract_sections(doc: Document) -> dict[str, str]:
    """
    Extract manuscript sections using Word heading styles.
    """
    sections = {}
    current_section = None
    current_parts = []

    for paragraph in doc.paragraphs:
        text = paragraph.text.strip()

        if not text:
            continue

        style_name = (
            paragraph.style.name.lower()
            if paragraph.style
            else ""
        )

        if style_name.startswith("heading"):
            if current_section is not None:
                sections[current_section] = "\n".join(current_parts).strip()

            current_section = normalize_heading_name(text)
            current_parts = []
            continue

        if current_section is not None:
            if (
                current_section.lower() == "abstract"
                and (
                    text.lower().startswith("keywords:")
                    or text.startswith("الكلمات المفتاحية")
                )
            ):
                continue

            current_parts.append(text)

    if current_section is not None:
        sections[current_section] = "\n".join(current_parts).strip()

    return sections


def looks_like_reference(text: str) -> bool:
    """
    Check whether a paragraph looks like a bibliography reference.
    Supports common author-year and numbered reference formats.
    """
    text = text.strip()

    if not text:
        return False

    has_year = re.search(
        r"\((?:19|20)\d{2}[a-z]?\)",
        text,
        flags=re.IGNORECASE,
    )

    numbered_brackets = re.match(
        r"^\s*\[\d+\]\s+",
        text,
    )

    numbered_list = re.match(
        r"^\s*\d+\.\s+",
        text,
    )

    return bool(
        has_year
        or numbered_brackets
        or numbered_list
    )


def extract_references(doc: Document) -> list[str]:
    """
    Extract individual references from the References section.
    """
    references = []
    collecting = False

    reference_headings = {
        "references",
        "bibliography",
        "المراجع",
    }

    for paragraph in doc.paragraphs:
        text = paragraph.text.strip()

        if not text:
            continue

        style_name = (
            paragraph.style.name.lower()
            if paragraph.style
            else ""
        )

        normalized_heading = normalize_heading_name(text).lower()

        if normalized_heading in reference_headings:
            collecting = True
            continue

        if collecting and style_name.startswith("heading"):
            break

        if collecting and looks_like_reference(text):
            references.append(text)

    return references


BODY_EXCLUDED_SECTIONS = {
    "abstract",
    "references",
    "bibliography",
    "data availability statement",
    "acknowledgements",
    "acknowledgments",
    "الملخص",
    "المراجع",
    "بيان إتاحة البيانات",
    "شكر وتقدير",
}


def extract_keywords(doc: Document) -> list[str]:
    """
    Extract manuscript keywords.
    """
    prefixes = (
        "keywords:",
        "keywords：",
        "الكلمات المفتاحية:",
        "الكلمات المفتاحية：",
    )

    for paragraph in doc.paragraphs:
        text = paragraph.text.strip()

        if not text:
            continue

        lower_text = text.lower()

        for prefix in prefixes:
            if lower_text.startswith(prefix.lower()):
                keyword_text = text[len(prefix):].strip()

                keywords = re.split(r"[;؛,،]", keyword_text)

                return [
                    keyword.strip()
                    for keyword in keywords
                    if keyword.strip()
                ]

    return []


def count_tables(doc: Document) -> int:
    """
    Count actual Word tables in the manuscript.
    """
    return len(doc.tables)


def count_figures(doc: Document) -> int:
    """
    Count inline images/shapes in the manuscript.
    """
    return len(doc.inline_shapes)


def calculate_main_text_word_count(
    sections: dict[str, str]
) -> int:
    """
    Count words in the main research body.
    """
    total = 0

    for section_name, section_text in sections.items():
        normalized_name = section_name.strip().lower()

        if normalized_name in BODY_EXCLUDED_SECTIONS:
            continue

        total += count_words(section_text)

    return total


def build_blocks(doc: Document) -> list[Block]:
    """
    Convert manuscript paragraphs into traceable blocks.

    Each block keeps the original Word paragraph index so
    Warraq can later highlight the exact location.
    """
    blocks = []
    current_section = None

    for index, paragraph in enumerate(doc.paragraphs):
        text = paragraph.text.strip()

        if not text:
            continue

        style_name = (
            paragraph.style.name.lower()
            if paragraph.style
            else ""
        )

        if style_name.startswith("heading"):
            current_section = normalize_heading_name(text)

            blocks.append(
                Block(
                    id=f"paragraph_{index}",
                    type="heading",
                    text=text,
                    section=current_section,
                    word_count=count_words(text),
                    paragraph_index=index,
                )
            )
            continue

        if style_name == "title":
            block_type = "title"

        elif (
            text.lower().startswith("keywords:")
            or text.startswith("الكلمات المفتاحية")
        ):
            block_type = "keywords"

        elif re.match(
            r"^(table|جدول)\s*\d+",
            text,
            flags=re.IGNORECASE,
        ):
            block_type = "table_caption"

        elif re.match(
            r"^(figure|fig\.?|شكل)\s*\d+",
            text,
            flags=re.IGNORECASE,
        ):
            block_type = "figure_caption"

        elif (
            current_section
            and current_section.lower()
            in {"references", "bibliography", "المراجع"}
            and looks_like_reference(text)
        ):
            block_type = "reference"

        else:
            block_type = "paragraph"

        blocks.append(
            Block(
                id=f"paragraph_{index}",
                type=block_type,
                text=text,
                section=current_section,
                word_count=count_words(text),
                paragraph_index=index,
            )
        )

    return blocks


def parse_docx(path) -> ManuscriptParsedData:
    """
    Parse a DOCX manuscript and return structured manuscript data.
    """
    doc = Document(path)

    full_text = "\n".join(
        paragraph.text.strip()
        for paragraph in doc.paragraphs
        if paragraph.text.strip()
    )

    title = extract_title(doc)
    abstract = extract_abstract(doc)
    keywords = extract_keywords(doc)

    raw_sections = extract_sections(doc)

    # Extract references first so the References section can be cleaned
    references = extract_references(doc)

    for section_name in list(raw_sections.keys()):
        if section_name.lower() in {
            "references",
            "bibliography",
            "المراجع",
        }:
            raw_sections[section_name] = "\n".join(references)

    blocks = build_blocks(doc)

    section_block_ids = {}

    for block in blocks:
        if not block.section:
            continue

        if block.type in {"heading", "keywords"}:
            continue

        # Inside References, only keep actual reference blocks
        if (
            block.section.lower()
            in {"references", "bibliography", "المراجع"}
            and block.type != "reference"
        ):
            continue

        section_block_ids.setdefault(
            block.section,
            [],
        ).append(block.id)

    sections = [
        SectionInfo(
            name=section_name,
            text=section_text,
            word_count=count_words(section_text),
            block_ids=section_block_ids.get(
                section_name,
                [],
            ),
        )
        for section_name, section_text in raw_sections.items()
    ]

    return ManuscriptParsedData(
        title=title,
        title_word_count=count_words(title),

        abstract=abstract,
        abstract_word_count=count_words(abstract),

        keywords=keywords,

        full_document_word_count=count_words(full_text),
        main_text_word_count=calculate_main_text_word_count(
            raw_sections
        ),

        reference_count=len(references),
        references=references,

        table_count=count_tables(doc),
        figure_count=count_figures(doc),

        sections=sections,
        blocks=blocks,

        full_text=full_text,
    )


def inspect_docx(path=SAMPLE_PATH):
    """
    Print the raw Word structure for debugging.
    """
    doc = Document(path)

    print("\nPARAGRAPHS")
    print("=" * 80)

    for index, paragraph in enumerate(doc.paragraphs):
        text = paragraph.text.strip()

        if text:
            print(
                f"{index:03d} | "
                f"{paragraph.style.name:<20} | "
                f"{text[:120]}"
            )

    print("\nDOCUMENT INFO")
    print("=" * 80)
    print("Tables:", len(doc.tables))
    print("Images:", len(doc.inline_shapes))


if __name__ == "__main__":
    inspect_docx()

    print("\nWORD COUNT TEST")
    print("=" * 80)

    english_test = "Artificial intelligence improves academic writing."
    arabic_test = "يساعد الذكاء الاصطناعي الباحثين في الكتابة الأكاديمية."

    print("English:", count_words(english_test))
    print("Arabic:", count_words(arabic_test))

    doc = Document(SAMPLE_PATH)

    full_text = "\n".join(
        paragraph.text
        for paragraph in doc.paragraphs
        if paragraph.text.strip()
    )

    print("Full manuscript words:", count_words(full_text))

    title = extract_title(doc)

    print("\nTITLE EXTRACTION")
    print("=" * 80)
    print("Title:", title)
    print("Title word count:", count_words(title))

    abstract = extract_abstract(doc)

    print("\nABSTRACT EXTRACTION")
    print("=" * 80)
    print("Abstract:")
    print(abstract)
    print()
    print("Abstract word count:", count_words(abstract))

    sections = extract_sections(doc)

    print("\nSECTION EXTRACTION")
    print("=" * 80)

    for section_name, section_text in sections.items():
        print(
            f"{section_name}: "
            f"{count_words(section_text)} words"
        )

    references = extract_references(doc)
    main_text_word_count = calculate_main_text_word_count(sections)

    print("\nMANUSCRIPT METRICS")
    print("=" * 80)
    print("Main text word count:", main_text_word_count)
    print("Reference count:", len(references))

    print("\nREFERENCES FOUND")
    print("=" * 80)

    for index, reference in enumerate(references, start=1):
        print(f"{index}. {reference[:100]}")

    keywords = extract_keywords(doc)
    table_count = count_tables(doc)
    figure_count = count_figures(doc)

    print("\nDOCUMENT FEATURES")
    print("=" * 80)
    print("Keywords:", keywords)
    print("Keyword count:", len(keywords))
    print("Table count:", table_count)
    print("Figure count:", figure_count)

    print("\nFINAL PARSED DATA")
    print("=" * 80)

    parsed = parse_docx(SAMPLE_PATH)

    print(parsed.model_dump_json(indent=2))
