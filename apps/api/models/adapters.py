"""
Conversions between the teams' schemas. Owned by S4.

S1 produces JournalRequirementSpec; S3 consumes JournalProfile and
returns JournalMatch; the frontend reads JournalSummary / JournalMatchView.
All translation lives here so each module keeps its own schema.
"""

from models.journal import JournalRequirementSpec
from models.validation import confidence_level
from models.views import AccessModel, JournalMatchView, JournalSummary, ScopeFit
from services.matcher.models import JournalMatch, JournalProfile

# Match-score thresholds for the "scope fit" label shown in the UI.
# Starting values; tune them once real journals are in the database.
STRONG_FIT_MIN = 0.70
GOOD_FIT_MIN = 0.50

_ACCESS_ALIASES: dict[str, AccessModel] = {
    "open_access": "open_access",
    "open access": "open_access",
    "open-access": "open_access",
    "oa": "open_access",
    "gold": "open_access",
    "gold open access": "open_access",
    "fully open access": "open_access",
    "full": "open_access",
    "hybrid": "hybrid",
    "subscription": "subscription",
    "closed": "subscription",
    "traditional": "subscription",
}


def normalize_access_model(value: str | None) -> AccessModel:
    """Map free-text access models from extraction onto the fixed set."""
    if not value:
        return "unknown"
    return _ACCESS_ALIASES.get(value.strip().lower(), "unknown")


def spec_to_profile(spec: JournalRequirementSpec) -> JournalProfile:
    """S1 -> S3: the matching-relevant part of a journal spec."""
    return JournalProfile(
        journal_id=spec.journal_id,
        name=spec.name,
        aims=spec.aims,
        scope=spec.scope_description,
        topics=spec.topics,
        accepted_article_types=spec.accepted_article_types,
        languages=spec.languages,
        access_model=normalize_access_model(spec.access_model),
        apc=spec.apc_usd,
        apc_currency="USD" if spec.apc_usd is not None else None,
        publisher=spec.publisher,
        source_url=spec.source_url,
    )


def requirements_summary(spec: JournalRequirementSpec, limit: int = 4) -> list[str]:
    """Short preview of key hard rules for journal cards, e.g. 'Title <= 15 words'."""
    hc = spec.hard_constraints
    items: list[str] = []
    if hc.max_title_words:
        items.append(f"Title <= {hc.max_title_words} words")
    if hc.max_abstract_words:
        items.append(f"Abstract <= {hc.max_abstract_words} words")
    if hc.reference_range:
        low, high = hc.reference_range
        items.append(f"{low}-{high} references")
    if hc.max_word_count:
        items.append(f"<= {hc.max_word_count:,} words")
    if hc.required_citation_style:
        items.append(f"{hc.required_citation_style.value.upper()} citations")
    if "data_availability" in hc.required_statements:
        items.append("Data availability statement required")
    if hc.highlights_range:
        items.append("Highlights required")
    return items[:limit]


def scope_fit(match_score: float) -> ScopeFit:
    if match_score >= STRONG_FIT_MIN:
        return "strong"
    if match_score >= GOOD_FIT_MIN:
        return "good"
    return "possible"


def spec_to_summary(spec: JournalRequirementSpec) -> JournalSummary:
    return JournalSummary(
        journal_id=spec.journal_id,
        name=spec.name,
        short_name=spec.short_name,
        publisher=spec.publisher,
        access_model=normalize_access_model(spec.access_model),
        apc_usd=spec.apc_usd,
        review_days_avg=spec.review_speed_days_avg,
        indexes=spec.indexes,
        requirements_summary=requirements_summary(spec),
        source_url=spec.source_url,
        is_demo=spec.is_demo,
        extraction_confidence=spec.extraction_confidence,
        extraction_confidence_level=confidence_level(spec.extraction_confidence),
        needs_human_review=spec.needs_human_review,
        last_checked_at=spec.last_scraped_at,
    )


def build_match_view(match: JournalMatch, spec: JournalRequirementSpec, rank: int) -> JournalMatchView:
    """S3 result + S1 facts -> what the frontend renders."""
    return JournalMatchView(
        **spec_to_summary(spec).model_dump(),
        rank=rank,
        match_score=match.match_score,
        similarity_score=match.similarity_score,
        scope_fit=scope_fit(match.match_score),
        reasons=match.reasons,
        matched_topics=match.matched_topics,
    )
