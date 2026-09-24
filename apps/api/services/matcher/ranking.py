from .models import JournalProfile, MatchPreferences


def preference_bonus(journal: JournalProfile, prefs: MatchPreferences) -> tuple[float, list[str]]:
    bonus = 0.0
    reasons: list[str] = []
    preferred_publishers = {x.casefold() for x in prefs.preferred_publishers}
    preferred_journals = {x.casefold() for x in prefs.preferred_journals}

    if journal.publisher and journal.publisher.casefold() in preferred_publishers:
        bonus += 0.03
        reasons.append("Preferred publisher")
    if (
        journal.name.casefold() in preferred_journals
        or journal.journal_id.casefold() in preferred_journals
    ):
        bonus += 0.05
        reasons.append("Preferred journal")

    # Added by S4 (team decisions v1).
    if prefs.prefer_open_access and journal.access_model == "open_access":
        bonus += 0.03
        reasons.append("Fully open access (preferred)")
    if prefs.open_access_only and journal.access_model == "hybrid":
        reasons.append("Hybrid journal: open access is available for an APC")
    if prefs.max_review_days is not None and journal.review_days_avg is None:
        reasons.append("Review time not published; check before submitting")
    if prefs.required_indexes and not journal.indexes:
        reasons.append("Indexing not confirmed; check before submitting")
    return min(bonus, 0.08), reasons


def final_score(similarity: float, bonus: float) -> float:
    return max(0.0, min(1.0, similarity + bonus))
