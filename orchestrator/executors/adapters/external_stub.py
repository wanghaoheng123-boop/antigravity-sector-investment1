from typing import Any


def run_external_executor(_task_packet: dict[str, Any]) -> dict[str, Any]:
    """Disabled by default until user enables external model APIs."""
    return {
        "ok": False,
        "executor": "external_stub",
        "summary": "External executors are disabled in current policy.",
        "artifact_paths": [],
    }
