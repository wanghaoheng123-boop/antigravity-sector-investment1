import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from orchestrator.memory.sqlite_store import connect, initialize_schema


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


def config_hash(payload: dict[str, Any]) -> str:
    encoded = json.dumps(payload, sort_keys=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


class Ledger:
    def __init__(self, db_path: str, export_dir: str) -> None:
        self.conn = connect(db_path)
        initialize_schema(self.conn)
        self.export_dir = Path(export_dir)
        self.export_dir.mkdir(parents=True, exist_ok=True)

    def start_run(self, mode: str, objective: dict[str, Any], notes: str = "") -> str:
        run_id = _id("run")
        self.conn.execute(
            """
            INSERT INTO runs (run_id, started_at, status, mode, objective_hash, config_hash, notes)
            VALUES (?, ?, 'running', ?, ?, ?, ?)
            """,
            (run_id, _now(), mode, config_hash(objective), config_hash({"mode": mode}), notes),
        )
        self.conn.commit()
        return run_id

    def complete_run(self, run_id: str, status: str = "completed") -> None:
        self.conn.execute(
            "UPDATE runs SET status=?, ended_at=? WHERE run_id=?",
            (status, _now(), run_id),
        )
        self.conn.commit()

    def append_experiment(
        self,
        run_id: str,
        pillar: str,
        strategy_name: str,
        dataset_id: str,
        params: dict[str, Any],
        executor_backend: str,
        seed: int = 42,
        code_version: str = "local",
    ) -> str:
        experiment_id = _id("exp")
        self.conn.execute(
            """
            INSERT INTO experiments (
              experiment_id, run_id, pillar, strategy_name, dataset_id, feature_set_hash,
              param_set_json, seed, executor_backend, code_version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                experiment_id,
                run_id,
                pillar,
                strategy_name,
                dataset_id,
                config_hash(params),
                json.dumps(params, sort_keys=True),
                seed,
                executor_backend,
                code_version,
            ),
        )
        self.conn.commit()
        return experiment_id

    def append_backtest_result(self, experiment_id: str, metrics: dict[str, Any]) -> str:
        result_id = _id("res")
        self.conn.execute(
            """
            INSERT INTO backtest_results (
              result_id, experiment_id, period_start, period_end, market_regime,
              sharpe, sortino, calmar, max_drawdown, hit_rate, turnover, tail_loss_p95, cost_bps
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                result_id,
                experiment_id,
                metrics.get("period_start"),
                metrics.get("period_end"),
                metrics.get("market_regime"),
                metrics.get("sharpe", 0.0),
                metrics.get("sortino", 0.0),
                metrics.get("calmar", 0.0),
                metrics.get("max_drawdown", 0.0),
                metrics.get("hit_rate", 0.0),
                metrics.get("turnover", 0.0),
                metrics.get("tail_loss_p95", 0.0),
                metrics.get("cost_bps", 22.0),
            ),
        )
        self.conn.commit()
        return result_id

    def append_decision(
        self, run_id: str, stage: str, decision_text: str, accepted: bool, rationale: str, operator: str
    ) -> str:
        decision_id = _id("dec")
        self.conn.execute(
            """
            INSERT INTO decisions (decision_id, run_id, stage, decision_text, accepted, rationale, operator)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (decision_id, run_id, stage, decision_text, 1 if accepted else 0, rationale, operator),
        )
        self.conn.commit()
        return decision_id

    def append_artifact(self, run_id: str, kind: str, path: str, sha256: str = "") -> str:
        artifact_id = _id("art")
        self.conn.execute(
            """
            INSERT INTO artifacts (artifact_id, run_id, kind, path, sha256, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (artifact_id, run_id, kind, path, sha256, _now()),
        )
        self.conn.commit()
        return artifact_id

    def append_data_quality_audit(self, source: str, symbol: str, payload: dict[str, Any]) -> str:
        audit_id = _id("dq")
        self.conn.execute(
            """
            INSERT INTO data_quality_audit (
              audit_id, timestamp, source, symbol, missing_pct, outlier_pct, noise_score_pre,
              noise_score_post, validation_pass, issue_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                audit_id,
                _now(),
                source,
                symbol,
                payload.get("missing_pct", 0.0),
                payload.get("outlier_pct", 0.0),
                payload.get("noise_score_pre", 0.0),
                payload.get("noise_score_post", 0.0),
                1 if payload.get("validation_pass", False) else 0,
                json.dumps(payload.get("issues", [])),
            ),
        )
        self.conn.commit()
        return audit_id

    def export_run(self, run_id: str) -> Path:
        payload = {"run_id": run_id, "exported_at": _now(), "tables": {}}
        tables = [
            ("runs", "SELECT * FROM runs WHERE run_id=?"),
            ("experiments", "SELECT * FROM experiments WHERE run_id=?"),
            (
                "backtest_results",
                "SELECT br.* FROM backtest_results br JOIN experiments e ON br.experiment_id=e.experiment_id WHERE e.run_id=?",
            ),
            ("decisions", "SELECT * FROM decisions WHERE run_id=?"),
            ("artifacts", "SELECT * FROM artifacts WHERE run_id=?"),
        ]
        for key, sql in tables:
            rows = self.conn.execute(sql, (run_id,)).fetchall()
            payload["tables"][key] = [dict(r) for r in rows]

        path = self.export_dir / f"{run_id}.json"
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return path

    def latest_resumable_run(self) -> dict[str, Any] | None:
        row = self.conn.execute(
            "SELECT * FROM runs WHERE status IN ('running','paused') ORDER BY started_at DESC LIMIT 1"
        ).fetchone()
        return dict(row) if row else None
