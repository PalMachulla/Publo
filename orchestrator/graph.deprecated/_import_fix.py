"""
Import path fix utility for orchestrator.agents imports.

This ensures the parent directory is in sys.path so that
'from orchestrator.agents.xxx' imports work correctly.
"""
import sys
from pathlib import Path

def ensure_import_path():
    """Ensure parent directory is in sys.path for orchestrator.agents imports."""
    parent_dir = Path(__file__).parent.parent
    if str(parent_dir) not in sys.path:
        sys.path.insert(0, str(parent_dir))
    return parent_dir

