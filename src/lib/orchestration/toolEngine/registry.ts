/**
 * Tool Registry + Capability Registry + feature gate.
 * Flag `brain.tool_engine` default OFF.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import type {
  ToolCapabilityRegistryEntry,
  ToolFutureCapabilityId,
  ToolRegistryEntry,
} from './types'
import { TOOL_FUTURE_CAPABILITIES } from './types'

export const BRAIN_TOOL_ENGINE_FEATURE_ID = 'brain.tool_engine' as const

export function isBrainToolEngineEnabled(options?: {
  enabled?: boolean
}): boolean {
  if (typeof options?.enabled === 'boolean') return options.enabled
  return getFeatureRegistry().isEnabled(BRAIN_TOOL_ENGINE_FEATURE_ID)
}

function categoryFor(capabilityId: ToolFutureCapabilityId): string {
  switch (capabilityId) {
    case 'flight_search':
    case 'hotel_search':
    case 'activity_search':
    case 'booking_apis':
    case 'visa_services':
      return 'travel_services'
    case 'weather':
    case 'maps':
    case 'currency':
      return 'reference_services'
    case 'calendar':
    case 'email':
    case 'whatsapp':
    case 'notifications':
      return 'communication'
    case 'payments':
    case 'crm':
      return 'commerce'
    case 'document_processing':
    case 'translation':
    case 'voice':
    case 'image':
      return 'media_processing'
    default:
      return 'general'
  }
}

export const TOOL_CAPABILITY_REGISTRY: readonly ToolCapabilityRegistryEntry[] =
  TOOL_FUTURE_CAPABILITIES.map((capabilityId) => ({
    capabilityId,
    label: capabilityId,
    categoryHint: categoryFor(capabilityId),
  }))

export const TOOL_REGISTRY: readonly ToolRegistryEntry[] =
  TOOL_FUTURE_CAPABILITIES.map((capabilityId) => ({
    id: `treg-${capabilityId}`,
    capabilityId,
    toolId: `tool-${capabilityId}`,
    enabledHint: false as const,
  }))

export function listToolRegistry(): ToolRegistryEntry[] {
  return TOOL_REGISTRY.map((entry) => ({ ...entry }))
}

export function listToolCapabilityRegistry(): ToolCapabilityRegistryEntry[] {
  return TOOL_CAPABILITY_REGISTRY.map((entry) => ({ ...entry }))
}

export function listToolFutureCapabilities() {
  return TOOL_FUTURE_CAPABILITIES
}

export const ToolRegistry = {
  featureId: BRAIN_TOOL_ENGINE_FEATURE_ID,
  isEnabled: isBrainToolEngineEnabled,
  list: listToolRegistry,
  capabilities: listToolCapabilityRegistry,
  futureCapabilities: listToolFutureCapabilities,
}
