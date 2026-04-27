from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


@dataclass
class TaskPacket:
    task_id: str
    stage: str
    payload: dict[str, Any]
    created_at: str


def draft_task(stage: str, payload: dict[str, Any]) -> TaskPacket:
    return TaskPacket(
        task_id=f"task_{uuid4().hex[:12]}",
        stage=stage,
        payload=payload,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
