import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { parseTravelIntent } from '../tripAnalyzer'
import { mergeTravelSession, createEmptyTravelSession, getNextBestQuestion } from '../travelSession'

const FIXTURE = 'أريد السفر إلى اليابان لمدة 10 أيام مع زوجتي وطفلين وميزانيتي 20 ألف ريال.'
const MOROCCO_ISO = 'أريد السفر إلى المغرب مع زوجتي لمدة أسبوع من مطار الرياض في تاريخ 2026-07-30 ميزانيتي 10000 ريال'

describe('Scenario 1: Natural-language extraction', () => {
  it('parses destination as Japan', () => {
    const intent = parseTravelIntent(FIXTURE)
    const session = mergeTravelSession(createEmptyTravelSession(), FIXTURE)
    expect(intent.destination).toContain('اليابان')
    expect(session.destination).toBe('Japan')
  })

  it('parses durationDays as 10', () => {
    const session = mergeTravelSession(createEmptyTravelSession(), FIXTURE)
    expect(session.durationDays).toBe(10)
  })

  it('infers adults as 2 from "زوجتي"', () => {
    const session = mergeTravelSession(createEmptyTravelSession(), FIXTURE)
    expect(session.adults).toBe(2)
  })

  it('extracts children as 2 from "طفلين"', () => {
    const session = mergeTravelSession(createEmptyTravelSession(), FIXTURE)
    expect(session.children).toBe(2)
  })

  it('extracts budgetAmount as 20000 (thousands expanded)', () => {
    const session = mergeTravelSession(createEmptyTravelSession(), FIXTURE)
    expect(session.budgetAmount).toBe(20000)
  })

  it('extracts budgetCurrency as SAR', () => {
    const session = mergeTravelSession(createEmptyTravelSession(), FIXTURE)
    expect(session.budgetCurrency).toBe('SAR')
  })
})

describe('Date recognition formats', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-18T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('extracts ISO YYYY-MM-DD into the travel session', () => {
    const intent = parseTravelIntent(MOROCCO_ISO)
    const session = mergeTravelSession(createEmptyTravelSession(), MOROCCO_ISO)
    expect(intent.departureDate).toBe('2026-07-30')
    expect(session.departureDate).toBe('2026-07-30')
    expect(session.destination).toBe('Morocco')
    expect(session.departureCity).toBe('Riyadh')
    expect(session.adults).toBe(2)
    expect(session.budgetAmount).toBe(10000)
    expect(session.durationDays).toBe(7)
  })

  it('extracts DD/MM/YYYY', () => {
    expect(parseTravelIntent('سفر في 30/07/2026').departureDate).toBe('2026-07-30')
  })

  it('extracts DD-MM-YYYY', () => {
    expect(parseTravelIntent('سفر في 30-07-2026').departureDate).toBe('2026-07-30')
  })

  it('extracts Arabic month names', () => {
    expect(parseTravelIntent('سفر في 30 يوليو 2026').departureDate).toBe('2026-07-30')
  })

  it('extracts English month names', () => {
    expect(parseTravelIntent('Travel on 30 July 2026').departureDate).toBe('2026-07-30')
  })

  it('resolves relative dates to ISO', () => {
    expect(parseTravelIntent('tomorrow').departureDate).toBe('2026-07-19')
    expect(parseTravelIntent('next week').departureDate).toBe('2026-07-25')
    expect(parseTravelIntent('next month').departureDate).toBe('2026-08-18')
    expect(parseTravelIntent('بعد أسبوع').departureDate).toBe('2026-07-25')
    expect(parseTravelIntent('الشهر القادم').departureDate).toBe('2026-08-18')
  })

  it('does not re-ask for travel date when departureDate already exists', () => {
    const session = mergeTravelSession(createEmptyTravelSession(), MOROCCO_ISO)
    expect(session.departureDate).toBe('2026-07-30')
    const next = getNextBestQuestion(session)
    expect(next?.field).not.toBe('departureDate')
  })
})
