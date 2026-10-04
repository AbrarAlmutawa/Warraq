# Editing the manuscript

Owner: Jana (S4). Code: `apps/api/services/editing/`, `apps/api/routers/editing.py`.

## The idea

Warraq applies a change **only when the researcher accepts it**. When they do, the change is
written into their **real Word file** and saved as a new **revision**:

- revision 0 = the original upload
- revision 1, 2, ... = each applied change

The latest revision *is* the manuscript for the rest of Warraq: `GET /manuscripts/{id}`,
`/validate`, `/match`, `/suggestions` and `/citations/convert` all see it. So edits survive leaving
the workspace, refreshing, and switching journals, and the checklist updates right away.

Editing the Word file (instead of plain text) keeps the researcher's fonts, styles, tables and
figures, keeps the parser's counts consistent, and gives them a file they can actually submit.

## Endpoints

| Method | Endpoint | Body | What it does |
| --- | --- | --- | --- |
| PATCH | `/manuscripts/{id}/blocks/{block_id}` | `{text}` | Replace one paragraph's text |
| POST | `/manuscripts/{id}/apply-suggestion/{suggestion_id}` | none | Apply an accepted AI suggestion and mark it `accepted` |
| POST | `/manuscripts/{id}/references` | `{references: [...], description?}` | Replace the reference list (e.g. after `/citations/convert`) |
| POST | `/manuscripts/{id}/undo` | none | Remove the latest change |
| POST | `/manuscripts/{id}/reset` | none | Back to the original upload |
| GET | `/manuscripts/{id}/download` | `?format=docx\|latex`, `?revision=N` (both optional) | The Word file (default) or a LaTeX zip, latest version by default |

Every editing endpoint returns the updated `ManuscriptRecord`, so the frontend can redraw the
editor from the response without another request.

## What gets applied

| Suggestion `kind` | Change to the Word file |
| --- | --- |
| `shorten_title` | Replaces the title |
| `shorten_abstract` | Replaces the abstract paragraphs |
| `draft_highlights` | Adds a "Highlights" section before the abstract (or updates it) |
| `draft_statement` | Adds the statement before the references (or updates an existing one) |
| `scope_fit` | Nothing: advice only (returns 409) |

New sections copy the formatting of the manuscript's own headings and paragraphs. A section that
already exists is updated, never duplicated. AI drafts can contain `[placeholders]`: after applying,
the frontend should point the researcher to them.

## New fields

- `ManuscriptRecord.revision`: the current revision number.
- `ManuscriptRecord.editable`: `false` only for manuscripts uploaded before editing existed;
  uploading the same file again makes them editable.
- `ManuscriptRecord.history`: `[{revision, description, created_at}]`, e.g. "Highlights added (AI suggestion)".
- `ManuscriptUploadResponse.revision`: uploading a file that was already edited returns it **with**
  its edits (`from_cache: true`). Use `/reset` to start over.
- `Suggestion.applied_revision`: the revision created when the suggestion was applied.

## For the frontend (Maha)

- **Block ids change after an edit** (inserting a section shifts paragraph numbers). Always rebuild
  the editor from the `parsed.blocks` of the latest response, and re-run `/validate` after each edit.
- **Accept** on an applicable suggestion = `POST .../apply-suggestion/{id}`. **Reject** stays
  `PATCH /suggestions/{id}`.
- **Citation proposal accepted** = `POST .../references` with the converted texts in the order
  shown, and a description like "References converted to APA".
- **Undo**, **Start over** and **Download** buttons map directly to `/undo`, `/reset`, `/download`.
  The download response sets `Content-Disposition` with the file name (exposed to the browser).
- 409 responses carry a readable `detail` to show the researcher.

## LaTeX export

`GET /manuscripts/{id}/download?format=latex` returns a zip that compiles as is (code:
`apps/api/services/export/latex.py`):

```
<name>/main.tex      article-class paper
<name>/figures/      images taken from the Word file
<name>/README.txt    how to compile (and anything to check by hand)
```

- Title and author lines become `\title` / `\author`; Abstract and Keywords go in the `abstract`
  environment; headings become `\section` / `\subsection` (manual numbers are dropped because
  LaTeX numbers them); statements and Highlights become `\section*`.
- Bold and italic are kept; images and tables become `figure` / `table` environments with their
  captions; references become `thebibliography`, and numeric citations like `[1]` or `[2-4]` are
  linked with `\cite` (author-year citations stay as text).
- English papers compile with pdfLaTeX. Papers with Arabic text switch to XeLaTeX (polyglossia,
  Amiri font), as noted at the top of `main.tex` and in the README; English passages inside an
  Arabic paper stay left-to-right.
- It is a clean generic version, not a journal's own template: if the journal has one, the
  sections can be copied into it. Images LaTeX can't include (EMF, WMF...) are listed in the README.
