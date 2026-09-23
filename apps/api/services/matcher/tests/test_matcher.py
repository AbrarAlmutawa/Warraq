from services.analyzer.models import ManuscriptParsedData
from services.matcher.filters import hard_constraint_failures
from services.matcher.matcher import match
from services.matcher.models import JournalProfile, MatchPreferences


class FakeEmbeddingProvider:
    def encode(self, texts):
        return [[1.0, 0.0], [0.95, 0.05], [0.1, 0.9]][: len(texts)]


def paper():
    return ManuscriptParsedData(
        title="Machine Learning for Arabic Text Classification",
        title_word_count=6,
        abstract="We study machine learning and natural language processing for Arabic text.",
        abstract_word_count=12,
        keywords=["machine learning", "natural language processing", "Arabic"],
        full_document_word_count=1000,
        main_text_word_count=800,
        reference_count=10,
        references=[],
        table_count=0,
        figure_count=0,
        sections=[],
        blocks=[],
        full_text="",
    )


def journal(jid, name, topics, **kwargs):
    base = dict(
        journal_id=jid,
        name=name,
        aims="",
        scope="",
        topics=topics,
        accepted_article_types=["research_article"],
        languages=["en"],
        access_model="open_access",
        apc=500,
        apc_currency="USD",
    )
    base.update(kwargs)
    return JournalProfile(**base)


def test_hard_constraints_reject_incompatible_journal():
    j = journal("j1", "J1", [], accepted_article_types=["review"], apc=2000)
    prefs = MatchPreferences(
        article_type="research_article", max_apc=1000, apc_currency="USD"
    )
    assert set(hard_constraint_failures(j, prefs)) == {"article_type", "max_apc"}


def test_match_filters_then_ranks_by_semantic_similarity():
    ai = journal("ai", "AI Journal", ["machine learning", "natural language processing"])
    ag = journal("ag", "Agriculture Journal", ["agriculture"])
    results = match(paper(), MatchPreferences(top_k=2), [ai, ag], FakeEmbeddingProvider())
    assert [r.journal_id for r in results] == ["ai", "ag"]
    assert results[0].similarity_score > results[1].similarity_score
    assert "machine learning" in results[0].matched_topics


def test_partial_multi_word_topic_does_not_match():
    j = journal("ag", "Agriculture Journal", ["crop science"])
    results = match(paper(), MatchPreferences(), [j], FakeEmbeddingProvider())
    assert "crop science" not in results[0].matched_topics
    assert "Overlapping topics" not in " ".join(results[0].reasons)


def test_complete_multi_word_topic_matches():
    j = journal("ai", "AI Journal", ["machine learning"])
    results = match(paper(), MatchPreferences(), [j], FakeEmbeddingProvider())
    assert "machine learning" in results[0].matched_topics
    assert "Overlapping topics: machine learning" in results[0].reasons


def test_single_word_topic_matches():
    j = journal("arabic", "Arabic Journal", ["Arabic"])
    results = match(paper(), MatchPreferences(), [j], FakeEmbeddingProvider())
    assert "Arabic" in results[0].matched_topics
    assert "Overlapping topics: Arabic" in results[0].reasons


def test_match_applies_open_access_filter_before_embedding():
    subscription = journal("s", "Subscription", [], access_model="subscription")
    results = match(
        paper(), MatchPreferences(open_access_only=True), [subscription], FakeEmbeddingProvider()
    )
    assert results == []


def test_preferred_journal_can_adjust_close_ranking():
    a = journal("a", "Journal A", [])
    b = journal("b", "Journal B", [])

    class CloseProvider:
        def encode(self, texts):
            return [[1, 0], [0.9, 0.1], [0.88, 0.12]]

    prefs = MatchPreferences(preferred_journals=["Journal B"], top_k=2)
    results = match(paper(), prefs, [a, b], CloseProvider())
    assert results[0].journal_id == "b"
