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

  it('parses Arabic word durations and departure origin without overwriting destination', () => {
    const morocco = extractFromUserText(
      'أريد السفر إلى المغرب مع زوجتي لمدة سبعة أيام في سبتمبر بميزانية 12000 ريال',
    )
    expect(morocco.patch.destination).toBe('Morocco')
    expect(morocco.patch.durationDays).toBe(7)
    expect(morocco.patch.travelers).toBe(2)
    expect(morocco.patch.budgetAmount).toBe(12000)

    const originOnly = extractFromUserText('السفر من الرياض، فندق متوسط الفئة')
    expect(originOnly.patch.origin).toBe('Riyadh')
    expect(originOnly.patch.destination).toBeUndefined()
    expect(originOnly.patch.budgetStyle).toBe('midrange')
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

  it('parses ISO, slash, dash, and relative dates', () => {
    expect(extractFromUserText('Travel on 2026-07-30').patch.startDate).toBe('2026-07-30')
    expect(extractFromUserText('Travel on 30/07/2026').patch.startDate).toBe('2026-07-30')
    expect(extractFromUserText('Travel on 30-07-2026').patch.startDate).toBe('2026-07-30')
    expect(
      extractFromUserText(
        'أريد السفر إلى المغرب مع زوجتي لمدة أسبوع من مطار الرياض في تاريخ 2026-07-30 ميزانيتي 10000 ريال',
      ).patch.startDate,
    ).toBe('2026-07-30')
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

  it('parses two weeks in Japan next August with my wife', () => {
    const result = extractFromUserText(
      'I want to spend two weeks in Japan next August with my wife.',
    )
    expect(result.patch.destination).toBe('Japan')
    expect(result.patch.durationDays).toBe(14)
    expect(result.patch.travelerType).toBe('couple')
    expect(result.patch.travelers).toBe(2)
    expect(result.patch.startDate).toMatch(/-08-01$/)
  })

  it('QA: destination is not stolen by origin city', () => {
    const business = extractFromUserText(
      'Business trip to London for 3 days next month, from Jeddah',
    )
    expect(business.patch.destination).toBe('London')
    expect(business.patch.origin).toBe('Jeddah')
    expect(business.patch.durationDays).toBe(3)

    const arabic = extractFromUserText(
      'أريد رحلة عائلية إلى إسطنبول لمدة 6 أيام بميزانية 10000 ريال من جدة',
    )
    expect(arabic.patch.destination).toBe('Istanbul')
    expect(arabic.patch.origin).toBe('Jeddah')
    expect(arabic.patch.durationDays).toBe(6)
  })

  it('QA: barcelona, family kids, cheap solo, multi-city', () => {
    const barcelona = extractFromUserText(
      'Plan a weekend in Barcelona for a couple under 5000 EUR',
    )
    expect(barcelona.patch.destination).toBe('Barcelona')
    expect(barcelona.patch.durationDays).toBe(2)
    expect(barcelona.patch.travelers).toBe(2)

    const family = extractFromUserText(
      'Family trip to Dubai with 2 kids, 6 days, budget 15000 SAR',
    )
    expect(family.patch.destination).toBe('Dubai')
    expect(family.patch.travelers).toBe(4)
    expect(family.patch.travelerType).toBe('family')

    const budget = extractFromUserText(
      'Cheap trip to Cairo for one person, 4 days, under 3000 SAR',
    )
    expect(budget.patch.destination).toBe('Cairo')
    expect(budget.patch.travelers).toBe(1)
    expect(budget.patch.budgetStyle).toBe('budget')

    const multi = extractFromUserText(
      'I want to visit Paris and Rome in one trip for 10 days',
    )
    expect(multi.patch.destination).toBe('Paris')
    expect(multi.patch.destinations).toEqual(expect.arrayContaining(['Paris', 'Rome']))

    const tokyo = extractFromUserText(
      'I want a solo trip to Tokyo for 5 days in October, budget 8000 SAR from Riyadh',
    )
    expect(tokyo.patch.destination).toBe('Tokyo')
    expect(tokyo.patch.origin).toBe('Riyadh')
    expect(tokyo.patch.travelers).toBe(1)
  })
})
