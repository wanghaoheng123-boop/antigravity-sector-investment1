from typing import Any

from orchestrator.executors.adapters.cursor_local import run_local_executor
from orchestrator.executors.adapters.external_stub import run_external_executor


def dispatch_task(task_packet: dict[str, Any], backend: str = "cursor_local") -> dict[str, Any]:
    if backend == "cursor_local":
        return run_local_executor(task_packet)
    if backend == "external_stub":
        return run_external_executor(task_packet)
    raise ValueError(f"Unsupported executor backend: {backend}")
