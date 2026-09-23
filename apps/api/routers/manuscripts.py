from pathlib import Path
import os
import tempfile

from fastapi import APIRouter, File, HTTPException, UploadFile

from services.analyzer.models import ManuscriptParsedData
from services.analyzer.parser import parse_docx


router = APIRouter(
    prefix="/manuscripts",
    tags=["manuscripts"],
)


@router.post(
    "/upload",
    response_model=ManuscriptParsedData,
)
async def upload_manuscript(
    file: UploadFile = File(...),
):
    """
    Upload and parse a DOCX manuscript.
    """

    filename = file.filename or ""

    if Path(filename).suffix.lower() != ".docx":
        raise HTTPException(
            status_code=400,
            detail="Warraq currently supports DOCX files only.",
        )

    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=".docx",
        ) as temp_file:
            temp_path = temp_file.name
            temp_file.write(await file.read())

        result = parse_docx(temp_path)

        return result

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not parse manuscript: {exc}",
        ) from exc

    finally:
        await file.close()

        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)