import { describe, expect, it } from 'vitest'
import { SafetyLayer } from './SafetyLayer'

describe('SafetyLayer', () => {
  const safety = new SafetyLayer()

  it('asks for missing fields', () => {
    const v = safety.assess({
      text: 'book a flight',
      intentId: 'book_flight',
      intentConfidence: 0.9,
      draft: {},
    })
    expect(v.status).toBe('clarify')
    expect(v.code).toBe('missing_information')
    expect(v.missingFields).toContain('origin')
  })

  it('blocks impossible itinerary', () => {
    const v = safety.assess({
      text: 'fly',
      intentId: 'book_flight',
      intentConfidence: 0.9,
      draft: { origin: 'Dubai', destination: 'Dubai' },
    })
    expect(v.status).toBe('block')
    expect(v.code).toBe('impossible_itinerary')
  })

  it('blocks contradictory luxury vs budget', () => {
    const v = safety.assess({
      text: '5 star',
      intentId: 'book_hotel',
      intentConfidence: 0.9,
      draft: {
        destination: 'Istanbul',
        budgetAmount: 300,
        hotelClass: 5,
        durationNights: 4,
      },
    })
    expect(v.code).toBe('contradictory_request')
  })

  it('clarifies ambiguous confidence and maybe/or', () => {
    const low = safety.assess({
      text: 'something',
      intentId: 'recommendations',
      intentConfidence: 0.3,
      draft: {},
    })
    expect(low.code).toBe('ambiguous_request')

    const maybe = safety.assess({
      text: 'maybe flights or hotels',
      intentId: 'unknown',
      intentConfidence: 0,
      draft: {},
    })
    expect(maybe.status).toBe('clarify')
  })

  it('passes safe drafts', () => {
    const v = safety.assess({
      text: 'book flight',
      intentId: 'book_flight',
      intentConfidence: 0.9,
      draft: { origin: 'Riyadh', destination: 'Istanbul' },
    })
    expect(v.status).toBe('ok')
  })
})
