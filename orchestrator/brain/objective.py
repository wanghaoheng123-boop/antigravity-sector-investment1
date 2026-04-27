from dataclasses import dataclass


@dataclass(frozen=True)
class ObjectiveWeights:
    sharpe: float = 0.35
    sortino: float = 0.3
    calmar: float = 0.15
    max_drawdown_penalty: float = 0.1
    turnover_penalty: float = 0.1


def score_objective(metrics: dict, weights: ObjectiveWeights | None = None) -> float:
    """Composite objective score used by the optimizer loop."""
    w = weights or ObjectiveWeights()
    sharpe = float(metrics.get("sharpe", 0.0))
    sortino = float(metrics.get("sortino", 0.0))
    calmar = float(metrics.get("calmar", 0.0))
    max_dd = abs(float(metrics.get("max_drawdown", 0.0)))
    turnover = abs(float(metrics.get("turnover", 0.0)))
    return (
        sharpe * w.sharpe
        + sortino * w.sortino
        + calmar * w.calmar
        - max_dd * w.max_drawdown_penalty
        - turnover * w.turnover_penalty
    )
