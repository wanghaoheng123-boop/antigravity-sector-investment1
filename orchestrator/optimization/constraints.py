def enforce_constraints(params: dict[str, float]) -> dict[str, float]:
    constrained = dict(params)
    constrained["risk_budget"] = min(max(constrained.get("risk_budget", 0.02), 0.001), 0.05)
    constrained["max_leverage"] = min(max(constrained.get("max_leverage", 1.0), 0.5), 2.0)
    constrained["options_weight"] = min(max(constrained.get("options_weight", 0.2), 0.0), 0.6)
    return constrained
