import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatCard } from '@/components/StatCard'

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Total calls" value="42" />)
    expect(screen.getByText('Total calls')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders sub text when provided', () => {
    render(<StatCard label="Error rate" value="5.0%" sub="3 failed" />)
    expect(screen.getByText('3 failed')).toBeInTheDocument()
  })

  it('renders without sub text', () => {
    const { container } = render(<StatCard label="Spend" value="$0.42" />)
    expect(container).toBeTruthy()
  })

  it('renders all accent colors without crashing', () => {
    const accents = ['green', 'red', 'amber', 'blue', 'purple'] as const
    for (const accent of accents) {
      const { unmount } = render(<StatCard label="x" value="1" accent={accent} />)
      unmount()
    }
  })

  it('shows dash value when data is loading', () => {
    render(<StatCard label="Avg latency" value="—" sub="per call" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
