/**
 * Sprint 33 — booking Travel Execution Engine.
 * Distinct from Sprint 23 `src/lib/brain/execution` (search tasks).
 */

import { ExecutionError } from './ExecutionErrors'
import { isTravelExecutionEngineEnabled } from './ExecutionFeatureFlags'
import {
  ExecutionCoordinator,
  type TravelExecutionEngineOptions,
} from './ExecutionCoordinator'
import type {
  BookingSessionRecord,
  CreateExecutionSessionInput,
  ExecutionMetricsSnapshot,
  ExecutionResult,
  ExecutionSummary,
} from './ExecutionTypes'

export type { TravelExecutionEngineOptions }

export class TravelExecutionEngine {
  private readonly coordinator: ExecutionCoordinator
  private readonly forceEnabled: boolean | undefined

  constructor(options: TravelExecutionEngineOptions = {}) {
    this.coordinator = new ExecutionCoordinator(options)
    this.forceEnabled = options.enabled
  }

  isEnabled(): boolean {
    if (typeof this.forceEnabled === 'boolean') return this.forceEnabled
    return isTravelExecutionEngineEnabled()
  }

  createBookingSession(input: CreateExecutionSessionInput): BookingSessionRecord {
    this.assertEnabled()
    return this.coordinator.createBookingSession(input)
  }

  async execute(input: CreateExecutionSessionInput): Promise<ExecutionResult> {
    this.assertEnabled()
    return this.coordinator.execute(input)
  }

  async executeSession(sessionId: string): Promise<ExecutionResult> {
    this.assertEnabled()
    return this.coordinator.executeSession(sessionId)
  }

  async retry(sessionId: string): Promise<ExecutionResult> {
    this.assertEnabled()
    return this.coordinator.retry(sessionId)
  }

  cancel(sessionId: string, reason?: string): BookingSessionRecord {
    this.assertEnabled()
    return this.coordinator.cancel(sessionId, reason)
  }

  getSession(sessionId: string): BookingSessionRecord {
    return this.coordinator.getSession(sessionId)
  }

  getSummary(sessionId: string): ExecutionSummary | null {
    return this.coordinator.getSummary(sessionId)
  }

  getMetricsSnapshot(): ExecutionMetricsSnapshot {
    return this.coordinator.getMetricsSnapshot()
  }

  getCoordinator(): ExecutionCoordinator {
    return this.coordinator
  }

  private assertEnabled(): void {
    if (!this.isEnabled()) {
      throw new ExecutionError(
        'FEATURE_DISABLED',
        'Travel Execution Engine is disabled (brain.travel_execution_engine)',
      )
    }
  }
}

export function createTravelExecutionEngine(
  options?: TravelExecutionEngineOptions,
): TravelExecutionEngine {
  return new TravelExecutionEngine(options)
}
