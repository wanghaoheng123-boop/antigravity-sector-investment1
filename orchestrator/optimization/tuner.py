from orchestrator.brain.objective import score_objective


def pick_best_result(results: list[dict]) -> dict | None:
    if not results:
        return None
    return max(results, key=lambda r: score_objective(r.get("metrics", {})))
