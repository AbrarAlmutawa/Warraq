"""
Central settings for the Warraq API.

Every environment-dependent value lives here, so no module reads
os.environ directly. Values come from real environment variables or
from a .env file at the repo root or in apps/api (see .env.example).
"""

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

_API_DIR = Path(__file__).resolve().parents[1]
load_dotenv(_API_DIR / ".env")
load_dotenv(_API_DIR.parents[1] / ".env")


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    anthropic_api_key: str | None = field(
        default_factory=lambda: os.getenv("ANTHROPIC_API_KEY") or None
    )
    # Browser origins allowed to call the API (the Next.js app).
    frontend_origins: list[str] = field(
        default_factory=lambda: _split_csv(
            os.getenv("FRONTEND_ORIGINS", "http://localhost:3000")
        )
    )
    # Model per LLM task. Keep these configurable: model choice is a
    # budget/quality decision we will tune, not something to hardcode.
    # Guideline pages -> structured rules. Runs rarely (offline), accuracy matters.
    journal_extraction_model: str = field(
        default_factory=lambda: os.getenv("JOURNAL_EXTRACTION_MODEL", "claude-sonnet-5")
    )
    # Researcher-facing AI suggestions (scope fit, drafts). Needs judgment.
    suggestions_model: str = field(
        default_factory=lambda: os.getenv("SUGGESTIONS_MODEL", "claude-sonnet-5")
    )
    # Mechanical reformatting (citation style conversion). Cheap and fast.
    citation_model: str = field(
        default_factory=lambda: os.getenv("CITATION_MODEL", "claude-haiku-4-5-20251001")
    )
    # Reuse identical LLM answers (same model + same input) instead of paying again.
    llm_cache_enabled: bool = field(
        default_factory=lambda: os.getenv("LLM_CACHE_ENABLED", "true").lower() == "true"
    )
    llm_timeout_seconds: float = field(
        default_factory=lambda: float(os.getenv("LLM_TIMEOUT_SECONDS", "60"))
    )
    # SQLite file for manuscripts, journals and the review queue.
    database_path: str = field(
        default_factory=lambda: os.getenv(
            "DATABASE_PATH", str(_API_DIR / "data" / "warraq.db")
        )
    )
    # Load the demo journals into an empty database on startup.
    seed_demo_journals: bool = field(
        default_factory=lambda: os.getenv("SEED_DEMO_JOURNALS", "true").lower() == "true"
    )
    max_upload_mb: int = field(
        default_factory=lambda: int(os.getenv("MAX_UPLOAD_MB", "25"))
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
