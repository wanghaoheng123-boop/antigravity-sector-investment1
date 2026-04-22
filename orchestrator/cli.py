import argparse
import json
from pathlib import Path

from orchestrator.backtest.runner import run_backtest
from orchestrator.backtest.stress import run_stress_suite
from orchestrator.brain.planner import draft_task
from orchestrator.brain.reviewer import review_executor_output
from orchestrator.data.ingestion.fetch_fundamentals import fetch_fundamentals_stub
from orchestrator.data.ingestion.fetch_options import fetch_options_stub
from orchestrator.data.ingestion.fetch_prices import fetch_prices_stub
from orchestrator.data.ingestion.fetch_sentiment import fetch_sentiment_stub
from orchestrator.data.quality.denoise import kalman_1d, noise_score, robust_zscore_filter
from orchestrator.data.quality.feature_matrix import build_feature_matrix
from orchestrator.data.quality.validate import validate_ohlcv
from orchestrator.executors.cli_dispatch import dispatch_task
from orchestrator.memory.ledger import Ledger
from orchestrator.memory.snapshots import load_latest_snapshot, write_latest_snapshot
from orchestrator.options_intel.gex_profile import compute_gex_profile
from orchestrator.options_intel.max_pain import compute_max_pain
from orchestrator.options_intel.pressure_features import build_pressure_features
from orchestrator.optimization.search import grid_search_space
from orchestrator.optimization.tuner import pick_best_result


DEFAULT_DB = "memory/orchestrator/ledger.db"
DEFAULT_EXPORT_DIR = "memory/ledger_exports"
DEFAULT_SNAPSHOT_DIR = "memory/snapshots"


def _load_prices(symbol: str) -> list[dict]:
    rows = fetch_prices_stub(symbol)
    validation = validate_ohlcv(rows)
    closes = [float(x["close"]) for x in rows]
    raw_noise = noise_score(closes)
    cleaned = robust_zscore_filter(closes)
    smoothed = kalman_1d(cleaned)
    smooth_noise = noise_score(smoothed)
    for i, v in enumerate(smoothed):
        rows[i]["close"] = v
    rows[0]["_validation"] = {
        **validation,
        "noise_score_pre": raw_noise,
        "noise_score_post": smooth_noise,
    }
    return rows


def run_loop(symbol: str, mode: str, backend: str, risk_budget: float) -> dict:
    ledger = Ledger(DEFAULT_DB, DEFAULT_EXPORT_DIR)
    run_id = ledger.start_run(mode=mode, objective={"primary": "sharpe_sortino_robustness"}, notes=f"symbol={symbol}")
    rows = _load_prices(symbol)
    validation = rows[0]["_validation"]
    ledger.append_data_quality_audit("stub_prices", symbol, validation)

    spot = float(rows[-1]["close"])
    chain = fetch_options_stub(symbol, spot=spot)
    max_pain = compute_max_pain(chain)
    gex = compute_gex_profile(chain, spot=spot)
    options_features = build_pressure_features(spot, max_pain, gex)

    sentiment = fetch_sentiment_stub(symbol)
    fundamentals = fetch_fundamentals_stub(symbol)
    behavior = {
        "panic_index": sentiment["panic_index"],
        "fomo_index": sentiment["fomo_index"],
    }
    feature_rows = build_feature_matrix(rows, options_features, behavior)
    for row in feature_rows:
        row.update(sentiment)
        row.update(fundamentals)
        row.update({"gex_pressure": options_features["gex_pressure"]})

    base = {"risk_budget": risk_budget, "max_leverage": 1.0, "options_weight": 0.2}
    candidates = grid_search_space(base)
    results = []
    for params in candidates:
        task = draft_task("delegate", {"symbol": symbol, "params": params})
        executor_out = dispatch_task(task.__dict__, backend=backend)
        ok, issues = review_executor_output(executor_out)
        ledger.append_decision(run_id, "review", "executor output quality gate", ok, ",".join(issues), "master_brain")

        exp_id = ledger.append_experiment(
            run_id=run_id,
            pillar="fusion",
            strategy_name="three_pillar_fusion",
            dataset_id=f"{symbol}_stub_120d",
            params=params,
            executor_backend=backend,
        )
        metrics = run_backtest(feature_rows, regime="mixed")
        metrics["turnover"] = metrics["turnover"] * (1 + params["options_weight"])
        ledger.append_backtest_result(exp_id, metrics)
        results.append({"params": params, "metrics": metrics, "ok": ok})

    best = pick_best_result(results)
    stress = run_stress_suite(best["metrics"] if best else {})
    export_path = ledger.export_run(run_id)
    snapshot_path = write_latest_snapshot(
        DEFAULT_SNAPSHOT_DIR,
        {"run_id": run_id, "symbol": symbol, "mode": mode, "best": best, "stress": stress, "next_action_for_continue": "Review best params and run next symbol"},
    )
    ledger.append_artifact(run_id, "ledger_export", str(export_path))
    ledger.append_artifact(run_id, "snapshot", str(snapshot_path))
    ledger.complete_run(run_id, status="completed")
    return {"run_id": run_id, "best": best, "stress": stress, "export_path": str(export_path), "snapshot_path": str(snapshot_path)}


def cmd_run(args: argparse.Namespace) -> None:
    result = run_loop(symbol=args.symbol, mode=args.mode, backend=args.backend, risk_budget=args.risk_budget)
    print(json.dumps(result, indent=2))


def cmd_resume(_args: argparse.Namespace) -> None:
    snapshot = load_latest_snapshot(DEFAULT_SNAPSHOT_DIR)
    if not snapshot:
        print(json.dumps({"message": "No snapshot found"}, indent=2))
        return
    print(json.dumps(snapshot, indent=2))


def cmd_init(_args: argparse.Namespace) -> None:
    Path(DEFAULT_EXPORT_DIR).mkdir(parents=True, exist_ok=True)
    Path(DEFAULT_SNAPSHOT_DIR).mkdir(parents=True, exist_ok=True)
    Ledger(DEFAULT_DB, DEFAULT_EXPORT_DIR)
    print(json.dumps({"message": "orchestrator initialized", "db": DEFAULT_DB}, indent=2))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="QUANTAN Autonomous Orchestrator CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    init_cmd = sub.add_parser("init")
    init_cmd.set_defaults(func=cmd_init)

    run_cmd = sub.add_parser("run-loop")
    run_cmd.add_argument("--symbol", default="SPY")
    run_cmd.add_argument("--mode", choices=["paper", "staged_live"], default="paper")
    run_cmd.add_argument("--backend", choices=["cursor_local", "external_stub"], default="cursor_local")
    run_cmd.add_argument("--risk-budget", type=float, default=0.02)
    run_cmd.set_defaults(func=cmd_run)

    resume_cmd = sub.add_parser("resume")
    resume_cmd.set_defaults(func=cmd_resume)
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
