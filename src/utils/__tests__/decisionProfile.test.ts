import { describe, it, expect } from 'vitest'
import {
  createEmptyTravelSession,
  mergeTravelSession,
  isDecisionProfileReady,
  confirmDecisionProfile,
  updateSessionField,
} from '../travelSession'

const MSG1 = 'أريد السفر إلى اليابان لمدة 10 أيام مع زوجتي وطفلين وميزانيتي 20 ألف ريال.'

function fillEssentialSession() {
  let s = mergeTravelSession(createEmptyTravelSession(), MSG1)
  s = mergeTravelSession(s, 'من الرياض')
  s = mergeTravelSession(s, '15 أكتوبر')
  return s
}

describe('Scenario 5: Decision profile readiness', () => {
  it('returns not ready when essential fields are incomplete', () => {
    const s = mergeTravelSession(createEmptyTravelSession(), MSG1)
    expect(isDecisionProfileReady(s)).toBe(false)
  })

  it('returns ready when all essential fields are complete', () => {
    const s = fillEssentialSession()
    expect(isDecisionProfileReady(s)).toBe(true)
  })

  it('confirmed profile remains confirmed until a relevant field changes', () => {
    const s = fillEssentialSession()
    const confirmed = confirmDecisionProfile(s)
    expect(confirmed.decisionProfileConfirmed).toBe(true)
    const edited = updateSessionField(confirmed, 'interests', 'ثقافة')
    expect(edited.decisionProfileConfirmed).toBe(true)
  })

  it('editing one field preserves all unrelated values', () => {
    const s = fillEssentialSession()
    const edited = updateSessionField(s, 'interests', 'ثقافة')
    expect(edited.destination).toBe('Japan')
    expect(edited.departureCity).toBe('Riyadh')
    expect(edited.durationDays).toBe(10)
    expect(edited.adults).toBe(2)
    expect(edited.children).toBe(2)
    expect(edited.budgetAmount).toBe(20000)
  })
})
