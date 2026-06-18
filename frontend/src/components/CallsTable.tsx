'use client'
import { CallRow, fmt$, fmtMs } from '@/lib/api'

export function CallsTable({ calls, onErrorClick }: { calls: CallRow[]; onErrorClick?: (call: CallRow) => void }) {
  if (!calls.length) {
    return (
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '48px 24px',
        textAlign: 'center',
        color: 'var(--muted)',
      }}>
        <p style={{ fontSize: 13 }}>No calls logged yet.</p>
        <p style={{ fontSize: 12, marginTop: 6 }}>Install the SDK and wrap your first LLM call to see data here.</p>
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['time', 'project', 'model', 'tokens', 'cost', 'latency', 'status'].map(h => (
                <th key={h} style={{
                  padding: '10px 14px',
                  textAlign: 'left',
                  color: 'var(--muted)',
                  fontWeight: 500,
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calls.map((c) => {
              const d = new Date(c.ts * 1000)
              const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              return (
                <tr
                  key={c.id}
                  onClick={c.status === 'error' && onErrorClick ? () => onErrorClick(c) : undefined}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    cursor: c.status === 'error' ? 'pointer' : 'default',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = c.status === 'error'
                      ? 'rgba(248,113,113,0.06)'
                      : 'var(--surface-2)'
                  }}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '9px 14px', color: 'var(--muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{timeStr}</td>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 7px', fontSize: 11 }}>
                      {c.project}
                    </span>
                  </td>
                  <td style={{ padding: '9px 14px', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{c.model}</td>
                  <td style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)', color: 'var(--blue)' }}>
                    {c.total_tokens.toLocaleString()}
                    <span style={{ color: 'var(--muted)', fontSize: 10, marginLeft: 4 }}>
                      {c.prompt_tokens}↑ {c.completion_tokens}↓
                    </span>
                  </td>
                  <td style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>{fmt$(c.cost_usd)}</td>
                  <td style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)' }}>{fmtMs(c.latency_ms)}</td>
                  <td style={{ padding: '9px 14px' }}>
                    <span style={{
                      background: c.status === 'success' ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
                      color: c.status === 'success' ? 'var(--green)' : 'var(--red)',
                      border: `1px solid ${c.status === 'success' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
                      borderRadius: 4,
                      padding: '2px 8px',
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {c.status}
                    </span>
                    {c.error && (
                      <span style={{ color: 'var(--red)', fontSize: 11, marginLeft: 8 }} title={c.error}>⚠</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
