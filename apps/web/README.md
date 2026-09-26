# وَرَّاق (Warraq) — Web frontend (S5)

Next.js (App Router) + TypeScript + Tailwind + Monaco. Arabic-first, RTL.

The frontend is a client of the Warraq FastAPI backend in `apps/api`. It has **no data of its own**:
every manuscript, journal, validation result, readiness summary, suggestion and citation proposal
comes from the backend. There is no mock fallback — if the backend is unavailable, the UI shows an
error/recovery state instead of sample data.

---

## Configuration

The frontend has exactly one setting:

| Variable | Example | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | Public base URL of the Warraq FastAPI backend (no trailing slash needed). |

- Put it in `apps/web/.env.local` for local development. `.env*` files are git-ignored — **do not commit them**.
- If it is not set, the app falls back to `http://localhost:8000` (local development only).
- **Build-time value:** `NEXT_PUBLIC_*` variables are inlined into the browser bundle when `npm run build`
  runs. For any deployment, set `NEXT_PUBLIC_API_BASE_URL` **before building**; changing it later
  requires a rebuild. A build without it will call `http://localhost:8000` from the user's browser.
- Everything with the `NEXT_PUBLIC_` prefix is **public** (visible in the browser).

### Secrets

**Never** put `ANTHROPIC_API_KEY` or any other secret in `apps/web`, in `.env.local`, or in any
`NEXT_PUBLIC_*` variable. Secrets live only in the backend environment (`apps/api/.env`).
The frontend only ever calls the Warraq backend; it never calls an AI provider directly.

---

## Running locally

**1. Backend** (Windows PowerShell, from the repository root):

```powershell
cd apps/api
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy ..\..\.env.example .env
uvicorn main:app --reload
```

- API: `http://localhost:8000` · Swagger: `http://localhost:8000/docs`
- The backend's `FRONTEND_ORIGINS` must include the frontend origin (default `http://localhost:3000`).
  Open the app at `http://localhost:3000`, not `http://127.0.0.1:3000` — they are different origins.
- The first journal match downloads the embedding model (~90 MB), so the backend needs internet
  access the first time and the first `/match` can take up to a minute.
- Without `ANTHROPIC_API_KEY` in `apps/api/.env`, AI suggestions and citation conversion are
  reported as unavailable; the checklist and readiness still work.

**2. Frontend** (second terminal):

```powershell
cd apps/web
npm ci
npm run dev
```

Open `http://localhost:3000`.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3000 |
| `npm run lint` | ESLint |
| `npm run build` | Production build (includes type checking) |
| `npm run start` | Serve the production build |
| `npx tsc --noEmit` | Type check only |

Before opening a pull request: `npx tsc --noEmit`, `npm run lint` and `npm run build` must all pass.

---

## API types and the API boundary

- `lib/api-types.ts` is **generated** from the backend's OpenAPI schema. Do not edit it by hand.
  Regenerate it whenever backend schemas change (backend running):

```powershell
  cd apps/web
  npx openapi-typescript@7 http://127.0.0.1:8000/openapi.json -o lib/api-types.ts
```

- `lib/api-client.ts` is the only module that calls the backend (typed requests, one `ApiError` type).
- `lib/api-adapters.ts` is the only place where backend snake_case shapes become frontend types.
- `lib/session.ts` keeps the journey in `sessionStorage` (per browser tab): `manuscript_id`, preferences
  and the last match. Parsed data and results are always re-fetched from the backend.

---

## Demo manuscript

`public/demo/warraq-demo-manuscript.docx` powers the "جرّب ببحث تجريبي" (try a demo paper) action.
It is uploaded through the same real `POST /manuscripts/upload` pipeline as any file and is labelled
as demo data in the UI. It must stay **byte-identical** to
`apps/api/tests/fixtures/warraq_demo_manuscript.docx` — if the backend fixture changes, copy it again.

Journals marked `is_demo` by the backend are fictional and are always labelled as demo data.

---

## Routes

`/` upload · `/analysis` · `/preferences` · `/journals` · `/workspace?journal=<id>` · `/ready?journal=<id>`

`/workspace/demo` is kept only as a redirect to `/workspace` for old links.