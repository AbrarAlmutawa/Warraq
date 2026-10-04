# Custom journal list matching

Owner: Dima. Code: `apps/api/routers/journal_lists.py`,
`apps/api/services/journal_lists/`, `apps/api/models/journal_list.py`.

## Purpose

Researchers can restrict matching to an institution-provided list, such as
"IAU Approved Journals 2026" or "IAU Reward Journals 2026". Warraq ranks only
journals from that list. It must not introduce journals outside the supplied
list.

## Supported V1 input

V1 supports CSV upload and JSON/manual creation. XLSX is intentionally left for
a later step so we do not add spreadsheet parsing risk until the CSV flow is
stable.

Recognized CSV columns are optional and case-insensitive:

- `journal_name`, `journal`, `name`, `title`
- `journal_id`, `warraq_journal_id`
- `issn`
- `eissn`
- `publisher`

Unknown columns are preserved as institutional metadata, for example
`reward_eligible`, `reward_amount`, `category`, or `notes`.

Limits:

- maximum upload size: 2 MB
- maximum non-empty rows: 500
- empty rows are skipped
- duplicate normalized journal names/ISSNs are marked, not silently removed

## Resolution behavior

Resolution is against the existing Warraq journal catalog only:

- exact Warraq `journal_id` match -> `resolved`
- exact normalized journal name or short name match -> `resolved`
- ISSN/eISSN values are normalized, stored, returned, and used for duplicate
  detection inside the uploaded list
- ISSN/eISSN values do not resolve entries against the catalog in V1 because
  `JournalRequirementSpec` does not currently store ISSN/eISSN fields
- no name/ISSN/eISSN -> `invalid`
- duplicate row inside the supplied list -> `duplicate`
- multiple existing journals with the same normalized name -> `ambiguous`
- no existing Warraq journal -> `unresolved`

Unknown journals are kept in the response as unresolved entries. The feature
does not scrape from inside a match request. To make an unresolved journal
matchable, run the S1 acquisition/review workflow and approve the journal into
the catalog, then upload or recreate the list.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/journal-lists` | Saved lists |
| `POST` | `/journal-lists` | Create a list from JSON/manual entries |
| `POST` | `/journal-lists/upload` | Upload a CSV journal list |
| `GET` | `/journal-lists/{id}` | List metadata and entries |
| `GET` | `/journal-lists/{id}/journals` | Same detail shape, convenient alias |
| `DELETE` | `/journal-lists/{id}` | Delete list and entries |
| `POST` | `/journal-lists/{id}/match` | Rank the manuscript against resolved journals from this list only |

Match request:

```json
{
  "manuscript_id": "...",
  "preferences": {}
}
```

Match response includes list counts, unresolved entries, and each match paired
with the source list entry so the frontend can show institutional metadata.

## Relationship to existing services

This feature owns list upload, parsing, storage, resolution, and list-specific
API behavior. It reuses:

- `Store` for SQLite persistence
- `JournalRequirementSpec` as the source of journal facts
- `spec_to_profile()` and `build_match_view()` adapters
- the existing S3 `match()` function for scoring/ranking

The normal `/match` endpoint and full-catalog workflow are unchanged.
