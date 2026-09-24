"""
Deterministic journal-rule checks (S4).

Every check here is plain Python: no LLM. Given the same manuscript and
the same journal spec, the result is always the same. AI judgments
(scope fit, tone) belong in Suggestions, never here.

Each check returns a RequirementResult, or None when the journal does not
state that rule. Confidence reflects how sure we are about the RULE (from
extraction), not about the check.
"""

import re

from models.journal import CitationStyle, JournalRequirementSpec
from models.validation import RequirementResult, SuggestedFix
from services.analyzer.models import ManuscriptParsedData

# A failed rule whose extraction confidence is below this is shown as
# "review" instead of "failed": the journal rule itself may be wrong.
LOW_RULE_CONFIDENCE = 0.6

STATEMENT_LABELS = {
    "data_availability": "Data availability statement",
    "conflict_of_interest": "Conflict of interest statement",
    "funding": "Funding statement",
    "ethics": "Ethics statement",
}

# Section-name phrases that count as each statement.
STATEMENT_HEADINGS = {
    "data_availability": ["data availability", "availability of data", "data sharing"],
    "conflict_of_interest": ["conflict of interest", "conflicts of interest", "competing interest",
                             "declaration of interest"],
    "funding": ["funding", "financial support"],
    "ethics": ["ethics", "ethical approval", "ethical statement", "institutional review board"],
}

SECTION_ALIASES = {
    "methods": "methodology",
    "method": "methodology",
    "materials and methods": "methodology",
    "conclusions": "conclusion",
    "results and discussion": "results",
}


# ---------------------------------------------------------------- helpers

class _Ctx:
    """Everything a check needs about one manuscript + one journal."""

    def __init__(self, paper: ManuscriptParsedData, spec: JournalRequirementSpec):
        self.paper = paper
        self.spec = spec
        self.rules = spec.hard_constraints
        self.section_names = {s.name.strip().lower(): s for s in paper.sections}

    def confidence(self, *fields: str) -> float:
        """Lowest extraction confidence among the fields a rule came from."""
        scores = [self.spec.field_confidences[f] for f in fields if f in self.spec.field_confidences]
        return min(scores) if scores else self.spec.extraction_confidence

    def excerpt(self, *fields: str) -> str | None:
        for f in fields:
            if self.spec.field_excerpts.get(f):
                return self.spec.field_excerpts[f]
        return None

    def blocks_of_type(self, *types: str) -> list[str]:
        return [b.id for b in self.paper.blocks if b.type in types]

    def section_blocks(self, name: str) -> list[str]:
        section = self.section_names.get(name.lower())
        return section.block_ids if section else []

    def result(self, *, rule_id, field, label, requirement, passed, message, source_fields,
               measured=None, block_ids=None, fix=None, force_review=False) -> RequirementResult:
        confidence = self.confidence(*source_fields)
        if force_review:
            status = "review"
        elif passed:
            status = "passed"
        elif confidence < LOW_RULE_CONFIDENCE:
            status = "review"
            message += " The journal rule was extracted with low confidence, so please check the source."
        else:
            status = "failed"
        return RequirementResult(
            rule_id=rule_id,
            field=field,
            label=label,
            requirement=requirement,
            measured=measured,
            status=status,
            severity="hard",
            message=message,
            block_ids=block_ids or [],
            suggested_fix=None if passed else fix,
            confidence=confidence,
            source_excerpt=self.excerpt(*source_fields),
            source_url=self.spec.source_url,
        )


def _max_rule(ctx, *, rule_id, field, label, unit, limit, actual, source_field, block_ids=None, fix=None):
    if limit is None:
        return None
    passed = actual <= limit
    over = actual - limit
    message = (
        f"{label} is within the limit." if passed
        else f"{label} is over the limit by {over} {unit}{'' if over == 1 else 's'}."
    )
    return ctx.result(
        rule_id=rule_id, field=field, label=label,
        requirement=f"<= {limit:,} {unit}s", measured=f"{actual:,} {unit}{'' if actual == 1 else 's'}",
        passed=passed, message=message, source_fields=(source_field,), block_ids=block_ids, fix=fix,
    )


def _range_rule(ctx, *, rule_id, field, label, unit, bounds, actual, source_fields, block_ids=None):
    if bounds is None:
        return None
    low, high = bounds
    passed = low <= actual <= high
    if passed:
        message = f"{label} is within the required range."
    elif actual < low:
        message = f"{label} is below the minimum: add {low - actual} {unit}{'' if low - actual == 1 else 's'}."
    else:
        message = f"{label} is above the maximum: remove {actual - high} {unit}{'' if actual - high == 1 else 's'}."
    return ctx.result(
        rule_id=rule_id, field=field, label=label,
        requirement=f"{low}-{high} {unit}s", measured=f"{actual} {unit}{'' if actual == 1 else 's'}",
        passed=passed, message=message, source_fields=source_fields, block_ids=block_ids,
    )


def detect_citation_style(references: list[str]) -> CitationStyle:
    """Rough style detection from the reference list: numbered [n] -> IEEE, (Year) -> APA."""
    if not references:
        return CitationStyle.UNKNOWN
    numbered = sum(1 for r in references if re.match(r"^\s*\[\d+\]", r))
    author_year = sum(1 for r in references if re.search(r"\((?:19|20)\d{2}[a-z]?\)", r[:150]))
    share = 0.6 * len(references)
    if numbered >= share:
        return CitationStyle.IEEE
    if author_year >= share:
        return CitationStyle.APA
    return CitationStyle.UNKNOWN


def _find_section(ctx, phrases: list[str]):
    for name, section in ctx.section_names.items():
        if any(p in name for p in phrases):
            return section
    return None


# ----------------------------------------------------------------- checks

def check_title(ctx):
    return _max_rule(
        ctx, rule_id="title_length", field="title", label="Title length", unit="word",
        limit=ctx.rules.max_title_words, actual=ctx.paper.title_word_count,
        source_field="max_title_words", block_ids=ctx.blocks_of_type("title"),
        fix=SuggestedFix(kind="shorten_title", label="Suggest a shorter title"),
    )


def check_abstract(ctx):
    return _max_rule(
        ctx, rule_id="abstract_length", field="abstract", label="Abstract length", unit="word",
        limit=ctx.rules.max_abstract_words, actual=ctx.paper.abstract_word_count,
        source_field="max_abstract_words", block_ids=ctx.section_blocks("Abstract"),
        fix=SuggestedFix(kind="shorten_abstract", label="Suggest a shorter abstract"),
    )


def check_word_count(ctx):
    return _max_rule(
        ctx, rule_id="word_count", field="body", label="Main text length", unit="word",
        limit=ctx.rules.max_word_count, actual=ctx.paper.main_text_word_count,
        source_field="max_word_count",
    )


def check_tables(ctx):
    return _max_rule(
        ctx, rule_id="table_count", field="tables", label="Number of tables", unit="table",
        limit=ctx.rules.max_tables, actual=ctx.paper.table_count, source_field="max_tables",
        block_ids=ctx.blocks_of_type("table_caption"),
    )


def check_figures(ctx):
    return _max_rule(
        ctx, rule_id="figure_count", field="figures", label="Number of figures", unit="figure",
        limit=ctx.rules.max_figures, actual=ctx.paper.figure_count, source_field="max_figures",
        block_ids=ctx.blocks_of_type("figure_caption"),
    )


def check_references(ctx):
    return _range_rule(
        ctx, rule_id="reference_count", field="references", label="Number of references",
        unit="reference", bounds=ctx.rules.reference_range, actual=ctx.paper.reference_count,
        source_fields=("reference_min", "reference_max"), block_ids=ctx.section_blocks("References"),
    )


def check_keywords(ctx):
    return _range_rule(
        ctx, rule_id="keyword_count", field="keywords", label="Number of keywords", unit="keyword",
        bounds=ctx.rules.keyword_range, actual=len(ctx.paper.keywords),
        source_fields=("keyword_min", "keyword_max"), block_ids=ctx.blocks_of_type("keywords"),
    )


def check_citation_style(ctx):
    required = ctx.rules.required_citation_style
    if required is None or required == CitationStyle.UNKNOWN:
        return None
    detected = detect_citation_style(ctx.paper.references)
    common = dict(
        rule_id="citation_style", field="references", label="Citation style",
        requirement=required.value.upper(), source_fields=("required_citation_style",),
        block_ids=ctx.section_blocks("References"),
    )
    if detected == CitationStyle.UNKNOWN:
        return ctx.result(
            **common, measured="Could not detect", passed=False, force_review=True,
            message=f"Warraq could not detect the citation style. Please confirm it is {required.value.upper()}.",
        )
    passed = detected == required
    return ctx.result(
        **common, measured=detected.value.upper(), passed=passed,
        message=("Citation style matches." if passed
                 else f"References look like {detected.value.upper()}, but the journal requires {required.value.upper()}."),
        fix=SuggestedFix(kind="convert_citations", label=f"Convert references to {required.value.upper()}",
                         params={"from_style": detected.value, "to_style": required.value}),
    )


def check_template(ctx, file_format: str):
    required = ctx.rules.required_template
    if not required or required == "either":
        return None
    have = "latex" if file_format == "latex" else "word"
    passed = have == required
    return ctx.result(
        rule_id="template", field="format", label="Submission format",
        requirement="LaTeX" if required == "latex" else "Word", measured="LaTeX" if have == "latex" else "Word (DOCX)",
        passed=passed, source_fields=("required_template",),
        message="Format matches." if passed else f"The journal requires a {required.upper() if required == 'latex' else 'Word'} submission.",
        fix=SuggestedFix(kind="export_latex", label="Export to the journal's LaTeX template") if required == "latex" else None,
    )


def check_highlights(ctx):
    bounds = ctx.rules.highlights_range
    if bounds is None:
        return None
    section = _find_section(ctx, ["highlight"])
    count = len([line for line in section.text.split("\n") if line.strip()]) if section else 0
    low, high = bounds
    passed = low <= count <= high
    if section is None:
        message = f"The journal requires {low}-{high} highlights, and none were found."
    elif passed:
        message = "Highlights are within the required range."
    else:
        message = f"Found {count} highlights; the journal requires {low}-{high}."
    return ctx.result(
        rule_id="highlights", field="highlights", label="Highlights",
        requirement=f"{low}-{high} bullet points", measured=f"{count} found",
        passed=passed, message=message, source_fields=("highlights_min", "highlights_max"),
        block_ids=section.block_ids if section else [],
        fix=SuggestedFix(kind="insert_highlights", label="Draft highlights from the abstract"),
    )


def check_statements(ctx) -> list[RequirementResult]:
    results = []
    full_text = ctx.paper.full_text.lower()
    for statement in ctx.rules.required_statements:
        label = STATEMENT_LABELS.get(statement, statement.replace("_", " ").capitalize())
        phrases = STATEMENT_HEADINGS.get(statement, [statement.replace("_", " ")])
        section = _find_section(ctx, phrases)
        mentioned = any(p in full_text for p in phrases)
        common = dict(
            rule_id=f"statement:{statement}", field="statements", label=label,
            requirement="Required", source_fields=("required_statements",),
            fix=SuggestedFix(kind="insert_statement", label=f"Add a {label.lower()}", params={"statement": statement}),
        )
        if section is not None:
            results.append(ctx.result(**common, measured="Present", passed=True,
                                      message=f"{label} found.", block_ids=section.block_ids))
        elif mentioned:
            results.append(ctx.result(**common, measured="Mentioned, no section", passed=False, force_review=True,
                                      message=f"The text mentions it, but there is no separate {label.lower()} section."))
        else:
            results.append(ctx.result(**common, measured="Missing", passed=False,
                                      message=f"{label} is required but missing."))
    return results


def check_sections(ctx) -> list[RequirementResult]:
    have = {SECTION_ALIASES.get(n, n) for n in ctx.section_names}
    results = []
    for required in ctx.rules.required_sections:
        key = SECTION_ALIASES.get(required.strip().lower(), required.strip().lower())
        passed = key in have
        results.append(ctx.result(
            rule_id=f"section:{key}", field="structure", label=f"{required.strip().title()} section",
            requirement="Required", measured="Present" if passed else "Missing", passed=passed,
            source_fields=("required_sections",),
            message=f"{required.strip().title()} section found." if passed
            else f"The journal requires a {required.strip().title()} section.",
            block_ids=ctx.section_blocks(required),
        ))
    return results


def check_pages(ctx):
    if ctx.rules.max_page_count is None:
        return None
    return ctx.result(
        rule_id="page_count", field="body", label="Page count",
        requirement=f"<= {ctx.rules.max_page_count} pages", measured="Not measured",
        passed=False, force_review=True, source_fields=("max_page_count",),
        message="Page count depends on the journal template, so Warraq cannot measure it from a DOCX yet. Please check it after formatting.",
    )


# ------------------------------------------------------------------ entry

def validate_manuscript(
    paper: ManuscriptParsedData, spec: JournalRequirementSpec, file_format: str = "docx"
) -> list[RequirementResult]:
    """Run every hard-rule check the journal defines. Same input -> same output."""
    ctx = _Ctx(paper, spec)
    single = [
        check_title(ctx), check_abstract(ctx), check_keywords(ctx), check_word_count(ctx),
        check_references(ctx), check_citation_style(ctx), check_tables(ctx), check_figures(ctx),
        check_highlights(ctx), check_template(ctx, file_format), check_pages(ctx),
    ]
    results = [r for r in single if r is not None]
    results.extend(check_statements(ctx))
    results.extend(check_sections(ctx))
    return results
