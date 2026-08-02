import { describe, expect, it } from 'vitest'
import { clamp01, nowIso } from './types'

describe('brain/types', () => {
  it('clamp01 bounds and NaN', () => {
    expect(clamp01(-1)).toBe(0)
    expect(clamp01(2)).toBe(1)
    expect(clamp01(0.4)).toBe(0.4)
    expect(clamp01(Number.NaN)).toBe(0)
  })

  it('nowIso uses clock', () => {
    expect(nowIso(() => Date.parse('2026-01-02T00:00:00.000Z'))).toBe('2026-01-02T00:00:00.000Z')
  })
})
