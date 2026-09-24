# Submission checklist (`/validate`)

Owner: Jana (S4). Code: `apps/api/services/validator/rules.py`.

## How it works

`POST /validate` with `{manuscript_id, journal_id}` checks the saved manuscript against the
journal's hard rules and returns a `ValidationReport`. **Switch Journal** is the same call with a
different `journal_id`: the paper is never re-parsed. `POST /validate/compare` returns only the
readiness summary for several journals at once.

All checks are plain Python, with no LLM: the same paper and journal always give the same result.
AI suggestions will be added separately and are never mixed with these results.

## Result statuses

- **passed**: the manuscript meets the rule.
- **failed**: the manuscript breaks a rule the journal states.
- **review**: a human should check, because either the rule was extracted with low confidence
  (< 0.6), Warraq cannot measure it yet (page count, undetectable citation style), or a statement
  is mentioned in the text without its own section.

A rule the journal does not state produces no result at all.

## Rules

| rule_id | Checks | Highlights (block_ids) |
| --- | --- | --- |
| `title_length` | title words <= max | title |
| `abstract_length` | abstract words <= max | abstract paragraphs |
| `keyword_count` | keywords within range | keywords line |
| `word_count` | main-text words <= max | none |
| `reference_count` | references within range | references |
| `citation_style` | detected style (IEEE `[n]` / APA `(Year)`) equals required | references |
| `table_count`, `figure_count` | count <= max | captions |
| `highlights` | "Highlights" section with the required number of lines | highlights section |
| `template` | Word vs LaTeX submission | none |
| `page_count` | always **review** (not measurable from DOCX) | none |
| `statement:<id>` | a section for data_availability / conflict_of_interest / funding / ethics | that section |
| `section:<name>` | required section exists (Methods = Methodology, etc.) | that section |

## Expected results for the demo manuscript

`apps/api/tests/fixtures/warraq_demo_manuscript.docx` (fictional paper) against the three demo
journals. `tests/test_validate.py` checks exactly this table.

| Rule | Demo JAI | Demo JMI | Demo JAS |
| --- | --- | --- | --- |
| Title (20 words) | failed (<= 15) | passed (<= 20) | passed (<= 25) |
| Abstract (290 words) | failed (<= 250) | passed (<= 300) | passed (<= 350) |
| Keywords (5) | passed (4-6) | not stated | not stated |
| Main text (797 words) | passed (<= 8,000) | not stated | not stated |
| References (22) | failed (30-60) | failed (25-80) | passed (20-100) |
| Citation style (IEEE) | passed | failed (APA) | failed (APA) |
| Tables (2) / Figures (1) | not stated | passed | not stated |
| Highlights (none) | not stated | failed (3-5) | not stated |
| Data availability | failed | failed | not stated |
| Conflict of interest | passed | not stated | passed |
| Ethics / Funding | not stated | passed | not stated |
| **Failed total** | **4** | **4** | **1** |
