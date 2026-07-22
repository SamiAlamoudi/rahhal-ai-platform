/**
 * Sprint 113 — ExecutionContext
 */

import type {
  ExecutionContextSnapshot,
  OrchestratorInput,
  ProviderStatusKind,
} from './types'

export class ExecutionContext {
  conversationId: string
  userId: string | null
  userProfilePresent: boolean
  memoryAvailable: boolean
  memoryUsed: boolean
  providerStatus: ProviderStatusKind
  featureFlags: ExecutionContextSnapshot['featureFlags']
  startedAt: string
  timing: Record<string, number>
  confidence: number
  errors: string[]
  logs: string[]

  constructor(input: OrchestratorInput, orchestratorEnabled: boolean) {
    this.conversationId =
      input.conversationId?.trim() || `orch_${Date.now()}`
    this.userId = input.userId?.trim() || null
    this.userProfilePresent = false
    this.memoryAvailable = Boolean(this.userId)
    this.memoryUsed = false
    this.providerStatus = input.providerStatus ?? 'unknown'
    this.featureFlags = {
      orchestrator: orchestratorEnabled,
      memory: null,
      tripBuilder: null,
      responseComposer: null,
      concierge: null,
    }
    this.startedAt = new Date().toISOString()
    this.timing = {}
    this.confidence = 0
    this.errors = []
    this.logs = []
  }

  markTiming(key: string, ms: number): void {
    this.timing[key] = ms
  }

  addError(message: string): void {
    this.errors.push(message)
  }

  addLog(message: string): void {
    this.logs.push(message)
  }

  setConfidence(value: number): void {
    this.confidence = Math.max(0, Math.min(1, value))
  }

  snapshot(): ExecutionContextSnapshot {
    return {
      conversationId: this.conversationId,
      userId: this.userId,
      userProfilePresent: this.userProfilePresent,
      memoryAvailable: this.memoryAvailable,
      memoryUsed: this.memoryUsed,
      providerStatus: this.providerStatus,
      featureFlags: { ...this.featureFlags },
      startedAt: this.startedAt,
      timing: { ...this.timing },
      confidence: this.confidence,
      errors: this.errors.slice(),
      logs: this.logs.slice(),
    }
  }
}

export function createExecutionContext(
  input: OrchestratorInput,
  orchestratorEnabled: boolean,
): ExecutionContext {
  return new ExecutionContext(input, orchestratorEnabled)
}
