from statistics import median


def kalman_1d(values: list[float], process_var: float = 1e-5, measurement_var: float = 1e-2) -> list[float]:
    """Lightweight 1D Kalman filter for price smoothing."""
    if not values:
        return []
    estimate = values[0]
    error_estimate = 1.0
    output = []
    for measurement in values:
        error_estimate += process_var
        gain = error_estimate / (error_estimate + measurement_var)
        estimate = estimate + gain * (measurement - estimate)
        error_estimate = (1 - gain) * error_estimate
        output.append(estimate)
    return output


def robust_zscore_filter(values: list[float], threshold: float = 3.5) -> list[float]:
    if not values:
        return []
    med = median(values)
    deviations = [abs(v - med) for v in values]
    mad = median(deviations) or 1e-9
    cleaned = []
    for v in values:
        z = 0.6745 * (v - med) / mad
        cleaned.append(med if abs(z) > threshold else v)
    return cleaned


def noise_score(values: list[float]) -> float:
    if len(values) < 3:
        return 0.0
    diff = [abs(values[i] - values[i - 1]) for i in range(1, len(values))]
    baseline = sum(abs(v) for v in values) / len(values) or 1e-9
    return sum(diff) / len(diff) / baseline
