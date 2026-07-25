/**
 * RC-2 — light brain integration flag helpers (no orchestrator/execution imports).
 * Heavy pipeline lives in `./integration` and should be dynamically imported when ON.
 */

import { getFeatureRegistry } from '../ai'

export function isBrainConciergeIntegrationEnabled(options?: {
  brainEnabled?: boolean
}): boolean {
  if (typeof options?.brainEnabled === 'boolean') return options.brainEnabled
  const registry = getFeatureRegistry()
  return registry.isEnabled('brain.enabled') && registry.isEnabled('brain.concierge')
}

export function isBrainAgentHandoffEnabled(options?: {
  brainHandoffEnabled?: boolean
}): boolean {
  if (typeof options?.brainHandoffEnabled === 'boolean') return options.brainHandoffEnabled
  const registry = getFeatureRegistry()
  return (
    registry.isEnabled('brain.enabled') &&
    registry.isEnabled('brain.concierge') &&
    registry.isEnabled('brain.agent_handoff')
  )
}

export function isBrainVoiceIntegrationEnabled(options?: {
  brainVoiceEnabled?: boolean
}): boolean {
  if (typeof options?.brainVoiceEnabled === 'boolean') return options.brainVoiceEnabled
  const registry = getFeatureRegistry()
  return (
    registry.isEnabled('brain.enabled') &&
    registry.isEnabled('brain.concierge') &&
    registry.isEnabled('brain.voice')
  )
}

export function isBrainTravelEngineEnabled(options?: {
  brainTravelEngineEnabled?: boolean
}): boolean {
  if (typeof options?.brainTravelEngineEnabled === 'boolean') {
    return options.brainTravelEngineEnabled
  }
  const registry = getFeatureRegistry()
  return (
    registry.isEnabled('brain.enabled') &&
    registry.isEnabled('brain.concierge') &&
    registry.isEnabled('brain.travel_engine')
  )
}

export function isBrainTripPlanningEnabled(options?: {
  brainTripPlanningEnabled?: boolean
}): boolean {
  if (typeof options?.brainTripPlanningEnabled === 'boolean') {
    return options.brainTripPlanningEnabled
  }
  const registry = getFeatureRegistry()
  return (
    registry.isEnabled('brain.enabled') &&
    registry.isEnabled('brain.concierge') &&
    registry.isEnabled('brain.travel_engine') &&
    registry.isEnabled('brain.trip_planning')
  )
}

export function isBrainExecutionEnabled(options?: {
  brainExecutionEnabled?: boolean
}): boolean {
  if (typeof options?.brainExecutionEnabled === 'boolean') {
    return options.brainExecutionEnabled
  }
  const registry = getFeatureRegistry()
  return (
    registry.isEnabled('brain.enabled') &&
    registry.isEnabled('brain.concierge') &&
    registry.isEnabled('brain.travel_engine') &&
    registry.isEnabled('brain.trip_planning') &&
    registry.isEnabled('brain.execution')
  )
}

export function isBrainSearchEnabled(options?: {
  brainSearchEnabled?: boolean
}): boolean {
  if (typeof options?.brainSearchEnabled === 'boolean') {
    return options.brainSearchEnabled
  }
  const registry = getFeatureRegistry()
  return (
    registry.isEnabled('brain.enabled') &&
    registry.isEnabled('brain.concierge') &&
    registry.isEnabled('brain.travel_engine') &&
    registry.isEnabled('brain.trip_planning') &&
    registry.isEnabled('brain.execution') &&
    registry.isEnabled('brain.search')
  )
}

export function isBrainRealProvidersEnabled(options?: {
  brainRealProvidersEnabled?: boolean
}): boolean {
  if (typeof options?.brainRealProvidersEnabled === 'boolean') {
    return options.brainRealProvidersEnabled
  }
  const registry = getFeatureRegistry()
  return (
    registry.isEnabled('brain.enabled') &&
    registry.isEnabled('brain.concierge') &&
    registry.isEnabled('brain.travel_engine') &&
    registry.isEnabled('brain.trip_planning') &&
    registry.isEnabled('brain.execution') &&
    registry.isEnabled('brain.real_providers')
  )
}
