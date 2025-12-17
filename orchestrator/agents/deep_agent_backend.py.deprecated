"""
Virtual Filesystem Backend for Deep Agents

Stores orchestrator state as files in a project-scoped filesystem.
Each canvas/story gets its own filesystem instance.

This backend provides a virtual filesystem interface that can be used
by Deep Agents for context management, preventing context window overflow.

File Structure:
/project/
  ├── canvas_state.json
  ├── document_structure.json
  ├── conversation_history.json
  ├── plan/
  │   ├── task_plan.json
  │   └── execution_state.json
  ├── content/
  │   ├── chapter_1.json
  │   └── chapter_2.json
  └── memory/
      ├── user_preferences.json
      ├── successful_patterns.json
      └── style_guide.json
"""

from pathlib import Path
from typing import Optional, Dict, Any, List
import json
import os


class OrchestratorFilesystemBackend:
    """
    Virtual filesystem backend scoped to a project (canvas/story).
    
    This backend stores orchestrator state as files, allowing:
    - Selective context loading (read only what's needed)
    - Persistent storage across sessions
    - Project-scoped isolation (one filesystem per canvas/story)
    
    Usage:
        backend = OrchestratorFilesystemBackend(project_id="canvas-123")
        backend.write_file("canvas_state.json", {"nodes": [...]})
        canvas_state = backend.read_file("canvas_state.json")
    
    Args:
        project_id: Canvas/story ID (scopes the filesystem)
        base_path: Base path for storage (default: /tmp/orchestrator/{project_id})
        use_persistent_storage: If True, use persistent path (for production)
    """
    
    def __init__(
        self,
        project_id: str,
        base_path: Optional[Path] = None,
        use_persistent_storage: bool = False
    ):
        """
        Initialize filesystem backend for a project.
        
        Args:
            project_id: Canvas/story ID (scopes the filesystem)
            base_path: Base path for storage
            use_persistent_storage: If True, use persistent storage path
        """
        self.project_id = project_id
        
        if base_path:
            self.base_path = Path(base_path)
        elif use_persistent_storage:
            # Use persistent storage (e.g., for production)
            # TODO: Configure persistent storage path (S3, local disk, etc.)
            persistent_base = os.getenv("ORCHESTRATOR_STORAGE_PATH", "/var/lib/orchestrator")
            self.base_path = Path(persistent_base) / project_id
        else:
            # Use temporary storage (default for development)
            self.base_path = Path(f"/tmp/orchestrator/{project_id}")
        
        # Create base directory
        self.base_path.mkdir(parents=True, exist_ok=True)
        
        # Create directory structure
        (self.base_path / "plan").mkdir(exist_ok=True)
        (self.base_path / "content").mkdir(exist_ok=True)
        (self.base_path / "memory").mkdir(exist_ok=True)
        (self.base_path / "feedback").mkdir(exist_ok=True)
    
    def write_file(self, file_path: str, content: Any) -> None:
        """
        Write content to a file in the filesystem.
        
        Args:
            file_path: Relative path from project root (e.g., "canvas_state.json")
            content: Content to write (dict/list will be JSON-encoded, str written as-is)
        
        Example:
            backend.write_file("canvas_state.json", {"nodes": [...]})
            backend.write_file("plan/task_plan.json", {"steps": [...]})
        """
        full_path = self.base_path / file_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        
        if isinstance(content, (dict, list)):
            with open(full_path, 'w', encoding='utf-8') as f:
                json.dump(content, f, indent=2, ensure_ascii=False)
        else:
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(str(content))
    
    def read_file(self, file_path: str) -> Optional[Any]:
        """
        Read content from a file in the filesystem.
        
        Args:
            file_path: Relative path from project root (e.g., "canvas_state.json")
        
        Returns:
            Parsed JSON (if JSON file) or string content, or None if file doesn't exist
        
        Example:
            canvas_state = backend.read_file("canvas_state.json")
            plan = backend.read_file("plan/task_plan.json")
        """
        full_path = self.base_path / file_path
        
        if not full_path.exists():
            return None
        
        with open(full_path, 'r', encoding='utf-8') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                # Not JSON, return as string
                return f.read()
    
    def list_files(self, directory: str = "") -> List[str]:
        """
        List files in a directory.
        
        Args:
            directory: Directory path relative to project root (e.g., "plan", "content")
        
        Returns:
            List of file paths relative to project root
        
        Example:
            files = backend.list_files("content")  # ["content/chapter_1.json", ...]
        """
        dir_path = self.base_path / directory
        if not dir_path.exists():
            return []
        
        files = []
        for item in dir_path.iterdir():
            if item.is_file():
                files.append(str(item.relative_to(self.base_path)))
            elif item.is_dir():
                # Recursively list subdirectories
                subdir = str(item.relative_to(self.base_path))
                files.extend(self.list_files(subdir))
        
        return files
    
    def delete_file(self, file_path: str) -> None:
        """
        Delete a file from the filesystem.
        
        Args:
            file_path: Relative path from project root
        
        Example:
            backend.delete_file("content/chapter_1.json")
        """
        full_path = self.base_path / file_path
        if full_path.exists():
            if full_path.is_file():
                full_path.unlink()
            elif full_path.is_dir():
                import shutil
                shutil.rmtree(full_path)
    
    def file_exists(self, file_path: str) -> bool:
        """
        Check if a file exists in the filesystem.
        
        Args:
            file_path: Relative path from project root
        
        Returns:
            True if file exists, False otherwise
        """
        return (self.base_path / file_path).exists()
    
    def clear_project(self) -> None:
        """
        Clear all files for this project.
        
        WARNING: This deletes all stored data for the project!
        Use with caution.
        """
        import shutil
        if self.base_path.exists():
            shutil.rmtree(self.base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
        
        # Recreate directory structure
        (self.base_path / "plan").mkdir(exist_ok=True)
        (self.base_path / "content").mkdir(exist_ok=True)
        (self.base_path / "memory").mkdir(exist_ok=True)
        (self.base_path / "feedback").mkdir(exist_ok=True)
    
    def get_project_path(self) -> Path:
        """
        Get the base path for this project's filesystem.
        
        Returns:
            Path object for the project root
        """
        return self.base_path

