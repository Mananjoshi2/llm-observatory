'use client'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { HourlyBucket, ModelStat } from '@/lib/api'

const MODEL_COLORS = [
  'var(--accent)', 'var(--blue)', 'var(--green)', 'var(--amber)', 'var(--red)',
]

interface UsageChartProps {
  data: HourlyBucket[]
  windowHours: number
  bucketSizeHours?: number
}

export function UsageChart({ data, windowHours, bucketSizeHours = 1 }: UsageChartProps) {
  const numBuckets = Math.ceil(windowHours / bucketSizeHours)
  const filled = Array.from({ length: numBuckets }, (_, i) => {
    const bucket = data.find(d => d.hour_offset === i)
    const hourLabel = i * bucketSizeHours
    return { hour: `${hourLabel}h`, calls: bucket?.calls ?? 0, cost: bucket?.cost ?? 0, latency: bucket?.avg_latency ?? 0 }
  })

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' }}>
      <p style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>
        Calls over time (last {windowHours}h)
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={filled} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="callsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="hour" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
          <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: 'var(--muted)' }}
            itemStyle={{ color: 'var(--text)' }}
          />
          <Area type="monotone" dataKey="calls" stroke="var(--accent)" fill="url(#callsGrad)" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function CostChart({ data, windowHours, bucketSizeHours = 1 }: UsageChartProps) {
  const numBuckets = Math.ceil(windowHours / bucketSizeHours)
  const filled = Array.from({ length: numBuckets }, (_, i) => {
    const bucket = data.find(d => d.hour_offset === i)
    const hourLabel = i * bucketSizeHours
    return { hour: `${hourLabel}h`, cost: parseFloat((bucket?.cost ?? 0).toFixed(5)) }
  })

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' }}>
      <p style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>
        Spend over time (last {windowHours}h)
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={filled} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--amber)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--amber)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="hour" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
          <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
          <Tooltip
            contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: 'var(--muted)' }}
            formatter={(v: number) => [`$${v.toFixed(5)}`, 'cost']}
          />
          <Area type="monotone" dataKey="cost" stroke="var(--amber)" fill="url(#costGrad)" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ModelBarChart({ data }: { data: ModelStat[] }) {
  const top = data.slice(0, 8)
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' }}>
      <p style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>
        Calls by model
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={top} layout="vertical" margin={{ top: 0, right: 8, left: 4, bottom: 0 }}>
          <XAxis type="number" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="model" tick={{ fill: 'var(--text)', fontSize: 11, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} width={130} />
          <Tooltip
            contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: 'var(--muted)' }}
          />
          <Bar dataKey="calls" radius={[0, 3, 3, 0]}>
            {top.map((_, i) => (
              <Cell key={i} fill={MODEL_COLORS[i % MODEL_COLORS.length]} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
