import { describe, expect, it } from 'vitest'
import { extractFromUserText } from '../agent/extractRequirements'

describe('Arabic week + word-budget extraction', () => {
  it('parses أسبوع + عشرة آلاف ريال without stealing duration from عشرة', () => {
    const result = extractFromUserText(
      'أريد السفر إلى المغرب لمدة أسبوع مع زوجتي بميزانية عشرة آلاف ريال',
      'ar',
    )
    expect(result.patch.destination).toBe('Morocco')
    expect(result.patch.durationDays).toBe(7)
    expect(result.patch.budgetAmount).toBe(10000)
    expect(result.patch.budgetCurrency).toBe('SAR')
    expect(result.patch.travelers).toBe(2)
  })

  it('parses numeric budget with ريال', () => {
    const result = extractFromUserText(
      'أريد السفر إلى المغرب لمدة أسبوع مع زوجتي بميزانية 10000 ريال',
      'ar',
    )
    expect(result.patch.durationDays).toBe(7)
    expect(result.patch.budgetAmount).toBe(10000)
    expect(result.patch.budgetCurrency).toBe('SAR')
  })

  it('still parses سبعة أيام', () => {
    const result = extractFromUserText('لمدة سبعة أيام', 'ar')
    expect(result.patch.durationDays).toBe(7)
  })
})
