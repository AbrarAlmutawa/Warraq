from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.analyzer.models import ManuscriptParsedData
from services.matcher import JournalMatch, JournalProfile, MatchPreferences, match

router = APIRouter(prefix="/match", tags=["matching"])


class MatchRequest(BaseModel):
    paper: ManuscriptParsedData
    preferences: MatchPreferences = Field(default_factory=MatchPreferences)
    journals: list[JournalProfile] | None = None


@router.post("", response_model=list[JournalMatch])
def match_manuscript(request: MatchRequest):
    try:
        return match(request.paper, request.preferences, journals=request.journals)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
