import { describe, it, expect } from 'vitest'
import { extractFromUserText } from '../agent/extractRequirements'

describe('extractFromUserText', () => {
  it('parses English Japan trip with duration', () => {
    const result = extractFromUserText('Plan a 7-day trip to Japan.')
    expect(result.locale).toBe('en')
    expect(result.intent).toBe('plan')
    expect(result.patch.destination).toBe('Japan')
    expect(result.patch.durationDays).toBe(7)
  })

  it('parses family budget vacation', () => {
    const result = extractFromUserText('Family vacation under $3000.')
    expect(result.patch.travelerType).toBe('family')
    expect(result.patch.budgetAmount).toBe(3000)
    expect(result.patch.budgetCurrency).toBe('USD')
  })

  it('parses weekend in Riyadh', () => {
    const result = extractFromUserText('Weekend in Riyadh.')
    expect(result.patch.destination).toBe('Riyadh')
    expect(result.patch.durationDays).toBe(2)
  })

  it('parses Arabic duration answers as answer intent', () => {
    const result = extractFromUserText('7 أيام')
    expect(result.locale).toBe('ar')
    expect(result.patch.durationDays).toBe(7)
    expect(result.intent).toBe('answer')
  })

  it('detects regenerate and save intents', () => {
    expect(extractFromUserText('Regenerate the itinerary').intent).toBe('regenerate')
    expect(extractFromUserText('احفظ الخطة').intent).toBe('save')
  })
})
