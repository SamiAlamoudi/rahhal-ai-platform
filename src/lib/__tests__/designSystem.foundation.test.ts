/**
 * Design System foundation smoke — UI only, no business logic.
 */

import { describe, expect, it } from 'vitest'
import { DS_SPACING, DS_TYPOGRAPHY_SCALE, DESIGN_SCREEN_CATALOG } from '../../design-system'

describe('Rahhal Design System foundation', () => {
  it('exposes 8pt spacing scale', () => {
    expect(DS_SPACING[2]).toBe(8)
    expect(DS_SPACING[4]).toBe(16)
    expect(DS_SPACING[7]).toBe(32)
  })

  it('defines typography roles', () => {
    expect(DS_TYPOGRAPHY_SCALE).toContain('hero')
    expect(DS_TYPOGRAPHY_SCALE).toContain('body')
  })

  it('catalogs all 24 premium screen shells', () => {
    expect(DESIGN_SCREEN_CATALOG).toHaveLength(24)
    const ids = new Set(DESIGN_SCREEN_CATALOG.map((s) => s.id))
    expect(ids.has('home')).toBe(true)
    expect(ids.has('aiConversation')).toBe(true)
    expect(ids.has('voiceConversation')).toBe(true)
    expect(ids.has('success')).toBe(true)
  })
})
