"""
Response shapes the frontend reads for journals (~ apps/web/lib/journals/types.ts).

The backend builds these by combining S3's JournalMatch (ranking) with
S1's JournalRequirementSpec (journal facts), so neither module has to
know about the other's schema.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from models.validation import ConfidenceLevel

ScopeFit = Literal["strong", "good", "possible"]
AccessModel = Literal["open_access", "hybrid", "subscription", "unknown"]


class JournalSummary(BaseModel):
    """One journal as shown in lists (GET /journals)."""

    journal_id: str
    name: str
    short_name: str | None = None
    publisher: str
    access_model: AccessModel = "unknown"
    apc_usd: float | None = None
    review_days_avg: int | None = None
    indexes: list[str] = Field(default_factory=list)
    requirements_summary: list[str] = Field(default_factory=list)
    source_url: str
    is_demo: bool = False
    extraction_confidence: float
    extraction_confidence_level: ConfidenceLevel
    needs_human_review: bool
    last_checked_at: datetime


class JournalMatchView(JournalSummary):
    """One ranked recommendation (POST /match)."""

    rank: int
    match_score: float = Field(ge=0, le=1)
    similarity_score: float = Field(ge=0, le=1)
    scope_fit: ScopeFit
    reasons: list[str] = Field(default_factory=list)
    matched_topics: list[str] = Field(default_factory=list)
