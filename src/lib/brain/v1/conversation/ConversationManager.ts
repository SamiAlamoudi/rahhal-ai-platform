/**
 * Sprint 85 — Conversation Manager.
 *
 * Sits between Brain and traveler. Maintains conversation state, slots,
 * resume/restart, plan revision hooks, natural responses — before any
 * real provider integration.
 *
 * Behind `ai.brain.v1`. No UI / Voice / providers / booking / payments.
 */

import { isBrainV1Enabled } from '../feature'
import { IntentDetector } from '../IntentDetector'
import { SlotFillingEngine } from '../planning/SlotFillingEngine'
import { TravelPlanningEngine } from '../planning/TravelPlanningEngine'
import { emptyTravelPlanSlots, type TravelPlanSlotKey } from '../planning/types'
import { ClarificationPolicy } from './ClarificationPolicy'
import { ConfidenceEngine } from './ConfidenceEngine'
import { ConversationExplainability } from './ConversationExplainability'
import { ConversationMemoryAdapter } from './ConversationMemoryAdapter'
import { ConversationSummaryBuilder } from './ConversationSummaryBuilder'
import { InterruptHandler } from './InterruptHandler'
import { QuestionGenerator } from './QuestionGenerator'
import { ResponseGenerator } from './ResponseGenerator'
import {
  CONVERSATION_MANAGER_VERSION,
  type ConversationLifecycleState,
  type ConversationManagerInput,
  type ConversationManagerResult,
  type ConversationSession,
  type ConversationTurnRecord,
} from './types'

export type ConversationManagerDeps = {
  enabled?: boolean
  planning?: TravelPlanningEngine
  questions?: QuestionGenerator
  responses?: ResponseGenerator
  confidence?: ConfidenceEngine
  clarification?: ClarificationPolicy
  interrupts?: InterruptHandler
  memory?: ConversationMemoryAdapter
  summary?: ConversationSummaryBuilder
  explainability?: ConversationExplainability
  intents?: IntentDetector
  slots?: SlotFillingEngine
}

function now(): string {
  return new Date().toISOString()
}

function newSession(locale: 'ar' | 'en'): ConversationSession {
  const ts = now()
  return {
    sessionId: `conv_${ts.replace(/[^0-9]/g, '').slice(0, 14)}_${Math.random().toString(36).slice(2, 7)}`,
    state: 'idle',
    plan: null,
    goal: null,
    completedSlots: [],
    pendingSlots: [],
    answeredSlots: [],
    turns: [],
    pausedGoalLabel: null,
    previousGoalLabel: null,
    topicStack: [],
    locale,
    createdAt: ts,
    updatedAt: ts,
    restartedCount: 0,
  }
}

function completedFromSlots(keys: TravelPlanSlotKey[], slots: ReturnType<typeof emptyTravelPlanSlots>): TravelPlanSlotKey[] {
  return keys.filter((key) => {
    if (key === 'dates') return Boolean(slots.dates.start || slots.flexibleDates)
    if (key === 'activities') return slots.activities.length > 0
    if (key === 'adults' || key === 'children' || key === 'budget') return slots[key] != null
    if (key === 'flexibleDates') return slots.flexibleDates != null
    return Boolean(slots[key])
  })
}

function disabledResult(): ConversationManagerResult {
  return {
    version: CONVERSATION_MANAGER_VERSION,
    enabled: false,
    session: null,
    response: null,
    question: null,
    summary: null,
    confidence: null,
    explanation: null,
    revisedSlots: [],
    knownSlots: null,
    intent: null,
  }
}

export class ConversationManager {
  private readonly planning: TravelPlanningEngine
  private readonly questions: QuestionGenerator
  private readonly responses: ResponseGenerator
  private readonly confidence: ConfidenceEngine
  private readonly clarification: ClarificationPolicy
  private readonly interrupts: InterruptHandler
  private readonly memory: ConversationMemoryAdapter
  private readonly summary: ConversationSummaryBuilder
  private readonly explainability: ConversationExplainability
  private readonly intents: IntentDetector
  private readonly slotsEngine: SlotFillingEngine

  constructor(deps: ConversationManagerDeps = {}) {
    this.planning = deps.planning ?? new TravelPlanningEngine()
    this.questions = deps.questions ?? new QuestionGenerator()
    this.responses = deps.responses ?? new ResponseGenerator()
    this.confidence = deps.confidence ?? new ConfidenceEngine()
    this.clarification = deps.clarification ?? new ClarificationPolicy()
    this.interrupts = deps.interrupts ?? new InterruptHandler()
    this.memory = deps.memory ?? new ConversationMemoryAdapter()
    this.summary = deps.summary ?? new ConversationSummaryBuilder()
    this.explainability = deps.explainability ?? new ConversationExplainability()
    this.intents = deps.intents ?? new IntentDetector()
    this.slotsEngine = deps.slots ?? new SlotFillingEngine()
  }

  turn(
    input: ConversationManagerInput,
    deps: { enabled?: boolean } = {},
  ): ConversationManagerResult {
    if (!isBrainV1Enabled({ enabled: deps.enabled })) {
      return disabledResult()
    }

    const locale = input.locale ?? input.priorSession?.locale ?? 'ar'
    let session = input.priorSession
      ? this.cloneSession(input.priorSession)
      : newSession(locale)
    session.locale = locale

    if (input.restart || /^(restart|ابدأ من جديد|من جديد)$/i.test(input.text.trim())) {
      const restarted = newSession(locale)
      restarted.restartedCount = session.restartedCount + 1
      restarted.state = 'restarted'
      session = restarted
    }

    const mem = this.memory.read({ preferenceMemory: input.preferenceMemory })
    const interruptKind = this.interrupts.detect(input.text, {
      pause: input.pause,
      resume: input.resume,
    })

    const interruptApplied = this.interrupts.apply(session, interruptKind)
    session = interruptApplied.session

    const userTurn: ConversationTurnRecord = {
      role: 'user',
      text: input.text,
      at: now(),
    }
    session.turns = [...session.turns, userTurn].slice(-40)

    // Pause short-circuit (keep slots).
    if (interruptKind === 'pause') {
      const response = this.responses.generate({
        locale,
        state: 'paused',
        question: null,
        summary: null,
        revisedSlots: [],
        paused: true,
      })
      session.state = 'paused'
      session.updatedAt = now()
      session.turns = [...session.turns, { role: 'assistant', text: response[locale], at: now() }]
      return this.result(session, response, null, null, null, null, [], session.plan?.goal.intent ?? null)
    }

    // Planning turn (slot fill + revision via TravelPlanningEngine).
    const planResult = this.planning.planTurn(
      {
        text: input.text,
        locale,
        priorPlan: session.plan,
        interrupted: interruptKind === 'resume' || session.state === 'paused' || session.state === 'resumed',
      },
      { enabled: true },
    )

    // Apply soft memory defaults only for empty slots.
    let knownSlots = planResult.plan?.knownSlots ?? emptyTravelPlanSlots()
    const soft = mem.softSlotDefaults
    knownSlots = this.slotsEngine.merge(knownSlots, {
      ...(knownSlots.cabin || !soft.cabin ? {} : { cabin: soft.cabin }),
      ...(knownSlots.currency || !soft.currency ? {} : { currency: soft.currency }),
      ...(knownSlots.budget != null || soft.budget == null ? {} : { budget: soft.budget }),
      ...(knownSlots.hotelPreference || !soft.hotelPreference
        ? {}
        : { hotelPreference: soft.hotelPreference }),
    })

    const intentResult = this.intents.detect(input.text)
    const intent = planResult.goal?.intent ?? intentResult.intent

    const allSlotKeys: TravelPlanSlotKey[] = [
      'destination',
      'dates',
      'origin',
      'adults',
      'budget',
      'cabin',
      'hotelPreference',
      'children',
      'activities',
      'transportation',
      'currency',
      'language',
      'visa',
      'flexibleDates',
      'specialRequests',
    ]
    const completedSlots = completedFromSlots(allSlotKeys, knownSlots)
    const answeredSlots = [...new Set([...session.answeredSlots, ...planResult.revisedSlots, ...completedSlots])]

    // Required missing from planning engine; never re-ask answered.
    const missingRequired = planResult.missing.filter((s) => !answeredSlots.includes(s))
    let question = this.questions.next(missingRequired, knownSlots, answeredSlots)

    const confidence = this.confidence.evaluate({
      intent: intentResult.intent === 'unknown' && planResult.goal
        ? { intent: planResult.goal.intent, confidence: planResult.goal.confidence, secondary: [] }
        : intentResult,
      slots: knownSlots,
      completedSlots,
      pendingSlots: missingRequired,
      recommendations: input.recommendations,
      ambiguousText: /\b(?:maybe|perhaps|not sure|ربما|مو متأكد|غير متأكد)\b/i.test(input.text),
    })

    const clarified = this.clarification.apply({
      missing: missingRequired,
      answered: answeredSlots,
      question,
      lowConfidence: confidence.needsClarification,
      lowConfidenceSlot: confidence.needsClarification
        ? question?.slot ?? missingRequired[0] ?? null
        : null,
    })
    question = clarified.question
    const pendingSlots = clarified.pending

    const summary = this.summary.build({
      goalLabel: planResult.goal?.label ?? 'Plan a trip',
      intentLabel: intent,
      slots: knownSlots,
      remaining: pendingSlots,
      recommendations: input.recommendations,
    })

    const explanation = this.explainability.explain({
      question,
      recommendation: input.recommendations?.[0] ?? null,
      missing: pendingSlots,
    })

    const hadPriorPlan = Boolean(input.priorSession?.plan)
    let state: ConversationLifecycleState = interruptApplied.state
    if (interruptKind === 'resume') state = 'resumed'
    else if (interruptKind === 'topic_switch') state = 'topic_switch'
    else if (hadPriorPlan && planResult.revisedSlots.length > 0 && pendingSlots.length > 0) {
      state = 'revising'
    } else if (pendingSlots.length > 0) state = question ? 'waiting_user' : 'collecting'
    else if (hadPriorPlan && planResult.revisedSlots.length > 0) state = 'revising'
    else if (input.recommendations?.length) state = 'summarizing'
    else state = 'ready'

    if (session.state === 'restarted' && !planResult.plan) state = 'greeting'

    const response = this.responses.generate({
      locale,
      state,
      question,
      summary,
      revisedSlots: planResult.revisedSlots,
      destination: knownSlots.destination,
      confidence,
      resumed: interruptKind === 'resume' || state === 'resumed',
      topicSwitch: interruptKind === 'topic_switch',
      previousGoal: session.previousGoalLabel,
      recommendations: input.recommendations,
    })

    session = {
      ...session,
      state,
      plan: planResult.plan
        ? {
            ...planResult.plan,
            knownSlots,
            missingSlots: pendingSlots,
            nextQuestion: question
              ? {
                  slot: question.slot,
                  priority: question.priority,
                  questionAr: question.questionAr,
                  questionEn: question.questionEn,
                }
              : null,
          }
        : session.plan,
      goal: planResult.goal ?? session.goal,
      completedSlots,
      pendingSlots,
      answeredSlots,
      updatedAt: now(),
    }
    session.turns = [...session.turns, { role: 'assistant', text: response[locale], at: now() }]

    return this.result(
      session,
      response,
      question,
      summary,
      confidence,
      explanation,
      planResult.revisedSlots,
      intent,
    )
  }

  private result(
    session: ConversationSession,
    response: ConversationManagerResult['response'],
    question: ConversationManagerResult['question'],
    summary: ConversationManagerResult['summary'],
    confidence: ConversationManagerResult['confidence'],
    explanation: ConversationManagerResult['explanation'],
    revisedSlots: TravelPlanSlotKey[],
    intent: ConversationManagerResult['intent'],
  ): ConversationManagerResult {
    return {
      version: CONVERSATION_MANAGER_VERSION,
      enabled: true,
      session,
      response,
      question,
      summary,
      confidence,
      explanation,
      revisedSlots,
      knownSlots: session.plan?.knownSlots ?? null,
      intent,
    }
  }

  private cloneSession(prior: ConversationSession): ConversationSession {
    return {
      ...prior,
      completedSlots: [...prior.completedSlots],
      pendingSlots: [...prior.pendingSlots],
      answeredSlots: [...prior.answeredSlots],
      turns: prior.turns.map((t) => ({ ...t })),
      topicStack: [...prior.topicStack],
      plan: prior.plan
        ? {
            ...prior.plan,
            knownSlots: {
              ...prior.plan.knownSlots,
              dates: { ...prior.plan.knownSlots.dates },
              activities: [...prior.plan.knownSlots.activities],
            },
            missingSlots: [...prior.plan.missingSlots],
            plannerNotes: [...prior.plan.plannerNotes],
            revisions: [...prior.plan.revisions],
            executionSteps: prior.plan.executionSteps.map((s) => ({ ...s })),
            constraints: [...prior.plan.constraints],
          }
        : null,
      goal: prior.goal ? { ...prior.goal } : null,
    }
  }
}

export function createConversationManager(
  deps?: ConversationManagerDeps,
): ConversationManager {
  return new ConversationManager(deps)
}

export function runConversationManagerTurn(
  input: ConversationManagerInput,
  deps: ConversationManagerDeps = {},
): ConversationManagerResult {
  const manager = createConversationManager(deps)
  return manager.turn(input, { enabled: deps.enabled })
}
