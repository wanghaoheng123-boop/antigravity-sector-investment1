from orchestrator.alpha.fusion import fuse_scores
from orchestrator.backtest.metrics import max_drawdown, sharpe_ratio, sortino_ratio


def run_backtest(feature_rows: list[dict[str, float]], regime: str = "mixed") -> dict[str, float]:
    if not feature_rows:
        return {"sharpe": 0.0, "sortino": 0.0, "calmar": 0.0, "max_drawdown": 0.0, "turnover": 0.0}

    returns: list[float] = []
    equity: list[float] = [1.0]
    turnover = 0.0
    prev_signal = 0.0

    for row in feature_rows:
        signal = max(-1.0, min(1.0, fuse_scores(row, regime)))
        turnover += abs(signal - prev_signal)
        prev_signal = signal
        realized = signal * row.get("log_ret", 0.0)
        returns.append(realized)
        equity.append(equity[-1] * (1 + realized))

    sharpe = sharpe_ratio(returns)
    sortino = sortino_ratio(returns)
    mdd = abs(max_drawdown(equity))
    annual_return = (equity[-1] ** (252 / max(len(returns), 1))) - 1
    calmar = annual_return / mdd if mdd > 0 else 0.0

    return {
        "sharpe": sharpe,
        "sortino": sortino,
        "calmar": calmar,
        "max_drawdown": -mdd,
        "turnover": turnover / max(len(returns), 1),
        "hit_rate": sum(1 for x in returns if x > 0) / max(len(returns), 1),
    }
