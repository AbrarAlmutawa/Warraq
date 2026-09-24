"""
USD per million tokens, used only to ESTIMATE cost in the usage log.

Check https://www.anthropic.com/pricing (or the Claude Console) before
relying on these numbers; prices change. Unknown models are logged with
cost None rather than a guess.
"""

PRICES_PER_MTOK: dict[str, tuple[float, float]] = {
    # model id: (input, output)
    "claude-haiku-4-5-20251001": (1.0, 5.0),
    "claude-sonnet-5": (2.0, 10.0),
    "claude-opus-5-5": (4.0, 20.0),
}


def estimate_cost_usd(model: str, input_tokens: int, output_tokens: int) -> float | None:
    prices = PRICES_PER_MTOK.get(model)
    if prices is None:
        return None
    return round((input_tokens * prices[0] + output_tokens * prices[1]) / 1_000_000, 6)
