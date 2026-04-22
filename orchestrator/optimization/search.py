from itertools import product

from orchestrator.optimization.constraints import enforce_constraints


def grid_search_space(base: dict[str, float]) -> list[dict[str, float]]:
    risk = [0.008, 0.012, 0.02, 0.03]
    leverage = [0.7, 0.9, 1.0, 1.15]
    options_weight = [0.08, 0.15, 0.25, 0.35]
    turnover_budget = [0.6, 0.9, 1.1]
    out = []
    for r, l, o, t in product(risk, leverage, options_weight, turnover_budget):
        candidate = dict(base)
        candidate.update({"risk_budget": r, "max_leverage": l, "options_weight": o, "turnover_budget": t})
        out.append(enforce_constraints(candidate))
    return out
