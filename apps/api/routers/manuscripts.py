import hashlib
import os
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from core.config import get_settings
from db import get_store
from db.store import Store
from models.manuscript import ManuscriptRecord, ManuscriptUploadResponse
from services.analyzer.parser import parse_docx

router = APIRouter(
    prefix="/manuscripts",
    tags=["manuscripts"],
)


@router.post("/upload", response_model=ManuscriptUploadResponse)
async def upload_manuscript(
    file: UploadFile = File(...),
    store: Store = Depends(get_store),
):
    """
    Upload and parse a DOCX manuscript.

    The parsed result is saved and gets a manuscript_id. Uploading the
    exact same file again returns the saved parse without re-parsing.
    """
    filename = file.filename or ""
    if Path(filename).suffix.lower() != ".docx":
        raise HTTPException(status_code=400, detail="Warraq currently supports DOCX files only.")

    content = await file.read()
    await file.close()

    max_bytes = get_settings().max_upload_mb * 1024 * 1024
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413, detail=f"File is larger than {get_settings().max_upload_mb} MB."
        )

    content_hash = hashlib.sha256(content).hexdigest()
    cached = store.get_manuscript_by_hash(content_hash)
    if cached:
        return ManuscriptUploadResponse(
            manuscript_id=cached.manuscript_id,
            filename=cached.filename,
            parsed=cached.parsed,
            from_cache=True,
        )

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as temp_file:
            temp_path = temp_file.name
            temp_file.write(content)
        parsed = parse_docx(temp_path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse manuscript: {exc}") from exc
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

    record = ManuscriptRecord(
        manuscript_id=str(uuid.uuid4()),
        filename=filename,
        file_format="docx",
        content_hash=content_hash,
        parsed=parsed,
    )
    store.save_manuscript(record)

    return ManuscriptUploadResponse(
        manuscript_id=record.manuscript_id,
        filename=record.filename,
        parsed=record.parsed,
        from_cache=False,
    )


@router.get("/{manuscript_id}", response_model=ManuscriptRecord)
def get_manuscript(manuscript_id: str, store: Store = Depends(get_store)):
    record = store.get_manuscript(manuscript_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Manuscript not found.")
    return record
