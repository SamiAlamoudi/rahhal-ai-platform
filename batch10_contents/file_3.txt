import { describe, it, expect } from 'vitest'
import { buildTravelSearchRequest } from '../travelSearchRequest'
import {
  createEmptyTravelSession,
  mergeTravelSession,
  confirmDecisionProfile,
} from '../travelSession'

const MSG1 = 'أريد السفر إلى اليابان لمدة 10 أيام مع زوجتي وطفلين وميزانيتي 20 ألف ريال.'

function fillSession() {
  let s = mergeTravelSession(createEmptyTravelSession(), MSG1)
  s = mergeTravelSession(s, 'من الرياض')
  s = mergeTravelSession(s, '15 أكتوبر')
  return s
}

describe('Scenario 6: TravelSearchRequest generation', () => {
  it('generates from a confirmed TravelSession with correct values', () => {
    const s = confirmDecisionProfile(fillSession())
    const req = buildTravelSearchRequest(s)
    expect(req.destination).toBe('Japan')
    expect(req.departureCity).toBe('Riyadh')
    expect(req.durationDays).toBe(10)
    expect(req.travelers.adults).toBe(2)
    expect(req.travelers.children).toBe(2)
    expect(req.budgetAmount).toBe(20000)
    expect(req.budgetCurrency).toBe('SAR')
  })

  it('marks readyForSearch as true when all essentials are present', () => {
    const s = confirmDecisionProfile(fillSession())
    const req = buildTravelSearchRequest(s)
    expect(req.readyForSearch).toBe(true)
  })

  it('prevents readyForSearch when essential info is missing', () => {
    const s = mergeTravelSession(createEmptyTravelSession(), MSG1)
    const req = buildTravelSearchRequest(s)
    expect(req.readyForSearch).toBe(false)
  })

  it('does not duplicate fields — each session field maps to one request field', () => {
    const s = confirmDecisionProfile(fillSession())
    const req = buildTravelSearchRequest(s)
    expect(req.destination).toBe(s.destination)
    expect(req.departureCity).toBe(s.departureCity)
    expect(req.durationDays).toBe(s.durationDays ?? 0)
    expect(req.budgetAmount).toBe(s.budgetAmount)
  })

  it('normalizes travelers.total correctly', () => {
    const s = confirmDecisionProfile(fillSession())
    const req = buildTravelSearchRequest(s)
    expect(req.travelers.total).toBe(req.travelers.adults + req.travelers.children)
  })
})
