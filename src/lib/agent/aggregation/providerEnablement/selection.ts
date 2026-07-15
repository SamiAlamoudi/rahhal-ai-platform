/**
 * Phase AJ — deterministic provider selection with recorded fallback.
 */

import { getLogger } from '../../../ops/logging/structuredLogger'
import { getCorrelationId } from '../../../ops/logging/correlation'
import {
  defaultLiveProviderForCapability,
  isCapabilityLiveEnabled,
  resolveProviderEnablementFlags,
} from './flags'
import {
  recordMockFallback,
  recordProviderSelection,
} from './metrics'
import { checkProviderReadiness } from './readiness'
import { getMockFallbackEntry, getRegistryEntry } from './registry'
import type {
  ProviderCapability,
  ProviderEnablementFlags,
  ProviderId,
  ProviderSelectionDecision,
  SelectionOutcome,
} from './types'

const LIVE_ALIASES: Record<string, ProviderId> = {
  amadeus: 'amadeus',
  booking: 'booking_com',
  booking_com: 'booking_com',
  google_maps: 'google_maps',
  google: 'google_maps',
  googlemaps: 'google_maps',
  openweather: 'openweather',
  weather: 'openweather',
}

function mockIdForCapability(capability: ProviderCapability): ProviderId {
  switch (capability) {
    case 'flights':
      return 'amadeus_mock'
    case 'hotels':
      return 'booking_com_mock'
    case 'maps':
      return 'google_maps_mock'
    case 'weather':
      return 'openweather_mock'
    case 'transport':
      return 'transport_mock'
    case 'activities':
      return 'activities_mock'
  }
}

function normalizeRequested(raw: string): string {
  const value = raw.trim().toLowerCase()
  if (!value || value === 'mock') return 'mock'
  if (value === 'booking') return 'booking_com'
  if (value === 'google' || value === 'googlemaps') return 'google_maps'
  if (value === 'weather') return 'openweather'
  if (value === 'live') return 'live'
  return value
}

/**
 * Map a requested provider string to a live registry id for the capability.
 * Returns { kind: 'invalid' } for unrecognized names.
 * Returns { kind: 'default' } when "live" is requested (use capability default).
 */
function resolveLiveTarget(
  capability: ProviderCapability,
  requested: string,
): { kind: 'ok'; id: ProviderId } | { kind: 'invalid' } | { kind: 'unavailable'; id: ProviderId } | { kind: 'default' } {
  if (requested === 'live') return { kind: 'default' }

  const aliased = LIVE_ALIASES[requested] ?? (requested as ProviderId)
  const entry = getRegistryEntry(aliased)
  if (!entry) return { kind: 'invalid' }
  if (entry.capability !== capability) return { kind: 'invalid' }
  if (!entry.liveAdapterAvailable) {
    return { kind: 'unavailable', id: aliased }
  }
  return { kind: 'ok', id: aliased }
}

export function selectProviderForCapability(
  capability: ProviderCapability,
  options: {
    env?: Record<string, string | undefined>
    flags?: ProviderEnablementFlags
    circuitState?: Record<string, 'closed' | 'open' | 'half_open'>
  } = {},
): ProviderSelectionDecision {
  const flags = options.flags ?? resolveProviderEnablementFlags(options.env)
  const requestedRaw = flags.capabilities[capability]?.provider ?? 'mock'
  const requested = normalizeRequested(requestedRaw)
  const mockId = mockIdForCapability(capability)
  const logger = getLogger()

  const decide = (
    decision: Omit<ProviderSelectionDecision, 'capability' | 'requestedProvider'>,
  ): ProviderSelectionDecision => {
    const full: ProviderSelectionDecision = {
      capability,
      requestedProvider: requested,
      ...decision,
    }
    recordProviderSelection({
      providerId: full.selectedProviderId,
      capability,
      outcome: full.outcome,
    })
    if (full.fallbackUsed) {
      recordMockFallback({
        providerId: full.selectedProviderId,
        capability,
        reason: full.reason,
      })
    }
    logger.info('provider_enablement', 'selection', 'provider_selected', {
      correlationId: getCorrelationId(),
      providerId: full.selectedProviderId,
      capability,
      environment: full.readiness?.environment ?? 'mock',
      outcome: full.outcome,
      fallbackUsed: full.fallbackUsed,
      reason: full.reason,
    })
    return full
  }

  // Default mock path
  if (!isCapabilityLiveEnabled(flags, capability) || requested === 'mock') {
    return decide({
      selectedProviderId: mockId,
      source: 'mock',
      outcome: 'mock_default',
      reason: 'live_flag_off_or_mock_selected',
      fallbackUsed: false,
      readiness: null,
    })
  }

  let liveId: ProviderId | null = null
  const target = resolveLiveTarget(capability, requested)

  if (target.kind === 'invalid') {
    return decide({
      selectedProviderId: mockId,
      source: 'mock',
      outcome: 'invalid_selection',
      reason: `invalid_provider_selection:${requested}`,
      fallbackUsed: false,
      readiness: null,
    })
  }

  if (target.kind === 'default') {
    liveId = defaultLiveProviderForCapability(capability) as ProviderId | null
  } else if (target.kind === 'unavailable') {
    if (flags.strictLive) {
      return decide({
        selectedProviderId: target.id,
        source: 'live',
        outcome: 'strict_live_rejected',
        reason: 'live_adapter_unavailable',
        fallbackUsed: false,
        readiness: null,
      })
    }
    return decide({
      selectedProviderId: mockId,
      source: 'mock',
      outcome: 'fallback_mock',
      reason: 'live_adapter_unavailable',
      fallbackUsed: true,
      readiness: null,
    })
  } else {
    liveId = target.id
  }

  if (!liveId) {
    if (flags.strictLive) {
      return decide({
        selectedProviderId: mockId,
        source: 'live',
        outcome: 'strict_live_rejected',
        reason: 'live_adapter_unavailable',
        fallbackUsed: false,
        readiness: null,
      })
    }
    return decide({
      selectedProviderId: mockId,
      source: 'mock',
      outcome: 'fallback_mock',
      reason: 'live_adapter_unavailable',
      fallbackUsed: true,
      readiness: null,
    })
  }

  const entry = getRegistryEntry(liveId)
  if (!entry || !entry.liveAdapterAvailable) {
    if (flags.strictLive) {
      return decide({
        selectedProviderId: liveId,
        source: 'live',
        outcome: 'strict_live_rejected',
        reason: 'live_adapter_unavailable',
        fallbackUsed: false,
        readiness: null,
      })
    }
    return decide({
      selectedProviderId: mockId,
      source: 'mock',
      outcome: 'fallback_mock',
      reason: 'live_adapter_unavailable',
      fallbackUsed: true,
      readiness: null,
    })
  }

  const readiness = checkProviderReadiness(entry, {
    env: options.env,
    flags,
    circuitState: options.circuitState,
  })

  if (readiness.enabled && readiness.healthy && readiness.configured) {
    return decide({
      selectedProviderId: liveId,
      source: 'live',
      outcome: 'live_selected',
      reason: 'readiness_ok',
      fallbackUsed: false,
      readiness,
    })
  }

  // Fail readiness → fallback or strict reject
  const outcome: SelectionOutcome = flags.strictLive
    ? 'strict_live_rejected'
    : flags.mockFallbackEnabled
      ? 'fallback_mock'
      : 'strict_live_rejected'

  if (outcome === 'strict_live_rejected') {
    return decide({
      selectedProviderId: liveId,
      source: 'live',
      outcome,
      reason: readiness.reason || 'readiness_failed',
      fallbackUsed: false,
      readiness,
    })
  }

  const fallback = getMockFallbackEntry(liveId)
  return decide({
    selectedProviderId: (fallback?.providerId as ProviderId) ?? mockId,
    source: 'mock',
    outcome: 'fallback_mock',
    reason: readiness.reason || 'readiness_failed',
    fallbackUsed: true,
    readiness,
  })
}

export function selectAllCapabilities(
  options: {
    env?: Record<string, string | undefined>
    flags?: ProviderEnablementFlags
    circuitState?: Record<string, 'closed' | 'open' | 'half_open'>
  } = {},
): ProviderSelectionDecision[] {
  const caps: ProviderCapability[] = [
    'flights',
    'hotels',
    'maps',
    'weather',
    'transport',
    'activities',
  ]
  return caps.map((c) => selectProviderForCapability(c, options))
}
