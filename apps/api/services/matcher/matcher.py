from services.analyzer.models import ManuscriptParsedData

from .catalog import load_journal_catalog
from .embeddings import (
    EmbeddingProvider,
    SentenceTransformerEmbeddingProvider,
    cosine_similarity,
)
from .filters import filter_journals
from .models import JournalMatch, JournalProfile, MatchPreferences
from .profile_builder import build_journal_profile, build_paper_profile, normalized_terms
from .ranking import final_score, preference_bonus


# One shared provider per process, so the embedding model loads once
# instead of on every /match request.
_default_provider: SentenceTransformerEmbeddingProvider | None = None


def _get_default_provider() -> SentenceTransformerEmbeddingProvider:
    global _default_provider
    if _default_provider is None:
        _default_provider = SentenceTransformerEmbeddingProvider()
    return _default_provider


def _matched_topics(paper: ManuscriptParsedData, journal: JournalProfile) -> list[str]:
    paper_terms = normalized_terms(" ".join([paper.title, paper.abstract, *paper.keywords]))
    return [
        topic
        for topic in journal.topics
        if (topic_terms := normalized_terms(topic)) and topic_terms <= paper_terms
    ]


def match(
    paper: ManuscriptParsedData,
    prefs: MatchPreferences,
    journals: list[JournalProfile] | None = None,
    embedding_provider: EmbeddingProvider | None = None,
) -> list[JournalMatch]:
    """Filter incompatible journals, semantically score scope fit, then rank eligible matches."""
    catalog = journals if journals is not None else load_journal_catalog()
    eligible = filter_journals(catalog, prefs)
    if not eligible:
        return []

    provider = embedding_provider or _get_default_provider()
    texts = [build_paper_profile(paper)] + [build_journal_profile(j) for j in eligible]
    vectors = provider.encode(texts)
    paper_vector = vectors[0]

    results: list[JournalMatch] = []
    for journal, journal_vector in zip(eligible, vectors[1:]):
        similarity = cosine_similarity(paper_vector, journal_vector)
        bonus, preference_reasons = preference_bonus(journal, prefs)
        topics = _matched_topics(paper, journal)
        reasons = [f"Semantic scope similarity: {similarity:.2f}"]
        if topics:
            reasons.append("Overlapping topics: " + ", ".join(topics[:5]))
        reasons.extend(preference_reasons)

        results.append(
            JournalMatch(
                journal_id=journal.journal_id,
                journal_name=journal.name,
                similarity_score=round(similarity, 4),
                match_score=round(final_score(similarity, bonus), 4),
                matched_topics=topics,
                reasons=reasons,
                publisher=journal.publisher,
                access_model=journal.access_model,
                apc=journal.apc,
                apc_currency=journal.apc_currency,
                source_url=journal.source_url,
            )
        )

    results.sort(
        key=lambda item: (
            -item.match_score,
            -item.similarity_score,
            item.journal_name.casefold(),
        )
    )
    return results[: prefs.top_k]
