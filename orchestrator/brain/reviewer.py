from typing import Any


def review_executor_output(output: dict[str, Any]) -> tuple[bool, list[str]]:
    """Simple quality gate for executor outputs."""
    issues: list[str] = []
    if not output:
        issues.append("empty_output")
    if "artifact_paths" not in output:
        issues.append("missing_artifact_paths")
    if "summary" not in output:
        issues.append("missing_summary")
    return (len(issues) == 0, issues)
