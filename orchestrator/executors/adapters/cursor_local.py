from typing import Any


def run_local_executor(task_packet: dict[str, Any]) -> dict[str, Any]:
    """Current-environment executor adapter placeholder."""
    return {
        "ok": True,
        "executor": "cursor_local",
        "summary": f"Simulated execution for stage={task_packet.get('stage')}",
        "artifact_paths": [],
        "raw": task_packet,
    }
