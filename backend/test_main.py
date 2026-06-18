"""
Backend tests for LLM Observatory API.
Uses an in-memory SQLite DB (via monkeypatching) so tests never touch observatory.db.
"""
import pytest
import time
from fastapi.testclient import TestClient

# Patch DB_PATH to an in-memory DB before importing the app
import main as app_module

@pytest.fixture(autouse=True)
def isolated_db(tmp_path, monkeypatch):
    """Each test gets a fresh temp DB."""
    db_file = str(tmp_path / "test.db")
    monkeypatch.setattr(app_module, "DB_PATH", db_file)
    app_module.init_db()
    yield


@pytest.fixture()
def client():
    return TestClient(app_module.app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def post_call(client, **kwargs):
    payload = {
        "model": "gpt-4o",
        "provider": "openai",
        "project": "test-project",
        "prompt_tokens": 100,
        "completion_tokens": 50,
        "latency_ms": 300.0,
        "cost_usd": 0.01,
        "status": "success",
        **kwargs,
    }
    r = client.post("/log", json=payload)
    assert r.status_code == 200
    return r.json()


# ---------------------------------------------------------------------------
# /log
# ---------------------------------------------------------------------------

class TestLog:
    def test_log_basic_call(self, client):
        r = post_call(client)
        assert r == {"ok": True}

    def test_log_sets_total_tokens(self, client):
        post_call(client, prompt_tokens=200, completion_tokens=80)
        calls = client.get("/calls?hours=24").json()
        assert calls[0]["total_tokens"] == 280

    def test_log_error_call(self, client):
        post_call(client, status="error", error="rate limit exceeded")
        calls = client.get("/calls?hours=24").json()
        assert calls[0]["status"] == "error"
        assert calls[0]["error"] == "rate limit exceeded"

    def test_log_with_tags(self, client):
        post_call(client, tags=["prod", "summariser"])
        calls = client.get("/calls?hours=24").json()
        import json
        assert json.loads(calls[0]["tags"]) == ["prod", "summariser"]

    def test_log_missing_required_field(self, client):
        r = client.post("/log", json={"provider": "openai"})
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# /stats — summary
# ---------------------------------------------------------------------------

class TestStatsSummary:
    def test_empty_window_returns_zeros(self, client):
        s = client.get("/stats?hours=1").json()["summary"]
        assert s["total_calls"] == 0
        assert s["total_tokens"] == 0
        assert s["total_cost"] == 0
        assert s["avg_latency"] == 0
        assert s["errors"] == 0
        assert s["p95_latency"] == 0

    def test_total_calls_counts_correctly(self, client):
        for _ in range(5):
            post_call(client)
        s = client.get("/stats?hours=24").json()["summary"]
        assert s["total_calls"] == 5

    def test_total_tokens_sums_correctly(self, client):
        post_call(client, prompt_tokens=100, completion_tokens=50)
        post_call(client, prompt_tokens=200, completion_tokens=100)
        s = client.get("/stats?hours=24").json()["summary"]
        assert s["total_tokens"] == 450

    def test_error_count(self, client):
        post_call(client, status="success")
        post_call(client, status="error")
        post_call(client, status="error")
        s = client.get("/stats?hours=24").json()["summary"]
        assert s["errors"] == 2

    def test_avg_latency(self, client):
        post_call(client, latency_ms=100.0)
        post_call(client, latency_ms=300.0)
        s = client.get("/stats?hours=24").json()["summary"]
        assert abs(s["avg_latency"] - 200.0) < 0.01

    def test_project_filter_isolates_data(self, client):
        post_call(client, project="alpha")
        post_call(client, project="alpha")
        post_call(client, project="beta")
        s = client.get("/stats?hours=24&project=alpha").json()["summary"]
        assert s["total_calls"] == 2

    def test_no_errors_returns_zero_not_null(self, client):
        post_call(client, status="success")
        s = client.get("/stats?hours=24").json()["summary"]
        assert s["errors"] == 0
        assert s["errors"] is not None


# ---------------------------------------------------------------------------
# /stats — p95 latency
# ---------------------------------------------------------------------------

class TestP95Latency:
    def test_p95_single_call(self, client):
        post_call(client, latency_ms=500.0)
        s = client.get("/stats?hours=24").json()["summary"]
        assert s["p95_latency"] == 500.0

    def test_p95_with_many_calls(self, client):
        # 20 calls: 19 at 100ms, 1 at 9000ms
        # p95 index = int(20 * 0.95) = 19 → the 9000ms outlier
        for _ in range(19):
            post_call(client, latency_ms=100.0)
        post_call(client, latency_ms=9000.0)
        s = client.get("/stats?hours=24").json()["summary"]
        assert s["p95_latency"] == 9000.0

    def test_p95_empty_window_is_zero(self, client):
        s = client.get("/stats?hours=1").json()["summary"]
        assert s["p95_latency"] == 0

    def test_p95_is_higher_than_avg(self, client):
        latencies = [100, 110, 120, 130, 140, 150, 160, 170, 180, 5000]
        for l in latencies:
            post_call(client, latency_ms=float(l))
        s = client.get("/stats?hours=24").json()["summary"]
        assert s["p95_latency"] > s["avg_latency"]


# ---------------------------------------------------------------------------
# /stats — bucket granularity
# ---------------------------------------------------------------------------

class TestBuckets:
    def test_short_window_uses_1h_buckets(self, client):
        r = client.get("/stats?hours=24").json()
        assert r["bucket_size_hours"] == 1

    def test_long_window_uses_6h_buckets(self, client):
        r = client.get("/stats?hours=168").json()
        assert r["bucket_size_hours"] == 6

    def test_6h_boundary_uses_1h_buckets(self, client):
        r = client.get("/stats?hours=6").json()
        assert r["bucket_size_hours"] == 1

    def test_25h_window_uses_6h_buckets(self, client):
        r = client.get("/stats?hours=25").json()
        assert r["bucket_size_hours"] == 6

    def test_hourly_bucket_contains_calls(self, client):
        post_call(client)
        r = client.get("/stats?hours=24").json()
        assert len(r["hourly"]) == 1
        assert r["hourly"][0]["calls"] == 1


# ---------------------------------------------------------------------------
# /stats — by_model
# ---------------------------------------------------------------------------

class TestByModel:
    def test_groups_calls_by_model(self, client):
        post_call(client, model="gpt-4o")
        post_call(client, model="gpt-4o")
        post_call(client, model="claude-haiku-4-5")
        by_model = client.get("/stats?hours=24").json()["by_model"]
        models = {m["model"]: m["calls"] for m in by_model}
        assert models["gpt-4o"] == 2
        assert models["claude-haiku-4-5"] == 1

    def test_by_model_sorted_by_calls_desc(self, client):
        post_call(client, model="rare-model")
        for _ in range(5):
            post_call(client, model="popular-model")
        by_model = client.get("/stats?hours=24").json()["by_model"]
        assert by_model[0]["model"] == "popular-model"

    def test_by_model_cost_sums(self, client):
        post_call(client, model="gpt-4o", cost_usd=0.01)
        post_call(client, model="gpt-4o", cost_usd=0.02)
        by_model = client.get("/stats?hours=24").json()["by_model"]
        m = next(m for m in by_model if m["model"] == "gpt-4o")
        assert abs(m["cost"] - 0.03) < 1e-9


# ---------------------------------------------------------------------------
# /calls
# ---------------------------------------------------------------------------

class TestCalls:
    def test_returns_calls_in_window(self, client):
        post_call(client)
        post_call(client)
        calls = client.get("/calls?hours=24").json()
        assert len(calls) == 2

    def test_empty_window_returns_empty_list(self, client):
        post_call(client)
        calls = client.get("/calls?hours=0&limit=100").json()
        # hours=0 is below the ge=1 minimum — should be rejected
        assert client.get("/calls?hours=0").status_code == 422

    def test_filter_by_project(self, client):
        post_call(client, project="alpha")
        post_call(client, project="beta")
        calls = client.get("/calls?hours=24&project=alpha").json()
        assert len(calls) == 1
        assert calls[0]["project"] == "alpha"

    def test_filter_by_model(self, client):
        post_call(client, model="gpt-4o")
        post_call(client, model="claude-haiku-4-5")
        calls = client.get("/calls?hours=24&model=gpt-4o").json()
        assert len(calls) == 1
        assert calls[0]["model"] == "gpt-4o"

    def test_filter_by_status(self, client):
        post_call(client, status="success")
        post_call(client, status="error")
        calls = client.get("/calls?hours=24&status=error").json()
        assert len(calls) == 1
        assert calls[0]["status"] == "error"

    def test_limit_respected(self, client):
        for _ in range(10):
            post_call(client)
        calls = client.get("/calls?hours=24&limit=3").json()
        assert len(calls) == 3

    def test_ordered_by_ts_desc(self, client):
        post_call(client)
        time.sleep(0.01)
        post_call(client, model="claude-haiku-4-5")
        calls = client.get("/calls?hours=24").json()
        assert calls[0]["model"] == "claude-haiku-4-5"

    def test_all_fields_present(self, client):
        post_call(client)
        call = client.get("/calls?hours=24").json()[0]
        for field in ["id", "ts", "project", "model", "provider",
                      "prompt_tokens", "completion_tokens", "total_tokens",
                      "latency_ms", "cost_usd", "status", "error", "tags"]:
            assert field in call, f"Missing field: {field}"


# ---------------------------------------------------------------------------
# /projects
# ---------------------------------------------------------------------------

class TestProjects:
    def test_lists_distinct_projects(self, client):
        post_call(client, project="alpha")
        post_call(client, project="alpha")
        post_call(client, project="beta")
        projects = client.get("/projects").json()
        assert sorted(projects) == ["alpha", "beta"]

    def test_empty_db_returns_empty_list(self, client):
        projects = client.get("/projects").json()
        assert projects == []


# ---------------------------------------------------------------------------
# DELETE /calls
# ---------------------------------------------------------------------------

class TestDeleteCalls:
    def test_clears_all_calls(self, client):
        post_call(client)
        post_call(client)
        r = client.delete("/calls")
        assert r.json() == {"ok": True}
        calls = client.get("/calls?hours=24").json()
        assert calls == []

    def test_stats_reset_after_delete(self, client):
        post_call(client)
        client.delete("/calls")
        s = client.get("/stats?hours=24").json()["summary"]
        assert s["total_calls"] == 0
