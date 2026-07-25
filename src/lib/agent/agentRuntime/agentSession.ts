/**
 * Phase 6 — AgentSession
 * Holds synchronized conversation / voice / execution / memory state across turns.
 */

import type { LiveTravelMemory } from '../conversationIntelligence'
import { createEmptyLiveTravelMemory } from '../conversationIntelligence'
import type { SyncedRuntimeState, VoiceRuntimeState } from './types'

export class AgentSession {
  readonly sessionId: string
  private memory: LiveTravelMemory
  private voice: VoiceRuntimeState = 'idle'
  private executionPhase: SyncedRuntimeState['executionPhase'] = 'idle'
  private turn = 0

  constructor(sessionId: string, initial?: LiveTravelMemory | null) {
    this.sessionId = sessionId
    this.memory = initial ?? createEmptyLiveTravelMemory()
  }

  getTurn(): number {
    return this.turn
  }

  nextTurn(): number {
    this.turn += 1
    return this.turn
  }

  getMemory(): LiveTravelMemory {
    return {
      ...this.memory,
      cities: [...this.memory.cities],
      hotelPreferences: [...this.memory.hotelPreferences],
      flightPreferences: [...this.memory.flightPreferences],
      airlines: [...this.memory.airlines],
      activities: [...this.memory.activities],
      specialRequests: [...this.memory.specialRequests],
      travelers: { ...this.memory.travelers },
    }
  }

  replaceMemory(memory: LiveTravelMemory): void {
    this.memory = this.cloneMemory(memory)
  }

  setVoice(state: VoiceRuntimeState): void {
    this.voice = state
  }

  setExecutionPhase(phase: SyncedRuntimeState['executionPhase']): void {
    this.executionPhase = phase
  }

  sync(conversation: SyncedRuntimeState['conversation']): SyncedRuntimeState {
    return {
      conversation,
      voice: this.voice,
      executionPhase: this.executionPhase,
      memory: this.getMemory(),
    }
  }

  private cloneMemory(memory: LiveTravelMemory): LiveTravelMemory {
    return {
      ...memory,
      cities: [...memory.cities],
      hotelPreferences: [...memory.hotelPreferences],
      flightPreferences: [...memory.flightPreferences],
      airlines: [...memory.airlines],
      activities: [...memory.activities],
      specialRequests: [...memory.specialRequests],
      travelers: { ...memory.travelers },
    }
  }
}
