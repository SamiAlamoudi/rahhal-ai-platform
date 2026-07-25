/**
 * Planning Registry + feature gate.
 * Flag `brain.planning_engine` default OFF.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import type { PlanningRegistryEntry } from './types'
import { PLANNING_MODULE_HINTS } from './types'

export const BRAIN_PLANNING_ENGINE_FEATURE_ID = 'brain.planning_engine' as const

export function isBrainPlanningEngineEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(BRAIN_PLANNING_ENGINE_FEATURE_ID)
}

export const PLANNING_REGISTRY: readonly PlanningRegistryEntry[] = [
  {
    id: 'reg-trip',
    component: 'trip_planner',
    moduleHints: ['travel_workspace', 'journey_timeline'],
  },
  {
    id: 'reg-dest',
    component: 'destination_selector',
    moduleHints: ['decision_center', 'insights_center'],
  },
  {
    id: 'reg-itin',
    component: 'itinerary_generator',
    moduleHints: ['travel_workspace', 'journey_timeline'],
  },
  {
    id: 'reg-budget',
    component: 'budget_planner',
    moduleHints: ['insights_center', 'decision_center'],
  },
  {
    id: 'reg-schedule',
    component: 'schedule_optimizer',
    moduleHints: ['journey_timeline'],
  },
  {
    id: 'reg-transport',
    component: 'transportation_planner',
    moduleHints: ['booking_hub', 'travel_workspace'],
  },
  {
    id: 'reg-stay',
    component: 'accommodation_planner',
    moduleHints: ['booking_hub'],
  },
  {
    id: 'reg-activity',
    component: 'activity_planner',
    moduleHints: ['travel_workspace'],
  },
  {
    id: 'reg-risk',
    component: 'risk_analyzer',
    moduleHints: ['decision_center', 'insights_center'],
  },
  {
    id: 'reg-constraint',
    component: 'constraint_engine',
    moduleHints: ['traveler_profile', 'memory_center'],
  },
  {
    id: 'reg-pref',
    component: 'preference_matcher',
    moduleHints: ['traveler_profile', 'memory_center'],
  },
  {
    id: 'reg-alt',
    component: 'alternative_generator',
    moduleHints: ['decision_center'],
  },
  {
    id: 'reg-scenario',
    component: 'scenario_builder',
    moduleHints: ['decision_center', 'insights_center'],
  },
] as const

export function listPlanningRegistry(): PlanningRegistryEntry[] {
  return PLANNING_REGISTRY.map((entry) => ({
    ...entry,
    moduleHints: [...entry.moduleHints],
  }))
}

export function listPlanningModuleHints() {
  return PLANNING_MODULE_HINTS
}

export const PlanningRegistry = {
  featureId: BRAIN_PLANNING_ENGINE_FEATURE_ID,
  isEnabled: isBrainPlanningEngineEnabled,
  list: listPlanningRegistry,
  moduleHints: listPlanningModuleHints,
}
