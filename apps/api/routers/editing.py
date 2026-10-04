"""
Editing the manuscript (S4 v3).

Every change is applied to the researcher's real DOCX and saved as a new
revision; the latest revision is what /validate, /match and /suggestions see.
Changes only happen when the researcher asks for them.
"""

from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from db import get_store
from db.store import Store
from models.manuscript import ManuscriptRecord
from services.editing import EditError, NotEditable, StaleRevision, apply, apply_suggestion, reset, undo
from services.editing import docx_edits as ed
from services.export import latex_zip

router = APIRouter(prefix="/manuscripts", tags=["editing"])

NOT_EDITABLE = (
    "This manuscript was uploaded before editing was available. "
    "Upload the same file again to enable editing."
)


class BlockEdit(BaseModel):
    text: str = Field(min_length=1, max_length=ed.MAX_TEXT)


class TextEdit(BaseModel):
    # The editor text as paragraphs (one per line). Empty lines are ignored.
    paragraphs: list[str] = Field(max_length=20_000)
    # The revision the editor was showing. If the manuscript changed since, the edit is refused.
    base_revision: int = Field(ge=0)


class ReferencesEdit(BaseModel):
    references: list[str] = Field(min_length=1, max_length=1000)
    # Optional label for the history, e.g. "References converted to APA".
    description: str | None = Field(default=None, max_length=200)


def _run(fn):
    try:
        return fn()
    except NotEditable:
        raise HTTPException(status_code=409, detail=NOT_EDITABLE)
    except StaleRevision:
        raise HTTPException(
            status_code=409,
            detail="The manuscript changed since this text was loaded (for example in another tab). Reload to continue.",
        )
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


@router.put("/{manuscript_id}/text", response_model=ManuscriptRecord)
def edit_text(manuscript_id: str, edit: TextEdit, store: Store = Depends(get_store)):
    """
    Save what the researcher typed directly in the editor. The text is compared with the
    current version and only the differences are written to the Word file (edited, added
    and removed paragraphs). No change = no new revision.
    """
    _require(store, manuscript_id)
    return _run(lambda: apply(
        store, manuscript_id,
        lambda doc, parsed: ed.apply_text(doc, parsed, edit.paragraphs),
        base_revision=edit.base_revision,
    ))


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
def download(
    manuscript_id: str,
    revision: int | None = None,
    format: Literal["docx", "latex"] = "docx",
    store: Store = Depends(get_store),
):
    """
    The manuscript as a file: the latest version by default, or ?revision=N.
    format=docx (default) returns the Word file; format=latex returns a zip with
    main.tex, the figures and a README (see docs/editing.md).
    """
    record = store.get_manuscript(manuscript_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Manuscript not found.")
    found = store.get_revision_docx(manuscript_id, revision)
    if found is None:
        raise HTTPException(status_code=404 if record.editable else 409,
                            detail="Revision not found." if record.editable else NOT_EDITABLE)
    rev, docx = found
    stem = record.filename.rsplit(".", 1)[0] or "manuscript"
    base = f"{stem}-warraq-v{rev}" if rev else stem

    if format == "latex":
        try:
            parsed = ed.reparse(docx)
            content = latex_zip(docx, parsed, folder=_ascii(base) or "manuscript")
        except Exception as exc:  # noqa: BLE001 - unusual documents must not crash the API
            raise HTTPException(status_code=422, detail=f"Could not convert this manuscript to LaTeX: {exc}") from exc
        name, media_type = f"{base}-latex.zip", "application/zip"
    else:
        content = docx
        name = f"{base}.docx"
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    ascii_name = _ascii(name) or ("manuscript-latex.zip" if format == "latex" else "manuscript.docx")
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(name)}"},
    )


def _ascii(name: str) -> str:
    return name.encode("ascii", "ignore").decode().strip(" .-")
