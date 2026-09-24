from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import get_settings
from db import get_store
from db.seed import seed_if_empty
from routers import journals, manuscripts, match

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.seed_demo_journals:
        seed_if_empty(get_store())
    yield


app = FastAPI(
    title="Warraq API",
    version="0.2.0",
    lifespan=lifespan,
)

# Allow the Next.js frontend (apps/web) to call the API from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(manuscripts.router)
app.include_router(match.router)
app.include_router(journals.router)


@app.get("/")
def root():
    return {
        "name": "Warraq API",
        "status": "running",
    }


@app.get("/health")
def health():
    """Liveness check for deployment, plus whether LLM features can run."""
    return {
        "status": "ok",
        "llm_configured": settings.anthropic_api_key is not None,
    }
