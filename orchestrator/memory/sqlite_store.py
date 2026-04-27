import sqlite3
from pathlib import Path


DDL = [
    """
    CREATE TABLE IF NOT EXISTS runs (
      run_id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      status TEXT NOT NULL,
      mode TEXT NOT NULL,
      objective_hash TEXT,
      config_hash TEXT,
      notes TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS experiments (
      experiment_id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      pillar TEXT NOT NULL,
      strategy_name TEXT NOT NULL,
      dataset_id TEXT NOT NULL,
      feature_set_hash TEXT,
      param_set_json TEXT NOT NULL,
      seed INTEGER,
      executor_backend TEXT NOT NULL,
      code_version TEXT,
      FOREIGN KEY(run_id) REFERENCES runs(run_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS backtest_results (
      result_id TEXT PRIMARY KEY,
      experiment_id TEXT NOT NULL,
      period_start TEXT,
      period_end TEXT,
      market_regime TEXT,
      sharpe REAL,
      sortino REAL,
      calmar REAL,
      max_drawdown REAL,
      hit_rate REAL,
      turnover REAL,
      tail_loss_p95 REAL,
      cost_bps REAL,
      FOREIGN KEY(experiment_id) REFERENCES experiments(experiment_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS options_intel_snapshots (
      snapshot_id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      symbol TEXT NOT NULL,
      max_pain REAL,
      call_wall REAL,
      put_wall REAL,
      gex_total REAL,
      dealer_flip REAL,
      oi_skew REAL,
      source_confidence REAL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS behavioral_features (
      feature_id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      symbol TEXT NOT NULL,
      fomo_index REAL,
      panic_index REAL,
      loss_aversion_proxy REAL,
      crowding_score REAL,
      signal_value REAL,
      normalization_meta TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS data_quality_audit (
      audit_id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      source TEXT NOT NULL,
      symbol TEXT NOT NULL,
      missing_pct REAL,
      outlier_pct REAL,
      noise_score_pre REAL,
      noise_score_post REAL,
      validation_pass INTEGER NOT NULL,
      issue_json TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS decisions (
      decision_id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      stage TEXT NOT NULL,
      decision_text TEXT NOT NULL,
      accepted INTEGER NOT NULL,
      rationale TEXT,
      operator TEXT,
      FOREIGN KEY(run_id) REFERENCES runs(run_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS artifacts (
      artifact_id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      path TEXT NOT NULL,
      sha256 TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(run_id) REFERENCES runs(run_id)
    )
    """,
]


def connect(db_path: str) -> sqlite3.Connection:
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def initialize_schema(conn: sqlite3.Connection) -> None:
    for ddl in DDL:
        conn.execute(ddl)
    conn.commit()
