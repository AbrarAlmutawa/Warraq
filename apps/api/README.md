# Warraq API

FastAPI backend for Warraq. All commands below run from `apps/api`.

## Setup

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../../.env.example .env       # then add your ANTHROPIC_API_KEY
```

## Run

```bash
uvicorn main:app --reload
```

- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

## Test

```bash
pytest
```

## Endpoints

| Method | Path | What it does |
| --- | --- | --- |
| POST | `/manuscripts/upload` | Parse a DOCX, save it, return `manuscript_id` (same file again = cached) |
| GET | `/manuscripts/{manuscript_id}` | The saved parse |
| GET | `/journals` | All journals as summary cards |
| GET | `/journals/review-queue` | Journals the agent flagged for human review |
| GET | `/journals/{journal_id}` | One journal's full requirements |
| POST | `/match` | `{manuscript_id, preferences}` → ranked journals |
| POST | `/validate` | `{manuscript_id, journal_id}` → submission checklist (Switch Journal = call again) |
| POST | `/validate/compare` | `{manuscript_id, journal_ids}` → readiness summary per journal |
| POST | `/suggestions` | `{manuscript_id, journal_id}` → AI scope fit + drafts for failed rules |
| PATCH | `/suggestions/{id}` | `{status: accepted \| rejected}` |
| GET | `/llm/usage` | Calls, tokens and estimated cost per AI task |

## Database

A SQLite file at `apps/api/data/warraq.db` (ignored by Git). On first start, three
**demo** journals (`is_demo: true`, invented rules) are loaded so the app works before
real journals exist. Delete the file to start fresh.

## Journal agent

```bash
python -m services.journal_agent.run_local   # try extraction, results stay in memory
python -m db.run_agent                       # scrape db/seed/journal_sources.json into the database
```

## Conventions

- **Imports:** everything is imported relative to `apps/api`, for example
  `from services.matcher import match` and `from models.journal import JournalRequirementSpec`.
  Never use `from apps.api...`.
- **Settings:** read configuration through `core.config.get_settings()`, never `os.environ` directly.
- **LLM calls:** always `services.llm.get_gateway().call_tool(...)` (see `docs/llmops.md`); never create your own client.
- **Shared schemas:** cross-team contracts live in `models/`. Add new fields as Optional with a default.
