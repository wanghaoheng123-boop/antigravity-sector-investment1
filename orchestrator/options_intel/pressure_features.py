def build_pressure_features(spot: float, max_pain: float | None, gex: dict[str, float]) -> dict[str, float]:
    if max_pain is None or spot <= 0:
        max_pain_distance = 0.0
    else:
        max_pain_distance = (spot - max_pain) / spot

    call_wall = float(gex.get("call_wall", 0.0))
    put_wall = float(gex.get("put_wall", 0.0))
    wall_span = abs(call_wall - put_wall) if call_wall and put_wall else 0.0
    gex_total = float(gex.get("gex_total", 0.0))

    return {
        "max_pain_distance": max_pain_distance,
        "gex_pressure": gex_total,
        "wall_span": wall_span,
    }
