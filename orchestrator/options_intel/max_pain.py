from collections import defaultdict
from typing import Any


def compute_max_pain(chain: list[dict[str, Any]]) -> float | None:
    """Find strike with minimum payout burden."""
    if not chain:
        return None
    payouts = defaultdict(float)
    strikes = sorted({float(x["strike"]) for x in chain})
    for target_strike in strikes:
        total = 0.0
        for contract in chain:
            strike = float(contract["strike"])
            oi = float(contract.get("openInterest", 0.0))
            cp = str(contract.get("type", "")).lower()
            if cp == "call" and strike < target_strike:
                total += (target_strike - strike) * oi
            elif cp == "put" and strike > target_strike:
                total += (strike - target_strike) * oi
        payouts[target_strike] = total
    return min(payouts, key=payouts.get)
