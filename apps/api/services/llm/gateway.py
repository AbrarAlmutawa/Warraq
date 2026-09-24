"""
LLM gateway (S4 / LLMOps): the ONE way Warraq calls an LLM.

Every call goes through `call_tool`, which:
  1. picks the model for the task from settings (budget/quality per task),
  2. forces structured output through a tool schema (no free text to parse),
  3. returns a cached answer when the exact same request was made before,
  4. never raises: failures come back as status "unavailable" / "error",
     so a missing key, a timeout or a rate limit degrades gracefully,
  5. logs task, model, tokens, latency and estimated cost for every call.
"""

import hashlib
import json
import time
from functools import lru_cache
from typing import Any, Callable, Literal

from pydantic import BaseModel

from core.config import get_settings
from services.llm.client import LLMNotConfiguredError, get_anthropic_client
from services.llm.pricing import estimate_cost_usd

Task = Literal["journal_extraction", "suggestions", "citation_conversion"]


class LLMResult(BaseModel):
    status: Literal["ok", "unavailable", "error"]
    data: dict[str, Any] | None = None
    model: str | None = None
    cached: bool = False
    error: str | None = None


class LLMCallLog(BaseModel):
    task: str
    model: str
    status: str
    cached: bool = False
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float | None = None
    latency_ms: int = 0
    error: str | None = None


def model_for(task: Task) -> str:
    s = get_settings()
    return {
        "journal_extraction": s.journal_extraction_model,
        "suggestions": s.suggestions_model,
        "citation_conversion": s.citation_model,
    }[task]


class LLMGateway:
    def __init__(self, store, client_factory: Callable[[], Any] = get_anthropic_client):
        self.store = store
        self.client_factory = client_factory

    def call_tool(
        self,
        task: Task,
        *,
        user: str,
        tool: dict,
        system: str | None = None,
        max_tokens: int = 2000,
        use_cache: bool = True,
    ) -> LLMResult:
        model = model_for(task)
        settings = get_settings()
        key = hashlib.sha256(
            json.dumps([model, system, user, tool, max_tokens], sort_keys=True).encode("utf-8")
        ).hexdigest()

        if use_cache and settings.llm_cache_enabled:
            cached = self.store.get_llm_cache(key)
            if cached is not None:
                self.store.log_llm_call(LLMCallLog(task=task, model=model, status="ok", cached=True))
                return LLMResult(status="ok", data=cached, model=model, cached=True)

        started = time.perf_counter()
        try:
            client = self.client_factory()
            kwargs = dict(
                model=model,
                max_tokens=max_tokens,
                tools=[tool],
                tool_choice={"type": "tool", "name": tool["name"]},
                messages=[{"role": "user", "content": user}],
            )
            if system:
                kwargs["system"] = system
            message = client.messages.create(**kwargs)
            latency = int((time.perf_counter() - started) * 1000)

            tool_use = next((b for b in message.content if getattr(b, "type", None) == "tool_use"), None)
            usage = getattr(message, "usage", None)
            in_tok = getattr(usage, "input_tokens", 0) or 0
            out_tok = getattr(usage, "output_tokens", 0) or 0
            log = LLMCallLog(
                task=task, model=model, status="ok", input_tokens=in_tok, output_tokens=out_tok,
                cost_usd=estimate_cost_usd(model, in_tok, out_tok), latency_ms=latency,
            )

            if tool_use is None or getattr(message, "stop_reason", None) == "max_tokens":
                log.status, log.error = "error", "no complete tool output (possibly hit max_tokens)"
                self.store.log_llm_call(log)
                return LLMResult(status="error", model=model, error=log.error)

            data = dict(tool_use.input)
            self.store.log_llm_call(log)
            if settings.llm_cache_enabled:
                self.store.set_llm_cache(key, data)
            return LLMResult(status="ok", data=data, model=model)

        except LLMNotConfiguredError as exc:
            self.store.log_llm_call(LLMCallLog(task=task, model=model, status="unavailable", error=str(exc)))
            return LLMResult(status="unavailable", model=model, error=str(exc))
        except Exception as exc:  # noqa: BLE001 - network, rate limit, timeout, API errors
            latency = int((time.perf_counter() - started) * 1000)
            error = f"{type(exc).__name__}: {exc}"[:500]
            self.store.log_llm_call(LLMCallLog(task=task, model=model, status="error", latency_ms=latency, error=error))
            return LLMResult(status="error", model=model, error=error)


@lru_cache
def get_gateway() -> LLMGateway:
    """FastAPI dependency and default for non-API code. Tests build their own gateway."""
    from db import get_store  # local import: db imports models, keep llm importable on its own

    return LLMGateway(get_store())
