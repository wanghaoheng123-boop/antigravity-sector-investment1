def run_stress_suite(metrics: dict[str, float]) -> dict[str, bool]:
    return {
        "max_drawdown_ok": abs(metrics.get("max_drawdown", 0.0)) <= 0.25,
        "turnover_ok": metrics.get("turnover", 0.0) <= 1.2,
        "sortino_positive": metrics.get("sortino", 0.0) > 0,
    }
