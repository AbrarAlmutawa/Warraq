"""
AI suggestions (S4). Soft guidance, never journal policy.

One LLM call per manuscript + journal pair returns:
  - a scope-fit assessment (always),
  - drafts that help fix failed checklist rules: a shorter title, a shorter
    abstract, highlights, or a missing statement.

Rules this module enforces on top of the prompt:
  - suggestions are never applied automatically (status starts "pending"),
  - drafts must not invent facts; unknown details stay as [placeholders],
  - a "shortened" title or abstract that is still over the limit is dropped,
    because a suggestion that doesn't fix the problem is worse than none.
"""

import hashlib
import re

from models.journal import JournalRequirementSpec
from models.validation import RequirementResult, Suggestion
from services.analyzer.models import ManuscriptParsedData
from services.analyzer.parser import count_words
from services.llm.gateway import LLMGateway, LLMResult

SYSTEM = (
    "You are Warraq, an assistant that helps researchers prepare a manuscript for a specific "
    "journal. You give suggestions only; the researcher decides. Never invent facts: no new "
    "results, numbers, datasets, funders, approval numbers, URLs or repository names. When a "
    "draft needs a detail you do not know, write a placeholder in square brackets, for example "
    "[repository name] or [funder]. Keep the author's meaning and terminology. Write in the "
    "same language as the manuscript."
)

SUGGESTIONS_TOOL = {
    "name": "record_suggestions",
    "description": "Record suggestions for the researcher.",
    "input_schema": {
        "type": "object",
        "properties": {
            "scope_fit": {
                "type": "object",
                "properties": {
                    "rating": {"type": "string", "enum": ["strong", "moderate", "weak"]},
                    "rationale": {
                        "type": "string",
                        "description": "2-3 sentences: how the paper's topic and methods fit the journal's scope, citing both.",
                    },
                },
                "required": ["rating", "rationale"],
            },
            "shorter_title": {"type": ["string", "null"]},
            "shorter_abstract": {"type": ["string", "null"]},
            "highlights": {"type": ["array", "null"], "items": {"type": "string"}},
            "statements": {
                "type": ["array", "null"],
                "items": {
                    "type": "object",
                    "properties": {
                        "statement": {"type": "string"},
                        "text": {"type": "string"},
                    },
                    "required": ["statement", "text"],
                },
            },
        },
        "required": ["scope_fit"],
    },
}

STATEMENT_HEADINGS = {
    "data_availability": "Data Availability Statement",
    "conflict_of_interest": "Conflict of Interest",
    "funding": "Funding",
    "ethics": "Ethics Statement",
}


def _sid(manuscript_id: str, journal_id: str, key: str) -> str:
    return hashlib.sha256(f"{manuscript_id}|{journal_id}|{key}".encode()).hexdigest()[:16]


def _failed(results: list[RequirementResult]) -> dict[str, RequirementResult]:
    return {r.rule_id: r for r in results if r.status == "failed"}


def build_prompt(paper: ManuscriptParsedData, spec: JournalRequirementSpec,
                 failed: dict[str, RequirementResult]) -> str:
    rules = spec.hard_constraints
    tasks = ["1. scope_fit: assess how well the manuscript fits the journal's scope."]
    if "title_length" in failed:
        tasks.append(f"- shorter_title: a title of at most {rules.max_title_words} words that keeps the key terms.")
    if "abstract_length" in failed:
        tasks.append(f"- shorter_abstract: the abstract condensed to at most {rules.max_abstract_words} words, "
                     "keeping every reported result unchanged.")
    if "highlights" in failed and rules.highlights_range:
        low, high = rules.highlights_range
        tasks.append(f"- highlights: {low}-{high} short bullet points (under 85 characters each) "
                     "taken only from the abstract.")
    missing = [r.rule_id.split(":", 1)[1] for r in failed.values() if r.rule_id.startswith("statement:")]
    if missing:
        tasks.append("- statements: a short draft for each of: " + ", ".join(missing) +
                     ". Use [placeholders] for any detail not in the manuscript.")
    tasks.append("Leave every other field null.")

    sections = ", ".join(s.name for s in paper.sections) or "(none detected)"
    return (
        f"JOURNAL: {spec.name}\n"
        f"Aims: {spec.aims or '(not stated)'}\n"
        f"Scope: {spec.scope_description}\n"
        f"Topics: {', '.join(spec.topics) or '(not stated)'}\n\n"
        f"MANUSCRIPT\nTitle: {paper.title}\n"
        f"Keywords: {', '.join(paper.keywords) or '(none)'}\n"
        f"Sections: {sections}\n"
        f"Abstract:\n{paper.abstract or '(no abstract detected)'}\n\n"
        "TASKS\n" + "\n".join(tasks)
    )


def to_suggestions(data: dict, *, paper: ManuscriptParsedData, spec: JournalRequirementSpec,
                   failed: dict[str, RequirementResult], manuscript_id: str, model: str | None) -> list[Suggestion]:
    """Turn the LLM output into Suggestions, dropping anything that doesn't pass our checks."""
    rules = spec.hard_constraints
    title_block = next((b.id for b in paper.blocks if b.type == "title"), None)
    abstract_blocks = next((s.block_ids for s in paper.sections if s.name.lower() == "abstract"), [])
    out: list[Suggestion] = []

    def add(key, **fields):
        out.append(Suggestion(suggestion_id=_sid(manuscript_id, spec.journal_id, key), model=model, **fields))

    fit = data.get("scope_fit") or {}
    if fit.get("rationale"):
        rating = fit.get("rating", "moderate")
        add("scope_fit", kind="scope_fit", field="scope", label="Scope fit",
            title=f"{rating.capitalize()} fit with {spec.name}", rationale=fit["rationale"])

    title = (data.get("shorter_title") or "").strip()
    if "title_length" in failed and title and rules.max_title_words \
            and count_words(title) <= rules.max_title_words and title != paper.title:
        add("shorten_title", kind="shorten_title", rule_id="title_length", field="title",
            label="Shorter title", title="Shorten the title to fit the limit",
            rationale=f"The journal allows at most {rules.max_title_words} words; this version has {count_words(title)}.",
            block_id=title_block, before=paper.title, after=title)

    abstract = (data.get("shorter_abstract") or "").strip()
    if "abstract_length" in failed and abstract and rules.max_abstract_words \
            and count_words(abstract) <= rules.max_abstract_words:
        add("shorten_abstract", kind="shorten_abstract", rule_id="abstract_length", field="abstract",
            label="Shorter abstract", title="Condense the abstract to fit the limit",
            rationale=f"The journal allows at most {rules.max_abstract_words} words; this version has "
                      f"{count_words(abstract)}. Check that every result is still stated exactly.",
            block_id=abstract_blocks[0] if abstract_blocks else None, before=paper.abstract, after=abstract)

    highlights = [h.strip(" -•\t") for h in (data.get("highlights") or []) if h and h.strip()]
    if "highlights" in failed and rules.highlights_range and highlights:
        low, high = rules.highlights_range
        highlights = highlights[:high]
        if len(highlights) >= low:
            add("draft_highlights", kind="draft_highlights", rule_id="highlights", field="highlights",
                label="Draft highlights", title=f"Add {len(highlights)} highlights",
                rationale=f"The journal requires {low}-{high} highlights. These are drawn only from your abstract.",
                after="\n".join(f"• {h}" for h in highlights))

    for item in data.get("statements") or []:
        statement = (item.get("statement") or "").strip()
        text = (item.get("text") or "").strip()
        rule_id = f"statement:{statement}"
        if rule_id in failed and text:
            heading = STATEMENT_HEADINGS.get(statement, statement.replace("_", " ").title())
            placeholders = re.findall(r"\[[^\]]+\]", text)
            note = " Fill in the bracketed details before submitting." if placeholders else ""
            add(f"statement:{statement}", kind="draft_statement", rule_id=rule_id, field="statements",
                label=heading, title=f"Add a {heading.lower()}",
                rationale=f"The journal requires this statement and the manuscript does not have one.{note}",
                after=f"{heading}\n{text}")
    return out


def generate_suggestions(gateway: LLMGateway, *, manuscript_id: str, paper: ManuscriptParsedData,
                         spec: JournalRequirementSpec, results: list[RequirementResult]
                         ) -> tuple[list[Suggestion], LLMResult]:
    failed = _failed(results)
    result = gateway.call_tool(
        "suggestions", system=SYSTEM, user=build_prompt(paper, spec, failed),
        tool=SUGGESTIONS_TOOL, max_tokens=3000,
    )
    if result.status != "ok" or result.data is None:
        return [], result
    items = to_suggestions(result.data, paper=paper, spec=spec, failed=failed,
                           manuscript_id=manuscript_id, model=result.model)
    return items, result
