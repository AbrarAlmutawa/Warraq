"""
Validation contracts owned by S4.

Two kinds of output, kept strictly apart:

- RequirementResult: a journal rule checked against the manuscript.
  Hard rules are deterministic (no LLM). Each result links back to the
  journal's own wording (source_excerpt + source_url).
- Suggestion: an AI-generated recommendation. Never journal policy,
  never applied without the researcher accepting it.

Shapes mirror the frontend (apps/web/lib/workspace/types.ts):
RequirementResult ~ RequirementResult, Suggestion ~ WarraqSuggestion,
ValidationReport.summary ~ ReadinessSummary.
"""

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, computed_field


def _now() -> datetime:
    return datetime.now(timezone.utc)


ConfidenceLevel = Literal["high", "medium", "low"]


def confidence_level(score: float) -> ConfidenceLevel:
    """Bucket a 0-1 confidence into the three levels the UI shows."""
    if score >= 0.85:
        return "high"
    if score >= 0.6:
        return "medium"
    return "low"


class SuggestedFix(BaseModel):
    """An action the UI can offer. Never applied without the researcher's approval."""

    kind: str  # e.g. "convert_citations", "shorten_title", "insert_statement"
    label: str
    params: dict[str, str] = Field(default_factory=dict)  # e.g. {"to_style": "ieee"}


class RequirementResult(BaseModel):
    rule_id: str  # stable id, e.g. "title_length", "abstract_length", "statement:funding"
    field: str  # manuscript part it concerns: "title", "abstract", "references", ...
    label: str  # short human label
    requirement: str  # what the journal requires, e.g. "<= 15 words"
    measured: str | None = None  # what the manuscript has, e.g. "18 words"

    # passed: meets the rule; failed: breaks a hard rule;
    # review: the rule itself is uncertain or needs a human to confirm.
    status: Literal["passed", "failed", "review"]
    # hard: measurable rule stated by the journal; soft: judgment call.
    severity: Literal["hard", "soft"] = "hard"

    message: str
    block_ids: list[str] = Field(default_factory=list)  # S2 block ids to highlight
    suggested_fix: SuggestedFix | None = None

    # Trust in the RULE (from extraction), not in the check. Hard checks
    # themselves are deterministic.
    confidence: float = Field(ge=0, le=1, default=1.0)
    source_excerpt: str | None = None
    source_url: str | None = None

    @computed_field
    @property
    def confidence_level(self) -> ConfidenceLevel:
        return confidence_level(self.confidence)


class Suggestion(BaseModel):
    """AI recommendation (~ frontend WarraqSuggestion). Always optional for the researcher."""

    suggestion_id: str
    # What kind of help this is: "scope_fit", "shorten_title", "shorten_abstract",
    # "draft_highlights" or "draft_statement". Added in S4 v2 (optional).
    kind: str | None = None
    # The checklist rule this suggestion helps fix, if any (e.g. "title_length").
    rule_id: str | None = None
    field: str
    label: str
    title: str
    rationale: str
    block_id: str | None = None  # where it applies, if anywhere
    before: str | None = None
    after: str | None = None
    status: Literal["pending", "accepted", "rejected"] = "pending"
    model: str | None = None  # which LLM produced it, for LLMOps tracking


class ReadinessSummary(BaseModel):
    failed_count: int
    review_count: int
    passed_count: int
    total: int
    meets_hard_requirements: bool  # no failed hard rules
    is_fully_ready: bool  # no failed rules and nothing left to review


class ValidationReport(BaseModel):
    """Response of POST /validate. Switch Journal = same call with another journal_id."""

    manuscript_id: str
    journal_id: str
    results: list[RequirementResult]
    suggestions: list[Suggestion] = Field(default_factory=list)
    summary: ReadinessSummary
    generated_at: datetime = Field(default_factory=_now)

    @staticmethod
    def summarize(results: list[RequirementResult]) -> ReadinessSummary:
        failed = sum(1 for r in results if r.status == "failed")
        review = sum(1 for r in results if r.status == "review")
        passed = sum(1 for r in results if r.status == "passed")
        hard_failed = sum(1 for r in results if r.status == "failed" and r.severity == "hard")
        return ReadinessSummary(
            failed_count=failed,
            review_count=review,
            passed_count=passed,
            total=len(results),
            meets_hard_requirements=hard_failed == 0,
            is_fully_ready=failed == 0 and review == 0,
        )
