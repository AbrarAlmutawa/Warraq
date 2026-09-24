from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, model_validator

from db import get_store
from db.store import Store
from models.journal import CitationStyle
from services.citations import CitationConversion, convert_references
from services.llm import LLMGateway, get_gateway

router = APIRouter(prefix="/citations", tags=["ai"])


class ConvertRequest(BaseModel):
    manuscript_id: str
    # Either give the style directly, or a journal_id to use that journal's required style.
    to_style: CitationStyle | None = None
    journal_id: str | None = None

    @model_validator(mode="after")
    def _one_target(self):
        if self.to_style is None and self.journal_id is None:
            raise ValueError("Give to_style or journal_id.")
        if self.to_style == CitationStyle.UNKNOWN:
            raise ValueError("to_style cannot be 'unknown'.")
        return self


@router.post("/convert", response_model=CitationConversion)
def convert(
    request: ConvertRequest,
    store: Store = Depends(get_store),
    gateway: LLMGateway = Depends(get_gateway),
):
    """
    Propose the manuscript's references in another citation style
    (the "Convert references" fix in the checklist). Nothing is applied:
    the researcher reviews the converted list and accepts it in the workspace.
    """
    record = store.get_manuscript(request.manuscript_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Manuscript not found. Upload it first.")

    to_style = request.to_style
    if to_style is None:
        spec = store.get_journal(request.journal_id)
        if spec is None:
            raise HTTPException(status_code=404, detail=f"Journal '{request.journal_id}' not found.")
        to_style = spec.hard_constraints.required_citation_style
        if to_style is None or to_style == CitationStyle.UNKNOWN:
            raise HTTPException(status_code=400, detail="This journal does not state a citation style.")

    paper = record.parsed
    reference_blocks = [b.id for b in paper.blocks if b.type == "reference"]
    block_ids = reference_blocks if len(reference_blocks) == len(paper.references) else None
    return convert_references(gateway, paper.references, to_style, block_ids=block_ids)
