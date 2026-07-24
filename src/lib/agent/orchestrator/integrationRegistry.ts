/**
 * Phase 2 Stage 1 — Integration registry.
 * Maps pipeline stages → existing module entrypoints / feature ids.
 * Does not rewrite intelligence; registration only.
 */

import type { ConsultantStageId } from './pipelineTypes'

/** Feature id for the Stage 1 consultant pipeline (default OFF). */
export const CONSULTANT_PIPELINE_FEATURE_ID = 'ai.consultant_pipeline' as const

export interface IntegratedModuleRef {
  stageId: ConsultantStageId
  modulePath: string
  publicEntry: string
  featureId: string | null
  notes: string
}

/**
 * Canonical integration map — Stage 1 orchestration targets.
 * Frozen cores are invoked only via public APIs; evolution layers via run* entrypoints.
 */
export const INTEGRATION_REGISTRY: readonly IntegratedModuleRef[] = [
  {
    stageId: 'conversation',
    modulePath: 'src/lib/agent/conversationBrain',
    publicEntry: 'generateLocalConversation / buildTravelFacts',
    featureId: null,
    notes: 'Conversation Brain — CPU-only local path (no LLM / network).',
  },
  {
    stageId: 'decision',
    modulePath: 'src/lib/agent/decision',
    publicEntry: 'applyIntelligentDecisions / detectTripConflicts / computeTripScores',
    featureId: null,
    notes: 'Decision Engine — invoked only when tripPlan + toolResults provided; else readiness enrich.',
  },
  {
    stageId: 'reasoning',
    modulePath: 'src/lib/agent/reasoning',
    publicEntry: 'runConsultantReasoningPipeline',
    featureId: 'ai.consultant_reasoning',
    notes: 'Evolution Sprint 1 consultant reasoning.',
  },
  {
    stageId: 'reflection',
    modulePath: 'src/lib/agent/reflection',
    publicEntry: 'reflectTurn / createReflectionSession',
    featureId: 'ai.consultant_reflection',
    notes: 'Evolution Sprint 2 reflection.',
  },
  {
    stageId: 'planning_graph',
    modulePath: 'src/lib/agent/planningGraph',
    publicEntry: 'createPlanningGraph / PlanningGraph.addRoot',
    featureId: 'ai.planning_graph',
    notes: 'Evolution Sprint 4 planning graph.',
  },
  {
    stageId: 'traveler_intelligence',
    modulePath: 'src/lib/agent/traveler',
    publicEntry: 'observeTraveler / createTravelerModel',
    featureId: 'ai.traveler_intelligence',
    notes: 'Evolution Sprint 5 traveler intelligence.',
  },
  {
    stageId: 'destination_intelligence',
    modulePath: 'src/lib/agent/destination',
    publicEntry: 'runDestinationIntelligence',
    featureId: 'ai.destination_intelligence',
    notes: 'Evolution Sprint 7 destination intelligence.',
  },
  {
    stageId: 'recommendation_intelligence',
    modulePath: 'src/lib/agent/recommendation',
    publicEntry: 'runRecommendationEngine',
    featureId: 'ai.recommendation_intelligence',
    notes: 'Evolution Sprint 6 recommendation intelligence.',
  },
  {
    stageId: 'travel_strategy',
    modulePath: 'src/lib/agent/travelStrategy',
    publicEntry: 'runTravelStrategyEngine',
    featureId: 'ai.travel_strategy',
    notes: 'Evolution Sprint 8 travel strategy.',
  },
  {
    stageId: 'unified_response',
    modulePath: 'src/lib/agent/orchestrator',
    publicEntry: 'buildUnifiedConsultantResponse',
    featureId: CONSULTANT_PIPELINE_FEATURE_ID,
    notes: 'Orchestrator composition — no new intelligence.',
  },
] as const

export function getIntegrationRef(stageId: ConsultantStageId): IntegratedModuleRef | undefined {
  return INTEGRATION_REGISTRY.find((r) => r.stageId === stageId)
}

export function listIntegratedFeatureIds(): string[] {
  return [
    ...new Set(
      INTEGRATION_REGISTRY.map((r) => r.featureId).filter((id): id is string => Boolean(id)),
    ),
  ]
}
