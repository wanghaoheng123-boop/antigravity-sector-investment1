from math import sqrt


def sharpe_ratio(returns: list[float], rf_daily: float = 0.0) -> float:
    if len(returns) < 2:
        return 0.0
    excess = [r - rf_daily for r in returns]
    mean = sum(excess) / len(excess)
    var = sum((x - mean) ** 2 for x in excess) / (len(excess) - 1)
    std = sqrt(var) if var > 0 else 0.0
    return 0.0 if std == 0 else (mean / std) * sqrt(252)


def sortino_ratio(returns: list[float], rf_daily: float = 0.0) -> float:
    if not returns:
        return 0.0
    excess = [r - rf_daily for r in returns]
    downside = [min(0.0, x) for x in excess]
    downside_var = sum(x * x for x in downside) / len(excess)
    downside_std = sqrt(downside_var) if downside_var > 0 else 0.0
    mean = sum(excess) / len(excess)
    return 0.0 if downside_std == 0 else (mean / downside_std) * sqrt(252)


def max_drawdown(equity: list[float]) -> float:
    if not equity:
        return 0.0
    peak = equity[0]
    dd = 0.0
    for value in equity:
        peak = max(peak, value)
        dd = min(dd, (value - peak) / peak if peak else 0.0)
    return dd
