"""
Builds and exposes the journal-agent graph.

Persistence is injected as callables rather than imported directly, so
this module has zero dependency on S4's DB layer while it doesn't exist
yet. When apps/api/db is ready, S4 (or you) just passes in the real
save_spec / enqueue_for_review functions instead of the in-memory stubs.
"""

from typing import Callable

from langgraph.graph import END, StateGraph

from models.journal import JournalRequirementSpec, ReviewQueueItem
from services.journal_agent.nodes import (
    confidence_check_node,
    extract_node,
    route_after_confidence_check,
    scrape_node,
)
from services.journal_agent.state import AgentState

SaveSpecFn = Callable[[JournalRequirementSpec], None]
EnqueueReviewFn = Callable[[ReviewQueueItem], None]


def build_graph(save_spec: SaveSpecFn, enqueue_for_review: EnqueueReviewFn):
    def finalize_node(state: AgentState) -> AgentState:
        save_spec(state["draft_spec"])
        return state

    def flag_for_review_node(state: AgentState) -> AgentState:
        item = ReviewQueueItem(
            journal_id=state["journal_id"],
            name=state["journal_name"],
            source_url=state["source_url"],
            draft_spec=state["draft_spec"],
            low_confidence_fields=state.get("low_confidence_fields", []),
            raw_extract_notes=state.get("extract_error"),
        )
        enqueue_for_review(item)
        return state

    graph = StateGraph(AgentState)
    graph.add_node("scrape", scrape_node)
    graph.add_node("extract", extract_node)
    graph.add_node("confidence_check", confidence_check_node)
    graph.add_node("finalize", finalize_node)
    graph.add_node("flag_for_review", flag_for_review_node)

    graph.set_entry_point("scrape")
    graph.add_edge("scrape", "extract")
    graph.add_edge("extract", "confidence_check")
    graph.add_conditional_edges(
        "confidence_check",
        route_after_confidence_check,
        {"finalize": "finalize", "flag_for_review": "flag_for_review"},
    )
    graph.add_edge("finalize", END)
    graph.add_edge("flag_for_review", END)

    return graph.compile()


# ---- in-memory stubs for local dev / Days 2-3, before S4's DB exists ----

_SPECS: dict[str, JournalRequirementSpec] = {}
_REVIEW_QUEUE: dict[str, ReviewQueueItem] = {}


def _memory_save_spec(spec: JournalRequirementSpec) -> None:
    _SPECS[spec.journal_id] = spec


def _memory_enqueue_for_review(item: ReviewQueueItem) -> None:
    _REVIEW_QUEUE[item.journal_id] = item


def build_dev_graph():
    """Convenience constructor wired to the in-memory stubs above."""
    return build_graph(_memory_save_spec, _memory_enqueue_for_review)
