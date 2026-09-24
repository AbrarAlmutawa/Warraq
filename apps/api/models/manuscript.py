"""
Manuscript contracts owned by S4.

S2's ManuscriptParsedData stays exactly as it is. The backend wraps it
in a ManuscriptRecord with an id, so a paper is parsed once and every
later step (matching, validation, Switch Journal) refers to it by id.
"""

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

from services.analyzer.models import ManuscriptParsedData


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ManuscriptRecord(BaseModel):
    """What the backend stores for every uploaded manuscript."""

    manuscript_id: str
    filename: str
    file_format: Literal["docx", "pdf", "latex"] = "docx"
    # SHA-256 of the uploaded file. Re-uploading the same file reuses the parse.
    content_hash: str
    uploaded_at: datetime = Field(default_factory=_now)
    parsed: ManuscriptParsedData


class ManuscriptUploadResponse(BaseModel):
    """Response of POST /manuscripts/upload."""

    manuscript_id: str
    filename: str
    parsed: ManuscriptParsedData
    # True when this exact file was uploaded before and the cached parse was reused.
    from_cache: bool = False
