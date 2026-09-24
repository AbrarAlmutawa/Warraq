"""
Node implementations for the journal-agent graph.

Design note: scrape_node is intentionally dumb (fetch + strip to text).
extract_node does all the thinking via a single forced-JSON-schema call
to Claude — this keeps the "smart" part swappable/testable without
touching HTTP/parsing code.
"""

from datetime import datetime

import httpx
from bs4 import BeautifulSoup

from core.config import get_settings
from models.journal import HardConstraint, JournalRequirementSpec
from services.journal_agent.state import AgentState
from services.llm import get_anthropic_client

CONFIDENCE_THRESHOLD = 0.75  # below this -> human review queue

# The tool schema forces structured output instead of free text.
# Field-level confidences ride along in the same call — cheaper than a
# separate confidence pass, and the model has the source text in context
# so it can actually judge its own certainty.
EXTRACTION_TOOL = {
    "name": "record_journal_requirements",
    "description": "Record structured author-guideline requirements extracted from a journal's page.",
    "input_schema": {
        "type": "object",
        "properties": {
            "scope_description": {"type": "string"},
            "max_page_count": {"type": ["integer", "null"]},
            "max_word_count": {"type": ["integer", "null"]},
            "max_title_words": {"type": ["integer", "null"]},
            "reference_min": {"type": ["integer", "null"]},
            "reference_max": {"type": ["integer", "null"]},
            "required_citation_style": {
                "type": ["string", "null"],
                "enum": ["apa", "ieee", "mla", "chicago", None],
            },
            "required_template": {
                "type": ["string", "null"],
                "enum": ["latex", "word", "either", None],
            },
            "apc_usd": {"type": ["number", "null"]},
            "review_speed_days_avg": {"type": ["integer", "null"]},
            "topics": {
                "type": "array",
                "items": {"type": "string"},
            },
            "accepted_article_types": {
                "type": "array",
                "items": {"type": "string"},
            },
            "languages": {
                "type": "array",
                "items": {"type": "string"},
            },
            "access_model": {"type": ["string", "null"]},

            "field_confidences": {
                "type": "object",
                "description": (
                    "0-1 confidence per extracted field, keyed by the same "
                    "field names above. Be honest — if the page didn't "
                    "clearly state something, say so with a low score "
                    "rather than guessing a plausible-sounding number."
                ),
                "additionalProperties": {"type": "number"},
            },
        },
        "required": ["scope_description", "field_confidences"],
    },
}


def scrape_node(state: AgentState) -> AgentState:
    """Fetch the author-guidelines page and strip to readable text."""
    url = state["source_url"]
    try:
        resp = httpx.get(
            url,
            timeout=20,
            headers={"User-Agent": "WarraqBot/0.1 (+academic-research-tool)"},
            follow_redirects=True,
        )
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer"]):
            tag.decompose()
        text = soup.get_text(separator="\n", strip=True)
        return {**state, "raw_html": resp.text, "raw_text": text, "scrape_error": None}
    except Exception as e:  # noqa: BLE001 — deliberately broad, this is a leaf node
        return {**state, "raw_text": "", "scrape_error": str(e)}


def extract_node(state: AgentState) -> AgentState:
    """LLM structured extraction with forced tool-use output."""
    if state.get("scrape_error") or not state.get("raw_text"):
       reason = state.get("scrape_error") or "no text to extract from"
       return {**state, "draft_spec": None, "extract_error": reason}

    # Trim very long pages — author-guideline pages rarely need more
    # than this to find the fields we care about.
    source_text = state["raw_text"][:20000]

    message = get_anthropic_client().messages.create(
        model=get_settings().journal_extraction_model,
        max_tokens=1500,
        tools=[EXTRACTION_TOOL],
        tool_choice={"type": "tool", "name": "record_journal_requirements"},
        messages=[
            {
                "role": "user",
                "content": (
                    f"Extract author-guideline requirements for the journal "
                    f"'{state['journal_name']}' from the following page text. "
                    f"Only report fields the page actually states; leave "
                    f"others null rather than inferring.\n\n{source_text}"
                ),
            }
        ],
    )

    tool_use = next(b for b in message.content if b.type == "tool_use")
    data = tool_use.input

    def _clean_str(value):
        if isinstance(value, str):
            return value.strip().strip('"').strip("'") or None
        return value

    hard = HardConstraint(
        max_page_count=data.get("max_page_count"),
        max_word_count=data.get("max_word_count"),
        max_title_words=data.get("max_title_words"),
        reference_range=(
            (data["reference_min"], data["reference_max"])
            if data.get("reference_min") is not None and data.get("reference_max") is not None
            else None
        ),
        required_citation_style=_clean_str(data.get("required_citation_style")),
        required_template=_clean_str(data.get("required_template")),
    )

    draft = JournalRequirementSpec(
        journal_id=state["journal_id"],
        name=state["journal_name"],
        publisher=state["publisher"],
        source_url=state["source_url"],
        hard_constraints=hard,
        scope_description=data["scope_description"],
        apc_usd=data.get("apc_usd"),
        review_speed_days_avg=data.get("review_speed_days_avg"),
        topics=data.get("topics", []),
        accepted_article_types=data.get("accepted_article_types", []),
        languages=data.get("languages", []),
        extraction_confidence=0.0,  # filled in by confidence_check_node
        access_model=data.get("access_model") or "",
        last_scraped_at=datetime.utcnow(),
    )

    return {
        **state,
        "draft_spec": draft,
        "field_confidences": data.get("field_confidences", {}),
        "extract_error": None,
    }


def confidence_check_node(state: AgentState) -> AgentState:
    """Roll per-field confidences into an overall score and a flag list."""
    if state.get("extract_error"):
        return {**state, "overall_confidence": 0.0, "needs_review": True, "low_confidence_fields": ["extraction_failed"]}

    confidences = state.get("field_confidences", {})
    if not confidences:
        overall = 0.0
    else:
        overall = sum(confidences.values()) / len(confidences)

    low_fields = [f for f, c in confidences.items() if c < CONFIDENCE_THRESHOLD]
    needs_review = overall < CONFIDENCE_THRESHOLD or bool(low_fields)

    draft = state["draft_spec"]
    if draft:
        draft.extraction_confidence = overall
        draft.needs_human_review = needs_review

    return {
        **state,
        "overall_confidence": overall,
        "needs_review": needs_review,
        "low_confidence_fields": low_fields,
    }


def route_after_confidence_check(state: AgentState) -> str:
    """Conditional edge: decide finalize vs. flag_for_review."""
    return "flag_for_review" if state.get("needs_review") else "finalize"
