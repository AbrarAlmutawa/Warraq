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

## Journal agent (local loop)

```bash
python -m services.journal_agent.run_local
```

## Conventions

- **Imports:** everything is imported relative to `apps/api`, for example
  `from services.matcher import match` and `from models.journal import JournalRequirementSpec`.
  Never use `from apps.api...`.
- **Settings:** read configuration through `core.config.get_settings()`, never `os.environ` directly.
- **LLM calls:** get the client from `services.llm.get_anthropic_client()`; don't create your own.
- **Shared schemas:** cross-team contracts live in `models/`. Add new fields as Optional with a default.
