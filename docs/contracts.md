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

**Dima (S3).** Small additive changes only (see decision 3 and 4): optional `review_days_avg` and `indexes` on `JournalProfile`, optional `prefer_open_access`, `max_review_days`, `required_indexes` on `MatchPreferences`, two filters and a few reasons. Existing behaviour and tests are unchanged. The backend converts journal specs to your `JournalProfile`
and wraps your `JournalMatch` into `JournalMatchView`.

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

## 4. Team decisions (v1)

Proposed by S4 and applied in the code. If anyone disagrees, raise it and we change it.

**1. Field names stay snake_case** (`journal_id`, not `journalId`).
Every module and model already uses snake_case, and the parser's output is embedded in
responses, so camelCase would mean changing everyone's models. The frontend converts in one
place (`lib/api-client.ts`), or generates its types from `/openapi.json` so they match exactly.

**2. DOCX only for the demo.** The backend parses DOCX only, and a reliable demo matters more
than more formats. The upload screen should accept `.docx` only for now. PDF and LaTeX stay on
the roadmap (the `file_format` field is already in `ManuscriptRecord`).

**3. Review time and indexing are matcher filters.** They describe the journal, not the
manuscript, so they belong with the other journal-choice filters (open access, APC).
Rule for all filters: **published data that contradicts the preference excludes a journal;
missing data never does.** A journal with no published review time or indexing is kept and
marked in its `reasons` ("Review time not published; check before submitting").
This follows Warraq's principle of flagging instead of guessing.

**4. Open access.**
- *Required*: the paper can be published open access, so fully open-access **and hybrid**
  journals pass. Hybrid results say so in `reasons`
  ("Hybrid journal: open access is available for an APC").
- *Preferred*: nothing is excluded; fully open-access journals get a small ranking bonus.
- *Any*: no effect.

**5. Thresholds (starting values, calibrate with real journals).**
- Scope fit: strong >= 0.70, good >= 0.50, otherwise possible (`models/adapters.py`).
- Confidence: high >= 0.85, medium >= 0.60, otherwise low (`models/validation.py`).
- A failed rule whose confidence is below 0.60 is shown as `review`, not `failed`.
  Scope-fit thresholds depend on the embedding model's score range, so we will re-check them
  once 15-20 real journals are in the database.

### Frontend preferences → `/match` request

| Preferences screen | `preferences` field |
| --- | --- |
| Max APC (0 = free only, null = any) | `max_apc` |
| Open access "required" | `open_access_only: true` |
| Open access "preferred" | `prefer_open_access: true` |
| Max review days (null = any) | `max_review_days` |
| Required indexes | `required_indexes: ["scopus", "wos"]` |
| Article type | `article_type` |

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
- `POST /suggestions` with `{manuscript_id, journal_id, refresh?}` → `{status, message, suggestions: Suggestion[]}`
  (`status`: ok / stored / unavailable / error; see `docs/llmops.md`)
- `PATCH /suggestions/{suggestion_id}` with `{status}` → `Suggestion`
- `GET /llm/usage` → usage and estimated cost per AI task

## 6. Rule for changing a contract

Add new fields as Optional with a default. Never rename or remove a field without telling
everyone who reads it (see the table in section 2).
