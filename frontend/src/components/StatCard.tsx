'use client'

interface StatCardProps {
  label: string
  value: string
  sub?: string
  accent?: 'green' | 'red' | 'amber' | 'blue' | 'purple'
}

const accentColors = {
  green:  'var(--green)',
  red:    'var(--red)',
  amber:  'var(--amber)',
  blue:   'var(--blue)',
  purple: 'var(--accent)',
}

export function StatCard({ label, value, sub, accent = 'purple' }: StatCardProps) {
  const color = accentColors[accent]
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '16px 20px',
      borderTop: `2px solid ${color}`,
    }}>
      <p style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        {label}
      </p>
      <p style={{ fontSize: 26, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{sub}</p>
      )}
    </div>
  )
}
