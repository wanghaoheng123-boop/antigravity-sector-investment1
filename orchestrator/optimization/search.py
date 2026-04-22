from itertools import product

from orchestrator.optimization.constraints import enforce_constraints


def grid_search_space(base: dict[str, float]) -> list[dict[str, float]]:
    risk = [0.01, 0.02, 0.03]
    leverage = [0.8, 1.0, 1.2]
    options_weight = [0.1, 0.2, 0.3]
    out = []
    for r, l, o in product(risk, leverage, options_weight):
        candidate = dict(base)
        candidate.update({"risk_budget": r, "max_leverage": l, "options_weight": o})
        out.append(enforce_constraints(candidate))
    return out
