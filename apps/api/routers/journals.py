from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db import get_store
from db.store import Store
from models.adapters import spec_to_summary
from models.journal import JournalRequirementSpec, ReviewQueueItem
from models.views import JournalSummary

router = APIRouter(prefix="/journals", tags=["journals"])


class ReviewEditRequest(BaseModel):
    draft_spec: JournalRequirementSpec
    review_notes: str | None = None


class ReviewApproveRequest(BaseModel):
    draft_spec: JournalRequirementSpec | None = None
    review_notes: str | None = None


class ReviewRejectRequest(BaseModel):
    reason: str | None = None


EDITABLE_REVIEW_STATUSES = {"pending", "edited"}


@router.get("", response_model=list[JournalSummary])
def list_journals(store: Store = Depends(get_store)):
    """All journals, as cards for the browse/compare screens."""
    return [spec_to_summary(spec) for spec in store.list_journals()]


# Declared before /{journal_id} so "review-queue" is not read as a journal id.
@router.get("/review-queue", response_model=list[ReviewQueueItem])
def review_queue(status: str | None = "pending", store: Store = Depends(get_store)):
    """Journals the agent was unsure about, waiting for a human to check."""
    return store.list_review_items(status)


@router.get("/review-queue/{journal_id}", response_model=ReviewQueueItem)
def get_review_item(journal_id: str, store: Store = Depends(get_store)):
    """One queued draft, including extracted fields, confidence, and source excerpts."""
    item = store.get_review_item(journal_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Review item not found.")
    return item


@router.patch("/review-queue/{journal_id}", response_model=ReviewQueueItem)
def edit_review_item(
    journal_id: str,
    request: ReviewEditRequest,
    store: Store = Depends(get_store),
):
    """Replace the draft spec after reviewer correction. Does not approve it."""
    item = store.get_review_item(journal_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Review item not found.")
    if item.status not in EDITABLE_REVIEW_STATUSES:
        raise HTTPException(status_code=409, detail=f"Review item is already {item.status}.")
    if request.draft_spec.journal_id != journal_id:
        raise HTTPException(status_code=400, detail="Draft journal_id must match the review item.")

    item.name = request.draft_spec.name
    item.source_url = request.draft_spec.source_url
    item.draft_spec = request.draft_spec
    item.review_notes = request.review_notes
    item.status = "edited"
    try:
        store.update_review_item(item)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Review item not found.") from exc
    return item


@router.post("/review-queue/{journal_id}/approve", response_model=ReviewQueueItem)
def approve_review_item(
    journal_id: str,
    request: ReviewApproveRequest | None = None,
    store: Store = Depends(get_store),
):
    """Approve a reviewed draft and promote it to the journal catalog.

    Intended for authorized reviewers; protect before public deployment.
    """
    item = store.get_review_item(journal_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Review item not found.")
    if item.status not in EDITABLE_REVIEW_STATUSES:
        raise HTTPException(status_code=409, detail=f"Review item is already {item.status}.")

    body = request or ReviewApproveRequest()
    spec = body.draft_spec or item.draft_spec
    if spec is None:
        raise HTTPException(status_code=400, detail="Review item has no draft_spec to approve.")
    if spec.journal_id != journal_id:
        raise HTTPException(status_code=400, detail="Draft journal_id must match the review item.")

    conflict = store.find_journal_conflict(spec)
    if conflict is not None:
        raise HTTPException(
            status_code=409,
            detail=f"Journal conflicts with existing record '{conflict.journal_id}'.",
        )

    spec.needs_human_review = False
    spec.is_demo = False
    item.name = spec.name
    item.source_url = spec.source_url
    item.draft_spec = spec
    item.review_notes = body.review_notes
    item.status = "approved"
    try:
        store.approve_review_item(item, spec)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Review item not found.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail="Journal conflicts with an existing record.") from exc
    return item


@router.post("/review-queue/{journal_id}/reject", response_model=ReviewQueueItem)
def reject_review_item(
    journal_id: str,
    request: ReviewRejectRequest | None = None,
    store: Store = Depends(get_store),
):
    """Reject a queued draft without adding it to the journal catalog."""
    item = store.get_review_item(journal_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Review item not found.")
    if item.status not in EDITABLE_REVIEW_STATUSES:
        raise HTTPException(status_code=409, detail=f"Review item is already {item.status}.")

    body = request or ReviewRejectRequest()
    item.status = "rejected"
    item.review_notes = body.reason
    try:
        store.update_review_item(item)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Review item not found.") from exc
    return item


@router.get("/{journal_id}", response_model=JournalRequirementSpec)
def get_journal(journal_id: str, store: Store = Depends(get_store)):
    """Full requirements of one journal, including per-field sources."""
    spec = store.get_journal(journal_id)
    if spec is None:
        raise HTTPException(status_code=404, detail="Journal not found.")
    return spec
