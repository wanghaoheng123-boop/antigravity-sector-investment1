def behavior_score(features: dict[str, float]) -> float:
    panic = features.get("panic_index", 0.0)
    fomo = features.get("fomo_index", 0.0)
    crowding = features.get("crowding_score", 0.0)
    loss_aversion = features.get("loss_aversion_proxy", 0.0)
    # Contrarian tilt: higher panic can create opportunity, while fomo/crowding reduce edge.
    return 0.45 * panic - 0.25 * fomo - 0.2 * crowding - 0.1 * loss_aversion
