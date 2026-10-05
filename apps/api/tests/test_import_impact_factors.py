"""Manual Impact Factor import: official values only, always with year and source."""

import pytest

from db.import_impact_factors import apply_impact_factors, keep_manual_impact_factor, parse_rows

from tests.test_api import store  # noqa: F401  (fixture)

HEADER = "journal_id,impact_factor,year,source\n"


def test_valid_rows_update_journals_and_unknown_ids_are_reported(store):  # noqa: F811
    rows = parse_rows(HEADER + "demo-agri-001,2.7,2024,Clarivate JCR\nnot-a-journal,5.0,2024,Clarivate JCR\n")
    updated, unknown = apply_impact_factors(store, rows)
    assert (updated, unknown) == (1, ["not-a-journal"])
    spec = store.get_journal("demo-agri-001")
    assert (spec.impact_factor, spec.impact_factor_year, spec.impact_factor_source) == (2.7, 2024, "Clarivate JCR")
    assert store.get_journal("not-a-journal") is None


@pytest.mark.parametrize(
    "row",
    [
        "demo-agri-001,2.7,,Clarivate JCR",  # no year
        "demo-agri-001,2.7,2024,",  # no source
        "demo-agri-001,,2024,Clarivate JCR",  # no value
        "demo-agri-001,high,2024,Clarivate JCR",  # not a number
    ],
)
def test_incomplete_rows_are_rejected(row):
    with pytest.raises(ValueError, match="Row 2"):
        parse_rows(HEADER + row + "\n")


def test_missing_columns_are_rejected():
    with pytest.raises(ValueError, match="year"):
        parse_rows("journal_id,impact_factor,source\ndemo-agri-001,2.7,Clarivate JCR\n")


def test_rescrape_keeps_manual_impact_factor(store):  # noqa: F811
    apply_impact_factors(store, parse_rows(HEADER + "demo-agri-001,2.7,2024,Clarivate JCR\n"))
    rescraped = store.get_journal("demo-agri-001").model_copy(
        update={"impact_factor": None, "impact_factor_year": None, "impact_factor_source": None, "aims": "new"}
    )
    keep_manual_impact_factor(store)(rescraped)
    spec = store.get_journal("demo-agri-001")
    assert spec.aims == "new"
    assert (spec.impact_factor, spec.impact_factor_year, spec.impact_factor_source) == (2.7, 2024, "Clarivate JCR")
