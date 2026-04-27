import json
from pathlib import Path
from typing import Any


def write_latest_snapshot(snapshot_dir: str, payload: dict[str, Any]) -> Path:
    path = Path(snapshot_dir)
    path.mkdir(parents=True, exist_ok=True)
    file_path = path / "latest.json"
    file_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return file_path


def load_latest_snapshot(snapshot_dir: str) -> dict[str, Any] | None:
    file_path = Path(snapshot_dir) / "latest.json"
    if not file_path.exists():
        return None
    return json.loads(file_path.read_text(encoding="utf-8"))
