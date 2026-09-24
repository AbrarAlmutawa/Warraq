from functools import lru_cache

from core.config import get_settings
from db.store import Store


@lru_cache
def get_store() -> Store:
    """FastAPI dependency: one Store per process. Tests override this."""
    return Store(get_settings().database_path)
