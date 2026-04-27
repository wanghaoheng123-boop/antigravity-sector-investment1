from orchestrator.alpha.pillar_behavior import behavior_score
from orchestrator.alpha.pillar_buffett import buffett_score
from orchestrator.alpha.pillar_medallion import medallion_score


def fuse_scores(features: dict[str, float], regime: str = "mixed") -> float:
    if regime == "risk_off":
        weights = (0.25, 0.45, 0.30)
    elif regime == "risk_on":
        weights = (0.45, 0.25, 0.30)
    else:
        weights = (0.35, 0.35, 0.30)

    med = medallion_score(features)
    buf = buffett_score(features)
    beh = behavior_score(features)
    return med * weights[0] + buf * weights[1] + beh * weights[2]
