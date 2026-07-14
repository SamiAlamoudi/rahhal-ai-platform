import { describe, it, expect } from 'vitest'
import { parseTravelIntent } from '../tripAnalyzer'
import { mergeTravelSession, createEmptyTravelSession } from '../travelSession'

const FIXTURE = 'أريد السفر إلى اليابان لمدة 10 أيام مع زوجتي وطفلين وميزانيتي 20 ألف ريال.'

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
