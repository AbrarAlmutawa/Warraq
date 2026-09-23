from fastapi import FastAPI

from routers import manuscripts, match


app = FastAPI(
    title="Warraq API",
    version="0.1.0",
)


app.include_router(manuscripts.router)
app.include_router(match.router)


@app.get("/")
def root():
    return {
        "name": "Warraq API",
        "status": "running",
    }
