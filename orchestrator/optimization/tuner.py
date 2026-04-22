from orchestrator.brain.objective import score_objective


def pick_best_result(results: list[dict]) -> dict | None:
    if not results:
        return None
    eligible = [r for r in results if r.get("stress", {}).get("max_drawdown_ok", True)]
    pool = eligible if eligible else results
    return max(pool, key=lambda r: score_objective(r.get("metrics", {})))
