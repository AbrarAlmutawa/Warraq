import re

from services.analyzer.models import ManuscriptParsedData

from .models import JournalProfile


def build_paper_profile(paper: ManuscriptParsedData) -> str:
    """Use topic-bearing manuscript fields; avoid methods/references noise."""
    keywords = ", ".join(paper.keywords)
    return f"Title: {paper.title}\nAbstract: {paper.abstract}\nKeywords: {keywords}".strip()


def build_journal_profile(journal: JournalProfile) -> str:
    topics = ", ".join(journal.topics)
    return (
        f"Journal: {journal.name}\n"
        f"Aims: {journal.aims}\n"
        f"Scope: {journal.scope}\n"
        f"Topics: {topics}"
    ).strip()


def normalized_terms(text: str) -> set[str]:
    return set(re.findall(r"[\w-]+", text.lower(), flags=re.UNICODE))
