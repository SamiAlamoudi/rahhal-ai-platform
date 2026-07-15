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

  it('parses family budget vacation without inventing party size', () => {
    const result = extractFromUserText('Family vacation under $3000.')
    expect(result.patch.travelerType).toBe('family')
    expect(result.patch.tripPurpose).toBe('family')
    expect(result.patch.travelers).toBeUndefined()
    expect(result.patch.budgetAmount).toBe(3000)
    expect(result.patch.budgetCurrency).toBe('USD')
  })

  it('parses weekend in Riyadh', () => {
    const result = extractFromUserText('Weekend in Riyadh.')
    expect(result.patch.destination).toBe('Riyadh')
    expect(result.patch.durationDays).toBe(2)
  })

  it('parses honeymoon in Bali', () => {
    const result = extractFromUserText('Honeymoon in Bali.')
    expect(result.intent).toBe('plan')
    expect(result.patch.destination).toBe('Bali')
    expect(result.patch.tripPurpose).toBe('honeymoon')
    expect(result.patch.travelerType).toBe('couple')
    expect(result.patch.travelers).toBe(2)
    expect(result.patch.interests).toEqual(expect.arrayContaining(['romance', 'beach']))
  })

  it('parses business trip to London', () => {
    const result = extractFromUserText('Business trip to London.')
    expect(result.patch.destination).toBe('London')
    expect(result.patch.tripPurpose).toBe('business')
    expect(result.patch.travelerType).toBe('business')
    expect(result.patch.travelers).toBe(1)
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

  it('parses 5 days in Japan next April', () => {
    const result = extractFromUserText('I want to spend 5 days in Japan next April.')
    expect(result.patch.destination).toBe('Japan')
    expect(result.patch.durationDays).toBe(5)
    expect(result.patch.startDate).toMatch(/-04-01$/)
  })

  it('parses planning style preferences and regenerate day', () => {
    const result = extractFromUserText(
      'mild weather, mid-range style, central hotel, full package',
    )
    expect(result.patch.weatherPreference).toBe('mild')
    expect(result.patch.budgetStyle).toBe('midrange')
    expect(result.patch.hotelPreference).toBe('central')
    expect(result.patch.packageScope).toBe('full_package')
    expect(extractFromUserText('Regenerate day 3').intent).toBe('regenerate_day')
    expect(extractFromUserText('Regenerate day 3').patch.regenerateDay).toBe(3)
  })
})
