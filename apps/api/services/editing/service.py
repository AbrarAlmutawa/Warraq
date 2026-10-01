"""
Manuscript revisions (S4).

Every accepted change creates a new revision of the researcher's DOCX:
  revision 0 = the original upload, 1, 2, ... = each applied change.
The latest revision is "the manuscript" for everything else in Warraq
(validate, match, suggestions, citations), so edits survive page changes,
refreshes and journal switches. Undo removes the latest revision.
"""

from typing import Callable

from db.store import Store
from models.manuscript import ManuscriptRecord
from models.validation import Suggestion
from services.editing import docx_edits as ed


class NotEditable(Exception):
    """The original file of this manuscript was not kept (uploaded before editing existed)."""


Operation = Callable[[object, object], str]  # (doc, parsed) -> description


def save_original(store: Store, record: ManuscriptRecord, docx: bytes) -> None:
    """Keep the uploaded file as revision 0 (only once)."""
    if store.get_revision_docx(record.manuscript_id, 0) is None:
        store.save_revision(record.manuscript_id, 0, "Original upload", docx, record.parsed)


def apply(store: Store, manuscript_id: str, operation: Operation, description: str | None = None) -> ManuscriptRecord:
    record = store.get_manuscript(manuscript_id)
    latest = store.get_revision_docx(manuscript_id)
    if record is None or latest is None:
        raise NotEditable()
    revision, docx = latest

    doc = ed.load(docx)
    default_description = operation(doc, record.parsed)
    new_docx = ed.save(doc)
    parsed = ed.reparse(new_docx)

    store.save_revision(manuscript_id, revision + 1, description or default_description, new_docx, parsed)
    return store.get_manuscript(manuscript_id)


def undo(store: Store, manuscript_id: str) -> ManuscriptRecord:
    record = store.get_manuscript(manuscript_id)
    if record is None or not record.editable:
        raise NotEditable()
    if record.revision > 0:
        store.delete_revisions_after(manuscript_id, record.revision - 1)
    return store.get_manuscript(manuscript_id)


def reset(store: Store, manuscript_id: str) -> ManuscriptRecord:
    record = store.get_manuscript(manuscript_id)
    if record is None or not record.editable:
        raise NotEditable()
    store.delete_revisions_after(manuscript_id, 0)
    return store.get_manuscript(manuscript_id)


# ------------------------------------------------------------ suggestions

APPLICABLE_KINDS = {"shorten_title", "shorten_abstract", "draft_highlights", "draft_statement"}


def operation_for_suggestion(suggestion: Suggestion) -> tuple[Operation, str]:
    """Turn an AI suggestion into the DOCX edit it describes."""
    kind, after = suggestion.kind, (suggestion.after or "").strip()
    if kind not in APPLICABLE_KINDS or not after:
        raise ed.EditError("This suggestion is advice only; there is nothing to apply to the manuscript.")

    if kind == "shorten_title":
        return (lambda doc, parsed: ed.set_title(doc, parsed, after)), "Title shortened (AI suggestion)"

    if kind == "shorten_abstract":
        return (lambda doc, parsed: ed.replace_abstract(doc, parsed, after)), "Abstract shortened (AI suggestion)"

    if kind == "draft_highlights":
        lines = [line.strip().lstrip("\u2022-*").strip() for line in after.splitlines() if line.strip()]
        return (
            lambda doc, parsed: ed.upsert_section(doc, parsed, "Highlights", lines, position="before_abstract", bullets=True),
            "Highlights added (AI suggestion)",
        )

    # draft_statement: "Heading\nText..."
    heading, _, body = after.partition("\n")
    body_lines = [line for line in body.splitlines() if line.strip()]
    if not body_lines:
        raise ed.EditError("This statement draft has no text.")
    return (
        lambda doc, parsed: ed.upsert_section(doc, parsed, heading, body_lines, position="before_references"),
        f"{heading.strip()} added (AI suggestion)",
    )


def apply_suggestion(store: Store, manuscript_id: str, suggestion_id: str) -> ManuscriptRecord:
    owner = store.get_suggestion_owner(suggestion_id)
    suggestion = store.get_suggestion(suggestion_id)
    if owner is None or suggestion is None or owner[0] != manuscript_id:
        raise LookupError("Suggestion not found for this manuscript.")

    current = store.get_manuscript(manuscript_id)
    if current is None or not current.editable:
        raise NotEditable()
    if suggestion.applied_revision is not None and suggestion.applied_revision <= current.revision:
        raise ed.EditError("This suggestion is already applied. Undo it first to apply it again.")

    operation, description = operation_for_suggestion(suggestion)
    record = apply(store, manuscript_id, operation, description)

    suggestion.status = "accepted"
    suggestion.applied_revision = record.revision
    store.update_suggestion(suggestion)
    return record
