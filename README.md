<div align="center">

# وَرّاق · Warraq

### كل فكرة .. ورّاقة ✨


![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-backend-009688?logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-frontend-000000?logo=nextdotjs&logoColor=white)
![Claude](https://img.shields.io/badge/AI-Claude-D97757)
![Arabic first](https://img.shields.io/badge/UI-%D8%B9%D8%B1%D8%A8%D9%8A-DA614A)

</div>

---

## 📜 Why "Warraq"?

In classical Arabic book culture, the **ورّاق** was the person who copied, prepared and sold
manuscripts: the one who turned an author's work into something ready for readers.
We're doing the same job, just with fewer ink stains.

## 🧶 The problem, in one story

You finish your paper. 🎉 Then you open twelve journal websites in twelve tabs. One wants a
250-word abstract, another wants 300. One wants APA, another wants IEEE. One wants "highlights"
(what even are those?). You finally pick a journal, reformat everything… and then decide it's too
expensive. Back to tab one. 🔁

**Warraq fixes that.** It recommends journals that fit your paper *and* your priorities, turns each
journal's guidelines into a checklist, checks your manuscript against it, and lets you switch
journals in one click without starting over.

---

## 🚀 What it does

- 📄 **Upload a manuscript** (DOCX). Warraq extracts the title, abstract, keywords, sections, references,
  tables and figures.
- 🎯 **Recommend journals** by scope fit, filtered by the researcher's priorities: APC budget, open
  access, review time, indexing and article type.
- 🕵️ **Collect journal requirements** from each journal's official author-guideline page with an AI agent.
  Every rule keeps a link to its source, and anything the agent is unsure about goes to a human review
  queue instead of being guessed.
- ✅ **Check the manuscript** against the chosen journal: title and abstract length, keywords, word count,
  reference range, citation style, tables and figures, highlights, and required statements.
- 🔀 **Switch journal** in one click. The checklist is recalculated for the new journal without re-parsing
  the paper.
- 🤖 **Suggest fixes with AI**: a scope-fit assessment, shorter titles or abstracts, draft highlights and
  missing statements, and citation style conversion (for example IEEE to APA). Nothing is applied
  without the researcher's approval.

### ⚖️ Hard rules vs. AI suggestions

The golden rule of Warraq: **the AI suggests, the researcher decides.** The two are kept strictly apart:

| | Hard requirements | AI suggestions |
| --- | --- | --- |
| Examples | Title ≤ 15 words, 30–60 references, APA style, data availability statement | Scope fit, a shorter title, a draft statement |
| How they're checked | Plain code, no AI: the same paper and journal always give the same result | An LLM, clearly labelled as a suggestion |
| Source | Stated by the journal, linked to its page | Generated for the researcher to review |
| Applied automatically? | Never | Never: the researcher accepts or rejects each one |

---

## 🧭 How it works

```mermaid
flowchart TD
    A[📄 Upload DOCX] --> B[Parser]
    B --> C[(Saved manuscript<br/>manuscript_id)]
    J[🕵️ Journal agent] --> K[Guideline page]
    K --> L{Confident?}
    L -- yes --> M[(Journal catalog)]
    L -- no --> R[👀 Human review queue]
    R -- approved --> M
    C --> N[🎯 Matcher]
    M --> N
    N --> O[Ranked journals]
    O --> V[✅ Validator]
    C --> V
    V --> W[Checklist:<br/>passed · failed · review]
    W -. 🔀 Switch Journal:<br/>validate again, no re-parsing .-> V
```

---

## 🗂️ Repository structure

```
Warraq/
├── apps/
│   ├── api/                  FastAPI backend (Python)
│   │   ├── core/             settings (.env)
│   │   ├── db/               SQLite store, demo journal seed, agent runner
│   │   ├── models/           shared data contracts (Pydantic)
│   │   ├── routers/          API endpoints
│   │   ├── services/
│   │   │   ├── analyzer/       DOCX parsing
│   │   │   ├── journal_agent/  guideline scraping + extraction (LangGraph)
│   │   │   ├── matcher/        journal recommendation
│   │   │   ├── validator/      deterministic submission checklist
│   │   │   ├── suggestions/    AI suggestions
│   │   │   ├── citations/      citation style conversion
│   │   │   └── llm/            LLM gateway (model per task, caching, cost logging)
│   │   └── tests/
│   └── web/                  Next.js frontend (Arabic, RTL)
├── docs/                     contracts, checklist rules, LLMOps
└── .env.example              backend settings template
```

### 🧰 Tech stack

- **Backend:** Python, FastAPI, Pydantic, SQLite, python-docx, sentence-transformers, LangGraph
- **AI:** Anthropic Claude through a single LLM gateway (see [`docs/llmops.md`](docs/llmops.md))
- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, Monaco Editor

---

## 🏁 Getting started

You need **Python 3.11+** and **Node.js 20.9+**. Open two terminals, grab a coffee ☕, and let's go.

### 1️⃣ Backend

**Windows (PowerShell):**

```powershell
cd apps/api
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy ..\..\.env.example .env
uvicorn main:app --reload
```

**macOS / Linux:**

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../../.env.example .env
uvicorn main:app --reload
```

- API: http://localhost:8000 · Interactive docs: http://localhost:8000/docs · Health: http://localhost:8000/health
- Add your key to `apps/api/.env` as `ANTHROPIC_API_KEY=...` to enable the AI features. Without it,
  AI suggestions and citation conversion report "unavailable"; everything else works.
- The first journal match downloads the embedding model (~90 MB), so it can take up to a minute.

If PowerShell says "running scripts is disabled", run
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once and try again.

### 2️⃣ Frontend

```bash
cd apps/web
npm ci
npm run dev
```

Open **http://localhost:3000** (use `localhost`, not `127.0.0.1`). The frontend calls the backend at
`http://localhost:8000` by default. More details: [`apps/web/README.md`](apps/web/README.md).

### 3️⃣ Take it for a spin

Use **"جرّب ببحث تجريبي"** on the upload screen, or upload
`apps/api/tests/fixtures/warraq_demo_manuscript.docx`. Then pick preferences, choose a journal, and
switch journals in the workspace and watch the checklist change. 🪄

---

## ⚙️ Configuration

Backend settings live in `apps/api/.env` (template: [`.env.example`](.env.example)). Never commit `.env`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | (empty) | Enables AI features and the journal agent |
| `FRONTEND_ORIGINS` | `http://localhost:3000` | Comma-separated origins allowed to call the API |
| `DATABASE_PATH` | `apps/api/data/warraq.db` | SQLite database file |
| `SEED_DEMO_JOURNALS` | `true` | Load the demo journals into an empty database |
| `MAX_UPLOAD_MB` | `25` | Largest manuscript upload |
| `JOURNAL_EXTRACTION_MODEL` | `claude-sonnet-5` | Model for reading journal guidelines |
| `SUGGESTIONS_MODEL` | `claude-sonnet-5` | Model for AI suggestions |
| `CITATION_MODEL` | `claude-haiku-4-5-20251001` | Model for citation conversion |
| `LLM_CACHE_ENABLED` | `true` | Reuse identical AI answers instead of paying again |
| `LLM_TIMEOUT_SECONDS` | `60` | Timeout for AI requests |

The frontend has one setting, `NEXT_PUBLIC_API_BASE_URL`, in `apps/web/.env.local`. It is public, so
never put secrets there.

---

## 🔌 API overview

Full request and response shapes are in [`docs/contracts.md`](docs/contracts.md) and at `/docs` when the
backend is running.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/manuscripts/upload` | Parse a DOCX and return a `manuscript_id` (identical files are served from cache) |
| GET | `/manuscripts/{id}` | A saved manuscript (current version) |
| PATCH · POST | `/manuscripts/{id}/blocks/…` · `/apply-suggestion/…` · `/references` · `/undo` · `/reset` | Edit the manuscript ([`docs/editing.md`](docs/editing.md)) |
| GET | `/manuscripts/{id}/download` | Download the current version: Word, or `?format=latex` for a LaTeX zip |
| GET | `/journals` | Journal catalog as summary cards |
| GET | `/journals/{id}` | One journal's full rules and sources |
| GET | `/journals/review-queue` | Journals the agent flagged for human review |
| GET · PATCH | `/journals/review-queue/{id}` | View or correct a flagged journal |
| POST | `/journals/review-queue/{id}/approve` · `/reject` | Approve into the catalog or reject |
| POST | `/match` | Rank journals for a manuscript and preferences |
| POST | `/validate` | Submission checklist for one journal (Switch Journal = call again) |
| POST | `/validate/compare` | Readiness summary for several journals |
| POST | `/suggestions` | AI scope fit and drafts for failed rules |
| PATCH | `/suggestions/{id}` | Accept or reject a suggestion |
| POST | `/citations/convert` | References in the journal's required style |
| GET | `/llm/usage` | AI calls, tokens and estimated cost per task |

### 📚 Loading real journals

```bash
cd apps/api
python -m db.run_agent                       # journals listed in db/seed/journal_sources.json
python -m db.run_agent path/to/sources.json  # your own list
python -m db.run_agent --dry-run             # only find guideline pages: no AI calls, no DB writes
```

Confident extractions go straight into the catalog; uncertain ones wait in the review queue.

Seed entries describe the journal (`title`, `issn`, `publisher`); the agent finds and verifies
its official author-guideline page itself (see [What's new](#-whats-new) and
[`docs/journal-discovery.md`](docs/journal-discovery.md)).

---

## 🧪 Tests

```bash
cd apps/api && pytest                                          # backend (no API key or network needed)
cd apps/web && npx tsc --noEmit && npm run lint && npm run build   # frontend
```

---

## 🎭 Demo data

- **Demo journals** (`is_demo: true`) are made up (no journals were harmed), with example rules, so the app works before real
  journals are loaded. They are labelled as demo data in the UI.
- **Demo manuscript** (`apps/api/tests/fixtures/warraq_demo_manuscript.docx`) is a fictional paper: invented authors, results and references.
  Its expected checklist results for each demo journal are in [`docs/validation.md`](docs/validation.md).

---

## 📖 Documentation

| File | Contents |
| --- | --- |
| [`docs/contracts.md`](docs/contracts.md) | Data formats, endpoints, team decisions, frontend mapping |
| [`docs/validation.md`](docs/validation.md) | Checklist rules, statuses, expected demo results |
| [`docs/llmops.md`](docs/llmops.md) | LLM gateway, model per task, costs, suggestions, citation conversion |
| [`apps/api/README.md`](apps/api/README.md) | Backend setup and conventions |
| [`apps/web/README.md`](apps/web/README.md) | Frontend setup, API boundary, routes |

---

## 🚧 Known limitations

Honest list, because we'd rather tell you than have you find out:

- DOCX uploads only; PDF and LaTeX are future work.
- Page count can't be measured from a DOCX, so it is always shown for manual review.
- Citation style detection recognizes APA and IEEE; other styles are flagged for review.
- SQLite storage and no user accounts yet; the journal review endpoints are unprotected.
- AI cost figures are estimates from a price table in `apps/api/services/llm/pricing.py`.

---

## 🤝 Contributing

1. Update `main` (`git checkout main && git pull`) and create a branch from it.
2. Keep backend imports relative to `apps/api`, read settings through `core.config.get_settings()`,
   and make every AI call through `services.llm.get_gateway()`.
3. Add new fields to shared models in `apps/api/models/` as optional, and tell whoever uses them.
4. Run the tests, open a pull request, and pull `main` again after it's merged.

And please don't upload files straight to `main` through the GitHub website. We've all done it once. 🙈

---

## 👩‍💻 The team

| | Member |
| --- | --- | 
| 🕵️ | Abrar | 
| 🔌 | Jana | 
| 🎨 | Maha |
| 📄 | Estabraq |
| 🎯 | Dima |

<div align="center">

**Made with ☕ and a lot of rejected-then-reformatted papers.**

</div>

---

## 🆕 What's new

### 📈 Impact Factor (preference, with optional exclusion)

Researchers can pick an **official Journal Impact Factor (JIF)** threshold on the preferences screen:
`بدون تفضيل · 1+ · 2+ · 3+ · 5+`.

| Choice | Effect |
| --- | --- |
| بدون تفضيل | No effect on filtering or ranking |
| A threshold | Nothing is excluded. Journals that meet it get a small ranking bonus (+0.03, inside the existing 0.08 cap), so scope fit still decides the order |
| Threshold + "استبعاد المجلات التي يقل معامل تأثيرها عن الحد المحدد" | Journals with a **known** JIF below the threshold are excluded |
| JIF not available | Never excluded and no bonus. Shown as "غير متاح" |

- Results and the compare dialog show the value, the JCR year and the source.
- Only the official JIF is used, entered by hand from a licensed JCR export. No other metric is ever labelled "Impact Factor".

```bash
cd apps/api
python -m db.import_impact_factors path/to/impact_factors.csv   # columns: journal_id,impact_factor,year,source
```

A row without a year or source is rejected. The two demo journals with values are labelled "Demo data (fictional)".

### 🔎 Journal discovery: no more pasting guideline URLs

`python -m db.run_agent` now finds each journal's official author-guideline page by itself. Seed entries only describe the journal:

```json
[
  {"title": "PLOS ONE", "issn": "1932-6203", "publisher": "PLOS"},
  {"title": "IEEE Access", "issn": "2169-3536", "publisher": "IEEE"}
]
```

```bash
cd apps/api
python -m db.run_agent             # discover → extract → save (or send to review)
python -m db.run_agent --dry-run   # discovery only: candidates and scores, no AI calls, no DB writes
```

1. **Identify the journal** from its ISSN or title, using OpenAlex and DOAJ.
2. **Look for the guidelines page** on the journal's or publisher's **official domains only**: DOAJ's link, known publisher URL patterns, and "Guide for Authors"-style links on the homepage.
3. **Verify each page** using signals such as the journal title, ISSN, publisher, guideline wording and the domain.
4. **Decide:**
   - **accept**: the requirements are extracted and saved.
   - **review**: the requirements are extracted, but always go to the review queue.
   - **fail**: a review item records why. The rest of the batch carries on.

Other rules:
- **No guessed URLs:** discovery never uses AI, so every URL comes from metadata or an official page and is checked before use.
- **Manual fallback:** a `guidelines_url` (or `homepage_url`) in the seed entry is still accepted. The old `{name, publisher, source_url}` format still works.
- **No duplicates:** journals are matched by ISSN, otherwise by title + publisher. Re-running updates the same record, and manual fields such as the Impact Factor are never overwritten.
- **Polite fetching:** timeouts, per-site rate limits, robots.txt, retries, and an IPv4 fallback for broken IPv6 routes.

Full details: [`docs/journal-discovery.md`](docs/journal-discovery.md).

### 🧑‍⚖️ Review queue: re-running never loses review work

| Previous review state | Re-running the agent |
| --- | --- |
| Approved | The new extraction goes to review. The approved version stays until a reviewer approves the refresh, which then updates the journal in place |
| Edited (still pending) | Left alone, so the reviewer's edits win |
| Rejected | A new pending item is created |

Earlier decisions are kept in each review item's `history`. Requirement fields that a guidelines page never mentions no longer count as "low confidence". Only stated-but-uncertain fields send a journal to review.

### ⚙️ New settings

Add these to `apps/api/.env` (see `.env.example`):

| Variable | Purpose |
| --- | --- |
| `OPENALEX_API_KEY` | Free key, required by OpenAlex since Feb 2026. Without it, discovery uses DOAJ and seed URLs only |
| `WARRAQ_CONTACT_EMAIL` | Optional. Sent with discovery requests so sites can contact us |

DOAJ needs no key. Claude costs are unchanged: about one extraction per journal, and none when discovery fails.
