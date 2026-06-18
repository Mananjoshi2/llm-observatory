'use client'
import { useEffect, useState, useCallback } from 'react'
import { StatCard } from '@/components/StatCard'
import { CallsTable } from '@/components/CallsTable'
import { UsageChart, CostChart, ModelBarChart } from '@/components/Charts'
import { fetchStats, fetchCalls, fetchProjects, StatsResponse, CallRow, fmt$, fmtMs, fmtK } from '@/lib/api'

function ErrorDrawer({ call, onClose }: { call: CallRow; onClose: () => void }) {
  const d = new Date(call.ts * 1000)
  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 40,
        }}
      />
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 380,
        background: 'var(--obs-surface, #111118)',
        borderLeft: '1px solid var(--border)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Error Detail</span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', fontSize: 18, lineHeight: 1, padding: 4,
            }}
          >×</button>
        </div>
        {/* Body */}
        <div style={{ padding: '18px', overflowY: 'auto', flex: 1, fontSize: 12 }}>
          {([
            ['Timestamp', d.toLocaleString()],
            ['Project', call.project],
            ['Model', call.model],
            ['Provider', call.provider],
            ['Prompt tokens', call.prompt_tokens.toLocaleString()],
            ['Completion tokens', call.completion_tokens.toLocaleString()],
            ['Total tokens', call.total_tokens.toLocaleString()],
            ['Latency', fmtMs(call.latency_ms)],
            ['Cost', fmt$(call.cost_usd)],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--muted)' }}>{label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{value}</span>
            </div>
          ))}
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Error message</p>
            <pre style={{
              background: 'var(--obs-surface2, #1a1a24)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '10px 12px',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--red)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              margin: 0,
            }}>
              {call.error ?? 'No error message recorded.'}
            </pre>
          </div>
        </div>
      </div>
    </>
  )
}

const WINDOWS = [
  { label: '1h',  hours: 1 },
  { label: '6h',  hours: 6 },
  { label: '24h', hours: 24 },
  { label: '7d',  hours: 168 },
]

export default function Dashboard() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [calls, setCalls] = useState<CallRow[]>([])
  const [projects, setProjects] = useState<string[]>([])
  const [window_, setWindow] = useState(24)
  const [project, setProject] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [drawerCall, setDrawerCall] = useState<CallRow | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [s, c, p] = await Promise.all([
        fetchStats(window_, project),
        fetchCalls(window_, project),
        fetchProjects(),
      ])
      setStats(s)
      setCalls(c)
      setProjects(p)
      setLastUpdated(new Date())
    } catch {
      // backend not running
    } finally {
      setLoading(false)
    }
  }, [window_, project])

  useEffect(() => {
    setLoading(true)
    refresh()
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [refresh])

  const s = stats?.summary
  const errorRate = s && s.total_calls > 0 ? (((s.errors ?? 0) / s.total_calls) * 100).toFixed(1) : '0.0'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {drawerCall && <ErrorDrawer call={drawerCall} onClose={() => setDrawerCall(null)} />}

      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '0 28px',
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        background: 'var(--bg)',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)' }} />
          <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em' }}>LLM Observatory</span>
          <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 4 }}>/ dashboard</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: loading ? 'var(--amber)' : 'var(--green)' }} />
        </div>
      </header>

      <main style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto' }}>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {WINDOWS.map(w => (
              <button
                key={w.hours}
                onClick={() => setWindow(w.hours)}
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  background: window_ === w.hours ? 'var(--accent-dim)' : 'transparent',
                  color: window_ === w.hours ? 'var(--text)' : 'var(--muted)',
                  transition: 'all 0.15s',
                }}
              >{w.label}</button>
            ))}
          </div>

          {projects.length > 1 && (
            <select
              value={project ?? ''}
              onChange={e => setProject(e.target.value || undefined)}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text)',
                padding: '6px 12px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <option value="">All projects</option>
              {projects.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          <StatCard
            label="Total calls"
            value={s ? fmtK(s.total_calls) : '—'}
            sub={`${s?.errors ?? 0} errors`}
            accent="purple"
          />
          <StatCard
            label="Total spend"
            value={s ? fmt$(s.total_cost) : '—'}
            sub="estimated"
            accent="amber"
          />
          <StatCard
            label="Avg latency"
            value={s ? fmtMs(s.avg_latency) : '—'}
            sub="per call"
            accent="blue"
          />
          {s && s.total_calls > 0 && (
            <StatCard
              label="P95 latency"
              value={fmtMs(s.p95_latency)}
              sub="95th pct"
              accent="blue"
            />
          )}
          <StatCard
            label="Total tokens"
            value={s ? fmtK(s.total_tokens) : '—'}
            sub="in + out"
            accent="green"
          />
          <StatCard
            label="Error rate"
            value={`${errorRate}%`}
            sub={`${s?.errors ?? 0} failed`}
            accent={parseFloat(errorRate) > 5 ? 'red' : 'green'}
          />
        </div>

        {/* Charts row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
          <UsageChart data={stats?.hourly ?? []} windowHours={window_} bucketSizeHours={stats?.bucket_size_hours ?? 1} />
          <CostChart data={stats?.hourly ?? []} windowHours={window_} bucketSizeHours={stats?.bucket_size_hours ?? 1} />
          <ModelBarChart data={stats?.by_model ?? []} />
        </div>

        {/* Model breakdown table */}
        {stats?.by_model && stats.by_model.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Model breakdown</p>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['model', 'calls', 'tokens', 'total cost', 'avg latency'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.by_model.map((m, i) => (
                    <tr key={m.model} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '9px 14px', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{m.model}</td>
                      <td style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)' }}>{m.calls.toLocaleString()}</td>
                      <td style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)', color: 'var(--blue)' }}>{fmtK(m.tokens)}</td>
                      <td style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>{fmt$(m.cost)}</td>
                      <td style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)' }}>{fmtMs(m.avg_latency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Calls log */}
        <div>
          <p style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            Recent calls {calls.length > 0 && <span style={{ color: 'var(--accent)' }}>({calls.length})</span>}
          </p>
          <CallsTable calls={calls} onErrorClick={setDrawerCall} />
        </div>

      </main>
    </div>
  )
}
