import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CallsTable } from '@/components/CallsTable'
import type { CallRow } from '@/lib/api'

const makeCall = (overrides: Partial<CallRow> = {}): CallRow => ({
  id: 1,
  ts: 1700000000,
  project: 'test-project',
  model: 'gpt-4o',
  provider: 'openai',
  prompt_tokens: 100,
  completion_tokens: 50,
  total_tokens: 150,
  latency_ms: 300,
  cost_usd: 0.01,
  status: 'success',
  error: null,
  tags: null,
  ...overrides,
})

describe('CallsTable', () => {
  it('shows empty state when no calls', () => {
    render(<CallsTable calls={[]} />)
    expect(screen.getByText(/No calls logged yet/i)).toBeInTheDocument()
  })

  it('renders a row for each call', () => {
    const calls = [makeCall({ id: 1 }), makeCall({ id: 2, model: 'claude-haiku-4-5' })]
    render(<CallsTable calls={calls} />)
    expect(screen.getByText('gpt-4o')).toBeInTheDocument()
    expect(screen.getByText('claude-haiku-4-5')).toBeInTheDocument()
  })

  it('shows success badge for successful calls', () => {
    render(<CallsTable calls={[makeCall({ status: 'success' })]} />)
    expect(screen.getByText('success')).toBeInTheDocument()
  })

  it('shows error badge for failed calls', () => {
    render(<CallsTable calls={[makeCall({ status: 'error', error: 'rate limit' })]} />)
    expect(screen.getByText('error')).toBeInTheDocument()
  })

  it('calls onErrorClick when an error row is clicked', () => {
    const onErrorClick = vi.fn()
    const errorCall = makeCall({ status: 'error', error: 'timeout' })
    render(<CallsTable calls={[errorCall]} onErrorClick={onErrorClick} />)
    fireEvent.click(screen.getByText('error').closest('tr')!)
    expect(onErrorClick).toHaveBeenCalledWith(errorCall)
  })

  it('does not call onErrorClick when a success row is clicked', () => {
    const onErrorClick = vi.fn()
    const successCall = makeCall({ status: 'success' })
    render(<CallsTable calls={[successCall]} onErrorClick={onErrorClick} />)
    fireEvent.click(screen.getByText('success').closest('tr')!)
    expect(onErrorClick).not.toHaveBeenCalled()
  })

  it('displays token breakdown', () => {
    render(<CallsTable calls={[makeCall({ prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 })]} />)
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText(/100↑/)).toBeInTheDocument()
    expect(screen.getByText(/50↓/)).toBeInTheDocument()
  })

  it('displays project badge', () => {
    render(<CallsTable calls={[makeCall({ project: 'summariser' })]} />)
    expect(screen.getByText('summariser')).toBeInTheDocument()
  })

  it('renders multiple calls in descending order as given', () => {
    const calls = [
      makeCall({ id: 1, model: 'newest' }),
      makeCall({ id: 2, model: 'oldest' }),
    ]
    render(<CallsTable calls={calls} />)
    const rows = screen.getAllByRole('row')
    // row[0] = header, row[1] = first call (newest)
    expect(rows[1]).toHaveTextContent('newest')
  })
})
