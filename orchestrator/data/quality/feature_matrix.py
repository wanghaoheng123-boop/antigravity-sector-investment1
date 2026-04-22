from math import log
from typing import Any


def build_feature_matrix(rows: list[dict[str, Any]], options_features: dict[str, float], behavior_features: dict[str, float]) -> list[dict[str, float]]:
    """Combine denoised OHLCV-derived features with options/behavior factors."""
    out: list[dict[str, float]] = []
    if len(rows) < 2:
        return out

    for i in range(1, len(rows)):
        prev = float(rows[i - 1]["close"])
        curr = float(rows[i]["close"])
        ret = log(curr / prev) if prev > 0 and curr > 0 else 0.0
        volume = float(rows[i]["volume"])
        out.append(
            {
                "log_ret": ret,
                "volume": volume,
                "max_pain_distance": options_features.get("max_pain_distance", 0.0),
                "gex_pressure": options_features.get("gex_pressure", 0.0),
                "panic_index": behavior_features.get("panic_index", 0.0),
                "fomo_index": behavior_features.get("fomo_index", 0.0),
            }
        )
    return out
