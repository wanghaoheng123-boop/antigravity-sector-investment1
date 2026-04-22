def buffett_score(features: dict[str, float]) -> float:
    quality = features.get("quality_score", 0.0)
    value = features.get("value_score", 0.0)
    moat = features.get("moat_score", 0.0)
    leverage_penalty = features.get("leverage_ratio", 0.0) * 0.2
    return 0.4 * quality + 0.35 * value + 0.25 * moat - leverage_penalty
