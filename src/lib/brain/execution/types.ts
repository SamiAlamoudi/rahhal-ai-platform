/**
 * Sprint 23 — Travel Execution Engine types.
 * Converts Sprint 22 TripPlan into executable search tasks (no live APIs).
 */

import type { TripPlan as EngineTripPlan } from '../tripPlanning/types'

export type ExecutionTaskType =
  | 'flight_search'
  | 'hotel_search'
  | 'transport_search'
  | 'activities_search'
  | 'package_search'

export type ExecutionTaskStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'skipped'
  | 'timed_out'

export type ExecutionState =
  | 'idle'
  | 'building'
  | 'running'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'partial'

export interface ExecutionTask {
  id: string
  type: ExecutionTaskType
  priority: number
  dependencies: string[]
  status: ExecutionTaskStatus
  retryCount: number
  maxRetries: number
  timeoutMs: number
  estimatedDurationMs: number
  metadata: ExecutionTaskMetadata
  startedAt: string | null
  finishedAt: string | null
  error: string | null
}

export interface ExecutionTaskMetadata {
  destination: string | null
  departureCity: string | null
  startDate: string | null
  endDate: string | null
  adults: number | null
  children: number | null
  infants: number | null
  cabinClass: string | null
  budgetAmount: number | null
  currency: string | null
  preferredAirlines: string[]
  preferredHotels: string[]
  activities: string[]
  notes: string | null
  tripPlanId: string
  label: string
}

export interface ExecutionPlan {
  id: string
  conversationId: string
  tripPlanId: string
  state: ExecutionState
  tasks: ExecutionTask[]
  createdAt: string
  updatedAt: string
  cancelled: boolean
}

export interface ExecutionResult {
  taskId: string
  type: ExecutionTaskType
  status: ExecutionTaskStatus
  success: boolean
  durationMs: number
  retryCount: number
  data: unknown
  error: string | null
  providerId: string
}

export interface ExecutionProgress {
  total: number
  completed: number
  failed: number
  cancelled: number
  skipped: number
  running: number
  pending: number
  /** 0–1 */
  ratio: number
  currentTaskId: string | null
}

export interface ExecutionSummary {
  planId: string
  state: ExecutionState
  progress: ExecutionProgress
  results: ExecutionResult[]
  successfulTypes: ExecutionTaskType[]
  failedTypes: ExecutionTaskType[]
  partialSuccess: boolean
  durationMs: number
  headline: string
}

export interface TravelExecutionTurnResult {
  plan: ExecutionPlan
  summary: ExecutionSummary
  results: ExecutionResult[]
  progress: ExecutionProgress
  state: ExecutionState
}

export interface TravelExecutionEngineOptions {
  conversationId?: string
  /** Injected providers (defaults to mocks). */
  providers?: Partial<ExecutionProviderBundle>
  /** Max retries per task (default 1). */
  maxRetries?: number
  /** Default task timeout ms (default 2000). */
  defaultTimeoutMs?: number
  /** Prefer parallel waves when dependencies allow (still parallel-safe). */
  parallelSafe?: boolean
}

export interface ExecutionProviderBundle {
  flights: FlightProvider
  hotels: HotelProvider
  transport: TransportProvider
  activities: ActivitiesProvider
  packages: PackageProvider
}

export interface ProviderSearchContext {
  task: ExecutionTask
  tripPlan: EngineTripPlan
  signal?: AbortSignal
}

export interface FlightProvider {
  readonly id: string
  search(ctx: ProviderSearchContext): Promise<FlightSearchPayload>
}

export interface HotelProvider {
  readonly id: string
  search(ctx: ProviderSearchContext): Promise<HotelSearchPayload>
}

export interface TransportProvider {
  readonly id: string
  search(ctx: ProviderSearchContext): Promise<TransportSearchPayload>
}

export interface ActivitiesProvider {
  readonly id: string
  search(ctx: ProviderSearchContext): Promise<ActivitiesSearchPayload>
}

export interface PackageProvider {
  readonly id: string
  search(ctx: ProviderSearchContext): Promise<PackageSearchPayload>
}

export interface FlightSearchPayload {
  kind: 'flights'
  offers: Array<{
    id: string
    from: string
    to: string
    airline: string
    cabin: string
    price: number
    currency: string
    stops: number
  }>
  /** true for mock adapters; false for real/production-shaped adapters. */
  mock: boolean
}

export interface HotelSearchPayload {
  kind: 'hotels'
  offers: Array<{
    id: string
    name: string
    area: string
    stars: number
    nightly: number
    currency: string
  }>
  mock: boolean
}

export interface TransportSearchPayload {
  kind: 'transport'
  offers: Array<{
    id: string
    mode: string
    from: string
    to: string
    price: number
    currency: string
  }>
  mock: boolean
}

export interface ActivitiesSearchPayload {
  kind: 'activities'
  offers: Array<{
    id: string
    title: string
    category: string
    price: number
    currency: string
  }>
  mock: boolean
}

export interface PackageSearchPayload {
  kind: 'packages'
  offers: Array<{
    id: string
    title: string
    includes: string[]
    price: number
    currency: string
  }>
  mock: boolean
}

/** Product alias — contracts layer uses ActivityProvider; brain keeps ActivitiesProvider. */
export type ActivityProvider = ActivitiesProvider
