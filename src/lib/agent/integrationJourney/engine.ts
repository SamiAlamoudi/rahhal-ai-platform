/**
 * Integration Sprint 12 — JourneyEngine coordinator.
 * One continuous travel journey across existing subsystems.
 */

import type { AgentLocale, AgentMemory, TripPlan } from '../types'
import { isIntegrationJourneyEnabled } from './feature'
import { buildHandoffContext, inferJourneyStage, toJourneyScenario } from './handoff'
import { detectTripScenario } from '../integrationTripOrchestrator/memory'
import { readJourneyMemory, writeJourneyMemory } from './memory'
import { scoreSharedJourneyDecision } from './scoring'
import { buildStageTraces, softActivateStage, stagesBefore } from './stages'
import { buildJourneySummary } from './consultant'
import {
  INTEGRATION_JOURNEY_VERSION,
  type JourneyResult,
  type JourneyScenario,
  type JourneyStageId,
} from './types'

export interface JourneyDeps {
  enabled?: boolean
  userId?: string | null
  conversationId?: string | null
  /** Soft-invoke child modules for the active stage (tests / staged enablement). */
  activateChildren?: boolean
  /** Force scenario label for E2E scenarios. */
  scenario?: JourneyScenario
  /** Force stage for tests. */
  forceStage?: JourneyStageId
  riskHint?: number | null
  mapsMinutes?: number | null
}

export interface RunIntegrationJourneyInput {
  memory: AgentMemory
  tripPlan?: TripPlan | null
  userText?: string | null
  locale?: AgentLocale
  deps?: JourneyDeps
}

export class JourneyEngine {
  private readonly deps: JourneyDeps

  constructor(deps: JourneyDeps = {}) {
    this.deps = deps
  }

  isEnabled(): boolean {
    return isIntegrationJourneyEnabled({ enabled: this.deps.enabled })
  }

  async run(input: RunIntegrationJourneyInput): Promise<JourneyResult> {
    const started = Date.now()
    if (!isIntegrationJourneyEnabled({
      enabled: input.deps?.enabled ?? this.deps.enabled,
    })) {
      return disabled(Date.now() - started)
    }

    const logs = ['journey_enabled']
    const userId = input.deps?.userId ?? this.deps.userId ?? null
    const userText = input.userText?.trim() ?? ''
    const plan = input.tripPlan ?? input.memory.tripPlan
    let journeyMemory = readJourneyMemory(userId)

    const scenario = input.deps?.scenario
      ?? this.deps.scenario
      ?? ( /delay|disrupt|missed connection|تأخر|تعطيل/i.test(userText)
        ? 'disruption_recovery'
        : toJourneyScenario(detectTripScenario(input.memory.requirements)))

    const stage = input.deps?.forceStage
      ?? this.deps.forceStage
      ?? inferJourneyStage({
        userText,
        memory: input.memory,
        journeyMemory,
      })
    logs.push(`stage:${stage}`, `scenario:${scenario}`)

    const activateChildren = Boolean(
      input.deps?.activateChildren ?? this.deps.activateChildren,
    )
    const completed = uniqueStages([
      ...journeyMemory.completedStages,
      ...stagesBefore(stage),
    ])

    const stages = buildStageTraces({
      active: stage,
      completed,
      activateChildren,
    })

    const activation = await softActivateStage({
      stage,
      memory: input.memory,
      tripPlan: plan,
      userText,
      userId,
      activateChildren,
    })
    const activeTrace = stages.find((s) => s.stage === stage)
    if (activeTrace) {
      activeTrace.latencyMs = activation.latencyMs
      activeTrace.note = activation.note
      if (!activation.note.startsWith('skipped:')) {
        activeTrace.status = 'active'
      }
    }
    logs.push(`activate:${activation.note}`)

    const handoff = buildHandoffContext({
      memory: input.memory,
      tripPlan: plan,
      locale: input.locale ?? input.memory.locale,
      conversationId: input.deps?.conversationId ?? this.deps.conversationId ?? userId,
      journeyMemory,
      stage,
      scenario,
    })

    // Avoid duplicated questions: treat known slots as answered
    const avoidedDuplicateQuestions = handoff.knownSlots.filter(
      (s) => (input.memory.missingFields ?? []).map(String).includes(s) === false,
    )

    const decision = scoreSharedJourneyDecision({
      memory: input.memory,
      plan,
      handoff,
      mapsMinutes: input.deps?.mapsMinutes ?? this.deps.mapsMinutes ?? null,
      riskHint: input.deps?.riskHint
        ?? this.deps.riskHint
        ?? (scenario === 'disruption_recovery' ? 80 : null),
    })
    logs.push(`decision:${decision.overall}`)

    const turn = journeyMemory.turn + 1
    const previousDecisions = [
      ...journeyMemory.previousDecisions,
      `${stage}:${decision.overall}`,
    ].slice(-16)

    journeyMemory = writeJourneyMemory(userId, {
      stage,
      scenario,
      knownSlots: handoff.knownSlots,
      previousDecisions,
      completedStages: stage === 'completion'
        ? uniqueStages([...completed, stage])
        : completed,
      turn,
    })

    const observability = {
      conversation: [{
        turn,
        userText: userText || null,
        inferredIntent: stage,
        stage,
        avoidedDuplicateQuestions,
      }],
      decision: [{
        stage,
        decision,
        inputs: [
          `budget=${decision.budget}`,
          `flights=${decision.flights}`,
          `hotels=${decision.hotels}`,
          `maps=${decision.maps}`,
          `risk=${decision.risk}`,
          `preference=${decision.preference}`,
        ],
      }],
      execution: activation.execution
        ? [{
          stage,
          action: activation.execution.action,
          mode: activation.execution.mode,
          reference: activation.execution.reference,
          ok: activation.execution.ok,
        }]
        : [{
          stage,
          action: null,
          mode: activateChildren ? 'soft' : 'handoff',
          reference: null,
          ok: true,
        }],
    }

    const summary = buildJourneySummary({
      stage,
      scenario,
      decision,
      handoff,
      stages,
    })

    return {
      version: INTEGRATION_JOURNEY_VERSION,
      enabled: true,
      ok: true,
      stage,
      scenario,
      handoff,
      decision,
      stages,
      observability,
      memory: journeyMemory,
      consultantSummaryEn: summary.en,
      consultantSummaryAr: summary.ar,
      latencyMs: Date.now() - started,
      logs,
    }
  }
}

function uniqueStages(values: JourneyStageId[]): JourneyStageId[] {
  const seen = new Set<JourneyStageId>()
  const out: JourneyStageId[] = []
  for (const v of values) {
    if (seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

function disabled(latencyMs: number): JourneyResult {
  return {
    version: INTEGRATION_JOURNEY_VERSION,
    enabled: false,
    ok: false,
    stage: 'conversation',
    scenario: 'leisure',
    handoff: {
      conversationId: null,
      locale: 'en',
      scenario: 'leisure',
      stage: 'conversation',
      previousDecisions: [],
      knownSlots: [],
      missingSlots: [],
      destination: null,
      origin: null,
      budgetAmount: null,
      budgetCurrency: null,
      travelers: null,
      hasTripPlan: false,
      hasFlights: false,
      hasHotels: false,
      travelerState: 'planning',
    },
    decision: {
      overall: 0,
      budget: 0,
      timeline: 0,
      flights: 0,
      hotels: 0,
      maps: 0,
      risk: 0,
      preference: 0,
      rationaleEn: '',
      rationaleAr: '',
    },
    stages: [],
    observability: { conversation: [], decision: [], execution: [] },
    memory: {
      stage: 'conversation',
      scenario: 'leisure',
      knownSlots: [],
      previousDecisions: [],
      completedStages: [],
      turn: 0,
    },
    consultantSummaryEn: '',
    consultantSummaryAr: '',
    latencyMs,
    logs: ['journey_disabled'],
  }
}

export function createJourneyEngine(deps?: JourneyDeps): JourneyEngine {
  return new JourneyEngine(deps)
}

export async function runIntegrationJourney(
  input: RunIntegrationJourneyInput,
): Promise<JourneyResult> {
  return createJourneyEngine(input.deps).run(input)
}
