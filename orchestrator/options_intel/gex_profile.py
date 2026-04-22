from typing import Any


def compute_gex_profile(chain: list[dict[str, Any]], spot: float) -> dict[str, float]:
    if not chain:
        return {"gex_total": 0.0, "call_wall": 0.0, "put_wall": 0.0, "dealer_flip": 0.0}
    by_strike: dict[float, float] = {}
    call_oi: dict[float, float] = {}
    put_oi: dict[float, float] = {}

    for c in chain:
        strike = float(c["strike"])
        gamma = float(c.get("gamma", 0.0))
        oi = float(c.get("openInterest", 0.0))
        side = str(c.get("type", "")).lower()
        signed = gamma * oi * spot * spot * (1 if side == "call" else -1)
        by_strike[strike] = by_strike.get(strike, 0.0) + signed
        if side == "call":
            call_oi[strike] = call_oi.get(strike, 0.0) + oi
        else:
            put_oi[strike] = put_oi.get(strike, 0.0) + oi

    call_wall = max(call_oi, key=call_oi.get) if call_oi else 0.0
    put_wall = max(put_oi, key=put_oi.get) if put_oi else 0.0
    flip = min(by_strike, key=lambda k: abs(by_strike[k])) if by_strike else 0.0
    return {
        "gex_total": sum(by_strike.values()),
        "call_wall": call_wall,
        "put_wall": put_wall,
        "dealer_flip": flip,
    }
