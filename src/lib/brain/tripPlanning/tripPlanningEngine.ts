/**
 * Sprint 22 — TripPlanningEngine
 *
 * Stages: Collect → Detect Missing → Clarify → Update Memory → Produce TripPlan
 * Voice and text share this engine via runIntegratedBrainTurn / planTurn.
 * No external AI providers.
 */

import type { BrainLocale } from '../types'
import { applyCollectAndCorrections } from './correctionDetector'
import { buildClarificationPlan } from './clarification'
import {
  detectMissingPlanningFields,
  nextPlanningFieldToAsk,
  planningCompleteness,
} from './missingDetector'
import {
  PlanningSessionApi,
  createPlanningSession,
} from './planningSession'
import { produceTripPlan } from './produceTripPlan'
import { buildTravelSummary } from './travelSummary'
import type {
  PlanningSession,
  PlanningStage,
  TripPlanningEngineOptions,
  TripPlanningTurnResult,
  TripPlan,
} from './types'

const sessions = new Map<string, PlanningSession>()
const lastPlans = new Map<string, TripPlan>()

export function resetTripPlanningSessions(): void {
  sessions.clear()
  lastPlans.clear()
}

export function getPlanningSession(conversationId: string): PlanningSession | null {
  const s = sessions.get(conversationId)
  return s ? PlanningSessionApi.clone(s) : null
}

/**
 * TripPlanningEngine — multi-step planning without restarting on corrections.
 */
export function TripPlanningEngine(options: TripPlanningEngineOptions = {}) {
  const conversationId = options.conversationId ?? `plan_${Math.random().toString(36).slice(2, 8)}`
  let session =
    options.session ??
    sessions.get(conversationId) ??
    createPlanningSession(conversationId, options.locale ?? 'ar')

  if (options.locale) {
    session = PlanningSessionApi.applyPartial(session, { locale: options.locale })
  }
  sessions.set(conversationId, session)

  const runTurn = (input: {
    userText: string
    locale?: BrainLocale
  }): TripPlanningTurnResult => {
    const stagesVisited: PlanningStage[] = []
    const locale = input.locale ?? session.locale

    // Stage 1 — Collect known information (+ natural corrections)
    stagesVisited.push('collect')
    session = PlanningSessionApi.setStage(session, 'collect')
    const collected = applyCollectAndCorrections(session, input.userText, locale)
    session = collected.session
    if (locale) session = PlanningSessionApi.applyPartial(session, { locale })
    const corrections = collected.corrections

    // Stage 4 early path — Update memory after collect (durable session write)
    stagesVisited.push('update_memory')
    session = PlanningSessionApi.setStage(session, 'update_memory')
    sessions.set(conversationId, session)

    // If we already had a complete plan and only corrections applied, regenerate without restart.
    const priorPlan = lastPlans.get(conversationId)
    const hadCompletePlan = priorPlan?.status === 'complete' || session.tripPlanId != null

    // Stage 2 — Detect missing information
    stagesVisited.push('detect_missing')
    session = PlanningSessionApi.setStage(session, 'detect_missing')
    const missing = detectMissingPlanningFields(session)

    // Stage 3 — Generate smallest clarification (exactly one question)
    if (missing.length > 0) {
      stagesVisited.push('clarify')
      session = PlanningSessionApi.setStage(session, 'clarify')
      const clarification = buildClarificationPlan({ session, missing })
      const ask = nextPlanningFieldToAsk(missing)
      if (ask) {
        session = PlanningSessionApi.markAsked(session, [ask])
      }
      sessions.set(conversationId, session)

      // Partial plan snapshot for progress (does not restart)
      const partial = produceTripPlan(session, { partial: true })
      const travelSummary = buildTravelSummary(session)

      return {
        session: PlanningSessionApi.clone(session),
        stage: 'clarify',
        clarification,
        travelSummary,
        tripPlan: partial,
        corrections,
        stagesVisited,
      }
    }

    // Stage 5 — Produce complete TripPlan
    stagesVisited.push('produce_plan')
    session = PlanningSessionApi.setStage(session, 'produce_plan')
    const tripPlan = produceTripPlan(session, { partial: false })
    session = PlanningSessionApi.applyPartial(session, { tripPlanId: tripPlan.id })
    session = PlanningSessionApi.setStage(session, 'complete')
    stagesVisited.push('complete')
    sessions.set(conversationId, session)
    lastPlans.set(conversationId, tripPlan)

    // Corrections after complete: still produce updated plan (no full conversation rebuild)
    if (hadCompletePlan && corrections.length > 0) {
      // already regenerated above from updated session
    }

    const travelSummary = buildTravelSummary(session)
    const clarification = buildClarificationPlan({ session, missing: [] })

    return {
      session: PlanningSessionApi.clone(session),
      stage: 'complete',
      clarification,
      travelSummary,
      tripPlan,
      corrections,
      stagesVisited,
    }
  }

  return {
    getSession: () => PlanningSessionApi.clone(session),
    setSession: (next: PlanningSession) => {
      session = PlanningSessionApi.clone(next)
      sessions.set(conversationId, session)
    },
    getLastTripPlan: () => {
      const p = lastPlans.get(conversationId)
      return p ? { ...p } : null
    },
    runTurn,
    completeness: () => planningCompleteness(session),
  }
}

export type TripPlanningEngineHandle = ReturnType<typeof TripPlanningEngine>
