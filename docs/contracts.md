# Warraq API Contracts v1 (proposal)

Owner: Jana (S4). Status: **draft for team review**. Code lives in `apps/api/models/`.

The goal is one agreed shape for every piece of data that passes between modules, so
S1, S2, S3 and S5 can keep working in parallel and still fit together.

## 1. How data flows

```
upload .docx ──► S2 parse ──► ManuscriptRecord (manuscript_id)      stored once
S1 agent ──► JournalRequirementSpec                                 stored per journal
                     │ spec_to_profile()
                     ▼
POST /match  : ManuscriptRecord + JournalProfile[] ──► S3 match ──► JournalMatchView[]
POST /validate: manuscript_id + journal_id ──► ValidationReport
Switch Journal = POST /validate again with a different journal_id (no re-parsing)
```

## 2. Contracts

| Contract | File | Produced by | Read by |
| --- | --- | --- | --- |
| `JournalRequirementSpec` (+ `HardConstraint`) | `models/journal.py` | S1 agent | S4, validator, frontend (via views) |
| `ManuscriptParsedData` | `services/analyzer/models.py` | S2 parser | unchanged |
| `ManuscriptRecord`, `ManuscriptUploadResponse` | `models/manuscript.py` | S4 | everyone, by `manuscript_id` |
| `JournalProfile`, `JournalMatch` | `services/matcher/models.py` | S3 | unchanged; S4 converts |
| `JournalSummary`, `JournalMatchView` | `models/views.py` | S4 | S5 journal screens |
| `RequirementResult`, `Suggestion`, `ValidationReport` | `models/validation.py` | S4 validator | S5 workspace |

Conversions between them live only in `models/adapters.py`.

## 3. What changed, per person

**Abrar (S1).** New Optional fields in your schema (nothing existing was renamed):
- `HardConstraint`: `max_abstract_words`, `keyword_range`, `max_tables`, `max_figures`,
  `highlights_range`, `required_statements`, `required_sections`
- `JournalRequirementSpec`: `short_name`, `aims`, `indexes`, `field_confidences`,
  `field_excerpts` (a short quote from the page per field, shown as the rule's source), `is_demo`
- The extraction tool schema in `nodes.py` now asks for these fields too. Please check the
  results on real pages and tune the prompt.

**Estabraq (S2).** No changes to your models. The backend wraps your output in `ManuscriptRecord`.
Your `block_ids` are what the frontend highlights, so they're now part of every validation result.
Later, the exporter can read `RequirementResult.block_ids` instead of the old `ValidationIssue`.

**Dima (S3).** No changes to your code. The backend converts journal specs to your `JournalProfile`
and wraps your `JournalMatch` into `JournalMatchView`.
Question: Maha's preferences screen has *max review days* and *required indexes (Scopus/WoS)*.
Should those become `MatchPreferences` fields and hard filters in the matcher?

**Maha (S5).** Your types map to the backend like this:

| Frontend type | Backend model |
| --- | --- |
| `JournalMatch` | `JournalMatchView` |
| `RequirementResult` | `RequirementResult` |
| `WarraqSuggestion` | `Suggestion` |
| `ReadinessSummary` | `ReadinessSummary` |

Differences to know:
- Field names are **snake_case** (`journal_id`, not `journalId`). Proposal: convert in one place in
  `lib/api-client.ts`.
- Confidence comes as a number (0-1) **and** as `confidence_level` ("high"/"medium"/"low").
- Access model values are `open_access` / `hybrid` / `subscription` / `unknown`
  (your `full` = `open_access`).
- Rule ids use snake_case: `title_length`, `abstract_length`, `word_count`, `reference_count`,
  `citation_style`, `keyword_count`, `table_count`, `figure_count`, `highlights`, `template`,
  `statement:<id>`, `section:<name>`.
- Results point to text with `block_ids` (paragraph ids from the parser), not editor line ranges.

## 4. Decisions needed

1. **snake_case vs camelCase** in API responses (proposal: snake_case, converted in the frontend client).
2. **Scope-fit thresholds**: strong >= 0.70, good >= 0.50, else possible. Tune with real journals.
3. **Confidence levels**: high >= 0.85, medium >= 0.60, else low.
4. **Review days and indexes** as matcher filters (Dima + Maha).
5. **File formats**: backend parses DOCX only; the frontend accepts PDF, TeX and ZIP.
   Either restrict the upload screen to DOCX for the demo, or plan PDF parsing.

## 5. Endpoints (implemented)

- `POST /manuscripts/upload` → `ManuscriptUploadResponse`
- `GET /manuscripts/{manuscript_id}` → `ManuscriptRecord`
- `GET /journals` → `JournalSummary[]`
- `GET /journals/review-queue` → `ReviewQueueItem[]`
- `GET /journals/{journal_id}` → `JournalRequirementSpec`
- `POST /match` with `{manuscript_id, preferences}` → `JournalMatchView[]`
  (**changed:** it no longer takes the whole paper in the body)
- `POST /validate` with `{manuscript_id, journal_id}` → `ValidationReport` (see `docs/validation.md`)
- `POST /validate/compare` with `{manuscript_id, journal_ids}` → readiness summary per journal

## 6. Rule for changing a contract

Add new fields as Optional with a default. Never rename or remove a field without telling
everyone who reads it (see the table in section 2).
