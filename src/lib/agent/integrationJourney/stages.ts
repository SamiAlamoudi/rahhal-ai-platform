/**
 * Integration Sprint 12 — stage registry + soft child activation.
 * Child modules stay OFF unless their own flag is ON or activateChildren is set.
 */

import type { FeatureId } from '../../ai/featureFlags/types'
import { getFeatureRegistry } from '../../ai'
import type { AgentMemory, TripPlan } from '../types'
import type { JourneyStageId, JourneyStageStatus, JourneyStageTrace } from './types'
import { JOURNEY_STAGE_ORDER } from './types'

export interface StageModuleBinding {
  stage: JourneyStageId
  moduleId: string
  featureId: FeatureId | null
}

export const STAGE_BINDINGS: StageModuleBinding[] = [
  { stage: 'conversation', moduleId: 'conversation', featureId: 'ai.conversation_intelligence' },
  { stage: 'intent', moduleId: 'intent', featureId: null },
  { stage: 'planner', moduleId: 'travelPlanner', featureId: 'ai.travel_planner' },
  { stage: 'destination', moduleId: 'integrationDestinationIntelligence', featureId: 'ai.integration_destination_intelligence' },
  { stage: 'flights', moduleId: 'integrationFlightSearch', featureId: 'ai.live_flight_search' },
  { stage: 'hotels', moduleId: 'integrationHotelSearch', featureId: 'ai.live_hotel_search' },
  { stage: 'budget', moduleId: 'integrationBudgetPricing', featureId: 'ai.integration_budget_pricing' },
  { stage: 'orchestrator', moduleId: 'integrationTripOrchestrator', featureId: 'ai.integration_trip_orchestrator' },
  { stage: 'maps', moduleId: 'integrationMapsMobility', featureId: 'ai.integration_maps_mobility' },
  { stage: 'companion', moduleId: 'integrationTripCompanion', featureId: 'ai.integration_trip_companion' },
  { stage: 'action', moduleId: 'integrationActionExecution', featureId: 'ai.integration_action_execution' },
  { stage: 'disruption', moduleId: 'integrationDisruptionRecovery', featureId: 'ai.integration_disruption_recovery' },
  { stage: 'completion', moduleId: 'journeyCompletion', featureId: null },
]

export function isChildFlagOn(featureId: FeatureId | null): boolean {
  if (!featureId) return true
  try {
    return getFeatureRegistry().isEnabled(featureId)
  } catch {
    return false
  }
}

export function buildStageTraces(input: {
  active: JourneyStageId
  completed: JourneyStageId[]
  activateChildren?: boolean
}): JourneyStageTrace[] {
  return STAGE_BINDINGS.map((binding) => {
    const childFlagOn = isChildFlagOn(binding.featureId)
    let status: JourneyStageStatus = 'ready'
    if (input.completed.includes(binding.stage)) status = 'completed'
    else if (binding.stage === input.active) status = 'active'
    else if (!childFlagOn && !input.activateChildren && binding.featureId) {
      status = 'skipped'
    }

    const note = status === 'skipped'
      ? `Child flag OFF (${binding.featureId}) — handoff ready`
      : status === 'active'
        ? 'Active journey stage'
        : status === 'completed'
          ? 'Completed earlier in journey'
          : 'Ready for handoff'

    return {
      stage: binding.stage,
      status,
      moduleId: binding.moduleId,
      latencyMs: 0,
      note,
      childFlagOn,
    }
  })
}

/**
 * Soft-activate the active stage's child module when allowed.
 * Returns a short note + optional execution hint — never rewrites providers.
 */
export async function softActivateStage(input: {
  stage: JourneyStageId
  memory: AgentMemory
  tripPlan?: TripPlan | null
  userText?: string | null
  userId?: string | null
  activateChildren?: boolean
}): Promise<{ note: string; latencyMs: number; execution?: { action: string | null; mode: string | null; reference: string | null; ok: boolean } }> {
  const binding = STAGE_BINDINGS.find((b) => b.stage === input.stage)
  if (!binding) return { note: 'unknown_stage', latencyMs: 0 }

  const allowed = input.activateChildren || isChildFlagOn(binding.featureId)
  if (!allowed) {
    return {
      note: `skipped:${binding.featureId ?? 'local'}`,
      latencyMs: 0,
    }
  }

  const started = Date.now()
  try {
    switch (input.stage) {
      case 'destination': {
        const mod = await import('../integrationDestinationIntelligence')
        const result = await mod.runDestinationIntelligence({
          requirements: input.memory.requirements,
          userText: input.userText,
          locale: input.memory.locale,
          deps: { enabled: true },
        })
        return {
          note: result.ok ? 'destination_ok' : 'destination_soft',
          latencyMs: Date.now() - started,
        }
      }
      case 'budget': {
        const mod = await import('../integrationBudgetPricing')
        const result = await mod.runBudgetPricing({
          memory: input.memory,
          tripPlan: input.tripPlan,
          userText: input.userText ?? 'Stay under my budget.',
          deps: { enabled: true, userId: input.userId },
        })
        return {
          note: result.ok ? 'budget_ok' : 'budget_soft',
          latencyMs: Date.now() - started,
        }
      }
      case 'orchestrator': {
        const mod = await import('../integrationTripOrchestrator')
        const result = await mod.runTripOrchestrator({
          memory: input.memory,
          tripPlan: input.tripPlan,
          userId: input.userId,
          deps: { enabled: true },
        })
        return {
          note: result.ok ? 'orchestrator_ok' : 'orchestrator_soft',
          latencyMs: Date.now() - started,
        }
      }
      case 'maps': {
        const mod = await import('../integrationMapsMobility')
        const result = await mod.runMapsMobility({
          memory: input.memory,
          tripPlan: input.tripPlan,
          userText: input.userText ?? 'How far is the hotel?',
          locale: input.memory.locale,
          deps: { enabled: true },
        })
        return {
          note: result.ok ? 'maps_ok' : 'maps_soft',
          latencyMs: Date.now() - started,
        }
      }
      case 'companion': {
        const mod = await import('../integrationTripCompanion')
        const result = await mod.runTripCompanion({
          memory: input.memory,
          tripPlan: input.tripPlan,
          userText: input.userText ?? "What's next?",
          locale: input.memory.locale,
          deps: { enabled: true },
        })
        return {
          note: result.ok ? 'companion_ok' : 'companion_soft',
          latencyMs: Date.now() - started,
        }
      }
      case 'action': {
        const mod = await import('../integrationActionExecution')
        const result = await mod.runActionExecution({
          memory: input.memory,
          tripPlan: input.tripPlan,
          userText: input.userText ?? 'Book it.',
          deps: { enabled: true, userId: input.userId },
        })
        return {
          note: result.ok ? 'action_ok' : 'action_soft',
          latencyMs: Date.now() - started,
          execution: {
            action: result.action,
            mode: result.mode,
            reference: result.execution?.reference ?? null,
            ok: result.ok,
          },
        }
      }
      case 'disruption': {
        const mod = await import('../integrationDisruptionRecovery')
        const result = await mod.runDisruptionRecovery({
          memory: input.memory,
          tripPlan: input.tripPlan,
          userText: input.userText ?? 'My flight is delayed.',
          deps: { enabled: true },
        })
        return {
          note: result.ok ? 'disruption_ok' : 'disruption_soft',
          latencyMs: Date.now() - started,
        }
      }
      case 'flights':
      case 'hotels':
        return {
          note: `${input.stage}_handoff_ready`,
          latencyMs: Date.now() - started,
        }
      case 'completion':
        return { note: 'journey_complete', latencyMs: Date.now() - started }
      default:
        return { note: `${input.stage}_local`, latencyMs: Date.now() - started }
    }
  } catch (err) {
    return {
      note: `error:${err instanceof Error ? err.message : String(err)}`,
      latencyMs: Date.now() - started,
    }
  }
}

export function stagesBefore(stage: JourneyStageId): JourneyStageId[] {
  const idx = JOURNEY_STAGE_ORDER.indexOf(stage)
  if (idx <= 0) return []
  return JOURNEY_STAGE_ORDER.slice(0, idx)
}
