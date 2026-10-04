import csv
import io
import re
import uuid
from collections import Counter
from typing import Any

from models.journal import JournalRequirementSpec
from models.journal_list import JournalList, JournalListEntry

MAX_CSV_BYTES = 2 * 1024 * 1024
MAX_JOURNALS = 500

NAME_KEYS = {
    "journal_name",
    "journal name",
    "journal",
    "name",
    "title",
    "journal title",
    "journal_title",
}
ISSN_KEYS = {"issn", "print_issn", "pissn", "print issn"}
EISSN_KEYS = {"eissn", "e_issn", "electronic_issn", "electronic issn", "online_issn", "online issn"}
PUBLISHER_KEYS = {"publisher"}
JOURNAL_ID_KEYS = {"journal_id", "journal id", "warraq_journal_id", "warraq journal id"}


class JournalListError(ValueError):
    """The supplied list cannot be parsed or accepted."""


def normalize_name(value: str | None) -> str:
    text = (value or "").strip().casefold()
    text = re.sub(r"&", " and ", text)
    text = re.sub(r"[^a-z0-9\u0600-\u06ff]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def normalize_header(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().casefold().replace("-", "_")).strip()


def normalize_issn(value: str | None) -> str | None:
    raw = re.sub(r"[^0-9Xx]", "", value or "")
    if len(raw) != 8:
        return None
    return f"{raw[:4]}-{raw[4:].upper()}"


def _first(row: dict[str, str], keys: set[str]) -> str | None:
    for key in keys:
        if row.get(key):
            return row[key]
    return None


def parse_csv(content: bytes) -> tuple[list[dict[str, Any]], list[str]]:
    if not content:
        raise JournalListError("The uploaded journal list is empty.")
    if len(content) > MAX_CSV_BYTES:
        raise JournalListError("The uploaded journal list is larger than 2 MB.")
    if content.startswith(b"\xef\xbb\xbf"):
        content = content[3:]

    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = content.decode("cp1256")
        except UnicodeDecodeError as exc:
            raise JournalListError("The CSV file must be UTF-8 encoded.") from exc
    if "\x00" in text:
        raise JournalListError("The CSV file contains binary data and could not be parsed.")

    try:
        sample = text[:4096]
        dialect = csv.Sniffer().sniff(sample) if sample.strip() else csv.excel
    except csv.Error:
        dialect = csv.excel

    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    if not reader.fieldnames:
        raise JournalListError("The CSV file must include a header row.")

    normalized_headers = [normalize_header(h) for h in reader.fieldnames]
    rows: list[dict[str, Any]] = []
    warnings: list[str] = []

    for row_number, raw in enumerate(reader, start=2):
        normalized = {
            normalized_headers[i]: (value or "").strip()
            for i, value in enumerate(raw.values())
            if i < len(normalized_headers)
        }
        if not any(normalized.values()):
            continue
        metadata = {
            key: value
            for key, value in normalized.items()
            if value and key not in NAME_KEYS | JOURNAL_ID_KEYS | ISSN_KEYS | EISSN_KEYS | PUBLISHER_KEYS
        }
        rows.append(
            {
                "row_number": row_number,
                "journal_name": _first(normalized, NAME_KEYS) or "",
                "journal_id": _first(normalized, JOURNAL_ID_KEYS),
                "issn": _first(normalized, ISSN_KEYS),
                "eissn": _first(normalized, EISSN_KEYS),
                "publisher": _first(normalized, PUBLISHER_KEYS),
                "metadata": metadata,
            }
        )
        if len(rows) > MAX_JOURNALS:
            raise JournalListError(f"Journal lists are limited to {MAX_JOURNALS} non-empty rows.")

    if not rows:
        raise JournalListError("The CSV file did not contain any journal rows.")
    if all(not row["journal_name"] and not row.get("issn") and not row.get("eissn") for row in rows):
        raise JournalListError("The CSV needs a journal name, ISSN, or eISSN column.")
    if len(set(normalized_headers)) != len(normalized_headers):
        warnings.append("Duplicate column names were collapsed after normalization.")
    return rows, warnings


def _journal_identifiers(spec: JournalRequirementSpec) -> set[str]:
    identifiers = {normalize_name(spec.name)}
    if spec.short_name:
        identifiers.add(normalize_name(spec.short_name))
    return {item for item in identifiers if item}


def resolve_entries(
    journal_list_id: str,
    raw_rows: list[dict[str, Any]],
    stored_journals: list[JournalRequirementSpec],
) -> list[JournalListEntry]:
    by_id = {spec.journal_id: spec for spec in stored_journals}
    names: dict[str, list[JournalRequirementSpec]] = {}
    for spec in stored_journals:
        for identifier in _journal_identifiers(spec):
            names.setdefault(identifier, []).append(spec)

    duplicate_keys = Counter()
    prepared: list[tuple[dict[str, Any], str | None, str, str | None, str | None]] = []
    for row in raw_rows:
        journal_id = (row.get("journal_id") or "").strip() or None
        normalized = normalize_name(row.get("journal_name"))
        issn = normalize_issn(row.get("issn"))
        eissn = normalize_issn(row.get("eissn"))
        key = journal_id or issn or eissn or normalized
        if key:
            duplicate_keys[key] += 1
        prepared.append((row, journal_id, normalized, issn, eissn))

    seen: set[str] = set()
    entries: list[JournalListEntry] = []
    for row, journal_id, normalized, issn, eissn in prepared:
        key = journal_id or issn or eissn or normalized
        metadata_source = row.get("metadata") or {
            k: v
            for k, v in row.items()
            if normalize_header(k)
            not in NAME_KEYS | JOURNAL_ID_KEYS | ISSN_KEYS | EISSN_KEYS | PUBLISHER_KEYS | {"row_number"}
        }
        metadata = {str(k): str(v) for k, v in metadata_source.items() if v is not None and str(v) != ""}
        if row.get("row_number"):
            metadata.setdefault("row_number", str(row["row_number"]))

        base = dict(
            entry_id=str(uuid.uuid4()),
            journal_list_id=journal_list_id,
            original_name=(row.get("journal_name") or "").strip(),
            normalized_name=normalized,
            issn=issn,
            eissn=eissn,
            publisher=(row.get("publisher") or None),
            metadata=metadata,
        )

        if not key:
            entries.append(
                JournalListEntry(
                    **base,
                    resolution_status="invalid",
                    resolution_message="Missing journal name, ISSN, and eISSN.",
                )
            )
            continue
        if key in seen or duplicate_keys[key] > 1 and key in seen:
            entries.append(
                JournalListEntry(
                    **base,
                    resolution_status="duplicate",
                    resolution_message="Duplicate entry in this journal list.",
                )
            )
            continue
        seen.add(key)

        if journal_id:
            matched = by_id.get(journal_id)
            if matched is not None:
                entries.append(
                    JournalListEntry(
                        **base,
                        matched_journal_id=matched.journal_id,
                        resolution_status="resolved",
                        resolution_message="Matched an existing Warraq journal by journal_id.",
                    )
                )
                continue

        candidates = names.get(normalized, []) if normalized else []
        if len(candidates) == 1:
            entries.append(
                JournalListEntry(
                    **base,
                    matched_journal_id=candidates[0].journal_id,
                    resolution_status="resolved",
                    resolution_message="Matched an existing Warraq journal by name.",
                )
            )
        elif len(candidates) > 1:
            entries.append(
                JournalListEntry(
                    **base,
                    resolution_status="ambiguous",
                    resolution_message="More than one existing journal matched this name.",
                )
            )
        else:
            entries.append(
                JournalListEntry(
                    **base,
                    resolution_status="unresolved",
                    resolution_message=(
                        "No existing Warraq journal matched this entry. "
                        "Run S1 acquisition or add/approve the journal before it can be matched."
                    ),
                )
            )

    return entries


def summarize(journal_list: JournalList, entries: list[JournalListEntry]) -> JournalList:
    counts = Counter(entry.resolution_status for entry in entries)
    journal_list.journal_count = len(entries)
    journal_list.resolved_count = counts["resolved"]
    journal_list.unresolved_count = counts["unresolved"]
    journal_list.duplicate_count = counts["duplicate"]
    journal_list.invalid_count = counts["invalid"]
    journal_list.ambiguous_count = counts["ambiguous"]
    return journal_list


def build_journal_list(
    *,
    name: str,
    description: str | None,
    institution: str | None,
    source_filename: str | None,
    rows: list[dict[str, Any]],
    stored_journals: list[JournalRequirementSpec],
) -> tuple[JournalList, list[JournalListEntry]]:
    journal_list = JournalList(
        journal_list_id=str(uuid.uuid4()),
        name=name.strip(),
        description=description.strip() if description else None,
        institution=institution.strip() if institution else None,
        source_filename=source_filename,
    )
    entries = resolve_entries(journal_list.journal_list_id, rows, stored_journals)
    return summarize(journal_list, entries), entries
