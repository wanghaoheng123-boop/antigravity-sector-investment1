from typing import Any


REQUIRED_FIELDS = ("timestamp", "open", "high", "low", "close", "volume")


def validate_ohlcv(rows: list[dict[str, Any]]) -> dict[str, Any]:
    issues: list[str] = []
    if not rows:
        return {
            "validation_pass": False,
            "missing_pct": 100.0,
            "outlier_pct": 0.0,
            "issues": ["empty_rows"],
        }

    missing = 0
    outlier = 0
    total = len(rows)

    for row in rows:
        if any(field not in row or row[field] is None for field in REQUIRED_FIELDS):
            missing += 1
            issues.append("missing_fields")
            continue
        o, h, l, c = (float(row["open"]), float(row["high"]), float(row["low"]), float(row["close"]))
        v = float(row["volume"])
        if min(o, h, l, c) < 0 or v < 0:
            outlier += 1
            issues.append("negative_value")
        if h < l:
            outlier += 1
            issues.append("ohlc_inconsistent")

    missing_pct = 100.0 * missing / total
    outlier_pct = 100.0 * outlier / total
    return {
        "validation_pass": missing_pct < 2.0 and outlier_pct < 5.0,
        "missing_pct": round(missing_pct, 4),
        "outlier_pct": round(outlier_pct, 4),
        "issues": sorted(set(issues)),
    }
