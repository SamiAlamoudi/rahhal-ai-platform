import { describe, it, expect } from 'vitest'
import {
  mergeTravelSession,
  createEmptyTravelSession,
  getNextBestQuestion,
} from '../travelSession'

const MSG1 = 'أريد السفر إلى اليابان لمدة 10 أيام مع زوجتي وطفلين وميزانيتي 20 ألف ريال.'
const MSG2 = 'من الرياض'

describe('Scenario 2: Multi-turn session preservation', () => {
  it('preserves all previous values after second message', () => {
    const s1 = mergeTravelSession(createEmptyTravelSession(), MSG1)
    const s2 = mergeTravelSession(s1, MSG2)

    expect(s2.destination).toBe('Japan')
    expect(s2.durationDays).toBe(10)
    expect(s2.adults).toBe(2)
    expect(s2.children).toBe(2)
    expect(s2.budgetAmount).toBe(20000)
    expect(s2.budgetCurrency).toBe('SAR')
  })

  it('extracts departureCity from second message', () => {
    const s1 = mergeTravelSession(createEmptyTravelSession(), MSG1)
    const s2 = mergeTravelSession(s1, MSG2)
    expect(s2.departureCity).toBe('Riyadh')
  })

  it('does not overwrite known values with empty data', () => {
    const s1 = mergeTravelSession(createEmptyTravelSession(), MSG1)
    const before = s1.destination
    const s2 = mergeTravelSession(s1, MSG2)
    expect(s2.destination).toBe(before)
  })
})

describe('Arabic dual forms for adults', () => {
  it('parses شخصين / لشخصين as 2 adults', () => {
    const a = mergeTravelSession(createEmptyTravelSession(), 'أبغى أروح دبي لشخصين')
    expect(a.adults).toBe(2)
    const b = mergeTravelSession(createEmptyTravelSession(), 'رحلة لشخصين من جدة')
    expect(b.adults).toBe(2)
  })

  it('still parses numeric adults forms', () => {
    const s = mergeTravelSession(createEmptyTravelSession(), '2 بالغين')
    expect(s.adults).toBe(2)
  })
})

describe('Scenario 3: Question selection', () => {
  it('requests departure city after first message', () => {
    const s1 = mergeTravelSession(createEmptyTravelSession(), MSG1)
    const q = getNextBestQuestion(s1)
    expect(q).not.toBeNull()
    expect(q!.field).toBe('departureCity')
  })

  it('requests travel date after departure city is provided', () => {
    const s1 = mergeTravelSession(createEmptyTravelSession(), MSG1)
    const s2 = mergeTravelSession(s1, MSG2)
    const q = getNextBestQuestion(s2)
    expect(q).not.toBeNull()
    expect(q!.field).toBe('departureDate')
  })

  it('never repeats a known question', () => {
    const s1 = mergeTravelSession(createEmptyTravelSession(), MSG1)
    const q1 = getNextBestQuestion(s1)
    expect(q1!.field).not.toBe('destination')

    const s2 = mergeTravelSession(s1, MSG2)
    const q2 = getNextBestQuestion(s2)
    expect(q2!.field).not.toBe('departureCity')
    expect(q2!.field).not.toBe('destination')
  })

  it('never re-asks departureDate once ISO travel date is in the session', () => {
    const text = 'أريد السفر إلى المغرب مع زوجتي لمدة أسبوع من مطار الرياض في تاريخ 2026-07-30 ميزانيتي 10000 ريال'
    const session = mergeTravelSession(createEmptyTravelSession(), text)
    expect(session.departureDate).toBe('2026-07-30')
    const q = getNextBestQuestion(session)
    expect(q?.field).not.toBe('departureDate')
  })
})
