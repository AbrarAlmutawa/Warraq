"""
Single entry point for LLM access (S4 / LLMOps).

For now this only creates the Anthropic client lazily, so importing any
module never requires an API key. Model routing, retries, fallbacks and
cost logging will be added here, and every agent should call the LLM
through this module rather than creating its own client.
"""

from functools import lru_cache

import anthropic

from core.config import get_settings


class LLMNotConfiguredError(RuntimeError):
    """Raised when an LLM call is attempted without an API key."""


@lru_cache
def get_anthropic_client() -> anthropic.Anthropic:
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise LLMNotConfiguredError(
            "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key."
        )
    return anthropic.Anthropic(
        api_key=settings.anthropic_api_key,
        timeout=settings.llm_timeout_seconds,
        max_retries=2,
    )
