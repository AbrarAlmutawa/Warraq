"""
Models for custom/institution-provided journal lists.

These records belong to the custom journal list feature. A list narrows the
candidate pool for matching; it does not create new journal facts by itself.
"""

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field

from models.views import JournalMatchView


ResolutionStatus = Literal[
    "resolved",
    "unresolved",
    "duplicate",
    "ambiguous",
    "invalid",
]


def _now() -> datetime:
    return datetime.now(timezone.utc)


class JournalListEntry(BaseModel):
    entry_id: str
    journal_list_id: str
    original_name: str = ""
    normalized_name: str = ""
    issn: str | None = None
    eissn: str | None = None
    publisher: str | None = None
    matched_journal_id: str | None = None
    resolution_status: ResolutionStatus
    resolution_message: str | None = None
    metadata: dict[str, str] = Field(default_factory=dict)


class JournalList(BaseModel):
    journal_list_id: str
    name: str
    description: str | None = None
    institution: str | None = None
    source_filename: str | None = None
    created_at: datetime = Field(default_factory=_now)
    journal_count: int = 0
    resolved_count: int = 0
    unresolved_count: int = 0
    duplicate_count: int = 0
    invalid_count: int = 0
    ambiguous_count: int = 0


class JournalListCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=500)
    institution: str | None = Field(default=None, max_length=160)
    journals: list[dict[str, Any]] = Field(min_length=1, max_length=500)


class JournalListDetail(BaseModel):
    journal_list: JournalList
    entries: list[JournalListEntry]


class JournalListUploadResponse(JournalListDetail):
    parse_warnings: list[str] = Field(default_factory=list)


class JournalListMatchRequest(BaseModel):
    manuscript_id: str
    preferences: dict[str, Any] = Field(default_factory=dict)


class JournalListMatchItem(BaseModel):
    match: JournalMatchView
    entry: JournalListEntry


class JournalListExcludedEntry(BaseModel):
    entry: JournalListEntry
    matched_journal_id: str
    journal_name: str
    reasons: list[str]


class JournalListMatchResponse(BaseModel):
    journal_list: JournalList
    provided_count: int
    resolved_count: int
    unresolved_count: int
    eligible_count: int
    matches: list[JournalListMatchItem]
    excluded_entries: list[JournalListExcludedEntry] = Field(default_factory=list)
    unresolved_entries: list[JournalListEntry] = Field(default_factory=list)
