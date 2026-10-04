from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile

from db import get_store
from db.store import Store
from models.adapters import build_match_view, spec_to_profile
from models.journal_list import (
    JournalList,
    JournalListCreateRequest,
    JournalListDetail,
    JournalListMatchRequest,
    JournalListMatchResponse,
    JournalListUploadResponse,
)
from services.journal_lists import build_journal_list, parse_csv
from services.journal_lists.service import JournalListError, resolve_entries, summarize
from services.matcher import MatchPreferences, match
from services.matcher.embeddings import EmbeddingProvider
from services.matcher.filters import filter_journals, hard_constraint_failures

from routers.match import get_embedding_provider

router = APIRouter(prefix="/journal-lists", tags=["journal-lists"])


def _refresh_resolution(
    store: Store,
    journal_list: JournalList,
    entries,
) -> tuple[JournalList, list]:
    rows = []
    for entry in entries:
        metadata = dict(entry.metadata)
        row_number = metadata.pop("row_number", None)
        rows.append(
            {
                "row_number": row_number,
                "journal_name": entry.original_name,
                "journal_id": entry.matched_journal_id if entry.resolution_status == "resolved" else None,
                "issn": entry.issn,
                "eissn": entry.eissn,
                "publisher": entry.publisher,
                "metadata": metadata,
            }
        )

    refreshed_entries = resolve_entries(
        journal_list.journal_list_id,
        rows,
        store.list_journals(),
    )
    refreshed_list = summarize(journal_list.model_copy(), refreshed_entries)

    before = [
        (entry.resolution_status, entry.matched_journal_id, entry.resolution_message)
        for entry in entries
    ]
    after = [
        (entry.resolution_status, entry.matched_journal_id, entry.resolution_message)
        for entry in refreshed_entries
    ]
    if (
        refreshed_list.resolved_count != journal_list.resolved_count
        or refreshed_list.unresolved_count != journal_list.unresolved_count
        or refreshed_list.invalid_count != journal_list.invalid_count
        or refreshed_list.ambiguous_count != journal_list.ambiguous_count
        or refreshed_list.duplicate_count != journal_list.duplicate_count
        or before != after
    ):
        store.save_journal_list(refreshed_list, refreshed_entries)

    return refreshed_list, refreshed_entries


def _detail(store: Store, journal_list_id: str) -> JournalListDetail:
    journal_list = store.get_journal_list(journal_list_id)
    if journal_list is None:
        raise HTTPException(status_code=404, detail="Journal list not found.")
    journal_list, entries = _refresh_resolution(
        store,
        journal_list,
        store.list_journal_list_entries(journal_list_id),
    )
    return JournalListDetail(
        journal_list=journal_list,
        entries=entries,
    )


@router.get("", response_model=list[JournalList])
def list_journal_lists(store: Store = Depends(get_store)):
    refreshed = []
    for journal_list in store.list_journal_lists():
        updated, _ = _refresh_resolution(
            store,
            journal_list,
            store.list_journal_list_entries(journal_list.journal_list_id),
        )
        refreshed.append(updated)
    return refreshed


@router.post("", response_model=JournalListDetail)
def create_journal_list(request: JournalListCreateRequest, store: Store = Depends(get_store)):
    journal_list, entries = build_journal_list(
        name=request.name,
        description=request.description,
        institution=request.institution,
        source_filename=None,
        rows=request.journals,
        stored_journals=store.list_journals(),
    )
    store.save_journal_list(journal_list, entries)
    return JournalListDetail(journal_list=journal_list, entries=entries)


@router.post("/upload", response_model=JournalListUploadResponse)
async def upload_journal_list(
    file: UploadFile = File(...),
    name: str | None = Form(default=None),
    description: str | None = Form(default=None),
    institution: str | None = Form(default=None),
    store: Store = Depends(get_store),
):
    filename = file.filename or ""
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Warraq currently supports CSV journal lists.")
    content = await file.read()
    await file.close()
    try:
        rows, warnings = parse_csv(content)
    except JournalListError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    journal_list, entries = build_journal_list(
        name=name or filename.rsplit(".", 1)[0] or "Custom journal list",
        description=description,
        institution=institution,
        source_filename=filename,
        rows=rows,
        stored_journals=store.list_journals(),
    )
    store.save_journal_list(journal_list, entries)
    return JournalListUploadResponse(
        journal_list=journal_list,
        entries=entries,
        parse_warnings=warnings,
    )


@router.get("/{journal_list_id}", response_model=JournalListDetail)
def get_journal_list(journal_list_id: str, store: Store = Depends(get_store)):
    return _detail(store, journal_list_id)


@router.get("/{journal_list_id}/journals", response_model=JournalListDetail)
def get_journal_list_journals(journal_list_id: str, store: Store = Depends(get_store)):
    return _detail(store, journal_list_id)


@router.delete("/{journal_list_id}", status_code=204)
def delete_journal_list(journal_list_id: str, store: Store = Depends(get_store)):
    if not store.delete_journal_list(journal_list_id):
        raise HTTPException(status_code=404, detail="Journal list not found.")
    return Response(status_code=204)


@router.post("/{journal_list_id}/match", response_model=JournalListMatchResponse)
def match_journal_list(
    journal_list_id: str,
    request: JournalListMatchRequest,
    store: Store = Depends(get_store),
    embedding_provider: EmbeddingProvider | None = Depends(get_embedding_provider),
):
    detail = _detail(store, journal_list_id)
    record = store.get_manuscript(request.manuscript_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Manuscript not found. Upload it first.")

    try:
        prefs = MatchPreferences.model_validate(request.preferences)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    specs = {spec.journal_id: spec for spec in store.list_journals()}
    resolved_entries = [
        entry
        for entry in detail.entries
        if entry.resolution_status == "resolved" and entry.matched_journal_id in specs
    ]
    profile_by_journal_id = {
        entry.matched_journal_id: spec_to_profile(specs[entry.matched_journal_id])
        for entry in resolved_entries
        if entry.matched_journal_id is not None
    }
    profiles = list(profile_by_journal_id.values())
    eligible_profiles = filter_journals(profiles, prefs)
    eligible_count = len(eligible_profiles)
    excluded_entries = []
    for entry in resolved_entries:
        if entry.matched_journal_id is None:
            continue
        profile = profile_by_journal_id[entry.matched_journal_id]
        failures = hard_constraint_failures(profile, prefs)
        if failures:
            excluded_entries.append(
                {
                    "entry": entry,
                    "matched_journal_id": profile.journal_id,
                    "journal_name": profile.name,
                    "reasons": failures,
                }
            )

    try:
        results = match(record.parsed, prefs, journals=profiles, embedding_provider=embedding_provider)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    entry_by_journal = {entry.matched_journal_id: entry for entry in resolved_entries}
    matches = [
        {
            "match": build_match_view(result, specs[result.journal_id], rank=i),
            "entry": entry_by_journal[result.journal_id],
        }
        for i, result in enumerate(results, start=1)
    ]

    return JournalListMatchResponse(
        journal_list=detail.journal_list,
        provided_count=detail.journal_list.journal_count,
        resolved_count=detail.journal_list.resolved_count,
        unresolved_count=detail.journal_list.unresolved_count
        + detail.journal_list.invalid_count
        + detail.journal_list.ambiguous_count,
        eligible_count=eligible_count,
        matches=matches,
        excluded_entries=excluded_entries,
        unresolved_entries=[
            entry for entry in detail.entries if entry.resolution_status != "resolved"
        ],
    )
