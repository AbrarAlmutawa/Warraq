"""Citation conversion with a fake model: the model rewrites, code numbers, sorts and checks."""

import re
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import main
from db import get_store
from db.seed import seed_if_empty
from db.store import Store
from models.journal import CitationStyle, HardConstraint, JournalRequirementSpec
from services.citations import convert_references
from services.llm import LLMGateway, LLMNotConfiguredError, get_gateway

DEMO_DOCX = Path(__file__).parent / "fixtures" / "warraq_demo_manuscript.docx"


class FakeConverter:
    """Reads the numbered references from the prompt and returns author-year versions."""

    def __init__(self, drop=(), duplicate=False, prefix_numbers=False, missing=()):
        self.drop, self.duplicate, self.prefix, self.missing = set(drop), duplicate, prefix_numbers, set(missing)
        self.calls = []
        self.messages = self

    def create(self, **kwargs):
        self.calls.append(kwargs)
        items = []
        for line in kwargs["messages"][0]["content"].splitlines():
            m = re.match(r"^(\d+)\. (.+)$", line)
            if not m:
                continue
            index, text = int(m.group(1)), m.group(2)
            if index in self.drop:
                continue
            author = text.split(",")[0].split(" and ")[0].strip()
            year = (re.findall(r"(?:19|20)\d{2}", text) or ["n.d."])[-1]
            converted = f"{author} ({year}). Converted reference {index}."
            if self.prefix:
                converted = f"[{index}] {converted}"
            items.append({"index": index, "converted": converted, "in_text": f"({author}, {year})",
                          "missing_fields": ["doi"] if index in self.missing else []})
        if self.duplicate and items:
            items.append(dict(items[0], converted="duplicate"))
        items.append({"index": 999, "converted": "not asked for"})
        return SimpleNamespace(content=[SimpleNamespace(type="tool_use", input={"references": items})],
                               stop_reason="tool_use", usage=SimpleNamespace(input_tokens=500, output_tokens=500))


IEEE_REFS = [
    "[1] S. Zeta and R. Sample, \u201cFirst paper,\u201d Demo Journal, vol. 1, pp. 1\u20132, 2023.",
    "[2] A. Alpha, \u201cSecond paper,\u201d Demo Letters, vol. 2, pp. 3\u20134, 2021.",
    "[3] M. Middle, \u201cThird paper,\u201d Demo Review, vol. 3, pp. 5\u20136, 2022.",
]
APA_REFS = [
    "Zeta, S. (2023). First paper. Demo Journal, 1, 1-2.",
    "Alpha, A. (2021). Second paper. Demo Letters, 2, 3-4.",
]


@pytest.fixture
def store(tmp_path):
    s = Store(tmp_path / "c.db")
    seed_if_empty(s)
    return s


def gw(store, client):
    return LLMGateway(store, lambda: client)


# ------------------------------------------------------------------ unit

def test_ieee_to_apa_sorted_verified_and_in_text(store):
    result = convert_references(gw(store, FakeConverter()), IEEE_REFS, CitationStyle.APA,
                                block_ids=["p1", "p2", "p3"])
    assert result.status == "ok" and result.from_style == CitationStyle.IEEE and result.verified is True
    assert [r.original_index for r in result.references] == [2, 3, 1]  # alphabetical: A., M., S.
    assert result.references[0].block_id == "p2"
    assert result.references[0].in_text == "(A. Alpha, 2021)"
    assert "in-text citations" in result.message


def test_apa_to_ieee_numbering_is_done_in_code(store):
    fake = FakeConverter(prefix_numbers=True)  # model wrongly adds its own numbers
    result = convert_references(gw(store, fake), APA_REFS, CitationStyle.IEEE)
    assert [r.converted[:4] for r in result.references] == ["[1] ", "[2] "]
    assert not result.references[0].converted.startswith("[1] [1]")
    assert [r.in_text for r in result.references] == ["[1]", "[2]"]
    assert result.verified is True


def test_missing_duplicate_and_unknown_items_are_handled(store):
    fake = FakeConverter(drop={2}, duplicate=True, missing={3})
    result = convert_references(gw(store, fake), IEEE_REFS, CitationStyle.APA)
    assert result.status == "partial" and result.failed_indexes == [2]
    assert len(result.references) == 2  # duplicate and index 999 ignored
    assert "could not be converted" in result.message and "nothing was invented" in result.message


def test_same_style_needs_no_ai(store):
    fake = FakeConverter()
    result = convert_references(gw(store, fake), IEEE_REFS, CitationStyle.IEEE)
    assert result.status == "ok" and result.references == [] and fake.calls == []


def test_batches_long_lists(store):
    fake = FakeConverter()
    refs = [f"[{i}] A. Author{i}, \u201cPaper {i},\u201d Demo, 2020." for i in range(1, 46)]
    result = convert_references(gw(store, fake), refs, CitationStyle.APA)
    assert len(fake.calls) == 3 and len(result.references) == 45


def test_no_key_is_unavailable(store):
    def no_key():
        raise LLMNotConfiguredError("no key")

    result = convert_references(LLMGateway(store, no_key), IEEE_REFS, CitationStyle.APA)
    assert result.status == "unavailable" and result.references == []


def test_uses_the_cheap_model(store):
    fake = FakeConverter()
    convert_references(gw(store, fake), IEEE_REFS, CitationStyle.APA)
    assert fake.calls[0]["model"].startswith("claude-haiku")


# ------------------------------------------------------------------- API

@pytest.fixture
def client(store):
    fake = FakeConverter()
    main.app.dependency_overrides[get_store] = lambda: store
    main.app.dependency_overrides[get_gateway] = lambda: gw(store, fake)
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


@pytest.fixture
def manuscript_id(client):
    with DEMO_DOCX.open("rb") as f:
        return client.post("/manuscripts/upload", files={"file": ("demo.docx", f)}).json()["manuscript_id"]


def test_convert_endpoint_with_journal_style(client, manuscript_id):
    body = client.post("/citations/convert",
                       json={"manuscript_id": manuscript_id, "journal_id": "demo-med-001"}).json()
    assert body["to_style"] == "apa" and body["from_style"] == "ieee"
    assert len(body["references"]) == 22 and body["verified"] is True
    assert all(r["block_id"] and r["block_id"].startswith("paragraph_") for r in body["references"])


def test_convert_endpoint_errors(client, manuscript_id, store):
    assert client.post("/citations/convert", json={"manuscript_id": manuscript_id}).status_code == 422
    assert client.post("/citations/convert", json={"manuscript_id": "nope", "to_style": "apa"}).status_code == 404
    store.save_journal(JournalRequirementSpec(
        journal_id="no-style", name="N", publisher="P", source_url="https://n",
        hard_constraints=HardConstraint(), scope_description="s", extraction_confidence=1, access_model="hybrid"))
    assert client.post("/citations/convert",
                       json={"manuscript_id": manuscript_id, "journal_id": "no-style"}).status_code == 400
