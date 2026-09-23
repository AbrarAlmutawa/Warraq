import json
from pathlib import Path

from .models import JournalProfile

DEFAULT_FIXTURE = Path(__file__).parent / "fixtures" / "journals.json"


def load_journal_catalog(path: Path = DEFAULT_FIXTURE) -> list[JournalProfile]:
    """Temporary S1 replacement. Swap this loader for S1 storage/service later."""
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    return [JournalProfile.model_validate(item) for item in data]
