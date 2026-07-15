/**
 * Phase AF — persistence abstraction (in-memory / mock only).
 * Does not change production database contracts.
 */

import type {
  TripPlannerPipelineEvent,
  TripPlannerResult,
  TripPlannerStage,
  TripPlannerStatus,
} from './models'

export interface PipelineExecutionState {
  executionId: string
  requestId: string
  idempotencyKey: string
  correlationId: string
  stage: TripPlannerStage
  status: TripPlannerStatus | 'running'
  createdAt: string
  updatedAt: string
  cancelled: boolean
}

export interface TripPlannerExecutionRepository {
  getByIdempotencyKey(key: string): PipelineExecutionState | null
  getByExecutionId(id: string): PipelineExecutionState | null
  save(state: PipelineExecutionState): void
  clear(): void
}

export interface TripPlannerEventRepository {
  append(executionId: string, event: TripPlannerPipelineEvent): void
  list(executionId: string): TripPlannerPipelineEvent[]
  clear(): void
}

export interface TripPlannerResultRepository {
  getByIdempotencyKey(key: string): TripPlannerResult | null
  getByRequestId(requestId: string): TripPlannerResult | null
  save(idempotencyKey: string, result: TripPlannerResult): void
  clear(): void
}

export class InMemoryTripPlannerExecutionRepository
  implements TripPlannerExecutionRepository
{
  private readonly byId = new Map<string, PipelineExecutionState>()
  private readonly byKey = new Map<string, string>()

  getByIdempotencyKey(key: string): PipelineExecutionState | null {
    const id = this.byKey.get(key)
    if (!id) return null
    const state = this.byId.get(id)
    return state ? structuredClone(state) : null
  }

  getByExecutionId(id: string): PipelineExecutionState | null {
    const state = this.byId.get(id)
    return state ? structuredClone(state) : null
  }

  save(state: PipelineExecutionState): void {
    const clone = structuredClone(state)
    this.byId.set(clone.executionId, clone)
    this.byKey.set(clone.idempotencyKey, clone.executionId)
  }

  clear(): void {
    this.byId.clear()
    this.byKey.clear()
  }
}

export class InMemoryTripPlannerEventRepository implements TripPlannerEventRepository {
  private readonly events = new Map<string, TripPlannerPipelineEvent[]>()

  append(executionId: string, event: TripPlannerPipelineEvent): void {
    const list = this.events.get(executionId) ?? []
    list.push(structuredClone(event))
    this.events.set(executionId, list)
  }

  list(executionId: string): TripPlannerPipelineEvent[] {
    return structuredClone(this.events.get(executionId) ?? [])
  }

  clear(): void {
    this.events.clear()
  }
}

export class InMemoryTripPlannerResultRepository implements TripPlannerResultRepository {
  private readonly byKey = new Map<string, TripPlannerResult>()
  private readonly byRequest = new Map<string, string>()

  getByIdempotencyKey(key: string): TripPlannerResult | null {
    const result = this.byKey.get(key)
    return result ? structuredClone(result) : null
  }

  getByRequestId(requestId: string): TripPlannerResult | null {
    const key = this.byRequest.get(requestId)
    if (!key) return null
    return this.getByIdempotencyKey(key)
  }

  save(idempotencyKey: string, result: TripPlannerResult): void {
    const clone = structuredClone(result)
    this.byKey.set(idempotencyKey, clone)
    this.byRequest.set(clone.requestId, idempotencyKey)
  }

  clear(): void {
    this.byKey.clear()
    this.byRequest.clear()
  }
}
