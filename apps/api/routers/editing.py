"""
Editing the manuscript (S4 v3).

Every change is applied to the researcher's real DOCX and saved as a new
revision; the latest revision is what /validate, /match and /suggestions see.
Changes only happen when the researcher asks for them.
"""

from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from db import get_store
from db.store import Store
from models.manuscript import ManuscriptRecord
from services.editing import EditError, NotEditable, apply, apply_suggestion, reset, undo
from services.editing import docx_edits as ed

router = APIRouter(prefix="/manuscripts", tags=["editing"])

NOT_EDITABLE = (
    "This manuscript was uploaded before editing was available. "
    "Upload the same file again to enable editing."
)


class BlockEdit(BaseModel):
    text: str = Field(min_length=1, max_length=ed.MAX_TEXT)


class ReferencesEdit(BaseModel):
    references: list[str] = Field(min_length=1, max_length=1000)
    # Optional label for the history, e.g. "References converted to APA".
    description: str | None = Field(default=None, max_length=200)


def _run(fn):
    try:
        return fn()
    except NotEditable:
        raise HTTPException(status_code=409, detail=NOT_EDITABLE)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except EditError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


def _require(store: Store, manuscript_id: str):
    if store.get_manuscript(manuscript_id) is None:
        raise HTTPException(status_code=404, detail="Manuscript not found. Upload it first.")


@router.patch("/{manuscript_id}/blocks/{block_id}", response_model=ManuscriptRecord)
def edit_block(manuscript_id: str, block_id: str, edit: BlockEdit, store: Store = Depends(get_store)):
    """Replace the text of one paragraph (block ids come from the current version's `parsed.blocks`)."""
    _require(store, manuscript_id)
    return _run(lambda: apply(store, manuscript_id, lambda doc, parsed: ed.set_block_text(doc, parsed, block_id, edit.text)))


@router.post("/{manuscript_id}/apply-suggestion/{suggestion_id}", response_model=ManuscriptRecord)
def apply_ai_suggestion(manuscript_id: str, suggestion_id: str, store: Store = Depends(get_store)):
    """
    Apply an AI suggestion the researcher accepted (shorter title or abstract,
    highlights, a missing statement) and mark it accepted. Drafts can contain
    [placeholders] the researcher still needs to fill in.
    """
    _require(store, manuscript_id)
    return _run(lambda: apply_suggestion(store, manuscript_id, suggestion_id))


@router.post("/{manuscript_id}/references", response_model=ManuscriptRecord)
def replace_references(manuscript_id: str, edit: ReferencesEdit, store: Store = Depends(get_store)):
    """Replace the reference list, e.g. with the result of POST /citations/convert after review."""
    _require(store, manuscript_id)
    return _run(lambda: apply(
        store, manuscript_id,
        lambda doc, parsed: ed.replace_references(doc, parsed, edit.references),
        edit.description,
    ))


@router.post("/{manuscript_id}/undo", response_model=ManuscriptRecord)
def undo_last_change(manuscript_id: str, store: Store = Depends(get_store)):
    """Remove the latest change. Does nothing at the original upload (revision 0)."""
    _require(store, manuscript_id)
    return _run(lambda: undo(store, manuscript_id))


@router.post("/{manuscript_id}/reset", response_model=ManuscriptRecord)
def reset_to_original(manuscript_id: str, store: Store = Depends(get_store)):
    """Discard every change and go back to the original upload."""
    _require(store, manuscript_id)
    return _run(lambda: reset(store, manuscript_id))


@router.get("/{manuscript_id}/download")
def download(manuscript_id: str, revision: int | None = None, store: Store = Depends(get_store)):
    """The manuscript as a Word file: the latest version by default, or ?revision=N."""
    record = store.get_manuscript(manuscript_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Manuscript not found.")
    found = store.get_revision_docx(manuscript_id, revision)
    if found is None:
        raise HTTPException(status_code=404 if record.editable else 409,
                            detail="Revision not found." if record.editable else NOT_EDITABLE)
    rev, docx = found
    stem = record.filename.rsplit(".", 1)[0] or "manuscript"
    name = f"{stem}-warraq-v{rev}.docx" if rev else f"{stem}.docx"
    ascii_name = name.encode("ascii", "ignore").decode() or "manuscript.docx"
    return Response(
        content=docx,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(name)}"},
    )
