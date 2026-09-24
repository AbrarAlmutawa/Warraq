"""LLM gateway and AI suggestions, with a fake Anthropic client (no network, no key)."""

from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import main
from db import get_store
from db.seed import seed_if_empty
from db.store import Store
from services.llm import LLMGateway, LLMNotConfiguredError, get_gateway
from services.llm.pricing import estimate_cost_usd

DEMO_DOCX = Path(__file__).parent / "fixtures" / "warraq_demo_manuscript.docx"


class FakeClient:
    """Mimics anthropic.Anthropic().messages.create with a fixed tool output."""

    def __init__(self, output: dict | None = None, error: Exception | None = None, stop_reason="tool_use"):
        self.output, self.error, self.stop_reason, self.calls = output or {}, error, stop_reason, []
        self.messages = self

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        content = [SimpleNamespace(type="tool_use", input=self.output)]
        return SimpleNamespace(content=content, stop_reason=self.stop_reason,
                               usage=SimpleNamespace(input_tokens=1200, output_tokens=300))


TOOL = {"name": "t", "description": "d", "input_schema": {"type": "object", "properties": {}}}


@pytest.fixture
def store(tmp_path):
    s = Store(tmp_path / "llm.db")
    seed_if_empty(s)
    return s


# ---------------------------------------------------------------- gateway

def test_gateway_ok_logs_usage_and_cost(store):
    client = FakeClient({"x": 1})
    result = LLMGateway(store, lambda: client).call_tool("suggestions", user="hi", tool=TOOL)
    assert result.status == "ok" and result.data == {"x": 1} and not result.cached
    assert client.calls[0]["tool_choice"] == {"type": "tool", "name": "t"}
    [row] = store.llm_usage()
    assert row["task"] == "suggestions" and row["input_tokens"] == 1200
    assert row["cost_usd"] == estimate_cost_usd(row["model"], 1200, 300)


def test_gateway_caches_identical_requests(store):
    client = FakeClient({"x": 1})
    gw = LLMGateway(store, lambda: client)
    gw.call_tool("suggestions", user="same", tool=TOOL)
    second = gw.call_tool("suggestions", user="same", tool=TOOL)
    assert second.cached and len(client.calls) == 1
    assert store.llm_usage()[0]["cached_calls"] == 1


def test_gateway_never_raises(store):
    def no_key():
        raise LLMNotConfiguredError("no key")

    assert LLMGateway(store, no_key).call_tool("suggestions", user="a", tool=TOOL).status == "unavailable"
    assert LLMGateway(store, lambda: FakeClient(error=TimeoutError("slow"))).call_tool(
        "suggestions", user="b", tool=TOOL).status == "error"
    truncated = LLMGateway(store, lambda: FakeClient({"x": 1}, stop_reason="max_tokens"))
    assert truncated.call_tool("suggestions", user="c", tool=TOOL).status == "error"
    assert len(store.recent_llm_errors()) == 3


def test_unknown_model_price_is_not_guessed():
    assert estimate_cost_usd("some-future-model", 1000, 1000) is None


# ------------------------------------------------------------ suggestions

GOOD_OUTPUT = {
    "scope_fit": {"rating": "strong", "rationale": "The paper applies deep learning to radiographs, which is core to the journal."},
    "shorter_title": "Leakage-Safe Multimodal Learning for Wrist Fracture Classification and Gap Estimation",
    "shorter_abstract": None,
    "highlights": ["Four-class wrist fracture model", "Leakage-safe metadata protocol", "Normalized gap score"],
    "statements": [{"statement": "data_availability", "text": "The data are available at [repository name]."}],
}


def api(store, client):
    main.app.dependency_overrides[get_store] = lambda: store
    main.app.dependency_overrides[get_gateway] = lambda: LLMGateway(store, lambda: client)
    return TestClient(main.app)


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    main.app.dependency_overrides.clear()


def upload(c):
    with DEMO_DOCX.open("rb") as f:
        return c.post("/manuscripts/upload", files={"file": ("demo.docx", f)}).json()["manuscript_id"]


def test_suggestions_for_failed_rules_only(store):
    fake = FakeClient(GOOD_OUTPUT)
    c = api(store, fake)
    mid = upload(c)

    body = c.post("/suggestions", json={"manuscript_id": mid, "journal_id": "demo-med-001"}).json()
    assert body["status"] == "ok"
    kinds = [s["kind"] for s in body["suggestions"]]
    # JMI: title passes (so no title suggestion even though the model sent one),
    # highlights and data availability fail.
    assert kinds == ["scope_fit", "draft_highlights", "draft_statement"]
    assert all(s["status"] == "pending" for s in body["suggestions"])
    statement = body["suggestions"][2]
    assert statement["rule_id"] == "statement:data_availability" and "[repository name]" in statement["after"]
    assert "Fill in the bracketed details" in statement["rationale"]

    # The prompt only asks for what failed.
    prompt = fake.calls[0]["messages"][0]["content"]
    assert "highlights:" in prompt and "shorter_title" not in prompt


def test_title_suggestion_is_dropped_if_still_too_long(store):
    output = dict(GOOD_OUTPUT, shorter_title="One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen")
    c = api(store, FakeClient(output))
    mid = upload(c)
    body = c.post("/suggestions", json={"manuscript_id": mid, "journal_id": "demo-ai-001"}).json()
    assert "shorten_title" not in [s["kind"] for s in body["suggestions"]]


def test_title_suggestion_kept_when_it_fits(store):
    c = api(store, FakeClient(GOOD_OUTPUT))
    mid = upload(c)
    body = c.post("/suggestions", json={"manuscript_id": mid, "journal_id": "demo-ai-001"}).json()
    title = next(s for s in body["suggestions"] if s["kind"] == "shorten_title")
    assert title["block_id"] == "paragraph_0" and title["before"] != title["after"]


def test_stored_suggestions_keep_decisions(store):
    fake = FakeClient(GOOD_OUTPUT)
    c = api(store, fake)
    mid = upload(c)
    first = c.post("/suggestions", json={"manuscript_id": mid, "journal_id": "demo-med-001"}).json()
    sid = first["suggestions"][1]["suggestion_id"]

    assert c.patch(f"/suggestions/{sid}", json={"status": "accepted"}).json()["status"] == "accepted"
    again = c.post("/suggestions", json={"manuscript_id": mid, "journal_id": "demo-med-001"}).json()
    assert again["status"] == "stored" and len(fake.calls) == 1
    assert next(s for s in again["suggestions"] if s["suggestion_id"] == sid)["status"] == "accepted"


def test_no_key_degrades_gracefully(store):
    def no_key():
        raise LLMNotConfiguredError("no key")

    main.app.dependency_overrides[get_store] = lambda: store
    main.app.dependency_overrides[get_gateway] = lambda: LLMGateway(store, no_key)
    c = TestClient(main.app)
    mid = upload(c)
    body = c.post("/suggestions", json={"manuscript_id": mid, "journal_id": "demo-med-001"}).json()
    assert body["status"] == "unavailable" and body["suggestions"] == []
    # The deterministic checklist is unaffected.
    assert c.post("/validate", json={"manuscript_id": mid, "journal_id": "demo-med-001"}).status_code == 200


def test_usage_endpoint(store):
    c = api(store, FakeClient(GOOD_OUTPUT))
    mid = upload(c)
    c.post("/suggestions", json={"manuscript_id": mid, "journal_id": "demo-med-001"})
    usage = c.get("/llm/usage").json()
    assert usage["models"]["citation_conversion"].startswith("claude-haiku")
    assert usage["usage"][0]["task"] == "suggestions"


def test_decide_unknown_suggestion(store):
    c = api(store, FakeClient(GOOD_OUTPUT))
    assert c.patch("/suggestions/nope", json={"status": "accepted"}).status_code == 404


# ------------------------------------------------------ journal agent path

def test_journal_extraction_goes_through_gateway(store, monkeypatch):
    import services.journal_agent.nodes as nodes
    from services.journal_agent.graph import build_graph

    output = {
        "scope_description": "Medical imaging.", "max_title_words": 20, "max_abstract_words": 250,
        "required_statements": None, "indexes": None,  # nulls must not crash
        "field_confidences": {"scope_description": 0.9, "max_title_words": 0.95, "max_abstract_words": 0.9},
    }
    monkeypatch.setattr(nodes, "get_gateway", lambda: LLMGateway(store, lambda: FakeClient(output)))
    import services.journal_agent.graph as graph_module
    monkeypatch.setattr(graph_module, "scrape_node", lambda s: {**s, "raw_text": "guidelines text", "scrape_error": None})

    saved, flagged = [], []
    graph = build_graph(saved.append, flagged.append)
    graph.invoke({"journal_id": "j", "journal_name": "J", "publisher": "P", "source_url": "https://j"})
    assert len(saved) == 1 and not flagged
    assert saved[0].hard_constraints.max_abstract_words == 250
    assert store.llm_usage()[0]["task"] == "journal_extraction"


def test_journal_extraction_failure_goes_to_review(store, monkeypatch):
    import services.journal_agent.nodes as nodes
    from services.journal_agent.graph import build_graph

    monkeypatch.setattr(nodes, "get_gateway", lambda: LLMGateway(store, lambda: FakeClient(error=TimeoutError("slow"))))
    import services.journal_agent.graph as graph_module
    monkeypatch.setattr(graph_module, "scrape_node", lambda s: {**s, "raw_text": "text", "scrape_error": None})

    saved, flagged = [], []
    build_graph(saved.append, flagged.append).invoke(
        {"journal_id": "j", "journal_name": "J", "publisher": "P", "source_url": "https://j"})
    assert not saved and len(flagged) == 1 and "LLM error" in flagged[0].raw_extract_notes
