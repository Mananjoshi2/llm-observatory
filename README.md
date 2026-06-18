# LLM Observatory

Real-time observability for LLM API calls. Track cost, latency, tokens, and errors across any model or project — from a single dashboard.

![dashboard preview](https://placeholder.com/dashboard.png)

## What it is

A lightweight self-hosted tool you drop into any codebase. Two lines of code in your app, and every LLM call gets logged with:

- Model + provider
- Token usage (prompt / completion / total)
- Estimated cost
- Latency (avg and P95)
- Success / error status + full error detail

The dashboard auto-refreshes every 5 seconds and shows you breakdowns by model, project, and time window. Click any error row to open a detail drawer with the full error message, token counts, cost, and timing.

## Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI + SQLite |
| Frontend | Next.js 14 + TypeScript + Recharts |
| SDK | Python + TypeScript |
| Deploy | Vercel (frontend) + Railway / Render (backend) |

## Getting started

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 3. Seed with demo data (optional)

```bash
python seed.py
```

### 4. Instrument your code

**Python:**

```python
from sdk.python.observatory import Observatory

obs = Observatory(project="my-app")

# Context manager
with obs.span(model="gpt-4o", provider="openai") as span:
    response = openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )
    span.record(
        prompt_tokens=response.usage.prompt_tokens,
        completion_tokens=response.usage.completion_tokens,
    )
```

**TypeScript:**

```typescript
import { Observatory } from './sdk/typescript/observatory'

const obs = new Observatory({ project: 'my-app' })

const result = await obs.trace({
  model: 'claude-sonnet-4-6',
  provider: 'anthropic',
  fn: async (span) => {
    const res = await client.messages.create({ ... })
    span.record({
      promptTokens: res.usage.input_tokens,
      completionTokens: res.usage.output_tokens,
    })
    return res
  }
})
```

## Deployment

### Backend → Railway

```bash
# railway.toml
[build]
  builder = "nixpacks"
  buildCommand = "pip install -r requirements.txt"

[deploy]
  startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT"
```

### Frontend → Vercel

Set env var:
```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

Then `vercel deploy`.

## Dashboard features

| Feature | Detail |
|---------|--------|
| Stat cards | Total calls, spend, avg latency, **P95 latency**, total tokens, error rate |
| Time windows | 1h / 6h / 24h / 7d — chart bucket granularity scales automatically (1h buckets for ≤24h, 6h buckets for 7d) |
| Error drawer | Click any error row to see full error message, token breakdown, cost, and latency in a slide-in panel |
| Model breakdown | Per-model call count, tokens, cost, and avg latency |
| Project filter | Scope all stats and charts to a single project |

## Roadmap

- [ ] Alerts (email/Slack when cost spikes or error rate crosses threshold)
- [ ] Streaming token counting
- [ ] Multi-tenant auth (API keys per project)
- [ ] Export to CSV
- [ ] LangChain / LlamaIndex middleware
