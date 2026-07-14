import { describe, it, expect } from 'vitest'
import { sessionRepository } from '../repositories/sessionRepository'
import { createEmptyTravelSession, mergeTravelSession, ALL_TRACKED_FIELDS } from '../../utils/travelSession'

describe('Session Repository: serialization', () => {
  it('sessionToData includes all tracked fields', () => {
    const session = createEmptyTravelSession()
    const data = sessionRepository.sessionToData(session)
    for (const field of ALL_TRACKED_FIELDS) {
      expect(data).toHaveProperty(field)
    }
    expect(data).toHaveProperty('lastUpdatedAt')
  })

  it('dataToSession roundtrips the session object', () => {
    const original = mergeTravelSession(createEmptyTravelSession(), 'أريد السفر إلى اليابان من الرياض لمدة 7 أيام مع ميزانية 15000 ريال')
    const data = sessionRepository.sessionToData(original)
    const restored = sessionRepository.dataToSession(data)
    expect(restored.destination).toBe(original.destination)
    expect(restored.departureCity).toBe(original.departureCity)
    expect(restored.durationDays).toBe(original.durationDays)
    expect(restored.budgetAmount).toBe(original.budgetAmount)
  })

  it('sessionToData preserves tracked fields including destination', () => {
    const session = mergeTravelSession(createEmptyTravelSession(), 'أريد السفر إلى اليابان')
    const data = sessionRepository.sessionToData(session)
    expect(data.destination).toBe('Japan')
    expect(data.lastUpdatedAt).toBeDefined()
  })
})
