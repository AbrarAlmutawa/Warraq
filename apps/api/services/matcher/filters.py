from .models import JournalProfile, MatchPreferences


def _norm(value: str) -> str:
    return value.strip().casefold().replace("-", "_").replace(" ", "_")


def hard_constraint_failures(journal: JournalProfile, prefs: MatchPreferences) -> list[str]:
    failures: list[str] = []

    if prefs.article_type and journal.accepted_article_types:
        accepted = {_norm(x) for x in journal.accepted_article_types}
        if _norm(prefs.article_type) not in accepted:
            failures.append("article_type")

    if prefs.language and journal.languages:
        languages = {_norm(x) for x in journal.languages}
        if _norm(prefs.language) not in languages:
            failures.append("language")

    if prefs.open_access_only and journal.access_model not in {"open_access", "hybrid"}:
        failures.append("open_access")

    if prefs.max_apc is not None and journal.apc is not None:
        same_currency = (
            not prefs.apc_currency
            or not journal.apc_currency
            or prefs.apc_currency.casefold() == journal.apc_currency.casefold()
        )
        if same_currency and journal.apc > prefs.max_apc:
            failures.append("max_apc")

    return failures


def filter_journals(
    journals: list[JournalProfile], prefs: MatchPreferences
) -> list[JournalProfile]:
    return [j for j in journals if not hard_constraint_failures(j, prefs)]
