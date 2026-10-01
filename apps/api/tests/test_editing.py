"""Editing the manuscript: every change is a new DOCX revision that the rest of Warraq uses."""

import hashlib
import io
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import main
from db import get_store
from db.seed import seed_if_empty
from db.store import Store
from models.manuscript import ManuscriptRecord
from services.analyzer.parser import parse_docx
from services.llm import LLMGateway, get_gateway
from tests.test_llm import GOOD_OUTPUT, FakeClient

DEMO = Path(__file__).parent / "fixtures" / "warraq_demo_manuscript.docx"
SHORT_TITLE = "Leakage-Safe Multimodal Learning for Wrist Fracture Classification"


@pytest.fixture
def store(tmp_path):
    s = Store(tmp_path / "edit.db")
    seed_if_empty(s)
    return s


@pytest.fixture
def client(store):
    main.app.dependency_overrides[get_store] = lambda: store
    main.app.dependency_overrides[get_gateway] = lambda: LLMGateway(store, lambda: FakeClient(GOOD_OUTPUT))
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


def upload(client):
    with DEMO.open("rb") as f:
        return client.post("/manuscripts/upload", files={"file": ("demo.docx", f)}).json()


def checklist(client, mid, journal):
    report = client.post("/validate", json={"manuscript_id": mid, "journal_id": journal}).json()
    return {r["rule_id"]: r["status"] for r in report["results"]}, report["summary"]["failed_count"]


def test_upload_keeps_the_original_as_revision_0(client):
    mid = upload(client)["manuscript_id"]
    record = client.get(f"/manuscripts/{mid}").json()
    assert record["editable"] is True and record["revision"] == 0
    assert [h["description"] for h in record["history"]] == ["Original upload"]


def test_block_edit_creates_a_revision_that_validate_uses(client):
    mid = upload(client)["manuscript_id"]
    assert checklist(client, mid, "demo-ai-001")[0]["title_length"] == "failed"

    record = client.patch(f"/manuscripts/{mid}/blocks/paragraph_0", json={"text": SHORT_TITLE}).json()
    assert record["revision"] == 1 and record["parsed"]["title"] == SHORT_TITLE
    assert checklist(client, mid, "demo-ai-001")[0]["title_length"] == "passed"

    # Leaving and coming back (a fresh GET) still shows the edit.
    assert client.get(f"/manuscripts/{mid}").json()["parsed"]["title"] == SHORT_TITLE


def test_bad_edits_are_rejected(client):
    mid = upload(client)["manuscript_id"]
    assert client.patch(f"/manuscripts/{mid}/blocks/paragraph_999", json={"text": "x"}).status_code == 409
    assert client.patch(f"/manuscripts/{mid}/blocks/nope", json={"text": "x"}).status_code == 409
    assert client.patch(f"/manuscripts/{mid}/blocks/paragraph_0", json={"text": ""}).status_code == 422
    assert client.patch("/manuscripts/missing/blocks/paragraph_0", json={"text": "x"}).status_code == 404


def test_applying_ai_suggestions_fixes_the_checklist(client):
    mid = upload(client)["manuscript_id"]
    _, failed_before = checklist(client, mid, "demo-med-001")
    suggestions = client.post("/suggestions", json={"manuscript_id": mid, "journal_id": "demo-med-001"}).json()["suggestions"]
    by_kind = {s["kind"]: s for s in suggestions}

    client.post(f"/manuscripts/{mid}/apply-suggestion/{by_kind['draft_highlights']['suggestion_id']}")
    record = client.post(f"/manuscripts/{mid}/apply-suggestion/{by_kind['draft_statement']['suggestion_id']}").json()

    assert record["revision"] == 2
    assert [h["description"] for h in record["history"]][1:] == [
        "Highlights added (AI suggestion)", "Data Availability Statement added (AI suggestion)"]
    rules, failed_after = checklist(client, mid, "demo-med-001")
    assert rules["highlights"] == "passed" and rules["statement:data_availability"] == "passed"
    assert failed_after == failed_before - 2

    stored = client.post("/suggestions", json={"manuscript_id": mid, "journal_id": "demo-med-001"}).json()["suggestions"]
    applied = next(s for s in stored if s["kind"] == "draft_highlights")
    assert applied["status"] == "accepted" and applied["applied_revision"] == 1


def test_suggestion_rules(client):
    mid = upload(client)["manuscript_id"]
    suggestions = client.post("/suggestions", json={"manuscript_id": mid, "journal_id": "demo-med-001"}).json()["suggestions"]
    scope = next(s for s in suggestions if s["kind"] == "scope_fit")
    highlights = next(s for s in suggestions if s["kind"] == "draft_highlights")

    assert client.post(f"/manuscripts/{mid}/apply-suggestion/{scope['suggestion_id']}").status_code == 409
    assert client.post(f"/manuscripts/{mid}/apply-suggestion/nope").status_code == 404
    assert client.post(f"/manuscripts/{mid}/apply-suggestion/{highlights['suggestion_id']}").status_code == 200
    assert client.post(f"/manuscripts/{mid}/apply-suggestion/{highlights['suggestion_id']}").status_code == 409
    # After undo it can be applied again, and it never duplicates the section.
    client.post(f"/manuscripts/{mid}/undo")
    record = client.post(f"/manuscripts/{mid}/apply-suggestion/{highlights['suggestion_id']}").json()
    assert [s["name"] for s in record["parsed"]["sections"]].count("Highlights") == 1


def test_replace_references_keeps_tables_and_figures(client):
    mid = upload(client)["manuscript_id"]
    refs = [f"Author{i}, A. ({2000 + i}). Paper {i}. Demo Journal, 1, 1-2." for i in range(1, 27)]
    record = client.post(f"/manuscripts/{mid}/references",
                         json={"references": refs, "description": "References converted to APA"}).json()
    assert record["parsed"]["reference_count"] == 26
    assert record["parsed"]["table_count"] == 2 and record["parsed"]["figure_count"] == 1
    assert record["history"][-1]["description"] == "References converted to APA"
    rules, _ = checklist(client, mid, "demo-med-001")
    assert rules["citation_style"] == "passed" and rules["reference_count"] == "passed"


def test_download_undo_reset(client):
    mid = upload(client)["manuscript_id"]
    client.patch(f"/manuscripts/{mid}/blocks/paragraph_0", json={"text": SHORT_TITLE})

    latest = client.get(f"/manuscripts/{mid}/download")
    assert latest.status_code == 200 and "demo-warraq-v1.docx" in latest.headers["content-disposition"]
    assert parse_docx(io.BytesIO(latest.content)).title == SHORT_TITLE
    original = client.get(f"/manuscripts/{mid}/download", params={"revision": 0})
    assert parse_docx(io.BytesIO(original.content)).title_word_count == 20

    assert client.post(f"/manuscripts/{mid}/undo").json()["revision"] == 0
    assert client.post(f"/manuscripts/{mid}/undo").json()["revision"] == 0  # nothing left to undo
    client.patch(f"/manuscripts/{mid}/blocks/paragraph_0", json={"text": SHORT_TITLE})
    client.patch(f"/manuscripts/{mid}/blocks/paragraph_1", json={"text": "Another Author"})
    reset = client.post(f"/manuscripts/{mid}/reset").json()
    assert reset["revision"] == 0 and reset["parsed"]["title_word_count"] == 20


def test_reupload_keeps_edits(client):
    mid = upload(client)["manuscript_id"]
    client.patch(f"/manuscripts/{mid}/blocks/paragraph_0", json={"text": SHORT_TITLE})
    again = upload(client)
    assert again["from_cache"] is True and again["revision"] == 1
    assert again["parsed"]["title"] == SHORT_TITLE


def test_old_manuscripts_become_editable_after_reupload(client, store):
    content = DEMO.read_bytes()
    store.save_manuscript(ManuscriptRecord(
        manuscript_id="legacy", filename="demo.docx",
        content_hash=hashlib.sha256(content).hexdigest(), parsed=parse_docx(DEMO)))
    assert client.get("/manuscripts/legacy").json()["editable"] is False
    assert client.patch("/manuscripts/legacy/blocks/paragraph_0", json={"text": "x"}).status_code == 409
    assert client.get("/manuscripts/legacy/download").status_code == 409

    assert upload(client)["manuscript_id"] == "legacy"
    assert client.patch("/manuscripts/legacy/blocks/paragraph_0", json={"text": SHORT_TITLE}).status_code == 200
