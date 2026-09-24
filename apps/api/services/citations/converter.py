"""
Citation style conversion (S4), e.g. IEEE -> APA.

Split of work:
  - The LLM (cheap model, see docs/llmops.md) rewrites each reference in the
    target style and gives its in-text form. It must NOT add details that are
    missing from the original (DOI, pages, publisher...); it lists them instead.
  - Code does everything that must be exact: IEEE numbering, APA alphabetical
    order, checking that every reference came back exactly once, and checking
    that the result really looks like the target style.

Nothing here edits the manuscript. The result is a proposal the researcher
reviews and accepts in the workspace.
"""

import re

from pydantic import BaseModel, Field

from models.journal import CitationStyle
from services.llm.gateway import LLMGateway
from services.validator import detect_citation_style

BATCH_SIZE = 20

STYLE_NAMES = {
    CitationStyle.APA: "APA 7th edition",
    CitationStyle.IEEE: "IEEE",
    CitationStyle.MLA: "MLA 9th edition",
    CitationStyle.CHICAGO: "Chicago author-date",
}

SYSTEM = (
    "You convert academic references between citation styles. Rewrite each reference in the "
    "target style using ONLY the information in the original. Never add or guess a DOI, URL, "
    "page range, volume, issue, publisher, place or full first name that is not in the original; "
    "list such required-but-missing parts in missing_fields instead. Keep titles and names "
    "exactly as written (only change capitalization and punctuation the style requires)."
)

TOOL = {
    "name": "record_converted_references",
    "description": "Record each reference converted to the target style.",
    "input_schema": {
        "type": "object",
        "properties": {
            "references": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "index": {"type": "integer", "description": "The number given to the reference in the input."},
                        "converted": {
                            "type": "string",
                            "description": "The reference in the target style, WITHOUT any leading [n] number.",
                        },
                        "in_text": {
                            "type": "string",
                            "description": "Author-date in-text citation for author-date styles, e.g. (Example & Sample, 2023). Empty for IEEE.",
                        },
                        "missing_fields": {"type": "array", "items": {"type": "string"}},
                    },
                    "required": ["index", "converted"],
                },
            }
        },
        "required": ["references"],
    },
}


class ConvertedReference(BaseModel):
    original_index: int  # position in the manuscript's reference list (1-based)
    original: str
    converted: str
    in_text: str | None = None  # how to cite it in the text in the new style
    missing_fields: list[str] = Field(default_factory=list)
    block_id: str | None = None  # paragraph of the original reference


class CitationConversion(BaseModel):
    status: str  # ok | partial | unavailable | error
    message: str | None = None
    from_style: CitationStyle
    to_style: CitationStyle
    references: list[ConvertedReference] = Field(default_factory=list)
    # True when the converted list is detected as the target style (APA/IEEE only).
    verified: bool | None = None
    failed_indexes: list[int] = Field(default_factory=list)
    model: str | None = None


_LEADING_NUMBER = re.compile(r"^\s*(\[\d+\]|\d+\.)\s*")


def _strip_number(text: str) -> str:
    return _LEADING_NUMBER.sub("", text.strip())


def convert_references(
    gateway: LLMGateway,
    references: list[str],
    to_style: CitationStyle,
    block_ids: list[str] | None = None,
) -> CitationConversion:
    from_style = detect_citation_style(references)
    base = dict(from_style=from_style, to_style=to_style)

    if not references:
        return CitationConversion(status="ok", message="The manuscript has no references.", **base)
    if from_style == to_style:
        return CitationConversion(status="ok", message=f"References are already in {to_style.value.upper()}.",
                                  verified=True, **base)

    block_ids = block_ids or []
    by_index: dict[int, ConvertedReference] = {}
    model = None
    last_error = None

    for start in range(0, len(references), BATCH_SIZE):
        batch = list(enumerate(references[start:start + BATCH_SIZE], start=start + 1))
        listing = "\n".join(f"{i}. {_strip_number(ref)}" for i, ref in batch)
        result = gateway.call_tool(
            "citation_conversion",
            system=SYSTEM,
            tool=TOOL,
            max_tokens=4000,
            user=f"Convert these references to {STYLE_NAMES[to_style]}.\n\n{listing}",
        )
        model = result.model or model
        if result.status != "ok" or result.data is None:
            last_error = result
            continue

        wanted = {i for i, _ in batch}
        for item in result.data.get("references") or []:
            index = item.get("index")
            converted = _strip_number(item.get("converted") or "")
            if index not in wanted or index in by_index or not converted:
                continue  # unknown, duplicate or empty: ignore, it will count as failed
            by_index[index] = ConvertedReference(
                original_index=index,
                original=references[index - 1],
                converted=converted,
                in_text=(item.get("in_text") or "").strip() or None,
                missing_fields=[f for f in (item.get("missing_fields") or []) if f],
                block_id=block_ids[index - 1] if index - 1 < len(block_ids) else None,
            )

    if not by_index:
        status = last_error.status if last_error else "error"
        message = ("Citation conversion needs the AI, which is not configured (no API key)."
                   if status == "unavailable" else "Citation conversion failed. Please try again.")
        return CitationConversion(status=status, message=message, model=model, **base)

    converted = list(by_index.values())
    failed = [i for i in range(1, len(references) + 1) if i not in by_index]

    # Exact parts are done in code, not by the model.
    if to_style == CitationStyle.IEEE:
        converted.sort(key=lambda r: r.original_index)  # keep citation order
        for n, ref in enumerate(converted, start=1):
            ref.converted = f"[{n}] {ref.converted}"
            ref.in_text = f"[{n}]"
    elif to_style in (CitationStyle.APA, CitationStyle.MLA, CitationStyle.CHICAGO):
        converted.sort(key=lambda r: r.converted.casefold())  # alphabetical by first author

    verified = None
    if to_style in (CitationStyle.APA, CitationStyle.IEEE):
        verified = detect_citation_style([r.converted for r in converted]) == to_style

    missing_total = sum(1 for r in converted if r.missing_fields)
    notes = []
    if failed:
        notes.append(f"{len(failed)} reference(s) could not be converted and are unchanged.")
    if missing_total:
        notes.append(f"{missing_total} reference(s) are missing details the style requires; "
                     "nothing was invented, please add them.")
    if verified is False:
        notes.append("The result does not look fully like the target style; please review it.")
    if to_style != CitationStyle.IEEE:
        notes.append("Update the in-text citations using the in_text value of each reference.")

    return CitationConversion(
        status="partial" if failed else "ok",
        message=" ".join(notes) or None,
        references=converted,
        verified=verified,
        failed_indexes=failed,
        model=model,
        **base,
    )
