from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import sqlite3
import time
import json
from datetime import datetime, timedelta
from contextlib import contextmanager

app = FastAPI(title="LLM Observatory API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "observatory.db"

# ---------------------------------------------------------------------------
# DB setup
# ---------------------------------------------------------------------------

def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS calls (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                ts          REAL    NOT NULL,
                project     TEXT    NOT NULL DEFAULT 'default',
                model       TEXT    NOT NULL,
                provider    TEXT    NOT NULL DEFAULT 'openai',
                prompt_tokens   INTEGER NOT NULL DEFAULT 0,
                completion_tokens INTEGER NOT NULL DEFAULT 0,
                total_tokens    INTEGER NOT NULL DEFAULT 0,
                latency_ms  REAL    NOT NULL,
                cost_usd    REAL    NOT NULL DEFAULT 0,
                status      TEXT    NOT NULL DEFAULT 'success',
                error       TEXT,
                tags        TEXT
            )
        """)
        conn.commit()

init_db()

@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class CallLog(BaseModel):
    project: str = "default"
    model: str
    provider: str = "openai"
    prompt_tokens: int = 0
    completion_tokens: int = 0
    latency_ms: float
    cost_usd: float = 0.0
    status: str = "success"
    error: Optional[str] = None
    tags: Optional[list[str]] = None

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/log")
def log_call(call: CallLog):
    total = call.prompt_tokens + call.completion_tokens
    tags_str = json.dumps(call.tags) if call.tags else None
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """INSERT INTO calls
               (ts, project, model, provider, prompt_tokens, completion_tokens,
                total_tokens, latency_ms, cost_usd, status, error, tags)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (time.time(), call.project, call.model, call.provider,
             call.prompt_tokens, call.completion_tokens, total,
             call.latency_ms, call.cost_usd, call.status, call.error, tags_str)
        )
        conn.commit()
    return {"ok": True}


@app.get("/stats")
def get_stats(
    project: Optional[str] = None,
    hours: int = Query(default=24, ge=1, le=720)
):
    since = time.time() - hours * 3600
    where = "WHERE ts >= ?"
    params: list = [since]
    if project:
        where += " AND project = ?"
        params.append(project)

    with get_db() as conn:
        row = conn.execute(f"""
            SELECT
                COUNT(*)                        AS total_calls,
                SUM(total_tokens)               AS total_tokens,
                SUM(cost_usd)                   AS total_cost,
                AVG(latency_ms)                 AS avg_latency,
                SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) AS errors
            FROM calls {where}
        """, params).fetchone()

        latencies = conn.execute(
            f"SELECT latency_ms FROM calls {where} ORDER BY latency_ms", params
        ).fetchall()

        models = conn.execute(f"""
            SELECT model, COUNT(*) as calls, SUM(cost_usd) as cost,
                   AVG(latency_ms) as avg_latency, SUM(total_tokens) as tokens
            FROM calls {where}
            GROUP BY model ORDER BY calls DESC
        """, params).fetchall()

        # Buckets for sparklines — scale granularity with window
        bucket_size_hours = 6 if hours > 24 else 1
        bucket_seconds = bucket_size_hours * 3600
        buckets = conn.execute(f"""
            SELECT
                CAST((ts - ?) / ? AS INTEGER) AS hour_offset,
                COUNT(*) as calls,
                SUM(cost_usd) as cost,
                AVG(latency_ms) as avg_latency
            FROM calls {where}
            GROUP BY hour_offset
            ORDER BY hour_offset
        """, [since, bucket_seconds] + params).fetchall()

        projects = conn.execute(f"""
            SELECT project, COUNT(*) as calls, SUM(cost_usd) as cost
            FROM calls {where}
            GROUP BY project ORDER BY calls DESC
        """, params).fetchall()

    vals = [r[0] for r in latencies]
    if vals:
        idx = int(len(vals) * 0.95)
        p95 = vals[min(idx, len(vals) - 1)]
    else:
        p95 = 0

    summary = dict(row)
    summary["p95_latency"] = p95

    return {
        "summary": summary,
        "by_model": [dict(r) for r in models],
        "by_project": [dict(r) for r in projects],
        "hourly": [dict(r) for r in buckets],
        "window_hours": hours,
        "bucket_size_hours": bucket_size_hours,
    }


@app.get("/calls")
def get_calls(
    project: Optional[str] = None,
    model: Optional[str] = None,
    status: Optional[str] = None,
    hours: int = Query(default=24, ge=1, le=720),
    limit: int = Query(default=100, le=500),
):
    since = time.time() - hours * 3600
    where = "WHERE ts >= ?"
    params: list = [since]
    if project:
        where += " AND project = ?"
        params.append(project)
    if model:
        where += " AND model = ?"
        params.append(model)
    if status:
        where += " AND status = ?"
        params.append(status)

    with get_db() as conn:
        rows = conn.execute(
            f"SELECT * FROM calls {where} ORDER BY ts DESC LIMIT ?",
            params + [limit]
        ).fetchall()
    return [dict(r) for r in rows]


@app.delete("/calls")
def clear_calls():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("DELETE FROM calls")
        conn.commit()
    return {"ok": True}


@app.get("/projects")
def list_projects():
    with get_db() as conn:
        rows = conn.execute("SELECT DISTINCT project FROM calls ORDER BY project").fetchall()
    return [r["project"] for r in rows]
