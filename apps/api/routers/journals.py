from fastapi import APIRouter, Depends, HTTPException

from db import get_store
from db.store import Store
from models.adapters import spec_to_summary
from models.journal import JournalRequirementSpec, ReviewQueueItem
from models.views import JournalSummary

router = APIRouter(prefix="/journals", tags=["journals"])


@router.get("", response_model=list[JournalSummary])
def list_journals(store: Store = Depends(get_store)):
    """All journals, as cards for the browse/compare screens."""
    return [spec_to_summary(spec) for spec in store.list_journals()]


# Declared before /{journal_id} so "review-queue" is not read as a journal id.
@router.get("/review-queue", response_model=list[ReviewQueueItem])
def review_queue(status: str | None = "pending", store: Store = Depends(get_store)):
    """Journals the agent was unsure about, waiting for a human to check."""
    return store.list_review_items(status)


@router.get("/{journal_id}", response_model=JournalRequirementSpec)
def get_journal(journal_id: str, store: Store = Depends(get_store)):
    """Full requirements of one journal, including per-field sources."""
    spec = store.get_journal(journal_id)
    if spec is None:
        raise HTTPException(status_code=404, detail="Journal not found.")
    return spec
