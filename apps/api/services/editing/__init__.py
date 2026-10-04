from .docx_edits import EditError
from .service import NotEditable, StaleRevision, apply, apply_suggestion, reset, save_original, undo

__all__ = ["EditError", "NotEditable", "StaleRevision", "apply", "apply_suggestion", "reset", "save_original", "undo"]
