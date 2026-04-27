from typing import Any


def review_executor_output(output: dict[str, Any]) -> tuple[bool, list[str]]:
    """Quality gate for executor outputs with artifact validation."""
    issues: list[str] = []
    if not output:
        issues.append("empty_output")
    if "artifact_paths" not in output:
        issues.append("missing_artifact_paths")
    if "summary" not in output:
        issues.append("missing_summary")
    if output.get("ok") is not True:
        issues.append("executor_not_ok")
    artifacts = output.get("artifact_paths", [])
    if not isinstance(artifacts, list):
        issues.append("artifact_paths_not_list")
    return (len(issues) == 0, issues)
