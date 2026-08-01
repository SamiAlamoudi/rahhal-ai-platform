/**
 * Sprint 84 — Travel Planning Engine.
 *
 * Converts user intent into an executable travel plan **before** any provider call.
 * Behind `ai.brain.v1`. No UI / Voice / providers / booking / planTurn wiring.
 */

import { IntentDetector } from '../IntentDetector'
import { isBrainV1Enabled } from '../feature'
import { ConversationStateMachine } from './ConversationStateMachine'
import { createDefaultExecutionSteps, PlanRevisionEngine } from './PlanRevision'
import { ItinerarySkeletonBuilder } from './ItinerarySkeletonBuilder'
import { PlanningRecovery } from './Recovery'
import { PlanValidator } from './PlanValidator'
import { QuestionPlanner } from './QuestionPlanner'
import { SlotFillingEngine } from './SlotFillingEngine'
import { TravelGoalModel } from './TravelGoalModel'
import {
  TRAVEL_PLANNING_ENGINE_VERSION,
  emptyTravelPlanSlots,
  type TravelPlan,
  type TravelPlanningTurnInput,
  type TravelPlanningTurnResult,
  type TravelPlanSlotKey,
  type TravelPlanSlotValue,
} from './types'

export type TravelPlanningEngineDeps = {
  enabled?: boolean
  intentDetector?: IntentDetector
  slots?: SlotFillingEngine
  questions?: QuestionPlanner
  validator?: PlanValidator
  revision?: PlanRevisionEngine
  recovery?: PlanningRecovery
  itinerary?: ItinerarySkeletonBuilder
  goals?: TravelGoalModel
}

function knownView(
  slots: TravelPlan['knownSlots'],
): Partial<Record<TravelPlanSlotKey, TravelPlanSlotValue>> {
  const out: Partial<Record<TravelPlanSlotKey, TravelPlanSlotValue>> = {}
  if (slots.destination) out.destination = slots.destination
  if (slots.origin) out.origin = slots.origin
  if (slots.dates.start || slots.dates.end) out.dates = { ...slots.dates }
  if (slots.flexibleDates != null) out.flexibleDates = slots.flexibleDates
  if (slots.adults != null) out.adults = slots.adults
  if (slots.children != null) out.children = slots.children
  if (slots.cabin) out.cabin = slots.cabin
  if (slots.budget != null) out.budget = slots.budget
  if (slots.hotelPreference) out.hotelPreference = slots.hotelPreference
  if (slots.transportation) out.transportation = slots.transportation
  if (slots.activities.length) out.activities = [...slots.activities]
  if (slots.visa) out.visa = slots.visa
  if (slots.language) out.language = slots.language
  if (slots.currency) out.currency = slots.currency
  if (slots.specialRequests) out.specialRequests = slots.specialRequests
  return out
}

function disabledResult(): TravelPlanningTurnResult {
  return {
    version: TRAVEL_PLANNING_ENGINE_VERSION,
    enabled: false,
    plan: null,
    goal: null,
    conversationState: null,
    nextQuestion: null,
    known: {},
    missing: [],
    revisedSlots: [],
    recovered: false,
  }
}

export class TravelPlanningEngine {
  private readonly intentDetector: IntentDetector
  private readonly slots: SlotFillingEngine
  private readonly questions: QuestionPlanner
  private readonly validator: PlanValidator
  private readonly revision: PlanRevisionEngine
  private readonly recovery: PlanningRecovery
  private readonly itinerary: ItinerarySkeletonBuilder
  private readonly goals: TravelGoalModel

  constructor(deps: TravelPlanningEngineDeps = {}) {
    this.intentDetector = deps.intentDetector ?? new IntentDetector()
    this.slots = deps.slots ?? new SlotFillingEngine()
    this.questions = deps.questions ?? new QuestionPlanner()
    this.validator = deps.validator ?? new PlanValidator()
    this.revision = deps.revision ?? new PlanRevisionEngine()
    this.recovery = deps.recovery ?? new PlanningRecovery()
    this.itinerary = deps.itinerary ?? new ItinerarySkeletonBuilder()
    this.goals = deps.goals ?? new TravelGoalModel()
  }

  planTurn(
    input: TravelPlanningTurnInput,
    deps: { enabled?: boolean } = {},
  ): TravelPlanningTurnResult {
    if (!isBrainV1Enabled({ enabled: deps.enabled })) {
      return disabledResult()
    }

    const text = input.text.trim()
    const cancelled = /^(cancel|ألغ|الغاء|إلغاء)\b/i.test(text)

    let recovered = false
    let plan: TravelPlan | null = null

    if (this.recovery.shouldResume(input.priorPlan, input.interrupted)) {
      // Interrupted / WaitingUser / Recovered paths get an explicit Recovered marker.
      // Ordinary continuations (revision / slot-fill) reuse the prior plan in place.
      if (
        input.interrupted
        || input.priorPlan!.conversationState === 'WaitingUser'
        || input.priorPlan!.conversationState === 'Recovered'
        || input.priorPlan!.completionStatus === 'incomplete'
      ) {
        plan = this.recovery.recover(input.priorPlan!)
        recovered = true
      } else {
        plan = {
          ...input.priorPlan!,
          knownSlots: {
            ...input.priorPlan!.knownSlots,
            dates: { ...input.priorPlan!.knownSlots.dates },
            activities: [...input.priorPlan!.knownSlots.activities],
          },
          executionSteps: input.priorPlan!.executionSteps.map((s) => ({ ...s })),
          revisions: [...input.priorPlan!.revisions],
          plannerNotes: [...input.priorPlan!.plannerNotes],
          constraints: [...input.priorPlan!.constraints],
        }
      }
    }

    const intentResult = this.intentDetector.detect(text)
    let intent = intentResult.intent
    if (
      plan
      && (intent === 'unknown' || intent === 'general_conversation')
      && intentResult.confidence < 0.75
    ) {
      intent = plan.goal.intent
    }

    const priorSlots = plan?.knownSlots ?? this.slots.createEmpty()
    const patch = this.slots.extract(text, priorSlots)
    const nextSlots = this.slots.merge(priorSlots, patch)
    const changedSlots = plan
      ? this.slots.diff(priorSlots, nextSlots)
      : (Object.keys(patch) as TravelPlanSlotKey[])

    const missing = this.slots.missingRequired(nextSlots)
    const nextQuestion = this.questions.nextQuestion(missing, nextSlots)
    const validation = this.validator.validate(nextSlots, { missingRequired: missing })

    const machine = new ConversationStateMachine(
      plan?.conversationState ?? 'Planning',
    )
    if (recovered) {
      // already Recovered from recovery.recover
      machine.transition('Recovered')
    }
    const conversationState = cancelled
      ? machine.derive({ missingRequired: missing.length, revised: false, recovered, cancelled: true })
      : machine.derive({
          missingRequired: missing.length,
          revised: Boolean(plan) && changedSlots.length > 0,
          recovered,
        })

    const ts = new Date().toISOString()

    if (!plan) {
      const goal = this.goals.create({
        intent,
        destination: nextSlots.destination,
        confidence: intentResult.confidence,
        status: missing.length ? 'waiting_user' : 'ready',
      })
      plan = {
        planId: `plan_${goal.goalId.replace(/^goal_/, '')}`,
        goal,
        constraints: this.buildConstraints(nextSlots),
        knownSlots: nextSlots,
        missingSlots: missing,
        plannerNotes: [
          `Goal: ${goal.label}`,
          missing.length
            ? `Missing: ${missing.join(', ')}`
            : 'All required slots filled',
        ],
        executionSteps: createDefaultExecutionSteps(),
        completionStatus: cancelled
          ? 'cancelled'
          : missing.length
            ? 'incomplete'
            : 'ready_for_providers',
        conversationState,
        revisions: [],
        nextQuestion,
        validation,
        itinerary: missing.length ? null : this.itinerary.build(nextSlots),
        createdAt: ts,
        updatedAt: ts,
      }
      // Mark collect_slots progress.
      plan.executionSteps = plan.executionSteps.map((step) =>
        step.id === 'collect_slots'
          ? { ...step, status: missing.length ? 'ready' : 'done' }
          : step.id === 'build_itinerary' && !missing.length
            ? { ...step, status: 'done' }
            : step,
      )
    } else {
      // Partial revision — never rebuild whole plan.
      plan = this.revision.revise({
        plan,
        nextSlots,
        changedSlots,
        note: changedSlots.length
          ? `Updated affected parts for: ${changedSlots.join(', ')}`
          : 'No slot changes',
      })
      plan = {
        ...plan,
        goal: this.goals.refreshLabel(
          this.goals.update(plan.goal, {
            intent,
            confidence: Math.max(plan.goal.confidence, intentResult.confidence),
            status: cancelled
              ? 'cancelled'
              : missing.length
                ? 'waiting_user'
                : 'ready',
          }),
          nextSlots.destination,
        ),
        constraints: this.buildConstraints(nextSlots),
        missingSlots: missing,
        nextQuestion,
        validation,
        conversationState,
        completionStatus: cancelled
          ? 'cancelled'
          : missing.length
            ? 'incomplete'
            : 'ready_for_providers',
        updatedAt: ts,
      }

      if (!missing.length) {
        plan = {
          ...plan,
          itinerary: this.itinerary.build(nextSlots),
          executionSteps: plan.executionSteps.map((step) => {
            if (step.id === 'collect_slots') return { ...step, status: 'done' }
            if (step.id === 'build_itinerary') return { ...step, status: 'done' }
            return step
          }),
          plannerNotes: [
            ...plan.plannerNotes,
            'Plan ready for providers (providers not called in Sprint 84)',
          ].slice(-20),
        }
      } else {
        plan = {
          ...plan,
          itinerary: null,
          executionSteps: plan.executionSteps.map((step) =>
            step.id === 'collect_slots' ? { ...step, status: 'ready' } : step,
          ),
        }
      }
    }

    return {
      version: TRAVEL_PLANNING_ENGINE_VERSION,
      enabled: true,
      plan,
      goal: plan.goal,
      conversationState: plan.conversationState,
      nextQuestion: plan.nextQuestion,
      known: knownView(plan.knownSlots),
      missing: plan.missingSlots,
      revisedSlots: changedSlots,
      recovered,
    }
  }

  private buildConstraints(slots: ReturnType<SlotFillingEngine['createEmpty']>) {
    const constraints = []
    if (slots.budget != null) {
      constraints.push({
        id: 'budget_max',
        kind: 'budget_max' as const,
        detail: `Max budget ${slots.budget}${slots.currency ? ` ${slots.currency}` : ''}`,
      })
    }
    if (slots.cabin) {
      constraints.push({
        id: 'cabin',
        kind: 'cabin' as const,
        detail: `Cabin preference: ${slots.cabin}`,
      })
    }
    if (slots.hotelPreference) {
      constraints.push({
        id: 'hotel',
        kind: 'hotel' as const,
        detail: `Hotel preference: ${slots.hotelPreference}`,
      })
    }
    if (slots.dates.start) {
      constraints.push({
        id: 'dates',
        kind: 'dates' as const,
        detail: `Travel starting ${slots.dates.start}${slots.dates.end ? ` → ${slots.dates.end}` : ''}`,
      })
    }
    if (slots.adults != null) {
      constraints.push({
        id: 'travelers',
        kind: 'travelers' as const,
        detail: `Adults=${slots.adults}; children=${slots.children ?? 0}`,
      })
    }
    return constraints
  }
}

export function createTravelPlanningEngine(
  deps?: TravelPlanningEngineDeps,
): TravelPlanningEngine {
  return new TravelPlanningEngine(deps)
}

export function runTravelPlanningTurn(
  input: TravelPlanningTurnInput,
  deps: TravelPlanningEngineDeps = {},
): TravelPlanningTurnResult {
  const engine = createTravelPlanningEngine(deps)
  return engine.planTurn(input, { enabled: deps.enabled })
}

/** Convenience empty slots export for tests. */
export { emptyTravelPlanSlots }
