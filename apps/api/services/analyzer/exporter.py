from pathlib import Path
import re

from docx import Document
from docx.enum.text import WD_COLOR_INDEX


SAMPLE_PATH = Path(__file__).parent / "samples" / "demo.docx"

OUTPUT_PATH = (
    Path(__file__).parent
    / "samples"
    / "warraq_reviewed.docx"
)


def get_paragraph_index(block_id: str) -> int:
    """
    Convert a Warraq block ID into its Word paragraph index.

    Example:
    paragraph_4 -> 4
    """

    match = re.match(
        r"^paragraph_(\d+)$",
        block_id
    )

    if not match:
        raise ValueError(
            f"Invalid block ID: {block_id}"
        )

    return int(match.group(1))


def highlight_paragraph(paragraph):
    """
    Highlight all text runs inside one Word paragraph.
    """

    for run in paragraph.runs:
        run.font.highlight_color = (
            WD_COLOR_INDEX.YELLOW
        )


def create_highlighted_docx(
    input_path,
    output_path,
    issues: list[dict],
):
    """
    Create an editable copy of the original DOCX and
    highlight paragraphs linked to validation issues.

    Example issue:
    {
        "issue": "Abstract exceeds 250 words",
        "block_ids": ["paragraph_4"]
    }
    """

    doc = Document(input_path)

    highlighted_blocks = set()

    for issue in issues:
        block_ids = issue.get(
            "block_ids",
            []
        )

        for block_id in block_ids:

            # Do not highlight the same block twice
            if block_id in highlighted_blocks:
                continue

            paragraph_index = (
                get_paragraph_index(block_id)
            )

            # Safety check
            if paragraph_index >= len(doc.paragraphs):
                continue

            paragraph = doc.paragraphs[
                paragraph_index
            ]

            highlight_paragraph(paragraph)

            highlighted_blocks.add(block_id)

    doc.save(output_path)

    return Path(output_path)


if __name__ == "__main__":

    demo_issues = [
        {
            "issue": (
                "Abstract exceeds the "
                "250-word journal limit"
            ),
            "block_ids": [
                "paragraph_4"
            ],
        }
    ]

    result_path = create_highlighted_docx(
        SAMPLE_PATH,
        OUTPUT_PATH,
        demo_issues,
    )

    print(
        "Reviewed manuscript created:"
    )

    print(result_path)