import { describe, it, expect } from 'vitest'
import { fmt$, fmtMs, fmtK } from '@/lib/api'

describe('fmt$', () => {
  it('formats zero', () => expect(fmt$(0)).toBe('$0.0000'))
  it('formats a small value', () => expect(fmt$(0.0012)).toBe('$0.0012'))
  it('formats a larger value', () => expect(fmt$(1.5)).toBe('$1.5000'))
  it('rounds to 4 decimal places', () => expect(fmt$(0.00001)).toBe('$0.0000'))
  it('handles typical LLM cost', () => expect(fmt$(0.0253)).toBe('$0.0253'))
})

describe('fmtMs', () => {
  it('formats zero', () => expect(fmtMs(0)).toBe('0ms'))
  it('rounds fractional ms', () => expect(fmtMs(747.6)).toBe('748ms'))
  it('formats whole ms', () => expect(fmtMs(300)).toBe('300ms'))
  it('formats large latency', () => expect(fmtMs(9000)).toBe('9000ms'))
  it('rounds down correctly', () => expect(fmtMs(100.4)).toBe('100ms'))
})

describe('fmtK', () => {
  it('returns raw number when under 1000', () => expect(fmtK(999)).toBe('999'))
  it('formats 1000 as 1.0k', () => expect(fmtK(1000)).toBe('1.0k'))
  it('formats 1500 as 1.5k', () => expect(fmtK(1500)).toBe('1.5k'))
  it('formats 30200 as 30.2k', () => expect(fmtK(30200)).toBe('30.2k'))
  it('returns "0" for zero', () => expect(fmtK(0)).toBe('0'))
})
