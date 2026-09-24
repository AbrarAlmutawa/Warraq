"""Team decisions v1: review days, indexes and open-access preference in matching."""

from services.matcher.filters import hard_constraint_failures
from services.matcher.models import JournalProfile, MatchPreferences
from services.matcher.ranking import preference_bonus

from tests.test_api import client, docx_bytes, store, upload  # noqa: F401  (fixtures)


def journal(**kw) -> JournalProfile:
    return JournalProfile(journal_id="j", name="J", **kw)


def test_review_days_excludes_only_when_published_and_too_slow():
    prefs = MatchPreferences(max_review_days=60)
    assert hard_constraint_failures(journal(review_days_avg=90), prefs) == ["max_review_days"]
    assert hard_constraint_failures(journal(review_days_avg=45), prefs) == []
    assert hard_constraint_failures(journal(review_days_avg=None), prefs) == []  # unknown is kept


def test_indexes_exclude_only_when_published_and_missing():
    prefs = MatchPreferences(required_indexes=["Scopus"])
    assert hard_constraint_failures(journal(indexes=["wos"]), prefs) == ["required_indexes"]
    assert hard_constraint_failures(journal(indexes=["scopus", "wos"]), prefs) == []
    assert hard_constraint_failures(journal(indexes=[]), prefs) == []  # unknown is kept


def test_unknown_values_are_flagged_in_reasons():
    prefs = MatchPreferences(max_review_days=60, required_indexes=["scopus"])
    _, reasons = preference_bonus(journal(), prefs)
    assert any("Review time not published" in r for r in reasons)
    assert any("Indexing not confirmed" in r for r in reasons)


def test_open_access_preferred_gives_bonus_only_to_full_oa():
    prefs = MatchPreferences(prefer_open_access=True)
    assert preference_bonus(journal(access_model="open_access"), prefs)[0] == 0.03
    assert preference_bonus(journal(access_model="hybrid"), prefs)[0] == 0.0


def test_open_access_required_keeps_hybrid_and_explains_it():
    prefs = MatchPreferences(open_access_only=True)
    assert hard_constraint_failures(journal(access_model="hybrid"), prefs) == []
    assert hard_constraint_failures(journal(access_model="subscription"), prefs) == ["open_access"]
    _, reasons = preference_bonus(journal(access_model="hybrid"), prefs)
    assert any("Hybrid" in r for r in reasons)


def test_api_filters_with_demo_journals(client):  # noqa: F811
    manuscript_id = upload(client, docx_bytes()).json()["manuscript_id"]

    def ids(prefs):
        body = {"manuscript_id": manuscript_id, "preferences": prefs}
        return {r["journal_id"] for r in client.post("/match", json=body).json()}

    assert ids({"max_review_days": 60}) == {"demo-ai-001"}                  # 45 days
    assert ids({"required_indexes": ["wos"]}) == {"demo-med-001", "demo-agri-001"}
    assert ids({"required_indexes": ["scopus", "wos"]}) == {"demo-med-001"}
