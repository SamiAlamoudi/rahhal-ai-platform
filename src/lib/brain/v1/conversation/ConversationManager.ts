/**
 * Sprint 85 — Conversation Manager (Value Before Questions).
 *
 * Understand → extract → assume safely → deliver value → ask ≤1 high-impact question.
 * Behind `ai.brain.v1`. No UI / Voice / providers / booking / payments wiring.
 */

import { isBrainV1Enabled } from '../feature'
import { IntentDetector } from '../IntentDetector'
import { SlotFillingEngine } from '../planning/SlotFillingEngine'
import { TravelPlanningEngine } from '../planning/TravelPlanningEngine'
import { emptyTravelPlanSlots, type TravelPlanSlotKey } from '../planning/types'
import { AssumptionEngine } from './AssumptionEngine'
import { ClarificationPolicy, DEFAULT_MAX_QUESTIONS_PER_TURN } from './ClarificationPolicy'
import { ConfidenceEngine } from './ConfidenceEngine'
import { ConversationExplainability } from './ConversationExplainability'
import { ConversationMemoryAdapter } from './ConversationMemoryAdapter'
import { ConversationSummaryBuilder } from './ConversationSummaryBuilder'
import { InterruptHandler } from './InterruptHandler'
import { QuestionGenerator } from './QuestionGenerator'
import { ResponseGenerator } from './ResponseGenerator'
import { pickSingleToolField } from './ToolMissingFields'
import { ValueFirstPlanner } from './ValueFirstPlanner'
import {
  CONVERSATION_MANAGER_VERSION,
  type ConversationAssumption,
  type ConversationDecisionModel,
  type ConversationLifecycleState,
  type ConversationManagerInput,
  type ConversationManagerResult,
  type ConversationQuestion,
  type ConversationSession,
  type ConversationStage,
  type ConversationValueItem,
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
  assumptions?: AssumptionEngine
  valueFirst?: ValueFirstPlanner
  intents?: IntentDetector
  slots?: SlotFillingEngine
}

function now(): string {
  return new Date().toISOString()
}

function newSession(locale: 'ar' | 'en', stage: ConversationStage = 'explore'): ConversationSession {
  const ts = now()
  return {
    sessionId: `conv_${ts.replace(/[^0-9]/g, '').slice(0, 14)}_${Math.random().toString(36).slice(2, 7)}`,
    state: 'idle',
    plan: null,
    goal: null,
    completedSlots: [],
    pendingSlots: [],
    answeredSlots: [],
    assumptions: [],
    turns: [],
    pausedGoalLabel: null,
    previousGoalLabel: null,
    topicStack: [],
    locale,
    stage,
    createdAt: ts,
    updatedAt: ts,
    restartedCount: 0,
  }
}

function completedFromSlots(
  keys: TravelPlanSlotKey[],
  slots: ReturnType<typeof emptyTravelPlanSlots>,
): TravelPlanSlotKey[] {
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
    decision: null,
    assumptions: [],
    value: [],
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
  private readonly assumptionEngine: AssumptionEngine
  private readonly valueFirst: ValueFirstPlanner
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
    this.assumptionEngine = deps.assumptions ?? new AssumptionEngine()
    this.valueFirst = deps.valueFirst ?? new ValueFirstPlanner()
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
    const stage = input.stage ?? input.priorSession?.stage ?? 'explore'
    let session = input.priorSession
      ? this.cloneSession(input.priorSession)
      : newSession(locale, stage)
    session.locale = locale
    session.stage = stage

    if (input.restart || /^(restart|ابدأ من جديد|من جديد)$/i.test(input.text.trim())) {
      const restarted = newSession(locale, stage)
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

    session.turns = [...session.turns, { role: 'user' as const, text: input.text, at: now() }].slice(-40)

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
      session.turns = [...session.turns, { role: 'assistant' as const, text: response[locale], at: now() }]
      return this.finish(session, response, null, null, null, null, null, [], [], [], null)
    }

    const planResult = this.planning.planTurn(
      {
        text: input.text,
        locale,
        priorPlan: session.plan,
        interrupted:
          interruptKind === 'resume'
          || session.state === 'paused'
          || session.state === 'resumed',
      },
      { enabled: true },
    )

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

    // Explicit extractions / revisions become answered (confirmed facts).
    const explicitCompleted = completedFromSlots(allSlotKeys, knownSlots).filter((key) => {
      // Only mark as answered when coming from user text/prior confirmed — not assumptions.
      return planResult.revisedSlots.includes(key)
        || session.answeredSlots.includes(key)
        || Boolean(input.priorSession && completedFromSlots([key], input.priorSession.plan?.knownSlots ?? emptyTravelPlanSlots()).length)
        || (key === 'destination' && Boolean(knownSlots.destination))
        || (key === 'origin' && Boolean(knownSlots.origin) && /from |من /.test(input.text.toLowerCase()))
        || (key === 'dates' && Boolean(knownSlots.dates.start))
        || (key === 'adults' && /adults?|بالغ/i.test(input.text))
        || (key === 'children' && /child|children|أطفال|طفل/i.test(input.text))
        || (key === 'budget' && /budget|ميزانية/i.test(input.text))
    })

    // Destination from first message counts as answered.
    if (knownSlots.destination && !explicitCompleted.includes('destination')) {
      explicitCompleted.push('destination')
    }

    let answeredSlots = [...new Set([...session.answeredSlots, ...explicitCompleted])]

    // Revise assumptions when user corrects travelers/dates/budget/etc.
    let priorAssumptions = session.assumptions
    const markAnswered = (key: TravelPlanSlotKey) => {
      if (!answeredSlots.includes(key)) answeredSlots = [...answeredSlots, key]
    }
    for (const key of planResult.revisedSlots) {
      if (key === 'adults' && knownSlots.adults != null) {
        priorAssumptions = this.assumptionEngine.revise(priorAssumptions, 'adults', knownSlots.adults)
        markAnswered('adults')
      }
      if (key === 'children') {
        priorAssumptions = this.assumptionEngine.revise(priorAssumptions, 'children', knownSlots.children ?? 0)
        markAnswered('children')
      }
      if (key === 'dates' || key === 'flexibleDates') {
        priorAssumptions = this.assumptionEngine.revise(priorAssumptions, 'flexibleDates', true)
        if (knownSlots.dates.start) markAnswered('dates')
      }
      if (key === 'budget' && knownSlots.budget != null) {
        priorAssumptions = this.assumptionEngine.revise(priorAssumptions, 'budgetMode', knownSlots.budget)
        markAnswered('budget')
      }
      if (key === 'origin' && knownSlots.origin) {
        markAnswered('origin')
      }
      if (key === 'destination' && knownSlots.destination) {
        markAnswered('destination')
      }
    }

    const assumptions = this.assumptionEngine.infer({
      slots: knownSlots,
      answered: answeredSlots,
      priorAssumptions,
    })
    const workingSlots = this.assumptionEngine.applyToSlots(knownSlots, assumptions)
    const assumedFields = assumptions.map((a) => a.field)

    const completedSlots = completedFromSlots(allSlotKeys, workingSlots)

    // Planning "missing" plus high-impact explore gaps (origin) even if planning deferred it.
    const missingBase = [...planResult.missing]
    if (
      workingSlots.destination
      && !workingSlots.origin
      && !answeredSlots.includes('origin')
      && !missingBase.includes('origin')
    ) {
      missingBase.push('origin')
    }
    if (
      workingSlots.destination
      && workingSlots.adults == null
      && !assumedFields.includes('adults')
      && !missingBase.includes('adults')
    ) {
      missingBase.push('adults')
    }

    const valueItems = this.valueFirst.canProvideValue(workingSlots)
      ? this.valueFirst.build({
          slots: workingSlots,
          assumptions,
          recommendations: input.recommendations,
        })
      : []

    const confidence = this.confidence.evaluate({
      intent: intentResult.intent === 'unknown' && planResult.goal
        ? { intent: planResult.goal.intent, confidence: planResult.goal.confidence, secondary: [] }
        : intentResult,
      slots: workingSlots,
      completedSlots,
      pendingSlots: missingBase,
      recommendations: input.recommendations,
      ambiguousText: /\b(?:maybe|perhaps|not sure|ربما|مو متأكد|غير متأكد)\b/i.test(input.text),
      hasDestination: Boolean(workingSlots.destination),
      unsafe: stage === 'payment' || stage === 'booking',
    })

    const blockingQuestions: ConversationQuestion[] = (input.blockingFields ?? []).map((b) => ({
      slot: b.field,
      tier: 'blocking' as const,
      priority: 100,
      questionAr: b.questionAr,
      questionEn: b.questionEn,
      whyAr: b.reason,
      whyEn: b.reason,
    }))

    // Tools may report many missing fields — manager keeps at most one candidate.
    const toolFields = input.toolMissingFields ?? []
    const singleTool = pickSingleToolField(toolFields)
    const toolMissing = singleTool ? [singleTool] : []

    const decision = this.clarification.decide({
      missing: missingBase,
      answered: answeredSlots,
      assumedFields,
      stage,
      hasValue: valueItems.length > 0,
      valueItems,
      confidenceBand: confidence.band,
      forceBlockingQuestion: confidence.forceBlockingQuestion || Boolean(input.blockingFields?.length),
      blockingQuestions,
      toolMissingFields: toolMissing,
      maxQuestionsPerTurn: input.maxQuestionsPerTurn ?? DEFAULT_MAX_QUESTIONS_PER_TURN,
    })

    let question: ConversationQuestion | null = decision.blockingQuestion
    if (!question && decision.selectedSlot) {
      question = this.questions.forSlot(decision.selectedSlot, workingSlots)
    }

    // Never exceed budget.
    if ((input.maxQuestionsPerTurn ?? DEFAULT_MAX_QUESTIONS_PER_TURN) <= 0) {
      question = null
    }

    const pendingSlots = decision.pending
    const summary = this.summary.build({
      goalLabel: planResult.goal?.label ?? 'Plan a trip',
      intentLabel: intent,
      slots: knownSlots,
      remaining: pendingSlots,
      recommendations: input.recommendations,
    })

    const explanation = this.explainability.explain({
      question,
      recommendation: valueItems[0]?.detailEn ?? input.recommendations?.[0] ?? null,
      missing: pendingSlots,
    })

    const decisionModel: ConversationDecisionModel = {
      goalUnderstanding: planResult.goal?.label ?? `Intent=${intent}`,
      value: valueItems,
      assumptions,
      question,
      questionReason: question?.whyEn ?? decision.skipReason,
      confidence: confidence.overall,
      requiresConfirmationBeforeAction: assumptions.some((a) => a.requiresConfirmationBeforeBooking)
        || stage === 'booking'
        || stage === 'payment',
      nextBestAction: this.valueFirst.nextBestAction(Boolean(question), workingSlots.destination),
    }

    const hadPriorPlan = Boolean(input.priorSession?.plan)
    let state: ConversationLifecycleState = interruptApplied.state
    if (interruptKind === 'resume') state = 'resumed'
    else if (interruptKind === 'topic_switch') state = 'topic_switch'
    else if (valueItems.length > 0) state = 'value_first'
    else if (hadPriorPlan && planResult.revisedSlots.length > 0) state = 'revising'
    else if (question) state = 'waiting_user'
    else if (input.recommendations?.length) state = 'summarizing'
    else state = 'ready'

    if (session.state === 'restarted' && !planResult.plan) state = 'greeting'

    const response = this.responses.generate({
      locale,
      state,
      question,
      summary,
      revisedSlots: planResult.revisedSlots,
      destination: workingSlots.destination,
      confidence,
      resumed: interruptKind === 'resume' || state === 'resumed',
      topicSwitch: interruptKind === 'topic_switch',
      previousGoal: session.previousGoalLabel,
      recommendations: input.recommendations,
      valueItems,
      assumptions,
      decision: decisionModel,
    })

    // Persist confirmed slots only (not assumed values) on the plan snapshot.
    session = {
      ...session,
      state,
      assumptions,
      plan: planResult.plan
        ? {
            ...planResult.plan,
            knownSlots,
            missingSlots: pendingSlots.filter((p): p is TravelPlanSlotKey =>
              [
                'origin',
                'destination',
                'dates',
                'flexibleDates',
                'adults',
                'children',
                'cabin',
                'budget',
                'hotelPreference',
                'transportation',
                'activities',
                'visa',
                'language',
                'currency',
                'specialRequests',
              ].includes(String(p))
            ),
            nextQuestion: question && this.isPlanSlot(question.slot)
              ? {
                  slot: question.slot as TravelPlanSlotKey,
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
    session.turns = [...session.turns, { role: 'assistant' as const, text: response[locale], at: now() }]

    return this.finish(
      session,
      response,
      question,
      summary,
      confidence,
      explanation,
      decisionModel,
      assumptions,
      valueItems,
      planResult.revisedSlots,
      intent,
    )
  }

  private isPlanSlot(slot: TravelPlanSlotKey | string): slot is TravelPlanSlotKey {
    return [
      'origin',
      'destination',
      'dates',
      'flexibleDates',
      'adults',
      'children',
      'cabin',
      'budget',
      'hotelPreference',
      'transportation',
      'activities',
      'visa',
      'language',
      'currency',
      'specialRequests',
    ].includes(String(slot))
  }

  private finish(
    session: ConversationSession,
    response: ConversationManagerResult['response'],
    question: ConversationManagerResult['question'],
    summary: ConversationManagerResult['summary'],
    confidence: ConversationManagerResult['confidence'],
    explanation: ConversationManagerResult['explanation'],
    decision: ConversationDecisionModel | null,
    assumptions: ConversationAssumption[],
    value: ConversationValueItem[],
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
      decision,
      assumptions,
      value,
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
      assumptions: prior.assumptions.map((a) => ({ ...a })),
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
