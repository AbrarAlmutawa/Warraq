# LLMOps

Owner: Jana (S4). Code: `apps/api/services/llm/`.

## One gateway for every AI call

Nothing in Warraq calls the Anthropic SDK directly. Every call goes through
`get_gateway().call_tool(task, user=..., tool=...)`, which:

1. **Picks the model for the task** from settings (table below).
2. **Forces structured output** with a tool schema, so there is no free text to parse.
3. **Caches** identical requests (same model and input) so repeats cost nothing.
4. **Never raises.** A missing key returns `unavailable`; a timeout, rate limit, API error or
   truncated output returns `error`. Callers fall back instead of crashing, and the checklist
   (`/validate`) never depends on the LLM at all.
5. **Logs every call**: task, model, status, tokens, latency, estimated cost. See
   `GET /llm/usage`.

## Model per task

| Task | Default model | Why |
| --- | --- | --- |
| `journal_extraction` | `claude-sonnet-5` | Rules must be read accurately and it runs rarely (offline, once per journal), so quality beats cost. |
| `suggestions` | `claude-sonnet-5` | Researcher-facing judgment (scope fit, faithful drafts). |
| `citation_conversion` | `claude-haiku-4-5-20251001` | Mechanical reformatting, high volume per paper: the cheap, fast model is enough. |

Change any of them in `.env` (`JOURNAL_EXTRACTION_MODEL`, `SUGGESTIONS_MODEL`, `CITATION_MODEL`)
without touching code. Hard rules (title length, reference counts, ...) use **no model**: they
are plain Python in `services/validator/`.

### Rough cost (estimates, check current prices)

Using $2/$10 per million input/output tokens for Sonnet 5 and $1/$5 for Haiku 4.5
(`services/llm/pricing.py`):

- Extracting one journal (~6k in, ~1.5k out): about **$0.03**, so 20 journals is about $0.50.
- Suggestions for one paper and journal (~2.5k in, ~0.8k out): about **$0.01**.
- Converting ~25 references (~2k in, ~2k out on Haiku): about **$0.01**.

Real numbers come from `GET /llm/usage` once the key is set.

## AI suggestions (`POST /suggestions`)

One call per manuscript and journal returns a **scope-fit** assessment, plus drafts only for
rules that **failed** in the checklist: a shorter title, a shorter abstract, highlights, or a
missing statement.

Guardrails:
- The prompt forbids inventing facts; unknown details are written as `[placeholders]`, and the
  suggestion tells the researcher to fill them in.
- Output is checked in code: a "shorter" title or abstract that is still over the limit is
  dropped, and drafts are only kept for rules that actually failed.
- Every suggestion starts as `pending`. `PATCH /suggestions/{id}` records `accepted` or
  `rejected`; the backend never edits the manuscript itself.
- Suggestions are stored, so reopening the workspace or switching back to a journal does not
  call the AI again (`status: "stored"`). Send `refresh: true` to regenerate.

## Citation conversion (`POST /citations/convert`)

Powers the checklist fix `convert_citations`. Send `{manuscript_id, journal_id}` to use the
journal's required style, or `{manuscript_id, to_style}` with `apa`, `ieee`, `mla` or `chicago`.

The work is split so the model only does what needs language understanding:

- **Model (Haiku 4.5):** rewrites each reference and gives its in-text form. It must not add a
  DOI, pages, volume or any detail missing from the original; it lists them in `missing_fields`.
- **Code:** IEEE numbering and in-text `[n]`, alphabetical order for author-date styles,
  batching (20 references per call), ignoring duplicate or unknown items, reporting references
  that did not come back (`failed_indexes`, status `partial`), and checking the result is
  really the target style (`verified`, for APA and IEEE).

Nothing is applied to the manuscript; the workspace shows the proposal for the researcher to
accept. Each item keeps the `block_id` of the original reference for highlighting.
