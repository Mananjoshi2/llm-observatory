"""
Seed the Observatory with realistic demo data so the dashboard looks alive.
Run: python seed.py
"""
import sqlite3, time, random, math

DB = "backend/observatory.db"

MODELS = [
    ("gpt-4o",           "openai",    (2.50, 10.00), (400, 2000)),
    ("gpt-4o-mini",      "openai",    (0.15,  0.60), (200, 800)),
    ("claude-sonnet-4-6","anthropic", (3.00, 15.00), (500, 3000)),
    ("claude-haiku-4-5", "anthropic", (0.25,  1.25), (150, 600)),
    ("gemini-1.5-flash", "google",    (0.075, 0.30), (300, 1500)),
]

PROJECTS = ["search-agent", "summariser", "code-assistant", "support-bot"]

def cost(model_info, pt, ct):
    rIn, rOut = model_info[2]
    return (pt * rIn + ct * rOut) / 1_000_000

def main():
    conn = sqlite3.connect(DB)
    conn.execute("DELETE FROM calls")

    now = time.time()
    rows = []
    for i in range(500):
        age = random.uniform(0, 23.5 * 3600)
        ts = now - age
        m = random.choice(MODELS)
        pt = random.randint(*m[3])
        ct = int(pt * random.uniform(0.3, 1.2))
        latency = random.gauss(900, 300) if "gpt-4o" in m[0] else random.gauss(500, 150)
        latency = max(50, latency)
        err = random.random() < 0.04
        rows.append((
            ts, random.choice(PROJECTS), m[0], m[1],
            pt, ct, pt+ct,
            latency,
            cost(m, pt, ct),
            "error" if err else "success",
            "RateLimitError: quota exceeded" if err else None,
            None,
        ))

    conn.executemany("""
        INSERT INTO calls
        (ts,project,model,provider,prompt_tokens,completion_tokens,
         total_tokens,latency_ms,cost_usd,status,error,tags)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    """, rows)
    conn.commit()
    conn.close()
    print(f"Seeded {len(rows)} calls into {DB}")

if __name__ == "__main__":
    main()
