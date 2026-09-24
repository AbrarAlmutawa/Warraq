"""End-to-end API tests: upload -> journals -> match, against a temporary database."""

import io

import pytest
from docx import Document
from fastapi.testclient import TestClient

import main
from db import get_store
from db.seed import seed_if_empty
from db.store import Store
from models.journal import HardConstraint, JournalRequirementSpec, ReviewQueueItem
from routers.match import get_embedding_provider


class FakeEmbeddings:
    """Keyword-based vectors, so tests don't download a model."""

    VOCAB = ["medical", "imaging", "x-ray", "deep", "learning", "agriculture", "crop"]

    def encode(self, texts):
        return [[float(word in t.lower()) + 0.01 for word in self.VOCAB] for t in texts]


@pytest.fixture
def store(tmp_path):
    s = Store(tmp_path / "test.db")
    seed_if_empty(s)
    return s


@pytest.fixture
def client(store):
    main.app.dependency_overrides[get_store] = lambda: store
    main.app.dependency_overrides[get_embedding_provider] = lambda: FakeEmbeddings()
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


def docx_bytes(title="Deep Learning for Medical Imaging of X-ray Fractures") -> bytes:
    doc = Document()
    doc.add_paragraph(title)
    doc.add_paragraph("Abstract")
    doc.add_paragraph("We apply deep learning to medical imaging of x-ray data.")
    doc.add_paragraph("Keywords: deep learning, medical imaging")
    doc.add_paragraph("Introduction")
    doc.add_paragraph("Body text about medical imaging.")
    doc.add_paragraph("References")
    doc.add_paragraph("[1] A. Author, A paper, 2024.")
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def upload(client, content: bytes, name="paper.docx"):
    return client.post("/manuscripts/upload", files={"file": (name, content, "application/octet-stream")})


def test_upload_saves_and_caches(client):
    first = upload(client, docx_bytes())
    assert first.status_code == 200
    body = first.json()
    assert body["manuscript_id"] and body["from_cache"] is False
    assert body["parsed"]["reference_count"] == 1

    again = upload(client, docx_bytes())
    assert again.json()["from_cache"] is True
    assert again.json()["manuscript_id"] == body["manuscript_id"]

    record = client.get(f"/manuscripts/{body['manuscript_id']}")
    assert record.status_code == 200
    assert record.json()["content_hash"]


def test_upload_rejects_non_docx_and_empty(client):
    assert upload(client, b"%PDF", name="paper.pdf").status_code == 400
    assert upload(client, b"", name="paper.docx").status_code == 400


def test_unknown_ids_return_404(client):
    assert client.get("/manuscripts/nope").status_code == 404
    assert client.get("/journals/nope").status_code == 404
    assert client.post("/match", json={"manuscript_id": "nope"}).status_code == 404


def test_match_requires_s1_journals(client, store):
    manuscript_id = upload(client, docx_bytes()).json()["manuscript_id"]
    store._conn.execute("DELETE FROM journals")
    store._conn.commit()

    response = client.post("/match", json={"manuscript_id": manuscript_id})

    assert response.status_code == 503
    assert "No journal records" in response.json()["detail"]


def test_list_and_get_journals(client):
    journals = client.get("/journals").json()
    assert len(journals) == 3
    assert all(j["is_demo"] for j in journals)
    assert journals[0]["requirements_summary"]

    spec = client.get("/journals/demo-med-001").json()
    assert spec["hard_constraints"]["max_abstract_words"] == 300


def test_review_queue(client, store):
    assert client.get("/journals/review-queue").json() == []
    store.save_review_item(
        ReviewQueueItem(journal_id="x", name="X", source_url="https://x", low_confidence_fields=["apc_usd"])
    )
    items = client.get("/journals/review-queue").json()
    assert len(items) == 1 and items[0]["low_confidence_fields"] == ["apc_usd"]


def review_spec(journal_id="real-review", name="Real Review Journal", source_url="https://real.example/guidelines"):
    return JournalRequirementSpec(
        journal_id=journal_id,
        name=name,
        publisher="Real Publisher",
        source_url=source_url,
        hard_constraints=HardConstraint(max_title_words=20),
        scope_description="Medical imaging, deep learning and x-ray research.",
        extraction_confidence=0.72,
        needs_human_review=True,
        topics=["medical imaging", "deep learning"],
        accepted_article_types=["research_article"],
        languages=["en"],
        access_model="open_access",
        apc_usd=1200,
        field_confidences={"scope_description": 0.7},
        field_excerpts={"scope_description": "Medical imaging and x-ray research."},
    )


def save_review_draft(store, spec=None):
    draft = spec or review_spec()
    item = ReviewQueueItem(
        journal_id=draft.journal_id,
        name=draft.name,
        source_url=draft.source_url,
        draft_spec=draft,
        low_confidence_fields=["scope_description"],
    )
    store.save_review_item(item)
    return item


def test_review_item_can_be_retrieved_and_edited(client, store):
    item = save_review_draft(store)

    fetched = client.get(f"/journals/review-queue/{item.journal_id}")
    assert fetched.status_code == 200
    assert fetched.json()["draft_spec"]["field_excerpts"]["scope_description"]

    corrected = review_spec()
    corrected.scope_description = "Corrected medical imaging scope."
    response = client.patch(
        f"/journals/review-queue/{item.journal_id}",
        json={"draft_spec": corrected.model_dump(mode="json"), "review_notes": "Scope checked."},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "edited"
    assert body["draft_spec"]["scope_description"] == "Corrected medical imaging scope."
    assert body["review_notes"] == "Scope checked."


def test_approve_review_item_promotes_journal_and_match_can_use_it(client, store):
    item = save_review_draft(store)

    approved = client.post(
        f"/journals/review-queue/{item.journal_id}/approve",
        json={"review_notes": "Verified source page."},
    )

    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"
    journal = client.get(f"/journals/{item.journal_id}")
    assert journal.status_code == 200
    assert journal.json()["is_demo"] is False
    assert journal.json()["needs_human_review"] is False

    manuscript_id = upload(client, docx_bytes()).json()["manuscript_id"]
    results = client.post("/match", json={"manuscript_id": manuscript_id}).json()
    approved_match = next(r for r in results if r["journal_id"] == item.journal_id)
    assert approved_match["is_demo"] is False
    assert approved_match["matched_topics"]
    assert any("Semantic scope similarity" in reason for reason in approved_match["reasons"])


def test_reject_review_item_does_not_add_journal(client, store):
    item = save_review_draft(store, review_spec(journal_id="reject-me", name="Reject Me"))

    response = client.post(
        f"/journals/review-queue/{item.journal_id}/reject",
        json={"reason": "Source page was not authoritative."},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "rejected"
    assert response.json()["review_notes"] == "Source page was not authoritative."
    assert client.get(f"/journals/{item.journal_id}").status_code == 404


def test_review_workflow_rejects_invalid_missing_and_duplicate_actions(client, store):
    item = save_review_draft(store, review_spec(journal_id="once", name="Approve Once"))

    assert client.get("/journals/review-queue/nope").status_code == 404
    assert client.patch(f"/journals/review-queue/{item.journal_id}", json={}).status_code == 422

    approved = client.post(f"/journals/review-queue/{item.journal_id}/approve", json={})
    assert approved.status_code == 200
    assert client.post(f"/journals/review-queue/{item.journal_id}/approve", json={}).status_code == 409
    assert client.post(f"/journals/review-queue/{item.journal_id}/reject", json={}).status_code == 409


def test_failed_review_approval_preserves_queue_and_existing_journals(client, store):
    real = JournalRequirementSpec(
        journal_id="existing-real",
        name="Existing Real",
        publisher="P",
        source_url="https://existing.example",
        hard_constraints=HardConstraint(),
        scope_description="Existing scope",
        extraction_confidence=0.9,
        access_model="hybrid",
    )
    store.save_journal(real)
    item = save_review_draft(
        store,
        review_spec(journal_id="conflict", name="Existing Real", source_url="https://other.example"),
    )

    response = client.post(f"/journals/review-queue/{item.journal_id}/approve", json={})

    assert response.status_code == 409
    assert client.get("/journals/existing-real").status_code == 200
    queued = client.get(f"/journals/review-queue/{item.journal_id}").json()
    assert queued["status"] == "pending"
    assert client.get(f"/journals/{item.journal_id}").status_code == 404


def test_match_by_manuscript_id(client):
    manuscript_id = upload(client, docx_bytes()).json()["manuscript_id"]
    response = client.post("/match", json={"manuscript_id": manuscript_id})
    assert response.status_code == 200
    results = response.json()
    assert [r["rank"] for r in results] == list(range(1, len(results) + 1))
    assert results[0]["journal_id"] == "demo-med-001"
    assert results[0]["scope_fit"] in {"strong", "good", "possible"}
    assert "extraction_confidence_level" in results[0]


def test_match_respects_preferences(client):
    manuscript_id = upload(client, docx_bytes()).json()["manuscript_id"]
    # The matcher counts hybrid journals as open-access capable.
    open_access = client.post(
        "/match", json={"manuscript_id": manuscript_id, "preferences": {"open_access_only": True}}
    ).json()
    assert {r["journal_id"] for r in open_access} == {"demo-ai-001", "demo-med-001"}

    cheap = client.post(
        "/match", json={"manuscript_id": manuscript_id, "preferences": {"max_apc": 1500}}
    ).json()
    assert {r["journal_id"] for r in cheap} == {"demo-ai-001", "demo-agri-001"}


def test_match_does_not_filter_fixable_submission_requirements(client, store):
    manuscript_id = upload(client, docx_bytes("This Title Has Too Many Words For A Strict Journal")).json()[
        "manuscript_id"
    ]
    strict = store.get_journal("demo-ai-001")
    assert strict is not None
    strict.hard_constraints.max_title_words = 3
    store.save_journal(strict)

    results = client.post("/match", json={"manuscript_id": manuscript_id}).json()

    assert "demo-ai-001" in {r["journal_id"] for r in results}


def test_seed_does_not_overwrite_real_journals(tmp_path):
    s = Store(tmp_path / "real.db")
    s.save_journal(
        JournalRequirementSpec(
            journal_id="real", name="Real", publisher="P", source_url="https://r",
            hard_constraints=HardConstraint(), scope_description="s",
            extraction_confidence=0.9, access_model="hybrid",
        )
    )
    assert seed_if_empty(s) == 0
    assert [j.journal_id for j in s.list_journals()] == ["real"]
