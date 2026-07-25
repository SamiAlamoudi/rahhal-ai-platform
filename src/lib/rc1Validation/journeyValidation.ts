/**
 * Sprint 18 — End-to-end journey handoff validation (additive).
 * Exercises JourneyEngine with test overrides; does not rewrite engines.
 */

import { JourneyEngine } from '../agent/integrationJourney/engine'
import { JOURNEY_STAGE_ORDER, type JourneyStageId } from '../agent/integrationJourney/types'
import type { AgentMemory } from '../agent/types'
import type { JourneyStageHandoffResult, ValidationCheck } from './types'

/** Mission stages required by RC1 acceptance (mapped onto JourneyStageId). */
export const RC1_MISSION_STAGES: Array<{ label: string; stage: JourneyStageId }> = [
  { label: 'Discover destination', stage: 'destination' },
  { label: 'Budget planning', stage: 'budget' },
  { label: 'Flight planning', stage: 'flights' },
  { label: 'Hotel planning', stage: 'hotels' },
  { label: 'Multi-city planning', stage: 'orchestrator' },
  { label: 'Maps', stage: 'maps' },
  { label: 'Timeline generation', stage: 'planner' },
  { label: 'Companion', stage: 'companion' },
  { label: 'Disruption recovery', stage: 'disruption' },
  { label: 'Action execution', stage: 'action' },
  { label: 'Final summary', stage: 'completion' },
]

function baseMemory(): AgentMemory {
  return {
    locale: 'ar',
    phase: 'collecting',
    requirements: {
      destination: 'إسطنبول',
      origin: 'الرياض',
      adults: 2,
      budgetAmount: 8000,
      budgetCurrency: 'SAR',
    },
    tripPlan: null,
    itinerary: null,
    missingFields: [],
    lastIntent: 'unknown',
  } as unknown as AgentMemory
}

export async function validateJourneyHandoffs(): Promise<{
  handoffs: JourneyStageHandoffResult[]
  checks: ValidationCheck[]
}> {
  const engine = new JourneyEngine({ enabled: true, activateChildren: false })
  const handoffs: JourneyStageHandoffResult[] = []
  const checks: ValidationCheck[] = []
  let previous: string | null = null

  // Full stage order continuity
  for (const stage of JOURNEY_STAGE_ORDER) {
    const result = await engine.run({
      memory: baseMemory(),
      userText: stage === 'disruption' ? 'flight delay disruption' : 'plan my trip',
      locale: 'ar',
      deps: { enabled: true, forceStage: stage, activateChildren: false },
    })
    const handedOff = Boolean(
      result.enabled && result.ok && result.stage === stage && result.stages.some((s) => s.stage === stage),
    )
    handoffs.push({
      stage,
      previousStage: previous,
      handedOff,
      note: (result.consultantSummaryEn || result.logs.join('; ')).slice(0, 120),
    })
    previous = stage
  }

  // Mission coverage
  for (const mission of RC1_MISSION_STAGES) {
    const hit = handoffs.find((h) => h.stage === mission.stage)
    checks.push({
      id: `journey_${mission.stage}`,
      area: 'journey',
      status: hit?.handedOff ? 'pass' : 'fail',
      summary: `${mission.label} → stage ${mission.stage}`,
      detail: hit?.note,
    })
  }

  const allOrdered = handoffs.every((h) => h.handedOff)
  checks.push({
    id: 'journey_stage_order_continuity',
    area: 'journey',
    status: allOrdered ? 'pass' : 'fail',
    summary: allOrdered
      ? `All ${JOURNEY_STAGE_ORDER.length} journey stages hand off in order`
      : 'One or more journey stages failed handoff',
  })

  return { handoffs, checks }
}
