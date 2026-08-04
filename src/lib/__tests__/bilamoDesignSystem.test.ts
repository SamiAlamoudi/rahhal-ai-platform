import { describe, expect, it } from 'vitest'
import {
  BILAMO_DESIGN_SYSTEM_VERSION,
  brand,
  darkPalette,
  lightPalette,
  springs,
  typography,
} from '../../design-system'
import { greetingForHour, resolveDisplayName } from '../../design-system/greeting'

describe('Bilamo design system', () => {
  it('exposes a stable version and brand', () => {
    expect(BILAMO_DESIGN_SYSTEM_VERSION).toMatch(/^\d+\.\d+\.\d+/)
    expect(brand.name).toBe('Bilamo')
  })

  it('defines dark and light palettes', () => {
    expect(darkPalette.background).toBe('#050816')
    expect(darkPalette.surface).toBe('#0D1327')
    expect(darkPalette.primary).toBe('#7C3AED')
    expect(darkPalette.secondary).toBe('#22D3EE')
    expect(darkPalette.text).toBe('#F8FAFC')
    expect(darkPalette.muted).toBe('#94A3B8')
    expect(lightPalette.background).toBe('#F8FAFC')
    expect(lightPalette.primary).toBeTruthy()
  })

  it('uses Geist and spring motion presets', () => {
    expect(typography.family.sans).toMatch(/Geist/)
    expect(springs.soft.type).toBe('spring')
    expect(springs.orb.stiffness).toBeGreaterThan(0)
  })

  it('greets by time of day', () => {
    expect(greetingForHour(8, 'Sami')).toBe('Good morning, Sami')
    expect(greetingForHour(19, 'Sami')).toBe('Good evening, Sami')
    expect(resolveDisplayName(null)).toBe('Sami')
  })
})
