/**
 * Phase AJ — sync providers.*.live FeatureRegistry ids from enablement flags.
 */

import { getFeatureRegistry } from '../../../ai/featureFlags'
import { resolveProviderEnablementFlags } from './flags'

/** Align Phase AJ FeatureRegistry capability flags (defaults OFF). */
export function syncProviderEnablementFeatureFlags(
  env?: Record<string, string | undefined>,
): void {
  const enablement = resolveProviderEnablementFlags(env)
  const registry = getFeatureRegistry()
  registry.setEnabled(
    'providers.flights.live',
    enablement.masterLive && enablement.capabilities.flights.live,
  )
  registry.setEnabled(
    'providers.hotels.live',
    enablement.masterLive && enablement.capabilities.hotels.live,
  )
  registry.setEnabled(
    'providers.maps.live',
    enablement.masterLive && enablement.capabilities.maps.live,
  )
  registry.setEnabled(
    'providers.weather.live',
    enablement.masterLive && enablement.capabilities.weather.live,
  )
  registry.setEnabled(
    'providers.transport.live',
    enablement.masterLive && enablement.capabilities.transport.live,
  )
  registry.setEnabled(
    'providers.activities.live',
    enablement.masterLive && enablement.capabilities.activities.live,
  )
}
