/**
 * Sprint 81 — SessionState (Brain v1).
 */

import { emptyBrainV1Entities, type BrainV1Entities, type BrainV1Intent, type BrainV1SessionMemory } from './types'

export class SessionState {
  private memory: BrainV1SessionMemory

  constructor(sessionId = `brain-v1-${Date.now()}`) {
    this.memory = {
      sessionId,
      startedAt: new Date().toISOString(),
      lastIntent: null,
      entities: emptyBrainV1Entities(),
    }
  }

  getSnapshot(): BrainV1SessionMemory {
    return {
      ...this.memory,
      entities: { ...this.memory.entities, travelDates: { ...this.memory.entities.travelDates }, activities: [...this.memory.entities.activities] },
    }
  }

  updateIntent(intent: BrainV1Intent): void {
    this.memory.lastIntent = intent
  }

  mergeEntities(entities: BrainV1Entities): BrainV1Entities {
    const prev = this.memory.entities
    const merged: BrainV1Entities = {
      ...prev,
      ...entities,
      travelDates: {
        start: entities.travelDates.start ?? prev.travelDates.start,
        end: entities.travelDates.end ?? prev.travelDates.end,
      },
      activities: [...new Set([...prev.activities, ...entities.activities])],
      destination: entities.destination ?? prev.destination,
      origin: entities.origin ?? prev.origin,
      adults: entities.adults ?? prev.adults,
      children: entities.children ?? prev.children,
      infants: entities.infants ?? prev.infants,
      travelerCount: entities.travelerCount ?? prev.travelerCount,
      budget: entities.budget ?? prev.budget,
      cabinClass: entities.cabinClass ?? prev.cabinClass,
      preferredAirline: entities.preferredAirline ?? prev.preferredAirline,
      hotelRating: entities.hotelRating ?? prev.hotelRating,
      starLevel: entities.starLevel ?? prev.starLevel,
      mealPreference: entities.mealPreference ?? prev.mealPreference,
      transportation: entities.transportation ?? prev.transportation,
      language: entities.language ?? prev.language,
      currency: entities.currency ?? prev.currency,
      nationality: entities.nationality ?? prev.nationality,
      visaDestination: entities.visaDestination ?? prev.visaDestination,
      flexibleDates: entities.flexibleDates ?? prev.flexibleDates,
    }
    this.memory.entities = merged
    return merged
  }
}

export function createSessionState(sessionId?: string): SessionState {
  return new SessionState(sessionId)
}
