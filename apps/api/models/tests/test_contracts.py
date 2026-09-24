from datetime import datetime, timezone

from models.adapters import (
    build_match_view,
    normalize_access_model,
    requirements_summary,
    scope_fit,
    spec_to_profile,
)
from models.journal import CitationStyle, HardConstraint, JournalRequirementSpec
from models.manuscript import ManuscriptRecord
from models.validation import RequirementResult, ValidationReport
from services.analyzer.models import ManuscriptParsedData
from services.matcher.models import JournalMatch


def make_spec(**overrides) -> JournalRequirementSpec:
    data = dict(
        journal_id="j1",
        name="Journal of Testing",
        publisher="Test Press",
        source_url="https://example.com/guidelines",
        hard_constraints=HardConstraint(
            max_title_words=15,
            max_abstract_words=250,
            reference_range=(30, 60),
            required_citation_style=CitationStyle.IEEE,
            required_statements=["data_availability"],
        ),
        scope_description="Machine learning and computer vision.",
        extraction_confidence=0.9,
        access_model="Gold Open Access",
        apc_usd=1500,
        topics=["machine learning"],
        languages=["en"],
    )
    data.update(overrides)
    return JournalRequirementSpec(**data)


def test_old_spec_without_new_fields_still_valid():
    # Abrar's existing output (no S4 fields) must keep working.
    spec = JournalRequirementSpec(
        journal_id="old",
        name="Old",
        publisher="P",
        source_url="https://x",
        hard_constraints=HardConstraint(max_title_words=20),
        scope_description="s",
        extraction_confidence=0.5,
        access_model="",
    )
    assert spec.hard_constraints.max_abstract_words is None
    assert spec.field_excerpts == {}


def test_access_model_normalization():
    assert normalize_access_model("Gold Open Access") == "open_access"
    assert normalize_access_model("Hybrid") == "hybrid"
    assert normalize_access_model("") == "unknown"
    assert normalize_access_model("something odd") == "unknown"


def test_spec_to_profile_feeds_matcher():
    profile = spec_to_profile(make_spec())
    assert profile.access_model == "open_access"
    assert profile.apc == 1500 and profile.apc_currency == "USD"
    assert profile.scope == "Machine learning and computer vision."


def test_requirements_summary_and_scope_fit():
    summary = requirements_summary(make_spec())
    assert summary[0] == "Title <= 15 words"
    assert "Abstract <= 250 words" in summary
    assert scope_fit(0.8) == "strong" and scope_fit(0.55) == "good" and scope_fit(0.2) == "possible"


def test_build_match_view_combines_s1_and_s3():
    match = JournalMatch(journal_id="j1", journal_name="Journal of Testing", similarity_score=0.72, match_score=0.75)
    view = build_match_view(match, make_spec(), rank=1)
    assert view.scope_fit == "strong"
    assert view.extraction_confidence_level == "high"
    assert view.access_model == "open_access"


def test_report_summary_counts():
    results = [
        RequirementResult(rule_id="title_length", field="title", label="Title", requirement="<= 15 words", status="failed", message="Too long"),
        RequirementResult(rule_id="ref_count", field="references", label="References", requirement="30-60", status="passed", message="OK"),
        RequirementResult(rule_id="fig_res", field="figures", label="Figures", requirement="?", status="review", message="Check", confidence=0.6),
    ]
    summary = ValidationReport.summarize(results)
    assert (summary.failed_count, summary.review_count, summary.passed_count) == (1, 1, 1)
    assert not summary.meets_hard_requirements and not summary.is_fully_ready
    assert results[2].confidence_level == "medium"
    assert "confidence_level" in results[2].model_dump()


def test_manuscript_record_wraps_parsed_data():
    parsed = ManuscriptParsedData(
        title="T", title_word_count=1, abstract="", abstract_word_count=0, keywords=[],
        full_document_word_count=1, main_text_word_count=1, reference_count=0, references=[],
        table_count=0, figure_count=0, sections=[], full_text="T",
    )
    record = ManuscriptRecord(manuscript_id="m1", filename="a.docx", content_hash="abc", parsed=parsed)
    assert record.uploaded_at.tzinfo is timezone.utc
    assert record.parsed.title == "T"
