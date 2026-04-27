def medallion_score(features: dict[str, float]) -> float:
    mean_reversion = -features.get("log_ret", 0.0)
    liquidity = min(features.get("volume", 0.0) / 1_000_000.0, 2.0)
    gex_pressure = -abs(features.get("gex_pressure", 0.0)) * 0.000001
    return 0.6 * mean_reversion + 0.3 * liquidity + 0.1 * gex_pressure
