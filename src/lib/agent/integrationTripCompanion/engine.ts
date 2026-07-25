/**
 * Integration Sprint 7 — Live Trip Companion engine.
 */

import type { AgentLocale, AgentMemory, TripPlan } from '../types'
import { isIntegrationTripCompanionEnabled } from './feature'
import { createTripSession } from './session'
import { buildTravelTimeline, seedEventsFromPlan } from './timeline'
import { buildCompanionNotifications } from './notifications'
import { detectCompanionDisruption, replanTimeline } from './replan'
import { buildCompanionLocationLayer } from './location'
import { buildEmergencySupport, detectEmergencyKind } from './emergency'
import { buildCompanionContextMemory } from './contextMemory'
import { detectCompanionAssistantIntent } from './assistant'
import { buildTripCompanionSummary } from './consultant'
import {
  INTEGRATION_TRIP_COMPANION_VERSION,
  type CompanionTimelineEvent,
  type TripCompanionResult,
  type TripSessionState,
} from './types'

export interface TripCompanionDeps {
  enabled?: boolean
  now?: Date
  forcedState?: TripSessionState | null
  seedEvents?: CompanionTimelineEvent[] | null
}

export interface RunTripCompanionInput {
  memory: AgentMemory
  tripPlan?: TripPlan | null
  userText?: string | null
  locale?: AgentLocale
  deps?: TripCompanionDeps
}

function disabled(latencyMs: number): TripCompanionResult {
  return {
    version: INTEGRATION_TRIP_COMPANION_VERSION,
    enabled: false,
    ok: false,
    session: null,
    timeline: null,
    notifications: [],
    disruptions: [],
    replanned: false,
    location: null,
    emergency: null,
    context: null,
    assistantIntent: 'unknown',
    consultantSummaryAr: '',
    consultantSummaryEn: '',
    latencyMs,
    logs: ['trip_companion_disabled'],
  }
}

export async function runTripCompanion(
  input: RunTripCompanionInput,
): Promise<TripCompanionResult> {
  const started = Date.now()
  const enabled = isIntegrationTripCompanionEnabled({ enabled: input.deps?.enabled })
  if (!enabled) return disabled(Date.now() - started)

  const now = input.deps?.now ?? new Date()
  const plan = input.tripPlan ?? input.memory.tripPlan
  const userText = input.userText ?? ''
  const logs: string[] = ['trip_companion_enabled']

  const disruption = detectCompanionDisruption(userText)
  const emergencyKind = detectEmergencyKind(userText)
  const assistantIntent = detectCompanionAssistantIntent(userText)
  const meetingMode = assistantIntent === 'status'
    ? /meeting|اجتماع/i.test(userText)
    : /meeting|اجتماع/i.test(userText)

  const session = createTripSession({
    plan,
    now,
    forcedState: input.deps?.forcedState,
    disruption: disruption?.kind ?? userText,
    meetingMode,
  })
  logs.push(`session:${session.state}`)

  let workingEvents: CompanionTimelineEvent[] = input.deps?.seedEvents?.slice()
    ?? (plan ? seedEventsFromPlan(plan, now) : [])
  let skippedEventIds: string[] = []
  let replanned = false
  const disruptions = disruption ? [disruption] : []

  if (disruption && workingEvents.length) {
    const replannedResult = replanTimeline(workingEvents, disruption)
    workingEvents = replannedResult.events
    skippedEventIds = replannedResult.skippedEventIds
    replanned = true
    logs.push(`replan:${disruption.kind}`)
  }

  const timeline = buildTravelTimeline({
    plan,
    now,
    sessionState: session.state,
    skippedEventIds,
    events: workingEvents.length ? workingEvents : null,
  })

  const notifications = buildCompanionNotifications({
    events: workingEvents,
    sessionState: session.state,
    now,
  })
  logs.push(`notifications:${notifications.length}`)

  const location = buildCompanionLocationLayer(plan)
  const emergency = emergencyKind ? buildEmergencySupport(emergencyKind) : null
  if (emergency) logs.push(`emergency:${emergency.kind}`)

  const context = buildCompanionContextMemory({
    memory: input.memory,
    plan,
    sessionState: session.state,
    timeline,
  })

  const summary = buildTripCompanionSummary({
    session,
    timeline,
    notifications,
    disruptions,
    replanned,
    context,
    location,
    emergency,
    assistantIntent,
  })

  return {
    version: INTEGRATION_TRIP_COMPANION_VERSION,
    enabled: true,
    ok: Boolean(plan) || Boolean(emergency) || assistantIntent !== 'unknown',
    session,
    timeline,
    notifications,
    disruptions,
    replanned,
    location,
    emergency,
    context,
    assistantIntent,
    consultantSummaryAr: summary.ar,
    consultantSummaryEn: summary.en,
    latencyMs: Date.now() - started,
    logs,
  }
}
