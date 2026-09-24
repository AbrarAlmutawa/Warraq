from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db import get_store
from db.store import Store
from models.validation import Suggestion
from services.llm import LLMGateway, get_gateway
from services.suggestions import generate_suggestions
from services.validator import validate_manuscript

router = APIRouter(tags=["ai"])


class SuggestionsRequest(BaseModel):
    manuscript_id: str
    journal_id: str
    # True = ask the AI again, replacing earlier suggestions for this pair.
    refresh: bool = False


class SuggestionsResponse(BaseModel):
    manuscript_id: str
    journal_id: str
    # ok: suggestions below | stored: returned from an earlier run |
    # unavailable: AI not configured | error: AI call failed (checklist still works)
    status: Literal["ok", "stored", "unavailable", "error"]
    message: str | None = None
    suggestions: list[Suggestion]


class SuggestionDecision(BaseModel):
    status: Literal["accepted", "rejected", "pending"]


@router.post("/suggestions", response_model=SuggestionsResponse)
def suggestions(
    request: SuggestionsRequest,
    store: Store = Depends(get_store),
    gateway: LLMGateway = Depends(get_gateway),
):
    """
    AI suggestions for one manuscript + journal: scope fit, plus drafts that
    help fix failed checklist rules. Kept separate from /validate so the
    checklist stays instant and deterministic. Nothing is applied automatically.
    """
    record = store.get_manuscript(request.manuscript_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Manuscript not found. Upload it first.")
    spec = store.get_journal(request.journal_id)
    if spec is None:
        raise HTTPException(status_code=404, detail=f"Journal '{request.journal_id}' not found.")

    if not request.refresh:
        stored = store.list_suggestions(request.manuscript_id, request.journal_id)
        if stored is not None:
            return SuggestionsResponse(manuscript_id=request.manuscript_id, journal_id=request.journal_id,
                                       status="stored", suggestions=stored)

    results = validate_manuscript(record.parsed, spec, file_format=record.file_format)
    items, llm = generate_suggestions(
        gateway, manuscript_id=request.manuscript_id, paper=record.parsed, spec=spec, results=results,
    )
    if llm.status != "ok":
        message = (
            "AI suggestions are not configured (no API key). The checklist still works."
            if llm.status == "unavailable"
            else "AI suggestions are temporarily unavailable. The checklist still works; try again later."
        )
        return SuggestionsResponse(manuscript_id=request.manuscript_id, journal_id=request.journal_id,
                                   status=llm.status, message=message, suggestions=[])

    store.save_suggestions(request.manuscript_id, request.journal_id, items)
    store.mark_suggestions_generated(request.manuscript_id, request.journal_id)
    return SuggestionsResponse(manuscript_id=request.manuscript_id, journal_id=request.journal_id,
                               status="ok", suggestions=items)


@router.patch("/suggestions/{suggestion_id}", response_model=Suggestion)
def decide(suggestion_id: str, decision: SuggestionDecision, store: Store = Depends(get_store)):
    """The researcher accepts or rejects a suggestion. The backend only records the choice."""
    suggestion = store.get_suggestion(suggestion_id)
    if suggestion is None:
        raise HTTPException(status_code=404, detail="Suggestion not found.")
    suggestion.status = decision.status
    store.update_suggestion(suggestion)
    return suggestion


@router.get("/llm/usage")
def llm_usage(store: Store = Depends(get_store)):
    """LLMOps dashboard data: calls, cache hits, failures, tokens and estimated cost per task and model."""
    from services.llm import model_for

    return {
        "models": {task: model_for(task) for task in ("journal_extraction", "suggestions", "citation_conversion")},
        "usage": store.llm_usage(),
        "recent_errors": store.recent_llm_errors(),
        "note": "cost_usd is an estimate from services/llm/pricing.py; check current prices before relying on it.",
    }
