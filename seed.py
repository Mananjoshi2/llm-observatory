"""
Seed the Observatory with realistic demo data so the dashboard looks alive.

Local:  python seed.py
Remote: python seed.py https://llm-observatory-lmt9.onrender.com
"""
import sys, time, random, urllib.request, urllib.error, json

BASE_URL = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://localhost:8000"

MODELS = [
    ("gpt-4o",           "openai",    (2.50, 10.00), (400, 2000)),
    ("gpt-4o-mini",      "openai",    (0.15,  0.60), (200, 800)),
    ("claude-sonnet-4-6","anthropic", (3.00, 15.00), (500, 3000)),
    ("claude-haiku-4-5", "anthropic", (0.25,  1.25), (150, 600)),
    ("gemini-1.5-flash", "google",    (0.075, 0.30), (300, 1500)),
]

PROJECTS = ["search-agent", "summariser", "code-assistant", "support-bot"]

def calc_cost(model_info, pt, ct):
    rIn, rOut = model_info[2]
    return (pt * rIn + ct * rOut) / 1_000_000

def post(payload):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{BASE_URL}/log",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    urllib.request.urlopen(req, timeout=10)

def seed_demo_data(db_path="observatory.db", n=500):
    """Insert n synthetic calls directly into the SQLite DB."""
    import sqlite3
    now = time.time()
    rows = []
    for _ in range(n):
        age = random.uniform(0, 167 * 3600)  # spread across ~7 days
        ts = now - age
        m = random.choice(MODELS)
        pt = random.randint(*m[3])
        ct = int(pt * random.uniform(0.3, 1.2))
        latency = random.gauss(900, 300) if "gpt-4o" in m[0] else random.gauss(500, 150)
        latency = max(50, latency)
        err = random.random() < 0.04
        rows.append((
            ts,
            random.choice(PROJECTS),
            m[0], m[1],
            pt, ct, pt + ct,
            round(latency, 2),
            round(calc_cost(m, pt, ct), 6),
            "error" if err else "success",
            "RateLimitError: quota exceeded" if err else None,
            None,
        ))
    with sqlite3.connect(db_path) as conn:
        conn.executemany(
            """INSERT INTO calls
               (ts, project, model, provider, prompt_tokens, completion_tokens,
                total_tokens, latency_ms, cost_usd, status, error, tags)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            rows,
        )
        conn.commit()
    print(f"Seeded {n} demo calls into {db_path}.")

def main():
    print(f"Seeding 500 calls to {BASE_URL} ...")
    now = time.time()
    for i in range(500):
        m = random.choice(MODELS)
        pt = random.randint(*m[3])
        ct = int(pt * random.uniform(0.3, 1.2))
        latency = random.gauss(900, 300) if "gpt-4o" in m[0] else random.gauss(500, 150)
        latency = max(50, latency)
        err = random.random() < 0.04

        post({
            "project": random.choice(PROJECTS),
            "model": m[0],
            "provider": m[1],
            "prompt_tokens": pt,
            "completion_tokens": ct,
            "latency_ms": round(latency, 2),
            "cost_usd": round(calc_cost(m, pt, ct), 6),
            "status": "error" if err else "success",
            "error": "RateLimitError: quota exceeded" if err else None,
        })

        if (i + 1) % 50 == 0:
            print(f"  {i + 1}/500")

    print("Done!")

if __name__ == "__main__":
    main()
