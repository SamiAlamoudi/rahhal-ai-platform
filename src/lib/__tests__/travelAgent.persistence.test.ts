import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  itineraryToSavedTripData,
  parseAgentItineraryFromTripData,
  saveGeneratedItinerary,
} from '../agent/itineraryPersistence'
import { buildTravelItinerary } from '../agent/buildItinerary'
import { emptyRequirements } from '../agent/types'
import { savedTripRepository } from '../repositories/savedTripRepository'

describe('itineraryPersistence', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('round-trips agent itinerary through saved trip data', () => {
    const itinerary = buildTravelItinerary({
      conversationId: 'c1',
      locale: 'en',
      requirements: {
        ...emptyRequirements(),
        destination: 'Dubai',
        destinations: ['Dubai'],
        durationDays: 3,
      },
    })
    const data = itineraryToSavedTripData(itinerary)
    expect(data.savedFrom).toBe('travel_agent')
    expect(data.agentItinerary?.title).toBe(itinerary.title)
    const parsed = parseAgentItineraryFromTripData(data as unknown as Record<string, unknown>)
    expect(parsed?.destinations).toContain('Dubai')
  })

  it('saves through savedTripRepository', async () => {
    const itinerary = buildTravelItinerary({
      conversationId: 'c1',
      locale: 'ar',
      requirements: {
        ...emptyRequirements(),
        destination: 'Jeddah',
        destinations: ['Jeddah'],
        durationDays: 2,
      },
    })
    const create = vi.spyOn(savedTripRepository, 'create').mockResolvedValue({
      id: 'st1',
      user_id: 'u1',
      session_id: null,
      title: itinerary.title,
      destination: 'Jeddah',
      trip_data: itineraryToSavedTripData(itinerary) as unknown as Record<string, unknown>,
      created_at: '2026-07-15T00:00:00.000Z',
      updated_at: '2026-07-15T00:00:00.000Z',
    })

    const saved = await saveGeneratedItinerary({ itinerary })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      destination: 'Jeddah',
      title: itinerary.title,
    }))
    expect(saved.id).toBe('st1')
  })
})
