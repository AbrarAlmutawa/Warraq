"""Validator tests. The demo manuscript's expected results are documented in docs/validation.md."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import main
from db import get_store
from db.seed import load_demo_journals, seed_if_empty
from db.store import Store
from models.journal import CitationStyle, HardConstraint, JournalRequirementSpec
from services.analyzer.models import ManuscriptParsedData, SectionInfo
from services.analyzer.parser import parse_docx
from services.validator import detect_citation_style, validate_manuscript

DEMO_DOCX = Path(__file__).parent / "fixtures" / "warraq_demo_manuscript.docx"

# rule_id -> status, for the demo manuscript against each demo journal.
EXPECTED = {
    "demo-ai-001": {
        "title_length": "failed", "abstract_length": "failed", "keyword_count": "passed",
        "word_count": "passed", "reference_count": "failed", "citation_style": "passed",
        "statement:data_availability": "failed", "statement:conflict_of_interest": "passed",
    },
    "demo-med-001": {
        "title_length": "passed", "abstract_length": "passed", "reference_count": "failed",
        "citation_style": "failed", "table_count": "passed", "figure_count": "passed",
        "highlights": "failed", "statement:data_availability": "failed",
        "statement:ethics": "passed", "statement:funding": "passed",
    },
    "demo-agri-001": {
        "title_length": "passed", "abstract_length": "passed", "reference_count": "passed",
        "citation_style": "failed", "statement:conflict_of_interest": "passed",
    },
}


@pytest.fixture(scope="module")
def demo_paper():
    return parse_docx(DEMO_DOCX)


def spec(**rules) -> JournalRequirementSpec:
    return JournalRequirementSpec(
        journal_id="t", name="Test Journal", publisher="P", source_url="https://t",
        hard_constraints=HardConstraint(**rules), scope_description="s",
        extraction_confidence=0.9, access_model="hybrid",
    )


def paper(**overrides) -> ManuscriptParsedData:
    data = dict(
        title="A title", title_word_count=2, abstract="", abstract_word_count=0, keywords=[],
        full_document_word_count=10, main_text_word_count=10, reference_count=0, references=[],
        table_count=0, figure_count=0, sections=[], full_text="",
    )
    data.update(overrides)
    return ManuscriptParsedData(**data)


# ---------------------------------------------------------------- unit

@pytest.mark.parametrize("journal", load_demo_journals(), ids=lambda j: j.journal_id)
def test_demo_manuscript_matches_expected_sheet(demo_paper, journal):
    results = {r.rule_id: r.status for r in validate_manuscript(demo_paper, journal)}
    assert results == EXPECTED[journal.journal_id]


def test_results_are_deterministic(demo_paper):
    journal = load_demo_journals()[1]
    first = [r.model_dump() for r in validate_manuscript(demo_paper, journal)]
    second = [r.model_dump() for r in validate_manuscript(demo_paper, journal)]
    assert first == second


def test_failed_rule_points_to_blocks_and_source(demo_paper):
    jai = next(j for j in load_demo_journals() if j.journal_id == "demo-ai-001")
    title = next(r for r in validate_manuscript(demo_paper, jai) if r.rule_id == "title_length")
    assert title.block_ids == ["paragraph_0"]
    assert title.measured == "20 words" and title.requirement == "<= 15 words"
    assert title.source_url == jai.source_url
    assert title.suggested_fix and title.suggested_fix.kind == "shorten_title"


def test_unstated_rules_are_skipped():
    assert validate_manuscript(paper(), spec()) == []


def test_low_confidence_rule_becomes_review():
    s = spec(max_title_words=1)
    s.field_confidences = {"max_title_words": 0.4}
    [result] = validate_manuscript(paper(), s)
    assert result.status == "review" and result.confidence_level == "low"


def test_statement_mentioned_without_section_is_review():
    p = paper(full_text="All data availability details are on request.")
    [result] = validate_manuscript(p, spec(required_statements=["data_availability"]))
    assert result.status == "review"


def test_required_sections_use_aliases():
    p = paper(sections=[SectionInfo(name="Methodology", text="x", word_count=1)])
    results = validate_manuscript(p, spec(required_sections=["Methods", "Discussion"]))
    assert [r.status for r in results] == ["passed", "failed"]


def test_page_count_is_review_not_guess():
    [result] = validate_manuscript(paper(), spec(max_page_count=10))
    assert result.status == "review" and result.measured == "Not measured"


def test_citation_style_detection():
    assert detect_citation_style(["[1] A. B, title, 2020.", "[2] C. D, title, 2021."]) == CitationStyle.IEEE
    assert detect_citation_style(["Smith, J. (2020). Title.", "Lee, K. (2019). Title."]) == CitationStyle.APA
    assert detect_citation_style(["Some odd reference", "Another one"]) == CitationStyle.UNKNOWN
    assert detect_citation_style([]) == CitationStyle.UNKNOWN


# ----------------------------------------------------------------- API

@pytest.fixture
def client(tmp_path):
    store = Store(tmp_path / "v.db")
    seed_if_empty(store)
    main.app.dependency_overrides[get_store] = lambda: store
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


@pytest.fixture
def manuscript_id(client):
    with DEMO_DOCX.open("rb") as f:
        return client.post("/manuscripts/upload", files={"file": ("demo.docx", f)}).json()["manuscript_id"]


def test_validate_endpoint(client, manuscript_id):
    report = client.post("/validate", json={"manuscript_id": manuscript_id, "journal_id": "demo-med-001"}).json()
    assert report["summary"] == {
        "failed_count": 4, "review_count": 0, "passed_count": 6, "total": 10,
        "meets_hard_requirements": False, "is_fully_ready": False,
    }
    assert report["suggestions"] == []


def test_switch_journal_changes_the_checklist(client, manuscript_id):
    jmi = client.post("/validate", json={"manuscript_id": manuscript_id, "journal_id": "demo-med-001"}).json()
    jas = client.post("/validate", json={"manuscript_id": manuscript_id, "journal_id": "demo-agri-001"}).json()
    assert jmi["summary"]["failed_count"] == 4
    assert jas["summary"]["failed_count"] == 1


def test_compare_endpoint(client, manuscript_id):
    rows = client.post("/validate/compare", json={
        "manuscript_id": manuscript_id,
        "journal_ids": ["demo-ai-001", "demo-med-001", "demo-agri-001"],
    }).json()
    assert [(r["journal_id"], r["summary"]["failed_count"]) for r in rows] == [
        ("demo-ai-001", 4), ("demo-med-001", 4), ("demo-agri-001", 1),
    ]


def test_validate_unknown_ids(client, manuscript_id):
    assert client.post("/validate", json={"manuscript_id": "nope", "journal_id": "demo-ai-001"}).status_code == 404
    assert client.post("/validate", json={"manuscript_id": manuscript_id, "journal_id": "nope"}).status_code == 404
