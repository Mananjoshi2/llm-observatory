const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export interface Summary {
  total_calls: number
  total_tokens: number
  total_cost: number
  avg_latency: number
  p95_latency: number
  errors: number
}

export interface ModelStat {
  model: string
  calls: number
  cost: number
  avg_latency: number
  tokens: number
}

export interface ProjectStat {
  project: string
  calls: number
  cost: number
}

export interface HourlyBucket {
  hour_offset: number
  calls: number
  cost: number
  avg_latency: number
}

export interface StatsResponse {
  summary: Summary
  by_model: ModelStat[]
  by_project: ProjectStat[]
  hourly: HourlyBucket[]
  window_hours: number
  bucket_size_hours: number
}

export interface CallRow {
  id: number
  ts: number
  project: string
  model: string
  provider: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  latency_ms: number
  cost_usd: number
  status: string
  error: string | null
  tags: string | null
}

export async function fetchStats(hours = 24, project?: string): Promise<StatsResponse> {
  const params = new URLSearchParams({ hours: String(hours) })
  if (project) params.set('project', project)
  const res = await fetch(`${BASE}/stats?${params}`, { cache: 'no-store' })
  return res.json()
}

export async function fetchCalls(hours = 24, project?: string): Promise<CallRow[]> {
  const params = new URLSearchParams({ hours: String(hours), limit: '200' })
  if (project) params.set('project', project)
  const res = await fetch(`${BASE}/calls?${params}`, { cache: 'no-store' })
  return res.json()
}

export async function fetchProjects(): Promise<string[]> {
  const res = await fetch(`${BASE}/projects`, { cache: 'no-store' })
  return res.json()
}

export function fmt$( n: number ) { return `$${n.toFixed(4)}` }
export function fmtMs( n: number ) { return `${Math.round(n)}ms` }
export function fmtK( n: number ) { return n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n) }
