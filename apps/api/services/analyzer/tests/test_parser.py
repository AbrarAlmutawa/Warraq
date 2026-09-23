from pathlib import Path
import sys

from docx import Document


# Let the test file import parser.py
ANALYZER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ANALYZER_DIR))

from parser import parse_docx, count_words


def create_test_manuscript(path: Path):
    """
    Create a small DOCX automatically for parser testing.
    """

    doc = Document()

    # Title
    title = doc.add_paragraph(
        "Test AI Manuscript"
    )
    title.style = doc.styles["Title"]

    # Abstract
    heading = doc.add_paragraph("Abstract")
    heading.style = doc.styles["Heading 1"]

    doc.add_paragraph(
        "Artificial intelligence supports academic writing."
    )

    doc.add_paragraph(
        "Keywords: AI; writing; research"
    )

    # Introduction
    heading = doc.add_paragraph("1. Introduction")
    heading.style = doc.styles["Heading 1"]

    doc.add_paragraph(
        "This is the introduction section."
    )

    # Methodology
    heading = doc.add_paragraph("2. Methodology")
    heading.style = doc.styles["Heading 1"]

    doc.add_paragraph(
        "This study used a simple experimental method."
    )

    # Results
    heading = doc.add_paragraph("3. Results")
    heading.style = doc.styles["Heading 1"]

    doc.add_paragraph(
        "The experiment produced positive results."
    )

    # One real Word table
    table = doc.add_table(rows=2, cols=2)

    table.cell(0, 0).text = "Group"
    table.cell(0, 1).text = "Score"
    table.cell(1, 0).text = "AI"
    table.cell(1, 1).text = "90"

    # References
    heading = doc.add_paragraph("References")
    heading.style = doc.styles["Heading 1"]

    doc.add_paragraph(
        "Smith, J. (2024). Example academic reference."
    )

    doc.add_paragraph(
        "Lee, A. (2025). Another academic reference."
    )

    # This must NOT count as a reference
    doc.add_paragraph(
        "This is only a test note."
    )

    doc.save(path)


def test_count_words():
    assert count_words(
        "Artificial intelligence improves academic writing."
    ) == 5

    assert count_words(
        "يساعد الذكاء الاصطناعي الباحثين في الكتابة الأكاديمية."
    ) == 7


def test_parse_docx(tmp_path):
    test_file = tmp_path / "test_manuscript.docx"

    create_test_manuscript(test_file)

    result = parse_docx(test_file)

    # Title
    assert result.title == "Test AI Manuscript"
    assert result.title_word_count == 3

    # Abstract
    assert result.abstract == (
        "Artificial intelligence supports academic writing."
    )
    assert result.abstract_word_count == 5

    # Keywords
    assert result.keywords == [
        "AI",
        "writing",
        "research",
    ]

    # References
    assert result.reference_count == 2
    assert len(result.references) == 2

    # Tables / figures
    assert result.table_count == 1
    assert result.figure_count == 0

    # Sections
    section_names = [
        section.name
        for section in result.sections
    ]

    assert "Abstract" in section_names
    assert "Introduction" in section_names
    assert "Methodology" in section_names
    assert "Results" in section_names
    assert "References" in section_names

    # References should only point to real references
    references_section = next(
        section
        for section in result.sections
        if section.name == "References"
    )

    assert len(references_section.block_ids) == 2

    # We should have traceable blocks
    assert len(result.blocks) > 0

    abstract_blocks = [
        block
        for block in result.blocks
        if block.section == "Abstract"
        and block.type == "paragraph"
    ]

    assert len(abstract_blocks) == 1
    assert abstract_blocks[0].paragraph_index is not None