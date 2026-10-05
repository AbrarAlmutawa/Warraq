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


# --- Impact Factor: a threshold alone is a preference; exclusion is the researcher's choice. ---


def test_impact_factor_any_has_no_effect():
    prefs = MatchPreferences(exclude_below_impact_factor=True)  # toggle without a threshold
    assert hard_constraint_failures(journal(impact_factor=0.5), prefs) == []
    assert preference_bonus(journal(impact_factor=9.0), prefs) == (0.0, [])
    assert preference_bonus(journal(), prefs) == (0.0, [])


def test_impact_factor_threshold_without_exclusion_is_only_a_bonus():
    prefs = MatchPreferences(min_impact_factor=3)
    assert hard_constraint_failures(journal(impact_factor=2.0), prefs) == []
    assert preference_bonus(journal(impact_factor=2.0), prefs)[0] == 0.0
    bonus, reasons = preference_bonus(journal(impact_factor=4.0), prefs)
    assert bonus == 0.03
    assert "Impact Factor meets your preference" in reasons
    assert preference_bonus(journal(impact_factor=3.0), prefs)[0] == 0.03  # threshold is inclusive


def test_impact_factor_exclusion_removes_only_known_values_below_threshold():
    prefs = MatchPreferences(min_impact_factor=3, exclude_below_impact_factor=True)
    assert hard_constraint_failures(journal(impact_factor=2.0), prefs) == ["min_impact_factor"]
    assert hard_constraint_failures(journal(impact_factor=4.0), prefs) == []
    assert preference_bonus(journal(impact_factor=4.0), prefs)[0] == 0.03


def test_missing_impact_factor_is_kept_and_flagged():
    prefs = MatchPreferences(min_impact_factor=3, exclude_below_impact_factor=True)
    assert hard_constraint_failures(journal(), prefs) == []
    bonus, reasons = preference_bonus(journal(), prefs)
    assert bonus == 0.0
    assert any("Impact Factor not available" in r for r in reasons)


def test_impact_factor_bonus_stays_within_the_cap():
    prefs = MatchPreferences(
        preferred_publishers=["P"],
        preferred_journals=["J"],
        prefer_open_access=True,
        min_impact_factor=1,
    )
    j = journal(publisher="P", access_model="open_access", impact_factor=10.0)
    assert preference_bonus(j, prefs)[0] == 0.08


def test_api_impact_factor_preference_and_exclusion(client):  # noqa: F811
    manuscript_id = upload(client, docx_bytes()).json()["manuscript_id"]

    def results(prefs):
        body = {"manuscript_id": manuscript_id, "preferences": prefs}
        return {r["journal_id"]: r for r in client.post("/match", json=body).json()}

    # Demo data: ai 3.4, med 1.8, agri not available.
    assert set(results({"min_impact_factor": 3})) == {"demo-ai-001", "demo-med-001", "demo-agri-001"}
    kept = results({"min_impact_factor": 3, "exclude_below_impact_factor": True})
    assert set(kept) == {"demo-ai-001", "demo-agri-001"}
    assert kept["demo-ai-001"]["impact_factor"] == 3.4
    assert kept["demo-ai-001"]["impact_factor_year"] == 2024
    assert kept["demo-ai-001"]["impact_factor_source"] == "Demo data (fictional)"
    assert kept["demo-agri-001"]["impact_factor"] is None


def test_journal_list_includes_impact_factor(client):  # noqa: F811
    journals = {j["journal_id"]: j for j in client.get("/journals").json()}
    assert journals["demo-med-001"]["impact_factor"] == 1.8
    assert journals["demo-agri-001"]["impact_factor"] is None
