import { describe, expect, it } from 'vitest'
import { EntityExtractor } from './EntityExtractor'

describe('EntityExtractor', () => {
  const ex = new EntityExtractor()

  it('extracts EN route, dates, budget, travellers', () => {
    const e = ex.extract(
      'Flight from Riyadh to Istanbul on 2026-09-10 return 2026-09-14 for 2 adults 1 child budget 5000 SAR 5 star Saudia quiet sea view wheelchair',
    )
    expect(e.origin).toBe('Riyadh')
    expect(e.destination).toBe('Istanbul')
    expect(e.dates?.departure).toBe('2026-09-10')
    expect(e.dates?.return).toBe('2026-09-14')
    expect(e.travellers).toEqual({ adults: 2, children: 1 })
    expect(e.children).toBe(1)
    expect(e.budget).toBe(5000)
    expect(e.currency).toBe('SAR')
    expect(e.hotelClass).toBe(5)
    expect(e.airline?.toLowerCase()).toContain('saudia')
    expect(e.preferences).toEqual(expect.arrayContaining(['quiet', 'sea_view']))
    expect(e.specialNeeds).toContain('wheelchair')
    expect(e.language).toBe('en')
    expect(e.transportType).toBe('flight')
  })

  it('extracts AR route, nights, visa, train', () => {
    const e = ex.extract('من الرياض إلى دبي لمدة 4 ليالي تأشيرة الإمارات قطار حلال رضيع')
    expect(e.origin).toBe('Riyadh')
    expect(e.destination).toBe('Dubai')
    expect(e.duration).toBe(4)
    expect(e.visaCountry).toBeTruthy()
    expect(e.transportType).toBe('train')
    expect(e.language).toBe('ar')
    expect(e.preferences).toContain('halal')
    expect(e.specialNeeds).toContain('infant')
  })

  it('parses slash dates and transfer/taxi', () => {
    const e = ex.extract('taxi transfer on 10/09/2026 in Cairo')
    expect(e.dates?.departure).toBe('2026-09-10')
    expect(e.transportType).toBe('transfer')
    expect(e.destination).toBe('Cairo')
  })

  it('collects raw mentions for lone city tokens', () => {
    const e = ex.extract('Dubai London')
    expect(e.destination).toBe('Dubai')
    expect(e.origin).toBe('London')
    expect(e.rawMentions.length).toBeGreaterThan(0)
  })
})
