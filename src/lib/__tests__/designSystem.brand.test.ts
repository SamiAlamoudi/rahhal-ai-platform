/**
 * Signature Brand Experience smoke — UI identity only.
 */

import { describe, expect, it } from 'vitest'
import {
  RAHHAL_AI_STATES,
  RAHHAL_ILLUSTRATION_KINDS,
  RAHHAL_ORB_STATES,
  TRAVEL_DNA_CATALOG,
} from '../../design-system'

describe('Rahhal Signature Brand', () => {
  it('defines seven Orb states', () => {
    expect(RAHHAL_ORB_STATES).toEqual([
      'idle',
      'listening',
      'thinking',
      'speaking',
      'success',
      'error',
      'offline',
    ])
  })

  it('defines eight AI personality states', () => {
    expect(RAHHAL_AI_STATES).toHaveLength(8)
    const ids = RAHHAL_AI_STATES.map((s) => s.id)
    expect(ids).toContain('thinking')
    expect(ids).toContain('booking')
    expect(ids).toContain('confirmation')
  })

  it('catalogs fourteen Travel DNA categories', () => {
    expect(TRAVEL_DNA_CATALOG).toHaveLength(14)
    const ids = new Set(TRAVEL_DNA_CATALOG.map((c) => c.id))
    expect(ids.has('flights')).toBe(true)
    expect(ids.has('emergency')).toBe(true)
    expect(ids.has('loyalty')).toBe(true)
  })

  it('defines premium illustration kinds', () => {
    expect(RAHHAL_ILLUSTRATION_KINDS.length).toBeGreaterThanOrEqual(5)
    expect(RAHHAL_ILLUSTRATION_KINDS).toContain('horizon')
    expect(RAHHAL_ILLUSTRATION_KINDS).toContain('dune')
  })
})
