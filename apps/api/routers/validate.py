from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from db import get_store
from db.store import Store
from models.validation import ReadinessSummary, ValidationReport
from services.validator import validate_manuscript

router = APIRouter(prefix="/validate", tags=["validation"])


class ValidateRequest(BaseModel):
    manuscript_id: str
    journal_id: str


class CompareRequest(BaseModel):
    manuscript_id: str
    journal_ids: list[str] = Field(min_length=1, max_length=10)


class JournalReadiness(BaseModel):
    journal_id: str
    journal_name: str
    summary: ReadinessSummary


def _report(store: Store, manuscript_id: str, journal_id: str) -> tuple[ValidationReport, str]:
    record = store.get_manuscript(manuscript_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Manuscript not found. Upload it first.")
    spec = store.get_journal(journal_id)
    if spec is None:
        raise HTTPException(status_code=404, detail=f"Journal '{journal_id}' not found.")

    results = validate_manuscript(record.parsed, spec, file_format=record.file_format)
    report = ValidationReport(
        manuscript_id=manuscript_id,
        journal_id=journal_id,
        results=results,
        suggestions=[],  # AI suggestions come from the LLM gateway (next step)
        summary=ValidationReport.summarize(results),
    )
    return report, spec.name


@router.post("", response_model=ValidationReport)
def validate(request: ValidateRequest, store: Store = Depends(get_store)):
    """
    Submission checklist for one manuscript against one journal.

    Switch Journal = call this again with another journal_id. The manuscript
    is never re-parsed, so switching is instant.
    """
    report, _ = _report(store, request.manuscript_id, request.journal_id)
    return report


@router.post("/compare", response_model=list[JournalReadiness])
def compare(request: CompareRequest, store: Store = Depends(get_store)):
    """Readiness summary against several journals at once, for the compare/switch screens."""
    out = []
    for journal_id in dict.fromkeys(request.journal_ids):
        report, name = _report(store, request.manuscript_id, journal_id)
        out.append(JournalReadiness(journal_id=journal_id, journal_name=name, summary=report.summary))
    return out
