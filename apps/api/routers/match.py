from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from db import get_store
from db.store import Store
from models.adapters import build_match_view, spec_to_profile
from models.views import JournalMatchView
from services.matcher import MatchPreferences, match
from services.matcher.embeddings import EmbeddingProvider

router = APIRouter(prefix="/match", tags=["matching"])


class MatchRequest(BaseModel):
    manuscript_id: str
    preferences: MatchPreferences = Field(default_factory=MatchPreferences)


def get_embedding_provider() -> EmbeddingProvider | None:
    """None = the matcher's default model. Tests override this with a fake."""
    return None


@router.post("", response_model=list[JournalMatchView])
def match_manuscript(
    request: MatchRequest,
    store: Store = Depends(get_store),
    embedding_provider: EmbeddingProvider | None = Depends(get_embedding_provider),
):
    """Rank stored journals for a stored manuscript. The paper is never re-parsed."""
    record = store.get_manuscript(request.manuscript_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Manuscript not found. Upload it first.")

    stored_specs = store.list_journals()
    if not stored_specs:
        raise HTTPException(
            status_code=503,
            detail="No journal records are available. Run S1 journal collection before matching.",
        )

    specs = {spec.journal_id: spec for spec in stored_specs}
    profiles = [spec_to_profile(spec) for spec in specs.values()]

    try:
        results = match(
            record.parsed,
            request.preferences,
            journals=profiles,
            embedding_provider=embedding_provider,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return [
        build_match_view(result, specs[result.journal_id], rank=i)
        for i, result in enumerate(results, start=1)
    ]
