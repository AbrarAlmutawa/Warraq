from typing import Literal

from pydantic import BaseModel, Field


class JournalProfile(BaseModel):
    """S1 to S3 matching contract. Submission-format rules belong to validation."""

    journal_id: str
    name: str
    aims: str = ""
    scope: str = ""
    topics: list[str] = Field(default_factory=list)
    accepted_article_types: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    access_model: Literal["open_access", "subscription", "hybrid", "unknown"] = "unknown"
    apc: float | None = None
    apc_currency: str | None = None
    publisher: str | None = None
    source_url: str | None = None
    # Added by S4 (team decisions v1). Optional: None / [] means "not published".
    review_days_avg: int | None = None
    indexes: list[str] = Field(default_factory=list)


class MatchPreferences(BaseModel):
    article_type: str | None = None
    language: str | None = None
    open_access_only: bool = False
    max_apc: float | None = None
    apc_currency: str | None = None
    preferred_publishers: list[str] = Field(default_factory=list)
    preferred_journals: list[str] = Field(default_factory=list)
    top_k: int = Field(default=5, ge=1, le=50)
    # Added by S4 (team decisions v1).
    # Open access "preferred": small ranking bonus for fully open-access journals.
    # (Open access "required" is open_access_only above, which also allows hybrid.)
    prefer_open_access: bool = False
    # Exclude journals whose published average review time is longer than this.
    max_review_days: int | None = None
    # Exclude journals whose published indexing lacks any of these (e.g. ["scopus", "wos"]).
    required_indexes: list[str] = Field(default_factory=list)


class JournalMatch(BaseModel):
    journal_id: str
    journal_name: str
    similarity_score: float = Field(ge=0.0, le=1.0)
    match_score: float = Field(ge=0.0, le=1.0)
    matched_topics: list[str] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list)
    passed_hard_constraints: bool = True
    publisher: str | None = None
    access_model: str = "unknown"
    apc: float | None = None
    apc_currency: str | None = None
    source_url: str | None = None
