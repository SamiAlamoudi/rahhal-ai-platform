/**
 * Sprint 23 — convert Sprint 22 TripPlan into ExecutionTasks.
 */

import type { TripPlan as EngineTripPlan } from '../tripPlanning/types'
import type {
  ExecutionPlan,
  ExecutionTask,
  ExecutionTaskMetadata,
  ExecutionTaskType,
} from './types'

function nowIso(): string {
  return new Date().toISOString()
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function baseMeta(tripPlan: EngineTripPlan): Omit<ExecutionTaskMetadata, 'label'> {
  return {
    destination: tripPlan.destination,
    departureCity: tripPlan.departureCity,
    startDate: tripPlan.travelDates.startDate,
    endDate: tripPlan.travelDates.endDate,
    adults: tripPlan.adults,
    children: tripPlan.children,
    infants: tripPlan.infants,
    cabinClass: tripPlan.cabinClass,
    budgetAmount: tripPlan.budget.amount,
    currency: tripPlan.budget.currency,
    preferredAirlines: [...tripPlan.airlinePreferences],
    preferredHotels: [...tripPlan.hotelPreferences],
    activities: [...tripPlan.activities],
    notes: tripPlan.notes,
    tripPlanId: tripPlan.id,
  }
}

function makeTask(input: {
  type: ExecutionTaskType
  priority: number
  dependencies: string[]
  tripPlan: EngineTripPlan
  timeoutMs: number
  maxRetries: number
  estimatedDurationMs: number
  label: string
}): ExecutionTask {
  return {
    id: newId(input.type),
    type: input.type,
    priority: input.priority,
    dependencies: [...input.dependencies],
    status: 'pending',
    retryCount: 0,
    maxRetries: input.maxRetries,
    timeoutMs: input.timeoutMs,
    estimatedDurationMs: input.estimatedDurationMs,
    metadata: { ...baseMeta(input.tripPlan), label: input.label },
    startedAt: null,
    finishedAt: null,
    error: null,
  }
}

/**
 * Build executable tasks from a TripPlan.
 *
 * Pipeline dependency graph:
 *   FlightSearchTask
 *     → HotelSearchTask
 *     → TransportSearchTask
 *     → ActivitiesSearchTask
 *     → PackageSearchTask (depends on flight + hotel)
 */
export function buildExecutionTasksFromTripPlan(
  tripPlan: EngineTripPlan,
  options?: { maxRetries?: number; defaultTimeoutMs?: number },
): ExecutionTask[] {
  const maxRetries = options?.maxRetries ?? 1
  const timeoutMs = options?.defaultTimeoutMs ?? 2000

  const flight = makeTask({
    type: 'flight_search',
    priority: 100,
    dependencies: [],
    tripPlan,
    timeoutMs,
    maxRetries,
    estimatedDurationMs: 400,
    label: 'FlightSearchTask',
  })

  const hotel = makeTask({
    type: 'hotel_search',
    priority: 90,
    dependencies: [flight.id],
    tripPlan,
    timeoutMs,
    maxRetries,
    estimatedDurationMs: 350,
    label: 'HotelSearchTask',
  })

  const transport = makeTask({
    type: 'transport_search',
    priority: 80,
    dependencies: [flight.id],
    tripPlan,
    timeoutMs,
    maxRetries,
    estimatedDurationMs: 250,
    label: 'TransportSearchTask',
  })

  const activities = makeTask({
    type: 'activities_search',
    priority: 70,
    dependencies: [hotel.id],
    tripPlan,
    timeoutMs,
    maxRetries,
    estimatedDurationMs: 300,
    label: 'ActivitiesSearchTask',
  })

  const pkg = makeTask({
    type: 'package_search',
    priority: 60,
    dependencies: [flight.id, hotel.id],
    tripPlan,
    timeoutMs,
    maxRetries,
    estimatedDurationMs: 450,
    label: 'PackageSearchTask',
  })

  // Skip hotel/activities/package when flights-only signals present.
  const flightsOnly =
    tripPlan.notes?.includes('flights_only') ||
    (tripPlan.transportation.includes('flight') &&
      tripPlan.hotelPreferences.length === 0 &&
      !tripPlan.roomRequirements)

  if (flightsOnly) {
    hotel.status = 'skipped'
    activities.status = 'skipped'
    pkg.status = 'skipped'
  }

  return [flight, hotel, transport, activities, pkg]
}

export function createExecutionPlan(input: {
  conversationId: string
  tripPlan: EngineTripPlan
  tasks: ExecutionTask[]
}): ExecutionPlan {
  const now = nowIso()
  return {
    id: newId('exec_plan'),
    conversationId: input.conversationId,
    tripPlanId: input.tripPlan.id,
    state: 'building',
    tasks: input.tasks.map((t) => ({ ...t, dependencies: [...t.dependencies] })),
    createdAt: now,
    updatedAt: now,
    cancelled: false,
  }
}
