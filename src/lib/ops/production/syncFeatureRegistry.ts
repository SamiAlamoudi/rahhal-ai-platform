/**
 * Phase AI — sync FeatureRegistry product flags from centralized live capability config.
 */

import { getFeatureRegistry } from '../../ai/featureFlags'
import type { LiveCapabilityFlags } from './liveCapabilityFlags'

/** Apply capability flags onto the product FeatureRegistry (all stay OFF by default). */
export function syncFeatureRegistryFromCapabilities(flags: LiveCapabilityFlags): void {
  const registry = getFeatureRegistry()
  registry.setEnabled('providers.live_master', flags.liveProvidersMaster)
  registry.setEnabled('live.flights', flags.liveFlights)
  registry.setEnabled('live.hotels', flags.liveHotels)
  registry.setEnabled('live.activities', flags.liveActivities)
  registry.setEnabled('live.transport', flags.liveTransport)
  // Never enable live payments while freeze holds — force OFF.
  registry.setEnabled('live.payments', false)
  registry.setEnabled('payments.live', false)
}
