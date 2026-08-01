/**
 * Sprint 82 — SessionState (Brain v1).
 * Holds entities + planner state for recovery / continuation (in-memory only).
 */

import {
  emptyBrainV1Entities,
  emptyPlannerState,
  type BrainV1Entities,
  type BrainV1Intent,
  type BrainV1PlannerState,
  type BrainV1SessionMemory,
} from './types'

export class SessionState {
  private memory: BrainV1SessionMemory

  constructor(sessionId = `brain-v1-${Date.now()}`, prior?: BrainV1SessionMemory) {
    if (prior) {
      this.memory = {
        sessionId: prior.sessionId || sessionId,
        startedAt: prior.startedAt,
        lastIntent: prior.lastIntent,
        entities: {
          ...emptyBrainV1Entities(),
          ...prior.entities,
          travelDates: {
            start: prior.entities.travelDates?.start ?? null,
            end: prior.entities.travelDates?.end ?? null,
          },
          activities: [...(prior.entities.activities ?? [])],
        },
        plannerState: prior.plannerState
          ? { ...prior.plannerState, steps: [...prior.plannerState.steps] }
          : null,
        interruptedAt: prior.interruptedAt,
      }
      return
    }

    this.memory = {
      sessionId,
      startedAt: new Date().toISOString(),
      lastIntent: null,
      entities: emptyBrainV1Entities(),
      plannerState: null,
      interruptedAt: null,
    }
  }

  getSnapshot(): BrainV1SessionMemory {
    return {
      ...this.memory,
      entities: {
        ...this.memory.entities,
        travelDates: { ...this.memory.entities.travelDates },
        activities: [...this.memory.entities.activities],
      },
      plannerState: this.memory.plannerState
        ? {
            ...this.memory.plannerState,
            completedSteps: [...this.memory.plannerState.completedSteps],
            remainingSteps: [...this.memory.plannerState.remainingSteps],
            steps: this.memory.plannerState.steps.map((s) => ({ ...s })),
          }
        : null,
    }
  }

  updateIntent(intent: BrainV1Intent): void {
    this.memory.lastIntent = intent
  }

  setPlannerState(state: BrainV1PlannerState): void {
    this.memory.plannerState = state
  }

  markInterrupted(): void {
    this.memory.interruptedAt = new Date().toISOString()
    if (this.memory.plannerState) {
      this.memory.plannerState = {
        ...this.memory.plannerState,
        interrupted: true,
        resumed: false,
      }
    } else {
      this.memory.plannerState = {
        ...emptyPlannerState(),
        interrupted: true,
      }
    }
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

export function createSessionState(
  sessionId?: string,
  prior?: BrainV1SessionMemory,
): SessionState {
  return new SessionState(sessionId, prior)
}
