# S3 Matcher

S3 consumes `ManuscriptParsedData` from S2 and journal profiles from S1. It deliberately separates:

1. **Hard constraints** - deterministic article type, language, OA/access, and APC checks.
2. **Semantic scope fit** - embeddings over paper `title + abstract + keywords` versus journal `aims + scope + topics`.
3. **Ranking** - semantic similarity remains dominant; explicit researcher preferences add only a small bonus.

## Temporary S1 integration

`fixtures/journals.json` is a development-only catalog so S3 is not blocked while S1 is unfinished. `JournalProfile` in `models.py` is the proposed S1 to S3 contract. Once S1 persists/serves journal data, replace `catalog.load_journal_catalog()` with that source; the matcher itself should not need to change.

Do not put abstract limits, manuscript word limits, citation style, figure rules, or other fixable submission requirements into S3 hard filtering. Those belong to journal-specific validation after selection.

## Embeddings

The runtime provider lazily loads `sentence-transformers/all-MiniLM-L6-v2`. Tests inject fake embeddings, so unit tests are deterministic and do not download a model.
